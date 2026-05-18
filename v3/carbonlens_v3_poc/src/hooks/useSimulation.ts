import { useFormationStore } from '../store/formationStore'
import { useSimulationStore } from '../store/simulationStore'
import { useUIStore } from '../store/uiStore'
import { createDefaultProject } from '../data/defaultProject'

import type { SimulationResult, FormationParams } from '../types'
import type { MarsInput } from '../engine/mars/types'
import {
  co2DensitySpanWagner, brineDensityGarcia, co2ViscosityFenghour,
  co2SolubilityDuanSun, co2DiffusionCoefficient, determinePhase,
  computeTr, computePr, evaluateMars, scaleInput,
  subEquation, subScaler, supEquation, supScaler,
} from '../engine'
import { cumulativeInjection, wellRateAtTime } from '../utils/gridParser'
import { computePressureField } from '../utils/computePressureField'

function computeWellAreas(wells: { x: number; z: number }[], area_m2: number): number[] {
  if (wells.length === 0) return []
  if (wells.length === 1) return [1]

  const modelScale = Math.sqrt(area_m2) / 3
  const halfExtent = modelScale * 2
  const samples = 20000
  const counts = new Array(wells.length).fill(0)

  for (let i = 0; i < samples; i++) {
    const px = (Math.random() - 0.5) * 2 * halfExtent
    const pz = (Math.random() - 0.5) * 2 * halfExtent

    let minDist2 = Infinity
    let nearest = 0
    for (let j = 0; j < wells.length; j++) {
      const dx = px - wells[j].x
      const dz = pz - wells[j].z
      const d2 = dx * dx + dz * dz
      if (d2 < minDist2) { minDist2 = d2; nearest = j }
    }
    counts[nearest]++
  }

  const total = counts.reduce((s, c) => s + c, 0)
  return counts.map((c) => c / total)
}

function expIntegralE1(x: number): number {
  if (x <= 0) return 1e10
  if (x <= 1) {
    return -0.5772156649 - Math.log(x) + x - x * x / 4 + x * x * x / 18 - x * x * x * x / 96 + x * x * x * x * x / 600
  }
  const a1 = 2.334733, a2 = 0.250621, b1 = 3.330657, b2 = 1.681534
  return Math.exp(-x) * (x * x + a1 * x + a2) / (x * x + b1 * x + b2)
}

function computeYearly(params: FormationParams, year: number, projectYears: number): SimulationResult {
  const wells = useFormationStore.getState().wells

  const T_K = params.temperature + 273.15
  const totalSalt = params.monovalentSalinity + params.bivalentSalinity

  const A = params.area * 1e6
  const h_m = params.thickness
  const phi = params.porosity
  const ntg = params.netToGross

  const totalPoreVolume = A * h_m * ntg * phi

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
  const areaFractions = computeWellAreas(wells, A)
  for (let i = 0; i < wells.length; i++) {
    const w = wells[i]
    const perWellCapacity = totalCapacity * areaFractions[i]
    const cum = cumulativeInjection(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears)
    totalCum += Math.min(cum, perWellCapacity)
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
    let dP_i = (Qi * visc) / (4 * Math.PI * perm_m2 * h_m) * expIntegralE1(ui)

    for (const wj of wells) {
      if (wj.id === wi.id) continue
      const qwj = wellRateAtTime(wj.injectionRate, year, wj.rampUpYears, wj.rampDownYears, projectYears)
      if (qwj <= 0) continue
      const Qj = qwj * 1e9 / (rhoCO2_mobile * 365.25 * 24 * 3600)
      const dist = Math.sqrt((wi.x - wj.x) ** 2 + (wi.z - wj.z) ** 2) * modelScale
      const r_eff = Math.max(dist, rw_m)
      const uj = r_eff * r_eff / (4 * alpha * Math.max(t_sec, 1))
      dP_i += (Qj * visc) / (4 * Math.PI * perm_m2 * h_m) * expIntegralE1(uj)
    }

    dP_max = Math.max(dP_max, dP_i)
  }
  const dP_capped = Math.max(0, Math.min(25, dP_max))
  const P_t = params.pressure + dP_capped

  // Recompute fluid properties at the injection pressure
  const P_Pa = P_t * 1e6
  const rhoCO2 = co2DensitySpanWagner(T_K, P_Pa)
  const rhoBrine = brineDensityGarcia(T_K, P_t, totalSalt)
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

  const visc_final = useSimulationStore.getState().result?.co2Viscosity ?? visc
  const solubility = co2SolubilityDuanSun(T_K, P_t, totalSalt)
  const diffusion = co2DiffusionCoefficient(T_K, P_Pa, params.porosity)

  const plumeRadius = Math.sqrt(A / Math.PI) * 0.3 * Math.sqrt(Math.min(1, totalCum / Math.max(0.001, totalCapacity)))
  const plumeHeight = h_m * 0.55 * Math.min(1, Math.sqrt(totalCum / Math.max(0.001, totalCapacity)))

  // ── Trapping model: cumulative, stateful ─────────────────────────────────
  const prevResult = useSimulationStore.getState().result
  const prevCum = prevResult
    ? wells.reduce((s, w) => s + cumulativeInjection(w.injectionRate, Math.max(0, year - 1), w.rampUpYears, w.rampDownYears, projectYears), 0)
    : 0
  const incrementalCum = Math.max(0, totalCum - prevCum)

  const trappingRate = 0.02
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
    co2Viscosity: visc_final,
    solubility,
    diffusion,
    solubilityTrapping,
    residualTrapping,
    mobilePlume,
    containmentProbability: Math.min(0.95, 0.5 + ntg * 0.3 + trappedFrac * 0.15),
    ift,
    p10: capacityP10,
    p50: totalCapacity,
    p90: capacityP90,
  }
}

let _raf = 0
let _startTime = 0
let _prevYear = -1
let _peakResult: SimulationResult | null = null

function animateFrame(ts: number) {
  const sim = useSimulationStore.getState()
  if (!sim.isAnimating) return
  if (!_startTime) _startTime = ts
  const elapsed = ts - _startTime
  const msPerYear = 2400 / sim.animationSpeed
  const projectYears = useUIStore.getState().projectYears
  const year = Math.min(projectYears, Math.floor(elapsed / msPerYear))

  if (year !== _prevYear) {
    _prevYear = year
    const params = useFormationStore.getState().params
    const wells = useFormationStore.getState().wells
    const newResult = computeYearly(params, year, projectYears)

    const totalRate = wells.reduce((s, w) => s + wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears), 0)

    if (totalRate > 0) {
      _peakResult = newResult
      sim.setResult(newResult)
    } else if (_peakResult) {
      sim.setResult(_peakResult)
    } else {
      sim.setResult(newResult)
    }

    useUIStore.getState().setTimestep(year)
  }

  if (year < projectYears) {
    _raf = requestAnimationFrame(animateFrame)
  } else {
    sim.stopAnimation()
    try { autoSaveProject() } catch { /* silent */ }
  }
}

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
  const fracPres = ((sv - pp) * POISSON / (1 - POISSON) + pp) * (1 + Math.tan(phiRad) * 0.15) * Math.max(0.85, 1 - (params.biotCoefficient - 0.4) * 0.12)

  // Estimated injection pressure using simplified Theis at year=1
  const totalRate = wells.reduce((s, w) => {
    const r = w.rampUpYears > 0 ? Math.min(1, 1 / w.rampUpYears) : 1
    return s + w.injectionRate * r
  }, 0)
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

  const dP = Math.max(0, (Q_m3s * visc) / (4 * Math.PI * perm_m2 * h) * e1)
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

  // MAIP
  const maip = Math.min(0.9 * fracPres, pp * 1.1 + 1.5 + params.caprockCohesion * 0.08)
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

// ── Auto-save helper (module-level so animateFrame + run can both call it) ──
function autoSaveProject() {
  try {
    const existingRaw = localStorage.getItem('carbonlens_projects')
    const projects: any[] = existingRaw ? JSON.parse(existingRaw) : []
    const fStore = useFormationStore.getState()
    const simStore = useSimulationStore.getState()
    const uiStore = useUIStore.getState()
    let proj = projects.find((p: any) => p.wells?.[0]?.id === fStore.wells[0]?.id)
    if (!proj) {
      proj = { ...createDefaultProject(), wells: [...fStore.wells], id: crypto.randomUUID() }
    }
    proj.formation = { ...fStore.params }
    proj.wells = [...fStore.wells]
    proj.simulationResult = simStore.result ? { ...simStore.result } : null
    proj.geomechanicsResult = simStore.geomechanics ? { ...simStore.geomechanics } : null
    proj.jurisdiction = uiStore.jurisdiction
    proj.updatedAt = Date.now()
    const idx = projects.findIndex((p: any) => p.id === proj.id)
    if (idx >= 0) projects[idx] = proj
    else projects.unshift(proj)
    localStorage.setItem('carbonlens_projects', JSON.stringify(projects))
  } catch { /* silent */ }
}

export function useSimulation() {
  const run = () => {
    const store = useSimulationStore.getState()
    if (store.isAnimating) return
    _prevYear = -1
    _startTime = 0
    _peakResult = null
    const params = useFormationStore.getState().params
    const wells = useFormationStore.getState().wells
    const projectYears = useUIStore.getState().projectYears

    const validation = validateGeomechanics(params, wells)
    store.setValidation(validation)
    const override = store.forceRun

    if (!validation.valid && !override) return

    store.setForceRun(false)
    store.runSimulation()
    store.setResult(computeYearly(params, 0, projectYears))
    store.startAnimation()
    useUIStore.getState().setTimestep(0)
    _raf = requestAnimationFrame(animateFrame)

    // ── Auto-save project ───────────────────────────────────────────────────
    try { autoSaveProject() } catch { /* silent */ }
  }

  const stop = () => {
    cancelAnimationFrame(_raf)
    _raf = 0
    useSimulationStore.getState().stopAnimation()
    try { autoSaveProject() } catch { /* silent */ }
  }

  return { runAnimation: run, stopAnimation: stop }
}
