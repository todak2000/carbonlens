/**
 * forwardAdapter.ts
 *
 * Pure (side-effect-free) forward model adapter for history matching.
 * Replicates the computeYearly() logic from useSimulation.ts without any
 * React state setters, so it can be called from the optimizer and tests.
 *
 * Land constant degeneracy note:
 *   When matchable.landConstant is provided, we derive the effective residual
 *   gas saturation using Land's formula at nominal Sg_max = 0.5:
 *     Sgr = Sg_max / (1 + C * Sg_max) = 0.5 / (1 + C * 0.5)
 *   This couples landConstant and residualGasSaturation. When
 *   residualGasSaturation is explicitly provided, it overrides this derivation.
 */

import type { FormationParams, SimulationResult } from '../../types';
import type { MatchableParams } from './types';
import {
  co2DensitySpanWagner,
  co2DensityWithImpurities,
  brineDensityGarcia,
  co2ViscosityFenghour,
  co2SolubilityDuanSun,
  calculateMultiSaltSolubility,
  co2DiffusionCoefficient,
  determinePhase,
  computeTr,
  computePr,
  evaluateMars,
  scaleInput,
  subEquation,
  subScaler,
  supEquation,
  supScaler,
  assessApplicabilityDomain,
} from '../index';
import type { MarsInput } from '../mars/types';
import type { MultiSaltBrine } from '../index';
import { expIntegralE1 } from '../../utils/computePressureField';

// A minimal well descriptor for the forward model
interface SimpleWell {
  id: string;
  x: number;
  z: number;
  injectionRate: number;    // Mt/yr
  rampUpYears: number;
  rampDownYears: number;
}

function wellRateAt(w: SimpleWell, year: number, projectYears: number): number {
  if (year <= 0) return 0;
  if (w.rampUpYears > 0 && year < w.rampUpYears) {
    return w.injectionRate * (year / w.rampUpYears);
  }
  const shutIn = projectYears - w.rampDownYears;
  if (year >= projectYears) return 0;
  if (w.rampDownYears > 0 && year > shutIn) {
    return w.injectionRate * (1 - (year - shutIn) / w.rampDownYears);
  }
  return w.injectionRate;
}

function cumulativeAt(w: SimpleWell, year: number, projectYears: number): number {
  // Numerical integration over 1-year steps
  let cum = 0;
  for (let y = 1; y <= year; y++) {
    cum += wellRateAt(w, y, projectYears);
  }
  return cum;
}

/**
 * Derive effective residual gas saturation from Land constant and
 * the given residualGasSaturation override.
 *
 * If both are present, residualGasSaturation takes precedence (explicit override).
 * If only landConstant is given, derive Sgr = 0.5 / (1 + C * 0.5).
 */
function effectiveSgr(matchable: Partial<MatchableParams>): number {
  if (matchable.residualGasSaturation !== undefined) {
    return matchable.residualGasSaturation;
  }
  if (matchable.landConstant !== undefined) {
    const C = matchable.landConstant;
    // Land's formula at nominal Sg_max = 0.5
    return 0.5 / (1 + C * 0.5);
  }
  return 0.10; // default
}

/**
 * Run the pure forward model for years 1..years.
 *
 * @param formation              Base formation parameters
 * @param matchable              Overrides for history-matchable parameters
 * @param years                  Number of simulation years (1..years)
 * @param injectionRateMtPerYear Injection rate at a single default well
 * @returns Array of SimulationResult for each year
 */
export function runForwardModel(
  formation: FormationParams,
  matchable: Partial<MatchableParams>,
  years: number,
  injectionRateMtPerYear: number,
): SimulationResult[] {
  // Merge overrides into effective formation params
  const params: FormationParams = {
    ...formation,
    porosity:      matchable.porosity      ?? formation.porosity,
    permeability:  matchable.permeability  ?? formation.permeability,
    netToGross:    matchable.netToGross    ?? formation.netToGross,
  };

  const Sgr = effectiveSgr(matchable);
  const dissolutionFactor = matchable.dissolutionRateFactor ?? 1.0;

  // Single default well centred at (0,0) — mirrors Sleipner well placement
  const wells: SimpleWell[] = [{
    id: 'fw_well',
    x: 0,
    z: 0,
    injectionRate: injectionRateMtPerYear,
    rampUpYears: 0,
    rampDownYears: 0,
  }];

  const projectYears = Math.max(years, 1);
  const T_K = params.temperature + 273.15;
  const A = params.area * 1e6;
  const h_m = params.thickness;
  const phi = params.porosity;
  const ntg = params.netToGross;

  const totalPoreVolume = A * h_m * ntg * phi;

  // CO2 density at initial reservoir conditions
  const rhoCO2_init = co2DensityWithImpurities(T_K, params.pressure * 1e6, params.methaneFraction, params.nitrogenFraction);

  // DOE capacity coefficient framework (Goodman et al. 2011)
  const Cc_P10 = 0.0051;
  const Cc_P50 = 0.0200;
  const Cc_P90 = 0.0550;
  const capacityP10 = totalPoreVolume * Cc_P10 * rhoCO2_init / 1e9;
  const totalCapacity = totalPoreVolume * Cc_P50 * rhoCO2_init / 1e9;
  const capacityP90 = totalPoreVolume * Cc_P90 * rhoCO2_init / 1e9;

  const results: SimulationResult[] = [];
  let prevResult: SimulationResult | null = null;

  for (let year = 1; year <= years; year++) {
    // Cumulative injection
    let totalCum = 0;
    for (const w of wells) {
      totalCum += cumulativeAt(w, year, projectYears);
    }

    // Current rate
    const currentRate = wells.reduce((s, w) => s + wellRateAt(w, year, projectYears), 0);

    // Pressure model: Theis transient radial flow
    const rhoCO2_mobile = co2DensityWithImpurities(T_K, params.pressure * 1e6, params.methaneFraction, params.nitrogenFraction);
    const visc = co2ViscosityFenghour(T_K, rhoCO2_mobile);
    const perm_m2 = params.permeability * 9.869e-16;
    const ct = 1e-9;
    const t_sec = year * 365.25 * 24 * 3600;
    const alpha = perm_m2 / (phi * visc * ct);
    const rw_m = 0.1;

    let dP_max = 0;
    for (const wi of wells) {
      const qwi = wellRateAt(wi, year, projectYears);
      if (qwi <= 0) continue;
      const Qi = qwi * 1e9 / (rhoCO2_mobile * 365.25 * 24 * 3600);
      const ui = rw_m * rw_m / (4 * alpha * Math.max(t_sec, 1));
      let dP_i = (Qi * visc) / (4 * Math.PI * perm_m2 * h_m) * expIntegralE1(ui) / 1e6;

      // Inter-well interference (none for single well)
      dP_max = Math.max(dP_max, dP_i);
    }
    const dP_capped = Math.max(0, Math.min(25, dP_max));
    const P_t = params.pressure + dP_capped;

    // Recompute fluid properties at injection pressure
    const P_Pa = P_t * 1e6;
    const rhoCO2 = co2DensityWithImpurities(T_K, P_Pa, params.methaneFraction, params.nitrogenFraction);
    const rhoBrine = brineDensityGarcia(T_K, P_t, params.monovalentSalinity, params.bivalentSalinity);
    const drho = rhoBrine - rhoCO2;
    const drho_sq = drho * drho / 1e6;

    const phase = determinePhase(T_K, P_t, params.methaneFraction, params.nitrogenFraction);
    const Pr = computePr(P_t, params.methaneFraction, params.nitrogenFraction);
    const Tr = computeTr(T_K, params.methaneFraction, params.nitrogenFraction);

    const input: MarsInput = {
      Pr, Tr,
      MCM: params.monovalentSalinity,
      BCM: params.bivalentSalinity,
      x_CH4: params.methaneFraction * 100,
      x_N2: params.nitrogenFraction * 100,
      drho_sq,
      BCM_bin: params.bivalentSalinity > 0 ? 1 : 0,
      CH4_bin: params.methaneFraction > 0 ? 1 : 0,
      N2_bin: params.nitrogenFraction > 0 ? 1 : 0,
    };

    let ift: number | null = null;
    if (phase === 'subcritical') {
      ift = evaluateMars(scaleInput(input, subScaler), subEquation);
    } else {
      ift = evaluateMars(scaleInput(input, supScaler), supEquation);
    }

    const adAssessment = assessApplicabilityDomain(input, phase);

    let solubility: number;
    if (params.saltType !== 'NaCl' && params.bivalentSalinity > 0) {
      const brine: MultiSaltBrine = params.saltType === 'CaCl2'
        ? { m_NaCl: params.monovalentSalinity, m_KCl: 0, m_CaCl2: params.bivalentSalinity, m_MgCl2: 0 }
        : { m_NaCl: params.monovalentSalinity, m_KCl: 0, m_CaCl2: params.bivalentSalinity * 0.6, m_MgCl2: params.bivalentSalinity * 0.4 };
      const xCO2 = calculateMultiSaltSolubility(T_K, P_t, brine);
      solubility = xCO2 * 55.508 / Math.max(1e-9, 1 - xCO2);
    } else {
      solubility = co2SolubilityDuanSun(T_K, P_t, params.monovalentSalinity, params.bivalentSalinity);
    }
    const diffusion = co2DiffusionCoefficient(T_K, P_t, params.porosity);

    // Gravity current plume radius
    const cumVolM3 = totalCum * 1e9 / rhoCO2;
    const hEff = h_m * 0.10;
    const plumeRadius = Math.sqrt(2 * cumVolM3 / (Math.PI * phi * Math.max(1, hEff)));
    const plumeHeight = h_m * 0.55 * Math.min(1, Math.sqrt(totalCum / Math.max(0.001, totalCapacity)));

    // ── Physics-based independent trapping capacities (mirrors useSimulation.ts) ──
    // Each mechanism capacity is derived from formation properties + plume geometry.
    const SWI_CONNATE_FA = 0.15;
    const C_LAND_FA = 2.5;
    const GEOMETRY_CLOSURE_FA: Record<string, { trapFrac: number; closureFrac: number }> = {
      anticline: { trapFrac: 0.80, closureFrac: 0.25 },
      dome:      { trapFrac: 0.90, closureFrac: 0.30 },
      fault:     { trapFrac: 0.70, closureFrac: 0.20 },
      layered:   { trapFrac: 0.55, closureFrac: 0.15 },
      stratigraphic: { trapFrac: 0.65, closureFrac: 0.18 },
      channel:   { trapFrac: 0.50, closureFrac: 0.12 },
      gridfile:  { trapFrac: 0.70, closureFrac: 0.20 },
    };
    const S_gi_fa = ntg * (1 - SWI_CONNATE_FA);
    const S_gr_fa = S_gi_fa / (1 + C_LAND_FA * S_gi_fa);
    const gf_fa = GEOMETRY_CLOSURE_FA[params.geometryType] ?? { trapFrac: 0.70, closureFrac: 0.20 };
    const A_fa = params.area * 1e6;
    const muBrine_fa = 6e-4;

    // 1. Structural capacity
    const V_struct_fa = A_fa * gf_fa.trapFrac * (h_m * gf_fa.closureFrac) * ntg * phi * Math.max(0, 1 - SWI_CONNATE_FA - S_gr_fa);
    const structuralCapacity = Math.max(0, V_struct_fa * rhoCO2 / 1e9);

    // 2. Residual capacity (Land snap-off in swept volume)
    //    PVI-based sweep efficiency — avoids the algebraic cancellation where
    //    V_swept = π×r²×h_eff×NTG×φ with r=sqrt(2V/(π×φ×h_eff)) collapses to
    //    2×V_CO₂×NTG, making porosity and thickness cancel out entirely.
    const V_pore_formation_fa = A_fa * h_m * ntg * phi; // total reservoir pore volume (m³)
    const PVI_fa = cumVolM3 / Math.max(1e3, V_pore_formation_fa); // pore volumes injected
    const FQI_fa = Math.min(2.0, Math.max(0.15, Math.sqrt(params.permeability * phi / (200 * 0.20))));
    const E_sweep_fa = Math.min(gf_fa.trapFrac, (1 - Math.exp(-3 * PVI_fa * FQI_fa)) * gf_fa.trapFrac);
    const V_swept_fa = V_pore_formation_fa * E_sweep_fa;
    const residualCapacity = Math.max(0, V_swept_fa * S_gr_fa * rhoCO2 / 1e9);

    // 3. Dissolution capacity — plume brine volume reference (mirrors useSimulation.ts)
    const X_sat_fa = solubility * 0.044;
    const A_contact_fa = Math.PI * plumeRadius * plumeRadius;
    const t_sec_fa = Math.max(1, year) * 365.25 * 24 * 3600;
    const delta_rho_fa = 2.0;
    const Ra_fa = delta_rho_fa * 9.81 * perm_m2 * h_m / (muBrine_fa * diffusion * phi);
    const conv_fa = Math.max(1, Math.min(20, Math.sqrt(Math.max(0, Ra_fa / 40))));
    const D_eff_fa = diffusion * conv_fa;
    const V_p_plume_fa = Math.max(1, Math.PI * plumeRadius * plumeRadius * plumeHeight * phi * ntg);
    const S_g_plume_fa = Math.min(1 - 0.15, cumVolM3 / V_p_plume_fa);
    const V_brine_fa = V_p_plume_fa * (1 - S_g_plume_fa);
    const dissFick_fa = 2 * A_contact_fa * rhoBrine * X_sat_fa * Math.sqrt(D_eff_fa * t_sec_fa) / 1e9;
    const t_onset_fa  = Math.max(2, 50 / Math.sqrt(params.permeability));
    const t_yr_fa     = Math.max(1, year);
    const f_conv_fa   = t_yr_fa <= t_onset_fa
      ? 1.0
      : Math.min(3.0, 1.0 + 2.0 * (t_yr_fa / t_onset_fa - 1) * Math.sqrt(params.permeability / 100));
    const dissUpper_fa = Math.min(
      V_brine_fa * rhoBrine * X_sat_fa / 1e9 * f_conv_fa,
      0.35 * Math.max(0.001, totalCum),
    );
    const dissolutionCapacity = Math.max(0, Math.min(dissFick_fa, dissUpper_fa));

    // 4. Mineral capacity — formation-class-specific TST kinetics (mirrors useSimulation.ts)
    const isCarbonate_fa  = params.lithologyClass === 'carbonate';
    const RMAT_FA         = isCarbonate_fa ? 2710    : 2650;
    const F_RCT_FA        = isCarbonate_fa ? 0.05    : 0.01;
    const A_SP_FA         = isCarbonate_fa ? 0.5     : 0.1;
    const KM_REF_FA       = isCarbonate_fa ? 1.55e-6 : 1e-9;
    const TAU_FA          = isCarbonate_fa ? 15      : 25;
    const CAP_FRAC_FA     = isCarbonate_fa ? 0.15    : 0.10;
    const T_REF_FA = 383.15; const EA_FA = 62800; const RG_FA = 8.314;
    const V_bulk_plume_fa = Math.PI * plumeRadius * plumeRadius * plumeHeight;
    const A_reactive_fa = V_bulk_plume_fa * (1 - phi) * RMAT_FA * F_RCT_FA * A_SP_FA;
    const k_m_T_fa = KM_REF_FA * Math.exp(-EA_FA / RG_FA * (1 / T_K - 1 / T_REF_FA));
    const f_decay_fa = 1 - Math.exp(-Math.max(1, year) / TAU_FA);
    const mineralCapacity = projectYears < 30 ? 0 : Math.max(0,
      A_reactive_fa * k_m_T_fa * (100 * 365.25 * 24 * 3600) * 44.01e-12 * f_decay_fa,
    );
    const totalFormationCapacity = structuralCapacity + residualCapacity + dissolutionCapacity + mineralCapacity;

    // 5. Actual trapping — same ordering as useSimulation.ts (dissolution + mineral first)
    const solubilityTrapping = Math.min(dissolutionCapacity, totalCum);
    const mineralTrappingFA = projectYears < 30 ? 0 : Math.min(
      CAP_FRAC_FA * Math.max(0.001, totalCum),
      Math.max(0, A_reactive_fa * k_m_T_fa * t_sec_fa * 44.01e-12 * f_decay_fa),
    );
    const freePhaseCO2_Mt_fa = Math.max(0, totalCum - solubilityTrapping - mineralTrappingFA);
    const f_residual_fa = S_gi_fa > 0.001 ? S_gr_fa / S_gi_fa : 0;
    const residualTrappingScaled = freePhaseCO2_Mt_fa * f_residual_fa;
    const mobilePlume = freePhaseCO2_Mt_fa * (1 - f_residual_fa);
    const massBalanceError = Math.max(
      0,
      totalCum - (residualTrappingScaled + solubilityTrapping + mineralTrappingFA + mobilePlume),
    );
    const formationCapacityUtil = totalCum / Math.max(0.001, totalFormationCapacity) * 100;

    const capacityUtilPct = (totalCum / Math.max(0.001, totalCapacity)) * 100;
    const overpressureRisk = totalCum > capacityP90;

    const trappedFrac = totalCum > 0.001
      ? (residualTrappingScaled + solubilityTrapping + mineralTrappingFA) / totalCum
      : 0;
    void prevResult; // prevResult no longer needed for stateful trapping

    // Pressure field — simplified (no visualization overhead in forward model)
    const pressureField: Array<{ x: number; z: number; pressure: number }> = [];

    const result: SimulationResult = {
      storageCapacity: totalCum,
      totalCapacity,
      capacityP10,
      capacityP90,
      capacityUtilPct,
      overpressureRisk,
      plumeRadius,
      plumeHeight,
      injectionPressure: P_t,
      pressureField,
      co2Density: rhoCO2,
      brineDensity: rhoBrine,
      densityDiff: drho,
      co2Viscosity: visc,
      solubility,
      diffusion,
      solubilityTrapping,
      residualTrapping: residualTrappingScaled,
      mineralTrapping: mineralTrappingFA,
      mobilePlume,
      containmentProbability: Math.min(0.95, 0.5 + ntg * 0.3 + trappedFrac * 0.15),
      ift,
      adAssessment,
      p10: capacityP10,
      p50: totalCapacity,
      p90: capacityP90,
      storageEfficiency: 2.0,
      structuralCapacity,
      residualCapacity,
      dissolutionCapacity,
      mineralCapacity,
      totalFormationCapacity,
      formationCapacityUtil,
      massBalanceError,
    };

    results.push(result);
    prevResult = result;
  }

  return results;
}
