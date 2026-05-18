import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { Crosshair, Map } from 'lucide-react'
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
    const r = 2 + (1 - w.cementQuality) * 3
    const ageNrm = Math.min(1, w.age / 80)
    if (w.abandoned) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + ageNrm * 0.5})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(wx - r, wz - r); ctx.lineTo(wx + r, wz + r)
      ctx.moveTo(wx + r, wz - r); ctx.lineTo(wx - r, wz + r); ctx.stroke()
    } else {
      ctx.fillStyle = `rgba(251, 191, 36, ${0.4 + (1 - w.cementQuality) * 0.3})`
      ctx.beginPath(); ctx.arc(wx, wz, r, 0, Math.PI * 2); ctx.fill()
    }
  }

  for (const w of injWells) {
    const wx = toX(w.x), wz = toZ(w.z)
    ctx.fillStyle = '#22c55e'
    ctx.beginPath(); ctx.arc(wx, wz, 4, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#22c55e66'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(wx, wz, 8, 0, Math.PI * 2); ctx.stroke()
  }

  ctx.fillStyle = '#6b7280'
  ctx.font = '7px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('× abandoned | ● active | ● inj. well', pad, H - 4)
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
    const avgWellAge = legacyWells.reduce((s, w) => s + w.age, 0) / Math.max(1, nWells)
    const ageFactor = Math.min(1, avgWellAge / 80)
    const avgCement = legacyWells.reduce((s, w) => s + w.cementQuality, 0) / Math.max(1, nWells)
    const cementFactor = 1 - avgCement

    const depthFactor = Math.min(1, params.depth / 3000)
    const score = (densityFactor * 0.3 + ageFactor * 0.25 + cementFactor * 0.25 + depthFactor * 0.2) * 100
    return { score, densityFactor, ageFactor, cementFactor, depthFactor, nWells, avgWellAge, avgCement }
  }, [legacyWells, params.depth])

  const abandonCost = useMemo(() => {
    const nAbandoned = legacyWells.filter(w => w.abandoned).length
    const costPerWell = 0.3 + (1 - riskScore.avgCement) * 0.8 + params.depth * 0.0002
    return nAbandoned * costPerWell
  }, [legacyWells, riskScore.avgCement, params.depth])

  const wellCountLabel = Math.round(wellDensity * Math.sqrt(params.area) * 2)

  return (
    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
        <Crosshair size={13} /> Leakage Risk
      </h2>

      <div className="text-[8px] text-muted/50 font-mono">
        {params.area}km² area, {params.depth}m deep — legacy well density scaled to area
      </div>

      {/* Legacy Well Map */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1 flex items-center gap-1"><Map size={11} /> Legacy Well Inventory</h3>
        <canvas ref={canvasRef} className="w-full rounded border border-theme/30" style={{ minHeight: 200 }} />
      </div>

      {/* Controls */}
      <div className="bg-tertiary/30 rounded p-2 border border-theme/20">
        <div>
          <label className="text-[9px] text-muted font-mono flex justify-between">
            <span>Well Density</span><span>{wellCountLabel} wells</span>
          </label>
          <input type="range" min={0} max={1} step={0.01} value={wellDensity}
            onChange={(e) => setWellDensity(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full accent-amber bg-tertiary appearance-none cursor-pointer" />
        </div>
      </div>

      {/* Risk Assessment */}
      <div className={`rounded px-2 py-1.5 border text-[10px] font-mono ${riskScore.score < 30 ? 'bg-teal-900/20 border-teal-500/40 text-teal-300' : riskScore.score < 60 ? 'bg-amber-900/20 border-amber-500/40 text-amber-300' : 'bg-red-900/30 border-red-500/40 text-red-300'}`}>
        <div className="flex justify-between items-center">
          <span className="uppercase tracking-wider text-[8px] opacity-70">Leakage Risk</span>
          <span className="text-[13px] font-bold">{riskScore.score.toFixed(0)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-tertiary overflow-hidden mt-1">
          <div className={`h-full rounded-full transition-all ${riskScore.score < 30 ? 'bg-teal' : riskScore.score < 60 ? 'bg-amber' : 'bg-red-500'}`}
            style={{ width: `${riskScore.score}%` }} />
        </div>
      </div>

      {/* Risk Factors */}
      <div className="space-y-1 text-[10px] font-mono">
        <FactorRow label="Well density" pct={riskScore.densityFactor * 100} />
        <FactorRow label="Well age" pct={riskScore.ageFactor * 100} />
        <FactorRow label="Cement degradation" pct={riskScore.cementFactor * 100} />
        <FactorRow label="Depth" pct={riskScore.depthFactor * 100} />
      </div>

      {/* Corrective Action Cost */}
      <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
        <h3 className="text-[10px] text-muted font-mono mb-1">Corrective Action Cost</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-mono font-bold text-accent">${abandonCost.toFixed(2)}M</span>
          <span className="text-[9px] text-muted font-mono">for {legacyWells.filter(w => w.abandoned).length} orphan wells</span>
        </div>
        <p className="text-[8px] text-muted/60 mt-1">
          {(riskScore.nWells)} legacy wells within AoR · ${(0.3 + (1 - riskScore.avgCement) * 0.8 + params.depth * 0.0002).toFixed(2)}M/well avg.
        </p>
      </div>
    </div>
  )
}

function FactorRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-tertiary overflow-hidden">
        <div className={`h-full rounded-full ${pct < 30 ? 'bg-teal' : pct < 60 ? 'bg-amber' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-secondary w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  )
}
