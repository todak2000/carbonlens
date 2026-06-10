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
  co2DensitySpanWagner, brineDensityGarcia, co2ViscosityFenghour,
  co2SolubilityDuanSun, co2DiffusionCoefficient, determinePhase,
  computeTr, computePr, evaluateMars, scaleInput,
  subEquation, subScaler, supEquation, supScaler,
  assessApplicabilityDomain,
} from '../engine'
import { cumulativeInjection, wellRateAtTime } from '../utils/gridParser'
import { computePressureField, expIntegralE1 } from '../utils/computePressureField'
import {
  computeWellboreDiagnostics,
  DEFAULT_WELLBORE,
} from '../engine/plume/wellboreModel'
import { computeHaliteRisk } from '../engine/classical/haliteRisk'
import {
  VESolver, uniformPermField, wellToGridIndex,
  type VEFluidProps, type VEWellSource,
} from '../engine/ve'

export function computeYearly(
  params: FormationParams,
  year: number,
  projectYears: number,
  prevResultOverride?: SimulationResult | null,
): SimulationResult {
  const wells = useFormationStore.getState().wells

  const T_K = params.temperature + 273.15
  const A = params.area * 1e6
  const h_m = params.thickness
  const phi = params.porosity
  const ntg = params.netToGross

  // DOE Goodman 2011: Cc coefficients are derived from gross pore volume statistics
  // that implicitly capture NTG effects. Applying NTG explicitly double-counts it.
  const totalPoreVolume = A * h_m * phi

  // CO2 density at initial reservoir conditions
  const rhoCO2_init = co2DensitySpanWagner(T_K, params.pressure * 1e6)

  // DOE capacity coefficient framework (Goodman et al. 2011)
  const Cc_P10 = 0.0051
  const Cc_P50 = 0.0200
  const Cc_P90 = 0.0550
  const capacityP10 = totalPoreVolume * Cc_P10 * rhoCO2_init / 1e9
  const totalCapacity = totalPoreVolume * Cc_P50 * rhoCO2_init / 1e9
  const capacityP90 = totalPoreVolume * Cc_P90 * rhoCO2_init / 1e9

  // ── Position-dependent storage ─────────────────────────────────────────────
  let totalCum = 0
  for (let i = 0; i < wells.length; i++) {
    const w = wells[i]
    totalCum += cumulativeInjection(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears)
  }

  const storageAtYear = totalCum

  // ── Pressure model: Theis transient radial flow with superposition ─────────
  const currentRate = wells.reduce((s, w) => s + wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears), 0)
  const rhoCO2_mobile = co2DensitySpanWagner(T_K, params.pressure * 1e6)
  const visc = co2ViscosityFenghour(T_K, rhoCO2_mobile)

  const perm_m2 = params.permeability * 9.869e-16
  const ct = 1e-9
  const t_sec = year * 365.25 * 24 * 3600
  const alpha = perm_m2 / (phi * visc * ct)
  const modelScale = Math.sqrt(params.area * 1e6) / 3
  const rw_m = 0.1

  // Superpose well pressure buildups at each well location (Theis + inter-well interference)
  let dP_max = 0
  for (const wi of wells) {
    const qwi = wellRateAtTime(wi.injectionRate, year, wi.rampUpYears, wi.rampDownYears, projectYears)
    if (qwi <= 0) continue
    const Qi = qwi * 1e9 / (rhoCO2_mobile * 365.25 * 24 * 3600)
    const ui = rw_m * rw_m / (4 * alpha * Math.max(t_sec, 1))
    // Theis formula gives Pa → convert to MPa for consistency with params.pressure
    let dP_i = (Qi * visc) / (4 * Math.PI * perm_m2 * h_m) * expIntegralE1(ui) / 1e6

    for (const wj of wells) {
      if (wj.id === wi.id) continue
      const qwj = wellRateAtTime(wj.injectionRate, year, wj.rampUpYears, wj.rampDownYears, projectYears)
      if (qwj <= 0) continue
      const Qj = qwj * 1e9 / (rhoCO2_mobile * 365.25 * 24 * 3600)
      const dist = Math.sqrt((wi.x - wj.x) ** 2 + (wi.z - wj.z) ** 2) * modelScale
      const r_eff = Math.max(dist, rw_m)
      const uj = r_eff * r_eff / (4 * alpha * Math.max(t_sec, 1))
      dP_i += (Qj * visc) / (4 * Math.PI * perm_m2 * h_m) * expIntegralE1(uj) / 1e6
    }

    dP_max = Math.max(dP_max, dP_i)
  }
  const dP_capped = Math.max(0, Math.min(25, dP_max))
  const P_t = params.pressure + dP_capped

  // Recompute fluid properties at the injection pressure
  const P_Pa = P_t * 1e6
  const rhoCO2 = co2DensitySpanWagner(T_K, P_Pa)
  const rhoBrine = brineDensityGarcia(T_K, P_t, params.monovalentSalinity, params.bivalentSalinity)
  const drho = rhoBrine - rhoCO2
  const drho_sq = drho * drho / 1e6

  const phase = determinePhase(T_K, P_t, params.methaneFraction, params.nitrogenFraction)
  const Pr = computePr(P_t, params.methaneFraction, params.nitrogenFraction)
  const Tr = computeTr(T_K, params.methaneFraction, params.nitrogenFraction)

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
  const solubility = co2SolubilityDuanSun(T_K, P_t, params.monovalentSalinity, params.bivalentSalinity)
  const diffusion = co2DiffusionCoefficient(T_K, P_t, params.porosity)

  // Gravity current radius: injected volume fills a thin layer under the seal
  // r = sqrt(2·V / (π·φ·h_eff)) where h_eff ≈ 10% of formation thickness
  // Calibrated against Sleipner field data (Boait 2012): 650m at year 4, 1150m at year 12
  const cumVolM3 = totalCum * 1e9 / rhoCO2
  const hEff = h_m * 0.10
  const plumeRadius = Math.sqrt(2 * cumVolM3 / (Math.PI * phi * Math.max(1, hEff)))
  const plumeHeight = h_m * 0.55 * Math.min(1, Math.sqrt(totalCum / Math.max(0.001, totalCapacity)))

  // ── Trapping model: cumulative, stateful ─────────────────────────────────
  // prevResultOverride === null means fresh start (e.g. Re-run); undefined means read store
  const prevResult = prevResultOverride !== undefined
    ? prevResultOverride
    : useSimulationStore.getState().result
  const prevCum = prevResult
    ? wells.reduce((s, w) => s + cumulativeInjection(w.injectionRate, Math.max(0, year - 1), w.rampUpYears, w.rampDownYears, projectYears), 0)
    : 0
  const incrementalCum = Math.max(0, totalCum - prevCum)

  // 6.5% per year — within Sleipner's ≤2.7%/yr dissolution constraint (Furre 2017)
  // (dissolution = 40% of trapping = 2.6%/yr, below the 2.7% gravimetry upper bound)
  const trappingRate = 0.065
  const mobileBeforeTrapping = (prevResult?.mobilePlume ?? 0) + incrementalCum
  const newlyTrapped = mobileBeforeTrapping * trappingRate
  const residualTrapping = (prevResult?.residualTrapping ?? 0) + newlyTrapped * 0.6
  const solubilityTrapping = (prevResult?.solubilityTrapping ?? 0) + newlyTrapped * 0.4
  const mobilePlume = mobileBeforeTrapping - newlyTrapped

  const capacityUtilPct = (totalCum / Math.max(0.001, totalCapacity)) * 100
  const overpressureRisk = totalCum > capacityP90

  const trappedFrac = storageAtYear > 0.001 ? (residualTrapping + solubilityTrapping) / storageAtYear : 0

  // ── Pressure field for 3D visualization ───────────────────────────────────
  const pressureField = computePressureField(params, wells, year, projectYears, rhoCO2_mobile, visc_final)

  // ── Peaceman wellbore BHP (skin-aware near-wellbore pressure) ──────────────
  // Cell width estimate from model area and assumed 20×20 grid resolution.
  // Peaceman (1978) equivalent radius: r_eq = 0.1982 · dx.
  // This gives a physics-consistent BHP that accounts for skin, completion
  // geometry, and wellbore radius — independent of the Theis far-field model.
  const cellWidth_m = Math.sqrt(params.area * 1e6) / 20
  let peacemanBHP = P_t   // default to Theis-based pressure if no active wells
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
        params.pressure,      // initial reservoir pressure (MPa)
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
        0.15,                               // Swi — connate water (default)
        params.monovalentSalinity,
        params.bivalentSalinity,
        rhoCO2_mobile,
        rhoBrine,
        params.temperature,
        projectYears,
      )
    : undefined

  return {
    storageCapacity: storageAtYear,
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
    co2Viscosity: visc_final * 1000,  // Pa·s → mPa·s for display
    solubility,
    diffusion,
    solubilityTrapping,
    residualTrapping,
    // Analytical mineral trapping estimate: kinetic conversion of dissolved CO₂ begins at year 50
    // Rate constant 8e-4/yr matches PlumeGrid's MINERAL_RATE for sandstone (applyMineralTrapping)
    mineralTrapping: solubilityTrapping * (year >= 50 ? 1 - Math.exp(-8e-4 * (year - 50)) : 0),
    mobilePlume,
    containmentProbability: Math.min(0.95, 0.5 + ntg * 0.3 + trappedFrac * 0.15),
    ift,
    adAssessment,
    p10: capacityP10,
    p50: totalCapacity,
    p90: capacityP90,
    storageEfficiency: Cc_P50 * 100,  // 2.0% — gross pore volume efficiency (DOE P50)
    peacemanBHP,
    injectivityIndex,
    haliteRisk,
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
}

function makeAnimState(): AnimationState {
  return { raf: 0, startTime: 0, prevYear: -1, resumeYear: 0, peakResult: null, plumeGrid: null, colorUpdateFn: null, veSolver: null, analyticalResult: null }
}

// VE grid dimensions — 40×40 provides a good speed/resolution trade-off in-browser
const VE_NX = 40
const VE_NY = 40

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
  const sv = depth * _GEO_OG
  const sh = sv * _GEO_K0
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
  const baseFrac = (sv - pp) * _GEO_POISSON / (1 - _GEO_POISSON) + pp
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
  const capOB = capDepth * _GEO_OG
  const capFrac = ((capOB - capPP) * _GEO_POISSON / (1 - _GEO_POISSON) + capPP)
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
    surfaceHeave = Math.max(0, 2 / Math.PI * (1 - 0.25 * 0.25) * dP_Pa * V / (5e9 * Math.max(100, depth) ** 2))
  }

  // Pressure front radius (diffusivity estimate over 20 yr)
  const presFrontR = Math.sqrt(
    4 * params.permeability * 1e-15 * 86400 * 365 * 20 / (params.porosity * 5e-5 * 1e-9 * 2.25),
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
        st.plumeGrid.step(year, newResult)
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

      // ── VE solver step ────────────────────────────────────────────────────
      if (st.veSolver) {
        const veWells: VEWellSource[] = []
        for (const w of wells) {
          const rate = wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears)
          if (rate > 0) {
            const q_m3s = rate * 1e9 / (newResult.co2Density * 365.25 * 24 * 3600)
            const { i, j } = wellToGridIndex(w.x, w.z, VE_NX, VE_NY)
            veWells.push({ i, j, q_m3s })
          }
        }
        const veState = st.veSolver.step(veWells)
        newResult = {
          ...newResult,
          vePlumeArea:   veState.plumeArea_m2 / 1e6,  // m² → km²
          vePlumeRadius: veState.plumeRadius_m,
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
      const T_K   = params.temperature + 273.15
      const P_Pa  = params.pressure * 1e6
      const rhoCO2 = co2DensitySpanWagner(T_K, P_Pa)
      const rhoBrine = brineDensityGarcia(T_K, params.pressure, params.monovalentSalinity, params.bivalentSalinity)
      const muCO2  = co2ViscosityFenghour(T_K, rhoCO2)
      const veFluid: VEFluidProps = {
        co2Density:    rhoCO2,
        brineDensity:  rhoBrine,
        co2Viscosity:  muCO2,
        porosity:      params.porosity,
        Swi:           0.15,
        thickness:     params.thickness,
      }
      const permField = uniformPermField(VE_NX, VE_NY, params.permeability)
      st.veSolver = new VESolver(
        { nx: VE_NX, ny: VE_NY, dx_m, dy_m },
        veFluid,
        permField,
      )
      st.veSolver.reset()
    } catch {
      st.veSolver = null
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
