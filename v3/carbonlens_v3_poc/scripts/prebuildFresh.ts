/**
 * scripts/prebuildFresh.ts
 * ========================
 * Master pre-build orchestrator. Runs automatically via the "prebuild" npm
 * lifecycle hook BEFORE "tsc -b && vite build".
 *
 * Pipeline (in order):
 *
 *   1. validate:models       Verify all MODEL_REGISTRY entries have real source files.
 *                            Fails the build if any implementedIn path is broken.
 *
 *   2. engine:presets        Run computeYearly on all 18 FORMATION_PRESETS in Node.
 *                            Writes public/validation/validation-stats.json.
 *                            Fails the build if any preset throws.
 *
 *   3. opm:refresh           Re-run the OPM comparison pipeline (--skip-opm) for all
 *                            6 formations that have OPM output in upgrade_plan/.
 *                            Updates FIELD/COMPARISON_REPORT.html + comparison_data.json.
 *
 *   4. opm:inject            Inject fresh OPM comparison data (tables + figures) into
 *                            each of the 6 public/validation/*.html files.
 *
 *   5. sync:models           Inject <!-- MODEL_ATTRIBUTION --> tokens into all HTML files.
 *
 *   6. sync:validation       Copy ../validation/*.html -> public/validation/
 *                            (keeps the v3/validation mirror in sync)
 *
 * Usage:
 *   yarn prebuild            (called automatically by yarn build)
 *   yarn fresh               (standalone alias — runs only this script)
 *
 * Environment:
 *   SKIP_OPM_REFRESH=1       Skip step 3 (e.g. if Python env not available)
 *   SKIP_ENGINE_RUN=1        Skip step 2 (e.g. very fast rebuild)
 */

import { execSync, spawnSync } from 'child_process'
import { existsSync }          from 'fs'
import { join, resolve }       from 'path'

const ROOT      = resolve(import.meta.dirname, '..')
const REPO_ROOT = resolve(ROOT, '..', '..', '..')   // carbonlens repo root
const OPM_DIR   = join(REPO_ROOT, 'upgrade_plan', 'multi_simulator_validation', 'opm')

// ─── Helpers ──────────────────────────────────────────────────────────────────

let stepNum = 0

function step(label: string) {
  stepNum++
  console.log(`\n${'─'.repeat(60)}`)
  console.log(` Step ${stepNum}: ${label}`)
  console.log(`${'─'.repeat(60)}`)
}

function run(cmd: string, opts: { cwd?: string; failMsg?: string } = {}) {
  console.log(`  $ ${cmd}`)
  try {
    execSync(cmd, {
      cwd: opts.cwd ?? ROOT,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    })
  } catch {
    const msg = opts.failMsg ?? `Command failed: ${cmd}`
    console.error(`\n[prebuild] FAILED: ${msg}`)
    process.exit(1)
  }
}

function runPython(script: string, args: string[], cwd: string, failMsg: string) {
  // Try python3 first, fall back to python
  const py = existsSync('/usr/bin/python3') || existsSync('/usr/local/bin/python3') ? 'python3' : 'python'
  const result = spawnSync(py, [script, ...args], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  })
  if (result.status !== 0) {
    console.error(`\n[prebuild] FAILED: ${failMsg}`)
    process.exit(1)
  }
}

function warn(msg: string) {
  console.warn(`  [WARN] ${msg}`)
}

const SKIP_OPM    = process.env.SKIP_OPM_REFRESH === '1'
const SKIP_ENGINE = process.env.SKIP_ENGINE_RUN  === '1'

// ─── OPM fields ──────────────────────────────────────────────────────────────

const OPM_FIELDS = [
  'sleipner',
  'in_salah',
  'sn_hvit_tubaen',
  'otway',
  'mount_simon',
  'johansen',
] as const

// ─── Pipeline ─────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60))
console.log('  CarbonLens pre-build: full validation refresh')
console.log('  ' + new Date().toISOString())
console.log('═'.repeat(60))

// ── Step 1: Validate model registry ──────────────────────────────────────────
step('validate:models — verify MODEL_REGISTRY integrity')
run('tsx scripts/validateModels.ts')

// ── Step 2: Run engine on all presets ────────────────────────────────────────
step('engine:presets — run CarbonLens engine on all 18 formation presets')
if (SKIP_ENGINE) {
  warn('SKIP_ENGINE_RUN=1 — skipping engine run (existing validation-stats.json will be used)')
} else {
  run('tsx scripts/runEngineOnPresets.ts')
}

// ── Step 3: OPM comparison refresh ───────────────────────────────────────────
step('opm:refresh — re-run OPM comparison pipeline (--skip-opm) for all 6 formations')
if (SKIP_OPM) {
  warn('SKIP_OPM_REFRESH=1 — skipping OPM refresh')
} else if (!existsSync(OPM_DIR)) {
  warn(`OPM directory not found at ${OPM_DIR} — skipping OPM refresh`)
} else {
  for (const field of OPM_FIELDS) {
    const dataFile = `${field}/${field}.DATA`
    const outSmry  = join(OPM_DIR, field, 'output', `${field.toUpperCase()}.UNSMRY`)
    if (!existsSync(outSmry)) {
      warn(`${field}: no UNSMRY in output/ — run OPM Docker first, or copy output files. Skipping.`)
      continue
    }
    console.log(`\n  [opm] ${field}`)
    runPython(
      'run_comparison.py',
      ['--data-file', dataFile, '--skip-opm'],
      OPM_DIR,
      `OPM comparison failed for ${field}`,
    )
  }
  console.log('\n  [opm] All 6 fields refreshed.')
}

// ── Step 4: Inject OPM data into validation HTMLs ────────────────────────────
step('opm:inject — inject OPM comparison data into public/validation/*.html')
if (SKIP_OPM) {
  warn('SKIP_OPM_REFRESH=1 — skipping OPM injection')
} else if (!existsSync(OPM_DIR)) {
  warn('OPM directory not found — skipping OPM injection')
} else {
  // Call the Python injection script (written in the session that built the
  // inject_opm_validation.py script). We keep it as Python since it's already
  // tested and handles base64 image embedding cleanly.
  const INJECT_SCRIPT = join(ROOT, 'scripts', 'injectOpmValidation.py')
  if (!existsSync(INJECT_SCRIPT)) {
    warn(`Injection script not found at ${INJECT_SCRIPT} — skipping injection`)
  } else {
    runPython(
      INJECT_SCRIPT,
      [],
      ROOT,
      'OPM injection into validation HTMLs failed',
    )
  }
}

// ── Step 5: Sync model attributions ──────────────────────────────────────────
step('sync:models — inject MODEL_ATTRIBUTION tokens into all HTML files')
run('tsx scripts/syncModels.ts')

// ── Step 6: Sync validation HTMLs to public/ ─────────────────────────────────
step('sync:validation — copy ../validation/*.html -> public/validation/')
run('yarn sync:validation')

// ── Done ─────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60))
console.log(`  Pre-build complete (${stepNum} steps). Ready for tsc + vite build.`)
console.log('═'.repeat(60) + '\n')
