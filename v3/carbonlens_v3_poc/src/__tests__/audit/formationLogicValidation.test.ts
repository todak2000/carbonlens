/**
 * ============================================================================
 * CARBONLENS V3 — FORMATION LOGIC VALIDATION SUITE
 * ============================================================================
 *
 * Automated physics-consistency and arithmetic-correctness checks across all
 * 16 preset formations. Runs computeYearly + computeGeomechanicsResult for
 * each preset at two simulation years (yr5 = early injection, yr20 = mature),
 * then applies a battery of logic checks.
 *
 * Outputs:
 *   - Console: one-line pass/warn/fail per check per formation
 *   - HTML report: /Users/todak2000/Desktop/codebase/carbonlens/v3/validation/logic-validation.html
 *
 * Run with:  yarn test src/__tests__/audit/formationLogicValidation.test.ts
 *
 * IMPORTANT: This file only DETECTS and REPORTS. No fixes are applied here.
 * Findings require human review before any code is changed.
 * ============================================================================
 */

import { describe, it } from 'vitest'
import fs from 'fs'
import path from 'path'

import { FORMATION_PRESETS } from '../../data/formationPresets'
import { computeYearly, computeGeomechanicsResult } from '../../hooks/useSimulation'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { runMonteCarlo, DEFAULT_MC_CONFIG } from '../../utils/monteCarlo'
import type { FormationParams, Well } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_YEARS = 30
const EVAL_YEAR = 20  // mature injection year for primary checks
const EVAL_YEAR_EARLY = 5

/**
 * Compute a formation-appropriate injection rate.
 *
 * Targets ~5% of the rough DOE P50 capacity per year, bounded to [0.05, 2.0] Mt/yr.
 * This avoids unrealistically high rates for small or tight formations (In Salah,
 * Otway, Snohvit) while keeping large formations at their natural operating scale.
 *
 * Rough P50 = Cc_P50 (0.02) * rho_CO2 (600 kg/m3) * phi * h_m * area_m2 * NTG / 1e9 [Mt]
 */
function formationInjectionRate(p: FormationParams): number {
  const approxP50_Mt = 0.02 * 600 * p.porosity * p.thickness * (p.area * 1e6) * p.netToGross / 1e9
  return Math.max(0.05, Math.min(2.0, approxP50_Mt * 0.05))
}

function makeWell(rate: number): Well {
  return {
    id: 'v-well-1',
    x: 0, z: 0,
    injectionRate: rate,
    label: 'Validation Well',
    rampUpYears: 3,
    rampDownYears: PROJECT_YEARS,
  }
}

// ── Severity type ─────────────────────────────────────────────────────────────

type Severity = 'PASS' | 'WARN' | 'FAIL' | 'INFO'

interface CheckResult {
  id: string
  label: string
  severity: Severity
  observed: string
  expected: string
  note: string
}

interface FormationReport {
  name: string
  location: string
  jurisdiction: string
  checks: CheckResult[]
  passCount: number
  warnCount: number
  failCount: number
}

// ── Helper: build a check result ─────────────────────────────────────────────

function check(
  id: string,
  label: string,
  pass: boolean,
  warn: boolean,
  observed: string,
  expected: string,
  note: string,
): CheckResult {
  const severity: Severity = pass ? 'PASS' : warn ? 'WARN' : 'FAIL'
  return { id, label, severity, observed, expected, note }
}

function info(id: string, label: string, observed: string, note: string): CheckResult {
  return { id, label, severity: 'INFO', observed, expected: 'N/A', note }
}

// ── Run checks for one formation ─────────────────────────────────────────────

function validateFormation(preset: typeof FORMATION_PRESETS[0]): FormationReport {
  const p: FormationParams = preset.params
  const results: CheckResult[] = []

  // Compute formation-appropriate injection rate
  const injRate = formationInjectionRate(p)
  const well = makeWell(injRate)

  // Set up Zustand store
  useFormationStore.setState({ wells: [well] })
  useSimulationStore.setState({ result: null })

  // Run simulation at two time points
  const r20 = computeYearly(p, EVAL_YEAR, PROJECT_YEARS, null)
  const r5  = computeYearly(p, EVAL_YEAR_EARLY, PROJECT_YEARS, null)
  const geo = computeGeomechanicsResult(p, [well], null)

  // Run MC (100 samples - fast)
  const mc = runMonteCarlo(DEFAULT_MC_CONFIG, p, PROJECT_YEARS)

  // ── 1. CO2 density in physical range ────────────────────────────────────────
  const rho = r20.co2Density
  const rhoOk = rho > 200 && rho < 1100
  const rhoWarn = rho >= 200 && rho < 300  // low density at high T (borderline)
  results.push(check(
    'co2-density-range',
    'CO\u2082 density in physical range',
    rhoOk && !rhoWarn,
    rhoOk && rhoWarn,
    `${rho.toFixed(1)} kg/m\u00B3`,
    '200\u20131100 kg/m\u00B3 (supercritical/dense-phase)',
    rho < 300 ? 'Low density: may be near-critical or high-T subcritical' : 'Normal',
  ))

  // ── 2. Density contrast (buoyancy driver) ───────────────────────────────────
  const deltarho = r20.brineDensity - r20.co2Density
  const drOk = deltarho > 50
  const drWarn = deltarho > 0 && deltarho <= 50
  results.push(check(
    'density-contrast',
    'Density contrast \u0394\u03C1 = \u03C1_brine \u2212 \u03C1_CO\u2082 > 0',
    drOk,
    drWarn,
    `${deltarho.toFixed(1)} kg/m\u00B3`,
    '> 50 kg/m\u00B3 for buoyancy-driven storage',
    deltarho < 50 ? 'Low buoyancy contrast: plume spreading may be underestimated' : 'OK',
  ))

  // ── 3. Injection pressure >= initial reservoir pressure ─────────────────────
  const dP = r20.injectionPressure - p.pressure
  results.push(check(
    'inj-pressure-positive',
    'Injection pressure \u2265 initial reservoir pressure',
    dP >= 0,
    dP >= -0.1 && dP < 0,  // very small negative could be rounding
    `${r20.injectionPressure.toFixed(2)} MPa (dP = ${dP.toFixed(3)} MPa)`,
    '\u2265 0 MPa above P_initial',
    dP < 0 ? 'LOGIC BUG: Pressure dropped below initial - check Darcy / Nordbotten solver' : 'OK',
  ))

  // ── 4. Injection pressure sanity cap ────────────────────────────────────────
  const injCap = p.pressure + 30
  results.push(check(
    'inj-pressure-cap',
    'Injection pressure < initial + 30 MPa cap',
    r20.injectionPressure < injCap,
    r20.injectionPressure >= injCap && r20.injectionPressure < injCap + 10,
    `${r20.injectionPressure.toFixed(2)} MPa`,
    `< ${injCap.toFixed(1)} MPa`,
    r20.injectionPressure >= injCap ? 'Suspiciously high pressure - check Darcy/friction terms' : 'OK',
  ))

  // ── 5. Storage capacity grows from yr5 to yr20 ──────────────────────────────
  const grows = r20.storageCapacity >= r5.storageCapacity * 0.99  // 1% tolerance
  results.push(check(
    'storage-growth',
    'Storage capacity grows from yr5 to yr20',
    grows,
    !grows && r20.storageCapacity > r5.storageCapacity * 0.90,
    `yr5=${r5.storageCapacity.toFixed(3)} Mt, yr20=${r20.storageCapacity.toFixed(3)} Mt`,
    'yr20 > yr5',
    !grows ? 'LOGIC BUG: Storage decreased over time - check cumulative injection logic' : 'OK',
  ))

  // ── 6. Capacity ordering: P10 >= P50 >= P90 (DOE convention) ───────────────
  const capOk = r20.capacityP10 >= r20.totalCapacity && r20.totalCapacity >= r20.capacityP90
  const capWarn = !capOk && Math.abs(r20.capacityP10 - r20.totalCapacity) < 0.001
  results.push(check(
    'capacity-ordering',
    'Capacity P10 \u2265 P50 \u2265 P90 (DOE volumetric)',
    capOk,
    capWarn,
    `P10=${r20.capacityP10.toFixed(2)}, P50=${r20.totalCapacity.toFixed(2)}, P90=${r20.capacityP90.toFixed(2)} Mt`,
    'P10 \u2265 P50 \u2265 P90',
    !capOk ? `Ordering violated: P10=${r20.capacityP10.toFixed(3)}, P50=${r20.totalCapacity.toFixed(3)}, P90=${r20.capacityP90.toFixed(3)}` : 'OK',
  ))

  // ── 7. Monte Carlo ordering: P10_Mt >= P50_Mt >= P90_Mt (petroleum conv.) ──
  // petroleum convention: P10 = optimistic (10% exceedance = high value)
  //                       P90 = conservative (90% exceedance = low value)
  const mcOk = mc.p10_Mt >= mc.p50_Mt && mc.p50_Mt >= mc.p90_Mt
  results.push(check(
    'mc-p10-p90-ordering',
    'MC ordering: P10_Mt \u2265 P50_Mt \u2265 P90_Mt (petroleum convention)',
    mcOk,
    false,
    `P10=${mc.p10_Mt.toFixed(2)}, P50=${mc.p50_Mt.toFixed(2)}, P90=${mc.p90_Mt.toFixed(2)} Mt`,
    'P10 \u2265 P50 \u2265 P90 (petroleum: P10=optimistic/high)',
    !mcOk ? 'LOGIC BUG: MC percentile ordering inverted' : 'OK',
  ))

  // ── 8. MC capacity > 0 ──────────────────────────────────────────────────────
  results.push(check(
    'mc-capacity-positive',
    'MC P50 storage capacity > 0',
    mc.p50_Mt > 0,
    false,
    `${mc.p50_Mt.toFixed(2)} Mt`,
    '> 0 Mt',
    mc.p50_Mt <= 0 ? 'LOGIC BUG: MC returned zero or negative capacity' : 'OK',
  ))

  // ── 9. BHP margin sign (fracPressure - peacemanBHP) ─────────────────────────
  // PASS  : margin > 0 MPa (safe)
  // WARN  : -10 to 0 MPa (physical constraint: may need multi-well or reduced rate)
  // FAIL  : < -10 MPa (very large negative indicates likely a logic or solver error)
  const bhpMargin = r20.bhpMargin_MPa
  const bhpOk = bhpMargin != null && bhpMargin > 0
  const bhpWarn = bhpMargin != null && bhpMargin >= -10 && bhpMargin <= 0
  results.push(check(
    'bhp-margin-positive',
    `BHP margin (fracPressure \u2212 peacemanBHP) at ${injRate.toFixed(2)} Mt/yr`,
    bhpOk,
    bhpWarn,
    bhpMargin != null ? `${bhpMargin.toFixed(3)} MPa` : 'null',
    '> 0 MPa (PASS); \u221210 to 0 MPa (WARN: operational constraint); < \u221210 MPa (FAIL)',
    bhpMargin != null && bhpMargin < -10
      ? `LOGIC ERROR: margin=${bhpMargin.toFixed(3)} MPa far below fracture - check solver`
      : bhpMargin != null && bhpMargin < 0
        ? `Physical constraint: ${injRate.toFixed(2)} Mt/yr single-well exceeds safe rate at this k/P - needs multi-well or rate reduction`
        : bhpMargin == null ? 'bhpMargin_MPa field missing from result' : 'OK',
  ))

  // ── 10. peacemanBHP >= initial reservoir pressure ───────────────────────────
  const pbhp = r20.peacemanBHP
  const pbhpOk = pbhp != null && pbhp >= p.pressure
  results.push(check(
    'peaceman-bhp-above-initial',
    'Peaceman BHP \u2265 initial reservoir pressure',
    pbhpOk,
    pbhp != null && pbhp >= p.pressure * 0.99 && pbhp < p.pressure,
    pbhp != null ? `${pbhp.toFixed(3)} MPa (P_init=${p.pressure} MPa)` : 'null',
    '\u2265 P_initial',
    pbhp != null && pbhp < p.pressure ? 'LOGIC BUG: BHP below initial pressure - cannot inject' : 'OK',
  ))

  // ── 11. peacemanBHP < geomechanics fracture pressure ───────────────────────
  const fracP = geo.fracturePressure
  const pbhpBelowFrac = pbhp == null || pbhp < fracP
  const pbhpBelowFracWarn = pbhp != null && pbhp >= fracP * 0.95 && pbhp < fracP
  results.push(check(
    'peaceman-bhp-below-frac',
    'Peaceman BHP < fracture pressure (no fracturing)',
    pbhpBelowFrac,
    pbhpBelowFracWarn,
    pbhp != null ? `BHP=${pbhp.toFixed(2)} MPa, Frac=${fracP.toFixed(2)} MPa` : 'null',
    'BHP < fracture pressure',
    pbhp != null && pbhp >= fracP ? `FRACTURE RISK: BHP(${pbhp.toFixed(2)}) \u2265 Pfrac(${fracP.toFixed(2)}) MPa` : 'OK',
  ))

  // ── 12. Trapping mass balance ────────────────────────────────────────────────
  // Full identity: totalCum = solubility + mineral + residual + mobile + massBalanceError
  // All four trapping components must be included in the sum. Omitting mineralTrapping
  // causes a systematic 15% gap for carbonate formations (higher mineral kinetics).
  const residual = r20.residualTrapping
  const solub = r20.solubilityTrapping
  const mineral = r20.mineralTrapping
  const mobile = r20.mobilePlume
  const componentSum = residual + solub + mineral + mobile
  const stored = r20.storageCapacity
  const massErr = stored > 0 ? Math.abs(componentSum - stored) / stored : 0
  const massOk = massErr <= 0.05
  const massWarn = massErr > 0.05 && massErr <= 0.15
  results.push(check(
    'trapping-mass-balance',
    'Trapping components (residual+solubility+mineral+mobile) \u2248 stored (\u00B15%)',
    massOk,
    massWarn,
    `sum=${componentSum.toFixed(3)} Mt [res=${residual.toFixed(3)}, sol=${solub.toFixed(3)}, min=${mineral.toFixed(3)}, mob=${mobile.toFixed(3)}], stored=${stored.toFixed(3)} Mt, err=${(massErr*100).toFixed(1)}%`,
    '\u03B5 \u2264 5% of storageCapacity',
    massErr > 0.15
      ? `MASS BALANCE ERROR ${(massErr*100).toFixed(1)}%: check all four trapping components and storageCapacity source`
      : massErr > 0.05
        ? `${(massErr*100).toFixed(1)}% gap: likely massBalanceError (boundary CO\u2082 not yet trapped) = ${r20.massBalanceError.toFixed(3)} Mt`
        : 'OK',
  ))

  // ── 13. All trapping components non-negative ─────────────────────────────────
  const allPositive = residual >= 0 && solub >= 0 && mobile >= 0
  results.push(check(
    'trapping-non-negative',
    'All trapping components \u2265 0',
    allPositive,
    false,
    `res=${residual.toFixed(3)}, sol=${solub.toFixed(3)}, mob=${mobile.toFixed(3)} Mt`,
    'All \u2265 0',
    !allPositive ? `NEGATIVE TRAPPING: res=${residual.toFixed(4)}, sol=${solub.toFixed(4)}, mob=${mobile.toFixed(4)}` : 'OK',
  ))

  // ── 14. massBalanceError near zero ──────────────────────────────────────────
  const mbe = r20.massBalanceError
  const mbeOk = mbe >= -0.1
  results.push(check(
    'mass-balance-error',
    'Internal mass balance error \u2265 -0.1 Mt',
    mbeOk,
    mbe >= -0.5 && mbe < -0.1,
    `${mbe.toFixed(4)} Mt`,
    '\u2265 -0.1 Mt (unswept CO\u2082; should be \u2265 0)',
    mbe < -0.5 ? `LARGE MASS BALANCE ERROR: ${mbe.toFixed(3)} Mt - suggests negative component` : 'OK',
  ))

  // ── 15. pvtStats density range arithmetic ────────────────────────────────────
  // densityRange_kgm3 is stored as the accurate unrounded (maxRho - minRho).
  // The display fix in exportHTMLReports.ts renders it as parseFloat(max.toFixed(1)) - parseFloat(min.toFixed(1))
  // so the report is internally consistent with displayed min/max.
  // Here we verify two things:
  //   (a) densityRange_kgm3 == maxRho - minRho within floating-point tolerance (stored field integrity)
  //   (b) when min != max (to 1dp), the display-computed range is non-zero (no zero-display bug)
  if (r20.pvtStats) {
    const pvt = r20.pvtStats
    const min = pvt.densityMin_kgm3
    const max = pvt.densityMax_kgm3
    const storedRange = pvt.densityRange_kgm3
    // (a) stored field should equal max - min within 0.001 (floating point tolerance)
    const rawRangeDiff = Math.abs(storedRange - (max - min))
    const fieldIntegritOk = rawRangeDiff < 0.001
    // (b) display-computed range from rounded values: if min.toFixed(1) != max.toFixed(1), range should not be 0
    const minDisp = parseFloat(min.toFixed(1))
    const maxDisp = parseFloat(max.toFixed(1))
    const displayRange = maxDisp - minDisp
    const displayZeroBug = minDisp !== maxDisp && displayRange === 0
    const rangeOk = fieldIntegritOk && !displayZeroBug
    results.push(check(
      'pvt-density-range',
      'PVT density range field integrity (densityRange = max \u2212 min)',
      rangeOk,
      !fieldIntegritOk && rawRangeDiff < 0.01,
      `range=${storedRange.toFixed(4)}, max\u2212min=${(max-min).toFixed(4)}, display=${displayRange.toFixed(1)} kg/m\u00B3`,
      'storedRange \u2248 max\u2212min (\u00B10.001); display\u2260 0 when min\u2260max',
      displayZeroBug ? `DISPLAY BUG: min=${minDisp}, max=${maxDisp} but display range=0.0` :
      !fieldIntegritOk ? `FIELD BUG: stored ${storedRange.toFixed(4)} \u2260 max\u2212min (${(max-min).toFixed(4)})` : 'OK',
    ))
  } else {
    results.push(info('pvt-density-range', 'PVT stats (density range)', 'pvtStats not populated at yr20', 'VE solver may not be running in test context'))
  }

  // ── 16. Solubility > 0 at reservoir conditions ──────────────────────────────
  results.push(check(
    'solubility-positive',
    'CO\u2082 solubility > 0 at reservoir conditions',
    r20.solubility > 0,
    false,
    `${r20.solubility.toFixed(4)} mol/kg`,
    '> 0 mol/kg',
    r20.solubility <= 0 ? 'LOGIC BUG: Duan-Sun returned zero or negative solubility' : 'OK',
  ))

  // ── 17. Geomechanics: fracture pressure > initial reservoir pressure ─────────
  results.push(check(
    'frac-above-initial',
    'Fracture pressure > initial reservoir pressure',
    geo.fracturePressure > p.pressure,
    false,
    `Pfrac=${geo.fracturePressure.toFixed(2)}, P_init=${p.pressure.toFixed(2)} MPa`,
    'Pfrac > P_init',
    geo.fracturePressure <= p.pressure ? 'LOGIC BUG: Fracture pressure <= initial pressure - impossible for intact rock' : 'OK',
  ))

  // ── 18. Geomechanics: safety factor > 0 ─────────────────────────────────────
  const sfOk = geo.safetyFactor > 1.0
  const sfWarn = geo.safetyFactor > 0.9 && geo.safetyFactor <= 1.0
  results.push(check(
    'geomech-safety-factor',
    'Geomechanics safety factor > 1.0',
    sfOk,
    sfWarn,
    `${geo.safetyFactor.toFixed(3)}`,
    '> 1.0 (stable)',
    geo.safetyFactor <= 1.0 ? `LOW SAFETY: SF=${geo.safetyFactor.toFixed(3)} \u2014 caprock may be at risk` : 'OK',
  ))

  // ── 19. MAIP margin positive ─────────────────────────────────────────────────
  const maipOk = geo.maipMargin > 0
  results.push(check(
    'maip-margin',
    'MAIP margin > 0 (injection below MAIP)',
    maipOk,
    geo.maipMargin >= -2 && geo.maipMargin <= 0,
    `MAIP=${geo.maip.toFixed(2)}, margin=${geo.maipMargin.toFixed(3)} MPa`,
    '> 0 MPa',
    !maipOk ? `MAIP EXCEEDED at yr20: margin=${geo.maipMargin.toFixed(3)} MPa - reduce injection rate` : 'OK',
  ))

  // ── 20. Regime classification vs permeability ────────────────────────────────
  // FormationRegime.type: 'BUOYANCY_DOMINATED' | 'MIXED' | 'PRESSURE_DOMINATED' | 'INJECTIVITY_LIMITED'
  // Expected mapping (Nordbotten & Celia 2006; NETL 2015; Bachu 2003):
  //   k >= 100 mD  →  BUOYANCY_DOMINATED or INJECTIVITY_LIMITED (if rate exceeds max safe)
  //   20 <= k < 100 mD  →  MIXED
  //   k < 20 mD   →  PRESSURE_DOMINATED or INJECTIVITY_LIMITED
  const regime = r20.formationRegime
  if (regime) {
    const rType = regime.type  // correct field: 'BUOYANCY_DOMINATED' | 'MIXED' | 'PRESSURE_DOMINATED' | 'INJECTIVITY_LIMITED'
    // High perm: expect buoyancy or injectivity-limited (1 Mt/yr may be too high for some)
    const highPermOk = p.permeability >= 100 &&
      (rType === 'BUOYANCY_DOMINATED' || rType === 'INJECTIVITY_LIMITED')
    // Transition: MIXED is valid for 20-100 mD
    const transOk = p.permeability >= 20 && p.permeability < 100 &&
      (rType === 'MIXED' || rType === 'INJECTIVITY_LIMITED')
    // Low perm: PRESSURE_DOMINATED or INJECTIVITY_LIMITED
    const lowPermOk = p.permeability < 20 &&
      (rType === 'PRESSURE_DOMINATED' || rType === 'INJECTIVITY_LIMITED')
    const regimeOk = highPermOk || transOk || lowPermOk
    // WARN for transition zone (20-100 mD): regime boundary, not definitively wrong
    const regimeWarn = !regimeOk && p.permeability >= 20 && p.permeability < 100
    results.push(check(
      'regime-vs-permeability',
      'Flow regime type consistent with formation permeability',
      regimeOk,
      regimeWarn,
      `k=${p.permeability} mD \u2192 type=${rType}, II=${regime.screeningScore}`,
      'k\u2265100 mD\u2192BUOYANCY; 20-100 mD\u2192MIXED; k<20 mD\u2192PRESSURE',
      !regimeOk && !regimeWarn
        ? `INCONSISTENT: k=${p.permeability} mD classified as ${rType} - check classifyFormationRegime thresholds`
        : regimeWarn ? `k=${p.permeability} mD in transition zone (MIXED expected), got ${rType}` : 'OK',
    ))
  } else {
    results.push(info('regime-vs-permeability', 'Flow regime classification', 'formationRegime not returned', 'formationRegime field not populated by computeYearly in test context'))
  }

  // ── 21. Depleted field: abandonment pressure <= initial pressure ─────────────
  if (p.formationType === 'depleted_gas' && p.abandonmentPressure != null) {
    const dOk = p.abandonmentPressure <= p.pressure
    results.push(check(
      'depleted-abandonment-pressure',
      'Depleted field: P_abandon \u2264 P_initial',
      dOk,
      false,
      `P_abandon=${p.abandonmentPressure} MPa, P_init=${p.pressure} MPa`,
      'P_abandon \u2264 P_initial (field is sub-hydrostatic after production)',
      !dOk ? 'LOGIC BUG: Abandonment pressure above initial pressure - impossible for depleted field' : 'OK',
    ))
  }

  // ── 22. capacityUtilPct in valid range ─────────────────────────────────────
  // Negative = logic error (FAIL). >100% with scaled rate is plausible for very small
  // formations; treat as WARN unless extreme (>500%). Negative is always FAIL.
  const util = r20.capacityUtilPct
  const utilFail = util < 0 || util > 500
  const utilWarn = !utilFail && util > 100
  results.push(check(
    'util-pct-range',
    `Capacity utilisation in valid range (inj=${injRate.toFixed(2)} Mt/yr)`,
    !utilFail && !utilWarn,
    utilWarn,
    `${util.toFixed(1)}%`,
    '[0, 100]% PASS; (100, 500]% WARN; <0 or >500% FAIL',
    util < 0 ? 'LOGIC BUG: negative utilisation' :
    util > 500 ? `EXTREMELY HIGH util ${util.toFixed(0)}% - formation may be too small for scaled rate` :
    util > 100 ? `>100% at ${injRate.toFixed(2)} Mt/yr: DOE capacity may understate actual (normal for aquifer sweep)` : 'OK',
  ))

  // ── 23. IFT > 0 (MARS model returns valid result) ───────────────────────────
  const iftOk = r20.ift != null && r20.ift > 0
  results.push(check(
    'ift-positive',
    'IFT (MARS model) > 0 mN/m',
    iftOk,
    r20.ift != null && r20.ift <= 0,
    r20.ift != null ? `${r20.ift.toFixed(2)} mN/m` : 'null',
    '> 0 mN/m',
    r20.ift != null && r20.ift <= 0 ? 'MARS returned zero/negative IFT - check applicability domain' : 'OK',
  ))

  // ── 24. geothermal temperature consistency ──────────────────────────────────
  if (p.geothermalGradient != null && p.surfaceTemperatureC != null) {
    const tMid = p.surfaceTemperatureC + p.geothermalGradient * (p.depth + p.thickness / 2) / 100
    const tDiff = Math.abs(tMid - p.temperature)
    results.push(check(
      'geothermal-temp-consistency',
      'params.temperature matches geothermal gradient derivation',
      tDiff < 0.2,
      tDiff >= 0.2 && tDiff < 2,
      `params.T=${p.temperature.toFixed(1)}\u00B0C, derived=${tMid.toFixed(1)}\u00B0C, diff=${tDiff.toFixed(2)}\u00B0C`,
      '|diff| < 0.2\u00B0C',
      tDiff >= 2 ? `CONFLICT: params.temperature=${p.temperature}\u00B0C but geothermal derives ${tMid.toFixed(1)}\u00B0C` : 'OK',
    ))
  }

  // ── 25. Containment probability in [0,1] ────────────────────────────────────
  const cpOk = r20.containmentProbability >= 0 && r20.containmentProbability <= 1
  results.push(check(
    'containment-probability',
    'Containment probability in [0, 1]',
    cpOk,
    false,
    `${r20.containmentProbability.toFixed(3)}`,
    '[0.0, 1.0]',
    !cpOk ? `OUT OF RANGE: ${r20.containmentProbability.toFixed(4)} - probability must be [0,1]` : 'OK',
  ))

  // ── Count results ────────────────────────────────────────────────────────────
  const passCount = results.filter(r => r.severity === 'PASS').length
  const warnCount = results.filter(r => r.severity === 'WARN').length
  const failCount = results.filter(r => r.severity === 'FAIL').length

  return {
    name: preset.name,
    location: preset.location,
    jurisdiction: preset.jurisdiction,
    checks: results,
    passCount,
    warnCount,
    failCount,
  }
}

// ── HTML report builder ───────────────────────────────────────────────────────

function severityBadge(s: Severity): string {
  const styles: Record<Severity, string> = {
    PASS: 'background:#d1fae5;color:#065f46;border:1px solid #a7f3d0',
    WARN: 'background:#fef3c7;color:#92400e;border:1px solid #fde68a',
    FAIL: 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5',
    INFO: 'background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe',
  }
  const icons: Record<Severity, string> = {
    PASS: '\u2713 PASS',
    WARN: '\u26A0 WARN',
    FAIL: '\u2717 FAIL',
    INFO: '\u2139 INFO',
  }
  return `<span style="padding:2px 8px;border-radius:10px;font-size:7pt;font-weight:700;font-family:'IBM Plex Mono',monospace;${styles[s]}">${icons[s]}</span>`
}

function buildHTML(reports: FormationReport[]): string {
  const totalFail = reports.reduce((s, r) => s + r.failCount, 0)
  const totalWarn = reports.reduce((s, r) => s + r.warnCount, 0)
  const totalPass = reports.reduce((s, r) => s + r.passCount, 0)
  const totalChecks = totalFail + totalWarn + totalPass

  const summaryRows = reports.map(r => {
    const status = r.failCount > 0 ? 'FAIL' : r.warnCount > 0 ? 'WARN' : 'PASS'
    return `
      <tr>
        <td style="font-weight:600">${r.name}</td>
        <td style="font-size:7.5pt;color:#64748b">${r.location}</td>
        <td><span style="padding:1px 7px;border-radius:8px;font-size:7pt;font-weight:700;font-family:monospace;background:${r.jurisdiction === 'MY' ? '#fef3c7' : '#f1f5f9'};color:${r.jurisdiction === 'MY' ? '#92400e' : '#475569'}">${r.jurisdiction}</span></td>
        <td style="text-align:center">${severityBadge(status as Severity)}</td>
        <td style="text-align:center;color:#065f46;font-weight:700">${r.passCount}</td>
        <td style="text-align:center;color:#92400e;font-weight:700">${r.warnCount}</td>
        <td style="text-align:center;color:#991b1b;font-weight:700">${r.failCount}</td>
      </tr>`
  }).join('')

  const detailSections = reports.map(r => {
    const rows = r.checks.map((c, i) => `
      <tr style="${i % 2 === 1 ? 'background:#f8fafc' : ''}">
        <td style="font-family:monospace;font-size:7.5pt;color:#475569">${c.id}</td>
        <td style="font-weight:600">${c.label}</td>
        <td>${severityBadge(c.severity)}</td>
        <td style="font-family:monospace;font-size:7.5pt">${c.observed}</td>
        <td style="font-size:7.5pt;color:#64748b">${c.expected}</td>
        <td style="font-size:7.5pt;color:${c.severity === 'FAIL' ? '#991b1b' : c.severity === 'WARN' ? '#92400e' : '#475569'}">${c.note}</td>
      </tr>`).join('')

    const headerColor = r.failCount > 0 ? '#fee2e2' : r.warnCount > 0 ? '#fef3c7' : '#d1fae5'
    const headerBorder = r.failCount > 0 ? '#fca5a5' : r.warnCount > 0 ? '#fde68a' : '#a7f3d0'
    return `
      <div style="margin:20px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;page-break-inside:avoid">
        <div style="background:${headerColor};border-bottom:2px solid ${headerBorder};padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <span style="font-weight:800;font-size:11pt;color:#0d1f3c">${r.name}</span>
            <span style="margin-left:10px;font-size:8.5pt;color:#64748b">${r.location}</span>
          </div>
          <div style="display:flex;gap:10px;font-size:8pt;font-weight:700">
            <span style="color:#065f46">${r.passCount} PASS</span>
            <span style="color:#92400e">${r.warnCount} WARN</span>
            <span style="color:#991b1b">${r.failCount} FAIL</span>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:8.5pt">
          <thead>
            <tr style="background:#0d1f3c;color:white">
              <th style="padding:6px 10px;text-align:left;width:14%">Check ID</th>
              <th style="padding:6px 10px;text-align:left;width:22%">Description</th>
              <th style="padding:6px 10px;text-align:left;width:7%">Status</th>
              <th style="padding:6px 10px;text-align:left;width:18%">Observed</th>
              <th style="padding:6px 10px;text-align:left;width:14%">Expected</th>
              <th style="padding:6px 10px;text-align:left">Notes / Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CarbonLens v3 \u2014 Formation Logic Validation Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=IBM+Plex+Sans:wght@300;400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'IBM Plex Sans', sans-serif; font-size: 9.5pt; color: #1e293b; background: #f8fafc; padding: 24px; }
    h1 { font-size: 22pt; color: #0d1f3c; font-weight: 800; }
    h2 { font-size: 12pt; color: #0d1f3c; font-weight: 700; margin: 20px 0 10px; border-bottom: 2px solid #00c4a0; padding-bottom: 5px; }
    .header { background: linear-gradient(160deg, #071629, #1e3a5f); color: white; padding: 28px 32px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { color: white; margin-bottom: 6px; }
    .header p { color: #94a3b8; font-size: 9pt; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; border-top: 3px solid #00c4a0; }
    .kpi-label { font-size: 6.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 4px; }
    .kpi-value { font-size: 18pt; font-weight: 800; color: #0d1f3c; font-family: 'IBM Plex Mono', monospace; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin: 12px 0; }
    thead th { background: #0d1f3c; color: white; padding: 7px 10px; text-align: left; font-size: 8pt; font-weight: 600; }
    tbody td { padding: 5px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tbody td:first-child { font-weight: 600; color: #0d1f3c; }
    .meta { font-size: 7.5pt; color: #94a3b8; margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style>
</head>
<body>

<div class="header">
  <h1>CarbonLens v3 \u2014 Formation Logic Validation Report</h1>
  <p>Automated physics-consistency and arithmetic-correctness checks across all ${reports.length} preset formations</p>
  <p style="margin-top:6px;color:#00c4a0;font-family:'IBM Plex Mono',monospace;font-size:8pt">Generated: ${new Date().toISOString()} \u2022 Simulation year: ${EVAL_YEAR} (primary) + ${EVAL_YEAR_EARLY} (early) \u2022 Injection: 1 Mt/yr standard well</p>
</div>

<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-label">Formations Tested</div>
    <div class="kpi-value">${reports.length}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Total Checks</div>
    <div class="kpi-value">${totalChecks}</div>
  </div>
  <div class="kpi" style="border-top-color:#10b981">
    <div class="kpi-label">Passing</div>
    <div class="kpi-value" style="color:#065f46">${totalPass}</div>
  </div>
  <div class="kpi" style="border-top-color:#f59e0b">
    <div class="kpi-label">Warnings</div>
    <div class="kpi-value" style="color:#92400e">${totalWarn}</div>
  </div>
</div>
${totalFail > 0 ? `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin:12px 0;font-weight:700;color:#991b1b">\u2717 ${totalFail} FAILURES detected across ${reports.filter(r => r.failCount > 0).length} formations. See details below.</div>` : '<div style="background:#d1fae5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;margin:12px 0;font-weight:700;color:#065f46">\u2713 No failures detected. All formations passed critical logic checks.</div>'}

<h2>Summary Table</h2>
<table>
  <thead>
    <tr>
      <th>Formation</th><th>Location</th><th>Jurisdiction</th><th>Status</th>
      <th style="text-align:center">Pass</th><th style="text-align:center">Warn</th><th style="text-align:center">Fail</th>
    </tr>
  </thead>
  <tbody>${summaryRows}</tbody>
</table>

<h2>Detailed Findings</h2>
${detailSections}

<div class="meta">
  CarbonLens v3 Formation Logic Validation \u2014 Auto-generated by formationLogicValidation.test.ts
  \u2022 Checks cover: CO\u2082 density, density contrast, injection pressure, BHP margin, trapping mass balance, Monte Carlo ordering, geomechanics, containment, PVT, regime classification
  \u2022 Injection scenario: 1 Mt/yr standard well, 30-year project, ramp-up 5 years
  \u2022 Physics engines: Span-Wagner (1996) EOS, Fenghour (1998) viscosity, Duan-Sun (2003) solubility, MARS IFT, Land (1968) trapping, Peaceman (1978) BHP, Hubbert-Willis (1957) fracture pressure
</div>

</body>
</html>`
}

// ── Test entry point ──────────────────────────────────────────────────────────

describe('Formation Logic Validation Suite', () => {
  it('runs all formations and reports physics consistency findings', () => {
    const outputDir = '/Users/todak2000/Desktop/codebase/carbonlens/v3/validation'
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    const reports: FormationReport[] = []
    const SEPARATOR = '='.repeat(80)

    console.log(`\n${SEPARATOR}`)
    console.log('CARBONLENS V3 \u2014 FORMATION LOGIC VALIDATION SUITE')
    console.log(`${SEPARATOR}`)
    console.log(`Testing ${FORMATION_PRESETS.length} formations at yr${EVAL_YEAR_EARLY} + yr${EVAL_YEAR} | 1 Mt/yr injector\n`)

    for (const preset of FORMATION_PRESETS) {
      const report = validateFormation(preset)
      reports.push(report)

      const injRate = formationInjectionRate(preset.params)
      const statusIcon = report.failCount > 0 ? '\u2717' : report.warnCount > 0 ? '\u26A0' : '\u2713'
      console.log(`${statusIcon} ${preset.name.padEnd(28)} [${preset.jurisdiction}]  rate=${injRate.toFixed(2)} Mt/yr  PASS:${report.passCount}  WARN:${report.warnCount}  FAIL:${report.failCount}`)

      for (const c of report.checks) {
        if (c.severity === 'FAIL' || c.severity === 'WARN') {
          console.log(`    ${c.severity === 'FAIL' ? '\u274C' : '\u26A0\uFE0F'} [${c.id}] ${c.label}`)
          console.log(`       observed: ${c.observed}`)
          console.log(`       note:     ${c.note}`)
        }
      }
    }

    const totalFail = reports.reduce((s, r) => s + r.failCount, 0)
    const totalWarn = reports.reduce((s, r) => s + r.warnCount, 0)
    const totalPass = reports.reduce((s, r) => s + r.passCount, 0)

    console.log(`\n${SEPARATOR}`)
    console.log(`SUMMARY: ${reports.length} formations | ${totalPass} PASS | ${totalWarn} WARN | ${totalFail} FAIL`)
    console.log(`${SEPARATOR}\n`)

    // Write HTML report
    const html = buildHTML(reports)
    const outPath = path.join(outputDir, 'logic-validation.html')
    fs.writeFileSync(outPath, html, 'utf8')
    console.log(`\u2713 Logic validation report written to: ${outPath}`)
    console.log(`  Open: file://${outPath}`)

    // Write plain text findings for quick review
    const failures = reports
      .filter(r => r.failCount > 0 || r.warnCount > 0)
      .map(r => {
        const issues = r.checks.filter(c => c.severity === 'FAIL' || c.severity === 'WARN')
        return `\n${r.name} (${r.location})\n` +
          issues.map(c => `  [${c.severity}] ${c.id}: ${c.note}`).join('\n')
      }).join('\n')

    const txtPath = path.join(outputDir, 'logic-validation-findings.txt')
    fs.writeFileSync(txtPath, `CarbonLens v3 Logic Validation Findings\n${'='.repeat(60)}\n${failures || '\nNo failures or warnings found.'}\n`, 'utf8')

    // The test itself passes regardless: it is a reporter, not an asserter.
    // If you want it to fail CI on FAIL-severity checks, uncomment:
    // expect(totalFail).toBe(0)
  }, 120_000)  // 2-minute timeout for all 16 formations + MC
})
