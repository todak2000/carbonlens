import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { AlertTriangle, CheckCircle, AlertCircle, ArrowUp, Gauge, Zap, Drill, Activity, Brain, Shield, ChevronRight } from 'lucide-react'
import { computeWellboreDiagnostics, DEFAULT_WELLBORE } from '../../engine/plume/wellboreModel'
import { assessFaultReactivation } from '../../engine/plume/faultReactivation'
import type { FaultGeometry, StressState, FaultRockProperties } from '../../engine/plume/faultReactivation'
import { autoOptimizeWells } from '../../utils/autoOptimize'
import { computeCaprockSealCapacity } from '../../engine/classical/caprockSealCapacity'

const POISSON = 0.30
const OG = 0.023
const K0 = 0.82

interface MohrData {
  sv: number; s3: number; pp: number; dp: number; alpha: number
  phiDeg: number; cohesion: number; sigmaM_init: number; sigmaM_curr: number
  radius: number; safetyMargin: number; dcff: number; failed: boolean
}

function computeMohr(sv: number, s3: number, pp: number, dp: number, alpha: number, phiDeg: number, C: number): MohrData {
  // Ensure principal stress ordering: σ₁ ≥ σ₃ so deviatoric radius is always ≥ 0.
  // When Sh > Sv (thrust regime), swap so the Mohr circle is valid.
  const s1 = Math.max(sv, s3)
  const s3eff = Math.min(sv, s3)
  const phi = phiDeg * Math.PI / 180
  const mu = Math.tan(phi)
  const sm_init = (s1 + s3eff) / 2 - alpha * pp
  const sm_curr = sm_init - alpha * dp
  const R = (s1 - s3eff) / 2
  const safety = C + sm_curr * mu - R
  return { sv: s1, s3: s3eff, pp, dp, alpha, phiDeg, cohesion: C, sigmaM_init: sm_init, sigmaM_curr: sm_curr, radius: R, safetyMargin: safety, dcff: mu * dp, failed: safety < 0 }
}

function estimateInjPressure(params: { pressure: number; porosity: number; permeability: number; thickness: number }, wells: { injectionRate: number; rampUpYears: number; rampDownYears: number }[]): number {
  // Use full injection rate (no ramp factor) — this is the PEAK pressure the formation must handle.
  // Using a ramp-reduced year-1 rate would give an artificially low ΔP, understating the risk.
  const totalRate = wells.reduce((s, w) => s + w.injectionRate, 0)
  if (totalRate <= 0) return params.pressure
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
  const dP_Pa = Math.max(0, (Q_m3s * visc) / (4 * Math.PI * perm_m2 * h) * e1)
  const dP = dP_Pa / 1e6  // convert Pa → MPa (Theis gives Pa; pressure is in MPa)
  return params.pressure + Math.min(25, dP)
}

function drawMC(canvas: HTMLCanvasElement, d: MohrData, isDark: boolean) {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const W = Math.round(rect.width * dpr)
  const H = Math.round(rect.height * dpr)
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const w = rect.width, h = rect.height, pl = 50, pr = 20, pt = 20, pb = 30
  const xMax = d.sv * 1.15, yMax = xMax * 0.6
  const pw = w - pl - pr, ph = h - pt - pb
  const toX = (v: number) => pl + (v / xMax) * pw
  const toY = (v: number) => pt + ph - (v / yMax) * ph
  const bgC = isDark ? '#0f1118' : '#f1f3f6'
  const gridC = isDark ? '#1a1d2e' : '#d6dce6'
  const textC = isDark ? '#6b7280' : '#4b5563'
  const iniC = isDark ? '#3b82f6' : '#2563eb'
  const curC = isDark ? '#f59e0b' : '#d97706'
  const failC = isDark ? '#ef4444' : '#dc2626'
  const safeC = isDark ? '#22c55e' : '#16a34a'
  const annoC = isDark ? '#8b5cf6' : '#7c3aed'
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = bgC
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = gridC
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 5; i++) {
    const x = pl + (i / 5) * pw; ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pt + ph); ctx.stroke()
    const y = pt + (i / 5) * ph; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + pw, y); ctx.stroke()
  }
  ctx.fillStyle = textC
  ctx.font = '9px monospace'
  ctx.textAlign = 'center'
  for (let i = 0; i <= 5; i++) ctx.fillText((i / 5 * xMax).toFixed(0), toX(i / 5 * xMax), h - 6)
  ctx.save(); ctx.translate(12, pt + ph / 2); ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = textC; ctx.font = '9px monospace'; ctx.textAlign = 'center'
  ctx.fillText("Shear τ (MPa)", 0, 0); ctx.restore()
  ctx.fillStyle = textC; ctx.font = '9px monospace'; ctx.textAlign = 'center'
  ctx.fillText("Effective normal stress σ' (MPa)", pl + pw / 2, h - 1)

  const phi = d.phiDeg * Math.PI / 180
  const tau0 = d.cohesion
  const tauMax = Math.min(yMax, d.cohesion + xMax * Math.tan(phi))
  ctx.strokeStyle = failC
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.beginPath(); ctx.moveTo(toX(0), toY(tau0)); ctx.lineTo(toX(xMax), toY(tauMax)); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = failC; ctx.font = '7px monospace'; ctx.textAlign = 'right'
  ctx.fillText(`τ=C+σ'·tan(${d.phiDeg}°)`, pl + pw - 4, toY(tauMax) - 4)
  ctx.beginPath(); ctx.arc(toX(0), toY(tau0), 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.textAlign = 'left'; ctx.fillText(`C=${d.cohesion.toFixed(1)}`, toX(0) + 4, toY(tau0) + 3)

  const icX = toX(d.sigmaM_init); const icY = toY(0)
  const icR = Math.max(0, (d.radius / xMax) * pw)
  ctx.strokeStyle = iniC; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5
  ctx.beginPath(); ctx.arc(icX, icY, icR, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
  ctx.fillStyle = iniC; ctx.beginPath(); ctx.arc(icX, icY, 2, 0, Math.PI * 2); ctx.fill()

  const ccX = toX(d.sigmaM_curr)
  ctx.strokeStyle = curC; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(ccX, icY, icR, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = curC; ctx.beginPath(); ctx.arc(ccX, icY, 2, 0, Math.PI * 2); ctx.fill()

  const s3v = d.sigmaM_curr - d.radius; const s1v = d.sigmaM_curr + d.radius
  ctx.fillStyle = curC; ctx.font = '8px monospace'; ctx.textAlign = 'center'
  ctx.beginPath(); ctx.arc(toX(s3v), icY, 3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(toX(s1v), icY, 3, 0, Math.PI * 2); ctx.fill()
  ctx.fillText("σ₃'", toX(s3v), icY + 14); ctx.fillText("σ₁'", toX(s1v), icY + 14)

  const s3i = d.sigmaM_init - d.radius; const s1i = d.sigmaM_init + d.radius
  ctx.fillStyle = iniC; ctx.font = '7px monospace'; ctx.textAlign = 'center'
  ctx.fillText("σ₃'₀", toX(s3i), icY - 12); ctx.fillText("σ₁'₀", toX(s1i), icY - 12)

  if (!d.failed) {
    const cy = icY - icR; const tauE = d.cohesion + d.sigmaM_curr * Math.tan(phi); const ey = toY(tauE)
    ctx.strokeStyle = safeC; ctx.lineWidth = 1; ctx.setLineDash([3, 2])
    ctx.beginPath(); ctx.moveTo(ccX, cy); ctx.lineTo(ccX, ey); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = safeC
    ctx.beginPath(); ctx.moveTo(ccX - 3, ey - 6); ctx.lineTo(ccX, ey); ctx.lineTo(ccX + 3, ey - 6); ctx.fill()
    ctx.font = '7px monospace'; ctx.textAlign = 'left'
    ctx.fillText(`SF=${d.safetyMargin.toFixed(2)}`, ccX + 5, (cy + ey) / 2 + 3)
  }

  const lx = pl + 6, ly = pt + 6
  ctx.font = '8px monospace'
  ctx.fillStyle = iniC; ctx.fillRect(lx, ly, 8, 2); ctx.fillStyle = textC; ctx.fillText('Initial', lx + 12, ly + 4)
  ctx.fillStyle = curC; ctx.fillRect(lx, ly + 12, 8, 2); ctx.fillStyle = textC; ctx.fillText('Current', lx + 12, ly + 16)
  ctx.strokeStyle = failC; ctx.setLineDash([4, 3])
  ctx.beginPath(); ctx.moveTo(lx, ly + 24); ctx.lineTo(lx + 8, ly + 24); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = textC; ctx.fillText('Failure', lx + 12, ly + 28)

  ctx.strokeStyle = annoC; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(icX, icY + icR + 14); ctx.lineTo(ccX, icY + icR + 14); ctx.stroke()
  ctx.fillStyle = annoC; ctx.font = '7px monospace'; ctx.textAlign = 'center'
  ctx.fillText('-α·ΔP', (icX + ccX) / 2, icY + icR + 24)
}

export default function GeomechanicsPanel() {
  const params = useFormationStore((s) => s.params)
  const setParams = useFormationStore((s) => s.setParams)
  const wells = useFormationStore((s) => s.wells)
  const setWells = useFormationStore((s) => s.setWells)
  const simResult = useSimulationStore((s) => s.result)
  const setGeomechanics = useSimulationStore((s) => s.setGeomechanics)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ── Caprock Seal Capacity local state ────────────────────────────────────
  const [caprockPoreThroatNm, setCaprockPoreThroatNm] = useState(20)
  const [contactAngleDeg, setContactAngleDeg] = useState(0)

  const depth = params.depth
  const pp = params.pressure
  const _poisson = params.poissonRatio ?? POISSON
  const _og      = params.overburdenGradient ?? OG
  const _k0      = params.stressRatioK0 ?? K0
  const sv = depth * _og
  const sh = sv * _k0

  const estP = estimateInjPressure(params, wells)
  const simP = simResult?.injectionPressure ?? null
  const injPres = estP
  const dp = Math.max(0, injPres - pp)

  const mData = useMemo(() => computeMohr(sv, sh, pp, dp, params.biotCoefficient, params.caprockFriction, params.caprockCohesion),
    [sv, sh, pp, dp, params.biotCoefficient, params.caprockFriction, params.caprockCohesion])

  const theme = useUIStore((s) => s.theme)
  const setPanel = useUIStore((s) => s.setPanel)
  const draw = useCallback(() => {
    if (canvasRef.current) drawMC(canvasRef.current, mData, theme === 'dark')
  }, [mData, theme])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [draw])

  const fracPres = useMemo(() => {
    const baseFrac = (depth * _og - pp) * _poisson / (1 - _poisson) + pp
    const phiRad = params.caprockFriction * Math.PI / 180
    const frictionBoost = 1 + Math.tan(phiRad) * 0.15
    const alphaPenalty = 1 - (params.biotCoefficient - 0.4) * 0.12
    // Floor at σh: when K0 > ν/(1-ν), H-W formula gives fracture P < σh which is
    // physically inconsistent — hydraulic fracture requires exceeding min. principal stress.
    return Math.max(baseFrac * frictionBoost * Math.max(0.85, alphaPenalty), sh)
  }, [depth, pp, params.caprockFriction, params.biotCoefficient, sh, _og, _poisson])

  // MAIP = 90% of fracture pressure (Hubbert-Willis / regulatory standard).
  // The old pp*1.1+1.5 secondary cap was ≈10% headroom — far too tight for CCS
  // operations (Sleipner injects at 50%+ above pp). Removed.
  const maip = useMemo(() => 0.9 * fracPres, [fracPres])

  const maipMargin = (maip - injPres) / maip * 100
  // Theis pressure-front radius over 20-yr horizon — brine diffusivity (far-field carrier)
  // Uses brine viscosity ~6e-4 Pa·s (not CO2 viscosity) and correct mD→m² factor 9.869e-16
  const presFrontR = Math.sqrt(4 * params.permeability * 9.869e-16 * 86400 * 365 * 20 / (params.porosity * 6e-4 * 1e-9)) / 1000

  const heaveM = useMemo(() => {
    if (!simResult) return null
    const dP_Pa = (injPres - pp) * 1e6
    const rho = simResult.co2Density || 700
    const V = simResult.storageCapacity * 1e9 / rho
    const E_gpa = params.reservoirYoungsModulus ?? 5
    const fracCompliance = params.fracturedReservoir ? 0.20 : 1.0
    const E_eff = E_gpa * fracCompliance * 1e9
    return Math.max(0, 2 / Math.PI * (1 - 0.25 * 0.25) * dP_Pa * V / (E_eff * Math.max(100, depth) ** 2))
  }, [simResult, injPres, pp, depth, params.reservoirYoungsModulus, params.fracturedReservoir])

  const capDepth = depth - Math.max(20, depth * 0.07)
  const capPP = pp * capDepth / depth
  const capOB = capDepth * _og
  const capPhiRad = params.caprockFriction * Math.PI / 180
  const capFrictionScale = 1 + Math.tan(capPhiRad) * 0.12
  const capAlphaScale = 1 - (params.biotCoefficient - 0.4) * 0.1
  const capFrac = ((capOB - capPP) * _poisson / (1 - _poisson) + capPP) * capFrictionScale * Math.max(0.88, capAlphaScale)
  const capInteg = injPres / Math.max(0.1, capFrac)
  const capOK = capInteg < 0.85
  const capWarn = capInteg >= 0.85 && capInteg < 1.0
  const sf = fracPres / Math.max(0.1, injPres)

  const seisRisk: 'low' | 'moderate' | 'high' = sf > 1.5 ? 'low' : sf > 1.2 ? 'moderate' : 'high'
  const slipPot = Math.min(1, Math.max(0, (injPres - pp) / (fracPres - pp) * (1 - params.biotCoefficient * 0.3)))

  // ── Caprock Seal Capacity (Leverett 1941) ────────────────────────────────────
  const sealCapacity = useMemo(() => {
    const iftMNm = simResult?.ift != null ? simResult.ift : 28
    const co2DensityKgm3 = simResult?.co2Density ?? 700
    const brineDensityKgm3 = simResult?.brineDensity ?? 1020
    const currentColumnHeightM = simResult?.plumeHeight ?? 0
    return computeCaprockSealCapacity({
      iftMNm,
      caprockPoreThroatNm,
      contactAngleDeg,
      co2DensityKgm3,
      brineDensityKgm3,
      formationAreaKm2: params.area,
      caprockPorosityFraction: 0.05,
      currentColumnHeightM,
    })
  }, [simResult, caprockPoreThroatNm, contactAngleDeg, params.area])

  // ── Wellbore Diagnostics (Peaceman 1978) ────────────────────────────────────
  const wellboreDx = useMemo(() => {
    // Estimate grid cell width from area: assume square grid ~20 cells per side
    return Math.sqrt(params.area * 1e6) / 20
  }, [params.area])

  const wellboreResult = useMemo(() => {
    const totalRate = wells.reduce((s, w) => s + w.injectionRate, 0)
    const rate = totalRate > 0 ? totalRate / Math.max(1, wells.length) : 0.5
    const co2Density = simResult?.co2Density ?? 700
    const mu_Pas = 5e-5  // approx supercritical CO2 viscosity
    return computeWellboreDiagnostics(
      DEFAULT_WELLBORE, params.permeability, wellboreDx, mu_Pas,
      params.pressure, rate, co2Density, params.depth,
    )
  }, [params.permeability, params.pressure, params.depth, wells, simResult, wellboreDx])

  // ── Fault Reactivation Risk (Mohr-Coulomb 3D, Streit & Hillis 2004) ─────────
  const faultReactivation = useMemo(() => {
    // Default to a critically-oriented normal fault (dip 60°) — worst-case screening
    const fault: FaultGeometry = { strike_deg: 0, dip_deg: 60, dipDirection_deg: 90 }
    const stress: StressState = {
      depth_m: params.depth,
      rockDensity_kgm3: 2300,
      Sh_SvRatio: K0,
      SH_ShRatio: 1.2,
      SH_azimuth_deg: 90,
      initialPorePressure_MPa: params.pressure,
      biotCoefficient: params.biotCoefficient,
    }
    const rock: FaultRockProperties = {
      frictionCoeff: Math.tan(params.caprockFriction * Math.PI / 180),
      cohesion_MPa: 0,  // residual cohesion for reactivation
    }
    return assessFaultReactivation(fault, stress, rock, pp + dp)
  }, [params.depth, params.pressure, params.biotCoefficient, params.caprockFriction, pp, dp])

  // ── Unified geomechanics status — binding constraint analysis ───────────────
  const geoChecks = useMemo(() => {
    const mu = Math.tan(params.caprockFriction * Math.PI / 180)
    // Mohr-Coulomb: max ΔP before safetyMargin reaches 0
    // safetyMargin = C + (sigmaM_init - alpha*dp)*mu - R = 0 → dp_max = (C + sigmaM_init*mu - R)/(alpha*mu)
    const mohrDpMax = mu > 0
      ? (params.caprockCohesion + mData.sigmaM_init * mu - mData.radius) / (params.biotCoefficient * mu)
      : Infinity
    const mohrCeiling = pp + Math.max(0, mohrDpMax)

    const items: {
      id: string; label: string; ceiling: number
      ok: boolean; detail: string; fix: string
    }[] = [
      {
        id: 'maip', label: 'MAIP',
        ceiling: maip,
        ok: injPres <= maip,
        detail: `${injPres.toFixed(1)} MPa / limit ${maip.toFixed(1)} MPa`,
        fix: 'Lower injection rate, or increase cohesion to raise MAIP',
      },
      {
        id: 'caprock', label: 'Caprock Seal',
        ceiling: capFrac * 0.85,
        ok: capOK,
        detail: `ratio ${capInteg.toFixed(3)} / threshold 0.85`,
        fix: 'Increase friction angle or cohesion to raise caprock fracture pressure',
      },
      {
        id: 'sf', label: 'Safety Factor',
        ceiling: fracPres / 1.2,
        ok: sf >= 1.2,
        detail: `SF ${sf.toFixed(2)} / min 1.20`,
        fix: 'Reduce rate — SF = fracPres / injPres must stay ≥ 1.2',
      },
      {
        id: 'mohr', label: 'Mohr-Coulomb',
        ceiling: mohrCeiling,
        ok: !mData.failed,
        detail: `margin ${mData.safetyMargin.toFixed(2)} MPa`,
        fix: 'Increase friction angle or cohesion so τ-envelope sits above stress circle',
      },
      {
        id: 'seismicity', label: 'Seismicity',
        ceiling: fracPres / 1.5,
        ok: seisRisk === 'low',
        detail: `SF ${sf.toFixed(2)} / min 1.50`,
        fix: 'Reduce rate until SF > 1.5 (= fracPres / injPres)',
      },
      {
        id: 'fault', label: 'Fault Reactivation',
        ceiling: pp + faultReactivation.criticalPressureIncrease_MPa,
        ok: faultReactivation.reactivationRisk !== 'critical' && faultReactivation.reactivationRisk !== 'high',
        detail: `crit ΔP ${faultReactivation.criticalPressureIncrease_MPa > 50 ? '>50' : faultReactivation.criticalPressureIncrease_MPa.toFixed(1)} MPa`,
        fix: 'Reduce ΔP below critical threshold, or adjust fault orientation in Geology panel',
      },
    ]

    const allOk = items.every((c) => c.ok)
    const failing = items.filter((c) => !c.ok)
    // binding = lowest safe pressure ceiling among all checks
    const binding = items.reduce((min, c) => c.ceiling < min.ceiling ? c : min, items[0])

    return { items, allOk, failing, binding }
  }, [pp, injPres, maip, capFrac, capInteg, capOK, fracPres, sf, mData, seisRisk, faultReactivation,
      params.caprockFriction, params.caprockCohesion, params.biotCoefficient])

  // ── Parameter guidance for when checks fail ──────────────────────────────────
  const paramGuidance = useMemo(() => {
    if (geoChecks.allOk) return null
    const maxDP = Math.max(0.01, geoChecks.binding.ceiling - pp)
    const Q1mt = 1e9 / (700 * 365.25 * 24 * 3600)
    const perm_m2 = params.permeability * 9.869e-16
    const alpha = perm_m2 / (params.porosity * 5e-5 * 1e-9)
    const u = 0.01 / (4 * alpha * 365.25 * 24 * 3600)
    const e1 = u <= 1
      ? Math.max(0.1, -0.5772156649 - Math.log(Math.max(u, 1e-300)) + u)
      : Math.exp(-u) * (u * u + 2.334733 * u + 0.250621) / (u * u + 3.330657 * u + 1.681534)
    const maxDP_Pa = maxDP * 1e6
    const kMin_mD = Math.max(1, ((Q1mt * 5e-5 * e1) / (4 * Math.PI * params.thickness * maxDP_Pa)) / 9.869e-16)
    const hMin_m = Math.max(1, (Q1mt * 5e-5 * e1) / (4 * Math.PI * perm_m2 * maxDP_Pa))
    const needsMore = kMin_mD > params.permeability * 1.05
    return { maxDP, kMin_mD, hMin_m, needsMore }
  }, [geoChecks.allOk, geoChecks.binding, pp, params.permeability, params.porosity, params.thickness])

  useEffect(() => {
    setGeomechanics({
      capRockStress: capFrac * 0.85, fracturePressure: fracPres, safetyFactor: sf,
      inducedSeismicityRisk: seisRisk, faultSlipPotential: slipPot, surfaceHeave: heaveM ?? 0,
      mohrSafetyMargin: mData.safetyMargin, dcff: mData.dcff,
      frictionAngle: params.caprockFriction, cohesion: params.caprockCohesion,
      biotCoefficient: params.biotCoefficient, overburdenStress: sv, minHorizontalStress: sh,
      mohrFailed: mData.failed, maip, maipMargin, pressureFrontRadius: presFrontR,
    })
  }, [capFrac, fracPres, sf, seisRisk, slipPot, heaveM, mData, params.caprockFriction, params.caprockCohesion, params.biotCoefficient, sv, sh, maip, maipMargin, presFrontR])

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme/20 pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider">Geomechanical Containment Safety</h1>
          <p className="text-xs text-muted font-mono mt-0.5">Stage 2: Target Aquifer &amp; Caprock Integrity Assessment</p>
        </div>
        <div className="flex items-center gap-2">
          {geoChecks.allOk ? (
            <span className="text-[10px] font-mono font-bold bg-success/15 text-success border border-success/40 px-3 py-1 rounded">
              ✓ PASS: 6 / 6 Constraints Safe
            </span>
          ) : (
            <span className="text-[10px] font-mono font-bold bg-error/15 text-error border border-error/40 px-3 py-1 rounded">
              ✕ ALERT: {geoChecks.failing.length} Failing Safety Limits
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Parameters (60% width equivalent: col-span-7) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Section 1: Capillary Sealing */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-theme/20 pb-2">
              <div className="flex items-center gap-1.5">
                <Shield size={13} className={sealCapacity.status === 'adequate' ? 'text-success' : sealCapacity.status === 'marginal' ? 'text-warning' : 'text-error'} />
                <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider">1. Capillary Seal Capacity</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                sealCapacity.status === 'adequate'     ? 'bg-success/10 text-success border-success/30'
                : sealCapacity.status === 'marginal'   ? 'bg-warning/10 text-warning border-warning/30'
                :                                        'bg-error/10 text-error border-error/30'
              }`}>
                {sealCapacity.status.toUpperCase()}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted font-mono flex justify-between mb-1.5">
                  <span>Pore throat radius (caprock)</span>
                  <span className="text-secondary font-bold">{caprockPoreThroatNm} nm</span>
                </label>
                <input type="range" min={1} max={500} step={1} value={caprockPoreThroatNm}
                  onChange={(e) => setCaprockPoreThroatNm(Number(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent" />
              </div>
              <div>
                <label className="text-xs text-muted font-mono flex justify-between mb-1.5">
                  <span>Contact angle (wetting state)</span>
                  <span className="text-secondary font-bold">{contactAngleDeg}°</span>
                </label>
                <input type="range" min={0} max={60} step={1} value={contactAngleDeg}
                  onChange={(e) => setContactAngleDeg(Number(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-2">
              <div className="rounded p-2 bg-tertiary/20 border border-theme/10">
                <span className="text-[9px] text-muted block uppercase">Entry Pressure</span>
                <span className="font-bold text-primary text-sm">{sealCapacity.entryPressureMPa.toFixed(3)} MPa</span>
              </div>
              <div className="rounded p-2 bg-tertiary/20 border border-theme/10">
                <span className="text-[9px] text-muted block uppercase">Max Containable Mass</span>
                <span className="font-bold text-primary text-sm">{sealCapacity.maxColumnMassMt.toFixed(2)} Mt</span>
              </div>
              <div className="rounded p-2 bg-tertiary/20 border border-theme/10 col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-muted block uppercase">Seal utilization</span>
                  <div className="font-bold text-primary mt-0.5 text-sm">{sealCapacity.sealUtilizationPct.toFixed(1)}%</div>
                </div>
                <div className="w-40 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${sealCapacity.sealUtilizationPct > 90 ? 'bg-error' : sealCapacity.sealUtilizationPct > 70 ? 'bg-warning' : 'bg-success'}`}
                    style={{ width: `${Math.min(100, sealCapacity.sealUtilizationPct)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Stress State Sliders */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-theme/20 pb-2">
              2. Mohr-Coulomb Mechanical Properties
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted font-mono flex justify-between mb-1.5">
                  <span>Friction Angle (φ)</span>
                  <span className="text-secondary font-bold">{params.caprockFriction}°</span>
                </label>
                <input type="range" min={15} max={45} step={0.5} value={params.caprockFriction}
                  onChange={(e) => setParams({ caprockFriction: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent" />
              </div>
              <div>
                <label className="text-xs text-muted font-mono flex justify-between mb-1.5">
                  <span>Cohesion (C)</span>
                  <span className="text-secondary font-bold">{params.caprockCohesion.toFixed(1)} MPa</span>
                </label>
                <input type="range" min={0} max={15} step={0.1} value={params.caprockCohesion}
                  onChange={(e) => setParams({ caprockCohesion: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent" />
              </div>
              <div>
                <label className="text-xs text-muted font-mono flex justify-between mb-1.5">
                  <span>Biot Coefficient (α)</span>
                  <span className="text-secondary font-bold">{params.biotCoefficient.toFixed(2)}</span>
                </label>
                <input type="range" min={0.4} max={1.0} step={0.01} value={params.biotCoefficient}
                  onChange={(e) => setParams({ biotCoefficient: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-2">
              <div className="rounded p-2 bg-tertiary/20 border border-theme/10">
                <span className="text-[9px] text-muted block uppercase">Overburden (Sv)</span>
                <span className="font-bold text-primary">{sv.toFixed(1)} MPa</span>
              </div>
              <div className="rounded p-2 bg-tertiary/20 border border-theme/10">
                <span className="text-[9px] text-muted block uppercase">Min Horizontal (Sh)</span>
                <span className="font-bold text-primary">{sh.toFixed(1)} MPa</span>
              </div>
            </div>
          </div>

          {/* Rate Optimizer Action */}
          {!geoChecks.allOk && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 space-y-3">
              <div className="text-sm font-mono font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <Brain size={14} /> Rate Containment Optimizer
              </div>
              <p className="text-xs font-mono text-secondary leading-normal">
                Planned rate: <strong>{wells.reduce((s, w) => s + w.injectionRate, 0).toFixed(2)} Mt/yr</strong> exceeds structural safety limits.
                Click below to calculate and apply the maximum geomechanically safe rate.
              </p>
              <button
                onClick={() => {
                  const nWells = Math.max(1, wells.length)
                  const opt = autoOptimizeWells(params, nWells, wells)
                  setWells(opt.wells)
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-accent text-white hover:bg-accent-hover font-mono font-bold text-xs transition shadow"
              >
                <Brain size={14} /> Scale Down to Safe Rate
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Visuals & Diagnostics (40% width equivalent: col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Mohr-Coulomb Chart */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider">Stress Analysis</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${mData.failed ? 'bg-error/10 border-error/30 text-error animate-pulse' : 'bg-success/10 border-success/30 text-success'}`}>
                {mData.failed ? 'SLIP FAILURE' : 'STABLE'}
              </span>
            </div>
            <canvas ref={canvasRef} className="w-full rounded-lg border border-theme/20 bg-page/50" style={{ minHeight: 250 }} />
          </div>

          {/* Unified Checks list */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
            <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider">Unified Verification</span>
            <div className="space-y-1.5">
              {geoChecks.items.map((c) => (
                <div key={c.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono border ${
                  c.ok ? 'bg-tertiary/10 border-theme/10 text-secondary' : 'bg-error/10 border-error/30 text-error font-semibold'
                }`}>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span>{c.ok ? '✓' : '✕'}</span>
                    <span>{c.label}</span>
                  </div>
                  <span className="min-w-0 text-right truncate">{c.detail}</span>
                </div>
              ))}
            </div>
            
            {!geoChecks.allOk && paramGuidance && (
              <div className="bg-tertiary/40 rounded p-2.5 space-y-1.5 border border-theme/20 text-xs font-mono">
                <div className="text-[10px] text-muted uppercase font-bold">Binding Constraint</div>
                <p className="text-secondary leading-relaxed">
                  Controlling margin is <span className="text-warning font-semibold">{geoChecks.binding.label}</span> (ceiling {geoChecks.binding.ceiling.toFixed(1)} MPa).
                </p>
                {paramGuidance.needsMore && (
                  <div className="text-[10px] text-accent/80 space-y-0.5 bg-page/40 p-1.5 rounded">
                    <div>· Permeability ≥ {paramGuidance.kMin_mD.toFixed(0)} mD</div>
                    <div>· Thickness ≥ {Math.ceil(paramGuidance.hMin_m)} m</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Diagnostics grid */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {/* Wellbore Diagnostics */}
            <div className="rounded-xl border border-theme/30 bg-card p-4 space-y-2 shadow-sm col-span-2">
              <div className="flex items-center justify-between border-b border-theme/20 pb-1.5">
                <span className="text-[10px] text-muted uppercase font-bold">Wellbore Diagnostics</span>
                <span className="text-[8px] text-muted/50">Peaceman (1978)</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div>BHP: <span className="text-secondary font-bold">{wellboreResult.bhp_MPa.toFixed(2)} MPa</span></div>
                <div>Injectivity Index: <span className="text-secondary font-bold">{wellboreResult.injectivityIndex_m3dMPa.toFixed(1)}</span></div>
                <div className="col-span-2">Max Sustainable: <span className="text-accent font-bold">{wellboreResult.maxSustainableRate_MtPerYear.toFixed(2)} Mt/yr</span></div>
              </div>
            </div>

            {/* Fault Reactivation */}
            <div className={`rounded-xl border p-4 space-y-2 shadow-sm col-span-2 ${
              faultReactivation.reactivationRisk === 'critical' ? 'border-error bg-error/5' :
              faultReactivation.reactivationRisk === 'high' ? 'border-warning bg-warning/5' :
              faultReactivation.reactivationRisk === 'moderate' ? 'border-warning bg-warning/5' :
              'border-success bg-success/5'
            }`}>
              <div className="flex items-center justify-between border-b border-theme/10 pb-1.5">
                <span className="text-[10px] text-muted uppercase font-bold">Fault Reactivation</span>
                <span className="text-[8px] text-muted/50">Streit &amp; Hillis (2004)</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div>Slip Tendency: <span className="text-secondary font-bold">{faultReactivation.slipTendency.toFixed(3)}</span></div>
                <div>Critical ΔP: <span className="text-secondary font-bold">{faultReactivation.criticalPressureIncrease_MPa.toFixed(1)} MPa</span></div>
                <div className="col-span-2">Risk Level: <span className="text-accent font-bold uppercase">{faultReactivation.reactivationRisk}</span></div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Proceed gate */}
      <div className="border-t border-theme mt-4 pt-3 px-4 pb-4">
        <button
          onClick={() => setPanel('screening')}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold font-mono transition bg-blue-600 hover:bg-blue-500 text-white shadow-md text-center leading-normal"
        >
          <ChevronRight size={14} className="shrink-0" />
          <span>Geomechanics Reviewed — Continue to Screening →</span>
        </button>
      </div>
    </div>
  )
}
