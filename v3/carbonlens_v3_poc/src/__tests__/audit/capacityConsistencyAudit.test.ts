/**
 * ============================================================================
 * CARBONLENS V3 — CAPACITY CONSISTENCY AUDIT
 * ============================================================================
 *
 * Catches cross-engine bugs that the existing formation logic suite misses
 * because each engine was tested in isolation.
 *
 * Three capacity sources must agree for every preset:
 *   A) Formation Panel Step 3 logic  (computeFormationPanelCapacity below)
 *   B) computeOptimalRate            (rate envelope P50)
 *   C) computeYearly / useSimulation (totalCapacity = P50 from sim engine)
 *
 * Known bugs this suite was designed to catch:
 *   BUG-01: Formation Panel always used DOE Goodman for depleted_gas formations
 *           (source A used wrong method vs source C). Gave 84 Mt instead of ~2 Mt.
 *   BUG-02: computeOptimalRate always used DOE Goodman for depleted_gas
 *           (source B wrong vs source C). Rate envelope was off by ~40x.
 *   BUG-03: P10/P90 coefficient semantics inverted in computeOptimalRate vs
 *           useSimulation. P90 was the HIGH value in one, LOW in the other.
 *   BUG-04: Geothermal gradient params persisted across preset loads, silently
 *           overriding preset measured temperatures.
 *   BUG-05: NTG applied in Formation Panel DOE formula but not in useSimulation.
 *
 * Outputs:
 *   HTML report: validation/capacity-consistency.html
 *
 * Run: yarn test src/__tests__/audit/capacityConsistencyAudit.test.ts
 * ============================================================================
 */

import { describe, it } from 'vitest'
import fs from 'fs'
import path from 'path'

import { FORMATION_PRESETS } from '../../data/formationPresets'
import { computeYearly } from '../../hooks/useSimulation'
import { computeOptimalRate } from '../../utils/computeOptimalRate'
import { computeDepletedFieldCapacity, co2DensityWithImpurities } from '../../engine'
import type { FormationParams, Well } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_YEARS = 30
const EVAL_YEAR     = 20   // mature injection — P50 fully established
const TOLERANCE_PCT = 2.0  // capacity sources must agree within 2%

// ── Replicate Formation Panel Step 3 logic exactly ────────────────────────────
// This function must mirror what FormationPanel renders in case 3.
// Any divergence here IS the bug.

function computeFormationPanelCapacity(p: FormationParams): {
  method: string
  p90_Mt: number
  p50_Mt: number
  p10_Mt: number
} {
  const isDepletedField = p.formationType === 'depleted_gas' || p.formationType === 'depleted_oil'
  const hasDepletedData = isDepletedField && p.giip != null && p.abandonmentPressure != null

  if (hasDepletedData) {
    const T_K = p.temperature + 273.15
    // fillFactor_P50=0.60 and lithologyClass must match useSimulation.ts
    const dep  = computeDepletedFieldCapacity(p.giip!, T_K, p.pressure, p.abandonmentPressure!, 0.60, p.methaneFraction, p.nitrogenFraction, p.lithologyClass)
    return {
      method: 'depleted-gas-replacement (Bachu 2007)',
      p90_Mt: dep.storageP90_Mt,
      p50_Mt: dep.storageMt,
      p10_Mt: dep.storageP10_Mt,
    }
  }

  // DOE Goodman 2011 — gross pore volume, no NTG (matches useSimulation)
  const A        = p.area * 1e6          // m²
  const poreVol  = A * p.thickness * p.porosity  // m³
  const T_K      = p.temperature + 273.15
  const rho      = co2DensityWithImpurities(T_K, p.pressure * 1e6, p.methaneFraction, p.nitrogenFraction)
  return {
    method: 'DOE Goodman 2011 (saline aquifer)',
    p90_Mt: poreVol * 0.0051 * rho / 1e9,
    p50_Mt: poreVol * 0.0200 * rho / 1e9,
    p10_Mt: poreVol * 0.0550 * rho / 1e9,
  }
}

// ── Test well ─────────────────────────────────────────────────────────────────

function makeWell(rate: number): Well {
  return {
    id: 'audit-well',
    x: 0, z: 0,
    injectionRate: rate,
    label: 'Audit Well',
    rampUpYears: 3,
    rampDownYears: PROJECT_YEARS,
  }
}

// ── Check helpers ─────────────────────────────────────────────────────────────

type Severity = 'PASS' | 'WARN' | 'FAIL' | 'INFO'
interface CheckResult {
  id: string; label: string; severity: Severity
  observed: string; expected: string; note: string
}

function pass(id: string, label: string, observed: string): CheckResult {
  return { id, label, severity: 'PASS', observed, expected: '', note: 'OK' }
}
function fail(id: string, label: string, observed: string, note: string): CheckResult {
  return { id, label, severity: 'FAIL', observed, expected: '', note }
}
function warn(id: string, label: string, observed: string, note: string): CheckResult {
  return { id, label, severity: 'WARN', observed, expected: '', note }
}
function info(id: string, label: string, observed: string): CheckResult {
  return { id, label, severity: 'INFO', observed, expected: 'N/A', note: '' }
}

function pctDiff(a: number, b: number): number {
  const ref = Math.max(Math.abs(a), Math.abs(b), 0.001)
  return Math.abs(a - b) / ref * 100
}

// ── Per-preset checks ─────────────────────────────────────────────────────────

interface PresetReport {
  name: string; location: string; jurisdiction: string; formationType: string
  checks: CheckResult[]
  passCount: number; warnCount: number; failCount: number
}

function auditPreset(preset: typeof FORMATION_PRESETS[0]): PresetReport {
  const p = preset.params
  const checks: CheckResult[] = []

  // SOURCE A: Formation Panel Step 3 capacity
  const panelCap = computeFormationPanelCapacity(p)

  // SOURCE B: computeOptimalRate capacity
  const well = makeWell(0.5)  // rate value doesn't affect capacity Px
  const rateEnv = computeOptimalRate(p, [well], PROJECT_YEARS)

  // SOURCE C: simulation engine totalCapacity (P50)
  const simResult = computeYearly(p, EVAL_YEAR, PROJECT_YEARS, null)

  // ── CHECK 1: Panel P50 vs Simulation P50 ────────────────────────────────────
  const diffAC = pctDiff(panelCap.p50_Mt, simResult.totalCapacity)
  checks.push(
    diffAC <= TOLERANCE_PCT
      ? pass('panel-vs-sim-p50',
          'Panel P50 === Sim P50',
          `Panel=${panelCap.p50_Mt.toFixed(3)} Mt, Sim=${simResult.totalCapacity.toFixed(3)} Mt, diff=${diffAC.toFixed(2)}%`)
      : fail('panel-vs-sim-p50',
          'Panel P50 === Sim P50',
          `Panel=${panelCap.p50_Mt.toFixed(3)} Mt, Sim=${simResult.totalCapacity.toFixed(3)} Mt, diff=${diffAC.toFixed(2)}%`,
          `MISMATCH ${diffAC.toFixed(1)}%: Panel and simulation use different capacity formulas. Check formationType routing and NTG consistency.`),
  )

  // ── CHECK 2: rateEnv P50 vs Simulation P50 ──────────────────────────────────
  const diffBC = pctDiff(rateEnv.totalCapacityP50, simResult.totalCapacity)
  checks.push(
    diffBC <= TOLERANCE_PCT
      ? pass('rateenv-vs-sim-p50',
          'RateEnv P50 === Sim P50',
          `RateEnv=${rateEnv.totalCapacityP50.toFixed(3)} Mt, Sim=${simResult.totalCapacity.toFixed(3)} Mt, diff=${diffBC.toFixed(2)}%`)
      : fail('rateenv-vs-sim-p50',
          'RateEnv P50 === Sim P50',
          `RateEnv=${rateEnv.totalCapacityP50.toFixed(3)} Mt, Sim=${simResult.totalCapacity.toFixed(3)} Mt, diff=${diffBC.toFixed(2)}%`,
          `MISMATCH ${diffBC.toFixed(1)}%: computeOptimalRate and useSimulation disagree. Check formationType routing.`),
  )

  // ── CHECK 3: Panel P50 vs rateEnv P50 ───────────────────────────────────────
  const diffAB = pctDiff(panelCap.p50_Mt, rateEnv.totalCapacityP50)
  checks.push(
    diffAB <= TOLERANCE_PCT
      ? pass('panel-vs-rateenv-p50',
          'Panel P50 === RateEnv P50',
          `Panel=${panelCap.p50_Mt.toFixed(3)}, RateEnv=${rateEnv.totalCapacityP50.toFixed(3)} Mt, diff=${diffAB.toFixed(2)}%`)
      : fail('panel-vs-rateenv-p50',
          'Panel P50 === RateEnv P50',
          `Panel=${panelCap.p50_Mt.toFixed(3)}, RateEnv=${rateEnv.totalCapacityP50.toFixed(3)} Mt, diff=${diffAB.toFixed(2)}%`,
          `MISMATCH ${diffAB.toFixed(1)}%: Formation Panel and computeOptimalRate use different capacity formulas.`),
  )

  // ── CHECK 4: Capacity ordering P10 >= P50 >= P90 (DOE exceedance convention) ─
  // Panel
  const panelOrdered = panelCap.p10_Mt >= panelCap.p50_Mt && panelCap.p50_Mt >= panelCap.p90_Mt
  checks.push(panelOrdered
    ? pass('panel-capacity-ordering',
        'Panel P10 >= P50 >= P90 (DOE exceedance)',
        `P10=${panelCap.p10_Mt.toFixed(3)}, P50=${panelCap.p50_Mt.toFixed(3)}, P90=${panelCap.p90_Mt.toFixed(3)} Mt`)
    : fail('panel-capacity-ordering',
        'Panel P10 >= P50 >= P90 (DOE exceedance)',
        `P10=${panelCap.p10_Mt.toFixed(3)}, P50=${panelCap.p50_Mt.toFixed(3)}, P90=${panelCap.p90_Mt.toFixed(3)} Mt`,
        `INVERTED: P10/P90 coefficients swapped in Formation Panel. P90 must be conservative (low), P10 optimistic (high).`))

  // Rate envelope
  const envOrdered = rateEnv.totalCapacityP10 >= rateEnv.totalCapacityP50 && rateEnv.totalCapacityP50 >= rateEnv.totalCapacityP90
  checks.push(envOrdered
    ? pass('rateenv-capacity-ordering',
        'RateEnv P10 >= P50 >= P90 (DOE exceedance)',
        `P10=${rateEnv.totalCapacityP10.toFixed(3)}, P50=${rateEnv.totalCapacityP50.toFixed(3)}, P90=${rateEnv.totalCapacityP90.toFixed(3)} Mt`)
    : fail('rateenv-capacity-ordering',
        'RateEnv P10 >= P50 >= P90 (DOE exceedance)',
        `P10=${rateEnv.totalCapacityP10.toFixed(3)}, P50=${rateEnv.totalCapacityP50.toFixed(3)}, P90=${rateEnv.totalCapacityP90.toFixed(3)} Mt`,
        `INVERTED: computeOptimalRate P10/P90 Cc coefficients are swapped.`))

  // Simulation engine
  const simOrdered = simResult.capacityP10 >= simResult.totalCapacity && simResult.totalCapacity >= simResult.capacityP90
  checks.push(simOrdered
    ? pass('sim-capacity-ordering',
        'Sim P10 >= P50 >= P90 (DOE exceedance)',
        `P10=${simResult.capacityP10.toFixed(3)}, P50=${simResult.totalCapacity.toFixed(3)}, P90=${simResult.capacityP90.toFixed(3)} Mt`)
    : fail('sim-capacity-ordering',
        'Sim P10 >= P50 >= P90 (DOE exceedance)',
        `P10=${simResult.capacityP10.toFixed(3)}, P50=${simResult.totalCapacity.toFixed(3)}, P90=${simResult.capacityP90.toFixed(3)} Mt`,
        `INVERTED: useSimulation P10/P90 Cc coefficients are swapped.`))

  // ── CHECK 5: Depleted gas formations use GIIP-based capacity ─────────────────
  if (p.formationType === 'depleted_gas' || p.formationType === 'depleted_oil') {
    if (p.giip != null && p.abandonmentPressure != null) {
      // Compute what DOE Goodman would give (the wrong answer for depleted fields)
      const A            = p.area * 1e6
      const poreVol_m3   = A * p.thickness * p.porosity
      const T_K          = p.temperature + 273.15
      const rho          = co2DensityWithImpurities(T_K, p.pressure * 1e6, 0, 0)
      const doeWrongP50  = poreVol_m3 * 0.02 * rho / 1e9

      const dep          = computeDepletedFieldCapacity(p.giip, T_K, p.pressure, p.abandonmentPressure, 0.60, p.methaneFraction, p.nitrogenFraction, p.lithologyClass)
      const giipP50      = dep.storageMt

      // Panel and sim should be close to GIIP-based, not DOE Goodman
      const panelUsesGIIP = pctDiff(panelCap.p50_Mt, giipP50) < pctDiff(panelCap.p50_Mt, doeWrongP50)
      const simUsesGIIP   = pctDiff(simResult.totalCapacity, giipP50) < pctDiff(simResult.totalCapacity, doeWrongP50)

      checks.push(panelUsesGIIP
        ? pass('panel-depleted-method',
            'Panel uses GIIP-based method for depleted field',
            `Panel P50=${panelCap.p50_Mt.toFixed(3)} Mt ≈ GIIP=${giipP50.toFixed(3)} Mt (DOE-wrong=${doeWrongP50.toFixed(3)} Mt)`)
        : fail('panel-depleted-method',
            'Panel uses GIIP-based method for depleted field',
            `Panel P50=${panelCap.p50_Mt.toFixed(3)} Mt, GIIP-correct=${giipP50.toFixed(3)} Mt, DOE-wrong=${doeWrongP50.toFixed(3)} Mt`,
            `Panel closer to DOE Goodman than GIIP method. Formation Panel Step 3 must route to computeDepletedFieldCapacity for depleted_gas/oil.`))

      checks.push(simUsesGIIP
        ? pass('sim-depleted-method',
            'Simulation uses GIIP-based method for depleted field',
            `Sim P50=${simResult.totalCapacity.toFixed(3)} Mt ≈ GIIP=${giipP50.toFixed(3)} Mt`)
        : fail('sim-depleted-method',
            'Simulation uses GIIP-based method for depleted field',
            `Sim P50=${simResult.totalCapacity.toFixed(3)} Mt, GIIP-correct=${giipP50.toFixed(3)} Mt`,
            `Simulation closer to DOE Goodman than GIIP method. useSimulation must route to computeDepletedFieldCapacity.`))

      // Area independence: 4x area should not change depleted gas capacity
      const bigAreaParams: FormationParams = { ...p, area: p.area * 4 }
      const simBigArea = computeYearly(bigAreaParams, EVAL_YEAR, PROJECT_YEARS, null)
      const panelBigArea = computeFormationPanelCapacity(bigAreaParams)
      const areaChangeSim   = pctDiff(simResult.totalCapacity, simBigArea.totalCapacity)
      const areaChangePanel = pctDiff(panelCap.p50_Mt, panelBigArea.p50_Mt)

      checks.push(areaChangeSim < 0.5
        ? pass('depleted-area-independence-sim',
            'Sim capacity unchanged when area 4x (depleted gas is GIIP-bound)',
            `Base=${simResult.totalCapacity.toFixed(3)} Mt, 4xArea=${simBigArea.totalCapacity.toFixed(3)} Mt, change=${areaChangeSim.toFixed(2)}%`)
        : fail('depleted-area-independence-sim',
            'Sim capacity unchanged when area 4x (depleted gas is GIIP-bound)',
            `Base=${simResult.totalCapacity.toFixed(3)} Mt, 4xArea=${simBigArea.totalCapacity.toFixed(3)} Mt, change=${areaChangeSim.toFixed(2)}%`,
            `Depleted gas capacity scaled with area — simulation used DOE Goodman instead of GIIP method.`))

      checks.push(areaChangePanel < 0.5
        ? pass('depleted-area-independence-panel',
            'Panel capacity unchanged when area 4x (depleted gas is GIIP-bound)',
            `Base=${panelCap.p50_Mt.toFixed(3)} Mt, 4xArea=${panelBigArea.p50_Mt.toFixed(3)} Mt, change=${areaChangePanel.toFixed(2)}%`)
        : fail('depleted-area-independence-panel',
            'Panel capacity unchanged when area 4x (depleted gas is GIIP-bound)',
            `Base=${panelCap.p50_Mt.toFixed(3)} Mt, 4xArea=${panelBigArea.p50_Mt.toFixed(3)} Mt, change=${areaChangePanel.toFixed(2)}%`,
            `Formation Panel capacity scaled with area — still using DOE Goodman for depleted_gas field.`))

    } else {
      checks.push(warn('depleted-missing-data',
        'Depleted field has giip + abandonmentPressure',
        `giip=${p.giip ?? 'null'}, P_abandon=${p.abandonmentPressure ?? 'null'}`,
        `Depleted field preset is missing giip or abandonmentPressure — falls back to DOE Goodman (may be intentional).`))
    }
  }

  // ── CHECK 6: No geothermal override contamination in preset params ────────────
  // Preset params should never carry geothermalGradient + surfaceTemperatureC
  // because loading a preset clears these fields (our fix). If a preset still
  // has these fields, the auto-derive effect will fire and override the measured T.
  if (p.geothermalGradient != null && p.surfaceTemperatureC != null) {
    const tDerived = p.surfaceTemperatureC + p.geothermalGradient * (p.depth + p.thickness / 2) / 100
    const tDiff    = Math.abs(tDerived - p.temperature)
    checks.push(tDiff < 1
      ? pass('no-gradient-override',
          'Geothermal gradient consistent with preset temperature',
          `preset T=${p.temperature}°C, derived T=${tDerived.toFixed(1)}°C, diff=${tDiff.toFixed(2)}°C`)
      : fail('no-gradient-override',
          'Geothermal gradient consistent with preset temperature',
          `preset T=${p.temperature}°C, gradient derives T=${tDerived.toFixed(1)}°C, diff=${tDiff.toFixed(2)}°C`,
          `TEMPERATURE CONFLICT: preset has geothermalGradient=${p.geothermalGradient} and surfaceTemperatureC=${p.surfaceTemperatureC} but these derive ${tDerived.toFixed(1)}°C, not the preset measured ${p.temperature}°C. Density and all capacity figures will be wrong.`))
  } else {
    checks.push(info('no-gradient-override',
      'No geothermal gradient in preset params (correct)',
      `geothermalGradient=null, surfaceTemperatureC=null — preset temperature=${p.temperature}°C is authoritative`))
  }

  // ── CHECK 7: CO2 density sanity ──────────────────────────────────────────────
  const T_K = (p.geothermalGradient != null && p.surfaceTemperatureC != null
    ? p.surfaceTemperatureC + p.geothermalGradient * (p.depth + p.thickness / 2) / 100
    : p.temperature) + 273.15
  const rho = co2DensityWithImpurities(T_K, p.pressure * 1e6, p.methaneFraction, p.nitrogenFraction)
  const rhoBad = rho <= 0.1 || rho > 1100
  const rhoLow = rho > 0.1 && rho < 200
  checks.push(
    rhoBad
      ? fail('co2-density-sanity',
          'CO2 density in physical range',
          `${rho.toFixed(2)} kg/m³`,
          `Density ${rho.toFixed(2)} kg/m³ is outside physical range (200-1100 kg/m³ for reservoir CO2). Pressure unit bug? Check that pressure is passed in Pa, not MPa, to Span-Wagner.`)
      : rhoLow
        ? warn('co2-density-sanity',
            'CO2 density in physical range',
            `${rho.toFixed(2)} kg/m³`,
            `Low density ${rho.toFixed(2)} kg/m³: subcritical or near-critical CO2 at these T/P conditions. Capacity will be underestimated.`)
        : pass('co2-density-sanity',
            'CO2 density in physical range',
            `${rho.toFixed(2)} kg/m³`))

  // ── CHECK 8: Capacity P50 in plausible range per km² ─────────────────────────
  // For saline aquifers: rule of thumb 0.5-50 Mt per km² for typical reservoirs.
  // For depleted gas: capacity scales with GIIP, not area, so skip area normalisation.
  if (!((p.formationType === 'depleted_gas' || p.formationType === 'depleted_oil') && p.giip != null)) {
    const cap_per_km2 = panelCap.p50_Mt / p.area
    const tooLow  = cap_per_km2 < 0.001
    const tooHigh = cap_per_km2 > 500
    checks.push(
      tooLow
        ? fail('capacity-per-area',
            'P50 capacity / area in plausible range (saline aquifer)',
            `${cap_per_km2.toFixed(4)} Mt/km² (total P50=${panelCap.p50_Mt.toFixed(3)} Mt, area=${p.area} km²)`,
            `Too low: < 0.001 Mt/km². Likely density bug or Cc coefficient error.`)
        : tooHigh
          ? warn('capacity-per-area',
              'P50 capacity / area in plausible range (saline aquifer)',
              `${cap_per_km2.toFixed(2)} Mt/km² (total P50=${panelCap.p50_Mt.toFixed(3)} Mt, area=${p.area} km²)`,
              `Unusually high. Verify CO2 density and Cc coefficients.`)
          : pass('capacity-per-area',
              'P50 capacity / area in plausible range (saline aquifer)',
              `${cap_per_km2.toFixed(4)} Mt/km²`))
  }

  // ── CHECK 9: minRate < optimalRate < maxRate in rate envelope ─────────────────
  const rateOk = rateEnv.minRate < rateEnv.optimalRate && rateEnv.optimalRate < rateEnv.maxRate
  checks.push(rateOk
    ? pass('rate-envelope-ordering',
        'RateEnv: minRate < optimalRate < maxRate',
        `min=${rateEnv.minRate.toFixed(4)}, opt=${rateEnv.optimalRate.toFixed(4)}, max=${rateEnv.maxRate.toFixed(4)} Mt/yr/well`)
    : fail('rate-envelope-ordering',
        'RateEnv: minRate < optimalRate < maxRate',
        `min=${rateEnv.minRate.toFixed(4)}, opt=${rateEnv.optimalRate.toFixed(4)}, max=${rateEnv.maxRate.toFixed(4)} Mt/yr/well`,
        `Rate envelope bounds inverted. Check minRate/maxRate assignment in computeOptimalRate return statement.`))

  const passCount = checks.filter(c => c.severity === 'PASS').length
  const warnCount = checks.filter(c => c.severity === 'WARN').length
  const failCount = checks.filter(c => c.severity === 'FAIL').length

  return {
    name: preset.name,
    location: preset.location,
    jurisdiction: preset.jurisdiction,
    formationType: p.formationType ?? 'saline_aquifer',
    checks,
    passCount,
    warnCount,
    failCount,
  }
}

// ── HTML report ───────────────────────────────────────────────────────────────

function severityBadge(s: Severity): string {
  const styles: Record<Severity, string> = {
    PASS: 'background:#d1fae5;color:#065f46;border:1px solid #a7f3d0',
    WARN: 'background:#fef3c7;color:#92400e;border:1px solid #fde68a',
    FAIL: 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5',
    INFO: 'background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe',
  }
  const icons: Record<Severity, string> = {
    PASS: '✓ PASS', WARN: '⚠ WARN', FAIL: '✗ FAIL', INFO: '● INFO',
  }
  return `<span style="padding:2px 8px;border-radius:10px;font-size:7pt;font-weight:700;font-family:'IBM Plex Mono',monospace;${styles[s]}">${icons[s]}</span>`
}

function buildHTML(reports: PresetReport[]): string {
  const totalFail  = reports.reduce((s, r) => s + r.failCount, 0)
  const totalWarn  = reports.reduce((s, r) => s + r.warnCount, 0)
  const totalPass  = reports.reduce((s, r) => s + r.passCount, 0)
  const totalChecks = totalFail + totalWarn + totalPass

  const summaryRows = reports.map(r => {
    const status = r.failCount > 0 ? 'FAIL' : r.warnCount > 0 ? 'WARN' : 'PASS'
    const typeBadge = r.formationType.includes('depleted')
      ? `<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:8px;font-size:7pt;font-weight:700">depleted</span>`
      : `<span style="background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:8px;font-size:7pt;font-weight:700">aquifer</span>`
    return `<tr>
      <td style="font-weight:600">${r.name}</td>
      <td style="font-size:7.5pt;color:#64748b">${r.location}</td>
      <td>${typeBadge}</td>
      <td><span style="padding:1px 7px;border-radius:8px;font-size:7pt;font-weight:700;font-family:monospace;background:#f1f5f9;color:#475569">${r.jurisdiction}</span></td>
      <td>${severityBadge(status as Severity)}</td>
      <td style="text-align:center;color:#065f46;font-weight:700">${r.passCount}</td>
      <td style="text-align:center;color:#92400e;font-weight:700">${r.warnCount}</td>
      <td style="text-align:center;color:#991b1b;font-weight:700">${r.failCount}</td>
    </tr>`
  }).join('')

  const detailSections = reports.map(r => {
    const rows = r.checks.map((c, i) => `
      <tr style="${i % 2 === 1 ? 'background:#f8fafc' : ''}">
        <td style="font-family:monospace;font-size:7pt;color:#475569">${c.id}</td>
        <td style="font-weight:600">${c.label}</td>
        <td>${severityBadge(c.severity)}</td>
        <td style="font-family:monospace;font-size:7.5pt">${c.observed}</td>
        <td style="font-size:7.5pt;color:${c.severity === 'FAIL' ? '#991b1b' : c.severity === 'WARN' ? '#92400e' : '#475569'}">${c.note}</td>
      </tr>`).join('')

    const hc = r.failCount > 0 ? '#fee2e2' : r.warnCount > 0 ? '#fef3c7' : '#d1fae5'
    const hb = r.failCount > 0 ? '#fca5a5' : r.warnCount > 0 ? '#fde68a' : '#a7f3d0'
    return `
      <div style="margin:20px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;page-break-inside:avoid">
        <div style="background:${hc};border-bottom:2px solid ${hb};padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <span style="font-weight:800;font-size:11pt;color:#0d1f3c">${r.name}</span>
            <span style="margin-left:10px;font-size:8.5pt;color:#64748b">${r.location}</span>
            <span style="margin-left:8px;font-size:7.5pt;color:#94a3b8;font-family:monospace">[${r.formationType}]</span>
          </div>
          <div style="display:flex;gap:10px;font-size:8pt;font-weight:700">
            <span style="color:#065f46">${r.passCount} PASS</span>
            <span style="color:#92400e">${r.warnCount} WARN</span>
            <span style="color:#991b1b">${r.failCount} FAIL</span>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:8.5pt">
          <thead><tr style="background:#0d1f3c;color:white">
            <th style="padding:5px 8px;text-align:left;width:16%">Check ID</th>
            <th style="padding:5px 8px;text-align:left;width:22%">Description</th>
            <th style="padding:5px 8px;text-align:left;width:7%">Status</th>
            <th style="padding:5px 8px;text-align:left;width:26%">Observed</th>
            <th style="padding:5px 8px;text-align:left">Notes / Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CarbonLens v3 — Capacity Consistency Audit</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;600;700;800&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'IBM Plex Sans',sans-serif; font-size:9.5pt; color:#1e293b; background:#f8fafc; padding:24px; }
    h1 { font-size:22pt; color:#0d1f3c; font-weight:800; }
    h2 { font-size:12pt; color:#0d1f3c; font-weight:700; margin:20px 0 10px; border-bottom:2px solid #00c4a0; padding-bottom:5px; }
    .header { background:linear-gradient(160deg,#071629,#1e3a5f); color:white; padding:28px 32px; border-radius:12px; margin-bottom:24px; }
    .header h1 { color:white; margin-bottom:6px; }
    .header p { color:#94a3b8; font-size:9pt; }
    .kpi-row { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin:16px 0; }
    .kpi { background:white; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; border-top:3px solid #00c4a0; }
    .kpi-label { font-size:6.5pt; color:#64748b; text-transform:uppercase; letter-spacing:0.08em; font-weight:600; margin-bottom:4px; }
    .kpi-value { font-size:18pt; font-weight:800; color:#0d1f3c; font-family:'IBM Plex Mono',monospace; }
    table { width:100%; border-collapse:collapse; background:white; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0; margin:12px 0; }
    thead th { background:#0d1f3c; color:white; padding:7px 10px; text-align:left; font-size:8pt; font-weight:600; }
    tbody td { padding:5px 10px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    .bug-legend { background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:14px 16px; margin:12px 0; font-size:8.5pt; }
    .bug-legend h3 { color:#c2410c; margin-bottom:8px; font-size:10pt; }
    .bug-item { margin:4px 0; display:flex; gap:8px; }
    .bug-id { font-family:monospace; background:#fee2e2; color:#991b1b; padding:1px 6px; border-radius:4px; font-size:7.5pt; white-space:nowrap; }
    .meta { font-size:7.5pt; color:#94a3b8; margin-top:16px; border-top:1px solid #e2e8f0; padding-top:10px; }
  </style>
</head>
<body>

<div class="header">
  <h1>CarbonLens v3 — Capacity Consistency Audit</h1>
  <p>Cross-engine consistency checks: Formation Panel Step 3 vs computeOptimalRate vs useSimulation — all three must agree</p>
  <p style="margin-top:6px;color:#00c4a0;font-family:'IBM Plex Mono',monospace;font-size:8pt">Generated: ${new Date().toISOString()} • ${reports.length} formations • Tolerance: ${TOLERANCE_PCT}%</p>
</div>

<div class="bug-legend">
  <h3>Bugs this suite was designed to catch</h3>
  <div class="bug-item"><span class="bug-id">BUG-01</span>Formation Panel Step 3 used DOE Goodman for depleted_gas (gave 84 Mt instead of ~2 Mt for Duyong at 500 km²)</div>
  <div class="bug-item"><span class="bug-id">BUG-02</span>computeOptimalRate used DOE Goodman for depleted_gas (rate envelope off by ~40x; Formation Intelligence Card wrong)</div>
  <div class="bug-item"><span class="bug-id">BUG-03</span>P10/P90 Cc coefficient semantics inverted in computeOptimalRate vs useSimulation (P90 was HIGH in one, LOW in the other)</div>
  <div class="bug-item"><span class="bug-id">BUG-04</span>Geothermal gradient params persisted across preset loads, silently overriding preset measured temperatures (Sleipner: 37°C became 69.6°C)</div>
  <div class="bug-item"><span class="bug-id">BUG-05</span>NTG applied in old Formation Panel DOE formula but not in useSimulation (systematic factor mismatch for all aquifer formations)</div>
</div>

<div class="kpi-row">
  <div class="kpi"><div class="kpi-label">Formations Tested</div><div class="kpi-value">${reports.length}</div></div>
  <div class="kpi"><div class="kpi-label">Total Checks</div><div class="kpi-value">${totalChecks}</div></div>
  <div class="kpi" style="border-top-color:#10b981"><div class="kpi-label">Passing</div><div class="kpi-value" style="color:#065f46">${totalPass}</div></div>
  <div class="kpi" style="border-top-color:#f59e0b"><div class="kpi-label">Warnings</div><div class="kpi-value" style="color:#92400e">${totalWarn}</div></div>
  <div class="kpi" style="border-top-color:#ef4444"><div class="kpi-label">Failures</div><div class="kpi-value" style="color:#991b1b">${totalFail}</div></div>
</div>

${totalFail > 0
  ? `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin:12px 0;font-weight:700;color:#991b1b">✗ ${totalFail} FAILURES across ${reports.filter(r => r.failCount > 0).length} formations. See details below.</div>`
  : `<div style="background:#d1fae5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;margin:12px 0;font-weight:700;color:#065f46">✓ All ${totalChecks} consistency checks passed. No cross-engine mismatches detected.</div>`}

<h2>Summary</h2>
<table>
  <thead><tr>
    <th>Formation</th><th>Location</th><th>Type</th><th>Jurisdiction</th>
    <th>Status</th><th style="text-align:center">Pass</th><th style="text-align:center">Warn</th><th style="text-align:center">Fail</th>
  </tr></thead>
  <tbody>${summaryRows}</tbody>
</table>

<h2>Detailed Findings</h2>
${detailSections}

<div class="meta">
  CarbonLens v3 Capacity Consistency Audit — capacityConsistencyAudit.test.ts<br>
  Checks: Panel vs Sim P50 agreement (±${TOLERANCE_PCT}%), P10≥P50≥P90 ordering, depleted-gas GIIP routing, area independence, gradient-override contamination, CO2 density range, rate envelope bounds<br>
  Capacity sources: Formation Panel Step 3 logic • computeOptimalRate • useSimulation (computeYearly yr${EVAL_YEAR})<br>
  Physics: Span-Wagner (1996) EOS • Bachu et al. (2007) gas-replacement volumetric • DOE Goodman (2011) Cc framework
</div>

</body>
</html>`
}

// ── Test entry point ──────────────────────────────────────────────────────────

describe('Capacity Consistency Audit — Cross-Engine Agreement', () => {
  it('all capacity sources agree for every preset formation', () => {
    const outputDir = '/Users/todak2000/Desktop/codebase/carbonlens/v3/validation'
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    const reports: PresetReport[] = []
    const SEP = '='.repeat(80)

    console.log(`\n${SEP}`)
    console.log('CARBONLENS V3 — CAPACITY CONSISTENCY AUDIT')
    console.log(SEP)
    console.log(`Checking ${FORMATION_PRESETS.length} formations | Panel vs RateEnv vs Sim | tol=${TOLERANCE_PCT}%\n`)

    for (const preset of FORMATION_PRESETS) {
      const report = auditPreset(preset)
      reports.push(report)

      const icon = report.failCount > 0 ? '✗' : report.warnCount > 0 ? '⚠' : '✓'
      const ftype = (preset.params.formationType ?? 'aquifer').replace('depleted_', 'dep-')
      console.log(`${icon} ${preset.name.padEnd(30)} [${ftype.padEnd(12)}]  PASS:${report.passCount}  WARN:${report.warnCount}  FAIL:${report.failCount}`)

      for (const c of report.checks) {
        if (c.severity === 'FAIL' || c.severity === 'WARN') {
          console.log(`    ${c.severity === 'FAIL' ? '❌' : '⚠️ '} [${c.id}] ${c.label}`)
          console.log(`       ${c.observed}`)
          console.log(`       ${c.note}`)
        }
      }
    }

    const totalFail  = reports.reduce((s, r) => s + r.failCount, 0)
    const totalWarn  = reports.reduce((s, r) => s + r.warnCount, 0)
    const totalPass  = reports.reduce((s, r) => s + r.passCount, 0)

    console.log(`\n${SEP}`)
    console.log(`SUMMARY: ${reports.length} formations | ${totalPass} PASS | ${totalWarn} WARN | ${totalFail} FAIL`)
    console.log(`${SEP}\n`)

    // Write HTML
    const html    = buildHTML(reports)
    const outPath = path.join(outputDir, 'capacity-consistency.html')
    fs.writeFileSync(outPath, html, 'utf8')
    console.log(`✓ Report: file://${outPath}`)

    // This suite asserts — CI will fail if any FAIL-severity check exists
    if (totalFail > 0) {
      const failList = reports
        .filter(r => r.failCount > 0)
        .flatMap(r => r.checks.filter(c => c.severity === 'FAIL').map(c => `  ${r.name}: [${c.id}] ${c.note}`))
        .join('\n')
      throw new Error(`${totalFail} capacity consistency failures:\n${failList}`)
    }
  }, 120_000)
})
