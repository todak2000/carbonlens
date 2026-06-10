import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useSimulation, validateGeomechanics } from '../../hooks/useSimulation'
import { Play, RotateCcw, BarChart3, Pause, Zap, AlertTriangle, ShieldAlert, StopCircle, Trash2, Bookmark } from 'lucide-react'
import { useMemo } from 'react'
import SimulationCommentary from './SimulationCommentary'

const SPEEDS = [1, 2, 5, 10]

export default function SimulationPanel() {
  const params = useFormationStore((s) => s.params)
  const wells = useFormationStore((s) => s.wells)
  const status = useSimulationStore((s) => s.status)
  const result = useSimulationStore((s) => s.result)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const speed = useSimulationStore((s) => s.animationSpeed)
  const setSpeed = useSimulationStore((s) => s.setAnimationSpeed)
  const stopAnimation = useSimulationStore((s) => s.stopAnimation)
  const reset = useSimulationStore((s) => s.reset)
  const forceRun = useSimulationStore((s) => s.forceRun)
  const setForceRun = useSimulationStore((s) => s.setForceRun)
  const setValidation = useSimulationStore((s) => s.setValidation)
  const setBaseline = useSimulationStore((s) => s.setBaseline)
  const clearBaseline = useSimulationStore((s) => s.clearBaseline)
  const baselineResult = useSimulationStore((s) => s.baselineResult)
  const { runAnimation, pauseSimulation, resumeSimulation } = useSimulation()

  // Re-run validation whenever params or wells change
  const liveValidation = useMemo(() => validateGeomechanics(params, wells), [params, wells])

  const hasFailures = liveValidation && !liveValidation.valid

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider">Simulation</h2>

      {/* Pre-flight validation warnings */}
      {hasFailures && !isAnimating && status === 'idle' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber text-[10px] font-mono font-semibold mb-1">
            <ShieldAlert size={12} /> Geomechanical risk detected
          </div>
          {Object.entries(liveValidation.checks).map(([key, check]) => {
            if (check.ok) return null
            return (
              <div key={key} className="flex items-start gap-1.5 bg-error border border-error rounded px-2 py-1.5">
                <AlertTriangle size={10} className="text-error shrink-0 mt-0.5" />
                <div className="text-[10px] font-mono text-error leading-tight">
                  {check.message}
                  <span className="text-[8px] text-error block mt-0.5">
                    {key === 'caprock' && `Ratio ${check.value.toFixed(3)} / ${check.threshold}`}
                    {key === 'safetyFactor' && `SF ${check.value.toFixed(2)} (min ${check.threshold})`}
                    {key === 'mohr' && `Margin ${check.value.toFixed(2)} MPa`}
                    {key === 'maip' && `Margin ${check.value.toFixed(1)}%`}
                  </span>
                  <span className="text-[8px] text-warning block mt-1 italic">
                    → {check.fix}
                  </span>
                </div>
              </div>
            )
          })}
          <div className="flex gap-1.5 pt-1">
            <button onClick={() => {
              setValidation(liveValidation)
              setForceRun(true)
              runAnimation()
            }} className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-[11px]">
              <Play size={12} /> Run Anyway
            </button>
            <button onClick={() => setForceRun(false)}
              className="flex-1 py-2 rounded bg-tertiary text-secondary hover:text-primary text-[11px] font-mono transition">
              Fix Parameters
            </button>
          </div>
        </div>
      )}

      {!hasFailures && !isAnimating && status === 'idle' && (
        <button onClick={() => {
          setValidation(liveValidation)
          runAnimation()
        }} className="btn-primary w-full flex items-center justify-center gap-1.5">
          <Play size={13} /> Run Simulation
        </button>
      )}

      {isAnimating && (
        <AnimatedRunControls
          result={result}
          speed={speed}
          onSpeedChange={setSpeed}
          onPause={pauseSimulation}
          onStop={stopAnimation}
        />
      )}

      {/* Paused state (status=running but !isAnimating) */}
      {!isAnimating && status === 'running' && result && (
        <AnimatedRunControls
          result={result}
          speed={speed}
          onSpeedChange={setSpeed}
          onPause={pauseSimulation}
          onStop={stopAnimation}
          paused
          onResume={resumeSimulation}
        />
      )}

      {!isAnimating && status === 'complete' && result && (
        <>
          <button onClick={() => {
            setValidation(validateGeomechanics(params, wells))
            setForceRun(true)
            runAnimation()
          }} className="btn-primary w-full flex items-center justify-center gap-1.5 text-[11px]">
            <RotateCcw size={12} /> Re-run
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => baselineResult ? clearBaseline() : setBaseline(result, params)}
              title={baselineResult ? 'Clear baseline' : 'Lock this run as baseline for sensitivity comparison'}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-mono transition ${
                baselineResult
                  ? 'bg-accent/20 border border-accent/50 text-accent'
                  : 'bg-tertiary border border-theme text-muted hover:text-secondary'
              }`}
            >
              <Bookmark size={11} /> {baselineResult ? 'Baseline ✓' : 'Baseline'}
            </button>
            <button onClick={reset}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-error border border-error text-error text-[10px] font-mono transition">
              <Trash2 size={11} /> Clear
            </button>
          </div>
          {baselineResult && (
            <div className="text-[8px] font-mono text-accent/70 flex items-center gap-1 px-0.5">
              <Bookmark size={8} /> Baseline locked — modify params &amp; re-run to compare in Validation panel
            </div>
          )}
          <ResultDisplay result={result} />
        </>
      )}
    </div>
  )
}

function AnimatedRunControls({ result, speed, onSpeedChange, onPause, onStop, paused, onResume }: {
  result: ReturnType<typeof useSimulationStore.getState>['result']
  speed: number
  onSpeedChange: (s: number) => void
  onPause: () => void
  onStop: () => void
  paused?: boolean
  onResume?: () => void
}) {
  const year = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const reset = useSimulationStore((s) => s.reset)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono text-secondary">
          Year {year} / {projectYears}
          {paused && <span className="ml-1 text-warning">⏸ Paused</span>}
        </div>
        <div className="flex gap-1">
          {paused
            ? (
              <button onClick={onResume}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-mono bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 transition">
                <Play size={12} /> Resume
              </button>
            )
            : (
              <button onClick={onPause}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-mono bg-warning border border-warning text-warning transition">
                <Pause size={12} /> Pause
              </button>
            )
          }
          <button onClick={onStop}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-mono bg-error border border-error text-error transition">
            <StopCircle size={12} /> Stop
          </button>
          <button onClick={reset}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-[9px] font-mono bg-tertiary text-muted hover:text-secondary transition"
            title="Clear results and reset">
            <Trash2 size={10} />
          </button>
        </div>
      </div>
      <div className="w-full h-1.5 bg-tertiary rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-200" style={{ width: `${(year / projectYears) * 100}%` }} />
      </div>
      <SimulationCommentary />
      <div className="flex gap-1 justify-center">
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => onSpeedChange(s)}
            className={`flex items-center gap-0.5 px-2 py-1 rounded text-[9px] font-mono ${speed === s ? 'bg-accent text-white' : 'bg-tertiary text-muted hover:text-secondary'}`}
          >{s === 1 ? <Zap size={10} /> : null} {s}×</button>
        ))}
      </div>
      {result && <ResultDisplay result={result} />}
    </div>
  )
}

const TRAP_ITEMS = [
  { key: 'residualTrapping' as const,  label: 'Residual',  sublabel: 'pore snap-off',  color: '#10b981', glow: 'rgba(16,185,129,0.25)',  dot: '●' },
  { key: 'solubilityTrapping' as const, label: 'Dissolved', sublabel: 'into brine',     color: '#14b8a6', glow: 'rgba(20,184,166,0.25)', dot: '●' },
  { key: 'mineralTrapping' as const,   label: 'Mineral',   sublabel: 'geochemical',     color: '#b45309', glow: 'rgba(180,83,9,0.25)',   dot: '●' },
  { key: 'mobilePlume' as const,        label: 'Mobile',    sublabel: 'still migrating', color: '#ef4444', glow: 'rgba(239,68,68,0.20)',  dot: '○' },
]

function ResultDisplay({ result }: { result: NonNullable<ReturnType<typeof useSimulationStore.getState>['result']> }) {
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const total = Math.max(0.001, result.residualTrapping + result.solubilityTrapping + result.mineralTrapping + result.mobilePlume)

  return (
    <div className="space-y-2 pt-1">
      {/* Key metrics */}
      <div className="flex items-center gap-1 pb-0.5">
        <BarChart3 size={11} className="text-muted" />
        <span className="text-[10px] text-muted font-mono uppercase tracking-wider">Results</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: 'Stored CO₂', value: `${result.storageCapacity.toFixed(3)} Mt`,                 color: '#00c4a0' },
          { label: 'P50 Capacity', value: `${result.totalCapacity.toFixed(2)} Mt`,                  color: '#60b8f0' },
          { label: 'Utilisation', value: `${result.capacityUtilPct.toFixed(3)}%`,                   color: result.overpressureRisk ? '#f87171' : '#a0d060' },
          { label: 'Stor. Eff.', value: `${result.storageEfficiency.toFixed(1)}% Cc`,               color: '#e0a030' },
          { label: 'Inj. P',   value: `${result.injectionPressure.toFixed(1)} MPa`,                 color: '#a080d0' },
          { label: 'IFT',      value: result.ift != null ? `${result.ift.toFixed(1)} mN/m` : '—',  color: '#40b860' },
          { label: 'CO₂ ρ',   value: `${result.co2Density.toFixed(0)} kg/m³`,                      color: '#60b8f0' },
          { label: 'Plume r',  value: `${result.plumeRadius.toFixed(0)} m`,                         color: '#60b8f0' },
          { label: 'Solub.',   value: `${result.solubility.toFixed(2)} mol/kg`,                     color: '#40b860' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-tertiary rounded px-2 py-1.5 border border-theme">
            <div className="text-[8px] text-muted font-mono uppercase tracking-wider mb-0.5">{label}</div>
            <div className="text-[11px] font-mono font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Overpressure / caprock failure risk warning */}
      {result.overpressureRisk && (
        <div className="rounded border border-error/60 bg-error/10 px-2.5 py-2 space-y-1.5">
          <div className="text-[10px] text-error font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5">
            ⚠ Reservoir Overpressure Risk
          </div>
          <p className="text-[9px] text-error/80 font-mono leading-relaxed">
            Cumulative injection ({result.storageCapacity.toFixed(2)} Mt) has exceeded the P90 capacity limit
            ({result.capacityP90.toFixed(2)} Mt). Sustained overpressure will cause reservoir pressure
            to approach <strong>caprock fracture pressure</strong> — the primary CO₂ leakage pathway.
          </p>
          <div className="text-[9px] text-amber-300/90 font-mono space-y-0.5">
            <div className="font-semibold">To prevent caprock failure:</div>
            <div>· Reduce well injection rate (Formation panel)</div>
            <div>· Check MAIP margin in Geomechanics panel — must be &gt;20%</div>
            <div>· Reduce project years or number of wells</div>
          </div>
        </div>
      )}

      {/* DOE capacity range */}
      <div className="flex items-center justify-between bg-tertiary/40 rounded px-2 py-1 border border-theme/30">
        <span className="text-[8px] text-muted font-mono uppercase tracking-wider">DOE Range</span>
        <span className="text-[9px] font-mono text-success">
          P90 {result.capacityP10.toFixed(2)} Mt &nbsp;|&nbsp; P50 {result.totalCapacity.toFixed(2)} Mt &nbsp;|&nbsp; P10 {result.capacityP90.toFixed(2)} Mt
        </span>
      </div>

      {/* Trapping analysis */}
      <div className="pt-1 border-t border-theme/50 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="text-[9px] text-muted font-mono uppercase tracking-wider">CO₂ Trapping</div>
          {isAnimating && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" title="Live updating" />
          )}
        </div>

        {/* Stacked bar */}
        <div className="relative h-5 rounded overflow-hidden flex bg-tertiary">
          {TRAP_ITEMS.map(({ key, label, color, glow }) => {
            const pct = (result[key] / total) * 100
            return (
              <div
                key={key}
                title={`${label}: ${pct.toFixed(1)}%`}
                style={{
                  width: `${pct}%`,
                  background: color,
                  boxShadow: `inset 0 0 8px ${glow}`,
                  transition: 'width 0.6s ease',
                  minWidth: pct > 1 ? '2px' : '0',
                }}
              />
            )
          })}
        </div>

        {/* Individual breakdown rows */}
        <div className="space-y-1.5">
          {TRAP_ITEMS.map(({ key, label, sublabel, color, glow, dot }) => {
            const pct = (result[key] / total) * 100
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]" style={{ color }}>{dot}</span>
                    <span className="text-[10px] font-mono" style={{ color }}>{label}</span>
                    <span className="text-[8px] text-muted font-mono">({sublabel})</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold" style={{ color }}>{pct.toFixed(1)}%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-tertiary">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${glow}` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
