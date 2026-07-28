import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useSimulation, validateGeomechanics } from '../../hooks/useSimulation'
import { Play, RotateCcw, BarChart3, Pause, Zap, AlertTriangle, ShieldAlert, StopCircle, Trash2, Bookmark, AlertCircle } from 'lucide-react'
import SimulationCommentary from './SimulationCommentary'
import { db } from '../../db/projectDb'
import { assessStorageScreening } from '../../engine/classical/storageScreening'

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
  const useIMPES = useFormationStore((s) => s.useIMPES)
  const toggleIMPES = useFormationStore((s) => s.toggleIMPES)

  const [projectCountry, setProjectCountry] = useState('')
  const [inputsVerified, setInputsVerified] = useState(false)
  // Track total rate so we detect when wells were updated from the Formation panel
  // (e.g. "Apply safe rate") and reset the verification checkbox accordingly.
  const prevTotalRateRef = useRef<number | null>(null)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [pendingRunFn, setPendingRunFn] = useState<(() => void) | null>(null)
  const currentProjectId = useUIStore((s) => s.currentProjectId)
  const currentProjectName = useUIStore((s) => s.currentProjectName)
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const projectYears = useUIStore((s) => s.projectYears)
  const setProjectYears = useUIStore((s) => s.setProjectYears)
  const updateWellRate = useFormationStore((s) => s.updateWellRate)

  useEffect(() => {
    if (!currentProjectId) return
    db.projects.get(currentProjectId).then((p) => {
      if (p) setProjectCountry(p.country ?? '')
    })
  }, [currentProjectId])

  // When wells are updated externally (e.g. "Apply safe rate" from Formation panel),
  // uncheck "Freeze parameters" so the user sees the updated inputs and must re-verify
  // before running. We compare the total rate rather than object identity to avoid
  // false triggers from unrelated re-renders.
  useEffect(() => {
    const currentTotal = wells.reduce((s, w) => s + w.injectionRate, 0)
    if (prevTotalRateRef.current !== null && Math.abs(currentTotal - prevTotalRateRef.current) > 0.0005) {
      setInputsVerified(false)
    }
    prevTotalRateRef.current = currentTotal
  }, [wells])

  const screeningResult = useMemo(() => assessStorageScreening(params), [params])

  // Re-run validation whenever params or wells change
  const liveValidation = useMemo(() => validateGeomechanics(params, wells), [params, wells])

  const stageCompletion = useUIStore((s) => s.stageCompletion)
  const isLocked = !stageCompletion.stage2
  const hasFailures = liveValidation && !liveValidation.valid

  // Guard any action that would wipe existing simulation results.
  // If a completed result exists, show the confirmation modal first.
  // The provided fn is stored and called only when the user confirms.
  const guardedAction = useCallback((fn: () => void) => {
    if (status === 'complete' && result) {
      setPendingRunFn(() => fn)
      setShowRestartConfirm(true)
    } else {
      fn()
    }
  }, [status, result])

  const confirmRestart = useCallback(() => {
    setShowRestartConfirm(false)
    if (pendingRunFn) {
      pendingRunFn()
      setPendingRunFn(null)
    }
  }, [pendingRunFn])

  const cancelRestart = useCallback(() => {
    setShowRestartConfirm(false)
    setPendingRunFn(null)
  }, [])

  return (
    <div className="p-4 space-y-4">
      {/* Restart confirmation modal */}
      {showRestartConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-theme rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-mono font-bold text-primary uppercase tracking-wider">Restart Simulation?</h3>
                <p className="text-xs font-mono text-secondary mt-1 leading-relaxed">
                  This will permanently clear your current simulation results, including the plume table and all trapping data. This cannot be undone once the new run begins.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={cancelRestart}
                className="flex-1 py-2 rounded-lg bg-tertiary border border-theme text-secondary text-xs font-mono hover:text-primary transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestart}
                className="flex-1 py-2 rounded-lg bg-error/20 border border-error/60 text-error text-xs font-mono font-bold hover:bg-error/30 transition"
              >
                Yes, Clear and Restart
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-primary text-sm font-mono uppercase tracking-wider">Simulation Execution</h2>
        {isLocked && (
          <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded uppercase tracking-wider">
            Read-Only
          </span>
        )}
      </div>

      {isLocked && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-xs font-mono text-amber-800 dark:text-amber-300 leading-normal">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <strong>Read-Only Mode:</strong> Formation parameters in Stage 2 must be confirmed before you can run simulations. Go to the <button onClick={() => useUIStore.getState().setPanel('formation')} className="underline font-bold text-accent hover:text-accent-hover">Formation tab</button> and click "Confirm Formation &amp; Proceed".
          </div>
        </div>
      )}

      {/* Simulation Pre-Flight Readiness Summary */}
      {status === 'idle' && !isAnimating && (
        <div className="rounded-xl border border-theme/40 bg-card p-4 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 border-b border-theme/20 pb-2">
            <span className="shrink-0 text-emerald-400">
              <ShieldAlert size={15} />
            </span>
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
              Pre-Flight Checklist
            </h3>
          </div>

          <div className="space-y-3.5">
            {/* Stage 1: Setup Details */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider font-bold">Stage 1: Setup &amp; Identity</div>
              <div className="grid grid-cols-2 gap-2 bg-tertiary/20 p-3 rounded-lg border border-theme/10 text-xs font-mono">
                <div className="truncate">Name: <span className="text-secondary font-bold">{currentProjectName || 'Untitled'}</span></div>
                <div className="truncate">Country: <span className="text-secondary font-bold">{projectCountry || 'Not Set'}</span></div>
                <div>Jurisdiction: <span className="text-secondary font-bold">{jurisdiction}</span></div>
                <div>Duration: <span className="text-secondary font-bold">{projectYears} Years</span></div>
                
                <div className="col-span-2 pt-2 border-t border-theme/10 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted uppercase font-bold">Adjust Timeline:</div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={projectYears}
                    disabled={isLocked}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setProjectYears(val)
                      useUIStore.getState().setStageComplete('stage3', false)
                      reset()
                      setInputsVerified(false)
                    }}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                </div>
              </div>
            </div>

            {/* Stage 2: Reservoir Definition */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider font-bold">Stage 2: Target Aquifer</div>
              <div className="grid grid-cols-2 gap-2 bg-tertiary/20 p-3 rounded-lg border border-theme/10 text-xs font-mono">
                <div className="truncate">Type: <span className="text-secondary font-bold capitalize">{(params.formationType ?? 'saline_aquifer').replace('_', ' ')}</span></div>
                <div className="truncate">Trap: <span className="text-secondary font-bold capitalize">{params.geometryType}</span></div>
                <div>Depth: <span className="text-secondary font-bold">{params.depth} m</span></div>
                <div>Thickness: <span className="text-secondary font-bold">{params.thickness} m</span></div>
                <div>Porosity: <span className="text-secondary font-bold">{(params.porosity * 100).toFixed(0)}%</span></div>
                <div>Perm: <span className="text-secondary font-bold">{params.permeability} mD</span></div>
              </div>
            </div>

            {/* Stage 2: Injection Configuration */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider font-bold">Stage 2: Wells &amp; Screening</div>
              <div className="grid grid-cols-2 gap-2 bg-tertiary/20 p-3 rounded-lg border border-theme/10 text-xs font-mono">
                <div>Wells: <span className="text-secondary font-bold">{wells.length} Active</span></div>
                <div>Total Rate: <span className="text-secondary font-bold">{wells.reduce((s, w) => s + w.injectionRate, 0).toFixed(2)} Mt/y</span></div>
                <div className="col-span-2 truncate">
                  Screening: <span className={`font-bold ${screeningResult.score >= 70 ? 'text-success' : screeningResult.score >= 50 ? 'text-warning' : 'text-error'}`}>{screeningResult.score.toFixed(0)}/100</span> ({screeningResult.totalPassed} Pass, {screeningResult.totalFailed} Fail)
                </div>
                
                {wells.length > 0 && (
                  <div className="col-span-2 pt-2 border-t border-theme/10 space-y-2">
                    <div className="text-[10px] text-muted uppercase font-bold">Adjust Injection Rates:</div>
                    {wells.map((w, idx) => (
                      <div key={w.id} className="space-y-1">
                        <div className="flex justify-between text-xs text-secondary font-semibold">
                          <span className="truncate max-w-[65%]">Well {idx + 1} ({w.label || 'Injector'}):</span>
                          <span>{w.injectionRate.toFixed(3)} Mt/y</span>
                        </div>
                        <input
                          type="range"
                          min={0.05}
                          max={3.0}
                          step={0.05}
                          value={w.injectionRate}
                          disabled={isLocked}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            updateWellRate(w.id, val)
                            useUIStore.getState().setStageComplete('stage3', false)
                            reset()
                            setInputsVerified(false)
                          }}
                          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-accent/20 bg-accent/5">
            <input
              type="checkbox"
              id="confirm-inputs"
              className="mt-0.5 w-4 h-4 accent-accent cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              checked={inputsVerified}
              disabled={isLocked}
              onChange={(e) => setInputsVerified(e.target.checked)}
            />
            <label htmlFor="confirm-inputs" className="text-xs font-mono text-secondary leading-normal cursor-pointer select-none">
              <strong>Freeze parameters:</strong> I confirm inputs and geomechanical limits are checked.
            </label>
          </div>
        </div>
      )}

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
            <button
              disabled={!inputsVerified || isLocked}
              onClick={() => guardedAction(() => {
                setValidation(liveValidation)
                setForceRun(true)
                runAnimation()
              })}
              className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={12} /> Run Anyway
            </button>
            <button onClick={() => setForceRun(false)}
              className="flex-1 py-2 rounded bg-tertiary text-secondary hover:text-primary text-[11px] font-mono transition"
              disabled={isLocked}>
              Fix Parameters
            </button>
          </div>
        </div>
      )}

      {!hasFailures && !isAnimating && status === 'idle' && (
        <div className="space-y-2">
          <button
            disabled={!inputsVerified || isLocked}
            onClick={() => guardedAction(() => {
              setValidation(liveValidation)
              runAnimation()
            })}
            className="btn-primary w-full flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={13} /> Run Simulation
          </button>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleIMPES}
                className={`relative w-8 h-4 rounded-full transition-colors ${useIMPES ? 'bg-accent' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useIMPES ? 'translate-x-4' : ''}`} />
              </button>
              <span className="text-[10px] font-mono text-secondary">IMPES Solver</span>
            </div>
            <span className="text-[9px] font-mono text-muted" title="IMPES removes CFL limit. Recommended for k > 500 mD or fine grids.">
              {useIMPES ? 'On' : 'Off'}
            </span>
          </div>
        </div>
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
          <button onClick={() => guardedAction(() => {
            reset()
            setInputsVerified(false)
          })} className="btn-primary w-full flex items-center justify-center gap-1.5 text-[11px]">
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

          {/* Quick Adjust Parameters — locked when a completed result exists */}
          <div className="rounded-xl border border-theme/40 bg-card p-3 space-y-3 shadow-lg mt-3">
            <div className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider border-b border-theme/10 pb-1.5 flex items-center gap-1.5">
              <RotateCcw size={12} className="text-accent" /> Quick Adjust Parameters
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-800 dark:text-amber-300 leading-relaxed">
              <AlertCircle size={12} className="shrink-0 mt-0.5 text-amber-400" />
              Parameters are locked while simulation results are saved. Click <strong>Re-run</strong> above to clear results and adjust parameters.
            </div>

            <div className="space-y-3 opacity-40 pointer-events-none select-none">
              {/* Timeline slider (disabled) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono">
                  <span className="text-muted">Simulation Duration:</span>
                  <span className="text-secondary font-bold">{projectYears} Years</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={projectYears}
                  readOnly
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-not-allowed accent-accent"
                />
              </div>

              {/* Well sliders (disabled) */}
              {wells.map((w, idx) => (
                <div key={w.id} className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="text-muted truncate max-w-[65%]">Well {idx + 1} ({w.label || 'Injector'}):</span>
                    <span className="text-secondary font-bold">{w.injectionRate.toFixed(3)} Mt/y</span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={3.0}
                    step={0.05}
                    value={w.injectionRate}
                    readOnly
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-not-allowed accent-accent"
                  />
                </div>
              ))}
            </div>
          </div>
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
  { key: 'mobilePlume' as const,        label: 'Structural', sublabel: 'caprock confinement', color: '#ef4444', glow: 'rgba(239,68,68,0.20)',  dot: '○' },
]

function ResultDisplay({ result }: { result: NonNullable<ReturnType<typeof useSimulationStore.getState>['result']> }) {
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  // Subscribe to the live timestep so the table refreshes each year during animation
  const liveYear = useUIStore((s) => s.timestep)
  const total = Math.max(0.001, result.residualTrapping + result.solubilityTrapping + result.mineralTrapping + result.mobilePlume)
  const [numSnapshots, setNumSnapshots] = useState<any[]>([])

  useEffect(() => {
    const projectId = useUIStore.getState().currentProjectId
    if (!projectId) return
    db.simulationSnapshots
      .where('projectId')
      .equals(projectId)
      .toArray()
      .then((snaps) => {
        setNumSnapshots(snaps.sort((a, b) => a.year - b.year))
      })
      .catch((err) => console.error('Failed to load snapshots:', err))
  // Re-query on every year change (liveYear) and when animation stops
  }, [liveYear, isAnimating])

  return (
    <div className="space-y-3 pt-1">
      {/* Key metrics */}
      <div className="flex items-center gap-1.5 pb-0.5">
        <BarChart3 size={13} className="text-muted" />
        <span className="text-xs text-muted font-mono uppercase tracking-wider font-bold">Results Summary</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
          <div key={label} className="bg-tertiary rounded-lg px-2.5 py-2 border border-theme">
            <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-1 font-bold">{label}</div>
            <div className="text-xs font-mono font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Overpressure / caprock failure risk warning */}
      {result.overpressureRisk && (
        <div className="rounded-lg border border-error/60 bg-error/10 px-3 py-2.5 space-y-2">
          <div className="text-xs text-error font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
            ⚠ Reservoir Overpressure Risk
          </div>
          <p className="text-xs text-error/80 font-mono leading-relaxed">
            Cumulative injection ({result.storageCapacity.toFixed(2)} Mt) has exceeded the P90 conservative capacity
            ({result.capacityP90.toFixed(2)} Mt). Sustained overpressure will cause reservoir pressure
            to approach <strong>caprock fracture pressure</strong> — the primary CO₂ leakage pathway.
          </p>
          <div className="text-xs text-amber-800 dark:text-amber-300 font-mono space-y-1">
            <div className="font-bold uppercase tracking-wider text-[10px]">To prevent caprock failure:</div>
            <div>• Reduce well injection rate (Formation panel)</div>
            <div>• Check MAIP margin in Geomechanics panel — must be &gt;20%</div>
            <div>• Reduce project years or number of wells</div>
          </div>
        </div>
      )}

      {/* DOE capacity range */}
      <div className="flex items-center justify-between bg-tertiary/40 rounded-lg px-2.5 py-1.5 border border-theme/30">
        <span className="text-[10px] text-muted font-mono uppercase tracking-wider font-bold">DOE Range</span>
        <span className="text-xs font-mono text-success font-semibold">
          P90 {result.capacityP90.toFixed(2)} Mt (low) &nbsp;|&nbsp; P50 {result.totalCapacity.toFixed(2)} Mt &nbsp;|&nbsp; P10 {result.capacityP10.toFixed(2)} Mt (high)
        </span>
      </div>

      {/* Trapping analysis */}
      <div className="pt-1 border-t border-theme/50 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <div className="text-xs text-muted font-mono uppercase tracking-wider font-bold">CO₂ Trapping Dynamics</div>
          {isAnimating && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" title="Live updating" />
          )}
        </div>

        {/* Stacked bar */}
        <div className="relative h-6 rounded-lg overflow-hidden flex bg-tertiary">
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
        <div className="space-y-2.5">
          {TRAP_ITEMS.map(({ key, label, sublabel, color, glow, dot }) => {
            const pct = (result[key] / total) * 100
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color }}>{dot}</span>
                    <span className="text-xs font-mono font-bold" style={{ color }}>{label}</span>
                    <span className="text-[10px] text-muted font-mono">({sublabel})</span>
                  </div>
                  <span className="text-xs font-mono font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-tertiary">
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

      {/* Plume Expansion History */}
      {numSnapshots && numSnapshots.length > 0 && (
        <div className="pt-2 border-t border-theme/50 space-y-2">
          <details className="group cursor-pointer" open>
            <summary className="text-xs text-muted font-mono uppercase tracking-wider flex items-center justify-between select-none hover:text-secondary py-1 font-bold">
              <span>📂 Plume Expansion History</span>
              <span className="text-[9px] text-muted font-mono transition-transform group-open:rotate-90">▶</span>
            </summary>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-tertiary/40 border border-theme/30 p-2 scrollbar-thin">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-theme/30 text-muted uppercase font-bold">
                    <th className="py-1">Year</th>
                    <th className="py-1">Injected (Mt)</th>
                    <th className="py-1">Radius (m)</th>
                    <th className="py-1 text-right">Area (km²)</th>
                  </tr>
                </thead>
                <tbody>
                  {numSnapshots.map((s) => (
                    <tr key={s.year} className="border-b border-theme/10 hover:bg-white/5">
                      <td className="py-1 text-secondary font-bold">Yr {s.year}</td>
                      <td className="py-1">{s.injectedMt.toFixed(2)}</td>
                      <td className="py-1 text-accent font-bold">{s.plumeRadiusM.toFixed(0)} m</td>
                      <td className="py-1 text-right">{s.plumeAreaKm2.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
