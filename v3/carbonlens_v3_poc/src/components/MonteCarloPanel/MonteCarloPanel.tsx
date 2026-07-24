import { useState, useCallback, useMemo, useEffect } from 'react'
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

function RangeBar({ p10, p50, p90, unit, fmt }: { p10: number; p50: number; p90: number; unit: string; fmt: (v: number) => string }) {
  const span = p90 - p10
  const p10pct = 0
  const p50pct = span > 0 ? ((p50 - p10) / span) * 100 : 50
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-mono text-muted">
        <span>P10: {fmt(p10)} {unit}</span>
        <span>P90: {fmt(p90)} {unit}</span>
      </div>
      <div className="relative h-4 rounded-full bg-slate-800 border border-theme/20 overflow-hidden">
        <div className="absolute inset-y-0 bg-accent/25 rounded-full" style={{ left: `${p10pct}%`, right: '0%' }} />
        <div className="absolute top-0 bottom-0 w-1 bg-accent shadow" style={{ left: `${p50pct}%` }} title={`P50: ${fmt(p50)} ${unit}`} />
      </div>
      <div className="text-center text-xs font-mono text-secondary">
        P50 Median: <span className="text-accent font-bold text-sm">{fmt(p50)} {unit}</span>
      </div>
    </div>
  )
}

export default function MonteCarloPanel() {
  const params = useFormationStore((s) => s.params)
  const projectYears = useUIStore((s) => s.projectYears)
  const demoActive = useUIStore((s) => s.demoActive)
  const [config, setConfig] = useState<MCConfig>(DEFAULT_MC_CONFIG)
  const [result, setResult] = useState<MCResult | null>(null)
  const [running, setRunning] = useState(false)
  const setLastMCResult = useMCStore(s => s.setLastResult)

  const formationName = useMemo(() => {
    const preset = FORMATION_PRESETS.find(
      (p) => p.params.depth === params.depth && p.params.porosity === params.porosity
    )
    return preset?.name ?? 'Custom Formation'
  }, [params.depth, params.porosity])

  const run = useCallback(() => {
    setRunning(true)
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

  useEffect(() => {
    if (demoActive && !result && !running) {
      run()
    }
  }, [demoActive])

  const sliderCls = 'w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme/20 pb-4">
        <div className="flex items-center gap-2">
          <Shuffle size={20} className="text-accent shrink-0" />
          <div>
            <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider">Monte Carlo Uncertainty Simulator</h1>
            <p className="text-xs text-muted font-mono mt-0.5">Latin Hypercube Sampling over key reservoir parameters</p>
          </div>
        </div>
        {/* Formation badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-xs font-mono">
          <span className="text-muted font-semibold">Active Model:</span>
          <span className="font-bold text-accent">{formationName}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Uncertainty Sliders (60% width equivalent: col-span-7) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-5 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2">
              Parameter Uncertainty Boundaries
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-secondary">
                  <label>Permeability Uncertainty Bounds</label>
                  <span className="font-bold text-accent">±{config.permUncertPct}%</span>
                </div>
                <input type="range" min={5} max={80} step={5} value={config.permUncertPct}
                  className={sliderCls}
                  onChange={e => setConfig(c => ({ ...c, permUncertPct: +e.target.value }))} />
                <p className="text-[11px] text-muted font-mono">Samples k range: [{(params.permeability * (1 - config.permUncertPct / 100)).toFixed(0)}, {(params.permeability * (1 + config.permUncertPct / 100)).toFixed(0)}] mD</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-secondary">
                  <label>Porosity Absolute Uncertainty</label>
                  <span className="font-bold text-accent">±{config.poroUncertAbs.toFixed(3)}</span>
                </div>
                <input type="range" min={0.01} max={0.10} step={0.005} value={config.poroUncertAbs}
                  className={sliderCls}
                  onChange={e => setConfig(c => ({ ...c, poroUncertAbs: +e.target.value }))} />
                <p className="text-[11px] text-muted font-mono">Samples φ range: [{Math.max(0.01, params.porosity - config.poroUncertAbs).toFixed(3)}, {Math.min(0.45, params.porosity + config.poroUncertAbs).toFixed(3)}]</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-secondary">
                  <label>Reservoir Footprint Area Uncertainty</label>
                  <span className="font-bold text-accent">±{config.areaUncertPct}%</span>
                </div>
                <input type="range" min={5} max={60} step={5} value={config.areaUncertPct}
                  className={sliderCls}
                  onChange={e => setConfig(c => ({ ...c, areaUncertPct: +e.target.value }))} />
                <p className="text-[11px] text-muted font-mono">Samples Area range: [{((params.area ?? 100) * (1 - config.areaUncertPct / 100)).toFixed(0)}, {((params.area ?? 100) * (1 + config.areaUncertPct / 100)).toFixed(0)}] km²</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-secondary">
                  <label>Net Pay Thickness Uncertainty</label>
                  <span className="font-bold text-accent">±{config.thickUncertPct}%</span>
                </div>
                <input type="range" min={5} max={50} step={5} value={config.thickUncertPct}
                  className={sliderCls}
                  onChange={e => setConfig(c => ({ ...c, thickUncertPct: +e.target.value }))} />
                <p className="text-[11px] text-muted font-mono">Samples Thickness range: [{((params.thickness ?? 50) * (1 - config.thickUncertPct / 100)).toFixed(0)}, {((params.thickness ?? 50) * (1 + config.thickUncertPct / 100)).toFixed(0)}] m</p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-mono text-secondary">
                  <label>Simulation Realizations (LHS Samples)</label>
                  <span className="font-bold text-accent">{config.nRealizations}</span>
                </div>
                <div className="flex gap-2">
                  {[50, 100, 200, 500].map(n => (
                    <button key={n}
                      className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition border ${config.nRealizations === n ? 'bg-accent text-white border-accent' : 'bg-tertiary text-secondary hover:bg-tertiary/80 hover:text-primary border-theme/20'}`}
                      onClick={() => setConfig(c => ({ ...c, nRealizations: n }))}
                    >{n}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action trigger button */}
          <button onClick={run} disabled={running}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-accent text-white font-mono font-bold text-sm hover:bg-accent-hover disabled:opacity-50 transition shadow-md"
          >
            {running ? <><Loader2 size={16} className="animate-spin" />Running {config.nRealizations} realizations...</> : <><Play size={16} />Run Uncertainty Analysis</>}
          </button>
        </div>

        {/* Right Column: Statistics & Range Bars (40% width equivalent: col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          {result ? (
            <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-5 shadow-md">
              <div className="flex items-center justify-between border-b border-theme/10 pb-2">
                <div className="flex items-center gap-1.5 text-success font-mono font-bold text-xs">
                  <CheckCircle2 size={15} />
                  <span>{result.realizations.length} Realizations Executed</span>
                </div>
                <span className="text-xs text-muted font-mono">{(result.runTimeMs / 1000).toFixed(2)} s</span>
              </div>

              {/* Storage capacity */}
              <div className="bg-tertiary/20 rounded-lg p-4 space-y-1.5 border border-theme/20">
                <p className="text-[10px] text-muted font-mono uppercase tracking-wider font-bold">Storage Capacity (DOE Volumetric)</p>
                <RangeBar p10={result.p10_Mt} p50={result.p50_Mt} p90={result.p90_Mt} unit="Mt CO₂" fmt={formatMt} />
              </div>

              {/* Pressure buildup */}
              <div className="bg-tertiary/20 rounded-lg p-4 space-y-1.5 border border-theme/20">
                <p className="text-[10px] text-muted font-mono uppercase tracking-wider font-bold">Peak Pressure Buildup</p>
                <RangeBar p10={result.p10_P} p50={result.p50_P} p90={result.p90_P} unit="MPa" fmt={formatMPa} />
              </div>

              {/* Summary table */}
              <table className="w-full text-xs font-mono border-collapse pt-2">
                <thead>
                  <tr className="text-muted border-b border-theme/20 font-bold uppercase text-[10px]">
                    <th className="text-left pb-2">Metric</th>
                    <th className="text-right pb-2">P90</th>
                    <th className="text-right pb-2">P50</th>
                    <th className="text-right pb-2">P10</th>
                  </tr>
                </thead>
                <tbody className="text-secondary">
                  <tr className="border-b border-theme/10">
                    <td className="py-2 text-muted">Capacity (Mt)</td>
                    <td className="py-2 text-right">{formatMt(result.p90_Mt)}</td>
                    <td className="py-2 text-right font-bold text-accent">{formatMt(result.p50_Mt)}</td>
                    <td className="py-2 text-right">{formatMt(result.p10_Mt)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted">Peak ΔP (MPa)</td>
                    <td className="py-2 text-right">{formatMPa(result.p90_P)}</td>
                    <td className="py-2 text-right font-bold text-accent">{formatMPa(result.p50_P)}</td>
                    <td className="py-2 text-right">{formatMPa(result.p10_P)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Uncertainty ratio */}
              {result.p50_Mt > 0 && (
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-1 text-xs font-mono">
                  <p className="text-[10px] text-muted uppercase font-bold">P10/P90 Capacity Spread</p>
                  <p className="text-lg font-bold text-accent">{(result.p10_Mt / Math.max(result.p90_Mt, 1e-6)).toFixed(1)}×</p>
                  <p className="text-muted leading-relaxed text-[11px]">
                    {result.p10_Mt / Math.max(result.p90_Mt, 1e-6) < 2
                      ? 'Low uncertainty — well-constrained input parameters.'
                      : result.p10_Mt / Math.max(result.p90_Mt, 1e-6) < 5
                      ? 'Moderate uncertainty — normal bounds for carbon storage screening.'
                      : 'High uncertainty — require site characterization data to restrict pay range.'}
                  </p>
                </div>
              )}

              {/* CSV export */}
              <button onClick={() => downloadCSV(result)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tertiary text-primary hover:opacity-80 border border-theme/20 text-xs font-mono font-bold transition"
              >
                <Download size={14} />
                Export Realizations (.CSV)
              </button>

              <div className="flex items-start gap-2 text-[10px] text-muted/65 bg-tertiary/20 rounded-lg p-3 leading-relaxed font-mono">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>Latin Hypercube Sampling over k, φ, Area, and Net Pay. Peak pressure estimated at injection boundary. Volumetric calculations calibrated using Sleipner benchmark storage factors.</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-theme/30 bg-card/50 p-10 text-center text-xs font-mono text-muted/50">
              Run uncertainty simulation to generate statistical distributions (P10, P50, P90).
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
