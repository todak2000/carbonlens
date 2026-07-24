import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { Crosshair, Map, ShieldAlert, Sparkles } from 'lucide-react'
import { useFormationStore } from '../../store/formationStore'

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

function generateWells(area: number, density: number, formationDepth: number): { x: number; z: number; age: number; cementQuality: number; abandoned: boolean }[] {
  const count = Math.round(density * Math.sqrt(area) * 2)
  const half = Math.sqrt(area) / 2
  const wells: { x: number; z: number; age: number; cementQuality: number; abandoned: boolean }[] = []
  for (let i = 0; i < count; i++) {
    const seed = i * 7919 + area * 100
    const x = (seededRandom(seed) - 0.5) * 2 * half
    const z = (seededRandom(seed + 1) - 0.5) * 2 * half
    const depthFactor = Math.min(1, formationDepth / 3000)
    const age = 5 + seededRandom(seed + 2) * 70 * depthFactor
    const cementQuality = Math.max(0.1, 0.8 - age / 200 * (0.5 + depthFactor * 0.3))
    const abandoned = seededRandom(seed + 3) > 0.35
    wells.push({ x, z, age, cementQuality, abandoned })
  }
  return wells
}

function drawWellMap(canvas: HTMLCanvasElement, wells: { x: number; z: number; age: number; cementQuality: number; abandoned: boolean }[], injWells: { x: number; z: number }[]) {
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
  const w = rect.width, h = rect.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0f1118'
  ctx.fillRect(0, 0, w, h)

  const pad = 30, plotW = w - pad * 2, plotH = h - pad * 2, halfSpan = 5
  const toX = (v: number) => pad + (v + halfSpan) / (halfSpan * 2) * plotW
  const toZ = (v: number) => pad + (v + halfSpan) / (halfSpan * 2) * plotH

  ctx.strokeStyle = '#1a1d2e'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 4; i++) {
    const x = pad + (i / 4) * plotW
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + plotH); ctx.stroke()
    const y = pad + (i / 4) * plotH
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + plotW, y); ctx.stroke()
  }

  for (const w of wells) {
    const wx = toX(w.x), wz = toZ(w.z)
    if (wx < pad || wx > W - pad || wz < pad || wz > H - pad) continue
    const r = 2.5 + (1 - w.cementQuality) * 3
    const ageNrm = Math.min(1, w.age / 80)
    if (w.abandoned) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + ageNrm * 0.5})`
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(wx - r, wz - r); ctx.lineTo(wx + r, wz + r)
      ctx.moveTo(wx + r, wz - r); ctx.lineTo(wx - r, wz + r); ctx.stroke()
    } else {
      ctx.fillStyle = `rgba(251, 191, 36, ${0.5 + (1 - w.cementQuality) * 0.3})`
      ctx.beginPath(); ctx.arc(wx, wz, r, 0, Math.PI * 2); ctx.fill()
    }
  }

  for (const w of injWells) {
    const wx = toX(w.x), wz = toZ(w.z)
    ctx.fillStyle = '#22c55e'
    ctx.beginPath(); ctx.arc(wx, wz, 5, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#22c55e66'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(wx, wz, 10, 0, Math.PI * 2); ctx.stroke()
  }

  ctx.fillStyle = '#9ca3af'
  ctx.font = '9px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('✕ abandoned | ● active | ● inj. well', pad, h - 8)
}

export default function LeakagePanel() {
  const params = useFormationStore((s) => s.params)
  const wells = useFormationStore((s) => s.wells)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [wellDensity, setWellDensity] = useState(0.5)

  const injWellPositions = useMemo(() => wells.map(w => ({ x: (w.x - 0.5) * 8, z: (w.z - 0.5) * 8 })), [wells])

  const legacyWells = useMemo(() => generateWells(params.area, wellDensity, params.depth),
    [params.area, wellDensity, params.depth])

  const draw = useCallback(() => {
    if (canvasRef.current) drawWellMap(canvasRef.current, legacyWells, injWellPositions)
  }, [legacyWells, injWellPositions])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [draw])

  const riskScore = useMemo(() => {
    const nWells = legacyWells.length
    const maxDensity = Math.sqrt(params.area) * 2
    const densityFactor = Math.min(1, nWells / Math.max(1, maxDensity))
    const avgWellAge = nWells > 0
      ? legacyWells.reduce((s, w) => s + w.age, 0) / nWells
      : 0
    const ageFactor = Math.min(1, avgWellAge / 80)
    const avgCement = nWells > 0
      ? legacyWells.reduce((s, w) => s + w.cementQuality, 0) / nWells
      : 1
    const cementFactor = nWells > 0 ? 1 - avgCement : 0

    const depthFactor = Math.min(1, params.depth / 3000)

    const totalRate = wells.reduce((s, w) => s + w.injectionRate, 0)
    const perm_m2 = params.permeability * 9.869e-16
    const Q_m3s = totalRate * 1e9 / (700 * 365.25 * 24 * 3600)
    const alpha = perm_m2 / (params.porosity * 5e-5 * 1e-9)
    const u = 0.01 / (4 * alpha * 365.25 * 24 * 3600)
    const e1 = u <= 1
      ? Math.max(0, -0.5772156649 - Math.log(Math.max(u, 1e-300)) + u)
      : Math.exp(-u) * (u * u + 2.334733 * u + 0.250621) / (u * u + 3.330657 * u + 1.681534)
    const dP_MPa = ((Q_m3s * 5e-5) / (4 * Math.PI * perm_m2 * params.thickness) * e1) / 1e6
    const fracCeiling = Math.max(1, params.depth * 0.023 * 0.9)
    const injPFactor = nWells > 0 ? Math.min(1, dP_MPa / fracCeiling) : 0

    const score = Math.min(100,
      (densityFactor * 0.25 + ageFactor * 0.20 + cementFactor * 0.25 + depthFactor * 0.15 + injPFactor * 0.15) * 100
    )
    return { score, densityFactor, ageFactor, cementFactor, depthFactor, injPFactor, nWells, avgWellAge, avgCement }
  }, [legacyWells, params.depth, params.area, params.permeability, params.porosity, params.thickness, wells])

  const abandonCost = useMemo(() => {
    const nAbandoned = legacyWells.filter(w => w.abandoned).length
    const costPerWell = 0.3 + (1 - riskScore.avgCement) * 0.8 + params.depth * 0.0002
    return nAbandoned * costPerWell
  }, [legacyWells, riskScore.avgCement, params.depth])

  const wellCountLabel = Math.round(wellDensity * Math.sqrt(params.area) * 2)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme/20 pb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <Crosshair size={20} className="text-accent" /> Wellbore Leakage Risk Assessment
          </h1>
          <p className="text-xs text-muted font-mono mt-0.5">
            Evaluate legacy wellbore integrity and pathways within the Area of Review (AoR)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Controls and Risk factors (60% width equivalent: col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Controls Card */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2">
              Legacy Well density Tuning
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-mono text-secondary">
                <span>Orphan &amp; Legacy Well Density:</span>
                <span className="font-bold text-accent">{wellCountLabel} legacy wells</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={wellDensity}
                onChange={(e) => setWellDensity(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent" />
              <p className="text-xs text-muted leading-relaxed">
                Represents older exploration, production, or groundwater wells intersecting the Utsira-class caprock within the storage footprint area ({params.area} km²).
              </p>
            </div>
          </div>

          {/* Risk Factors Breakdown */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2">
              Risk Factors Breakdown
            </h3>
            <div className="space-y-3 text-xs font-mono">
              <FactorRow label="Well density" pct={riskScore.densityFactor * 100} />
              <FactorRow label="Well age" pct={riskScore.ageFactor * 100} />
              <FactorRow label="Cement degradation" pct={riskScore.cementFactor * 100} />
              <FactorRow label="Reservoir depth" pct={riskScore.depthFactor * 100} />
              <FactorRow label="Inj. pressure drive" pct={riskScore.injPFactor * 100} />
            </div>

            {riskScore.nWells === 0 ? (
              <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-xs text-success font-mono flex items-center gap-2">
                <Sparkles size={14} /> ✓ No legacy wells in the target storage area. Wellbore leakage risk is structurally zero.
              </div>
            ) : null}
          </div>

          {/* Remediation Cost Card */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2">
              Estimated Corrective Action Cost
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-mono font-bold text-accent">${abandonCost.toFixed(2)}M</span>
              <span className="text-xs text-muted font-mono ml-2">for {legacyWells.filter(w => w.abandoned).length} unplugged wells</span>
            </div>
            <p className="text-xs text-muted leading-normal font-mono">
              Total inventory: {riskScore.nWells} legacy wells in Area of Review · Average plug/abandonment: ${(0.3 + (1 - riskScore.avgCement) * 0.8 + params.depth * 0.0002).toFixed(2)}M per well.
            </p>
          </div>

        </div>

        {/* Right Column: Well Map Visuals (40% width equivalent: col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Well Map */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider">AoR Legacy Well Inventory Map</h3>
            <canvas ref={canvasRef} className="w-full rounded-lg border border-theme/20 bg-page/50" style={{ minHeight: 250 }} />
          </div>

          {/* Overall Leakage Risk Widget */}
          <div className={`rounded-xl border p-5 shadow-md text-xs font-mono ${
            riskScore.score < 30 ? 'bg-success/5 border-success/30 text-success' :
            riskScore.score < 60 ? 'bg-warning/5 border-warning/30 text-warning' :
            'bg-error/5 border-error/30 text-error'
          }`}>
            <div className="flex justify-between items-center border-b border-theme/10 pb-2 mb-2">
              <span className="uppercase tracking-wider font-bold">Overall Pathway Leakage Risk</span>
              <span className="text-lg font-bold">{riskScore.score.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mb-2">
              <div className={`h-full rounded-full transition-all ${
                riskScore.score < 30 ? 'bg-success' :
                riskScore.score < 60 ? 'bg-warning' :
                'bg-error'
              }`}
                style={{ width: `${riskScore.score}%` }} />
            </div>
            <p className="text-muted leading-normal text-[11px] font-sans">
              {riskScore.score < 30
                ? 'High storage integrity. Caprock seal properties are robust and legacy wells are well plugged or absent.'
                : riskScore.score < 60
                ? 'Marginal leakage pathways detected. Periodic monitoring via seismic/distributed temperature sensing is recommended.'
                : 'High leak pathway hazard. Legacy wells must be located, re-logged, and plugged before active injection commences.'}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

function FactorRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-secondary w-36 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${pct < 30 ? 'bg-success' : pct < 60 ? 'bg-warning' : 'bg-error'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-secondary w-8 text-right font-bold">{pct.toFixed(0)}%</span>
    </div>
  )
}
