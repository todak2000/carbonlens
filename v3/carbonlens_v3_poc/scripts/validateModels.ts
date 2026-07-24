/**
 * scripts/validateModels.ts
 * =========================
 * CI check: verifies that every MODEL_REGISTRY entry is backed by
 * a real source file and an exported symbol in that file.
 *
 * Usage:
 *   yarn validate:models
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more errors found (CI fails)
 *
 * Checks performed:
 *   1. `implementedIn` file exists under src/
 *   2. If `exportedAs` is set, that string appears in the file
 *   3. Each `validatedAgainst.testFile` exists under src/
 *   4. No two entries share the same `id`
 *   5. All `alternativeTo` references point to a real id in the registry
 *   6. Warns on any 'hardcoded-constant' entries (not a failure, just visibility)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

import { MODEL_REGISTRY } from '../src/data/modelRegistry.js'
import type { ModelEntry } from '../src/data/modelRegistry.js'

const SRC = resolve(import.meta.dirname, '..', 'src')

let errors = 0
let warnings = 0

function err(id: string, msg: string) {
  console.error(`[validate:models] ERROR  [${id}] ${msg}`)
  errors++
}

function warn(id: string, msg: string) {
  console.warn(`[validate:models] WARN   [${id}] ${msg}`)
  warnings++
}

function ok(msg: string) {
  console.log(`[validate:models] OK     ${msg}`)
}

// ---------------------------------------------------------------------------
// Check 1: Unique IDs
// ---------------------------------------------------------------------------

const idSet = new Set<string>()
for (const m of MODEL_REGISTRY) {
  if (idSet.has(m.id)) err(m.id, 'Duplicate id in MODEL_REGISTRY')
  idSet.add(m.id)
}
ok(`${MODEL_REGISTRY.length} entries, all IDs unique: ${errors === 0 ? 'yes' : 'NO'}`)

// ---------------------------------------------------------------------------
// Check 2: implementedIn file exists
// ---------------------------------------------------------------------------

for (const m of MODEL_REGISTRY) {
  // Special case: benchmark entries may point to a directory
  const candidate = join(SRC, m.implementedIn)
  if (m.implementedIn.endsWith('/') || m.implementedIn.includes('__tests__')) {
    // Just check that the directory or some file under it exists
    const dir = candidate.replace(/\/$/, '')
    if (!existsSync(dir)) {
      warn(m.id, `implementedIn directory not found: ${m.implementedIn}`)
    }
    continue
  }
  if (!existsSync(candidate)) {
    err(m.id, `implementedIn file not found: src/${m.implementedIn}`)
  }
}

// ---------------------------------------------------------------------------
// Check 3: exportedAs symbol appears in implementedIn file
// ---------------------------------------------------------------------------

for (const m of MODEL_REGISTRY) {
  if (!m.exportedAs) continue
  const filePath = join(SRC, m.implementedIn)
  if (!existsSync(filePath)) continue   // already reported above
  const content = readFileSync(filePath, 'utf8')
  if (!content.includes(m.exportedAs)) {
    err(m.id, `exportedAs '${m.exportedAs}' not found in src/${m.implementedIn}`)
  }
}

// ---------------------------------------------------------------------------
// Check 4: validatedAgainst test files exist
// ---------------------------------------------------------------------------

for (const m of MODEL_REGISTRY) {
  if (!m.validatedAgainst) continue
  for (const ref of m.validatedAgainst) {
    const candidate = join(SRC, ref.testFile)
    // Allow both exact file and directory prefix
    const exists = existsSync(candidate) ||
      (ref.testFile.endsWith('/') && existsSync(candidate.replace(/\/$/, '')))
    if (!exists) {
      warn(m.id, `validatedAgainst testFile not found: src/${ref.testFile}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Check 5: alternativeTo references are valid ids
// ---------------------------------------------------------------------------

for (const m of MODEL_REGISTRY) {
  if (!m.alternativeTo) continue
  if (!idSet.has(m.alternativeTo)) {
    err(m.id, `alternativeTo '${m.alternativeTo}' is not a valid id in MODEL_REGISTRY`)
  }
}

// ---------------------------------------------------------------------------
// Check 6: Warn on hardcoded constants and stubs (visibility, not failure)
// ---------------------------------------------------------------------------

const hardcoded = MODEL_REGISTRY.filter((m: ModelEntry) => m.status === 'hardcoded-constant')
const stubs = MODEL_REGISTRY.filter((m: ModelEntry) => m.status === 'stub')

if (hardcoded.length > 0) {
  warn('(global)', `${hardcoded.length} hardcoded-constant entries need a real correlation: ${hardcoded.map(m => m.id).join(', ')}`)
}
if (stubs.length > 0) {
  warn('(global)', `${stubs.length} stub entries with incomplete implementations: ${stubs.map(m => m.id).join(', ')}`)
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log()
console.log(`[validate:models] ─────────────────────────────────────`)
console.log(`[validate:models] Registry: ${MODEL_REGISTRY.length} entries`)
console.log(`[validate:models]   active:           ${MODEL_REGISTRY.filter((m: ModelEntry) => m.status === 'active').length}`)
console.log(`[validate:models]   alternative:      ${MODEL_REGISTRY.filter((m: ModelEntry) => m.status === 'alternative').length}`)
console.log(`[validate:models]   stub:             ${stubs.length}`)
console.log(`[validate:models]   hardcoded-const:  ${hardcoded.length}`)
console.log(`[validate:models]   deprecated:       ${MODEL_REGISTRY.filter((m: ModelEntry) => m.status === 'deprecated').length}`)
console.log(`[validate:models] Errors:   ${errors}`)
console.log(`[validate:models] Warnings: ${warnings}`)
console.log(`[validate:models] ─────────────────────────────────────`)

if (errors > 0) {
  console.error('[validate:models] FAILED — fix errors above before merging.')
  process.exit(1)
} else {
  console.log('[validate:models] PASSED')
  process.exit(0)
}
