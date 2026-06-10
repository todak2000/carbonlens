import { useRef, useState, useMemo, useCallback } from 'react'
import { useFormationStore } from '../../store/formationStore'
import { useUIStore } from '../../store/uiStore'
import { GeometryType } from '../../types'
import { parseLAS } from '../../utils/lasParser'
import { parseCarbonGrid, generateSampleGrid } from '../../utils/gridParser'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import { computeOptimalRate, classifyRate, RATE_STATUS_META, RateEnvelope } from '../../utils/computeOptimalRate'
import { Plus, Trash2, DrillIcon as Drilling, Upload, Info, Move, FileDown, Clock, Sparkles, Brain, CheckCircle2, X } from 'lucide-react'
import { autoOptimizeWells } from '../../utils/autoOptimize'
import { validateGeomechanics } from '../../hooks/useSimulation'

// ── Formation Intelligence Card ───────────────────────────────────────────────
// Shows live risk assessment, year-to-P90, MAIP margin, and actionable guidance
// whenever formation params or well rates change.

interface IntelligenceProps {
  env: RateEnvelope
  totalAnnualRate: number
  projectYears: number
  maipMPa: number
  maipMarginPct: number
  onApplySafeRate: () => void
}

function FormationIntelligenceCard({ env, totalAnnualRate, projectYears, maipMPa, maipMarginPct, onApplySafeRate }: IntelligenceProps) {
  // Classify the total fleet rate vs the P50-scaled envelope
  const perWell = totalAnnualRate  // caller passes total; envelope is per-well * n wells
  const yearsToP90 = totalAnnualRate > 0 ? env.totalCapacityP90 / totalAnnualRate : Infinity
  const yearsToP50 = totalAnnualRate > 0 ? env.totalCapacityP50 / totalAnnualRate : Infinity

  // Derive status from total rate vs scaled envelope
  const atRisk   = yearsToP90 < projectYears
  const aboveP50 = yearsToP50 < projectYears
  const maipRisk = maipMarginPct < 20

  // Highest severity wins
  const severity: 'critical' | 'warning' | 'ok' =
    atRisk || maipMarginPct < 0 ? 'critical' : (aboveP50 || maipRisk) ? 'warning' : 'ok'

  const border = severity === 'critical' ? 'border-error/40 bg-error/5'
    : severity === 'warning' ? 'border-amber-500/40 bg-amber-500/5'
    : 'border-emerald-500/30 bg-emerald-500/5'

  const iconColor = severity === 'critical' ? 'text-error'
    : severity === 'warning' ? 'text-amber-400'
    : 'text-emerald-400'

  // ── Implication text ──────────────────────────────────────────────────────
  let headline = ''
  let body = ''
  let tip = ''

  if (maipMarginPct < 0) {
    headline = 'Injection pressure already exceeds MAIP'
    body = `Wellbore pressure will breach the Maximum Allowable Injection Pressure (${maipMPa.toFixed(1)} MPa) before the project even starts. Caprock fracturing is expected from the first year of injection.`
    tip = 'Apply the safe rate below, or reduce well count / increase caprock cohesion in the Geomechanics panel.'
  } else if (atRisk) {
    headline = `P90 capacity will be exceeded at year ${yearsToP90.toFixed(0)}`
    body = `Total injection rate (${totalAnnualRate.toFixed(3)} Mt/yr) will fill the P90 storage estimate (${env.totalCapacityP90.toFixed(2)} Mt) in ${yearsToP90.toFixed(0)} years — before your ${projectYears}-year project ends. Sustained overpressure beyond P90 pushes reservoir pressure toward fracture pressure, risking caprock seal failure and CO₂ migration upward.`
    tip = 'Reduce injection rate using the slider below, or click "Apply safe rate" to let the engine compute the maximum rate that keeps you within the P90 envelope with MAIP margin.'
  } else if (maipRisk) {
    headline = `MAIP margin is thin (${maipMarginPct.toFixed(0)}%)`
    body = `Wellbore injection pressure is within 20% of the Maximum Allowable Injection Pressure (${maipMPa.toFixed(1)} MPa). Small rate increases or pressure transients could breach the regulatory safety limit.`
    tip = 'Lower the injection rate slider or increase formation depth / caprock cohesion to widen the margin.'
  } else if (aboveP50) {
    headline = `P50 optimal rate exceeded — approaching P90 by year ${yearsToP90.toFixed(0)}`
    body = `Rate is above the DOE P50 optimal. The P90 limit will be reached at year ${yearsToP90.toFixed(0)}. This is acceptable if your project ends before then, but leaves less buffer for pressure transients.`
    tip = 'Consider reducing rate to the P50 optimal for a conservative, well-utilised design.'
  } else {
    headline = 'Formation is well-configured'
    body = `Injection rate is within the DOE P50 optimal envelope. P90 capacity (${env.totalCapacityP90.toFixed(2)} Mt) will not be reached within the ${projectYears}-year project. MAIP margin is ${maipMarginPct.toFixed(0)}% — safe.`
    tip = ''
  }

  return (
    <div className={`rounded-lg border ${border} p-3 space-y-2`}>
      <div className="flex items-center gap-1.5">
        <Brain size={12} className={iconColor} />
        <span className="text-[9px] font-mono font-semibold text-primary uppercase tracking-wider">Formation Intelligence</span>
        <span className={`ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded border ${
          severity === 'critical' ? 'bg-error/10 border-error/30 text-error'
          : severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          {severity === 'critical' ? 'RISK' : severity === 'warning' ? 'CAUTION' : 'SAFE'}
        </span>
      </div>

      {/* Headline */}
      <p className={`text-[10px] font-mono font-semibold leading-snug ${
        severity === 'critical' ? 'text-error' : severity === 'warning' ? 'text-amber-300' : 'text-emerald-300'
      }`}>{headline}</p>

      {/* Explanation */}
      <p className="text-[9px] text-muted font-mono leading-relaxed">{body}</p>

      {/* Metrics strip */}
      <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono">
        <div className="rounded bg-card border border-theme/50 px-1.5 py-1">
          <div className="text-muted text-[7px] uppercase tracking-wider mb-0.5">P90 Capacity</div>
          <div className="text-primary font-semibold">{env.totalCapacityP90.toFixed(2)} Mt</div>
        </div>
        <div className="rounded bg-card border border-theme/50 px-1.5 py-1">
          <div className="text-muted text-[7px] uppercase tracking-wider mb-0.5">Yrs to P90</div>
          <div className={`font-semibold ${atRisk ? 'text-error' : 'text-success'}`}>
            {yearsToP90 > 999 ? '> 999' : yearsToP90.toFixed(0)} yr
          </div>
        </div>
        <div className="rounded bg-card border border-theme/50 px-1.5 py-1">
          <div className="text-muted text-[7px] uppercase tracking-wider mb-0.5">MAIP margin</div>
          <div className={`font-semibold ${maipMarginPct < 0 ? 'text-error' : maipMarginPct < 20 ? 'text-amber-400' : 'text-success'}`}>
            {maipMarginPct.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Tip + action */}
      {tip && (
        <div className="flex items-start gap-1.5 pt-1 border-t border-theme/30">
          <Info size={9} className="text-muted shrink-0 mt-0.5" />
          <p className="text-[8px] text-muted font-mono leading-relaxed flex-1">{tip}</p>
        </div>
      )}
      {severity !== 'ok' && (
        <button
          onClick={onApplySafeRate}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono font-semibold transition"
        >
          <CheckCircle2 size={10} />
          Apply safe rate (geomechanics-validated)
        </button>
      )}
    </div>
  )
}

function ValidationBanner({ issues }: { issues: { type: 'error' | 'warning'; message: string }[] }) {
  if (issues.length === 0) return null
  return (
    <div className="space-y-1 mb-2">
      {issues.map((issue, i) => (
        <div key={i} className={`flex items-start gap-1.5 px-2 py-1.5 rounded text-[10px] font-mono border ${
          issue.type === 'error'
            ? 'bg-error border-error text-error'
            : 'bg-warning border-warning text-warning'
        }`}>
          <span className="font-bold shrink-0">{issue.type === 'error' ? '\u2715' : '\u26a0'}</span>
          {issue.message}
        </div>
      ))}
    </div>
  )
}

const geometries: { value: GeometryType; label: string }[] = [
  { value: 'anticline', label: 'Anticline' },
  { value: 'dome', label: 'Dome' },
  { value: 'fault', label: 'Fault' },
  { value: 'layered', label: 'Layered' },
  { value: 'stratigraphic', label: 'Stratigraphic' },
  { value: 'channel', label: 'Channel Complex' },
  { value: 'gridfile', label: 'Grid File' },
]

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-muted font-mono">{label}</span>
        <span className="text-secondary font-mono">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
  )
}

export default function FormationPanel() {
  const params = useFormationStore((s) => s.params)
  const setParams = useFormationStore((s) => s.setParams)
  const setGeometry = useFormationStore((s) => s.setGeometry)
  const setSaltType = useFormationStore((s) => s.setSaltType)
  const setMonovalent = useFormationStore((s) => s.setMonovalent)
  const setBivalent = useFormationStore((s) => s.setBivalent)
  const wells = useFormationStore((s) => s.wells)
  const addWell = useFormationStore((s) => s.addWell)
  const removeWell = useFormationStore((s) => s.removeWell)
  const setWells = useFormationStore((s) => s.setWells)
  const updateWellRate = useFormationStore((s) => s.updateWellRate)
  const updateWellPosition = useFormationStore((s) => s.updateWellPosition)
  const updateWellLabel = useFormationStore((s) => s.updateWellLabel)
  const updateWellSchedule = useFormationStore((s) => s.updateWellSchedule)

  const projectYears = useUIStore((s) => s.projectYears)
  const setProjectYears = useUIStore((s) => s.setProjectYears)

  const rateEnvelope = useMemo(
    () => computeOptimalRate(params, wells, projectYears),
    [params, wells, projectYears],
  )

  const validationIssues = useMemo(() => {
    const issues: { type: 'error' | 'warning'; message: string }[] = []
    if (params.methaneFraction + params.nitrogenFraction > 1.0)
      issues.push({ type: 'error', message: `CH\u2084 (${(params.methaneFraction*100).toFixed(0)}%) + N\u2082 (${(params.nitrogenFraction*100).toFixed(0)}%) exceeds 100% \u2014 CO\u2082 fraction would be negative` })
    if (params.temperature < -56.3)
      issues.push({ type: 'warning', message: `Temperature ${params.temperature}\u00b0C is below CO\u2082 triple point (\u221256.3\u00b0C)` })
    if (params.pressure <= 0)
      issues.push({ type: 'error', message: 'Initial pressure must be > 0 MPa' })
    if (params.porosity <= 0)
      issues.push({ type: 'error', message: 'Porosity must be > 0' })
    if (wells.length === 0)
      issues.push({ type: 'warning', message: 'No injection wells configured \u2014 add at least one well' })
    const zeroRateWells = wells.filter(w => w.injectionRate <= 0)
    if (zeroRateWells.length > 0)
      issues.push({ type: 'warning', message: `Well${zeroRateWells.length > 1 ? 's' : ''} ${zeroRateWells.map(w => w.label).join(', ')} ha${zeroRateWells.length > 1 ? 've' : 's'} zero injection rate` })
    return issues
  }, [params, wells])

  const setLas = useFormationStore((s) => s.setLas)
  const las = useFormationStore((s) => s.las)
  const setGridData = useFormationStore((s) => s.setGridData)
  const gridData = useFormationStore((s) => s.gridData)
  const loadPreset = useFormationStore((s) => s.load)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  // ── Auto-optimize notice ──────────────────────────────────────────────────
  interface OptNotice { formation: string; perWellRate: number; totalRate: number; p90: number; maip: number }
  const [optNotice, setOptNotice] = useState<OptNotice | null>(null)

  // Compute live MAIP margin from current params + wells for the intelligence card
  const liveMAIP = useMemo(() => {
    if (wells.length === 0) return { maip: 0, maipMarginPct: 100 }
    try {
      const v = validateGeomechanics(params, wells)
      return {
        maip: v.estimatedPInj ?? 0,
        maipMarginPct: v.checks.maip?.value ?? 100,
      }
    } catch {
      return { maip: 0, maipMarginPct: 100 }
    }
  }, [params, wells])

  // Compute total annual rate across all wells
  const totalAnnualRate = useMemo(
    () => wells.reduce((s, w) => s + w.injectionRate, 0),
    [wells],
  )

  // Handler: apply geomechanics-validated safe rate to all wells
  const handleApplySafeRate = useCallback(() => {
    const opt = autoOptimizeWells(params, Math.max(1, wells.length), wells)
    setWells(opt.wells)
  }, [params, wells, setWells])

  // Handler: load a preset AND auto-optimize wells for that formation
  const handlePresetLoad = useCallback((preset: typeof FORMATION_PRESETS[0]) => {
    loadPreset(preset.params, undefined, preset.name)
    setActivePreset(preset.name)
    // Run optimization against the new formation params (not the old ones)
    const opt = autoOptimizeWells(preset.params, Math.max(1, wells.length), wells)
    setWells(opt.wells)
    // Compute P90 for the notice
    const T_K = preset.params.temperature + 273.15
    const rhoCO2Approx = 700 // kg/m³ approx for notice display
    const poreVol = preset.params.area * 1e6 * preset.params.thickness * preset.params.netToGross * preset.params.porosity
    const p90 = poreVol * 0.055 * rhoCO2Approx / 1e9
    setOptNotice({
      formation: preset.name,
      perWellRate: opt.perWellRate,
      totalRate: opt.totalRate,
      p90,
      maip: 0,
    })
  }, [loadPreset, wells, setWells])

  const fileRef = useRef<HTMLInputElement>(null)
  const gridFileRef = useRef<HTMLInputElement>(null)

  const handleLasUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = parseLAS(text)
      if (parsed.depths.length === 0) {
        alert('No depth data found in this LAS file.')
        return
      }
      setLas({
        curves: parsed.curveNames.map((name) => ({
          curveName: name,
          depths: parsed.depths,
          values: parsed.curves[name] || [],
        })),
        depthMin: parsed.depths[0],
        depthMax: parsed.depths[parsed.depths.length - 1],
      })
    } catch {
      alert('Failed to parse LAS file. Check the format.')
    }
  }

  const handleGridUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = parseCarbonGrid(text)
      setGridData(parsed)
      setGeometry('gridfile')
    } catch {
      alert('Failed to parse grid file. Check the format.')
    }
  }

  const handleDownloadSampleGrid = () => {
    const grid = generateSampleGrid()
    const blob = new Blob([JSON.stringify(grid, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_irregular_dome.carbon.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider">Formation Parameters</h2>

      <ValidationBanner issues={validationIssues} />

      <div>
        <label className="text-[11px] text-muted font-mono block mb-1">Presets</label>
        <div className="flex flex-wrap gap-1">
          {FORMATION_PRESETS.map((preset) => {
            const isActive = activePreset === preset.name
            return (
              <button
                key={preset.name}
                onClick={() => handlePresetLoad(preset)}
                title={`${preset.location} — ${preset.description}`}
                className={`px-2 py-1 rounded text-[9px] font-mono transition-all border flex items-center gap-1 ${
                  isActive
                    ? 'bg-accent text-white border-accent shadow-[0_0_6px_rgba(0,196,160,0.4)] font-semibold'
                    : 'bg-tertiary text-muted hover:text-secondary border-theme/30 hover:border-theme/60'
                }`}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white inline-block shrink-0" />}
                {preset.name}
              </button>
            )
          })}
        </div>

        {/* Auto-optimize applied notice */}
        {optNotice && (
          <div className="mt-2 px-2.5 py-2 rounded border border-emerald-500/30 bg-emerald-500/8 flex items-start gap-2">
            <CheckCircle2 size={11} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-emerald-300 font-mono font-semibold leading-snug">
                Wells auto-optimized for {optNotice.formation}
              </p>
              <p className="text-[8px] text-emerald-400/70 font-mono leading-relaxed mt-0.5">
                Rate set to {optNotice.perWellRate.toFixed(3)} Mt/yr per well (total {optNotice.totalRate.toFixed(3)} Mt/yr) — maximum safe rate validated against MAIP, caprock fracture pressure, and Mohr-Coulomb failure criteria. Adjust with the slider below.
              </p>
            </div>
            <button onClick={() => setOptNotice(null)} className="text-emerald-400/50 hover:text-emerald-400 transition shrink-0">
              <X size={10} />
            </button>
          </div>
        )}

        {/* Active preset info card */}
        {activePreset && (() => {
          const p = FORMATION_PRESETS.find((p) => p.name === activePreset)
          return p ? (
            <div className="mt-2 px-2.5 py-2 rounded border border-accent/50 bg-accent/10 shadow-[0_0_8px_rgba(0,196,160,0.12)]">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse inline-block" />
                  <span className="text-[10px] text-accent font-mono font-semibold">{p.name}</span>
                </div>
                <span className="text-[8px] text-muted font-mono">{p.location}</span>
              </div>
              <p className="text-[8px] text-muted/80 font-mono leading-tight">{p.description}</p>
            </div>
          ) : null
        })()}
      </div>

      <Slider label="Depth" value={params.depth} min={500} max={4000} step={10} unit=" m" onChange={(v) => setParams({ depth: v })} />
      <Slider label="Thickness (Storage Interval)" value={params.thickness} min={10} max={500} step={5} unit=" m" onChange={(v) => setParams({ thickness: v })} />
      <Slider label="Porosity" value={params.porosity * 100} min={5} max={40} step={0.5} unit=" %" onChange={(v) => setParams({ porosity: v / 100 })} />
      <Slider label="Permeability" value={params.permeability} min={1} max={5000} step={10} unit=" mD" onChange={(v) => setParams({ permeability: v })} />
      <Slider label="Pressure" value={params.pressure} min={5} max={60} step={0.1} unit=" MPa" onChange={(v) => setParams({ pressure: v })} />
      <Slider label="Temperature" value={params.temperature} min={20} max={150} step={1} unit=" °C" onChange={(v) => setParams({ temperature: v })} />
      <Slider label="Area" value={params.area} min={1} max={100} step={0.5} unit=" km²" onChange={(v) => setParams({ area: v })} />
      <Slider label="Net-to-Gross" value={params.netToGross * 100} min={30} max={100} step={1} unit=" %" onChange={(v) => setParams({ netToGross: v / 100 })} />
      <div className="text-[9px] text-muted/60 font-mono -mt-1.5 leading-tight">
        Net-to-gross = ratio of reservoir-quality rock to total formation thickness.
        Shale/silt layers are excluded. Affects containment probability and storage capacity.
      </div>

      <div>
        <label className="text-[11px] text-muted font-mono block mb-1">Geometry Type</label>
        <div className="flex flex-wrap gap-1">
          {geometries.map((g) => (
            <button key={g.value} onClick={() => setGeometry(g.value)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono transition ${params.geometryType === g.value ? 'bg-accent text-white' : 'bg-tertiary text-muted hover:text-secondary'}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        {params.geometryType === 'gridfile' && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <input ref={gridFileRef} type="file" accept=".json" onChange={handleGridUpload} className="hidden" />
              <button onClick={() => gridFileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono bg-tertiary text-muted hover:text-secondary"
              >
                <Upload size={12} /> Upload .carbon.json
              </button>
              <button onClick={handleDownloadSampleGrid}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono bg-tertiary text-muted hover:text-secondary"
              >
                <FileDown size={12} /> Sample
              </button>
            </div>
            {gridData && <p className="text-[10px] text-accent font-mono">Loaded: {gridData.name} ({gridData.nx}×{gridData.nz})</p>}
          </div>
        )}
      </div>

      <div>
        <label className="text-[11px] text-muted font-mono block mb-1">Salt Type</label>
        <div className="flex gap-1">
          {(['NaCl', 'CaCl2', 'Mixed'] as const).map((t) => (
            <button key={t} onClick={() => setSaltType(t)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono transition ${params.saltType === t ? 'bg-accent text-white' : 'bg-tertiary text-muted hover:text-secondary'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <Slider label="Monovalent Salinity" value={params.monovalentSalinity} min={0} max={5} step={0.01} unit=" mol/kg" onChange={setMonovalent} />
      <Slider label="Bivalent Salinity" value={params.bivalentSalinity} min={0} max={5} step={0.01} unit=" mol/kg" onChange={setBivalent} />
      <Slider label="CH4 Fraction" value={params.methaneFraction * 100} min={0} max={10} step={0.1} unit=" %" onChange={(v) => setParams({ methaneFraction: v / 100 })} />
      <Slider label="N2 Fraction" value={params.nitrogenFraction * 100} min={0} max={10} step={0.1} unit=" %" onChange={(v) => setParams({ nitrogenFraction: v / 100 })} />

      <div className="pt-3 border-t border-theme">
        {/* Project horizon */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-muted font-mono flex items-center gap-1"><Clock size={10} /> Project Years</span>
            <span className="text-secondary font-mono">{projectYears} yr</span>
          </div>
          <input type="range" min={10} max={100} step={5} value={projectYears}
            onChange={(e) => setProjectYears(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[8px] text-muted/60 font-mono mt-0.5">
            <span>10 yr</span><span>100 yr</span>
          </div>
        </div>

        {/* DOE capacity summary */}
        <div className="mb-3 rounded bg-tertiary/50 border border-theme/30 px-2 py-1.5 space-y-0.5">
          <div className="text-[8px] text-muted font-mono uppercase tracking-wider mb-1">DOE Storage Envelope</div>
          {[
            { label: 'P10 (0.51%)', val: rateEnvelope.totalCapacityP10, color: '#94a3b8' },
            { label: 'P50 (2.0%)',  val: rateEnvelope.totalCapacityP50, color: '#34d399' },
            { label: 'P90 (5.5%)',  val: rateEnvelope.totalCapacityP90, color: '#fb923c' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex justify-between text-[9px] font-mono">
              <span className="text-muted">{label}</span>
              <span style={{ color }}>{val.toFixed(2)} Mt</span>
            </div>
          ))}
          <div className="pt-1 border-t border-theme/20 text-[8px] text-muted font-mono flex justify-between">
            <span>Optimal rate / well</span>
            <span className="text-success">{rateEnvelope.optimalRate.toFixed(3)} Mt/yr</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] text-muted font-mono flex items-center gap-1"><Drilling size={12} /> Wells</h3>
          <div className="flex items-center gap-1">
            {wells.length > 0 && (
              <button onClick={() => {
                const opt = autoOptimizeWells(params, wells.length, wells)
                setWells(opt.wells)
              }} className="flex items-center gap-0.5 text-[10px] text-amber hover:text-amber-hover font-mono" title="Auto-place wells and set max safe rate">
                <Sparkles size={11} /> Optimize
              </button>
            )}
            {wells.length < 5 && <button onClick={addWell} className="flex items-center gap-0.5 text-[10px] text-accent hover:text-accent-hover font-mono"><Plus size={11} /> Add</button>}
          </div>
        </div>
        {wells.length === 0 && (
          <p className="text-[10px] text-muted font-mono italic mb-2">No wells configured. Add wells via the Add button or drag them into position on the 3D model.</p>
        )}
        {wells.map((w) => {
          const status = classifyRate(w.injectionRate, rateEnvelope)
          const meta   = RATE_STATUS_META[status]
          const pctOfOptimal = rateEnvelope.optimalRate > 0
            ? (w.injectionRate / rateEnvelope.optimalRate) * 100
            : 0
          // slider fill: optimal = 50% of visual bar; scale relative to maxRate
          const sliderMax = Math.max(5, rateEnvelope.maxRate * 1.5)

          return (
            <div key={w.id} className="mb-3 p-2 rounded bg-tertiary border border-theme/20">
              <div className="flex items-center justify-between mb-1.5">
                <input value={w.label} onChange={(e) => updateWellLabel(w.id, e.target.value)}
                  className="text-xs text-secondary font-mono bg-transparent border-b border-theme/30 outline-none focus:border-accent px-0 py-0 w-28"
                />
                <button onClick={() => removeWell(w.id)} className="flex items-center gap-0.5 text-[10px] text-muted hover:text-error font-mono"><Trash2 size={10} /> Remove</button>
              </div>

              {/* Position sliders */}
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-muted font-mono">X</span>
                    <span className="text-secondary font-mono">{w.x.toFixed(2)}</span>
                  </div>
                  <input type="range" min={-1.5} max={1.5} step={0.05} value={w.x} onChange={(e) => updateWellPosition(w.id, parseFloat(e.target.value), w.z)} className="w-full" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-muted font-mono">Z</span>
                    <span className="text-secondary font-mono">{w.z.toFixed(2)}</span>
                  </div>
                  <input type="range" min={-1.5} max={1.5} step={0.05} value={w.z} onChange={(e) => updateWellPosition(w.id, w.x, parseFloat(e.target.value))} className="w-full" />
                </div>
              </div>

              {/* Injection rate with UX feedback */}
              <div className="mb-1.5">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-muted font-mono">Injection rate</span>
                   <span className="font-mono font-semibold" style={{ color: meta.color }}>
                    {w.injectionRate.toFixed(3)} Mt/yr
                  </span>
                </div>
                <input type="range" min={0.001} max={sliderMax} step={0.001}
                  value={w.injectionRate}
                  onChange={(e) => updateWellRate(w.id, parseFloat(e.target.value))}
                  className="w-full"
                />
                {/* Deviation bar */}
                <div className="relative h-3 rounded overflow-hidden mt-1" style={{ background: 'rgba(15,25,40,0.7)' }}>
                  {/* P10 marker */}
                  <div className="absolute top-0 bottom-0 w-px bg-slate-400/50"
                    style={{ left: `${Math.min(99, (rateEnvelope.minRate / sliderMax) * 100)}%` }} />
                  {/* P50 (optimal) marker */}
                  <div className="absolute top-0 bottom-0 w-px bg-teal-400/80"
                    style={{ left: `${Math.min(99, (rateEnvelope.optimalRate / sliderMax) * 100)}%` }} />
                  {/* P90 marker */}
                  <div className="absolute top-0 bottom-0 w-px bg-orange-400/80"
                    style={{ left: `${Math.min(99, (rateEnvelope.maxRate / sliderMax) * 100)}%` }} />
                  {/* Current rate fill */}
                  <div className="absolute top-0 bottom-0 left-0 rounded transition-all duration-150"
                    style={{
                      width: `${Math.min(100, (w.injectionRate / sliderMax) * 100)}%`,
                      background: meta.color,
                      opacity: 0.35,
                    }}
                  />
                </div>
                {/* Legend labels */}
                <div className="flex justify-between text-[7px] font-mono mt-0.5" style={{ color: '#475569' }}>
                  <span style={{ marginLeft: `${Math.min(85, (rateEnvelope.minRate / sliderMax) * 100)}%` }}>P10</span>
                  <span style={{ position: 'absolute', marginLeft: `${Math.min(85, (rateEnvelope.optimalRate / sliderMax) * 100 - 3)}%` }}>P50</span>
                  <span>P90</span>
                </div>
                {/* Status badge */}
                <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-mono"
                  style={{ background: meta.bg, color: meta.color }}>
                  <span>{meta.label}</span>
                  <span className="ml-auto opacity-70">{pctOfOptimal.toFixed(0)}% of optimal</span>
                </div>
              </div>

              {/* Ramp schedule */}
              <div className="flex gap-2 mt-1">
                <div className="flex-1">
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-muted font-mono">Ramp-up</span>
                    <span className="text-secondary font-mono">{w.rampUpYears} yr</span>
                  </div>
                  <input type="range" min={1} max={Math.floor(projectYears / 3)} step={1}
                    value={w.rampUpYears}
                    onChange={(e) => updateWellSchedule(w.id, parseFloat(e.target.value), w.rampDownYears)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-muted font-mono">Ramp-down</span>
                    <span className="text-secondary font-mono">{w.rampDownYears} yr</span>
                  </div>
                  <input type="range" min={1} max={Math.floor(projectYears / 3)} step={1}
                    value={w.rampDownYears}
                    onChange={(e) => updateWellSchedule(w.id, w.rampUpYears, parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Formation Intelligence Card — live risk assessment */}
      {wells.length > 0 && (
        <FormationIntelligenceCard
          env={rateEnvelope}
          totalAnnualRate={totalAnnualRate}
          projectYears={projectYears}
          maipMPa={liveMAIP.maip}
          maipMarginPct={liveMAIP.maipMarginPct}
          onApplySafeRate={handleApplySafeRate}
        />
      )}

      <div className="pt-2 border-t border-theme">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] text-muted font-mono flex items-center gap-1"><Upload size={12} /> LAS Well Log</h3>
        </div>
        <div className="bg-tertiary/50 rounded p-2 mb-2">
          <p className="text-[9px] text-muted font-mono leading-relaxed flex items-start gap-1">
            <Info size={10} className="shrink-0 mt-0.5" />
            LAS is well log data (depth vs. porosity/permeability), not a 3D mesh. When loaded, it colors the formation by the measured porosity at each depth.
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".las" onChange={handleLasUpload} className="hidden" />
        <div className="flex gap-1">
          <button onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 text-[10px] px-3 py-2 rounded-md font-mono bg-tertiary text-muted hover:text-secondary transition"
          >
            <Upload size={11} />
            {las ? 'Replace' : 'Upload .las'}
          </button>
          <a href="/sample_well.las" download
            className="flex items-center gap-1 text-[10px] px-2.5 py-2 rounded-md font-mono bg-tertiary text-accent hover:text-white hover:bg-accent transition"
          >
            Download sample
          </a>
        </div>
        {las ? (
          <p className="text-[10px] text-accent font-mono mt-1">
            {las.curves.length} curve(s) loaded ({las.depthMin}–{las.depthMax} m) — 3D model colors updated
          </p>
        ) : (
          <p className="text-[10px] text-muted font-mono mt-1 italic">
            No LAS loaded. Formation uses uniform porosity color from slider.
          </p>
        )}
      </div>
    </div>
  )
}
