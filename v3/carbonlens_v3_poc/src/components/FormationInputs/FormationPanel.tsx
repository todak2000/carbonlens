import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { useFormationStore } from '../../store/formationStore'
import { useUIStore } from '../../store/uiStore'
import { useSimulationStore } from '../../store/simulationStore'
import { GeometryType, Jurisdiction } from '../../types'
import { WellboreSchematic } from '../WellboreSchematic'
import { parseLAS } from '../../utils/lasParser'
import { parseEclipseDeck } from '../../utils/eclipseParser'
import { parseCarbonGrid, generateSampleGrid } from '../../utils/gridParser'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import { computeOptimalRate, classifyRate, RATE_STATUS_META, RateEnvelope } from '../../utils/computeOptimalRate'
import {
  Plus, Trash2, DrillIcon as Drilling, Upload, Info, Move, FileDown, Clock,
  Sparkles, Brain, CheckCircle2, X, ShieldCheck, AlertTriangle, ChevronRight, ChevronLeft, Layers, Lock,
} from 'lucide-react'
import { autoOptimizeWells } from '../../utils/autoOptimize'
import { validateGeomechanics } from '../../hooks/useSimulation'
import { assessStorageScreening } from '../../engine/classical/storageScreening'
import {
  computeTr, computePr, evaluateMars, scaleInput,
  subEquation, subScaler, supEquation, supScaler,
  assessApplicabilityDomain, determinePhase,
  co2DensitySpanWagner, co2DensityWithImpurities, co2ViscosityFenghour, brineDensityGarcia,
  computeDepletedFieldCapacity,
} from '../../engine'

// ── Sub-step labels ────────────────────────────────────────────────────────────
const SUB_STEPS = [
  { n: 1, label: 'Location & Scale' },
  { n: 2, label: 'Geometry' },
  { n: 3, label: 'Rock Quality' },
  { n: 4, label: 'Fluid Conditions' },
  { n: 5, label: 'CO2 Stream' },
  { n: 6, label: 'Wells' },
] as const

type SubStep = 1 | 2 | 3 | 4 | 5 | 6

// ── Screening status badge ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'green' | 'amber' | 'red' }) {
  if (status === 'green')  return <span className="text-[9px] font-mono text-emerald-400 font-bold">✓</span>
  if (status === 'amber')  return <span className="text-[9px] font-mono text-amber-400 font-bold">~</span>
  return <span className="text-[9px] font-mono text-red-400 font-bold">✗</span>
}

// ── Formation Intelligence Card ───────────────────────────────────────────────
interface IntelligenceProps {
  env: RateEnvelope
  totalAnnualRate: number
  projectYears: number
  maipMPa: number
  maipMarginPct: number
  onApplySafeRate: () => void
}

function FormationIntelligenceCard({ env, totalAnnualRate, projectYears, maipMPa, maipMarginPct, onApplySafeRate }: IntelligenceProps) {
  const yearsToP90 = totalAnnualRate > 0 ? env.totalCapacityP90 / totalAnnualRate : Infinity
  const yearsToP50 = totalAnnualRate > 0 ? env.totalCapacityP50 / totalAnnualRate : Infinity
  const atRisk   = yearsToP90 < projectYears
  const aboveP50 = yearsToP50 < projectYears
  const maipRisk = maipMarginPct < 20
  const severity: 'critical' | 'warning' | 'ok' =
    atRisk || maipMarginPct < 0 ? 'critical' : (aboveP50 || maipRisk) ? 'warning' : 'ok'
  const border = severity === 'critical' ? 'border-error/40 bg-error/5'
    : severity === 'warning' ? 'border-amber-500/40 bg-amber-500/5'
    : 'border-emerald-500/30 bg-emerald-500/5'
  const iconColor = severity === 'critical' ? 'text-error'
    : severity === 'warning' ? 'text-amber-400'
    : 'text-emerald-400'
  const tip = severity === 'critical'
    ? atRisk ? `At current rates, P90 capacity reached in ${yearsToP90.toFixed(0)} yr — below project horizon. Reduce rate or add wells.` : 'MAIP margin negative — injection pressure exceeds fracture gradient. Apply safe rate immediately.'
    : severity === 'warning'
      ? aboveP50 ? `Rate is above P50 envelope — P50 capacity may be exceeded in ${yearsToP50.toFixed(0)} yr.` : 'MAIP margin is low. Minor pressure fluctuations may approach fracture gradient.'
      : ''
  return (
    <div className={`rounded-lg p-2.5 border space-y-2 ${border}`}>
      <div className={`flex items-center gap-1.5 text-[10px] font-mono font-semibold ${iconColor}`}>
        <Brain size={11} />
        Formation Intelligence
      </div>
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
          <span>{issue.message}</span>
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
  badge?: 'green' | 'amber' | 'red'
}

function Slider({ label, value, min, max, step, unit, onChange, badge }: SliderProps) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-muted font-mono flex items-center gap-1">
          {label}
          {badge && <StatusBadge status={badge} />}
        </span>
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
  const updateWellPerforations = useFormationStore((s) => s.updateWellPerforations)

  const projectYears = useUIStore((s) => s.projectYears)
  const setProjectYears = useUIStore((s) => s.setProjectYears)
  const stageCompletion = useUIStore((s) => s.stageCompletion)
  const setStageComplete = useUIStore((s) => s.setStageComplete)
  const setPanel = useUIStore((s) => s.setPanel)
  const setJurisdiction = useUIStore((s) => s.setJurisdiction)

  // ── Sub-step navigation ──────────────────────────────────────────────────────
  const [subStep, setSubStep] = useState<SubStep>(1)

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
      issues.push({ type: 'error', message: 'Pressure must be > 0 MPa' })
    if (params.porosity <= 0)
      issues.push({ type: 'error', message: 'Porosity must be > 0' })
    if (wells.length === 0)
      issues.push({ type: 'warning', message: 'No injection wells configured' })
    return issues
  }, [params, wells])

  const setLas = useFormationStore((s) => s.setLas)
  const las = useFormationStore((s) => s.las)
  const setGridData = useFormationStore((s) => s.setGridData)
  const gridData = useFormationStore((s) => s.gridData)
  const loadPreset = useFormationStore((s) => s.load)
  const activePreset = useFormationStore((s) => s.activePresetName)
  const formationCountry = useFormationStore((s) => s.formationCountry)
  const [presetChangeMode, setPresetChangeMode] = useState(false)

  interface OptNotice { formation: string; perWellRate: number; totalRate: number }
  const [optNotice, setOptNotice] = useState<OptNotice | null>(null)

  const liveMAIP = useMemo(() => {
    if (wells.length === 0) return { maip: 0, maipMarginPct: 100 }
    try {
      const v = validateGeomechanics(params, wells)
      return { maip: v.estimatedPInj ?? 0, maipMarginPct: v.checks.maip?.value ?? 100 }
    } catch {
      return { maip: 0, maipMarginPct: 100 }
    }
  }, [params, wells])

  const totalAnnualRate = useMemo(() => wells.reduce((s, w) => s + w.injectionRate, 0), [wells])

  // ── Storage screening (reactive) ─────────────────────────────────────────────
  const screeningResult = useMemo(() => assessStorageScreening(params), [params])

  // ── Amber acknowledgment state ───────────────────────────────────────────────
  const [amberAcknowledged, setAmberAcknowledged] = useState(false)

  // Reset stage2 whenever params change after confirmation
  useEffect(() => {
    if (stageCompletion.stage2) {
      setStageComplete('stage2', false)
      setAmberAcknowledged(false)
    }
  // Only trigger on params change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Auto-save project whenever parameters or wells change
  useEffect(() => {
    useUIStore.getState().saveCurrentProject()
  }, [params, wells])

  // Auto-derive temperature from geothermal gradient when both gradient and surface T are provided
  useEffect(() => {
    if (params.geothermalGradient != null && params.surfaceTemperatureC != null) {
      const tMid = params.surfaceTemperatureC + params.geothermalGradient * (params.depth + params.thickness / 2) / 100
      const rounded = Math.round(tMid * 10) / 10
      if (Math.abs(rounded - params.temperature) > 0.05) {
        setParams({ temperature: rounded })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.geothermalGradient, params.surfaceTemperatureC, params.depth, params.thickness])

  // ── MARS IFT prediction (sub-step 5) ─────────────────────────────────────────
  const marsIFT = useMemo(() => {
    try {
      const T_K = params.temperature + 273.15
      const P_MPa = params.pressure
      const phase = determinePhase(T_K, P_MPa, params.methaneFraction, params.nitrogenFraction)
      const Pr = computePr(P_MPa, params.methaneFraction, params.nitrogenFraction)
      const Tr = computeTr(T_K, params.methaneFraction, params.nitrogenFraction)
      const MCM = params.monovalentSalinity
      const BCM = params.bivalentSalinity
      const input = {
        Pr, Tr, MCM, BCM,
        x_CH4: params.methaneFraction,
        x_N2: params.nitrogenFraction,
        drho_sq: 0,
        BCM_bin: BCM > 0 ? 1 : 0,
        CH4_bin: params.methaneFraction > 0 ? 1 : 0,
        N2_bin: params.nitrogenFraction > 0 ? 1 : 0,
      }
      let ift: number | null = null
      if (phase === 'subcritical') {
        ift = evaluateMars(scaleInput(input, subScaler), subEquation)
      } else {
        ift = evaluateMars(scaleInput(input, supScaler), supEquation)
      }
      const ad = assessApplicabilityDomain(input, phase)
      return { ift: ift ?? 0, ad, phase }
    } catch {
      return null
    }
  }, [params])

  // ── Fluid properties (sub-step 4 live readout) ────────────────────────────────
  const fluidProps = useMemo(() => {
    try {
      const T_K = params.temperature + 273.15
      const P_Pa = params.pressure * 1e6
      const phase = determinePhase(T_K, params.pressure, params.methaneFraction, params.nitrogenFraction)
      const co2Density = co2DensitySpanWagner(T_K, P_Pa)
      const co2Visc = co2ViscosityFenghour(T_K, co2Density)
      const brineDensity = brineDensityGarcia(T_K, P_Pa, params.monovalentSalinity)
      return { co2Density, co2Visc, brineDensity, phase }
    } catch {
      return null
    }
  }, [params.temperature, params.pressure, params.monovalentSalinity])

  // ── Sub-step 1 validation: depth must be ≥800m to proceed ─────────────────────
  const step1CanProceed = params.depth >= 800

  // ── Sub-step 5 validation: CO2 must be ≥5% ────────────────────────────────────
  const step5CanProceed = (params.methaneFraction + params.nitrogenFraction) < 0.95

  const handleApplySafeRate = useCallback(() => {
    const opt = autoOptimizeWells(params, Math.max(1, wells.length), wells, projectYears)
    setWells(opt.wells)
    // Clear stale simulation results so the sim panel shows updated inputs,
    // not results computed at the old rate.
    useSimulationStore.getState().reset()
    setStageComplete('stage3', false)
    setOptNotice({ formation: activePreset ?? 'Formation', perWellRate: opt.perWellRate, totalRate: opt.totalRate })
  }, [params, wells, setWells, projectYears, activePreset, setStageComplete])

  const handlePresetLoad = useCallback((preset: typeof FORMATION_PRESETS[0]) => {
    // Explicitly clear geothermal gradient fields so the preset's measured temperature
    // is always authoritative. Users can re-enter gradient values afterward if needed.
    loadPreset(
      { ...preset.params, geothermalGradient: undefined, surfaceTemperatureC: undefined },
      undefined,
      preset.name,
      preset.country,
    )
    const opt = autoOptimizeWells(preset.params, Math.max(1, wells.length), wells, projectYears)
    setWells(opt.wells)
    setOptNotice({ formation: preset.name, perWellRate: opt.perWellRate, totalRate: opt.totalRate })
    // Auto-select the regulatory jurisdiction for this formation's country
    setJurisdiction(preset.jurisdiction as Jurisdiction)
  }, [loadPreset, wells, setWells, setJurisdiction])

  const fileRef = useRef<HTMLInputElement>(null)
  const gridFileRef = useRef<HTMLInputElement>(null)
  const eclipseFileRef = useRef<HTMLInputElement>(null)

  const handleLasUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = parseLAS(text)
      if (parsed.depths.length === 0) { alert('No depth data found in this LAS file.'); return }
      setLas({
        curves: parsed.curveNames.map((name) => ({
          curveName: name,
          depths: parsed.depths,
          values: parsed.curves[name] || [],
        })),
        depthMin: parsed.depths[0],
        depthMax: parsed.depths[parsed.depths.length - 1],
      })
    } catch { alert('Failed to parse LAS file. Check the format.') }
  }

  const handleGridUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = parseCarbonGrid(await file.text())
      setGridData(parsed)
      setGeometry('gridfile')
    } catch { alert('Failed to parse grid file. Check the format.') }
  }

  const applyLasAverages = useCallback(() => {
    if (!las) return
    const porCurve = las.curves.find((c) => c.curveName.toUpperCase().includes('POR'))
    const permCurve = las.curves.find((c) => c.curveName.toUpperCase().includes('PERM') || c.curveName.toUpperCase() === 'K')
    const updates: Partial<import('../../types').FormationParams> = {}
    if (porCurve) {
      const v = porCurve.values.filter((x) => x > 0 && x < 1 && isFinite(x))
      if (v.length) updates.porosity = parseFloat((v.reduce((s, x) => s + x, 0) / v.length).toFixed(3))
    }
    if (permCurve) {
      const v = permCurve.values.filter((x) => x > 0 && isFinite(x))
      if (v.length) updates.permeability = parseFloat(Math.pow(10, v.reduce((s, x) => s + Math.log10(x), 0) / v.length).toFixed(1))
    }
    if (Object.keys(updates).length) setParams(updates)
  }, [las, setParams])

  const handleEclipseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = parseEclipseDeck(await file.text())
      if (result.errors.length > 0) { alert(`Eclipse parse errors:\n${result.errors.join('\n')}`); return }
      const updates: Partial<import('../../types').FormationParams> = {}
      if (result.topDepth_m != null && result.dz_m != null && result.grid) {
        updates.depth = Math.round(result.topDepth_m + result.dz_m * result.grid.nz / 2)
        updates.thickness = Math.round(result.dz_m * result.grid.nz)
      } else if (result.topDepth_m != null) updates.depth = Math.round(result.topDepth_m)
      if (result.meanPorosity != null) updates.porosity = parseFloat(result.meanPorosity.toFixed(3))
      if (result.meanPermX_mD != null) updates.permeability = parseFloat(result.meanPermX_mD.toFixed(1))
      if (result.initPressure_MPa != null) updates.pressure = parseFloat(result.initPressure_MPa.toFixed(2))
      if (result.temperature_C != null) updates.temperature = parseFloat(result.temperature_C.toFixed(1))
      if (result.dx_m != null && result.dy_m != null && result.grid)
        updates.area = parseFloat(((result.dx_m * result.grid.nx * result.dy_m * result.grid.ny) / 1e6).toFixed(1))
      if (Object.keys(updates).length) setParams(updates)
      if (result.wells.length > 0) {
        const newWells: import('../../types').Well[] = result.wells.map((w, idx) => ({
          id: `eclipse_well_${idx}_${Date.now()}`,
          x: Math.max(-1.4, Math.min(1.4, ((w.i - 1) / Math.max(1, (result.grid?.nx ?? 10) - 1)) * 2 - 1)),
          z: Math.max(-1.4, Math.min(1.4, ((w.j - 1) / Math.max(1, (result.grid?.ny ?? 10) - 1)) * 2 - 1)),
          injectionRate: w.injectionRate_m3PerDay != null ? parseFloat((w.injectionRate_m3PerDay * 365.25 * 600 / 1e9).toFixed(2)) : 1.0,
          label: w.name,
          rampUpYears: 1,
          rampDownYears: 1,
        }))
        setWells(newWells)
      }
      if (eclipseFileRef.current) eclipseFileRef.current.value = ''
      alert(`Eclipse deck imported: ${Object.keys(updates).length} parameters applied, ${result.wells.length} well(s) loaded.`)
    } catch (err) { alert(`Failed to parse Eclipse deck: ${err instanceof Error ? err.message : String(err)}`) }
  }

  const handleDownloadSampleGrid = () => {
    const grid = generateSampleGrid()
    const blob = new Blob([JSON.stringify(grid, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'sample_irregular_dome.carbon.json'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Helper: get criterion status for a given id ───────────────────────────────
  const criterionStatus = useCallback((id: string) => {
    return screeningResult.criteria.find((c) => c.id === id)?.status ?? 'green'
  }, [screeningResult])

  // ── Sub-step navigation helpers ───────────────────────────────────────────────
  const canGoNext = useCallback((): boolean => {
    if (subStep === 1) return step1CanProceed
    if (subStep === 5) return step5CanProceed
    return true
  }, [subStep, step1CanProceed, step5CanProceed])

  const nextStep = () => { if (canGoNext() && subStep < 6) setSubStep((s) => (s + 1) as SubStep) }
  const prevStep = () => { if (subStep > 1) setSubStep((s) => (s - 1) as SubStep) }

  // ── Render sub-step content ───────────────────────────────────────────────────
  const renderSubStep = () => {
    switch (subStep) {

      // ── 1. Location & Scale ────────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-[10px] text-muted font-mono leading-relaxed">
              Define the physical dimensions of your target CO2 storage formation. Depth must exceed 800 m for CO2 to reach its supercritical state — the dense phase essential for efficient geological storage.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <Slider label="Depth" value={params.depth} min={500} max={5000} step={10} unit=" m"
                  onChange={(v) => setParams({ depth: v })} badge={criterionStatus('depth')} />
                {params.depth < 800 && (
                  <p className="text-[9px] text-red-400 font-mono">Depth below 800 m minimum. CO2 will be gaseous — not suitable for storage.</p>
                )}

                <Slider label="Formation Thickness" value={params.thickness} min={10} max={500} step={5} unit=" m"
                  onChange={(v) => setParams({ thickness: v })} badge={criterionStatus('thickness')} />
              </div>

              <div className="space-y-4">
                <Slider label="Formation Area" value={params.area} min={1} max={500} step={0.5} unit=" km²"
                  onChange={(v) => setParams({ area: v })} badge={criterionStatus('area')} />

                <Slider label="Net-to-Gross" value={params.netToGross * 100} min={10} max={100} step={1} unit=" %"
                  onChange={(v) => setParams({ netToGross: v / 100 })} badge={criterionStatus('netToGross')} />
              </div>
            </div>

            {/* Project years here for convenience */}
            <div className="pt-3 border-t border-theme/30">
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-muted font-mono flex items-center gap-1"><Clock size={10} /> Project Years</span>
                <span className="text-secondary font-mono">{projectYears} yr</span>
              </div>
              <input type="range" min={10} max={100} step={5} value={projectYears}
                onChange={(e) => setProjectYears(Number(e.target.value))} className="w-full" />
            </div>
          </div>
        )

      // ── 2. Reservoir Geometry ────────────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-[10px] text-muted font-mono leading-relaxed">
              Select the structural configuration of your formation. Geometry controls how CO2 migrates and accumulates. Anticlinal traps are most favourable for structural trapping.
            </p>

            <div>
              <label className="text-[11px] text-muted font-mono block mb-1.5">Geometry Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {geometries.map((g) => (
                  <button key={g.value} onClick={() => setGeometry(g.value)}
                    className={`px-3 py-2 rounded text-[10px] font-mono transition text-left ${
                      params.geometryType === g.value ? 'bg-accent text-white font-semibold' : 'bg-tertiary text-muted hover:text-secondary'
                    }`}
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono bg-tertiary text-muted hover:text-secondary">
                      <Upload size={12} /> Upload .carbon.json
                    </button>
                    <button onClick={handleDownloadSampleGrid}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono bg-tertiary text-muted hover:text-secondary">
                      <FileDown size={12} /> Sample
                    </button>
                  </div>
                  {gridData && <p className="text-[10px] text-accent font-mono">Loaded: {gridData.name} ({gridData.nx}x{gridData.nz})</p>}
                </div>
              )}
            </div>

            {/* LAS upload */}
            <div className="pt-2 border-t border-theme/30">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] text-muted font-mono flex items-center gap-1"><Upload size={12} /> LAS Well Log</h3>
              </div>
              <input ref={fileRef} type="file" accept=".las" onChange={handleLasUpload} className="hidden" />
              <div className="flex gap-1">
                <button onClick={() => fileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[10px] px-3 py-2 rounded-md font-mono bg-tertiary text-muted hover:text-secondary transition">
                  <Upload size={11} /> {las ? 'Replace' : 'Upload .las'}
                </button>
                <a href="/sample_well.las" download
                  className="flex items-center gap-1 text-[10px] px-2.5 py-2 rounded-md font-mono bg-tertiary text-accent hover:text-white hover:bg-accent transition">
                  Sample
                </a>
              </div>
              {las ? (
                <div className="mt-1 space-y-1">
                  <p className="text-[10px] text-accent font-mono">{las.curves.length} curve(s) loaded ({las.depthMin}–{las.depthMax} m)</p>
                  <button onClick={applyLasAverages}
                    className="flex items-center gap-1 text-[9px] font-mono px-2 py-1.5 rounded bg-accent/10 text-accent hover:bg-accent/20 border border-accent/30 transition w-full justify-center">
                    <Upload size={10} /> Apply LAS averages to simulation params
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-muted font-mono mt-1 italic">No LAS loaded.</p>
              )}
            </div>

            {/* Eclipse import */}
            <div className="pt-2 border-t border-theme/30">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] text-muted font-mono flex items-center gap-1"><FileDown size={12} /> Eclipse .DATA Import</h3>
              </div>
              <input ref={eclipseFileRef} type="file" accept=".data,.DATA,.inc,.INC" onChange={handleEclipseUpload} className="hidden" />
              <button onClick={() => eclipseFileRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] px-3 py-2 rounded-md font-mono bg-tertiary text-muted hover:text-secondary transition">
                <Upload size={11} /> Import Eclipse Deck
              </button>
              <p className="text-[9px] text-muted font-mono mt-1 leading-tight">Parses GRID, PROPS, SCHEDULE keywords. Imports depth, porosity, permeability, pressure, temperature, well locations.</p>
            </div>
          </div>
        )

      // ── 3. Rock Quality ──────────────────────────────────────────────────────
      case 3: {
        const isDepletedField = params.formationType === 'depleted_gas' || params.formationType === 'depleted_oil'
        const hasDepletedData  = isDepletedField && params.giip != null && params.abandonmentPressure != null

        // Capacity estimates — routing by formation type to match the simulation engine
        let capacityP90_Mt: number, capacityP50_Mt: number, capacityP10_Mt: number
        let capacityMethod: string
        let poreVol_km3: number | null = null

        if (hasDepletedData) {
          // Gas-replacement volumetric method (Bachu et al. 2007) — same as useSimulation
          const T_K = params.temperature + 273.15
          const dep = computeDepletedFieldCapacity(params.giip!, T_K, params.pressure, params.abandonmentPressure!, 0.85, params.methaneFraction, params.nitrogenFraction)
          capacityP90_Mt = dep.storageP90_Mt   // 60% fill factor — conservative
          capacityP50_Mt = dep.storageMt        // 85% fill factor — expected
          capacityP10_Mt = dep.storageP10_Mt    // 100% fill factor — optimistic
          capacityMethod = 'Gas-replacement volumetric (Bachu 2007)'
        } else {
          // DOE Goodman 2011 saline aquifer method
          // Gross pore volume — NTG is not applied because Cc coefficients already
          // implicitly capture NTG effects from the training dataset (matches useSimulation)
          const A = params.area * 1e6         // m²
          const poreVol_m3 = A * params.thickness * params.porosity
          poreVol_km3 = poreVol_m3 / 1e9     // km³ (display only)
          // Use impurity-aware density to match the simulation engine
          const T_K_cap = params.temperature + 273.15
          const rho = co2DensityWithImpurities(T_K_cap, params.pressure * 1e6, params.methaneFraction, params.nitrogenFraction)
          capacityP90_Mt = poreVol_m3 * 0.0051 * rho / 1e9  // conservative (90% exceedance)
          capacityP50_Mt = poreVol_m3 * 0.0200 * rho / 1e9  // expected   (50% exceedance)
          capacityP10_Mt = poreVol_m3 * 0.0550 * rho / 1e9  // optimistic (10% exceedance)
          capacityMethod = 'DOE Goodman 2011 (saline aquifer)'
        }

        const injIdx = screeningResult.criteria.find((c) => c.id === 'injectivity')
        return (
          <div className="space-y-4">
            <p className="text-[10px] text-muted font-mono leading-relaxed">
              Porosity determines storage volume. Permeability determines injectability. Both must exceed minimum thresholds for viable CO2 storage.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Slider label="Porosity" value={params.porosity * 100} min={5} max={45} step={0.5} unit=" %"
                  onChange={(v) => setParams({ porosity: v / 100 })} badge={criterionStatus('porosity')} />
                {params.porosity < 0.10 && (
                  <p className="text-[9px] text-red-400 font-mono">Below 10% minimum (Bachu 2003). Formation unlikely to be economic.</p>
                )}

                <Slider label="Permeability" value={params.permeability} min={1} max={3000} step={10} unit=" mD"
                  onChange={(v) => setParams({ permeability: v })} badge={criterionStatus('permeability')} />

                <div className="text-[10px] text-muted font-mono">
                  Net-to-gross (from Step 1): <span className="text-secondary font-bold">{(params.netToGross * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div className="rounded-xl bg-tertiary/30 border border-theme/20 p-4 space-y-2">
                <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-2 border-b border-theme/10 pb-1 font-bold">
                  {hasDepletedData ? 'Gas-Replacement Capacity' : 'DOE Volumetric Estimates'}
                </div>
                {poreVol_km3 != null && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Gross pore volume:</span>
                    <span className="text-secondary font-bold">{poreVol_km3.toFixed(3)} km³</span>
                  </div>
                )}
                {hasDepletedData && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">GIIP:</span>
                    <span className="text-secondary font-bold">{params.giip!.toFixed(1)} Bcm</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted">P10 (optimistic):</span>
                  <span className="text-blue-400 font-bold">{capacityP10_Mt.toFixed(2)} Mt</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted">P50 (expected):</span>
                  <span className="text-emerald-400 font-bold">{capacityP50_Mt.toFixed(2)} Mt</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted">P90 (conservative):</span>
                  <span className="text-amber-400 font-bold">{capacityP90_Mt.toFixed(2)} Mt</span>
                </div>
                <div className="text-[8px] text-muted font-mono pt-1 border-t border-theme/10">
                  {capacityMethod} | P90 = 90% exceedance (low), P10 = 10% exceedance (high)
                </div>
                {injIdx && (
                  <div className="flex items-center justify-between text-xs font-mono border-t border-theme/10 pt-1.5 mt-1.5">
                    <span className="text-muted">Injectivity index:</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-secondary font-bold">{injIdx.yourValue.toFixed(2)} kg/(s·MPa)</span>
                      <StatusBadge status={injIdx.status} />
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      // ── 4. Fluid Conditions ───────────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-4">
            <p className="text-[10px] text-muted font-mono leading-relaxed">
              Pressure and temperature control CO2 density and viscosity. At supercritical conditions (T{'>'}31.1°C, P{'>'}7.38 MPa), CO2 reaches 600–800 kg/m³ — making storage 3-4x more efficient than gaseous CO2.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Slider label="Reservoir Pressure" value={params.pressure} min={5} max={60} step={0.1} unit=" MPa"
                  onChange={(v) => setParams({ pressure: v })} badge={criterionStatus('pressure')} />

                {params.geothermalGradient != null && params.surfaceTemperatureC != null ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted font-mono">Temperature</span>
                      <span className="text-teal-400 font-mono font-bold">{params.temperature?.toFixed(1)} °C</span>
                    </div>
                    <div className="text-[10px] font-mono text-teal-400/70 bg-teal-500/10 border border-teal-500/20 rounded px-2 py-1">
                      Auto-derived from geothermal gradient. Clear gradient to set manually.
                    </div>
                  </div>
                ) : (
                  <Slider label="Temperature" value={params.temperature} min={20} max={200} step={1} unit=" °C"
                    onChange={(v) => setParams({ temperature: v })} badge={criterionStatus('temperature')} />
                )}

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-muted font-mono">Geothermal Gradient (°C/100m)</span>
                    <span className="text-secondary font-mono">{params.geothermalGradient ?? '—'}</span>
                  </div>
                  <input type="number" step={0.1} min={1} max={8}
                    value={params.geothermalGradient ?? ''}
                    placeholder="e.g. 3.0"
                    onChange={(e) => {
                      const v = e.target.value === '' ? undefined : parseFloat(e.target.value)
                      setParams({ geothermalGradient: v })
                    }}
                    className="w-full rounded bg-tertiary border border-theme/30 px-2 py-1 text-[11px] font-mono text-secondary" />
                  {activePreset && params.geothermalGradient != null && params.surfaceTemperatureC != null && (() => {
                    const presetDef = FORMATION_PRESETS.find((p) => p.name === activePreset)
                    if (!presetDef) return null
                    const derivedT = Math.round((params.surfaceTemperatureC + params.geothermalGradient * (params.depth + params.thickness / 2) / 100) * 10) / 10
                    const measuredT = presetDef.params.temperature
                    if (Math.abs(derivedT - measuredT) < 2) return null
                    return (
                      <div className="mt-1 flex items-start gap-1.5 text-[9px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5 leading-relaxed">
                        <AlertTriangle size={9} className="shrink-0 mt-0.5" />
                        <span>
                          Gradient overrides {activePreset} measured T. Derived: {derivedT}°C vs measured: {measuredT}°C.
                          CO2 density error: {Math.abs(1 - derivedT / measuredT) > 0.1 ? 'significant — capacity figures will be wrong.' : 'minor.'}
                          Clear gradient to restore preset temperature.
                        </span>
                      </div>
                    )
                  })()}
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-muted font-mono">Surface Reference T (°C)</span>
                    <span className="text-secondary font-mono">{params.surfaceTemperatureC ?? '—'}</span>
                  </div>
                  <input type="number" step={1} min={0} max={40}
                    value={params.surfaceTemperatureC ?? ''}
                    placeholder="e.g. 15"
                    onChange={(e) => {
                      const v = e.target.value === '' ? undefined : parseFloat(e.target.value)
                      setParams({ surfaceTemperatureC: v })
                    }}
                    className="w-full rounded bg-tertiary border border-theme/30 px-2 py-1 text-[11px] font-mono text-secondary" />
                </div>

                <div>
                  <label className="text-[11px] text-muted font-mono block mb-1.5 uppercase tracking-wider font-bold">Salt Type</label>
                  <div className="flex gap-1.5">
                    {(['NaCl', 'CaCl2', 'Mixed'] as const).map((t) => (
                      <button key={t} onClick={() => setSaltType(t)}
                        className={`px-3.5 py-2 rounded-lg text-[10px] font-mono font-semibold transition ${params.saltType === t ? 'bg-accent text-white shadow-sm' : 'bg-tertiary text-muted hover:text-secondary'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Slider label="Monovalent Salinity (NaCl eq)" value={params.monovalentSalinity} min={0} max={5} step={0.01} unit=" mol/kg"
                  onChange={setMonovalent} />
                <Slider label="Bivalent Salinity (CaCl₂/MgCl₂)" value={params.bivalentSalinity} min={0} max={2} step={0.01} unit=" mol/kg"
                  onChange={setBivalent} />

                {fluidProps && (
                  <div className="rounded-xl bg-tertiary/30 border border-theme/20 p-4 space-y-2">
                    <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-2 border-b border-theme/10 pb-1 font-bold">Thermodynamic Properties</div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted">CO2 density:</span>
                      <span className="text-secondary font-bold">{fluidProps.co2Density.toFixed(1)} kg/m³</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted">CO2 viscosity:</span>
                      <span className="text-secondary font-bold">{(fluidProps.co2Visc * 1000).toFixed(3)} mPa·s</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted">Brine density:</span>
                      <span className="text-secondary font-bold">{fluidProps.brineDensity.toFixed(1)} kg/m³</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono border-t border-theme/10 pt-1.5 mt-1.5">
                      <span className="text-muted">CO2 phase state:</span>
                      <span className={fluidProps.phase === 'supercritical' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {fluidProps.phase === 'supercritical' ? 'Supercritical ✓' : 'Subcritical ✗'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      // ── 5. CO2 Stream Composition ─────────────────────────────────────────────
      case 5:
        return (
          <div className="space-y-4">
            <p className="text-[10px] text-muted font-mono leading-relaxed">
              CO2 streams from industrial sources contain impurities. CH4 reduces density; N2 reduces interfacial tension. The MARS model predicts CO2-brine IFT in real time from your inputs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Slider label="CH₄ Fraction (methane impurity)" value={params.methaneFraction * 100} min={0} max={89} step={0.1} unit=" %"
                  onChange={(v) => setParams({ methaneFraction: v / 100 })} />
                <Slider label="N₂ Fraction (nitrogen impurity)" value={params.nitrogenFraction * 100} min={0} max={76} step={0.1} unit=" %"
                  onChange={(v) => setParams({ nitrogenFraction: v / 100 })} />

                {(params.methaneFraction + params.nitrogenFraction) >= 0.95 && (
                  <p className="text-[9px] text-red-400 font-mono">CH4 + N2 exceeds 95% — insufficient CO2 in stream.</p>
                )}
              </div>

              {marsIFT && (
                <div className="rounded-xl border border-theme/20 bg-tertiary/30 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted uppercase tracking-wider mb-2 border-b border-theme/10 pb-1 font-bold">
                    <Brain size={12} className="text-accent" />
                    MARS IFT Prediction Model
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">IFT (CO2-brine):</span>
                    <span className="text-primary font-bold">{marsIFT.ift.toFixed(2)} mN/m</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Applicability domain:</span>
                    <span className={
                      marsIFT.ad.status === 'green' ? 'text-emerald-400 font-semibold'
                      : marsIFT.ad.status === 'yellow' ? 'text-amber-400 font-semibold'
                      : 'text-red-400 font-semibold'
                    }>
                      {marsIFT.ad.status === 'green' ? 'Within training range' : marsIFT.ad.status === 'yellow' ? 'Marginal extrapolation' : 'Outside training range'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Prediction interval (90%):</span>
                    <span className="text-secondary font-bold">±{marsIFT.ad.pi_halfwidth.toFixed(2)} mN/m</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono border-t border-theme/10 pt-1.5 mt-1.5">
                    <span className="text-muted">Phase:</span>
                    <span className={`font-bold uppercase ${marsIFT.phase === 'supercritical' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {marsIFT.phase}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      // ── 6. Injection Wells ────────────────────────────────────────────────────
      case 6:
        return (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] text-muted font-mono flex items-center gap-1"><Drilling size={12} /> Wells</h3>
                <div className="flex items-center gap-1">
                  {wells.length > 0 && (
                    <button onClick={() => { const opt = autoOptimizeWells(params, wells.length, wells); setWells(opt.wells) }}
                      className="flex items-center gap-0.5 text-[10px] text-amber hover:text-amber-hover font-mono" title="Auto-optimize wells">
                      <Sparkles size={11} /> Optimize
                    </button>
                  )}
                  {wells.length < 5 && (
                    <button onClick={addWell} className="flex items-center gap-0.5 text-[10px] text-accent hover:text-accent-hover font-mono">
                      <Plus size={11} /> Add
                    </button>
                  )}
                </div>
              </div>

              {wells.length === 0 && (
                <p className="text-[10px] text-muted font-mono italic mb-2">No wells configured. Add at least one injection well.</p>
              )}

              {wells.map((w) => {
                const status = classifyRate(w.injectionRate, rateEnvelope)
                const meta   = RATE_STATUS_META[status]
                const sliderMax = Math.max(5, rateEnvelope.maxRate * 1.5)
                const pctOfOptimal = rateEnvelope.optimalRate > 0 ? (w.injectionRate / rateEnvelope.optimalRate) * 100 : 0
                return (
                  <div key={w.id} className="mb-3 p-2 rounded bg-tertiary border border-theme/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <input value={w.label} onChange={(e) => updateWellLabel(w.id, e.target.value)}
                        className="text-xs text-secondary font-mono bg-transparent border-b border-theme/30 outline-none focus:border-accent px-0 py-0 w-28" />
                      <button onClick={() => removeWell(w.id)} className="flex items-center gap-0.5 text-[10px] text-muted hover:text-error font-mono">
                        <Trash2 size={10} /> Remove
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-[9px] mb-0.5">
                          <span className="text-muted font-mono flex items-center gap-0.5"><Move size={8} />X</span>
                          <span className="text-secondary font-mono">{w.x.toFixed(2)}</span>
                        </div>
                        <input type="range" min={-1.5} max={1.5} step={0.05} value={w.x}
                          onChange={(e) => updateWellPosition(w.id, parseFloat(e.target.value), w.z)} className="w-full" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-[9px] mb-0.5">
                          <span className="text-muted font-mono flex items-center gap-0.5"><Move size={8} />Z</span>
                          <span className="text-secondary font-mono">{w.z.toFixed(2)}</span>
                        </div>
                        <input type="range" min={-1.5} max={1.5} step={0.05} value={w.z}
                          onChange={(e) => updateWellPosition(w.id, w.x, parseFloat(e.target.value))} className="w-full" />
                      </div>
                    </div>
                    <div className="mb-1.5">
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-muted font-mono">Injection rate</span>
                        <span className="font-mono font-semibold" style={{ color: meta.color }}>{w.injectionRate.toFixed(3)} Mt/yr</span>
                      </div>
                      <input type="range" min={0.001} max={sliderMax} step={0.001} value={w.injectionRate}
                        onChange={(e) => updateWellRate(w.id, parseFloat(e.target.value))} className="w-full" />
                      <div className="relative h-3 rounded overflow-hidden mt-1" style={{ background: 'rgba(15,25,40,0.7)' }}>
                        <div className="absolute top-0 bottom-0 w-px bg-slate-400/50" style={{ left: `${Math.min(99, (rateEnvelope.minRate / sliderMax) * 100)}%` }} />
                        <div className="absolute top-0 bottom-0 w-px bg-teal-400/80" style={{ left: `${Math.min(99, (rateEnvelope.optimalRate / sliderMax) * 100)}%` }} />
                        <div className="absolute top-0 bottom-0 w-px bg-orange-400/80" style={{ left: `${Math.min(99, (rateEnvelope.maxRate / sliderMax) * 100)}%` }} />
                        <div className="absolute top-0 bottom-0 left-0 rounded transition-all duration-150"
                          style={{ width: `${Math.min(100, (w.injectionRate / sliderMax) * 100)}%`, background: meta.color, opacity: 0.35 }} />
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-mono" style={{ background: meta.bg, color: meta.color }}>
                        <span>{meta.label}</span>
                        <span className="ml-auto opacity-70">{pctOfOptimal.toFixed(0)}% of optimal</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <div className="flex-1">
                        <div className="flex justify-between text-[9px] mb-0.5">
                          <span className="text-muted font-mono">Ramp-up</span>
                          <span className="text-secondary font-mono">{w.rampUpYears} yr</span>
                        </div>
                        <input type="range" min={1} max={Math.floor(projectYears / 3)} step={1}
                          value={w.rampUpYears} onChange={(e) => updateWellSchedule(w.id, parseFloat(e.target.value), w.rampDownYears)} className="w-full" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-[9px] mb-0.5">
                          <span className="text-muted font-mono">Ramp-down</span>
                          <span className="text-secondary font-mono">{w.rampDownYears} yr</span>
                        </div>
                        <input type="range" min={1} max={Math.floor(projectYears / 3)} step={1}
                          value={w.rampDownYears} onChange={(e) => updateWellSchedule(w.id, w.rampUpYears, parseFloat(e.target.value))} className="w-full" />
                      </div>
                    </div>
                    <div className="mt-2 border-t border-theme/20 pt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Perforation Intervals</span>
                        <button
                          onClick={() => {
                            const existing = w.perforations ?? [{ topFrac: 0.6, bottomFrac: 1.0, flowFraction: 1.0 }]
                            updateWellPerforations(w.id, [...existing, { topFrac: 0.6, bottomFrac: 1.0, flowFraction: 0 }])
                          }}
                          className="text-[9px] font-mono text-accent hover:text-accent-hover px-1.5 py-0.5 rounded border border-accent/30 hover:border-accent/60 transition"
                        >+ Add</button>
                      </div>
                      {(w.perforations ?? [{ topFrac: 0.6, bottomFrac: 1.0, flowFraction: 1.0 }]).map((perf, pi) => {
                        const perfs = w.perforations ?? [{ topFrac: 0.6, bottomFrac: 1.0, flowFraction: 1.0 }]
                        return (
                          <div key={pi} className="flex items-center gap-1 mb-1">
                            <span className="text-[9px] font-mono text-muted w-4">{pi+1}.</span>
                            <input type="number" min={0} max={100} step={1}
                              value={Math.round(perf.topFrac * 100)}
                              onChange={(e) => {
                                const updated = perfs.map((p, i) => i === pi ? { ...p, topFrac: parseFloat(e.target.value) / 100 } : p)
                                updateWellPerforations(w.id, updated)
                              }}
                              className="w-12 rounded bg-tertiary border border-theme/30 px-1 py-0.5 text-[9px] font-mono text-secondary" />
                            <span className="text-[9px] text-muted">%</span>
                            <span className="text-[9px] text-muted">-</span>
                            <input type="number" min={0} max={100} step={1}
                              value={Math.round(perf.bottomFrac * 100)}
                              onChange={(e) => {
                                const updated = perfs.map((p, i) => i === pi ? { ...p, bottomFrac: parseFloat(e.target.value) / 100 } : p)
                                updateWellPerforations(w.id, updated)
                              }}
                              className="w-12 rounded bg-tertiary border border-theme/30 px-1 py-0.5 text-[9px] font-mono text-secondary" />
                            <span className="text-[9px] text-muted">%</span>
                            <input type="number" min={0} max={100} step={1}
                              value={Math.round(perf.flowFraction * 100)}
                              onChange={(e) => {
                                const updated = perfs.map((p, i) => i === pi ? { ...p, flowFraction: parseFloat(e.target.value) / 100 } : p)
                                updateWellPerforations(w.id, updated)
                              }}
                              className="w-12 rounded bg-tertiary border border-theme/30 px-1 py-0.5 text-[9px] font-mono text-secondary" />
                            <span className="text-[9px] text-muted">%q</span>
                            {perfs.length > 1 && (
                              <button onClick={() => updateWellPerforations(w.id, perfs.filter((_, i) => i !== pi))}
                                className="text-[9px] text-red-400 hover:text-red-300 ml-auto">x</button>
                            )}
                          </div>
                        )
                      })}
                      {(() => {
                        const perfs = w.perforations ?? [{ topFrac: 0.6, bottomFrac: 1.0, flowFraction: 1.0 }]
                        const totalFrac = perfs.reduce((s, p) => s + p.flowFraction, 0)
                        const fracOk = Math.abs(totalFrac - 1) < 0.01
                        return !fracOk ? (
                          <div className="text-[9px] font-mono text-amber-400">Flow fractions sum to {(totalFrac * 100).toFixed(0)}% (must be 100%)</div>
                        ) : null
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* DOE envelope summary */}
            <div className="rounded bg-tertiary/50 border border-theme/30 px-2 py-1.5 space-y-0.5">
              <div className="text-[8px] text-muted font-mono uppercase tracking-wider mb-1">DOE Storage Envelope</div>
              {[
                { label: 'P90 (0.51%)', val: rateEnvelope.totalCapacityP90, color: '#34d399' },
                { label: 'P50 (2.0%)',  val: rateEnvelope.totalCapacityP50, color: '#38bdf8' },
                { label: 'P10 (5.5%)',  val: rateEnvelope.totalCapacityP10, color: '#fb923c' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between text-[9px] font-mono">
                  <span className="text-muted">{label}</span>
                  <span style={{ color }}>{val.toFixed(2)} Mt</span>
                </div>
              ))}
            </div>

            {/* Formation Intelligence */}
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

            {/* Confirm Formation gate */}
            <div className="border-t border-theme pt-3 space-y-3">
              <div className={`rounded-lg px-3 py-2 border text-[10px] font-mono flex items-start gap-2 ${
                !screeningResult.canProceed
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : screeningResult.requiresAcknowledgment
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}>
                {!screeningResult.canProceed
                  ? <X size={12} className="shrink-0 mt-0.5 text-red-400" />
                  : screeningResult.requiresAcknowledgment
                    ? <AlertTriangle size={12} className="shrink-0 mt-0.5 text-amber-400" />
                    : <ShieldCheck size={12} className="shrink-0 mt-0.5 text-emerald-400" />
                }
                <span className="leading-relaxed">{screeningResult.recommendation}</span>
              </div>

              {screeningResult.requiresAcknowledgment && screeningResult.canProceed && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-amber-400"
                    checked={amberAcknowledged} onChange={(e) => setAmberAcknowledged(e.target.checked)} />
                  <span className="text-[10px] font-mono text-amber-300 leading-relaxed">
                    I understand this formation has marginal properties and accept the associated uncertainty.
                  </span>
                </label>
              )}

              <button
                disabled={!screeningResult.canProceed || (screeningResult.requiresAcknowledgment && !amberAcknowledged)}
                onClick={() => { setPanel('geology') }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold font-mono transition
                  disabled:opacity-40 disabled:cursor-not-allowed
                  bg-emerald-500 hover:bg-emerald-400 disabled:bg-tertiary disabled:text-muted text-white"
              >
                <ShieldCheck size={13} />
                Confirm Formation &amp; Continue to Geology →
              </button>
            </div>
          </div>
        )
    }
  }

  const wellDesign = useMemo(() => {
    const reservoirTop = params.depth
    const reservoirBottom = params.depth + params.thickness
    const caprockTop = Math.max(0, reservoirTop - 50)
    const caprockBottom = reservoirTop
    const totalDepth = reservoirBottom + 100

    return {
      totalDepth_m: totalDepth,
      caprockTopDepth_m: caprockTop,
      caprockBottomDepth_m: caprockBottom,
      reservoirTopDepth_m: reservoirTop,
      reservoirBottomDepth_m: reservoirBottom,
      perforationTopDepth_m: reservoirTop,
      perforationBottomDepth_m: reservoirBottom,
      casingStrings: [
        { name: 'Conductor', outerDiameter_in: 20, innerDiameter_in: 18.5, topDepth_m: 0, bottomDepth_m: 80, cementTopDepth_m: 0 },
        { name: 'Surface', outerDiameter_in: 13.375, innerDiameter_in: 12.5, topDepth_m: 0, bottomDepth_m: Math.min(reservoirTop * 0.3, 500), cementTopDepth_m: 0 },
        { name: 'Intermediate', outerDiameter_in: 9.625, innerDiameter_in: 8.8, topDepth_m: 0, bottomDepth_m: caprockTop + 10, cementTopDepth_m: Math.min(reservoirTop * 0.3, 500) },
        { name: 'Production', outerDiameter_in: 7, innerDiameter_in: 6.2, topDepth_m: 0, bottomDepth_m: totalDepth - 10, cementTopDepth_m: caprockTop - 20, isInjectionString: true }
      ]
    }
  }, [params.depth, params.thickness])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme/20 pb-4">
        <div>
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest flex items-center gap-1.5">
            <Layers size={12} /> Stage 2: Reservoir Characterization
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-primary font-mono tracking-tight mt-1">
            Define Formation &amp; Well Properties
          </h1>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Enter target saline aquifer dimensions, transport properties, mineralogy, fluid conditions, and injector layout.
          </p>
        </div>
        <ValidationBanner issues={validationIssues} />
      </div>

      {/* Main Content Split: Form on Left (60%), Interactive Visuals on Right (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Multi-Step Input Wizard (Lg: col-span-7) */}
        <div className="lg:col-span-7 space-y-6 bg-card border border-theme rounded-2xl p-6 shadow-md flex flex-col min-h-[600px] justify-between">
          
          <div>
            {/* Step Header */}
            <div className="flex items-center justify-between mb-4 border-b border-theme/10 pb-3">
              <span className="text-xs font-semibold font-mono text-primary">
                Step {subStep} of 6 — {SUB_STEPS[subStep - 1].label}
              </span>
              <span className="text-[10px] font-mono text-muted text-right max-w-[60%] truncate">
                {subStep === 1 && 'Aquifer dimensions and depth constraint.'}
                {subStep === 2 && 'Geometry and log uploads.'}
                {subStep === 3 && 'Porosity, permeability, and volume calculations.'}
                {subStep === 4 && 'Reservoir temperature, pressure, salinity.'}
                {subStep === 5 && 'Composition, impurities, IFT.'}
                {subStep === 6 && 'Check criteria and confirm details.'}
              </span>
            </div>

            {/* Presets Quick-Load bar (Only on Step 1) */}
            {subStep === 1 && (
              <div className="mb-4 bg-tertiary/10 p-3 rounded-lg border border-theme/20">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-muted font-mono uppercase tracking-wider">
                    Quick Load Analogue Preset
                  </label>
                  {activePreset && !presetChangeMode && (
                    <button onClick={() => setPresetChangeMode(true)}
                      className="text-[9px] font-mono text-accent hover:text-accent-hover underline transition">
                      Change Foundation Formation
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FORMATION_PRESETS.map((preset) => {
                    const isActive = activePreset === preset.name
                    const isLocked = activePreset !== null && !presetChangeMode
                    const isDisabledInChangeMode = presetChangeMode && isActive
                    const clickable = !isLocked && !isDisabledInChangeMode

                    return (
                      <button key={preset.name}
                        onClick={() => {
                          if (!clickable) return
                          if (activePreset && activePreset !== preset.name) {
                            if (window.confirm('Switching presets will reset all formation parameters. Continue?')) {
                              handlePresetLoad(preset)
                              setPresetChangeMode(false)
                            }
                          } else {
                            handlePresetLoad(preset)
                            setPresetChangeMode(false)
                          }
                        }}
                        title={`${preset.location} — ${preset.description}`}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition-all border flex items-center gap-1.5 ${
                          isActive && (isLocked || presetChangeMode)
                            ? 'bg-accent/20 text-accent border-accent/50 font-semibold cursor-not-allowed opacity-60'
                            : isLocked
                              ? 'bg-tertiary/50 text-muted/40 border-theme/10 cursor-not-allowed'
                              : 'bg-tertiary text-muted hover:text-secondary border-theme/30 hover:border-theme/60'
                        }`}>
                        {isActive && <Lock size={10} className="shrink-0" />}
                        {preset.name}
                      </button>
                    )
                  })}
                  {presetChangeMode && (
                    <button onClick={() => {
                      if (window.confirm('Switch to Custom Formation? All current parameters will be reset to defaults.')) {
                        useFormationStore.getState().reset()
                        setPresetChangeMode(false)
                      }
                    }}
                      className="px-2.5 py-1 rounded-md text-[10px] font-mono transition-all border flex items-center gap-1.5 bg-violet-500/10 text-violet-300 border-violet-500/30 hover:bg-violet-500/20">
                      <span className="text-violet-300">✦</span>
                      Custom (Build from Scratch)
                    </button>
                  )}
                </div>
                {activePreset && formationCountry && !presetChangeMode && (
                  <div className="mt-2 flex items-center gap-2 text-[9px] font-mono text-muted">
                    <span className="text-accent font-semibold">{formationCountry}</span>
                    <span className="opacity-40">|</span>
                    <span>{(() => {
                      const p = FORMATION_PRESETS.find((pr) => pr.name === activePreset)
                      return p?.location ?? ''
                    })()}</span>
                    <span className="opacity-40">|</span>
                    <span className="text-amber-400">Jurisdiction auto-set</span>
                  </div>
                )}
                {optNotice && (
                  <div className="mt-2.5 px-2.5 py-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-emerald-300 font-mono flex-1 leading-normal">
                      Wells optimized for {optNotice.formation} — {optNotice.perWellRate.toFixed(3)} Mt/yr per well
                    </p>
                    <button onClick={() => setOptNotice(null)} className="text-emerald-400/50 hover:text-emerald-400 shrink-0"><X size={12} /></button>
                  </div>
                )}
              </div>
            )}

            {/* Sub-step Form Content */}
            <div className="space-y-4">
              {renderSubStep()}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-theme/10 pt-4 mt-6">
            <button
              onClick={prevStep}
              disabled={subStep === 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-mono bg-tertiary text-muted hover:text-primary transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={13} /> Previous
            </button>

            {/* Step Indicators */}
            <div className="flex items-center gap-2">
              {SUB_STEPS.map(({ n, label }) => (
                <button key={n}
                  onClick={() => setSubStep(n as SubStep)}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-mono transition-all ${
                    n === subStep
                      ? 'bg-accent border-accent text-white font-bold'
                      : n < subStep
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-tertiary border-theme/20 text-muted/50'
                  }`}
                  title={label}
                >
                  {n}
                </button>
              ))}
            </div>

            {subStep < 6 ? (
              <button
                onClick={nextStep}
                disabled={!canGoNext()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-mono bg-accent hover:bg-accent-hover text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                title={!canGoNext() ? subStep === 1 ? 'Depth must be ≥800 m to proceed' : 'Fix validation errors to proceed' : ''}
              >
                Next Step <ChevronRight size={13} />
              </button>
            ) : (
              <div />
            )}
          </div>

        </div>

        {/* Right Column: Interactive Visualizations (Lg: col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Wellbore Schematic Panel */}
          <div className="bg-card border border-theme rounded-2xl p-5 space-y-4 shadow-md flex flex-col items-center">
            <div className="w-full flex items-center justify-between border-b border-theme/10 pb-2">
              <h3 className="text-xs font-semibold font-mono text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-accent" /> Scaled Wellbore Profile
              </h3>
              <span className="text-[9px] font-mono text-muted">Updates in real-time</span>
            </div>
            
            {/* Render the Wellbore Schematic Component */}
            <div className="bg-white/5 p-3 rounded-xl border border-theme/10 w-full flex justify-center">
              <WellboreSchematic
                design={wellDesign}
                label={`${params.depth}m Aquifer Target`}
                className="rounded-lg shadow-sm border border-slate-200/10 bg-white"
              />
            </div>
            <div className="text-[9px] text-muted font-mono leading-relaxed text-center px-4">
              Scaled casing configuration showing conductor (20"), surface (13⅜"), intermediate (9⅝"), and production tubing (7") relative to geological zones.
            </div>
          </div>

          {/* CO2 Phase Diagram Panel */}
          <PhaseDiagramCard temperature={params.temperature} pressure={params.pressure} />

        </div>

      </div>

    </div>
  )
}

import { TrendingUp } from 'lucide-react'

function PhaseDiagramCard({ temperature, pressure }: { temperature: number; pressure: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const w = rect.width
    const h = rect.height
    ctx.clearRect(0, 0, w, h)

    const margin = { top: 15, right: 15, bottom: 25, left: 35 }
    const chartW = w - margin.left - margin.right
    const chartH = h - margin.top - margin.bottom

    const getX = (t: number) => margin.left + (t / 120) * chartW
    const getY = (p: number) => margin.top + chartH - (p / 35) * chartH

    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)'
    ctx.fillRect(getX(0), getY(7.38), chartW, chartH - (getY(7.38) - getY(35)))

    ctx.fillStyle = 'rgba(59, 130, 246, 0.05)'
    ctx.fillRect(getX(0), getY(35), getX(31.1) - getX(0), getY(7.38) - getY(35))

    ctx.fillStyle = 'rgba(16, 185, 129, 0.07)'
    ctx.fillRect(getX(31.1), getY(35), getX(120) - getX(31.1), getY(7.38) - getY(35))

    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])

    ctx.beginPath()
    ctx.moveTo(getX(0), getY(7.38))
    ctx.lineTo(getX(120), getY(7.38))
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(getX(31.1), getY(7.38))
    ctx.lineTo(getX(31.1), getY(35))
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#f59e0b'
    ctx.beginPath()
    ctx.arc(getX(31.1), getY(7.38), 4, 0, 2 * Math.PI)
    ctx.fill()

    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top)
    ctx.lineTo(margin.left, margin.top + chartH)
    ctx.lineTo(margin.left + chartW, margin.top + chartH)
    ctx.stroke()

    ctx.fillStyle = '#94a3b8'
    ctx.font = '8px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let p = 0; p <= 35; p += 10) {
      ctx.fillText(`${p} MPa`, margin.left - 5, getY(p))
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let t = 0; t <= 120; t += 30) {
      ctx.fillText(`${t}°C`, getX(t), margin.top + chartH + 5)
    }

    ctx.fillStyle = '#f59e0b'
    ctx.font = '7px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('Critical (31.1°C, 7.38 MPa)', getX(31.1) + 6, getY(7.38) - 2)

    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'
    ctx.font = 'bold 9px monospace'
    ctx.fillText('GAS', getX(80), getY(4))

    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'
    ctx.fillText('LIQUID', getX(8), getY(20))

    ctx.fillStyle = 'rgba(16, 185, 129, 0.5)'
    ctx.fillText('SUPERCRITICAL', getX(65), getY(22))

    const isSupercritical = temperature > 31.1 && pressure > 7.38
    ctx.fillStyle = isSupercritical ? '#10b981' : '#ef4444'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(getX(temperature), getY(pressure), 6, 0, 2 * Math.PI)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = temperature > 60 ? 'right' : 'left'
    const labelX = temperature > 60 ? getX(temperature) - 8 : getX(temperature) + 8
    ctx.fillText(`Reservoir: ${temperature.toFixed(0)}°C, ${pressure.toFixed(1)} MPa`, labelX, getY(pressure) - 2)

  }, [temperature, pressure])

  return (
    <div className="bg-card border border-theme rounded-2xl p-5 space-y-4 shadow-md flex flex-col items-center">
      <div className="w-full flex items-center justify-between border-b border-theme/10 pb-2">
        <h3 className="text-xs font-semibold font-mono text-primary uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp size={13} className="text-accent" /> CO₂ Physical Phase State
        </h3>
        <span className="text-[9px] font-mono text-muted">Span-Wagner basis</span>
      </div>
      
      <canvas ref={canvasRef} className="w-full rounded-xl border border-theme/20 bg-slate-950" style={{ minHeight: 180 }} />
      
      <div className="text-[9px] text-muted font-mono leading-relaxed text-center px-4">
        CO₂ must be supercritical (dense phase) for safe, deep saline storage. Reservoir target conditions should sit in the green zone.
      </div>
    </div>
  )
}
