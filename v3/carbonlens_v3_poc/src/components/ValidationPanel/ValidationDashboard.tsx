import { useState, useCallback, useMemo } from 'react'
import {
  ShieldCheck, RefreshCw, Download, AlertTriangle, CheckCircle2,
  FlaskConical, Layers, GitCompare, Bookmark, BookOpen, ChevronDown, ChevronRight,
} from 'lucide-react'
import { validateAnalyticalVsSleipner, formatValidationTable, ValidationResult } from '../../utils/benchmarkValidation'
import {
  validateSensitivity, validateAllPresets, validatePhysicsSanity, validateAgainstPreset,
  PresetBenchmarkResult, SensitivityResult, SanityCheck, PresetComparison,
} from '../../utils/sensitivityValidation'
import { useSimulationStore } from '../../store/simulationStore'
import { useFormationStore } from '../../store/formationStore'

type Tab = 'checks' | 'compare' | 'benchmark'

export default function ValidationDashboard() {
  const [tab, setTab] = useState<Tab>('checks')

  // ── Sleipner benchmark state ──────────────────────────────────────────────
  const [sleipnerResults, setSleipnerResults] = useState<ValidationResult[] | null>(null)
  const [sleipnerRunning, setSleipnerRunning] = useState(false)

  // ── Preset scan state ─────────────────────────────────────────────────────
  const [presetResults, setPresetResults] = useState<PresetBenchmarkResult[] | null>(null)
  const [presetRunning, setPresetRunning] = useState(false)
  const [presetsExpanded, setPresetsExpanded] = useState(false)

  // ── Sensitivity expand state ──────────────────────────────────────────────
  const [sensitivityExpanded, setSensitivityExpanded] = useState(false)

  // ── Store selectors ───────────────────────────────────────────────────────
  const params           = useFormationStore((s) => s.params)
  const activePresetName = useFormationStore((s) => s.activePresetName)
  const result           = useSimulationStore((s) => s.result)
  const baseResult       = useSimulationStore((s) => s.baselineResult)
  const baseParams       = useSimulationStore((s) => s.baselineParams)

  // ── Physics sanity (auto, from current result) ────────────────────────────
  const sanityChecks: SanityCheck[] = useMemo(
    () => validatePhysicsSanity(params, result ?? null),
    [params, result],
  )

  // ── Sensitivity (auto, from baseline vs current) ──────────────────────────
  const sensitivityResults: SensitivityResult[] = useMemo(() => {
    if (!baseResult || !baseParams || !result) return []
    return validateSensitivity(baseParams, baseResult, params, result)
  }, [baseResult, baseParams, result, params])

  // ── Preset comparison (auto, when a preset is loaded and sim was run) ──────
  const presetComparison: PresetComparison | null = useMemo(() => {
    if (!activePresetName || !result) return null
    return validateAgainstPreset(activePresetName, params, result)
  }, [activePresetName, params, result])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const runSleipner = useCallback(() => {
    setSleipnerRunning(true)
    setTimeout(() => {
      try { setSleipnerResults(validateAnalyticalVsSleipner(25)) }
      finally { setSleipnerRunning(false) }
    }, 50)
  }, [])

  const runPresets = useCallback(() => {
    setPresetRunning(true)
    setTimeout(() => {
      try { setPresetResults(validateAllPresets()) }
      finally { setPresetRunning(false) }
    }, 50)
  }, [])

  const exportSleipner = useCallback(() => {
    if (!sleipnerResults) return
    const text = formatValidationTable(sleipnerResults)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `carbonlens-validation-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [sleipnerResults])

  // ── Tab dot indicators ────────────────────────────────────────────────────
  const checksHasFail = result != null && sanityChecks.some((c) => !c.pass)
  const compareHasPreset = !!activePresetName && !!result

  const TABS: { id: Tab; label: string; redDot?: boolean; greenDot?: boolean }[] = [
    { id: 'checks',    label: 'Checks',    redDot: checksHasFail },
    { id: 'compare',   label: 'Compare',   greenDot: compareHasPreset },
    { id: 'benchmark', label: 'Benchmark' },
  ]

  return (
    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
        <ShieldCheck size={13} /> Validation
      </h2>

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-tertiary rounded p-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 relative flex items-center justify-center gap-1 py-1.5 rounded text-[9px] font-mono transition ${
              tab === t.id
                ? 'bg-accent text-white'
                : 'text-muted hover:text-secondary'
            }`}
          >
            {t.label}
            {t.redDot && tab !== t.id && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-error" />
            )}
            {t.greenDot && tab !== t.id && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-success" />
            )}
          </button>
        ))}
      </div>

      {/* ── Checks tab ───────────────────────────────────────────────────── */}
      {tab === 'checks' && (
        <ChecksTab
          checks={sanityChecks}
          hasResult={!!result}
          sensitivityResults={sensitivityResults}
          hasBaseline={!!baseResult}
          baseParams={baseParams}
          currentParams={params}
          sensitivityExpanded={sensitivityExpanded}
          onToggleSensitivity={() => setSensitivityExpanded((v) => !v)}
        />
      )}

      {/* ── Compare tab ──────────────────────────────────────────────────── */}
      {tab === 'compare' && (
        <CompareTab
          comparison={presetComparison}
          activePresetName={activePresetName}
          hasResult={!!result}
          presetResults={presetResults}
          presetRunning={presetRunning}
          presetsExpanded={presetsExpanded}
          onTogglePresets={() => setPresetsExpanded((v) => !v)}
          onRunPresets={runPresets}
        />
      )}

      {/* ── Benchmark tab ─────────────────────────────────────────────────── */}
      {tab === 'benchmark' && (
        <SleipnerTab
          results={sleipnerResults}
          running={sleipnerRunning}
          onRun={runSleipner}
          onExport={exportSleipner}
        />
      )}
    </div>
  )
}

// ── Checks tab ────────────────────────────────────────────────────────────────

function ChecksTab({
  checks, hasResult, sensitivityResults, hasBaseline, baseParams, currentParams,
  sensitivityExpanded, onToggleSensitivity,
}: {
  checks: SanityCheck[]
  hasResult: boolean
  sensitivityResults: SensitivityResult[]
  hasBaseline: boolean
  baseParams: import('../../types').FormationParams | null
  currentParams: import('../../types').FormationParams
  sensitivityExpanded: boolean
  onToggleSensitivity: () => void
}) {
  if (!hasResult) {
    return (
      <div className="text-[9px] text-muted font-mono italic py-6 text-center">
        Run a simulation to see physics validation.
      </div>
    )
  }

  const passed = checks.filter((c) => c.pass).length
  const total = checks.length

  return (
    <div className="space-y-2">
      <SummaryBadge passed={passed} total={total} label="physics checks" />
      {checks.map((c) => (
        <SanityRow key={c.id} check={c} />
      ))}
      <p className="text-[8px] text-muted/50 font-mono leading-relaxed pt-1">
        Checks: supercritical T/P conditions, CO₂ density range, injection below MAIP (0.9×fracPres),
        and DOE Goodman 2011 formula self-consistency.
      </p>

      {/* Sensitivity sub-section */}
      <div className="border-t border-theme/30 pt-2">
        <button
          onClick={onToggleSensitivity}
          className="flex items-center gap-1.5 text-[9px] font-mono text-muted hover:text-secondary transition w-full"
        >
          {sensitivityExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <GitCompare size={9} />
          <span>± Sensitivity</span>
          {sensitivityResults.length > 0 && (
            <span className="ml-auto text-[8px] font-mono text-muted">
              {sensitivityResults.filter((r) => r.pass).length}/{sensitivityResults.length}
            </span>
          )}
        </button>

        {sensitivityExpanded && (
          <div className="mt-2">
            <SensitivityContent
              results={sensitivityResults}
              hasBaseline={hasBaseline}
              hasResult={hasResult}
              baseParams={baseParams}
              currentParams={currentParams}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SanityRow({ check }: { check: SanityCheck }) {
  return (
    <div className="rounded border border-theme/30 bg-card/50 px-3 py-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-semibold text-primary">{check.label}</span>
        <StatusBadge pass={check.pass} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 text-[9px] font-mono text-muted">
        <div>Value: <span className="text-secondary">{check.value}</span></div>
        <div>Expected: <span className="text-secondary">{check.expected}</span></div>
      </div>
      <div className="text-[8px] text-muted/50 font-mono italic">{check.note}</div>
    </div>
  )
}

// ── Sensitivity content (shared, used inside Checks tab accordion) ────────────

function SensitivityContent({
  results, hasBaseline, hasResult, baseParams,
}: {
  results: SensitivityResult[]
  hasBaseline: boolean
  hasResult: boolean
  baseParams: import('../../types').FormationParams | null
  currentParams: import('../../types').FormationParams
}) {
  if (!hasBaseline) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 bg-tertiary rounded px-3 py-2.5 border border-theme/40">
          <Bookmark size={12} className="text-muted shrink-0 mt-0.5" />
          <div className="text-[9px] font-mono text-muted leading-relaxed">
            <div className="text-secondary font-semibold mb-1">How to use:</div>
            <div>1. Run a simulation</div>
            <div>2. Click <span className="text-accent">Baseline</span> in the Simulation panel</div>
            <div>3. Modify a parameter and re-run</div>
          </div>
        </div>
      </div>
    )
  }

  if (!hasResult) {
    return (
      <div className="text-[9px] text-muted font-mono italic py-3 text-center">
        Baseline locked. Re-run with modified parameters to compare.
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-[9px] text-muted font-mono italic py-2 text-center">
        No parameter changes detected vs baseline.
      </div>
    )
  }

  const passed = results.filter((r) => r.pass).length

  return (
    <div className="space-y-2">
      <SummaryBadge passed={passed} total={results.length} label="sensitivity checks pass" />

      {baseParams && (
        <div className="bg-tertiary rounded px-2 py-1.5 border border-theme/30 space-y-0.5">
          <div className="text-[8px] text-muted font-mono uppercase tracking-wider mb-1">Parameter changes vs baseline</div>
          {results.map((r) => (
            <div key={r.ruleId} className="text-[9px] font-mono text-secondary">
              {r.paramLabel}: {formatChange(r.paramChangePct)}
            </div>
          ))}
        </div>
      )}

      {results.map((r) => <SensitivityRow key={r.ruleId} result={r} />)}

      <p className="text-[8px] text-muted/50 font-mono leading-relaxed pt-1">
        Tolerances: capacity ±15%, pressure ±40% (Theis log-linear).
      </p>
    </div>
  )
}

function SensitivityRow({ result: r }: { result: SensitivityResult }) {
  const directionArrow = r.relationship === 'linear'
    ? (r.paramChangePct > 0 ? '↑' : '↓')
    : (r.paramChangePct > 0 ? '↓' : '↑')

  return (
    <div className="rounded border border-theme/30 bg-card/50 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-semibold text-primary">
          {r.paramLabel} → {r.resultLabel}
        </span>
        <StatusBadge pass={r.pass} deviation={r.deviationPct} />
      </div>

      <div className="text-[9px] font-mono text-muted">
        Param: <span className="text-secondary">{formatChange(r.paramChangePct)}</span>
        {' '}→ {r.resultLabel} expected {directionArrow}{' '}
        <span className="text-secondary">{Math.abs((r.expectedRatio - 1) * 100).toFixed(1)}%</span>
      </div>

      <div className="text-[9px] font-mono text-muted">
        Actual: {r.baseResultVal.toFixed(2)} → <span className="text-secondary">{r.newResultVal.toFixed(2)} {r.unit}</span>
        {' '}({formatChange((r.actualRatio - 1) * 100)})
      </div>

      <div className="space-y-0.5">
        <div className="flex justify-between text-[8px] font-mono text-muted">
          <span>{r.explanation}</span>
          <span className={Math.abs(r.deviationPct) <= r.tolerance ? 'text-success' : 'text-error'}>
            Δ{r.deviationPct > 0 ? '+' : ''}{r.deviationPct.toFixed(1)}% (tol ±{r.tolerance.toFixed(0)}%)
          </span>
        </div>
        <div className="h-1 bg-tertiary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${r.pass ? 'bg-success' : 'bg-error'}`}
            style={{ width: `${Math.min(100, Math.abs(r.deviationPct) / r.tolerance * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

// ── Compare tab ───────────────────────────────────────────────────────────────

function CompareTab({
  comparison, activePresetName, hasResult,
  presetResults, presetRunning, presetsExpanded, onTogglePresets, onRunPresets,
}: {
  comparison: PresetComparison | null
  activePresetName: string | null
  hasResult: boolean
  presetResults: PresetBenchmarkResult[] | null
  presetRunning: boolean
  presetsExpanded: boolean
  onTogglePresets: () => void
  onRunPresets: () => void
}) {
  return (
    <div className="space-y-3">
      {/* Active preset comparison */}
      {!activePresetName ? (
        <div className="text-[9px] text-muted font-mono italic py-4 text-center">
          Load a formation preset to compare results against reference data.
        </div>
      ) : !hasResult ? (
        <div className="text-[9px] text-muted font-mono italic py-6 text-center">
          <span className="text-secondary">{activePresetName}</span> loaded.<br />
          Run a simulation to compare against its reference baseline.
        </div>
      ) : !comparison ? (
        <div className="text-[9px] text-error font-mono py-4 text-center">
          Could not find reference data for &quot;{activePresetName}&quot;.
        </div>
      ) : (
        <PresetComparisonView comparison={comparison} />
      )}

      {/* Compare all presets accordion */}
      <div className="border-t border-theme/30 pt-2">
        <button
          onClick={onTogglePresets}
          className="flex items-center gap-1.5 text-[9px] font-mono text-muted hover:text-secondary transition w-full"
        >
          {presetsExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <Layers size={9} />
          <span>Compare all presets</span>
        </button>

        {presetsExpanded && (
          <div className="mt-2 space-y-2">
            <p className="text-[9px] text-muted font-mono leading-relaxed">
              Analytically validates all 16 preset formations using the DOE Goodman 2011 formula
              and Span-Wagner CO₂ EOS. No simulation run required.
            </p>
            <button
              onClick={onRunPresets}
              disabled={presetRunning}
              className="flex items-center gap-1.5 px-3 py-2 rounded bg-accent text-white text-[10px] font-mono hover:bg-accent/80 transition disabled:opacity-50"
            >
              <RefreshCw size={11} className={presetRunning ? 'animate-spin' : ''} />
              {presetRunning ? 'Scanning…' : 'Scan All Presets'}
            </button>

            {presetResults && (
              <div className="space-y-1.5">
                <SummaryBadge
                  passed={presetResults.filter((r) => r.isSupercritical && r.densityOk && r.pressureOk).length}
                  total={presetResults.length}
                  label="formations pass all checks"
                />
                {presetResults.map((r) => <PresetRow key={r.name} result={r} />)}
              </div>
            )}

            {!presetResults && !presetRunning && (
              <div className="text-[9px] text-muted font-mono italic py-2 text-center">
                Click &quot;Scan All Presets&quot; to validate formation conditions.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PresetComparisonView({ comparison }: { comparison: PresetComparison }) {
  const passed = comparison.items.filter((i) => i.pass).length

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-mono font-semibold text-primary">{comparison.presetName}</div>
          <div className="text-[8px] text-muted font-mono">{comparison.location}</div>
        </div>
        {comparison.hasLiteratureData && (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30">
            Field data available
          </span>
        )}
      </div>

      <div className="bg-tertiary/60 rounded px-2.5 py-2 border border-theme/30 text-[8px] font-mono text-muted/80 leading-relaxed italic">
        {comparison.literatureNote}
      </div>

      <SummaryBadge passed={passed} total={comparison.items.length} label="checks vs preset reference" />

      {comparison.items.map((item) => (
        <CompareRow key={item.id} item={item} />
      ))}

      {comparison.paramChanges.length > 0 && (
        <div className="pt-1 border-t border-theme/30 space-y-1.5">
          <div className="text-[9px] text-muted font-mono uppercase tracking-wider">
            Your changes from preset defaults
          </div>
          {comparison.paramChanges.map((c) => (
            <div key={c.label} className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-muted">{c.label}</span>
              <span className="text-secondary">
                {c.presetVal} → {typeof c.yourVal === 'number' ? c.yourVal.toFixed(
                  c.yourVal < 1 ? 3 : c.yourVal < 10 ? 2 : 1
                ) : c.yourVal}
                <span className={`ml-1.5 ${c.changePct > 0 ? 'text-warning' : 'text-warning'}`}>
                  ({c.changePct > 0 ? '+' : ''}{c.changePct.toFixed(1)}%)
                </span>
              </span>
            </div>
          ))}

          <div className="bg-tertiary rounded px-2.5 py-2 border border-theme/30 space-y-1">
            <div className="text-[8px] font-mono text-muted uppercase tracking-wider">P50 Deviation Accounting</div>
            <div className="text-[9px] font-mono text-secondary">
              Param changes imply: {comparison.p50ExplainedChangePct > 0 ? '+' : ''}{comparison.p50ExplainedChangePct.toFixed(1)}%
            </div>
            <div className="text-[9px] font-mono text-secondary">
              Actual change: {comparison.p50ActualChangePct > 0 ? '+' : ''}{comparison.p50ActualChangePct.toFixed(1)}%
            </div>
            <div className={`text-[9px] font-mono ${Math.abs(comparison.residualDeviationPct) < 5 ? 'text-success' : 'text-warning'}`}>
              Residual (unexplained): {comparison.residualDeviationPct > 0 ? '+' : ''}{comparison.residualDeviationPct.toFixed(1)}%
              {Math.abs(comparison.residualDeviationPct) < 5 ? ' ✓' : ' — check T/P changes'}
            </div>
          </div>
        </div>
      )}

      {comparison.paramChanges.length === 0 && (
        <div className="text-[9px] text-muted font-mono italic text-center py-1">
          No parameter changes from preset defaults detected.
        </div>
      )}
    </div>
  )
}

function CompareRow({ item }: { item: import('../../utils/sensitivityValidation').PresetComparisonItem }) {
  return (
    <div className="rounded border border-theme/30 bg-card/50 px-3 py-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-semibold text-primary">{item.label}</span>
        <StatusBadge pass={item.pass} deviation={item.deviationPct} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 text-[9px] font-mono text-muted">
        <div>Reference: <span className="text-secondary">{item.reference.toFixed(2)} {item.unit}</span></div>
        <div>Yours: <span className="text-secondary">{item.actual.toFixed(2)} {item.unit}</span></div>
      </div>
      <div className="text-[8px] text-muted/60 font-mono italic">{item.note}</div>
    </div>
  )
}

function PresetRow({ result: r }: { result: PresetBenchmarkResult }) {
  const allOk = r.isSupercritical && r.densityOk && r.pressureOk
  return (
    <div className="rounded border border-theme/30 bg-card/50 px-3 py-2 space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono font-semibold text-primary">{r.name}</span>
          <span className="text-[8px] text-muted font-mono ml-2">{r.location}</span>
        </div>
        <StatusBadge pass={allOk} />
      </div>
      <div className="grid grid-cols-3 gap-x-2 text-[9px] font-mono text-muted">
        <div>T: <span className="text-secondary">{r.temperature}°C</span></div>
        <div>P: <span className="text-secondary">{r.pressure.toFixed(1)} MPa</span></div>
        <div>ρ: <span className={r.densityOk ? 'text-success' : 'text-error'}>{r.co2Density.toFixed(0)} kg/m³</span></div>
      </div>
      <div className="grid grid-cols-2 gap-x-2 text-[9px] font-mono text-muted">
        <div>P50: <span className="text-secondary">{r.expectedP50Mt.toFixed(1)} Mt</span></div>
        <div>MAIP: <span className="text-secondary">{r.maipMPa.toFixed(1)} MPa</span></div>
      </div>
      {!allOk && (
        <div className="text-[8px] text-warning font-mono">
          {!r.isSupercritical && '⚠ Not supercritical (T or P below critical point) '}
          {!r.densityOk && '⚠ CO₂ density out of range '}
          {!r.pressureOk && '⚠ Reservoir pressure < 7.38 MPa'}
        </div>
      )}
    </div>
  )
}

// ── Sleipner / Benchmark tab ───────────────────────────────────────────────────

function SleipnerTab({
  results, running, onRun, onExport,
}: {
  results: ValidationResult[] | null
  running: boolean
  onRun: () => void
  onExport: () => void
}) {
  const passed = results ? results.filter((r) => r.pass).length : 0
  const total  = results ? results.length : 0

  return (
    <div className="space-y-2">
      <p className="text-[9px] text-muted font-mono leading-relaxed">
        Compares the analytical solver against Sleipner Utsira field data
        (Boait 2012, Furre 2017). Pass = within stated tolerance.
      </p>

      <div className="flex gap-2">
        <button
          onClick={onRun}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-2 rounded bg-accent text-white text-[10px] font-mono hover:bg-accent/80 transition disabled:opacity-50"
        >
          <RefreshCw size={11} className={running ? 'animate-spin' : ''} />
          {running ? 'Running…' : 'Run Validation'}
        </button>
        {results && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-tertiary text-secondary text-[10px] font-mono hover:text-primary transition border border-theme"
          >
            <Download size={11} /> Export
          </button>
        )}
      </div>

      {results && (
        <>
          <SummaryBadge passed={passed} total={total} label="checks pass — Sleipner Utsira" />

          <div className="space-y-1.5">
            {results.map((r, i) => (
              <div key={i} className="rounded border border-theme/30 bg-card/50 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-semibold text-primary">{r.metric} (yr {r.year})</span>
                  <StatusBadge pass={r.pass} deviation={r.deviationPct} />
                </div>
                <div className="grid grid-cols-2 gap-x-3 text-[9px] font-mono text-muted">
                  <div>Simulated: <span className="text-secondary">{r.simulated.toFixed(2)} {r.unit}</span></div>
                  <div>Reference: <span className="text-secondary">{r.reference.toFixed(2)} {r.unit}</span></div>
                </div>
                {r.notes && (
                  <div className="text-[8px] text-muted/50 font-mono mt-1 italic">{r.notes}</div>
                )}
              </div>
            ))}
          </div>

          <div className="text-[8px] text-muted/40 font-mono space-y-0.5 pt-2 border-t border-theme/20">
            <div>Benchmark: Sleipner CO₂ Storage Project, North Sea</div>
            <div>References: Boait et al. (2012) JGR; Furre et al. (2017) Energy Procedia</div>
            <div>Tolerance: ±30% plume radius, ±20% density, hard limits for pressure &amp; dissolution</div>
          </div>
        </>
      )}

      {!results && (
        <div className="text-[9px] text-muted font-mono italic py-4 text-center">
          Click &quot;Run Validation&quot; to compare against Sleipner field data.
        </div>
      )}
    </div>
  )
}

// ── Shared components ─────────────────────────────────────────────────────────

function SummaryBadge({ passed, total, label }: { passed: number; total: number; label: string }) {
  const allPass = passed === total
  const mostPass = passed >= total * 0.6
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded border text-[10px] font-mono ${
      allPass
        ? 'bg-success/10 border-success/40 text-success'
        : mostPass
          ? 'bg-warning/10 border-warning/40 text-warning'
          : 'bg-error/10 border-error/40 text-error'
    }`}>
      {allPass ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
      {passed}/{total} {label}
    </div>
  )
}

function StatusBadge({ pass, deviation }: { pass: boolean; deviation?: number }) {
  return (
    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
      pass ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
    }`}>
      {pass ? 'PASS' : 'FAIL'}
      {deviation !== undefined && ` ${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%`}
    </span>
  )
}
