import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useSimulation, validateGeomechanics } from '../../hooks/useSimulation'
import { Play, RotateCcw, BarChart3, Pause, Zap, AlertTriangle, ShieldAlert, StopCircle, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

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
  const { runAnimation } = useSimulation()

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
              <div key={key} className="flex items-start gap-1.5 bg-red-900/30 border border-red-500/40 rounded px-2 py-1.5">
                <AlertTriangle size={10} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-[10px] font-mono text-red-200 leading-tight">
                  {check.message}
                  <span className="text-[8px] text-red-400/70 block mt-0.5">
                    {key === 'caprock' && `Ratio ${check.value.toFixed(3)} / ${check.threshold}`}
                    {key === 'safetyFactor' && `SF ${check.value.toFixed(2)} (min ${check.threshold})`}
                    {key === 'mohr' && `Margin ${check.value.toFixed(2)} MPa`}
                    {key === 'maip' && `Margin ${check.value.toFixed(1)}%`}
                  </span>
                  <span className="text-[8px] text-amber-400/80 block mt-1 italic">
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
          onStop={stopAnimation}
        />
      )}

      {!isAnimating && status === 'complete' && result && (
        <>
          <div className="flex gap-1.5">
            <button onClick={() => {
              setValidation(validateGeomechanics(params, wells))
              runAnimation()
            }} className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-[11px]">
              <RotateCcw size={12} /> Re-run
            </button>
            <button onClick={reset}
              className="flex items-center gap-1 px-3 py-2 rounded bg-red-900/40 border border-red-500/30 text-red-300 hover:bg-red-900/60 text-[10px] font-mono transition shrink-0">
              <Trash2 size={11} /> Clear
            </button>
          </div>
          <div className="flex gap-1 justify-center">
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded text-[9px] font-mono ${speed === s ? 'bg-accent text-white' : 'bg-tertiary text-muted hover:text-secondary'}`}
              >{s}×</button>
            ))}
          </div>
          <ResultDisplay result={result} />
        </>
      )}
    </div>
  )
}

function AnimatedRunControls({ result, speed, onSpeedChange, onStop }: {
  result: ReturnType<typeof useSimulationStore.getState>['result']
  speed: number
  onSpeedChange: (s: number) => void
  onStop: () => void
}) {
  const year = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const reset = useSimulationStore((s) => s.reset)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono text-secondary">Year {year} / {projectYears}</div>
        <div className="flex gap-1">
          <button onClick={onStop}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-mono bg-red-900/50 border border-red-500/40 text-red-200 hover:bg-red-800/60 transition">
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
  { key: 'residualTrapping' as const,  label: 'Residual',  sublabel: 'pore snap-off',  color: '#f5a830', glow: 'rgba(245,168,48,0.25)',  dot: '●' },
  { key: 'solubilityTrapping' as const, label: 'Dissolved', sublabel: 'into brine',     color: '#3090d8', glow: 'rgba(48,144,216,0.25)', dot: '●' },
  { key: 'mobilePlume' as const,        label: 'Mobile',    sublabel: 'still migrating', color: '#00c4a0', glow: 'rgba(0,196,160,0.20)',  dot: '○' },
]

function ResultDisplay({ result }: { result: NonNullable<ReturnType<typeof useSimulationStore.getState>['result']> }) {
  const total = Math.max(0.001, result.residualTrapping + result.solubilityTrapping + result.mobilePlume)

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
          { label: 'Inj. P',   value: `${result.injectionPressure.toFixed(1)} MPa`,                 color: '#a080d0' },
          { label: 'IFT',      value: result.ift != null ? `${result.ift.toFixed(1)} mN/m` : '—',  color: '#40b860' },
          { label: 'CO₂ ρ',   value: `${result.co2Density.toFixed(0)} kg/m³`,                      color: '#60b8f0' },
          { label: 'Plume r',  value: `${result.plumeRadius.toFixed(0)} m`,                         color: '#60b8f0' },
          { label: 'Solub.',   value: `${result.solubility.toFixed(2)} mol/kg`,                     color: '#40b860' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-tertiary/60 rounded px-2 py-1.5 border border-theme/40">
            <div className="text-[8px] text-muted font-mono uppercase tracking-wider mb-0.5">{label}</div>
            <div className="text-[11px] font-mono font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Overpressure warning */}
      {result.overpressureRisk && (
        <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-500/60 rounded px-2 py-1.5">
          <span className="text-red-400 text-[10px] font-mono font-semibold uppercase tracking-wider">
            Overpressure Risk — injected CO₂ exceeds P90 capacity ({result.capacityP90.toFixed(2)} Mt)
          </span>
        </div>
      )}

      {/* DOE capacity range */}
      <div className="flex items-center justify-between bg-tertiary/40 rounded px-2 py-1 border border-theme/30">
        <span className="text-[8px] text-muted font-mono uppercase tracking-wider">DOE Range</span>
        <span className="text-[9px] font-mono text-teal-300">
          P10 {result.capacityP10.toFixed(2)} Mt &nbsp;|&nbsp; P50 {result.totalCapacity.toFixed(2)} Mt &nbsp;|&nbsp; P90 {result.capacityP90.toFixed(2)} Mt
        </span>
      </div>

      {/* Trapping analysis */}
      <div className="pt-1 border-t border-theme/50 space-y-2">
        <div className="text-[9px] text-muted font-mono uppercase tracking-wider">CO₂ Trapping</div>

        {/* Stacked bar */}
        <div className="relative h-5 rounded overflow-hidden flex" style={{ background: 'rgba(10,20,30,0.6)' }}>
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
                  <span className="text-[10px] font-mono font-semibold" style={{ color }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(10,20,30,0.6)' }}>
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
