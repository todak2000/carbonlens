import { useMemo, useRef, useEffect, useCallback } from 'react'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { AlertTriangle, CheckCircle, AlertCircle, ArrowUp, Gauge, Zap } from 'lucide-react'

const POISSON = 0.30
const OG = 0.023
const K0 = 0.82

interface MohrData {
  sv: number; s3: number; pp: number; dp: number; alpha: number
  phiDeg: number; cohesion: number; sigmaM_init: number; sigmaM_curr: number
  radius: number; safetyMargin: number; dcff: number; failed: boolean
}

function computeMohr(sv: number, s3: number, pp: number, dp: number, alpha: number, phiDeg: number, C: number): MohrData {
  const phi = phiDeg * Math.PI / 180
  const mu = Math.tan(phi)
  const sm_init = (sv + s3) / 2 - alpha * pp
  const sm_curr = sm_init - alpha * dp
  const R = (sv - s3) / 2
  const safety = C + sm_curr * mu - R
  return { sv, s3, pp, dp, alpha, phiDeg, cohesion: C, sigmaM_init: sm_init, sigmaM_curr: sm_curr, radius: R, safetyMargin: safety, dcff: mu * dp, failed: safety < 0 }
}

function estimateInjPressure(params: { pressure: number; porosity: number; permeability: number; thickness: number }, wells: { injectionRate: number; rampUpYears: number; rampDownYears: number }[]): number {
  const totalRate = wells.reduce((s, w) => {
    const r = w.rampUpYears > 0 ? Math.min(1, 1 / w.rampUpYears) : 1
    return s + w.injectionRate * r
  }, 0)
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
  const dP = Math.max(0, (Q_m3s * visc) / (4 * Math.PI * perm_m2 * h) * e1)
  return params.pressure + Math.min(25, dP)
}

function drawMC(canvas: HTMLCanvasElement, d: MohrData) {
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
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0f1118'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#1a1d2e'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 5; i++) {
    const x = pl + (i / 5) * pw; ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pt + ph); ctx.stroke()
    const y = pt + (i / 5) * ph; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + pw, y); ctx.stroke()
  }
  ctx.fillStyle = '#6b7280'
  ctx.font = '9px monospace'
  ctx.textAlign = 'center'
  for (let i = 0; i <= 5; i++) ctx.fillText((i / 5 * xMax).toFixed(0), toX(i / 5 * xMax), h - 6)
  ctx.save(); ctx.translate(12, pt + ph / 2); ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = '#6b7280'; ctx.font = '9px monospace'; ctx.textAlign = 'center'
  ctx.fillText("Shear τ (MPa)", 0, 0); ctx.restore()
  ctx.fillStyle = '#6b7280'; ctx.font = '9px monospace'; ctx.textAlign = 'center'
  ctx.fillText("Effective normal stress σ' (MPa)", pl + pw / 2, h - 1)

  const phi = d.phiDeg * Math.PI / 180
  const tau0 = d.cohesion
  const tauMax = Math.min(yMax, d.cohesion + xMax * Math.tan(phi))
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.beginPath(); ctx.moveTo(toX(0), toY(tau0)); ctx.lineTo(toX(xMax), toY(tauMax)); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#ef4444'; ctx.font = '7px monospace'; ctx.textAlign = 'right'
  ctx.fillText(`τ=C+σ'·tan(${d.phiDeg}°)`, pl + pw - 4, toY(tauMax) - 4)
  ctx.beginPath(); ctx.arc(toX(0), toY(tau0), 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.textAlign = 'left'; ctx.fillText(`C=${d.cohesion.toFixed(1)}`, toX(0) + 4, toY(tau0) + 3)

  const icX = toX(d.sigmaM_init); const icY = toY(0)
  const icR = (d.radius / xMax) * pw
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5
  ctx.beginPath(); ctx.arc(icX, icY, icR, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
  ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(icX, icY, 2, 0, Math.PI * 2); ctx.fill()

  const ccX = toX(d.sigmaM_curr)
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(ccX, icY, icR, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(ccX, icY, 2, 0, Math.PI * 2); ctx.fill()

  const s3v = d.sigmaM_curr - d.radius; const s1v = d.sigmaM_curr + d.radius
  ctx.fillStyle = '#f59e0b'; ctx.font = '8px monospace'; ctx.textAlign = 'center'
  ctx.beginPath(); ctx.arc(toX(s3v), icY, 3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(toX(s1v), icY, 3, 0, Math.PI * 2); ctx.fill()
  ctx.fillText("σ₃'", toX(s3v), icY + 14); ctx.fillText("σ₁'", toX(s1v), icY + 14)

  const s3i = d.sigmaM_init - d.radius; const s1i = d.sigmaM_init + d.radius
  ctx.fillStyle = '#3b82f6'; ctx.font = '7px monospace'; ctx.textAlign = 'center'
  ctx.fillText("σ₃'₀", toX(s3i), icY - 12); ctx.fillText("σ₁'₀", toX(s1i), icY - 12)

  if (!d.failed) {
    const cy = icY - icR; const tauE = d.cohesion + d.sigmaM_curr * Math.tan(phi); const ey = toY(tauE)
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1; ctx.setLineDash([3, 2])
    ctx.beginPath(); ctx.moveTo(ccX, cy); ctx.lineTo(ccX, ey); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = '#22c55e'
    ctx.beginPath(); ctx.moveTo(ccX - 3, ey - 6); ctx.lineTo(ccX, ey); ctx.lineTo(ccX + 3, ey - 6); ctx.fill()
    ctx.font = '7px monospace'; ctx.textAlign = 'left'
    ctx.fillText(`SF=${d.safetyMargin.toFixed(2)}`, ccX + 5, (cy + ey) / 2 + 3)
  }

  const lx = pl + 6, ly = pt + 6
  ctx.font = '8px monospace'
  ctx.fillStyle = '#3b82f6'; ctx.fillRect(lx, ly, 8, 2); ctx.fillStyle = '#9ca3af'; ctx.fillText('Initial', lx + 12, ly + 4)
  ctx.fillStyle = '#f59e0b'; ctx.fillRect(lx, ly + 12, 8, 2); ctx.fillStyle = '#9ca3af'; ctx.fillText('Current', lx + 12, ly + 16)
  ctx.strokeStyle = '#ef4444'; ctx.setLineDash([4, 3])
  ctx.beginPath(); ctx.moveTo(lx, ly + 24); ctx.lineTo(lx + 8, ly + 24); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = '#9ca3af'; ctx.fillText('Failure', lx + 12, ly + 28)

  ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(icX, icY + icR + 14); ctx.lineTo(ccX, icY + icR + 14); ctx.stroke()
  ctx.fillStyle = '#8b5cf6'; ctx.font = '7px monospace'; ctx.textAlign = 'center'
  ctx.fillText('-α·ΔP', (icX + ccX) / 2, icY + icR + 24)
}

export default function GeomechanicsPanel() {
  const params = useFormationStore((s) => s.params)
  const setParams = useFormationStore((s) => s.setParams)
  const wells = useFormationStore((s) => s.wells)
  const simResult = useSimulationStore((s) => s.result)
  const setGeomechanics = useSimulationStore((s) => s.setGeomechanics)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const depth = params.depth
  const pp = params.pressure
  const sv = depth * OG
  const sh = sv * K0

  const estP = estimateInjPressure(params, wells)
  const simP = simResult?.injectionPressure ?? null
  const injPres = estP
  const dp = Math.max(0, injPres - pp)

  const mData = useMemo(() => computeMohr(sv, sh, pp, dp, params.biotCoefficient, params.caprockFriction, params.caprockCohesion),
    [sv, sh, pp, dp, params.biotCoefficient, params.caprockFriction, params.caprockCohesion])

  const draw = useCallback(() => {
    if (canvasRef.current) drawMC(canvasRef.current, mData)
  }, [mData])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [draw])

  const fracPres = useMemo(() => {
    const baseFrac = (depth * OG - pp) * POISSON / (1 - POISSON) + pp
    const phiRad = params.caprockFriction * Math.PI / 180
    const frictionBoost = 1 + Math.tan(phiRad) * 0.15
    const alphaPenalty = 1 - (params.biotCoefficient - 0.4) * 0.12
    return baseFrac * frictionBoost * Math.max(0.85, alphaPenalty)
  }, [depth, pp, params.caprockFriction, params.biotCoefficient])

  const maip = useMemo(() => {
    const fracLimit = 0.9 * fracPres
    const cohesionBonus = params.caprockCohesion * 0.08
    const baseLimit = pp * 1.1 + 1.5 + cohesionBonus
    return Math.min(fracLimit, baseLimit)
  }, [fracPres, pp, params.caprockCohesion])

  const maipMargin = (maip - injPres) / maip * 100
  const presFrontR = Math.sqrt(4 * params.permeability * 1e-15 * 86400 * 365 * 20 / (params.porosity * 5e-5 * 1e-9 * 2.25)) / 1000

  const heaveM = useMemo(() => {
    if (!simResult) return null
    const dP_Pa = (injPres - pp) * 1e6
    const rho = simResult.co2Density || 700
    const V = simResult.storageCapacity * 1e9 / rho
    return Math.max(0, 2 / Math.PI * (1 - 0.25 * 0.25) * dP_Pa * V / (5e9 * Math.max(100, depth) ** 2))
  }, [simResult, injPres, pp, depth])

  const capDepth = depth - Math.max(20, depth * 0.07)
  const capPP = pp * capDepth / depth
  const capOB = capDepth * OG
  const capPhiRad = params.caprockFriction * Math.PI / 180
  const capFrictionScale = 1 + Math.tan(capPhiRad) * 0.12
  const capAlphaScale = 1 - (params.biotCoefficient - 0.4) * 0.1
  const capFrac = ((capOB - capPP) * POISSON / (1 - POISSON) + capPP) * capFrictionScale * Math.max(0.88, capAlphaScale)
  const capInteg = injPres / Math.max(0.1, capFrac)
  const capOK = capInteg < 0.85
  const capWarn = capInteg >= 0.85 && capInteg < 1.0
  const sf = fracPres / Math.max(0.1, injPres)

  const seisRisk: 'low' | 'moderate' | 'high' = sf > 1.5 ? 'low' : sf > 1.2 ? 'moderate' : 'high'
  const slipPot = Math.min(1, Math.max(0, (injPres - pp) / (fracPres - pp) * (1 - params.biotCoefficient * 0.3)))

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
    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider">Geomechanics</h2>

      {/* Mohr-Coulomb Canvas */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1">Mohr-Coulomb Failure</h3>
        <canvas ref={canvasRef} className="w-full rounded border border-theme/30" style={{ minHeight: 270 }} />
      </div>

      {/* Mohr Controls */}
      <div className="space-y-2 bg-tertiary/30 rounded p-2 border border-theme/20">
        <div>
          <label className="text-[9px] text-muted font-mono flex justify-between">
            <span>Friction Angle</span><span>{params.caprockFriction}°</span>
          </label>
          <input type="range" min={15} max={45} step={0.5} value={params.caprockFriction}
            onChange={(e) => setParams({ caprockFriction: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-full accent-amber bg-tertiary appearance-none cursor-pointer" />
        </div>
        <div>
          <label className="text-[9px] text-muted font-mono flex justify-between">
            <span>Cohesion</span><span>{params.caprockCohesion.toFixed(1)} MPa</span>
          </label>
          <input type="range" min={0} max={15} step={0.1} value={params.caprockCohesion}
            onChange={(e) => setParams({ caprockCohesion: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-full accent-amber bg-tertiary appearance-none cursor-pointer" />
        </div>
        <div>
          <label className="text-[9px] text-muted font-mono flex justify-between">
            <span>Biot Coeff.</span><span>{params.biotCoefficient.toFixed(2)}</span>
          </label>
          <input type="range" min={0.4} max={1.0} step={0.01} value={params.biotCoefficient}
            onChange={(e) => setParams({ biotCoefficient: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-full accent-amber bg-tertiary appearance-none cursor-pointer" />
        </div>
      </div>

      {/* Mohr Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded px-2 py-1.5 border text-[10px] font-mono ${mData.failed ? 'bg-red-900/30 border-red-500/40 text-red-300' : 'bg-teal-900/20 border-teal-500/40 text-teal-300'}`}>
          <span className="uppercase tracking-wider text-[8px] opacity-70">Status</span>
          <div className="mt-0.5 font-bold">{mData.failed ? 'FAILED' : 'Stable'}</div>
        </div>
        <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/30">
          <span className="text-[8px] text-muted font-mono uppercase tracking-wider">Safety Margin</span>
          <div className="text-[13px] font-mono font-bold text-primary">{mData.safetyMargin.toFixed(2)} MPa</div>
        </div>
        <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/30">
          <span className="text-[8px] text-muted font-mono uppercase tracking-wider">ΔCFF</span>
          <div className="text-[13px] font-mono font-bold text-primary">+{mData.dcff.toFixed(3)} MPa</div>
        </div>
        <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/30">
          <span className="text-[8px] text-muted font-mono uppercase tracking-wider">ΔP at well</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-mono font-bold text-primary">{dp.toFixed(2)} MPa</span>
            <span title="Estimated from current formation parameters"><Zap size={8} className="text-amber" /></span>
          </div>
          {simP !== null && Math.abs(simP - estP) > 0.01 && (
            <span className="text-[7px] text-muted/50 font-mono block">Sim result: {simP.toFixed(2)} MPa (stale)</span>
          )}
        </div>
      </div>

      {/* MAIP Section */}
      <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
        <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1"><Gauge size={11} /> Max. Allowable Injection Pressure</h3>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <div><span className="text-muted">MAIP</span><br /><span className="text-primary font-bold">{maip.toFixed(2)} MPa</span></div>
          <div><span className="text-muted">Wellbore P</span><br /><span className="text-primary font-bold">{injPres.toFixed(2)} MPa</span></div>
          <div className="col-span-2">
            <span className="text-muted">Margin to MAIP</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex-1 h-1.5 rounded-full bg-tertiary overflow-hidden">
                <div className={`h-full rounded-full transition-all ${maipMargin > 20 ? 'bg-teal' : maipMargin > 0 ? 'bg-amber' : 'bg-red-500'}`}
                  style={{ width: `${Math.max(0, Math.min(100, maipMargin))}%` }} />
              </div>
              <span className={`font-bold text-[11px] ${maipMargin > 20 ? 'text-teal' : maipMargin > 0 ? 'text-amber' : 'text-red-400'}`}>
                {maipMargin.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="col-span-2">
            <span className="text-muted">Pressure Front Radius</span>
            <span className="text-primary font-bold ml-2">{presFrontR < 1 ? '<1' : presFrontR.toFixed(1)} km</span>
          </div>
        </div>
        <p className="text-[8px] text-amber-400/60 mt-1 italic">
          {simP !== null
            ? `Based on current params — sim result ${simP.toFixed(2)} MPa differs (stale)`
            : 'Estimated from current formation parameters — run simulation for time-matched values'}
        </p>
      </div>

      {/* Fracture & Integrity */}
      <div className="space-y-1.5">
        <Row label="Fracture Pressure" value={`${fracPres.toFixed(1)} MPa`} />
        <Row label="Safety Factor" value={sf.toFixed(2)} />
        <Row label="Caprock Stress" value={`${capFrac.toFixed(1)} MPa`} />
      </div>

      <div className={`rounded px-2 py-1.5 border text-[10px] font-mono ${capOK ? 'bg-teal-900/20 border-teal-500/40 text-teal-300' : capWarn ? 'bg-amber-900/20 border-amber-500/40 text-amber-300' : 'bg-red-900/30 border-red-500/40 text-red-300'}`}>
        <span className="uppercase tracking-wider text-[8px] opacity-70">Caprock seal</span>
        <div className="mt-0.5">
          {capOK ? '✓ Intact' : capWarn ? '⚠ Approaching limit' : '✕ Exceeded'}
        </div>
      </div>

      {/* Seismicity */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1 flex items-center gap-1">
          {seisRisk === 'low' ? <CheckCircle size={11} className="text-teal" /> : seisRisk === 'moderate' ? <AlertCircle size={11} className="text-amber" /> : <AlertTriangle size={11} className="text-red-400" />}
          Seismicity Risk
        </h3>
        <div className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-mono ${seisRisk === 'low' ? 'bg-accent-subtle text-accent' : seisRisk === 'moderate' ? 'bg-amber/20 text-amber' : 'bg-red-900/30 text-red-400'}`}>
          {seisRisk === 'high' && <AlertTriangle size={13} />}
          {seisRisk.charAt(0).toUpperCase() + seisRisk.slice(1)}
        </div>
      </div>

      {/* Fault Slip */}
      <div className="space-y-1">
        <h3 className="text-[10px] text-muted font-mono">Fault Slip Potential</h3>
        <div className="w-full h-1.5 rounded-full bg-tertiary overflow-hidden">
          <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${slipPot * 100}%` }} />
        </div>
        <span className="text-[10px] text-muted font-mono">{(slipPot * 100).toFixed(1)}%</span>
      </div>

      {/* Surface Heave */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1 flex items-center gap-1">
          <ArrowUp size={11} className="text-muted" /> Surface Heave
        </h3>
        <div className="flex items-center justify-between bg-tertiary/50 rounded px-2 py-1.5 border border-theme/30">
          <div className="flex items-baseline gap-1">
            {heaveM !== null ? (
              <>
                <span className="text-[18px] font-mono font-bold text-accent">
                  {heaveM * 1000 < 0.01 ? '<0.01' : (heaveM * 1000).toFixed(3)}
                </span>
                <span className="text-[9px] text-muted font-mono">mm</span>
              </>
            ) : (
              <span className="text-[11px] text-muted/50 font-mono italic">Run simulation</span>
            )}
          </div>
          <span className="text-[7px] text-muted/60 font-mono text-right leading-tight max-w-[120px]">
            Nucleus-of-strain
          </span>
        </div>
      </div>

      {/* Stress state summary */}
      <div className="text-[8px] text-muted/50 font-mono space-y-0.5 pt-1 border-t border-theme/20">
        <div>S_v = {sv.toFixed(1)} MPa, S_h = {sh.toFixed(1)} MPa</div>
        <div>σ_m₀ = {mData.sigmaM_init.toFixed(1)} MPa → σ_m' = {mData.sigmaM_curr.toFixed(1)} MPa</div>
        <div>ΔP = {dp.toFixed(2)} MPa, α = {params.biotCoefficient.toFixed(2)}, μ = {Math.tan(mData.phiDeg * Math.PI / 180).toFixed(3)}</div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-[11px] text-muted font-mono">{label}</span><span className="text-[11px] text-secondary font-mono">{value}</span></div>
}
