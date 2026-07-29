import { useMemo, useRef, useEffect, useCallback, useState } from 'react'
import { Target, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react'
import { useFormationStore } from '../../store/formationStore'
import { useUIStore } from '../../store/uiStore'
import { assessStorageScreening } from '../../engine/classical/storageScreening'
import type { ScreeningCriterion } from '../../engine/classical/storageScreening'

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

  const cx = w / 2, cy = h / 2 + 15, r = 85
  const arcStart = -0.75 * Math.PI, arcEnd = 0.75 * Math.PI
  const frac = Math.min(1, Math.max(0, score / 100))
  const angle = arcStart + frac * (arcEnd - arcStart)

  ctx.strokeStyle = '#1a1d2e'
  ctx.lineWidth = 18
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, r, arcStart, arcEnd); ctx.stroke()

  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy)
  grad.addColorStop(0, '#ef4444')
  grad.addColorStop(0.5, '#f59e0b')
  grad.addColorStop(1, '#22c55e')
  ctx.strokeStyle = grad
  ctx.lineWidth = 14
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy, r, arcStart, angle); ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.font = `bold ${32 * dpr}px monospace`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(`${score.toFixed(0)}`, cx, cy - 5)

  ctx.fillStyle = frac < 0.3 ? '#ef4444' : frac < 0.6 ? '#f59e0b' : '#22c55e'
  ctx.font = `${8 * dpr}px monospace`
  ctx.fillText('SCREENING SUITABILITY', cx, cy + 28)

  ctx.fillStyle = '#6b7280'
  ctx.font = `${8 * dpr}px monospace`
  ctx.fillText('Poor · Fair · Good', cx, h - 14)
}

function formatCriterionValue(c: ScreeningCriterion): string {
  const v = c.yourValue
  if (c.unit === 'fraction') return `${(v * 100).toFixed(1)}%`
  if (c.unit === 'mD') return `${v.toFixed(0)} mD`
  if (c.unit === 'm') return `${v.toFixed(0)} m`
  if (c.unit === 'MPa') return `${v.toFixed(2)} MPa`
  if (c.unit === 'km²') return `${v.toFixed(1)} km²`
  if (c.unit === 'kg/(s·MPa)') return `${v.toFixed(2)} kg/(s·MPa)`
  if (c.unit === '°C (T+P combined)') return `${v.toFixed(1)} °C`
  return `${v.toFixed(2)} ${c.unit}`
}

function StatusBadge({ status }: { status: 'green' | 'amber' | 'red' }) {
  const styles: Record<string, string> = {
    green: 'bg-success/15 text-success border-success/40',
    amber: 'bg-warning/15 text-warning border-warning/40',
    red:   'bg-error/15 text-error border-error/40',
  }
  const labels: Record<string, string> = { green: 'Pass', amber: 'Marginal', red: 'Fail' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-wider ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function CriterionRow({ criterion }: { criterion: ScreeningCriterion }) {
  const [expanded, setExpanded] = useState(false)
  const statusColor = criterion.status === 'green' ? 'text-success' : criterion.status === 'amber' ? 'text-warning' : 'text-error'

  return (
    <div className={`border-b border-theme/10 last:border-0 ${criterion.status === 'red' ? 'bg-error/5' : criterion.status === 'amber' ? 'bg-warning/5' : ''}`}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-tertiary/20 transition"
        style={{ minHeight: 38 }}
        onClick={() => setExpanded((x) => !x)}
      >
        <span className={`shrink-0 ${statusColor}`}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="flex-1 text-xs font-mono text-primary truncate">{criterion.name}</span>
        <span className="text-xs font-mono text-secondary shrink-0 mr-4 font-semibold">{formatCriterionValue(criterion)}</span>
        <span className="text-xs font-mono text-muted/60 shrink-0 hidden sm:block w-28 text-right truncate mr-4">{criterion.thresholdLabel.split(',')[0]}</span>
        <StatusBadge status={criterion.status} />
      </div>
      {expanded && (
        <div className="px-5 pb-3 space-y-1.5 text-xs font-sans">
          <p className="text-secondary/90 leading-relaxed font-mono">{criterion.description}</p>
          <p className={`font-mono leading-relaxed ${criterion.status === 'red' ? 'text-error/90' : criterion.status === 'amber' ? 'text-warning/90' : 'text-success/90'}`}>
            {criterion.note}
          </p>
          <p className="text-[10px] font-mono text-muted/50 italic">{criterion.reference}</p>
        </div>
      )}
    </div>
  )
}

export default function ScreeningPanel() {
  const params = useFormationStore((s) => s.params)
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const setPanel = useUIStore((s) => s.setPanel)
  const setStageComplete = useUIStore((s) => s.setStageComplete)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const screeningResult = useMemo(() => assessStorageScreening(params), [params])

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

    const regulatoryScores: Record<string, number> = {
      US: 0.8, EU: 0.85, Norway: 0.9, Australia: 0.75, Malaysia: 0.65,
      CA: 0.78, AE: 0.50, DZ: 0.38, NG: 0.32, ID: 0.42, EG: 0.38,
    }
    const regulatory = regulatoryScores[jurisdiction] ?? 0.7

    const overall = depth * 0.15 + phase * 0.15 + reservoir * 0.25 + caprock * 0.15 + storageScore * 0.2 + regulatory * 0.1
    return {
      depth: depth * 100, phase: phase * 100, reservoir: reservoir * 100, caprock: caprock * 100,
      storage: storageScore * 100, regulatory: regulatory * 100, overall: overall * 100,
    }
  }, [params, jurisdiction])

  const gaugeScore = screeningResult.score

  const draw = useCallback(() => {
    if (canvasRef.current) drawGauge(canvasRef.current, gaugeScore)
  }, [gaugeScore])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [draw])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme/20 pb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <Target size={20} className="text-accent" /> CCS Geological Storage Screening
          </h1>
          <p className="text-xs text-muted font-mono mt-0.5">
            Jurisdiction: {jurisdiction} · suitability indices evaluated against benchmark thresholds
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Criteria table (60% width equivalent: col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-theme/30 bg-card shadow-md overflow-hidden">
            <div className="px-4 py-3 bg-tertiary/20 border-b border-theme/20 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
                Bachu (2003) Storage Selection Criteria
              </span>
              <div className="flex items-center gap-2 text-xs font-mono font-bold">
                <span className="text-success">{screeningResult.totalPassed} PASS</span>
                <span className="text-muted/40">/</span>
                <span className="text-warning">{screeningResult.totalAmber} MARGINAL</span>
                <span className="text-muted/40">/</span>
                <span className="text-error">{screeningResult.totalFailed} FAIL</span>
              </div>
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-tertiary/10 border-b border-theme/10">
              <span className="w-4 shrink-0" />
              <span className="flex-1 text-[10px] font-mono text-muted/60 uppercase font-bold">Criterion</span>
              <span className="text-[10px] font-mono text-muted/60 shrink-0 mr-4 font-bold">Your Value</span>
              <span className="text-[10px] font-mono text-muted/60 shrink-0 hidden sm:block w-28 text-right mr-4 font-bold">Threshold</span>
              <span className="text-[10px] font-mono text-muted/60 shrink-0 w-16 text-right font-bold">Status</span>
            </div>

            <div className="divide-y divide-theme/10">
              {screeningResult.criteria.map((c) => (
                <CriterionRow key={c.id} criterion={c} />
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-theme/20 bg-tertiary/5">
              <p className="text-[10px] font-mono text-muted/50 leading-relaxed italic">
                Screening basis: Bachu (2003) AAPG Bulletin, NETL Best Practices (2015), Chadwick et al. (2008) CO2GeoNet, Bradshaw et al. (2007)
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Gauge & Suitability subscores (40% width equivalent: col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Gauge representation */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
            <canvas ref={canvasRef} className="w-full rounded-lg border border-theme/20 bg-page/50" style={{ minHeight: 220 }} />
          </div>

          {/* Recommendation Banner */}
          <div className={`rounded-xl p-4 border text-xs font-mono leading-relaxed shadow ${
            !screeningResult.canProceed ? 'bg-error/10 border-error/30 text-error'
            : screeningResult.requiresAcknowledgment ? 'bg-warning/10 border-warning/30 text-warning font-semibold'
            : 'bg-success/10 border-success/30 text-success'
          }`}>
            <span className="font-bold uppercase tracking-wider block mb-1">Remediation &amp; Recommendation</span>
            {screeningResult.recommendation}
          </div>

          {/* Subscores card */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-theme/10 pb-2 block">
              Sub-Score Analysis
            </span>
            <div className="space-y-3.5">
              <SubScore label="Depth Index" value={score.depth} desc={`${params.depth} m (deep saline aquifer limit)`} />
              <SubScore label="CO₂ Phase State" value={score.phase} desc={params.temperature > 31 && params.pressure > 7.38 ? 'Supercritical (density > 600 kg/m³)' : 'Subcritical (gaseous/two-phase)'} />
              <SubScore label="Reservoir Quality" value={score.reservoir} desc={`φ = ${(params.porosity * 100).toFixed(0)}%, k = ${params.permeability} mD`} />
              <SubScore label="Caprock Containment" value={score.caprock} desc={`Friction Angle = ${params.caprockFriction}°`} />
              <SubScore label="Storage Volume" value={score.storage} desc={`${(params.area * params.thickness * params.porosity / 1e9).toFixed(2)} km³ net pore volume`} />
              <SubScore label={`Regulatory Index (${jurisdiction})`} value={score.regulatory} desc={`Based on ${jurisdiction} CCS licensing framework`} />
            </div>
          </div>

        </div>
      </div>

      {/* Final workflow gate — unlocks simulation */}
      <div className="border-t border-theme mt-4 pt-3 px-4 pb-4 space-y-2">
        <p className="text-[10px] font-mono text-muted leading-relaxed">
          You have reviewed Formation, Geology, Geomechanics and Screening. Confirming will unlock the Simulation stage.
        </p>
        <button
          disabled={!screeningResult.canProceed}
          onClick={() => { setStageComplete('stage2', true); setPanel('simulation') }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold font-mono transition disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 disabled:bg-tertiary disabled:text-muted text-white"
        >
          <ShieldCheck size={13} />
          All Stages Reviewed — Confirm &amp; Proceed to Simulation
        </button>
      </div>
    </div>
  )
}

function SubScore({ label, value, desc }: { label: string; value: number; desc: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-muted">{label}</span>
        <span className={`font-bold ${value < 30 ? 'text-error' : value < 60 ? 'text-warning' : 'text-success'}`}>{value.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${value < 30 ? 'bg-error' : value < 60 ? 'bg-warning' : 'bg-success'}`}
          style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-muted/65 font-mono block leading-none">{desc}</span>
    </div>
  )
}
