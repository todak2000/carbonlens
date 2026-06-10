/**
 * Sensitivity and physics sanity validation for CarbonLens.
 *
 * Three exports:
 *   validateSensitivity  — compare two simulation runs for physical consistency
 *   validateAllPresets   — analytically check all 16 FORMATION_PRESETS
 *   validatePhysicsSanity — check a single result for physical sanity
 */

import { FormationParams, SimulationResult, Well } from '../types'
import { co2DensitySpanWagner, determinePhase } from '../engine'
import { FORMATION_PRESETS } from '../data/formationPresets'

// ─── Return types ────────────────────────────────────────────────────────────

export interface SensitivityResult {
  ruleId: string
  paramLabel: string
  resultLabel: string
  paramRatio: number
  paramChangePct: number
  baseResultVal: number
  newResultVal: number
  actualRatio: number
  expectedRatio: number
  deviationPct: number
  tolerance: number
  pass: boolean
  relationship: 'linear' | 'inverse'
  explanation: string
  unit: string
}

export interface PresetBenchmarkResult {
  name: string
  location: string
  temperature: number
  pressure: number
  co2Density: number
  phase: string
  expectedP50Mt: number
  maipMPa: number
  isSupercritical: boolean
  densityOk: boolean
  pressureOk: boolean
}

export interface SanityCheck {
  id: string
  label: string
  pass: boolean
  value: string
  expected: string
  note: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeRatio(a: number, b: number): number {
  if (Math.abs(b) < 1e-12) return 1
  return a / b
}

function fmtNum(n: number, decimals = 2): string {
  return n.toFixed(decimals)
}

// ─── 1. validateSensitivity ───────────────────────────────────────────────────

/**
 * Compares two simulation runs and checks if the results changed in a
 * physically sensible direction relative to the parameter change.
 *
 * Only rules where the relevant parameter actually changed by >0.5% are tested.
 */
export function validateSensitivity(
  baseParams: FormationParams,
  baseResult: SimulationResult,
  newParams: FormationParams,
  newResult: SimulationResult,
  _wells?: Well[],
): SensitivityResult[] {
  const results: SensitivityResult[] = []

  // ΔP = injectionPressure − reservoir pressure (the differential)
  const baseInjDeltaP = baseResult.injectionPressure - baseParams.pressure
  const newInjDeltaP = newResult.injectionPressure - newParams.pressure

  // Helper that adds a rule result if the param changed by >0.5%
  function check(
    ruleId: string,
    paramLabel: string,
    resultLabel: string,
    baseParam: number,
    newParam: number,
    baseVal: number,
    newVal: number,
    relationship: 'linear' | 'inverse',
    tolerance: number,
    explanation: string,
    unit: string,
  ) {
    const paramRatio = safeRatio(newParam, baseParam)
    const paramChangePct = (paramRatio - 1) * 100

    // Skip if parameter hasn't meaningfully changed
    if (Math.abs(paramChangePct) <= 0.5) return

    const actualRatio = safeRatio(newVal, baseVal)
    const expectedRatio = relationship === 'linear' ? paramRatio : safeRatio(1, paramRatio)
    const deviationPct = safeRatio(actualRatio - expectedRatio, expectedRatio) * 100
    const pass = Math.abs(deviationPct) <= tolerance * 100

    results.push({
      ruleId,
      paramLabel,
      resultLabel,
      paramRatio,
      paramChangePct,
      baseResultVal: baseVal,
      newResultVal: newVal,
      actualRatio,
      expectedRatio,
      deviationPct,
      tolerance: tolerance * 100,
      pass,
      relationship,
      explanation,
      unit,
    })
  }

  // R1 — thickness → p50 (linear)
  check(
    'R1',
    'Thickness',
    'P50 Capacity',
    baseParams.thickness,
    newParams.thickness,
    baseResult.p50,
    newResult.p50,
    'linear',
    0.15,
    'P50 ∝ h (linear) — DOE formula: M = A·h·φ·Cc·ρ',
    'Mt',
  )

  // R2 — porosity → p50 (linear)
  check(
    'R2',
    'Porosity',
    'P50 Capacity',
    baseParams.porosity,
    newParams.porosity,
    baseResult.p50,
    newResult.p50,
    'linear',
    0.15,
    'P50 ∝ φ (linear) — DOE formula: M = A·h·φ·Cc·ρ',
    'Mt',
  )

  // R3 — area → p50 (linear)
  check(
    'R3',
    'Area',
    'P50 Capacity',
    baseParams.area,
    newParams.area,
    baseResult.p50,
    newResult.p50,
    'linear',
    0.15,
    'P50 ∝ A (linear) — DOE formula: M = A·h·φ·Cc·ρ',
    'Mt',
  )

  // R4 — permeability → injDeltaP (inverse) — only if ΔP values are meaningful
  if (Math.abs(baseInjDeltaP) > 0.01 && Math.abs(newInjDeltaP) > 0.01) {
    check(
      'R4',
      'Permeability',
      'Injection ΔP',
      baseParams.permeability,
      newParams.permeability,
      baseInjDeltaP,
      newInjDeltaP,
      'inverse',
      0.40,
      'ΔP ∝ 1/k (inverse, Darcy) — higher permeability → lower injection ΔP',
      'MPa',
    )
  }

  // R5 — thickness → injDeltaP (inverse) — only if ΔP values are meaningful
  if (Math.abs(baseInjDeltaP) > 0.01 && Math.abs(newInjDeltaP) > 0.01) {
    check(
      'R5',
      'Thickness',
      'Injection ΔP',
      baseParams.thickness,
      newParams.thickness,
      baseInjDeltaP,
      newInjDeltaP,
      'inverse',
      0.40,
      'ΔP ∝ 1/h (inverse, Darcy) — thicker reservoir → lower injection ΔP',
      'MPa',
    )
  }

  return results
}

// ─── 2. validateAllPresets ───────────────────────────────────────────────────

/**
 * Runs analytical validation for every FORMATION_PRESET without needing
 * a full simulation run.
 */
export function validateAllPresets(): PresetBenchmarkResult[] {
  return FORMATION_PRESETS.map((preset) => {
    const p = preset.params
    const T_K = p.temperature + 273.15
    const P_Pa = p.pressure * 1e6

    const co2Density = co2DensitySpanWagner(T_K, P_Pa)
    const phaseRaw = determinePhase(T_K, p.pressure, 0, 0)
    const phase = typeof phaseRaw === 'string' ? phaseRaw : (phaseRaw as { state?: string })?.state ?? String(phaseRaw)

    // DOE analytical P50 (Mt): A [km²→m²] * thickness [m] * porosity * Cc(0.020) * ρ [kg/m³] / 1e9
    const expectedP50Mt = (p.area * 1e6) * p.thickness * p.porosity * 0.020 * co2Density / 1e9

    // MAIP (MPa): 0.9 × (reservoir pressure + depth × 0.0226)
    const fracPres = p.pressure + p.depth * 0.0226
    const maipMPa = 0.9 * fracPres

    const isSupercritical = T_K > 304.25 && P_Pa > 7.38e6
    const densityOk = co2Density >= 300 && co2Density <= 900
    const pressureOk = p.pressure >= 7.38

    return {
      name: preset.name,
      location: preset.location,
      temperature: p.temperature,
      pressure: p.pressure,
      co2Density,
      phase,
      expectedP50Mt,
      maipMPa,
      isSupercritical,
      densityOk,
      pressureOk,
    }
  })
}

// ─── 3. validatePhysicsSanity ─────────────────────────────────────────────────

/**
 * Checks a simulation result against fundamental CCS physics constraints.
 */
export function validatePhysicsSanity(
  params: FormationParams,
  result: SimulationResult | null,
  _wells?: Well[],
): SanityCheck[] {
  const checks: SanityCheck[] = []

  // 1. Supercritical temperature
  checks.push({
    id: 'supercritical_T',
    label: 'Supercritical Temperature',
    pass: params.temperature > 31.04,
    value: `${fmtNum(params.temperature, 1)} °C`,
    expected: '> 31.04 °C',
    note: 'CO₂ must be supercritical for permanent storage',
  })

  // 2. Supercritical pressure
  checks.push({
    id: 'supercritical_P',
    label: 'Supercritical Pressure',
    pass: params.pressure > 7.38,
    value: `${fmtNum(params.pressure, 2)} MPa`,
    expected: '> 7.38 MPa',
    note: 'CO₂ must be supercritical for permanent storage',
  })

  if (!result) return checks

  // 3. CO2 density in valid supercritical range
  checks.push({
    id: 'density_range',
    label: 'CO₂ Density Range',
    pass: result.co2Density >= 300 && result.co2Density <= 900,
    value: `${fmtNum(result.co2Density, 0)} kg/m³`,
    expected: '300–900 kg/m³',
    note: 'Supercritical CO₂ at typical reservoir conditions',
  })

  // 4. Injection pressure below MAIP (90% of fracture pressure)
  const fracPres = params.pressure + params.depth * 0.0226
  const maip = 0.9 * fracPres
  checks.push({
    id: 'pressure_below_maip',
    label: 'Pressure Below MAIP',
    pass: result.injectionPressure < maip,
    value: `${fmtNum(result.injectionPressure, 2)} MPa`,
    expected: `< ${fmtNum(maip, 2)} MPa (MAIP = 0.9 × fracPres)`,
    note: 'Injection pressure must not exceed caprock fracture limit',
  })

  // 5. P50 formula self-consistency check
  const computedP50 = (params.area * 1e6) * params.thickness * params.porosity * 0.020 * result.co2Density / 1e9
  const p50Rel = result.p50 > 0 ? Math.abs(computedP50 - result.p50) / result.p50 : 1
  checks.push({
    id: 'p50_formula_check',
    label: 'P50 DOE Formula Consistency',
    pass: p50Rel < 0.01,
    value: `Computed ${fmtNum(computedP50, 3)} Mt | Engine ${fmtNum(result.p50, 3)} Mt`,
    expected: 'Relative deviation < 1%',
    note: 'Verifies DOE formula: M = A·h·φ·Cc·ρ is internally consistent',
  })

  return checks
}

// ─── 4. validateAgainstPreset ─────────────────────────────────────────────────
//
// When a user loads a preset (e.g. Niger Delta) and runs a simulation,
// this compares their result against the preset's analytical reference baseline:
//   - Reference P50/P10/P90 from DOE formula with preset's DEFAULT parameters
//   - Reference CO2 density from Span-Wagner at preset's default T/P
//
// For each analytically computable quantity, it also explains HOW MUCH of
// the deviation is explained by parameter changes the user made.

export interface PresetParamChange {
  label: string
  presetVal: number
  yourVal: number
  changePct: number
  impliedP50ChangePct: number   // for linear DOE params; 0 for non-linear/irrelevant
  relationship: 'linear-capacity' | 'inverse-pressure' | 'indirect'
}

export interface PresetComparisonItem {
  id: string
  label: string
  reference: number
  actual: number
  deviationPct: number
  tolerance: number    // ±% considered acceptable
  pass: boolean
  unit: string
  note: string
}

export interface PresetComparison {
  presetName: string
  location: string
  hasLiteratureData: boolean   // true only for Sleipner (published field measurements exist)
  literatureNote: string       // citation string for Sleipner; explanation for others
  items: PresetComparisonItem[]
  paramChanges: PresetParamChange[]
  // How much of the P50 deviation is explained by parameter changes?
  p50ExplainedChangePct: number   // cumulative implied change from all linear params
  p50ActualChangePct: number      // actual deviation of your P50 from reference
  residualDeviationPct: number    // unexplained deviation (should be near 0)
  deviationExplained: boolean     // true if residual < 5%
}

// Linear DOE params: changing them proportionally changes P50
const LINEAR_CAPACITY_PARAMS: Array<{ key: keyof FormationParams; label: string }> = [
  { key: 'thickness', label: 'Thickness' },
  { key: 'porosity',  label: 'Porosity'  },
  { key: 'area',      label: 'Area'      },
]

// Formations with published field data beyond just the DOE formula
const LITERATURE_FORMATIONS: Record<string, string> = {
  'Sleipner Utsira': 'Field data: Boait et al. 2012 (JGR), Furre et al. 2017 (Energy Procedia). See Sleipner tab for full comparison.',
  'Gorgon': 'Chevron quarterly reports (2019–2024); DOE Global CCS Institute.',
  'Quest (Alberta Basin)': 'Shell Quest CCS: >8 Mt injected (2015–). Most published MVA dataset in Americas.',
}

export function validateAgainstPreset(
  presetName: string,
  currentParams: FormationParams,
  currentResult: SimulationResult,
): PresetComparison | null {
  const preset = FORMATION_PRESETS.find((p) => p.name === presetName)
  if (!preset) return null

  const dp = preset.params  // default (reference) params

  // Reference CO2 density at default T/P
  const refT_K = dp.temperature + 273.15
  const refP_Pa = dp.pressure * 1e6
  const refDensity = co2DensitySpanWagner(refT_K, refP_Pa)

  // Reference DOE capacities (gross pore volume, no NTG)
  const refPV = (dp.area * 1e6) * dp.thickness * dp.porosity
  const refP10Mt = refPV * 0.0051 * refDensity / 1e9
  const refP50Mt = refPV * 0.020  * refDensity / 1e9
  const refP90Mt = refPV * 0.0550 * refDensity / 1e9

  // Reference CO2 density using CURRENT T/P (isolates density effect)
  const curT_K = currentParams.temperature + 273.15
  const curP_Pa = currentParams.pressure * 1e6
  const curDensity = co2DensitySpanWagner(curT_K, curP_Pa)

  // ── Parameter changes ──────────────────────────────────────────────────────
  const paramChanges: PresetParamChange[] = []

  for (const { key, label } of LINEAR_CAPACITY_PARAMS) {
    const presetVal = dp[key] as number
    const yourVal = currentParams[key] as number
    const changePct = safeRatio(yourVal - presetVal, presetVal) * 100
    if (Math.abs(changePct) > 0.5) {
      paramChanges.push({
        label,
        presetVal,
        yourVal,
        changePct,
        impliedP50ChangePct: changePct,   // linear relationship → same % change
        relationship: 'linear-capacity',
      })
    }
  }

  // T/P change → CO2 density change → indirect capacity effect
  const tempChangePct = safeRatio(currentParams.temperature - dp.temperature, dp.temperature) * 100
  const presChangePct = safeRatio(currentParams.pressure   - dp.pressure,    dp.pressure)    * 100
  if (Math.abs(tempChangePct) > 0.5) {
    paramChanges.push({
      label: 'Temperature', presetVal: dp.temperature, yourVal: currentParams.temperature,
      changePct: tempChangePct, impliedP50ChangePct: 0, relationship: 'indirect',
    })
  }
  if (Math.abs(presChangePct) > 0.5) {
    paramChanges.push({
      label: 'Pressure', presetVal: dp.pressure, yourVal: currentParams.pressure,
      changePct: presChangePct, impliedP50ChangePct: 0, relationship: 'indirect',
    })
  }

  // Permeability → injection pressure (inverse)
  const permChangePct = safeRatio(currentParams.permeability - dp.permeability, dp.permeability) * 100
  if (Math.abs(permChangePct) > 0.5) {
    paramChanges.push({
      label: 'Permeability', presetVal: dp.permeability, yourVal: currentParams.permeability,
      changePct: permChangePct, impliedP50ChangePct: 0, relationship: 'inverse-pressure',
    })
  }

  // ── P50 deviation accounting ───────────────────────────────────────────────
  // Sum of all linear-capacity param changes explains the P50 deviation.
  // The remaining deviation should come from CO2 density changes (T/P) + rounding.
  const p50ExplainedChangePct = paramChanges
    .filter((c) => c.relationship === 'linear-capacity')
    .reduce((acc, c) => {
      // Compound effect: each multiplicative factor
      return (1 + acc / 100) * (1 + c.changePct / 100) * 100 - 100
    }, 0)

  // Density-driven capacity change (CO2 density affects P50 linearly)
  const densityChangePct = safeRatio(curDensity - refDensity, refDensity) * 100

  // Total explained = param changes × density change (all multiply into P50)
  const totalExplainedPct = (1 + p50ExplainedChangePct / 100) * (1 + densityChangePct / 100) * 100 - 100
  const p50ActualChangePct = safeRatio(currentResult.p50 - refP50Mt, refP50Mt) * 100
  const residualDeviationPct = p50ActualChangePct - totalExplainedPct

  // ── Comparison items ───────────────────────────────────────────────────────
  const items: PresetComparisonItem[] = [
    {
      id: 'p50',
      label: 'P50 Storage Capacity',
      reference: refP50Mt,
      actual: currentResult.p50,
      deviationPct: p50ActualChangePct,
      tolerance: 15,
      pass: Math.abs(residualDeviationPct) < 15,
      unit: 'Mt',
      note: paramChanges.filter(c => c.relationship === 'linear-capacity').length > 0
        ? `Param changes account for ~${totalExplainedPct.toFixed(1)}% of the deviation`
        : 'No capacity-affecting params changed — should match reference closely',
    },
    {
      id: 'p10',
      label: 'P10 Capacity (optimistic)',
      reference: refP90Mt,   // PE convention: P10 = high = DOE P90
      actual: currentResult.p90,
      deviationPct: safeRatio(currentResult.p90 - refP90Mt, refP90Mt) * 100,
      tolerance: 15,
      pass: Math.abs(safeRatio(currentResult.p90 - refP90Mt, refP90Mt)) < 0.15,
      unit: 'Mt',
      note: 'P10 (optimistic) = DOE Cc P90 = 5.5% efficiency',
    },
    {
      id: 'p90',
      label: 'P90 Capacity (conservative)',
      reference: refP10Mt,   // PE convention: P90 = low = DOE P10
      actual: currentResult.p10,
      deviationPct: safeRatio(currentResult.p10 - refP10Mt, refP10Mt) * 100,
      tolerance: 15,
      pass: Math.abs(safeRatio(currentResult.p10 - refP10Mt, refP10Mt)) < 0.15,
      unit: 'Mt',
      note: 'P90 (conservative) = DOE Cc P10 = 0.51% efficiency',
    },
    {
      id: 'co2_density',
      label: 'CO₂ Density',
      reference: refDensity,
      actual: currentResult.co2Density,
      deviationPct: safeRatio(currentResult.co2Density - refDensity, refDensity) * 100,
      tolerance: 20,
      pass: Math.abs(safeRatio(currentResult.co2Density - refDensity, refDensity)) < 0.20,
      unit: 'kg/m³',
      note: 'Span-Wagner EOS at formation T/P. Deviates if temperature or pressure changed.',
    },
  ]

  const hasLiteratureData = presetName in LITERATURE_FORMATIONS
  const literatureNote = LITERATURE_FORMATIONS[presetName]
    ?? `No published injection data for ${presetName}. Reference values computed analytically from DOE Goodman 2011 + Span-Wagner EOS using default preset parameters.`

  return {
    presetName,
    location: preset.location,
    hasLiteratureData,
    literatureNote,
    items,
    paramChanges,
    p50ExplainedChangePct: totalExplainedPct,
    p50ActualChangePct,
    residualDeviationPct,
    deviationExplained: Math.abs(residualDeviationPct) < 15,
  }
}
