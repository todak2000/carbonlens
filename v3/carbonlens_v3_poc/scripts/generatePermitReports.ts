/**
 * scripts/generatePermitReports.ts
 * ==================================
 * Runs the CarbonLens simulation engine and generates permit report HTML files
 * for all 16 formation presets. Outputs to v3/validation/ directory.
 *
 * Skips formations that already have a permit report.
 *
 * Usage:
 *   yarn tsx scripts/generatePermitReports.ts
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

// ─── Minimal browser shims ─────────────────────────────────────────────────────
// Must be set up BEFORE any module imports that touch browser globals.

// Capture HTML written to mock window
let capturedHTML = ''

const mockLocation = {
  hostname: 'carbonlens.io',
  origin: 'https://carbonlens.io',
  href: 'https://carbonlens.io',
}

;(globalThis as Record<string, unknown>).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
}

;(globalThis as Record<string, unknown>).document = {
  querySelector:   () => null,
  createElement:   (_tag: string) => ({
    getContext: () => null,
    toDataURL: () => '',
    setAttribute: () => {},
    appendChild: () => {},
    style: {},
  }),
  createElementNS: () => ({
    setAttribute: () => {},
    appendChild: () => {},
  }),
}

;(globalThis as Record<string, unknown>).window = {
  open: (_url: string, _target: string) => ({
    document: {
      write: (html: string) => { capturedHTML = html },
      close: () => {},
    },
    focus: () => {},
    print: () => {},
  }),
  location: mockLocation,
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: () => {},
  removeEventListener: () => {},
}

;(globalThis as Record<string, unknown>).location = mockLocation
;(globalThis as Record<string, unknown>).alert = () => {}
;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: (t: number) => void) =>
  setTimeout(() => cb(0), 0)
;(globalThis as Record<string, unknown>).cancelAnimationFrame = (
  id: ReturnType<typeof setTimeout>,
) => clearTimeout(id)
try {
  ;(globalThis as Record<string, unknown>).navigator = { userAgent: 'node' }
} catch {
  // navigator may be read-only in some environments — ignore
}

// Minimal IndexedDB mock so Dexie does not throw on import
;(globalThis as Record<string, unknown>).indexedDB = {
  open: () => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: null,
  }),
}
;(globalThis as Record<string, unknown>).IDBKeyRange = {
  bound: () => ({}),
  only: () => ({}),
  lowerBound: () => ({}),
  upperBound: () => ({}),
}

// ─── CarbonLens engine imports ─────────────────────────────────────────────────
import { FORMATION_PRESETS } from '../src/data/formationPresets.js'
import {
  computeYearly,
  computeGeomechanicsResult,
} from '../src/hooks/useSimulation.js'
import { useFormationStore } from '../src/store/formationStore.js'
import { openPermitApplication } from '../src/utils/exportHTMLReports.js'
import type { Well } from '../src/types/index.js'

// ─── Constants ─────────────────────────────────────────────────────────────────
const ROOT    = resolve(import.meta.dirname, '..')
const VAL_DIR = resolve(ROOT, '../validation')

const PROJECT_YEARS = 20

// Mapping from formation name to output filename slug.
const NAME_TO_SLUG: Record<string, string> = {
  'Sleipner Utsira':       'sleipner_utsira',
  'Mount Simon':           'mount_simon',
  'Snøhvit Tubåen':       'sn_hvit_tubaen',
  'Gorgon':                'gorgon',
  'Johansen':              'johansen',
  'In Salah':              'in_salah',
  'Kasawari':              'kasawari',
  'Duyong':                'duyong',
  'Otway':                 'otway',
  'Malay Basin':           'malay_basin',
  'Niger Delta':           'niger_delta',
  'North Sumatra Basin':   'north_sumatra_basin',
  'Nile Delta':            'nile_delta',
  'Abu Dhabi Basin':       'abu_dhabi_basin',
  'Rotterdam / North Sea': 'rotterdam_north_sea',
  'Alberta Basin':         'alberta_basin',
}

function defaultWell(): Well {
  return {
    id: 'INJ-01',
    x: 1,
    z: 1,
    injectionRate: 1.0,
    label: 'INJ-01',
    rampUpYears: 3,
    rampDownYears: 7,
  }
}

// ─── Main generation loop ──────────────────────────────────────────────────────
console.log('\n[generatePermitReports] Generating permit reports...\n')
mkdirSync(VAL_DIR, { recursive: true })

let generated = 0
let skipped   = 0
let failed    = 0

for (const preset of FORMATION_PRESETS) {
  const slug = NAME_TO_SLUG[preset.name]

  if (slug === undefined) {
    console.warn(`  [WARN] ${preset.name} not found in NAME_TO_SLUG mapping — skipping`)
    skipped++
    continue
  }

  const outFile = `${slug}_permit_report.html`
  const outPath = join(VAL_DIR, outFile)

  try {
    const wells  = [defaultWell()]
    // Load wells into the Zustand store so computeYearly can read them
    useFormationStore.getState().setWells(wells)
    const result = computeYearly(preset.params, PROJECT_YEARS, PROJECT_YEARS)
    const geo    = computeGeomechanicsResult(preset.params, wells, result, PROJECT_YEARS)

    // Reset capture buffer before each call
    capturedHTML = ''

    openPermitApplication(
      preset.params,
      result,
      geo,
      wells,
      preset.name,
      preset.location,
      preset.jurisdiction,
      'CarbonLens Test Suite',  // organization
      [],                        // snapshots
      PROJECT_YEARS,
      PROJECT_YEARS,             // simulationYear = final year
    )

    if (!capturedHTML) {
      throw new Error('openPermitApplication produced no HTML output')
    }

    writeFileSync(outPath, capturedHTML, 'utf8')
    console.log(`  [OK]  ${preset.name.padEnd(30)} -> ${outFile}`)
    generated++
  } catch (err) {
    console.error(`  [ERR] ${preset.name}: ${(err as Error).message}`)
    if ((err as Error).stack) {
      console.error(`        ${(err as Error).stack?.split('\n').slice(1, 3).join('\n        ')}`)
    }
    failed++
  }
}

console.log(
  `\n[generatePermitReports] Done: ${generated} generated, ${skipped} skipped, ${failed} failed\n`,
)

if (failed > 0) {
  process.exit(1)
}
