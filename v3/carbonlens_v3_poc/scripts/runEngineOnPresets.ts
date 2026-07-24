/**
 * scripts/runEngineOnPresets.ts
 * =============================
 * Runs the CarbonLens simulation engine (computeYearly + computeGeomechanicsResult)
 * on every entry in FORMATION_PRESETS and writes a fresh
 * public/validation/validation-stats.json.
 *
 * This file is intentionally browser-shim-minimal: it patches only the two
 * globals that the engine touches when run outside the browser:
 *   - document.querySelector  (canvas snapshot path — returns null, skipped)
 *   - requestAnimationFrame   (not used inside computeYearly, but imported transitively)
 *
 * Usage:
 *   yarn tsx scripts/runEngineOnPresets.ts
 *   (also called automatically by scripts/prebuildFresh.ts)
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

// ─── Minimal browser shims ────────────────────────────────────────────────────
// computeYearly references document.querySelector inside a try/catch for canvas
// capture. Returning null is the correct headless behaviour.
;(globalThis as Record<string, unknown>).document = {
  querySelector:   () => null,
  createElement:   () => ({ getContext: () => null, toDataURL: () => '' }),
  createElementNS: () => ({ setAttribute: () => {}, appendChild: () => {} }),
}
;(globalThis as Record<string, unknown>).window = {
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: () => {},
  removeEventListener: () => {},
}
;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(0), 0)
;(globalThis as Record<string, unknown>).cancelAnimationFrame  = (id: ReturnType<typeof setTimeout>) => clearTimeout(id)
;(globalThis as Record<string, unknown>).navigator = { userAgent: 'node' }

// ─── CarbonLens engine imports ────────────────────────────────────────────────
import { FORMATION_PRESETS }        from '../src/data/formationPresets.js'
import { computeYearly, computeGeomechanicsResult } from '../src/hooks/useSimulation.js'
import type { Well }                from '../src/types/index.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROOT       = resolve(import.meta.dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public')
const VAL_DIR    = join(PUBLIC_DIR, 'validation')
const OUT_PATH   = join(VAL_DIR, 'validation-stats.json')

// Default single injection well used for all presets (1 Mt/yr, 25-yr project)
function defaultWell(): Well {
  return {
    id: 'INJ-1',
    x: 0, z: 0,
    injectionRate: 1.0,
    label: 'INJ-1',
    rampUpYears: 2,
    rampDownYears: 2,
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

interface PresetStats {
  name:                string
  location:            string
  jurisdiction:        string
  generatedAt:         string
  projectYears:        number
  storageCapacityMt:   number
  totalCapacityP50Mt:  number
  capacityUtilPct:     number
  plumeRadiusM:        number
  plumeHeightM:        number
  co2DensityKgM3:      number
  containmentPct:      number
  residualTrappingMt:  number
  solubilityTrappingMt:number
  mineralTrappingMt:   number
  mobilePlumeMt:       number
  phaseState:          string
  formationRegime:     string | null
  screeningScore:      number | null
  safetyFactor:        number
  fracturePressureMPa: number
  surfaceHeaveCm:      number
}

console.log('\n[engine:presets] Running CarbonLens engine on all formation presets...\n')

const PROJECT_YEARS = 25
const stats: PresetStats[] = []
let passed = 0
let failed = 0

for (const preset of FORMATION_PRESETS) {
  const wells = [defaultWell()]
  try {
    const result = computeYearly(preset.params, wells, PROJECT_YEARS)
    const geo    = computeGeomechanicsResult(preset.params, wells)

    const regime = result.formationRegime
    stats.push({
      name:                 preset.name,
      location:             preset.location,
      jurisdiction:         preset.jurisdiction,
      generatedAt:          new Date().toISOString(),
      projectYears:         PROJECT_YEARS,
      storageCapacityMt:    result.storageCapacity,
      totalCapacityP50Mt:   result.totalCapacity,
      capacityUtilPct:      result.capacityUtilPct,
      plumeRadiusM:         result.plumeRadius,
      plumeHeightM:         result.plumeHeight,
      co2DensityKgM3:       result.co2Density,
      containmentPct:       result.containmentProbability,
      residualTrappingMt:   result.residualTrapping,
      solubilityTrappingMt: result.solubilityTrapping,
      mineralTrappingMt:    result.mineralTrapping,
      mobilePlumeMt:        result.mobilePlume,
      phaseState:           result.co2Density > 400 ? 'supercritical' : 'subcritical',
      formationRegime:      regime?.type ?? null,
      screeningScore:       regime?.screeningScore ?? null,
      safetyFactor:         geo.safetyFactor,
      fracturePressureMPa:  geo.fracturePressure,
      surfaceHeaveCm:       geo.surfaceHeave * 100,
    })
    console.log(
      `  [OK]  ${preset.name.padEnd(30)} ` +
      `P50=${result.totalCapacity.toFixed(1)} Mt  ` +
      `r=${result.plumeRadius.toFixed(0)} m  ` +
      `regime=${regime?.type ?? 'n/a'}`
    )
    passed++
  } catch (err) {
    console.error(`  [ERR] ${preset.name}: ${(err as Error).message}`)
    failed++
  }
}

// Write output
mkdirSync(VAL_DIR, { recursive: true })
const output = {
  schemaVersion: '1.0',
  generatedAt:   new Date().toISOString(),
  engineVersion: 'CarbonLens v3',
  projectYears:  PROJECT_YEARS,
  totalPresets:  FORMATION_PRESETS.length,
  passed,
  failed,
  formations:    stats,
}

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8')

console.log(`\n[engine:presets] ${passed} passed, ${failed} failed`)
console.log(`[engine:presets] Wrote ${OUT_PATH}`)

if (failed > 0) {
  console.error(`[engine:presets] ${failed} formations failed — fix engine errors before building.`)
  process.exit(1)
}

console.log('[engine:presets] Done.\n')
