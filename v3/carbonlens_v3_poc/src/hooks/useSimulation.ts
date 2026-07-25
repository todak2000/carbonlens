import React from 'react'
import { useFormationStore } from '../store/formationStore'
import { useSimulationStore } from '../store/simulationStore'
import { useUIStore } from '../store/uiStore'
import { db } from '../db/projectDb'
import { useGeologicalStore } from '../store/geologicalStore'
import { createDefaultProject } from '../data/defaultProject'
import { geologicalModelToGrid } from '../utils/geologicalModelToGrid'
import { SimulationGrid } from '../engine/grid/SimulationGrid'
import { PlumeGrid } from '../engine/plume/PlumeGrid'
import { useHistoryMatchingStore } from '../store/historyMatchingStore'
import { DEFAULT_MATCHABLE_PARAMS } from '../engine/historyMatching/types'
import type { MatchableParams } from '../engine/historyMatching/types'

import type { SimulationResult, FormationParams, GeomechanicsResult } from '../types'
import type { MarsInput } from '../engine/mars/types'
import {
  co2DensitySpanWagner, co2DensityWithImpurities, brineDensityGarcia, co2ViscosityFenghour,
  co2SolubilityDuanSun, calculateMultiSaltSolubility, co2DiffusionCoefficient, determinePhase,
  computeTr, computePr, evaluateMars, scaleInput,
  subEquation, subScaler, supEquation, supScaler,
  assessApplicabilityDomain,
} from '../engine'
import type { MultiSaltBrine } from '../engine'
import { computeHessePostInjection } from '../engine/plume/hessePostInjection'
import type { HesseResult } from '../engine/plume/hessePostInjection'
import { cumulativeInjection, wellRateAtTime } from '../utils/gridParser'
import { computePressureField, expIntegralE1 } from '../utils/computePressureField'
import {
  computeWellboreDiagnostics,
  DEFAULT_WELLBORE,
} from '../engine/plume/wellboreModel'
import { computeHaliteRisk } from '../engine/classical/haliteRisk'
import { computeHeterogeneityCorrections } from '../engine/classical/heterogeneityCorrection'
import { computeDepletedFieldCapacity } from '../engine/classical/depletedFieldCapacity'
import { assessStorageScreening } from '../engine/classical/storageScreening'
import { classifyFormationRegime } from '../engine/classical/formationRegimeClassifier'
import type { FormationRegime } from '../engine/classical/formationRegimeClassifier'
import {
  VESolver, uniformPermField, wellToGridIndex,
  type VEFluidProps, type VEWellSource,
} from '../engine/ve'
import { solveFDPressure } from '../engine/ve/FDPressureSolver'
import { computePVTFieldStats } from '../engine/pvt/co2PVTTable'
import { computeThermalPropertyField } from '../engine/classical/thermalPropertyField'
import { buildTopDepthField } from '../engine/classical/structuralDepthMap'
import { buildFaultMultField } from '../engine/classical/faultTransmissibility'
import type { ThermalParams } from '../engine/plume/thermalEffects'
import { DEFAULT_THERMAL } from '../engine/plume/thermalEffects'

// VE grid dimensions — 60×60 matches MRST benchmark resolution (500 m/cell on 30 km domain)
// Increasing from the original 40×40 (750 m/cell) unlocks lateral plume spreading:
// at 40×40 a 1 Mt/yr injection never fills a 750 m cell enough to drive buoyancy flux
// to neighbours within 20 years, producing a constant single-cell footprint.
const VE_NX = 60
const VE_NY = 60

function tubingFrictionMPa(injRateMtPerYear: number, rhoCO2: number, mu: number, depth: number): number {
  if (injRateMtPerYear <= 0) return 0
  const D = 0.1016
  const A = Math.PI * D * D / 4
  const Q_m3s = (injRateMtPerYear * 1e9 / rhoCO2) / (365.25 * 24 * 3600)
  const v = Q_m3s / A
  const Re = rhoCO2 * v * D / Math.max(mu, 1e-6)
  const f = Re > 4000 ? 0.184 * Math.pow(Re, -0.2) : (Re > 0 ? 64 / Re : 0)
  const dP_Pa = f * (depth / D) * rhoCO2 * v * v / 2
  return dP_Pa / 1e6
}

export function computeYearly(
  params: FormationParams,
  year: number,
  projectYears: number,
  prevResultOverride?: SimulationResult | null,
): SimulationResult {
  const wells = useFormationStore.getState().wells

  const T_K = params.temperature + 273.15
  const effectiveTempC = (params.geothermalGradient != null && params.surfaceTemperatureC != null)
    ? params.surfaceTemperatureC + params.geothermalGradient * (params.depth + params.thickness / 2) / 100
    : params.temperature
  const T_K_eff = effectiveTempC + 273.15
  const temperatureAtTopC = (params.geothermalGradient != null && params.surfaceTemperatureC != null)
    ? params.surfaceTemperatureC + params.geothermalGradient * params.depth / 100
    : undefined
  const temperatureAtBaseC = (params.geothermalGradient != null && params.surfaceTemperatureC != null)
    ? params.surfaceTemperatureC + params.geothermalGradient * (params.depth + params.thickness) / 100
    : undefined
  const A = params.area * 1e6
  const h_m = params.thickness
  const phi = params.porosity
  const ntg = params.netToGross

  // ── Physics regime classification (Nordbotten & Celia 2006, Bachu 2003) ────
  // Run once per year (cheap: pure arithmetic). Uses assessStorageScreening so
  // both calls share the same injectivity index computation.
  // targetRate = sum of active well rates at this year.
  const targetRate_Mtyr = wells.reduce((s, w) => s + w.injectionRate, 0) || 1.0
  const _screening       = assessStorageScreening(params)
  const formationRegime: FormationRegime = classifyFormationRegime(
    params, targetRate_Mtyr, _screening,
  )

  // DOE Goodman 2011: Cc coefficients are derived from gross pore volume statistics
  // that implicitly capture NTG effects. Applying NTG explicitly double-counts it.
  const totalPoreVolume = A * h_m * phi

  // Fix 5: connate water saturation — use param override or default 0.15
  const SWI_CONNATE_PARAM = params.swiConnate ?? 0.15

  // CO2 density at initial reservoir conditions
  // Fix 3: clamp pressure to valid EOS range (0.5–80 MPa) before calling Span-Wagner
  // Fix 4: honour co2DensityOverride for benchmark / validation runs
  const P_init_clamped = Math.max(0.5e6, Math.min(80e6, params.pressure * 1e6))
  const rhoCO2_init_eos = co2DensityWithImpurities(T_K_eff, P_init_clamped, params.methaneFraction, params.nitrogenFraction)
  const rhoCO2_init = (params.co2DensityOverride != null && params.co2DensityOverride > 0)
    ? params.co2DensityOverride
    : (Number.isFinite(rhoCO2_init_eos) && rhoCO2_init_eos > 0 && rhoCO2_init_eos < 1100
        ? rhoCO2_init_eos
        : 700)   // fallback: typical supercritical CO2 at ~10 MPa, 37°C

  // ── Capacity method: route by formation type ───────────────────────────────
  // Depleted gas/oil fields: gas-replacement volumetric (Bachu et al. 2007).
  // Saline aquifers / default: DOE Goodman 2011 Cc=2% framework.
  let capacityP10: number
  let totalCapacity: number  // P50
  let capacityP90: number

  const isDepletedField =
    params.formationType === 'depleted_gas' || params.formationType === 'depleted_oil'

  if (isDepletedField && params.giip != null && params.abandonmentPressure != null) {
    const depleted = computeDepletedFieldCapacity(
      params.giip,
      T_K_eff,
      params.pressure,          // initial (pre-depletion) reservoir pressure
      params.abandonmentPressure,
    )
    capacityP90    = depleted.storageP90_Mt     // P90 (conservative / low)
    totalCapacity  = depleted.storageMt         // P50 (expected)
    capacityP10    = depleted.storageP10_Mt     // P10 (optimistic / high)
  } else {
    // DOE capacity coefficient framework (Goodman et al. 2011)
    const Cc_P90 = 0.0051  // 90% exceedance probability (Conservative / Low estimate)
    const Cc_P50 = 0.0200  // 50% exceedance probability (Expected estimate)
    const Cc_P10 = 0.0550  // 10% exceedance probability (Optimistic / High estimate)
    capacityP90   = totalPoreVolume * Cc_P90 * rhoCO2_init / 1e9
    totalCapacity = totalPoreVolume * Cc_P50 * rhoCO2_init / 1e9
    capacityP10   = totalPoreVolume * Cc_P10 * rhoCO2_init / 1e9
  }

  // ── Position-dependent storage ─────────────────────────────────────────────
  let totalCum = 0
  for (let i = 0; i < wells.length; i++) {
    const w = wells[i]
    totalCum += cumulativeInjection(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears)
  }

  const storageAtYear = totalCum

  // ── Pressure model: Nordbotten (2005) two-phase composite radial flow ────────
  // Far-field pressure propagates through undisturbed brine at α_brine — using CO₂
  // viscosity here (as the old single-phase Theis did) overestimates α by ~12× and
  // underestimates the wellbore ΔP.  Near-wellbore CO₂ plume zone adds a mobility-
  // contrast correction per Nordbotten, Celia & Bachu (2005) eq. 8.
  // Reference: Transp. Porous Media 58(3):339–360. DOI: 10.1007/s11242-004-0670-9
  const currentRate = wells.reduce((s, w) => s + wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears), 0)
  // Fix 3+4: EOS guard and density override applied to the mobile-phase density used for pressure calc
  const rhoCO2_mobile_eos = co2DensityWithImpurities(T_K_eff, P_init_clamped, params.methaneFraction, params.nitrogenFraction)
  const rhoCO2_mobile = (params.co2DensityOverride != null && params.co2DensityOverride > 0)
    ? params.co2DensityOverride
    : (Number.isFinite(rhoCO2_mobile_eos) && rhoCO2_mobile_eos > 0 && rhoCO2_mobile_eos < 1100
        ? rhoCO2_mobile_eos
        : 700)
  const visc = co2ViscosityFenghour(T_K_eff, rhoCO2_mobile)

  const perm_m2 = params.permeability * 9.869e-16
  const ct = 1e-9
  const t_sec = year * 365.25 * 24 * 3600
  // Vogel-Antoine temperature-dependent brine viscosity (valid 20-200 °C)
  // Calibrated to IAPWS data: ~1.0 mPa·s at 20°C, 0.47 mPa·s at 60°C, 0.28 mPa·s at 100°C
  // clamped to [0.15, 1.5] mPa·s to avoid extrapolation artifacts
  const muBrine_Pas = Math.max(1.5e-4, Math.min(1.5e-3, 2.414e-5 * Math.pow(10, 247.8 / (T_K_eff - 140))))
  const alpha_b = perm_m2 / (phi * muBrine_Pas * ct)  // brine hydraulic diffusivity (far-field carrier)
  const kr_CO2 = 0.3                                  // average CO₂ relative permeability in plume
  const mu_eff = visc / Math.max(0.01, kr_CO2)        // effective CO₂-zone viscosity (Pa·s)
  const modelScale = Math.sqrt(params.area * 1e6) / 3
  const rw_m = 0.1

  // Previous plume radius for Nordbotten inner-zone correction (1-year lag acceptable for screening)
  const prevPlumeRadius = (prevResultOverride !== undefined
    ? prevResultOverride
    : useSimulationStore.getState().result)?.plumeRadius ?? 0

  // Superpose Nordbotten composite pressures at each well location
  let dP_max = 0
  for (const wi of wells) {
    const qwi = wellRateAtTime(wi.injectionRate, year, wi.rampUpYears, wi.rampDownYears, projectYears)
    if (qwi <= 0) continue
    const Qi = qwi * 1e9 / (rhoCO2_mobile * 365.25 * 24 * 3600)

    // Far-field brine Theis at the wellbore radius
    const u_rw_b = rw_m * rw_m / (4 * alpha_b * Math.max(t_sec, 1))
    let dP_i = (Qi * muBrine_Pas) / (4 * Math.PI * perm_m2 * h_m) * expIntegralE1(u_rw_b) / 1e6

    // Near-field mobility-contrast correction when inside the CO₂ plume (Nordbotten eq. 8)
    if (prevPlumeRadius > rw_m) {
      const u_pl = prevPlumeRadius * prevPlumeRadius / (4 * alpha_b * Math.max(t_sec, 1))
      dP_i += (Qi * (mu_eff - muBrine_Pas)) / (4 * Math.PI * perm_m2 * h_m) * expIntegralE1(u_pl) / 1e6
    }

    // Inter-well superposition — neighbor plume zones are separate so brine far-field only
    for (const wj of wells) {
      if (wj.id === wi.id) continue
      const qwj = wellRateAtTime(wj.injectionRate, year, wj.rampUpYears, wj.rampDownYears, projectYears)
      if (qwj <= 0) continue
      const Qj = qwj * 1e9 / (rhoCO2_mobile * 365.25 * 24 * 3600)
      const dist = Math.sqrt((wi.x - wj.x) ** 2 + (wi.z - wj.z) ** 2) * modelScale
      const r_eff = Math.max(dist, rw_m)
      const u_j = r_eff * r_eff / (4 * alpha_b * Math.max(t_sec, 1))
      dP_i += (Qj * muBrine_Pas) / (4 * Math.PI * perm_m2 * h_m) * expIntegralE1(u_j) / 1e6
    }

    dP_max = Math.max(dP_max, dP_i)
  }
  const dP_capped = Math.max(0, Math.min(25, dP_max))
  const P_t = params.pressure + dP_capped

  // Recompute fluid properties at the injection pressure
  // Fix 3: clamp injection pressure before EOS call to prevent spurious high-density values
  const P_t_safe = Number.isFinite(P_t) ? P_t : params.pressure
  const P_Pa = Math.max(0.5e6, Math.min(80e6, P_t_safe * 1e6))
  // Fix 4: honour density override; otherwise use EOS with finite-value guard
  const rhoCO2_eos = co2DensityWithImpurities(T_K_eff, P_Pa, params.methaneFraction, params.nitrogenFraction)
  const rhoCO2 = (params.co2DensityOverride != null && params.co2DensityOverride > 0)
    ? params.co2DensityOverride
    : (Number.isFinite(rhoCO2_eos) && rhoCO2_eos > 0 && rhoCO2_eos < 1100
        ? rhoCO2_eos
        : 700)
  const rhoBrine = brineDensityGarcia(T_K_eff, P_t_safe, params.monovalentSalinity, params.bivalentSalinity)
  const drho = rhoBrine - rhoCO2
  const drho_sq = drho * drho / 1e6

  const phase = determinePhase(T_K_eff, P_t_safe, params.methaneFraction, params.nitrogenFraction)
  const Pr = computePr(P_t_safe, params.methaneFraction, params.nitrogenFraction)
  const Tr = computeTr(T_K_eff, params.methaneFraction, params.nitrogenFraction)

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
  }

  let ift: number | null = null
  if (phase === 'subcritical') {
    ift = evaluateMars(scaleInput(input, subScaler), subEquation)
  } else {
    ift = evaluateMars(scaleInput(input, supScaler), supEquation)
  }

  const adAssessment = assessApplicabilityDomain(input, phase)

  // visc is always freshly computed in Pa·s — never read from the store
  // (the store holds mPa·s for display; reading it back without conversion would corrupt pressure calculations)
  const visc_final = visc  // Pa·s — used for pressure field computation below

  // Solubility: route to Duan et al. (2006) multi-salt model for CaCl2/Mixed brines.
  // NaCl-only brines use the existing Duan-Sun (2003) model unchanged.
  // Conversion: calculateMultiSaltSolubility returns mole fraction → mol/kg via n_water = 55.508 mol/kg.
  let solubility: number
  if (params.saltType !== 'NaCl' && params.bivalentSalinity > 0) {
    const brine: MultiSaltBrine = params.saltType === 'CaCl2'
      ? { m_NaCl: params.monovalentSalinity, m_KCl: 0, m_CaCl2: params.bivalentSalinity, m_MgCl2: 0 }
      : { m_NaCl: params.monovalentSalinity, m_KCl: 0, m_CaCl2: params.bivalentSalinity * 0.6, m_MgCl2: params.bivalentSalinity * 0.4 }
    const xCO2 = calculateMultiSaltSolubility(T_K_eff, P_t_safe, brine)
    solubility = xCO2 * 55.508 / Math.max(1e-9, 1 - xCO2)  // mole fraction → mol/kg
  } else {
    solubility = co2SolubilityDuanSun(T_K_eff, P_t_safe, params.monovalentSalinity, params.bivalentSalinity)
  }
  const diffusion = co2DiffusionCoefficient(T_K_eff, P_t_safe, params.porosity)

  // Gravity current radius: injected volume fills a thin layer under the seal
  // r = sqrt(2·V / (π·φ·h_eff)) where h_eff ≈ 10% of formation thickness
  // Calibrated against Sleipner field data (Boait 2012): 650m at year 4, 1150m at year 12
  const cumVolM3 = totalCum * 1e9 / rhoCO2
  const hEff = h_m * 0.10
  let plumeRadius = Math.sqrt(2 * cumVolM3 / (Math.PI * phi * Math.max(1, hEff)))
  const plumeHeight = h_m * 0.55 * Math.min(1, Math.sqrt(totalCum / Math.max(0.001, totalCapacity)))

  // ── Physics-based independent trapping capacities ────────────────────────
  // Each mechanism capacity is derived solely from formation properties and
  // plume geometry — none is computed as a residual of the others.
  // The injection scenario (totalCum) is then compared against each capacity.
  // Reference framework: Bachu et al. (2007), IEAGHG storage capacity estimation.

  // Geometry-dependent structural closure factors.
  // trapFrac  = fraction of formation area enclosed by the structural trap.
  // closureFrac = fraction of formation thickness representing the closure height.
  const GEOMETRY_CLOSURE: Record<string, { trapFrac: number; closureFrac: number }> = {
    anticline:     { trapFrac: 0.80, closureFrac: 0.25 },
    dome:          { trapFrac: 0.90, closureFrac: 0.30 },
    fault:         { trapFrac: 0.70, closureFrac: 0.20 },
    layered:       { trapFrac: 0.55, closureFrac: 0.15 },
    stratigraphic: { trapFrac: 0.65, closureFrac: 0.18 },
    channel:       { trapFrac: 0.50, closureFrac: 0.12 },
    gridfile:      { trapFrac: 0.70, closureFrac: 0.20 },
  }

  // Fix 5: use param-driven Swi (set above from params.swiConnate ?? 0.15)
  const SWI_CONNATE = SWI_CONNATE_PARAM
  const C_LAND      = 2.5    // Land trapping coefficient, sandstone (Land 1968, SPE-1323-PA)

  // Land (1968) residual saturation from NTG-corrected pore volume
  // S_gi = NTG × (1 − Swi): max CO₂ saturation during primary drainage
  // S_gr = S_gi / (1 + C × S_gi): residual saturation on imbibition
  const S_gi = ntg * (1 - SWI_CONNATE)
  const S_gr = S_gi / (1 + C_LAND * S_gi)

  // ── Hesse (2008) post-injection gravity current ───────────────────────────────
  // When all wells have shut in, replace the injection-phase plume radius with
  // the analytically correct leading-front position from Hesse et al. (2008).
  // This gives permit-grade plume footprint and residual trapping fractions
  // for the post-injection monitoring period.
  let hesseResult: HesseResult | undefined
  const isPostInj = wells.length > 0 && wells.every(
    w => wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears) === 0
  )
  if (isPostInj) {
    // t_inj_end: last year with positive injection (start of ramp-down for latest well)
    const t_inj_end = Math.max(...wells.map(w => Math.max(0, projectYears - w.rampDownYears)))
    const t_post_yr = Math.max(0, year - t_inj_end)
    const t_inj_yr = Math.max(1, t_inj_end)
    if (t_post_yr > 0) {
      // Plume radius at moment of shut-in — recompute from cumulative injection at t_inj_end
      let cumAtInjEnd = 0
      for (const w of wells) {
        cumAtInjEnd += cumulativeInjection(w.injectionRate, t_inj_end, w.rampUpYears, w.rampDownYears, projectYears)
      }
      const cumVolAtInjEnd = cumAtInjEnd * 1e9 / Math.max(1, rhoCO2_init)
      const r_inj_m = Math.sqrt(2 * cumVolAtInjEnd / (Math.PI * phi * Math.max(1, hEff)))
      if (r_inj_m > 0) {
        hesseResult = computeHessePostInjection({
          r_inj_m,
          t_inj_yr,
          t_post_yr,
          S_r: S_gr,
          mu_co2_Pa_s: visc,
          mu_brine_Pa_s: muBrine_Pas,
        })
        // Override plumeRadius: Hesse leading front is the physically correct footprint
        plumeRadius = hesseResult.r_leading_m
      }
    }
  }

  // 1. STRUCTURAL CAPACITY — buoyant free-phase CO₂ held beneath the caprock seal.
  //    V_struct = A × trapFrac × (h × closureFrac) × NTG × φ × (1 − Swi − Sgr)
  //    Independent of injection; set entirely by trap geometry and rock properties.
  const gf = GEOMETRY_CLOSURE[params.geometryType] ?? { trapFrac: 0.70, closureFrac: 0.20 }
  const V_structural_m3 = A * gf.trapFrac * (h_m * gf.closureFrac) * ntg * phi * Math.max(0, 1 - SWI_CONNATE - S_gr)
  const structuralCapacity = Math.max(0, V_structural_m3 * rhoCO2 / 1e9)

  // 2. RESIDUAL CAPACITY — Land snap-off in the pore volume swept by the CO₂ plume.
  //    Computed from formation pore volume × volumetric sweep efficiency (E_sweep).
  //    The naive formula V_swept = π×r²×h_eff×NTG×φ with r=sqrt(2V_CO₂/(π×φ×h_eff))
  //    algebraically collapses to 2×V_CO₂×NTG, making φ and thickness cancel — all
  //    same-NTG formations get identical residual regardless of porosity or permeability.
  //    This PVI-based approach preserves formation-specific dependence on φ, k, A, h.
  //    Reference: sweep efficiency proxy after Craig (1971) / Dykstra-Parsons (1950).
  const V_pore_formation_m3 = A * h_m * ntg * phi  // total reservoir pore volume (m³)
  const PVI = cumVolM3 / Math.max(1e3, V_pore_formation_m3)  // pore volumes injected (dimensionless)
  // Formation Quality Index: √(k×φ) normalised to moderate-sandstone reference (200 mD, φ=0.20)
  // Higher k and φ → more efficient drainage → better residual trapping per unit pore volume
  const FQI = Math.min(2.0, Math.max(0.15, Math.sqrt(params.permeability * phi / (200 * 0.20))))
  // Volumetric sweep efficiency: grows with PVI×FQI, bounded by structural trap fraction
  const E_sweep = Math.min(gf.trapFrac, (1 - Math.exp(-3 * PVI * FQI)) * gf.trapFrac)
  const V_swept_m3 = V_pore_formation_m3 * E_sweep
  const residualCapacity = Math.max(0, V_swept_m3 * S_gr * rhoCO2 / 1e9)

  // 3. DISSOLUTION CAPACITY — Fick kinetic limit (Ennis-King & Paterson 2005) bounded above
  //    by plume brine volume × solubility (Duan-Sun 2003 steady-state limit).
  //    Brine volume reference: the active PLUME PORE VOLUME (π × r² × h_plume × φ × NTG),
  //    not the PVI-swept formation volume — only brine inside the plume envelope contacts CO₂.
  //    Reference: Ennis-King & Paterson (2005), Int. J. Greenhouse Gas Control 1(1):86-93.
  const X_sat = solubility * 0.044                                  // mol/kg → kg CO₂/kg brine
  const A_contact = Math.PI * plumeRadius * plumeRadius             // plume–brine interfacial area (m²)
  const t_sec_diss = Math.max(1, year) * 365.25 * 24 * 3600
  // Rayleigh number: Ra = Δρ × g × k × h / (μ_brine × D_mol × φ)
  const delta_rho_dissolved = 2.0
  const Ra = delta_rho_dissolved * 9.81 * perm_m2 * h_m / (muBrine_Pas * diffusion * phi)
  const Ra_crit = 40
  const convective_factor = Math.max(1, Math.min(20, Math.sqrt(Math.max(0, Ra / Ra_crit))))
  const D_eff_conv = diffusion * convective_factor

  // Plume pore volume = π × r_plume² × h_plume × φ × NTG — the active contact zone.
  // Gas saturation in plume: S_g = V_CO₂_res / V_p_plume (capped at 1 − Swi).
  // Brine saturation in plume: S_w = 1 − S_g (brine displaced by injected CO₂).
  const V_p_plume = Math.max(1, Math.PI * plumeRadius * plumeRadius * plumeHeight * phi * ntg)
  const S_g_plume = Math.min(1 - SWI_CONNATE, cumVolM3 / V_p_plume)
  const V_brine_m3 = V_p_plume * (1 - S_g_plume)                   // brine pore volume in plume (m³)

  // Kinetic (Fick) limit — dominates at early time when brine is unsaturated.
  const dissolutionFick  = 2 * A_contact * rhoBrine * X_sat * Math.sqrt(D_eff_conv * t_sec_diss) / 1e9
  // Temporal convective enhancement (Neufeld et al. 2010, GRL 37:L22404; Backhaus et al. 2011, PRL 106:104501).
  // Convection onset: t_onset ≈ 50/√k_mD years — empirical fit to Slim & Ramakrishnan (2010) Phys. Fluids.
  // After onset, density-driven fingers accelerate dissolution up to 3× the diffusion-only rate.
  const t_onset_yr = Math.max(2, 50 / Math.sqrt(params.permeability))
  const t_yr_diss  = Math.max(1, year)
  const f_conv_diss = t_yr_diss <= t_onset_yr
    ? 1.0
    : Math.min(3.0, 1.0 + 2.0 * (t_yr_diss / t_onset_yr - 1) * Math.sqrt(params.permeability / 100))
  // Brine-volume limit — convective-enhanced steady-state ceiling (Duan-Sun).
  // Hard cap at 35% of totalCum: upper bound from long-run dissolution modelling
  // (Audigane et al. 2007, Water Resour. Res. 43:W03414 — 15–25% at 50–100 yr; screened).
  const dissolutionUpper = Math.min(
    V_brine_m3 * rhoBrine * X_sat / 1e9 * f_conv_diss,
    0.35 * Math.max(0.001, totalCum),
  )
  const dissolutionCapacity = Math.max(0, Math.min(dissolutionFick, dissolutionUpper))

  // 4. MINERAL CAPACITY — formation-class-specific TST kinetics (Lasaga 1984 JGR; Palandri & Kharaka 2004 USGS OFR).
  //    Active only when projectYears ≥ 30: sub-30-yr simulations treat mineral = 0 (conservative & defensible).
  //    Benson & Cole (2008, Science) establish mineral trapping negligible at Year 20; non-negligible at Year 50.
  //
  //    Carbonate (calcite/dolomite): f_reactive=5%, A_spec=0.5 m²/kg, k_m(110°C)=1.55×10⁻⁶ mol/m²/s, τ=15 yr.
  //      — Arab Formation (Abu Dhabi), Krechba limestone (In Salah), Sarawak carbonate (Kasawari).
  //      — Xu et al. (2004) Appl. Geochem. 19:917; Gaus et al. (2005) J. Geochem. Explor. 78:117.
  //    Sandstone (feldspar dissolution → dawsonite/calcite): f_reactive=1%, A_spec=0.1 m²/kg, k_m=1×10⁻⁹, τ=25 yr.
  //      — Utsira (Sleipner), Basal Cambrian (Alberta), Mt. Simon, Niger Delta clastic.
  //      — Zerai et al. (2006) Appl. Geochem. 21:223; Johnson et al. (2004) Energy 29:1437.
  //
  //    Rate = A_reactive × k_m(T)   [mol/s],   k_m(T) = k_m_ref × exp(−Ea/R × (1/T − 1/T_ref))
  //    f_decay = 1 − exp(−t/τ): surface passivation slowdown (Gaus et al. 2005 §4.3).
  //    Screening cap (Benson & Cole 2008): 15% of injected for carbonate, 10% for sandstone.
  const isCarbonate   = params.lithologyClass === 'carbonate'
  const RMAT          = isCarbonate ? 2710    : 2650    // kg/m³ matrix density
  const F_REACTIVE    = isCarbonate ? 0.05    : 0.01    // reactive mineral fraction
  const A_SPEC        = isCarbonate ? 0.5     : 0.1     // specific surface area (m²/kg)
  const KM_REF        = isCarbonate ? 1.55e-6 : 1e-9   // mol/m²/s at T_ref=110°C (Palandri & Kharaka 2004)
  const TAU_YR        = isCarbonate ? 15      : 25      // surface passivation timescale (yr)
  const CAP_FRAC      = isCarbonate ? 0.15    : 0.10    // Benson & Cole (2008) screening cap
  const T_REF_MIN_K   = 383.15                          // reference T = 110 °C
  const EA_J_MOL      = 62800                           // activation energy J/mol (calcite)
  const R_GAS         = 8.314
  const V_bulk_plume  = Math.PI * plumeRadius * plumeRadius * plumeHeight
  const M_rock_kg     = V_bulk_plume * (1 - phi) * RMAT
  const A_reactive    = M_rock_kg * F_REACTIVE * A_SPEC
  const k_m_T         = KM_REF * Math.exp(-EA_J_MOL / R_GAS * (1 / T_K_eff - 1 / T_REF_MIN_K))
  const f_decay       = 1 - Math.exp(-Math.max(1, year) / TAU_YR)
  // Capacity = 100-yr integrated rate × decay; zero for projectYears < 30
  const mineralCapacity = projectYears < 30 ? 0 : Math.max(0,
    A_reactive * k_m_T * (100 * 365.25 * 24 * 3600) * 44.01e-12 * f_decay,
  )

  // 5. TOTAL FORMATION STORAGE CAPACITY — sum of all independent mechanisms.
  //    This is the true physical capacity of the formation, independent of injection scenario.
  const totalFormationCapacity = structuralCapacity + residualCapacity + dissolutionCapacity + mineralCapacity
  const formationCapacityUtil = totalCum / Math.max(0.001, totalFormationCapacity) * 100

  // 6. ACTUAL TRAPPING — each mechanism solved independently (Pentland et al. 2011 ordering).
  //
  //    DISSOLUTION (composition pathway) is decoupled from the displacement/hysteresis pathway:
  //    CO₂ that dissolves into brine reduces the gas-phase volume via a thermodynamic route,
  //    NOT via imbibition front displacement. Land snap-off only operates on the residual
  //    free-phase gas.
  //
  //    RESIDUAL and MOBILE split via Land (1968) trapping efficiency f_res = S_gr / S_gi:
  //    — f_res is the fraction of the drained gas phase that snap-off traps on imbibition.
  //    — (1 − f_res) is the mobile fraction where k_rg > 0 (gas above S_gr threshold).
  //    This is derived directly from the relative permeability hysteresis loop, NOT from
  //    a remainder identity.  SPE-1323-PA, Eqs. 3–5 (Land 1968).
  //
  //    CLOSURE ERROR ε is reported explicitly rather than suppressed:
  //    ε > 0 when residualCapacity (formation's swept-zone snap-off capacity) cannot hold
  //    all the gas that Land dynamics would residually trap (capacity-limited formations).
  //    Acceptable: |ε|/totalCum < 5 % for a calibrated screening model (Nordbotten & Celia 2006).

  // a. Dissolution: thermodynamic equilibrium — independent of relative permeability loop.
  const solubilityTrapping = Math.min(dissolutionCapacity, totalCum)

  // b. Mineral: TST kinetic precipitation — time-integrated, surface-passivation-corrected, capped.
  //    f_decay accounts for surface coating slowing kinetics over decades (Gaus et al. 2005).
  //    CAP_FRAC × totalCum is the Benson & Cole (2008) screening cap.
  //    Zero for projectYears < 30 (consistent with mineralCapacity gate above).
  const mineralTrapping = projectYears < 30 ? 0 : Math.min(
    CAP_FRAC * Math.max(0.001, totalCum),
    Math.max(0, A_reactive * k_m_T * t_sec_diss * 44.01e-12 * f_decay),
  )

  // c. Free-phase CO₂ after composition-pathway removal (dissolution + mineral).
  const freePhaseCO2_Mt = Math.max(0, totalCum - solubilityTrapping - mineralTrapping)

  // d. Land (1968) trapping efficiency: fraction of free-phase gas that snap-off immobilises.
  //    f_res = S_gr / S_gi  — derived solely from relative permeability hysteresis.
  //    At S_gi = NTG × (1 − Swi): maximum drainage saturation reached in the formation.
  //    At S_gr = S_gi / (1 + C × S_gi): residual saturation after imbibition (C = 2.5).
  //    Mobile fraction (1 − f_res) is the complement where k_rg > 0 persists.
  const f_residual_land = S_gi > 0.001 ? S_gr / S_gi : 0

  // e. Residual: Land snap-off fraction of the free-phase gas within the plume envelope.
  //    Computed directly from the plume volume (not capped by PVI-swept residualCapacity).
  //    residualCapacity (from PVI×FQI) is reported as a separate formation-capacity metric;
  //    actual trapping uses the plume pore volume × Land efficiency (consistent with reviewer's
  //    Xu et al. 2004 / Pentland et al. 2011 approach where the plume IS the reference volume).
  const residualTrapping = freePhaseCO2_Mt * f_residual_land

  // f. Mobile: free-phase gas above S_gr (k_rg > 0) — independently from Land complement.
  //    NOT computed as (totalCum − residual − dissolved); derived from relative permeability.
  const mobilePlume = freePhaseCO2_Mt * (1 - f_residual_land)

  // g. Closure error ε: formation snap-off capacity deficit.
  //    ε > 0 when residualCapacity < freePhaseCO2 × f_res (capacity-limited).
  //    Physically: CO₂ that Land dynamics would trap cannot be held in the current swept zone.
  const massBalanceError = Math.max(
    0,
    totalCum - (residualTrapping + solubilityTrapping + mobilePlume + mineralTrapping),
  )

  const capacityUtilPct = (totalCum / Math.max(0.001, totalCapacity)) * 100
  const overpressureRisk = totalCum > capacityP90

  const trappedFrac = storageAtYear > 0.001 ? (residualTrapping + solubilityTrapping) / storageAtYear : 0

  // ── Pressure field for 3D visualization ───────────────────────────────────
  const pressureField = computePressureField(params, wells, year, projectYears, rhoCO2_mobile, visc_final)

  // ── Peaceman wellbore BHP (skin-aware near-wellbore pressure) ──────────────
  // Fix 2: cell width now derived from the actual VE grid (VE_NX × VE_NY) so Peaceman's
  // equivalent radius r_eq = 0.1982 · dx reflects the true grid block size rather than
  // the old hardcoded 20×20 assumption which over-estimated cell size by 50% at 60×60.
  // Peaceman (1978) equivalent radius: r_eq = 0.1982 · dx.
  const cellWidth_m = Math.sqrt(params.area * 1e6) / VE_NX
  let peacemanBHP = P_t_safe   // default to Nordbotten-based pressure if no active wells
  let injectivityIndex = 0
  if (currentRate > 0 && wells.length > 0) {
    // Use average rate per well for each Peaceman computation; take the
    // worst-case (highest) BHP across all active wells.
    let maxBHP = 0
    let lastJ  = 0
    for (const w of wells) {
      const wRate = wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears)
      if (wRate <= 0) continue
      const diag = computeWellboreDiagnostics(
        DEFAULT_WELLBORE,
        params.permeability,
        cellWidth_m,
        visc_final,           // Pa·s
        P_t_safe,             // current reservoir pressure including Nordbotten buildup (MPa)
        wRate,                // Mt/yr for this well
        rhoCO2_mobile,        // kg/m³
        params.depth,
      )
      if (diag.bhp_MPa > maxBHP) {
        maxBHP = diag.bhp_MPa
        lastJ  = diag.injectivityIndex_m3dMPa
      }
    }
    if (maxBHP > 0) {
      peacemanBHP     = maxBHP
      injectivityIndex = lastJ
    }
  }

  // ── Halite precipitation risk (Zeidouni 2009 dryout-radius model) ──────────
  // Computed once using peak well rate and full project duration.
  // Only meaningful when wells are active.
  const maxWellRate = wells.reduce((m, w) => Math.max(m, w.injectionRate), 0)
  const haliteRisk = maxWellRate > 0
    ? computeHaliteRisk(
        maxWellRate,
        h_m,
        phi,
        SWI_CONNATE,                        // Fix 5: use param-driven Swi
        params.monovalentSalinity,
        params.bivalentSalinity,
        rhoCO2_mobile,
        rhoBrine,
        params.temperature,
        projectYears,
      )
    : undefined

  // ── In-situ PVT field statistics ─────────────────────────────────────────────
  // Use the spatial pressure field (already computed) to derive per-point CO2
  // density via the Span-Wagner lookup table. Reports min/max/mean density and
  // flags any subcritical (gas-phase) zones.
  const pvtGeothermalConfig = (params.geothermalGradient != null && params.surfaceTemperatureC != null)
    ? { gradient_per100m: params.geothermalGradient, surfaceT_C: params.surfaceTemperatureC, topDepthM: params.depth, thicknessM: params.thickness }
    : undefined
  const pvtStats = computePVTFieldStats(pressureField, effectiveTempC, rhoCO2, pvtGeothermalConfig)

  // ── Tubing friction (Darcy-Weisbach) ─────────────────────────────────────────
  const totalRateMtPerYear = wells.reduce((sum, w) => sum + w.injectionRate, 0)
  const tubingFrictionDrop_MPa = tubingFrictionMPa(totalRateMtPerYear, rhoCO2, visc_final, params.depth)

  // ── Hydrostatic wellbore BHP ──────────────────────────────────────────────────
  // Surface-to-reservoir pressure: WHP + hydrostatic column of CO2 in the tubing.
  // Complements peacemanBHP (reservoir-side Darcy pressure drawdown) with a
  // surface-facility perspective: "given a wellhead injection pressure, what arrives
  // at the perforations?"
  // WHP: use the same wellbore default as wellboreModel.ts to ensure consistency.
  const WHP_MPA = DEFAULT_WELLBORE.surfacePressure_MPa
  const hydrostaticBHP_MPa = WHP_MPA + (rhoCO2 * 9.81 * params.depth) / 1e6
  // Hubbert-Willis (1957) fracture pressure: sigma_h = K0 * (Sv - Pp) + Pp
  // Same formula as computeGeomechanicsResult — ensures BHP margin is referenced
  // against the same governing fracture limit shown in Section 6 of the report.
  const nu_hw = params.poissonRatio ?? 0.30
  const K0_hw = nu_hw / (1 - nu_hw)
  const Sv_hw = (params.overburdenGradient ?? 0.023) * params.depth
  const fracPressure_MPa = K0_hw * (Sv_hw - params.pressure) + params.pressure
  // Safety margin: fracture pressure minus the Peaceman BHP (Darcy sandface pressure).
  // peacemanBHP is the operating wellbore pressure at the perforations derived from
  // Darcy radial flow — the physically correct reference for fracture risk assessment.
  // hydrostaticBHP uses the design-max WHP (DEFAULT_WELLBORE) and is a ceiling scenario
  // displayed separately in the report for hydraulic design context only.
  const bhpMargin_MPa = fracPressure_MPa - peacemanBHP

  const k_Vdp = params.k_Vdp ?? 0
  const heterogeneityCorrected = k_Vdp > 0.05
  let sweepEfficiency: number | undefined
  let aorHeterogeneityFactor: number | undefined
  let heterogeneityCitation: string | undefined
  let finalStorageCapacity = storageAtYear
  let finalTotalCapacity = totalCapacity
  let finalCapacityP10 = capacityP10
  let finalCapacityP90 = capacityP90

  if (heterogeneityCorrected) {
    const mobilityRatio = 3.0
    const pvi = 1.0
    const n_layers = params.n_layers ?? 1
    const k_layer_ratio = params.k_layer_ratio ?? 1
    const hetResult = computeHeterogeneityCorrections(
      k_Vdp,
      mobilityRatio,
      ntg,
      n_layers,
      k_layer_ratio,
      pvi,
      phi,
    )
    sweepEfficiency = hetResult.sweepEfficiency
    aorHeterogeneityFactor = hetResult.aorHeterogeneityFactor
    heterogeneityCitation = 'Shook & Mitchell (2009), Kopp et al. (2010)'
    finalStorageCapacity = storageAtYear * hetResult.sweepEfficiency
    finalTotalCapacity = totalCapacity * hetResult.sweepEfficiency
    finalCapacityP10 = capacityP10 * hetResult.sweepEfficiency
    finalCapacityP90 = capacityP90 * hetResult.sweepEfficiency
  }

  return {
    storageCapacity: finalStorageCapacity,
    totalCapacity: finalTotalCapacity,
    capacityP10: finalCapacityP10,
    capacityP90: finalCapacityP90,
    capacityUtilPct,
    overpressureRisk,
    plumeRadius: aorHeterogeneityFactor != null ? plumeRadius * aorHeterogeneityFactor : plumeRadius,
    plumeHeight,
    injectionPressure: P_t_safe,
    pressureField,
    co2Density: rhoCO2,
    brineDensity: rhoBrine,
    densityDiff: drho,
    co2Viscosity: visc_final * 1000,  // Pa·s → mPa·s for display
    solubility,
    diffusion,
    solubilityTrapping,
    residualTrapping,
    mineralTrapping,
    mobilePlume,
    containmentProbability: Math.min(0.95, 0.5 + ntg * 0.3 + trappedFrac * 0.15),
    ift,
    adAssessment,
    p10: finalCapacityP10,
    p50: finalTotalCapacity,
    p90: finalCapacityP90,
    storageEfficiency: isDepletedField ? 85.0 : 2.0,  // depleted: 85% fill factor (gas-replacement P50); aquifer: DOE Goodman Cc_P50=2%
    peacemanBHP,
    injectivityIndex,
    haliteRisk,
    structuralCapacity,
    residualCapacity,
    dissolutionCapacity,
    mineralCapacity,
    totalFormationCapacity,
    formationCapacityUtil,
    massBalanceError,
    hessePostInjection: hesseResult,
    heterogeneityCorrected,
    heterogeneityCitation,
    sweepEfficiency,
    aorHeterogeneityFactor,
    formationRegime,
    pvtStats,
    hydrostaticBHP_MPa,
    bhpMargin_MPa,
    temperatureAtTopC,
    temperatureAtBaseC,
    tubingFrictionDrop_MPa,
  }
}

interface AnimationState {
  raf: number
  startTime: number
  prevYear: number
  resumeYear: number
  peakResult: SimulationResult | null
  plumeGrid: PlumeGrid | null
  colorUpdateFn: (() => void) | null
  veSolver: VESolver | null
  /** Pure-analytical trapping chain — never overridden by PlumeGrid.
   *  Tracked year-by-year so computeYearly always uses the previous frame's
   *  analytical mobilePlume as its prev-state, keeping the stateful trapping
   *  accumulation free of PlumeGrid boundary-loss contamination.
   *  Used exclusively for the export snapshot mass-balance fields. */
  analyticalResult: SimulationResult | null
  /**
   * Implicit FD pressure solver state.
   * fdPrev: pressure field (Pa) at the end of the last completed year.
   *   Initialised to uniform initial pressure; updated each animation year.
   *   Passed as P_prev_Pa to solveFDPressure(), enabling transient buildup.
   * fdPermField_mD: permeability field in mD (same as VE solver).
   *   Stored once per run to avoid reallocating Float32Array every frame.
   */
  fdPrev: Float32Array | null
  fdPermField_mD: Float32Array | null
}

function makeAnimState(): AnimationState {
  return { raf: 0, startTime: 0, prevYear: -1, resumeYear: 0, peakResult: null, plumeGrid: null, colorUpdateFn: null, veSolver: null, analyticalResult: null, fdPrev: null, fdPermField_mD: null }
}

// VE_NX / VE_NY are declared above computeYearly so both the analytical function
// and the animation loop share the same grid constant.

export interface CheckResult {
  ok: boolean
  value: number
  threshold: number
  message: string
  fix: string
}

export interface GeomechValidation {
  valid: boolean
  estimatedPInj: number
  checks: {
    caprock: CheckResult
    safetyFactor: CheckResult
    mohr: CheckResult
    maip: CheckResult
  }
}

export function validateGeomechanics(params: FormationParams, wells: { injectionRate: number; rampUpYears: number; rampDownYears: number }[]): GeomechValidation {
  const POISSON = 0.30
  const OG = 0.023
  const K0 = 0.82

  const depth = params.depth
  const pp = params.pressure
  const sv = depth * OG
  const sh = sv * K0
  const phiRad = params.caprockFriction * Math.PI / 180
  const fracPresRaw = ((sv - pp) * POISSON / (1 - POISSON) + pp) * (1 + Math.tan(phiRad) * 0.15) * Math.max(0.85, 1 - (params.biotCoefficient - 0.4) * 0.12)
  // Fracture pressure must be ≥ σh (min. principal stress). H-W formula can fall below σh
  // when K0 > ν/(1-ν) (common for over-consolidated or naturally stressed formations).
  const fracPres = Math.max(fracPresRaw, sh)

  // Estimated injection pressure at PEAK (full) injection rate.
  // Using a ramp-reduced rate would understate wellbore pressure — safety checks must
  // validate against the worst case (full rate), not a gentle year-1 ramp value.
  const totalRate = wells.reduce((s, w) => s + w.injectionRate, 0)
  const phi = params.porosity
  const k_mD = params.permeability
  const h = params.thickness
  const visc = 5e-5
  const ct = 1e-9
  const rw = 0.1
  const perm_m2 = k_mD * 9.869e-16
  const t_sec = 365.25 * 24 * 3600
  const rhoCO2 = 700
  const Q_m3s = totalRate * 1e9 / (rhoCO2 * 365.25 * 24 * 3600)
  const alpha = perm_m2 / (phi * visc * ct)
  const u = rw * rw / (4 * alpha * t_sec)

  let e1: number
  if (u <= 1) {
    e1 = -0.5772156649 - Math.log(u) + u - u * u / 4 + u * u * u / 18 - u * u * u * u / 96 + u * u * u * u * u / 600
  } else {
    const a1 = 2.334733, a2 = 0.250621, b1 = 3.330657, b2 = 1.681534
    e1 = Math.exp(-u) * (u * u + a1 * u + a2) / (u * u + b1 * u + b2)
  }

  // Theis formula gives Pa → convert to MPa (pp is in MPa)
  const dP = Math.max(0, (Q_m3s * visc) / (4 * Math.PI * perm_m2 * h) * e1) / 1e6
  const estP = pp + Math.min(25, dP)
  const dp = estP - pp

  // Caprock
  const capDepth = depth - Math.max(20, depth * 0.07)
  const capPP = pp * capDepth / depth
  const capOB = capDepth * OG
  const capFrac = ((capOB - capPP) * POISSON / (1 - POISSON) + capPP) * (1 + Math.tan(phiRad) * 0.12) * Math.max(0.88, 1 - (params.biotCoefficient - 0.4) * 0.1)
  const capRatio = estP / Math.max(0.1, capFrac)

  // Safety factor
  const sf = fracPres / Math.max(0.1, estP)

  // Mohr-Coulomb
  const alphaB = params.biotCoefficient
  const C = params.caprockCohesion
  const mu = Math.tan(phiRad)
  const sigmaM0 = (sv + sh) / 2 - alphaB * pp
  const sigmaMC = sigmaM0 - alphaB * dp
  const R = (sv - sh) / 2
  const safety = C + sigmaMC * mu - R

  // MAIP = 90% of fracture pressure (Hubbert-Willis / regulatory standard)
  const maip = 0.9 * fracPres
  const maipMargin = (maip - estP) / maip * 100

  const checks = {
    caprock: {
      ok: capRatio < 0.85,
      value: capRatio,
      threshold: 0.85,
      message: capRatio >= 1.0
        ? 'Injection pressure exceeds caprock fracture pressure — seal failure likely'
        : capRatio >= 0.85
          ? 'Injection pressure approaching caprock fracture limit — seal may be compromised'
          : 'Caprock seal intact',
      fix: capRatio >= 0.85
        ? 'Reduce injection rate (Formation panel → well rate) or increase caprock friction angle (Geomechanics panel)'
        : '',
    },
    safetyFactor: {
      ok: sf >= 1.2,
      value: sf,
      threshold: 1.2,
      message: sf < 1.0
        ? 'Fracture pressure exceeded — immediate fracturing risk'
        : sf < 1.2
          ? `Safety factor ${sf.toFixed(2)} below minimum 1.2 — fracture risk elevated`
          : 'Safe fracture margin',
      fix: sf < 1.2
        ? 'Reduce injection rate (Formation panel → well rate) or increase reservoir depth (Formation panel → depth)'
        : '',
    },
    mohr: {
      ok: safety > 0,
      value: safety,
      threshold: 0,
      message: safety <= 0
        ? `Mohr-Coulomb failure predicted (margin ${safety.toFixed(2)} MPa) — shear failure risk`
        : 'Shear stable',
      fix: safety <= 0
        ? 'Reduce injection rate (Formation panel), or increase friction angle / cohesion / Biot coefficient (Geomechanics panel)'
        : '',
    },
    maip: {
      ok: maipMargin > 0,
      value: maipMargin,
      threshold: 0,
      message: maipMargin <= 0
        ? `Wellbore pressure ${estP.toFixed(1)} MPa exceeds MAIP ${maip.toFixed(1)} MPa`
        : `Margin to MAIP: ${maipMargin.toFixed(1)}%`,
      fix: maipMargin <= 0
        ? 'Reduce injection rate or number of wells (Formation panel)'
        : '',
    },
  }

  const valid = checks.caprock.ok && checks.safetyFactor.ok && checks.mohr.ok && checks.maip.ok

  return { valid, estimatedPInj: estP, checks }
}

// ---------------------------------------------------------------------------
// Compute the full GeomechanicsResult from params + wells alone.
// Called during run() so geomechanics is always populated in the store
// regardless of whether the user ever opens the Geomechanics panel.
// Pass simResult for accurate surface heave; pass null for an initial estimate.
// ---------------------------------------------------------------------------
const _GEO_POISSON = 0.30
const _GEO_OG = 0.023
const _GEO_K0 = 0.82

export function computeGeomechanicsResult(
  params: FormationParams,
  wells: { injectionRate: number; rampUpYears: number; rampDownYears: number }[],
  simResult: SimulationResult | null,
): GeomechanicsResult {
  const depth = params.depth
  const pp = params.pressure
  const _poisson = params.poissonRatio ?? _GEO_POISSON
  const _og      = params.overburdenGradient ?? _GEO_OG
  const _k0      = params.stressRatioK0 ?? _GEO_K0
  const sv = depth * _og
  const sh = sv * _k0
  const phiRad = params.caprockFriction * Math.PI / 180
  const mu = Math.tan(phiRad)

  // Peak-rate injection pressure via Theis (same formula as validateGeomechanics)
  const totalRate = wells.reduce((s, w) => s + w.injectionRate, 0)
  let injPres = pp
  if (totalRate > 0) {
    const perm_m2 = params.permeability * 9.869e-16
    const Q_m3s = totalRate * 1e9 / (700 * 365.25 * 24 * 3600)
    const visc = 5e-5
    const ct = 1e-9
    const alpha_d = perm_m2 / (params.porosity * visc * ct)
    const u = (0.1 * 0.1) / (4 * alpha_d * 365.25 * 24 * 3600)
    let e1: number
    if (u <= 1) {
      e1 = -0.5772156649 - Math.log(u) + u - u * u / 4 + u * u * u / 18 - u * u * u * u / 96 + u * u * u * u * u / 600
    } else {
      const a1 = 2.334733, a2 = 0.250621, b1 = 3.330657, b2 = 1.681534
      e1 = Math.exp(-u) * (u * u + a1 * u + a2) / (u * u + b1 * u + b2)
    }
    const dP_Pa = Math.max(0, (Q_m3s * visc) / (4 * Math.PI * perm_m2 * params.thickness) * e1)
    injPres = pp + Math.min(25, dP_Pa / 1e6)
  }
  const dp = Math.max(0, injPres - pp)

  // Hubbert-Willis + Mohr-Coulomb adjusted fracture pressure (mirrors GeomechanicsPanel)
  const baseFrac = (sv - pp) * _poisson / (1 - _poisson) + pp
  const frictionBoost = 1 + mu * 0.15
  const alphaPenalty = Math.max(0.85, 1 - (params.biotCoefficient - 0.4) * 0.12)
  // Floor at σh: H-W underestimates fracture P when K0 > ν/(1-ν)
  const fracPres = Math.max(baseFrac * frictionBoost * alphaPenalty, sh)

  const maip = 0.9 * fracPres
  const maipMargin = (maip - injPres) / maip * 100
  const sf = fracPres / Math.max(0.1, injPres)

  // Caprock fracture pressure (at seal depth, ~7% shallower than reservoir top)
  const capDepth = depth - Math.max(20, depth * 0.07)
  const capPP = pp * capDepth / depth
  const capOB = capDepth * _og
  const capFrac = ((capOB - capPP) * _poisson / (1 - _poisson) + capPP)
    * (1 + mu * 0.12)
    * Math.max(0.88, 1 - (params.biotCoefficient - 0.4) * 0.1)

  // Mohr-Coulomb (same as GeomechanicsPanel → computeMohr with s3 = sh)
  const sm_init = (sv + sh) / 2 - params.biotCoefficient * pp
  const sm_curr = sm_init - params.biotCoefficient * dp
  const R = (sv - sh) / 2
  const mohrSafetyMargin = params.caprockCohesion + sm_curr * mu - R
  const mohrFailed = mohrSafetyMargin < 0
  const dcff = mu * dp

  const seisRisk: 'low' | 'moderate' | 'high' = sf > 1.5 ? 'low' : sf > 1.2 ? 'moderate' : 'high'
  const slipPot = Math.min(1, Math.max(0,
    (injPres - pp) / Math.max(0.01, fracPres - pp) * (1 - params.biotCoefficient * 0.3),
  ))

  // Surface heave — nucleus-of-strain approximation (requires simResult for volume)
  let surfaceHeave = 0
  if (simResult && simResult.storageCapacity > 0) {
    const dP_Pa = dp * 1e6
    const rho = simResult.co2Density || 700
    const V = simResult.storageCapacity * 1e9 / rho
    const E_gpa = params.reservoirYoungsModulus ?? 5
    const fracCompliance = params.fracturedReservoir ? 0.20 : 1.0
    const E_eff = E_gpa * fracCompliance * 1e9
    surfaceHeave = Math.max(0, 2 / Math.PI * (1 - 0.25 * 0.25) * dP_Pa * V / (E_eff * Math.max(100, depth) ** 2))
  }

  // MAIP pressure-front radius: Theis characteristic diffusion length over a 20-year
  // horizon using brine hydraulic diffusivity.  Far-field pressure propagates through
  // undisturbed brine (μ ≈ 6×10⁻⁴ Pa·s), not CO₂.  The prior formula used CO₂
  // viscosity (5×10⁻⁵ Pa·s), overestimating the radius by √(μ_brine/μ_CO₂) ≈ 3.5×.
  const _muBrine_geo = 6e-4   // Pa·s — brine viscosity for pressure-front diffusivity
  const presFrontR = Math.sqrt(
    4 * params.permeability * 9.869e-16 * 86400 * 365 * 20
    / (params.porosity * _muBrine_geo * 1e-9),
  ) / 1000

  return {
    capRockStress: capFrac * 0.85,
    fracturePressure: fracPres,
    safetyFactor: sf,
    inducedSeismicityRisk: seisRisk,
    faultSlipPotential: slipPot,
    surfaceHeave,
    mohrSafetyMargin,
    dcff,
    frictionAngle: params.caprockFriction,
    cohesion: params.caprockCohesion,
    biotCoefficient: params.biotCoefficient,
    overburdenStress: sv,
    minHorizontalStress: sh,
    mohrFailed,
    maip,
    maipMargin,
    pressureFrontRadius: presFrontR,
  }
}

export function useSimulation(gridRef?: React.RefObject<{
  updateCO2Colors: () => void
  grid: import('../engine/grid/SimulationGrid').SimulationGrid | null
}>) {
  const a = React.useRef<AnimationState>(makeAnimState())

  const autoSaveProject = React.useCallback(async () => {
    try {
      const fStore = useFormationStore.getState()
      const simStore = useSimulationStore.getState()
      const uiStore = useUIStore.getState()
      const projectId = uiStore.currentProjectId
      if (!projectId) return
      const existing = await db.projects.get(projectId)
      const now = Date.now()
      const project = {
        ...(existing ?? { ...createDefaultProject(), id: projectId, createdAt: now }),
        formation: { ...fStore.params },
        wells: [...fStore.wells],
        simulationResult: simStore.result ? { ...simStore.result } : null,
        geomechanicsResult: simStore.geomechanics ? { ...simStore.geomechanics } : null,
        jurisdiction: uiStore.jurisdiction,
        updatedAt: now,
        snapshots: existing?.snapshots ?? simStore.snapshots ?? [],
        thumbnail: existing?.thumbnail ?? null,
        country: existing?.country ?? '',
        presetId: existing?.presetId ?? null,
        stageCompletion: { ...uiStore.stageCompletion },
      }
      await db.projects.put(project)
    } catch { /* silent */ }
  }, [])

  const animateFrame = React.useCallback((ts: number) => {
    const st = a.current
    const sim = useSimulationStore.getState()
    if (!sim.isAnimating) return

    const msPerYear = 2400 / sim.animationSpeed
    const projectYears = useUIStore.getState().projectYears

    if (!st.startTime) {
      st.startTime = ts - st.resumeYear * msPerYear
      st.resumeYear = 0
    }

    const elapsed = ts - st.startTime
    const year = Math.min(projectYears, Math.floor(elapsed / msPerYear))

    if (year !== st.prevYear) {
      st.prevYear = year
      const params = useFormationStore.getState().params
      const wells = useFormationStore.getState().wells

      // ── Pure-analytical chain ─────────────────────────────────────────────
      // Pass st.analyticalResult as prev so each frame accumulates from the
      // previous ANALYTICAL state, never from PlumeGrid-overridden store values.
      // This guarantees residual + solubility + mobile = storageCapacity every frame.
      const analyticalNew = computeYearly(params, year, projectYears, st.analyticalResult)
      st.analyticalResult = analyticalNew

      // Start with the analytical result; PlumeGrid may override trapping values
      // below for the LIVE display (3D colours + UI panel) only.
      let newResult = analyticalNew

      if (st.plumeGrid) {
        const useIMPES = useFormationStore.getState().useIMPES
        st.plumeGrid.step(year, newResult, useIMPES)
        const tb = st.plumeGrid.trappingBreakdown()
        const plumeSum = tb.freeMt + tb.residualMt + tb.dissolvedMt + tb.mineralMt
        // Only override analytical trapping when PlumeGrid values are non-zero AND conserve
        // at least 85% of injected mass.  The analytical model (computeYearly) always satisfies
        // residual + solubility + mobile = storageCapacity exactly — this invariant is needed for
        // internally consistent mass-balance reporting in the export documents.  If the PlumeGrid
        // loses more than 15% of mass through open boundaries (common for large plumes that reach
        // the finite model extent), the analytical model is used instead.
        const plumeMassOk = plumeSum > 0
          && (newResult.storageCapacity <= 0 || plumeSum >= newResult.storageCapacity * 0.85)
        if (plumeMassOk) {
          newResult = {
            ...newResult,
            mobilePlume: tb.freeMt,
            residualTrapping: tb.residualMt,
            solubilityTrapping: tb.dissolvedMt,
            mineralTrapping: tb.mineralMt,
          }
        }
        // else: keep computeYearly's analytical trapping (mass-conservative fallback)
        st.colorUpdateFn?.()
      }

      // ── VE solver step (with implicit FD pressure) ────────────────────────
      if (st.veSolver) {
        const veWells: VEWellSource[] = []
        const cellWidth_m_ve = Math.sqrt(params.area * 1e6) / VE_NX
        for (const w of wells) {
          const rate = wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears)
          if (rate > 0) {
            const q_m3s = rate * 1e9 / (newResult.co2Density * 365.25 * 24 * 3600)
            const { i, j } = wellToGridIndex(w.x, w.z, VE_NX, VE_NY)
            veWells.push({ i, j, q_m3s })
          }
        }

        // ── Implicit FD pressure solve ──────────────────────────────────────
        // Solves the transient compressible 2D pressure equation on the VE grid.
        // Produces:
        //   1. Spatial ∇P field fed into the VE plume step (pressure-driven migration)
        //   2. Well-block pressures for Peaceman BHP (more accurate than Nordbotten
        //      for bounded domains — pressure buildup converges toward MRST ~20 MPa
        //      rather than the infinite-aquifer Nordbotten value ~10 MPa)
        let dPdx_Pa_m: Float32Array | undefined
        let dPdy_Pa_m: Float32Array | undefined
        if (st.fdPrev && st.fdPermField_mD && veWells.length > 0) {
          try {
            const fdResult = solveFDPressure({
              nx: VE_NX,
              ny: VE_NY,
              dx_m: cellWidth_m_ve,
              dy_m: cellWidth_m_ve,
              permField_mD:        st.fdPermField_mD,
              formationH:          params.thickness,
              porosity:            params.porosity,
              totalCompressibility: 1e-9,   // Pa⁻¹ — typical sandstone aquifer
              brineViscosity:      6e-4,    // Pa·s — brine at ~37 °C
              wells:               veWells,
              P_prev_Pa:           st.fdPrev,
              dt_s:                365.25 * 24 * 3600,
            })

            // Advance FD pressure state (transient accumulation year-on-year)
            st.fdPrev = fdResult.P_Pa
            dPdx_Pa_m = fdResult.dPdx_Pa_m
            dPdy_Pa_m = fdResult.dPdy_Pa_m

            // FD-derived injection pressure: block pressure at highest-pressure well.
            // Only injectionPressure is updated here — peacemanBHP is preserved from the
            // outer computeYearly() analytical calculation (Nordbotten + Peaceman 1978).
            // The FD closed-box pressure can be very large (sealed domain) and must NOT
            // overwrite the physically correct near-wellbore BHP from the open-aquifer model.
            if (fdResult.P_well_Pa.length > 0) {
              const P_fd_max_Pa = Math.max(...fdResult.P_well_Pa)
              const P_fd_MPa    = P_fd_max_Pa / 1e6
              newResult = {
                ...newResult,
                injectionPressure: P_fd_MPa,
              }
            }
          } catch {
            // FD solver failed: keep Nordbotten analytical values; no ∇P in VE step
            dPdx_Pa_m = undefined
            dPdy_Pa_m = undefined
          }
        }

        // ── Thermal property field (G-feature: spatially-varying rho, mu) ─────
        // Build T(i,j) from geothermal gradient + JT cooling, then evaluate
        // Span-Wagner density and Fenghour viscosity at each cell's temperature.
        let co2DensityField: Float32Array | undefined
        let co2ViscosityField: Float32Array | undefined
        if (params.geothermalGradient != null && params.surfaceTemperatureC != null && veWells.length > 0) {
          const thermalParams: ThermalParams = {
            surfaceTemperature_C:    params.surfaceTemperatureC,
            geothermalGradient_CPerKm: params.geothermalGradient * 10,  // deg C/100m to deg C/km
            injectionTemperature_C:  params.temperature,
            thermalDiffusivity_m2s:  DEFAULT_THERMAL.thermalDiffusivity_m2s,
          }
          try {
            const tf = computeThermalPropertyField({
              grid: { nx: VE_NX, ny: VE_NY, dx_m: cellWidth_m_ve, dy_m: cellWidth_m_ve },
              topDepth_m:           params.depth,
              thickness_m:          params.thickness,
              pressure_MPa:         params.pressure,
              wellheadPressure_MPa: Math.min(params.pressure + 5, 30),
              year,
              wellIndices:          veWells.map(w => ({ i: w.i, j: w.j })),
              thermalParams,
              methaneFrac:          params.methaneFraction ?? 0,
              nitrogenFrac:         params.nitrogenFraction ?? 0,
            })
            co2DensityField  = tf.densityField
            co2ViscosityField = tf.viscosityField
          } catch {
            // Thermal field failed: fall back to uniform properties (silent degradation)
          }
        }

        // ── VE plume step (now driven by FD grad(P) + gravity + thermal + structural) ──────────────────
        const veState = st.veSolver.step(veWells, dPdx_Pa_m, dPdy_Pa_m, co2DensityField, co2ViscosityField)
        // VE solver tracks residual trapping via Killough-Land hysteresis cell-by-cell.
        // During active injection the plume only expands (drainage), so trappedMass_Mt ≈ 0,
        // which correctly reflects the absence of imbibition-driven snap-off in an expanding plume.
        const veResidual = veState.trappedMass_Mt
        const veMobile = Math.max(0,
          newResult.storageCapacity - newResult.solubilityTrapping - newResult.mineralTrapping - veResidual,
        )
        newResult = {
          ...newResult,
          vePlumeArea:      veState.plumeArea_m2 / 1e6,  // m² → km²
          vePlumeRadius:    veState.plumeRadius_m,
          residualTrapping: veResidual,
          mobilePlume:      veMobile,
          veSatGrid:        new Float32Array(veState.saturation),  // 60×60 η/H for 3D renderer
        }
      }

      const totalRate = wells.reduce((s, w) => s + wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears), 0)

      if (totalRate > 0) {
        st.peakResult = newResult
        sim.setResult(newResult)
      } else if (st.peakResult) {
        if (st.plumeGrid) {
          const tb = st.plumeGrid.trappingBreakdown()
          const plumeSum = tb.freeMt + tb.residualMt + tb.dissolvedMt + tb.mineralMt
          const peakStorage = st.peakResult.storageCapacity
          const plumeMassOk = plumeSum > 0
            && (peakStorage <= 0 || plumeSum >= peakStorage * 0.85)
          newResult = plumeMassOk
            ? {
                ...st.peakResult,
                mobilePlume: tb.freeMt,
                residualTrapping: tb.residualMt,
                solubilityTrapping: tb.dissolvedMt,
                mineralTrapping: tb.mineralMt,
              }
            : st.peakResult
        } else {
          newResult = st.peakResult
        }
        sim.setResult(newResult)
      } else {
        sim.setResult(newResult)
      }

      useUIStore.getState().setTimestep(year)

      // Persist per-year trapping state to IndexedDB for monitoring panel
      const currentProjectId = useUIStore.getState().currentProjectId
      if (currentProjectId) {
        const tb = st.plumeGrid ? st.plumeGrid.trappingBreakdown() : null
        const snapshot = {
          id: `${currentProjectId}_y${year}`,
          projectId: currentProjectId,
          year,
          freeMt: tb?.freeMt ?? newResult.mobilePlume,
          residualMt: tb?.residualMt ?? newResult.residualTrapping,
          dissolvedMt: tb?.dissolvedMt ?? newResult.solubilityTrapping,
          mineralMt: tb?.mineralMt ?? newResult.mineralTrapping,
          plumeRadiusM: newResult.plumeRadius,
          plumeAreaKm2: newResult.vePlumeArea ?? (Math.PI * newResult.plumeRadius * newResult.plumeRadius / 1e6),
          pressureMPa: newResult.injectionPressure,
          injectedMt: newResult.storageCapacity,
          createdAt: Date.now(),
        }
        db.simulationSnapshots.put(snapshot).catch(() => { /* silent — non-blocking */ })
      }

      // Capture reservoir snapshot at key simulation years
      const snapshotInterval = Math.max(5, Math.floor(projectYears / 5))
      if (year === 1 || (year > 0 && year % snapshotInterval === 0)) {
        const canvas = document.querySelector('canvas')
        if (canvas) {
          try {
            const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png')
            sim.addSnapshot(year, dataUrl)
          } catch { /* cross-origin canvas — skip */ }
        }
      }
    }

    if (year < projectYears) {
      st.raf = requestAnimationFrame(animateFrame)
    } else {
      // Freeze final result for export consistency — both export buttons will read this
      // identical snapshot regardless of when they are clicked.
      const finalResult = useSimulationStore.getState().result
      const finalParams = useFormationStore.getState().params
      const finalWells = useFormationStore.getState().wells

      // Build the export result: keep PlumeGrid-derived geometry (plumeRadius, VE data, etc.)
      // from the live result but replace mass-balance fields with the pure-analytical values.
      // This guarantees residual + solubility + mobile = storageCapacity in BOTH export docs.
      const ana = st.analyticalResult
      const exportResult: SimulationResult | null = (finalResult != null && ana != null)
        ? {
            ...finalResult,
            // Mass-balance fields come exclusively from the analytical chain
            storageCapacity:  ana.storageCapacity,
            residualTrapping: ana.residualTrapping,
            solubilityTrapping: ana.solubilityTrapping,
            mineralTrapping:  ana.mineralTrapping,
            mobilePlume:      ana.mobilePlume,
          }
        : finalResult

      // Compute final geomechanics with the actual injected volume for accurate surface heave.
      const finalGeo = computeGeomechanicsResult(finalParams, finalWells, exportResult)
      if (exportResult) {
        // Snapshot result + wells + params + geomechanics together so both export
        // documents always describe the same completed run.  Storing geomechanics in
        // the snapshot (not just the live field) prevents the permit report from
        // showing "Run geomechanics assessment" when the live field is updated by a
        // subsequent action before the user clicks export.
        sim.setCompletedSnapshot(exportResult, finalWells, finalParams, finalGeo)
      }
      // Also update the live geomechanics field so the GeomechanicsPanel reflects the
      // completed run (this is separate from the frozen export snapshot above).
      sim.setGeomechanics(finalGeo)
      sim.stopAnimation()
      autoSaveProject().catch(() => { /* silent */ })
    }
  }, [])

  const run = React.useCallback(() => {
    const st = a.current
    const store = useSimulationStore.getState()
    if (store.isAnimating) return
    st.prevYear = -1
    st.startTime = 0
    st.peakResult = null
    st.analyticalResult = null  // reset pure-analytical chain for fresh run
    const params = useFormationStore.getState().params
    const wells = useFormationStore.getState().wells
    const projectYears = useUIStore.getState().projectYears

    const validation = validateGeomechanics(params, wells)
    store.setValidation(validation)
    const override = store.forceRun

    if (!validation.valid && !override) return

    store.setForceRun(false)
    // Populate geomechanics immediately so exports are never "NOT RUN",
    // regardless of whether the user opens the Geomechanics panel.
    store.setGeomechanics(computeGeomechanicsResult(params, wells, null))
    store.runSimulation()
    store.setResult(computeYearly(params, 0, projectYears, null))
    store.startAnimation()
    useUIStore.getState().setTimestep(0)

    // ── Purge stale snapshots from the previous run ───────────────────────
    // Must happen BEFORE the RAF loop writes year-1 data.  Keeping old records
    // causes the Plume Expansion History table to show data from prior runs when
    // the user changes simulation duration or formation parameters.
    const currentProjectId = useUIStore.getState().currentProjectId
    if (currentProjectId) {
      db.simulationSnapshots
        .where('projectId')
        .equals(currentProjectId)
        .delete()
        .catch(() => { /* silent — non-blocking */ })
    }

    try {
      const geoModel = useGeologicalStore.getState().model
      const gridData = geologicalModelToGrid(geoModel)
      const simGrid  = new SimulationGrid(gridData)

      const zoneLithologyMap = new Map<string, import('../types/geological').LithologyType>()
      for (const z of geoModel.zones) {
        zoneLithologyMap.set(z.id, z.lithology)
      }

      // Pass history matching overrides only when they differ from defaults.
      // This avoids changing behavior for users who haven't touched the HM panel.
      const hmParams = useHistoryMatchingStore.getState().matchableParams
      const hasNonDefaultHmParams = (Object.keys(hmParams) as Array<keyof MatchableParams>).some(
        k => Math.abs((hmParams[k] as number) - (DEFAULT_MATCHABLE_PARAMS[k] as number)) > 1e-6
      )
      const matchableOverrides = hasNonDefaultHmParams ? hmParams : undefined

      const initP = params.pressure
      st.plumeGrid = new PlumeGrid(simGrid, wells, projectYears, initP, zoneLithologyMap, params.temperature, matchableOverrides)
      st.plumeGrid.reset()

      if (gridRef?.current?.grid) {
        const nativeGrid = gridRef.current.grid
        st.plumeGrid = new PlumeGrid(nativeGrid, wells, projectYears, initP, zoneLithologyMap, params.temperature, matchableOverrides)
        st.colorUpdateFn = () => gridRef.current?.updateCO2Colors()
      } else {
        st.colorUpdateFn = null
      }
    } catch {
      st.plumeGrid = null
      st.colorUpdateFn = null
    }

    // ── VE solver initialisation ──────────────────────────────────────────
    try {
      const dx_m = Math.sqrt(params.area * 1e6) / VE_NX
      const dy_m = Math.sqrt(params.area * 1e6) / VE_NY
      const T_K_ve  = params.temperature + 273.15
      // Fix 3: clamp pressure before EOS call
      const P_Pa_ve = Math.max(0.5e6, Math.min(80e6, params.pressure * 1e6))
      // Fix 4: honour co2DensityOverride in VE solver fluid properties
      const rhoCO2_ve_eos = co2DensityWithImpurities(T_K_ve, P_Pa_ve, params.methaneFraction, params.nitrogenFraction)
      const rhoCO2_ve = (params.co2DensityOverride != null && params.co2DensityOverride > 0)
        ? params.co2DensityOverride
        : (Number.isFinite(rhoCO2_ve_eos) && rhoCO2_ve_eos > 0 && rhoCO2_ve_eos < 1100
            ? rhoCO2_ve_eos
            : 700)
      const rhoBrine_ve = brineDensityGarcia(T_K_ve, params.pressure, params.monovalentSalinity, params.bivalentSalinity)
      const muCO2_ve  = co2ViscosityFenghour(T_K_ve, rhoCO2_ve)
      const veFluid: VEFluidProps = {
        co2Density:   rhoCO2_ve,
        brineDensity: rhoBrine_ve,
        co2Viscosity: muCO2_ve,
        porosity:     params.porosity,
        Swi:          params.swiConnate ?? 0.15,   // Fix 5: param-driven Swi
        thickness:    params.thickness,
        // Footprint threshold: 2.5% of formation thickness (min 1 m).
        // Counts only cells with a physically meaningful CO2 column.
        // Default 0.01 m (1 cm) captures numerical diffusion tails and
        // reports a wildly overestimated footprint for large/thin formations.
        // The code comment in VESolver says "set ~5 m for seismic comparison";
        // 2.5% of thickness gives 5 m for a 200 m formation and scales correctly
        // for thinner or thicker zones.
        etaThresh:    Math.max(1.0, params.thickness * 0.025),
      }
      const permField = uniformPermField(VE_NX, VE_NY, params.permeability)

      // ── Structural depth map ─────────────────────────────────────────────
      // Build topDepthField from the geological model's active injection zone.
      // Falls back to flat (undefined) if no geological model is loaded.
      const geoModel = useGeologicalStore.getState().model
      const activeZone = geoModel?.zones.find(z => z.activeForInjection)
      const topDepthField = activeZone
        ? buildTopDepthField({
            grid: { nx: VE_NX, ny: VE_NY, dx_m, dy_m },
            baseDepth_m: params.depth,
            horizonShape: activeZone.horizonShape,
            params: activeZone.horizonParams,
            modelWidth_m:  geoModel?.modelWidthM  ?? Math.sqrt(params.area * 1e6),
            modelLength_m: geoModel?.modelLengthM ?? Math.sqrt(params.area * 1e6),
          })
        : undefined

      // ── Fault transmissibility field ──────────────────────────────────────
      const faultMultField = (geoModel && geoModel.faults.length > 0)
        ? buildFaultMultField(
            { nx: VE_NX, ny: VE_NY, dx_m, dy_m },
            geoModel.faults,
            geoModel.modelWidthM ?? Math.sqrt(params.area * 1e6),
            geoModel.modelLengthM ?? Math.sqrt(params.area * 1e6),
          )
        : undefined

      const veGrid = {
        nx: VE_NX, ny: VE_NY, dx_m, dy_m,
        ...(topDepthField  ? { topDepthField }  : {}),
        ...(faultMultField ? { faultMultField } : {}),
      }

      st.veSolver = new VESolver(veGrid, veFluid, permField)
      st.veSolver.reset()
    } catch {
      st.veSolver = null
    }

    // ── FD pressure solver initialisation ────────────────────────────────
    // Store perm field and seed pressure field so the transient solver can
    // accumulate pressure correctly from year 1 onwards.
    try {
      st.fdPermField_mD = uniformPermField(VE_NX, VE_NY, params.permeability)
      st.fdPrev = new Float32Array(VE_NX * VE_NY).fill(params.pressure * 1e6)
    } catch {
      st.fdPrev = null
      st.fdPermField_mD = null
    }

    st.raf = requestAnimationFrame(animateFrame)

    try { autoSaveProject() } catch { /* silent */ }
  }, [gridRef, animateFrame])

  const stop = React.useCallback(() => {
    const st = a.current
    cancelAnimationFrame(st.raf)
    st.raf = 0
    st.plumeGrid?.reset()
    st.veSolver?.reset()
    st.veSolver = null
    st.plumeGrid = null
    st.colorUpdateFn = null
    st.resumeYear = 0
    st.analyticalResult = null
    st.fdPrev = null
    st.fdPermField_mD = null
    useSimulationStore.getState().stopAnimation()
    try { autoSaveProject() } catch { /* silent */ }
  }, [])

  const pause = React.useCallback(() => {
    const st = a.current
    cancelAnimationFrame(st.raf)
    st.raf = 0
    st.startTime = 0
    st.resumeYear = st.prevYear
    useSimulationStore.getState().pauseAnimation()
  }, [])

  const resume = React.useCallback(() => {
    if (useSimulationStore.getState().isAnimating) return
    useSimulationStore.getState().resumeAnimation()
    a.current.raf = requestAnimationFrame(animateFrame)
  }, [animateFrame])

  return { runAnimation: run, stopAnimation: stop, pauseSimulation: pause, resumeSimulation: resume }
}
