import { useState, useCallback, useMemo } from 'react'
import { Shuffle, Play, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useFormationStore } from '../../store/formationStore'
import { useUIStore } from '../../store/uiStore'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import { useMCStore } from '../../store/mcStore'
import {
  runMonteCarlo,
  DEFAULT_MC_CONFIG,
  type MCConfig,
  type MCResult,
  type MCRealization,
} from '../../utils/monteCarlo'

function formatMt(v: number) { return v.toFixed(2) }
function formatMPa(v: number) { return v.toFixed(2) }

export type { MCRealization, MCResult, MCConfig }

function downloadCSV(result: MCResult) {
  const header = 'id,permMultiplier,porosityDelta,areaMultiplier,thicknessMultiplier,storageCapacity_Mt,peakPressure_MPa'
  const rows = result.realizations.map(r =>
    `${r.id},${r.permMultiplier.toFixed(4)},${r.porosityDelta.toFixed(4)},${r.areaMultiplier.toFixed(4)},${r.thicknessMultiplier.toFixed(4)},${r.storageCapacity_Mt.toFixed(4)},${r.peakPressure_MPa.toFixed(3)}`
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'carbonlens_montecarlo.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// P10–P90 range bar (normalised 0–1 relative to the range shown)
function RangeBar({ p10, p50, p90, unit, fmt }: { p10: number; p50: number; p90: number; unit: string; fmt: (v: number) => string }) {
  const span = p90 - p10
  const p10pct = 0
  const p50pct = span > 0 ? ((p50 - p10) / span) * 100 : 50
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-mono text-muted">
        <span>P10 {fmt(p10)} {unit}</span>
        <span>P90 {fmt(p90)} {unit}</span>
      </div>
      <div className="relative h-3 rounded-full bg-tertiary overflow-hidden">
        <div className="absolute inset-0 bg-accent/20 rounded-full" style={{ left: `${p10pct}%`, right: '0%' }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-accent" style={{ left: `${p50pct}%` }} title={`P50: ${fmt(p50)} ${unit}`} />
      </div>
      <div className="text-center text-[11px] font-mono text-primary">P50: <span className="text-accent font-semibold">{fmt(p50)} {unit}</span></div>
    </div>
  )
}

export default function MonteCarloPanel() {
  const params = useFormationStore((s) => s.params)
  const projectYears = useUIStore((s) => s.projectYears)
  const [config, setConfig] = useState<MCConfig>(DEFAULT_MC_CONFIG)
  const [result, setResult] = useState<MCResult | null>(null)
  const [running, setRunning] = useState(false)
  const setLastMCResult = useMCStore(s => s.setLastResult)

  // Resolve formation name from presets (fingerprint by depth + porosity)
  const formationName = useMemo(() => {
    const preset = FORMATION_PRESETS.find(
      (p) => p.params.depth === params.depth && p.params.porosity === params.porosity
    )
    return preset?.name ?? 'Custom Formation'
  }, [params.depth, params.porosity])

  const run = useCallback(() => {
    setRunning(true)
    // Use setTimeout to let the UI update before the blocking compute
    setTimeout(() => {
      try {
        const res = runMonteCarlo(config, params, projectYears)
        setResult(res)
        setLastMCResult({
          p10_Mt: res.p10_Mt,
          p50_Mt: res.p50_Mt,
          p90_Mt: res.p90_Mt,
          p10_P: res.p10_P,
          p50_P: res.p50_P,
          p90_P: res.p90_P,
          realizations: res.realizations.length,
          runTimeMs: res.runTimeMs,
          permUncertPct: config.permUncertPct,
          poroUncertAbs: config.poroUncertAbs,
          areaUncertPct: config.areaUncertPct,
          thickUncertPct: config.thickUncertPct,
          formationName,
          ranAt: new Date().toISOString(),
        })
      } finally {
        setRunning(false)
      }
    }, 20)
  }, [config, params, projectYears])

  const sliderCls = 'w-full accent-accent cursor-pointer'

  return (
    <div className="p-4 space-y-5 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-theme pb-3">
        <Shuffle size={15} className="text-accent shrink-0" />
        <div>
          <p className="text-sm font-semibold text-primary">Monte Carlo</p>
          <p className="text-[10px] text-muted">Latin Hypercube Sampling over uncertain parameters</p>
        </div>
      </div>

      {/* Formation badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded bg-accent/10 border border-accent/20">
        <span className="text-[10px] text-muted font-mono uppercase tracking-wider">Formation:</span>
        <span className="text-[11px] font-semibold text-accent font-mono">{formationName}</span>
      </div>

      {/* Config */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-muted">
            <label>Permeability uncertainty</label>
            <span className="text-primary">±{config.permUncertPct}%</span>
          </div>
          <input type="range" min={5} max={80} step={5} value={config.permUncertPct}
            className={sliderCls}
            onChange={e => setConfig(c => ({ ...c, permUncertPct: +e.target.value }))} />
          <p className="text-[10px] text-muted">Samples k in [{(params.permeability * (1 - config.permUncertPct / 100)).toFixed(0)}, {(params.permeability * (1 + config.permUncertPct / 100)).toFixed(0)}] mD</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-muted">
            <label>Porosity uncertainty</label>
            <span className="text-primary">±{config.poroUncertAbs.toFixed(2)}</span>
          </div>
          <input type="range" min={0.01} max={0.10} step={0.005} value={config.poroUncertAbs}
            className={sliderCls}
            onChange={e => setConfig(c => ({ ...c, poroUncertAbs: +e.target.value }))} />
          <p className="text-[10px] text-muted">φ samples [{Math.max(0.01, params.porosity - config.poroUncertAbs).toFixed(2)}, {Math.min(0.45, params.porosity + config.poroUncertAbs).toFixed(2)}]</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-muted">
            <label>Reservoir area uncertainty</label>
            <span className="text-primary">±{config.areaUncertPct}%</span>
          </div>
          <input type="range" min={5} max={60} step={5} value={config.areaUncertPct}
            className={sliderCls}
            onChange={e => setConfig(c => ({ ...c, areaUncertPct: +e.target.value }))} />
          <p className="text-[10px] text-muted">Area in [{((params.area ?? 100) * (1 - config.areaUncertPct / 100)).toFixed(0)}, {((params.area ?? 100) * (1 + config.areaUncertPct / 100)).toFixed(0)}] km²</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-muted">
            <label>Net pay thickness uncertainty</label>
            <span className="text-primary">±{config.thickUncertPct}%</span>
          </div>
          <input type="range" min={5} max={50} step={5} value={config.thickUncertPct}
            className={sliderCls}
            onChange={e => setConfig(c => ({ ...c, thickUncertPct: +e.target.value }))} />
          <p className="text-[10px] text-muted">Thickness in [{((params.thickness ?? 50) * (1 - config.thickUncertPct / 100)).toFixed(0)}, {((params.thickness ?? 50) * (1 + config.thickUncertPct / 100)).toFixed(0)}] m</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-muted">
            <label>Realizations</label>
            <span className="text-primary">{config.nRealizations}</span>
          </div>
          <div className="flex gap-2">
            {[50, 100, 200, 500].map(n => (
              <button key={n}
                className={`flex-1 py-1.5 rounded text-[11px] transition ${config.nRealizations === n ? 'bg-accent text-white' : 'bg-tertiary text-secondary hover:text-primary'}`}
                onClick={() => setConfig(c => ({ ...c, nRealizations: n }))}
              >{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Run button */}
      <button onClick={run} disabled={running}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 transition"
      >
        {running ? <><Loader2 size={13} className="animate-spin" />Running {config.nRealizations} realizations…</> : <><Play size={13} />Run Monte Carlo</>}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-4 border-t border-theme pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-accent">
              <CheckCircle2 size={13} />
              <span className="text-[11px] font-semibold">{result.realizations.length} realizations complete</span>
            </div>
            <span className="text-[10px] text-muted">{(result.runTimeMs / 1000).toFixed(2)} s</span>
          </div>

          {/* Storage capacity */}
          <div className="bg-card rounded-lg p-3 space-y-2 border border-theme">
            <p className="text-[10px] text-muted uppercase tracking-wider">Storage Capacity (DOE P50 Volumetric)</p>
            <RangeBar p10={result.p10_Mt} p50={result.p50_Mt} p90={result.p90_Mt} unit="Mt CO₂" fmt={formatMt} />
          </div>

          {/* Pressure builddup */}
          <div className="bg-card rounded-lg p-3 space-y-2 border border-theme">
            <p className="text-[10px] text-muted uppercase tracking-wider">Peak Pressure Buildup</p>
            <RangeBar p10={result.p10_P} p50={result.p50_P} p90={result.p90_P} unit="MPa" fmt={formatMPa} />
          </div>

          {/* Summary table */}
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="text-muted border-b border-theme">
                <th className="text-left pb-1.5">Metric</th>
                <th className="text-right pb-1.5">P10</th>
                <th className="text-right pb-1.5">P50</th>
                <th className="text-right pb-1.5">P90</th>
              </tr>
            </thead>
            <tbody className="text-primary">
              <tr className="border-b border-theme/50">
                <td className="py-1 text-muted">Capacity (Mt)</td>
                <td className="py-1 text-right">{formatMt(result.p10_Mt)}</td>
                <td className="py-1 text-right font-semibold text-accent">{formatMt(result.p50_Mt)}</td>
                <td className="py-1 text-right">{formatMt(result.p90_Mt)}</td>
              </tr>
              <tr>
                <td className="py-1 text-muted">ΔP (MPa)</td>
                <td className="py-1 text-right">{formatMPa(result.p10_P)}</td>
                <td className="py-1 text-right font-semibold text-accent">{formatMPa(result.p50_P)}</td>
                <td className="py-1 text-right">{formatMPa(result.p90_P)}</td>
              </tr>
            </tbody>
          </table>

          {/* Uncertainty ratio */}
          {result.p50_Mt > 0 && (
            <div className="bg-accent/5 border border-accent/20 rounded p-2.5 space-y-0.5">
              <p className="text-[10px] text-muted">P90/P10 capacity ratio (spread indicator)</p>
              <p className="text-sm font-bold text-accent">{(result.p90_Mt / Math.max(result.p10_Mt, 1e-6)).toFixed(1)}×</p>
              <p className="text-[10px] text-muted">{result.p90_Mt / Math.max(result.p10_Mt, 1e-6) < 2 ? 'Low uncertainty — well-constrained inputs' : result.p90_Mt / Math.max(result.p10_Mt, 1e-6) < 5 ? 'Moderate uncertainty — typical for appraisal stage' : 'High uncertainty — more characterization data needed'}</p>
            </div>
          )}

          {/* CSV export */}
          <button onClick={() => downloadCSV(result)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded bg-tertiary text-secondary hover:text-primary text-[11px] transition"
          >
            <Download size={12} />
            Export {result.realizations.length} realizations as CSV
          </button>

          <div className="flex items-start gap-1.5 text-[10px] text-muted bg-tertiary/40 rounded p-2">
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            <span>LHS over 4 dimensions: permeability, porosity, reservoir area, and net pay thickness. Capacity uses DOE Goodman (2011) volumetric method. Fault transmissibility and injection schedule held at base case.</span>
          </div>
        </div>
      )}
    </div>
  )
}
