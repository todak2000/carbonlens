import { useMemo, useRef, useEffect, useCallback } from 'react'
import { Target } from 'lucide-react'
import { useFormationStore } from '../../store/formationStore'
import { useUIStore } from '../../store/uiStore'

function drawGauge(canvas: HTMLCanvasElement, score: number) {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const W = Math.round(rect.width * dpr)
  const H = Math.round(rect.height * dpr)
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const w = rect.width, h = rect.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0f1118'
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2, cy = h / 2 + 10, r = 80
  const arcStart = -0.75 * Math.PI, arcEnd = 0.75 * Math.PI
  const frac = Math.min(1, Math.max(0, score / 100))
  const angle = arcStart + frac * (arcEnd - arcStart)

  ctx.strokeStyle = '#1a1d2e'
  ctx.lineWidth = 16
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, r, arcStart, arcEnd); ctx.stroke()

  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy)
  grad.addColorStop(0, '#ef4444'); grad.addColorStop(0.5, '#f59e0b'); grad.addColorStop(1, '#22c55e')
  ctx.strokeStyle = grad
  ctx.lineWidth = 12
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, r, arcStart, angle); ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.font = `bold ${28 * dpr}px monospace`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(`${score.toFixed(0)}`, cx, cy - 4)

  ctx.fillStyle = frac < 0.3 ? '#ef4444' : frac < 0.6 ? '#f59e0b' : '#22c55e'
  ctx.font = `${7 * dpr}px monospace`
  ctx.fillText('SCREENING SCORE', cx, cy + 24)

  ctx.fillStyle = '#6b7280'
  ctx.font = `${8 * dpr}px monospace`
  ctx.fillText('Poor — Fair — Good', cx, h - 12)
}

export default function ScreeningPanel() {
  const params = useFormationStore((s) => s.params)
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const score = useMemo(() => {
    const depth = Math.min(1, Math.max(0, (params.depth - 800) / 2200))
    const isSC = params.temperature > 31 && params.pressure > 7.38
    const phase = isSC ? 1 : 0.5
    const porosityScore = Math.min(1, params.porosity / 0.3)
    const permScore = Math.min(1, params.permeability / 1500)
    const thickScore = Math.min(1, params.thickness / 200)
    const ntgScore = Math.min(1, params.netToGross)
    const reservoir = porosityScore * 0.3 + permScore * 0.3 + thickScore * 0.25 + ntgScore * 0.15
    const frictionScore = Math.min(1, params.caprockFriction / 40)
    const caprock = 0.5 + frictionScore * 0.5
    const storageScore = Math.min(1, Math.log(1 + params.area * params.thickness * params.porosity) / 12)

    const regulatoryScores: Record<string, number> = { US: 0.8, EU: 0.85, Norway: 0.9, Australia: 0.75, Malaysia: 0.65 }
    const regulatory = regulatoryScores[jurisdiction] ?? 0.7

    const overall = depth * 0.15 + phase * 0.15 + reservoir * 0.25 + caprock * 0.15 + storageScore * 0.2 + regulatory * 0.1
    return {
      depth: depth * 100, phase: phase * 100, reservoir: reservoir * 100, caprock: caprock * 100,
      storage: storageScore * 100, regulatory: regulatory * 100, overall: overall * 100,
    }
  }, [params, jurisdiction])

  const draw = useCallback(() => {
    if (canvasRef.current) drawGauge(canvasRef.current, score.overall)
  }, [score.overall])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [draw])

  return (
    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
        <Target size={13} /> Site Screening
      </h2>

      <div className="text-[8px] text-muted/50 font-mono">
        Jurisdiction: {jurisdiction} — sub-scores from formation + caprock properties
      </div>

      <canvas ref={canvasRef} className="w-full rounded border border-theme/30" style={{ minHeight: 210 }} />

      <div className="space-y-2">
        <SubScore label="Depth" value={score.depth} desc={`${params.depth} m`} />
        <SubScore label="Phase State" value={score.phase} desc={params.temperature > 31 && params.pressure > 7.38 ? 'Supercritical' : 'Subcritical'} />
        <SubScore label="Reservoir Quality" value={score.reservoir} desc={`φ=${(params.porosity * 100).toFixed(0)}%, k=${params.permeability} mD`} />
        <SubScore label="Caprock Quality" value={score.caprock} desc={`φ=${params.caprockFriction}°`} />
        <SubScore label="Storage Volume" value={score.storage} desc={`${(params.area * params.thickness * params.porosity / 1e9).toFixed(2)} km³ pore`} />
        <SubScore label="Regulatory ({jurisdiction})" value={score.regulatory} desc={`Based on ${jurisdiction} CCS framework`} />
      </div>

      <div className={`rounded px-2 py-2 border text-xs font-mono ${score.overall < 30 ? 'bg-red-900/20 border-red-500/40 text-red-300' : score.overall < 60 ? 'bg-amber-900/20 border-amber-500/40 text-amber-300' : 'bg-teal-900/20 border-teal-500/40 text-teal-300'}`}>
        <div className="flex justify-between items-center">
          <span className="uppercase tracking-wider text-[9px] opacity-70">Overall Score</span>
          <span className="text-lg font-bold">{score.overall.toFixed(0)} / 100</span>
        </div>
        <div className="w-full h-2 rounded-full bg-tertiary overflow-hidden mt-1">
          <div className={`h-full rounded-full transition-all ${score.overall < 30 ? 'bg-red-500' : score.overall < 60 ? 'bg-amber' : 'bg-teal'}`}
            style={{ width: `${score.overall}%` }} />
        </div>
        <p className="text-[9px] mt-1 opacity-70">
          {score.overall >= 70 ? 'Suitable for CCS development' : score.overall >= 50 ? 'Marginal — further study needed' : 'Poor — consider alternative sites'}
        </p>
      </div>
    </div>
  )
}

function SubScore({ label, value, desc }: { label: string; value: number; desc: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-muted">{label}</span>
        <span className={`font-bold ${value < 30 ? 'text-red-400' : value < 60 ? 'text-amber' : 'text-teal'}`}>{value.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1 rounded-full bg-tertiary overflow-hidden mt-0.5">
        <div className={`h-full rounded-full ${value < 30 ? 'bg-red-500' : value < 60 ? 'bg-amber' : 'bg-teal'}`}
          style={{ width: `${value}%` }} />
      </div>
      <span className="text-[8px] text-muted/60 font-mono">{desc}</span>
    </div>
  )
}
