/**
 * scripts/syncModels.ts
 * =====================
 * Generates public/model-registry.json from MODEL_REGISTRY and injects
 * updated attribution text into static HTML files.
 *
 * Usage:
 *   yarn sync:models
 *
 * What it does:
 *   1. Writes public/model-registry.json (consumed by external tools, APIs, and PDFs)
 *   2. Replaces <!-- MODEL_ATTRIBUTION --> tokens in public/validation/*.html
 *      with the current Simulation Engine attribution string
 *   3. Replaces <!-- MODEL_PROVENANCE_TABLE --> tokens with the full provenance table
 *
 * Add these tokens to any HTML file to get auto-injection:
 *   <!-- MODEL_ATTRIBUTION -->
 *   <!-- MODEL_PROVENANCE_TABLE -->
 *
 * Run via: yarn sync:models
 * Run in CI after yarn build to verify manifests are up-to-date.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { execSync } from 'child_process'

// ---------------------------------------------------------------------------
// Bootstrap: import registry without going through Vite/React
// ---------------------------------------------------------------------------

// We use tsx (or ts-node) to run this script directly, so we can import TS.
// The registry has no browser-only imports, so it loads fine in Node.

import {
  MODEL_REGISTRY,
  renderSimEngineAttribution,
  renderProvenanceTableRows,
  renderPhysicsFootnote,
  renderCitation,
  type ModelEntry,
} from '../src/data/modelRegistry.js'

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public')
const VALIDATION_DIR = join(PUBLIC_DIR, 'validation')
const MANIFEST_PATH = join(PUBLIC_DIR, 'model-registry.json')

// ---------------------------------------------------------------------------
// 1. Write JSON manifest
// ---------------------------------------------------------------------------

function getGitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
  } catch {
    return 'unknown'
  }
}

interface ManifestEntry {
  id: string
  domain: string
  property: string
  name: string
  shortName: string
  type: string
  status: string
  citation: string
  implementedIn: string
  knownLimitations?: string
}

function buildManifest(): object {
  const models: ManifestEntry[] = MODEL_REGISTRY.map((m: ModelEntry) => ({
    id: m.id,
    domain: m.domain,
    property: m.property,
    name: m.name,
    shortName: m.shortName,
    type: m.type,
    status: m.status,
    citation: renderCitation(m.citation, 'full'),
    implementedIn: m.implementedIn,
    ...(m.knownLimitations ? { knownLimitations: m.knownLimitations } : {}),
  }))

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    gitHash: getGitHash(),
    totalModels: models.length,
    activeModels: models.filter(m => m.status === 'active').length,
    models,
    simEngineAttribution: renderSimEngineAttribution(),
    physicsFootnote: renderPhysicsFootnote(),
  }
}

const manifest = buildManifest()
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
console.log(`[sync:models] Wrote ${MANIFEST_PATH}`)
console.log(`[sync:models]   ${MODEL_REGISTRY.length} models, ${MODEL_REGISTRY.filter((m: ModelEntry) => m.status === 'active').length} active`)

// ---------------------------------------------------------------------------
// 2. Token injection into static HTML files
// ---------------------------------------------------------------------------

const ATTRIBUTION_TOKEN = '<!-- MODEL_ATTRIBUTION -->'
const PROVENANCE_TOKEN = '<!-- MODEL_PROVENANCE_TABLE -->'
const FOOTNOTE_TOKEN = '<!-- MODEL_PHYSICS_FOOTNOTE -->'

const attributionBlock = `<!-- MODEL_ATTRIBUTION -->\n<span class="model-attribution">${renderSimEngineAttribution()}</span>\n<!-- /MODEL_ATTRIBUTION -->`
const footnoteBlock = `<!-- MODEL_PHYSICS_FOOTNOTE -->\n<span class="model-footnote">${renderPhysicsFootnote()}</span>\n<!-- /MODEL_PHYSICS_FOOTNOTE -->`
const provenanceBlock = `<!-- MODEL_PROVENANCE_TABLE -->\n${renderProvenanceTableRows()}\n<!-- /MODEL_PROVENANCE_TABLE -->`

// Replace filled blocks back to tokens first (idempotent re-run)
function stripFilledBlock(html: string, token: string): string {
  const openTag = token.replace('-->', '')
  const closeTag = token.replace('<!--', '<!--/')
  const re = new RegExp(`${escapeRe(openTag)}[\\s\\S]*?${escapeRe(closeTag)}`, 'g')
  return html.replace(re, token)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function injectTokens(html: string): string {
  let out = html
  out = stripFilledBlock(out, ATTRIBUTION_TOKEN)
  out = stripFilledBlock(out, PROVENANCE_TOKEN)
  out = stripFilledBlock(out, FOOTNOTE_TOKEN)
  out = out.replace(ATTRIBUTION_TOKEN, attributionBlock)
  out = out.replace(PROVENANCE_TOKEN, provenanceBlock)
  out = out.replace(FOOTNOTE_TOKEN, footnoteBlock)
  return out
}

function processHtmlDir(dir: string): number {
  let count = 0
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        count += processHtmlDir(full)
        continue
      }
      if (!entry.endsWith('.html')) continue
      const original = readFileSync(full, 'utf8')
      if (!original.includes(ATTRIBUTION_TOKEN) && !original.includes(PROVENANCE_TOKEN) && !original.includes(FOOTNOTE_TOKEN)) continue
      const updated = injectTokens(original)
      if (updated !== original) {
        writeFileSync(full, updated, 'utf8')
        console.log(`[sync:models]   Injected tokens into ${full}`)
        count++
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return count
}

const injected = processHtmlDir(VALIDATION_DIR)
if (injected === 0) {
  console.log('[sync:models] No HTML files contained injection tokens (add <!-- MODEL_ATTRIBUTION --> to enable auto-injection)')
} else {
  console.log(`[sync:models] Injected tokens into ${injected} HTML file(s)`)
}

console.log('[sync:models] Done.')
