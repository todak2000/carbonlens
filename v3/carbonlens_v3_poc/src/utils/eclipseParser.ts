/**
 * Eclipse E100/E300 .DATA Deck Parser — CO2 Storage Screening Subset
 *
 * Parses the subset of Eclipse keywords relevant to CO2 storage screening.
 * Does NOT implement full compositional simulation deck parsing.
 *
 * Supported keywords:
 *   DIMENS, DX, DY, DZ, TOPS, PORO, PERMX, PERMY, PERMZ,
 *   PRESSURE, TEMPERATURE, WELSPECS, COMPDAT, WCONINJE
 *
 * Eclipse deck conventions:
 *   - Comments: lines starting with '--' are ignored
 *   - Each keyword is on its own line (uppercase)
 *   - Data blocks end with '/'
 *   - Repeat notation: '50*0.25' = 50 values of 0.25
 *   - Pressure units in Eclipse: bara → MPa (÷10)
 *   - Permeability: mD (unchanged)
 *
 * Reference: Schlumberger Eclipse Technical Description Manual (2014)
 */

export interface EclipseGridSpec {
  nx: number
  ny: number
  nz: number
}

export interface EclipseWell {
  name: string
  i: number            // grid location I (1-indexed)
  j: number            // grid location J (1-indexed)
  depth_m: number      // reference depth (m)
  injectionRate_m3PerDay?: number
  topPerf_m?: number
  botPerf_m?: number
}

export interface EclipseParseResult {
  grid?: EclipseGridSpec
  dx_m?: number              // mean cell width (m)
  dy_m?: number              // mean cell length (m)
  dz_m?: number              // mean cell height (m) — proxy for layer thickness
  topDepth_m?: number        // shallowest TOPS value (m)
  meanPorosity?: number      // arithmetic mean PORO
  meanPermX_mD?: number      // arithmetic mean PERMX (mD)
  meanPermY_mD?: number      // arithmetic mean PERMY (mD)
  meanPermZ_mD?: number      // arithmetic mean PERMZ (mD)
  initPressure_MPa?: number  // mean PRESSURE converted from bara (÷10)
  temperature_C?: number     // mean TEMPERATURE (°C)
  wells: EclipseWell[]
  warnings: string[]         // non-fatal parse issues
  errors: string[]           // fatal parse issues
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Strip Eclipse comments (-- to end of line) */
function stripComments(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--')
      return idx >= 0 ? line.slice(0, idx) : line
    })
    .join('\n')
}

/**
 * Expand Eclipse repeat notation: '50*0.25' → [0.25, 0.25, ...(50 times)]
 * Also handles plain numbers: '0.25' → [0.25]
 */
function expandRepeat(token: string): number[] {
  const starIdx = token.indexOf('*')
  if (starIdx >= 0) {
    const count = parseInt(token.slice(0, starIdx), 10)
    const value = parseFloat(token.slice(starIdx + 1))
    if (!isNaN(count) && !isNaN(value) && count > 0) {
      return new Array(count).fill(value)
    }
    return []
  }
  const v = parseFloat(token)
  return isNaN(v) ? [] : [v]
}

/**
 * Read all numeric values from a data block string (ends at '/').
 * Handles multi-line blocks and repeat notation.
 */
function parseDataBlock(block: string): number[] {
  const values: number[] = []
  const tokens = block.split(/[\s\n\r,]+/).filter(t => t && t !== '/')
  for (const token of tokens) {
    if (token === '/') break
    values.push(...expandRepeat(token))
  }
  return values
}

/** Arithmetic mean of an array (or undefined if empty) */
function mean(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/** Minimum of an array (or undefined if empty) */
function minVal(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined
  return Math.min(...arr)
}

// ── Keyword extraction ────────────────────────────────────────────────────────

/**
 * Find a keyword in the deck and return the text of its data block
 * (everything between the keyword line and the terminating '/').
 */
function extractKeywordBlock(text: string, keyword: string): string | null {
  const lines = text.split('\n')
  let inBlock = false
  const blockLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!inBlock) {
      // Match keyword on its own (whole word, case-insensitive)
      if (new RegExp(`^${keyword}\\s*$`, 'i').test(trimmed)) {
        inBlock = true
      }
    } else {
      if (trimmed.endsWith('/') || trimmed === '/') {
        blockLines.push(trimmed.replace(/\/$/, ''))
        break
      }
      blockLines.push(line)
    }
  }

  return inBlock ? blockLines.join('\n') : null
}

/**
 * Extract all record blocks for a keyword that may have multiple records,
 * each terminated by '/'. The outer block is terminated by a blank '/'.
 *
 * Used for WELSPECS, COMPDAT, WCONINJE which have one '/' per record.
 */
function extractMultiRecordKeyword(text: string, keyword: string): string[][] {
  const lines = text.split('\n')
  let inBlock = false
  const records: string[][] = []
  let currentRecord: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!inBlock) {
      if (new RegExp(`^${keyword}\\s*$`, 'i').test(trimmed)) {
        inBlock = true
      }
    } else {
      if (trimmed === '/') {
        // Bare '/' = end of multi-record block
        if (currentRecord.length > 0) {
          records.push(currentRecord)
          currentRecord = []
        }
        break
      } else if (trimmed.endsWith('/')) {
        // Record terminator
        currentRecord.push(trimmed.slice(0, -1).trim())
        records.push(currentRecord)
        currentRecord = []
      } else if (trimmed) {
        currentRecord.push(trimmed)
      }
    }
  }
  return records
}

// ── Main parser ───────────────────────────────────────────────────────────────

export class EclipseParser {
  parse(rawText: string): EclipseParseResult {
    const result: EclipseParseResult = { wells: [], warnings: [], errors: [] }
    const text = stripComments(rawText)

    // ── DIMENS ──────────────────────────────────────────────────────────────
    const dimenBlock = extractKeywordBlock(text, 'DIMENS')
    if (dimenBlock) {
      const vals = parseDataBlock(dimenBlock)
      if (vals.length >= 3) {
        result.grid = { nx: vals[0], ny: vals[1], nz: vals[2] }
      } else {
        result.warnings.push('DIMENS found but < 3 values')
      }
    }

    const totalCells = result.grid ? result.grid.nx * result.grid.ny * result.grid.nz : undefined

    // ── Cell dimension arrays ────────────────────────────────────────────────
    const dxVals = parseDataBlock(extractKeywordBlock(text, 'DX') ?? '')
    const dyVals = parseDataBlock(extractKeywordBlock(text, 'DY') ?? '')
    const dzVals = parseDataBlock(extractKeywordBlock(text, 'DZ') ?? '')

    if (dxVals.length > 0) result.dx_m = mean(dxVals)
    if (dyVals.length > 0) result.dy_m = mean(dyVals)
    if (dzVals.length > 0) result.dz_m = mean(dzVals)

    if (totalCells !== undefined) {
      if (dxVals.length > 0 && dxVals.length !== totalCells) {
        result.warnings.push(`DX has ${dxVals.length} values, expected ${totalCells}`)
      }
      if (dzVals.length > 0 && dzVals.length !== totalCells) {
        result.warnings.push(`DZ has ${dzVals.length} values, expected ${totalCells}`)
      }
    }

    // ── TOPS ────────────────────────────────────────────────────────────────
    const topsBlock = extractKeywordBlock(text, 'TOPS')
    if (topsBlock) {
      const topsVals = parseDataBlock(topsBlock)
      if (topsVals.length > 0) result.topDepth_m = minVal(topsVals)
    }

    // ── PORO ────────────────────────────────────────────────────────────────
    const poroBlock = extractKeywordBlock(text, 'PORO')
    if (poroBlock) {
      const poroVals = parseDataBlock(poroBlock)
      result.meanPorosity = mean(poroVals)
    }

    // ── Permeability arrays ──────────────────────────────────────────────────
    const permXBlock = extractKeywordBlock(text, 'PERMX')
    if (permXBlock) result.meanPermX_mD = mean(parseDataBlock(permXBlock))

    const permYBlock = extractKeywordBlock(text, 'PERMY')
    if (permYBlock) result.meanPermY_mD = mean(parseDataBlock(permYBlock))

    const permZBlock = extractKeywordBlock(text, 'PERMZ')
    if (permZBlock) result.meanPermZ_mD = mean(parseDataBlock(permZBlock))

    // ── PRESSURE (bara → MPa) ────────────────────────────────────────────────
    const pressBlock = extractKeywordBlock(text, 'PRESSURE')
    if (pressBlock) {
      const pressVals = parseDataBlock(pressBlock)
      const meanBara = mean(pressVals)
      if (meanBara !== undefined) result.initPressure_MPa = meanBara / 10
    }

    // ── TEMPERATURE ─────────────────────────────────────────────────────────
    const tempBlock = extractKeywordBlock(text, 'TEMPERATURE')
    if (tempBlock) {
      result.temperature_C = mean(parseDataBlock(tempBlock))
    }

    // ── WELSPECS ────────────────────────────────────────────────────────────
    // Format: WELLNAME GROUP I J DEPTH PHASE /
    const welspecsRecords = extractMultiRecordKeyword(text, 'WELSPECS')
    for (const record of welspecsRecords) {
      const tokens = record.join(' ').split(/\s+/).filter(Boolean)
      if (tokens.length >= 5) {
        const well: EclipseWell = {
          name: tokens[0].replace(/'/g, ''),
          i: parseInt(tokens[2], 10),
          j: parseInt(tokens[3], 10),
          depth_m: parseFloat(tokens[4]),
        }
        if (!isNaN(well.i) && !isNaN(well.j) && !isNaN(well.depth_m)) {
          result.wells.push(well)
        } else {
          result.warnings.push(`WELSPECS record could not be parsed: ${tokens.join(' ')}`)
        }
      }
    }

    // ── COMPDAT — add perforation data to matching wells ─────────────────────
    // Format: WELLNAME I J K1 K2 OPEN/SHUT STATUS WI DIAM KHMULT DRSKIN DIR /
    const compdatRecords = extractMultiRecordKeyword(text, 'COMPDAT')
    for (const record of compdatRecords) {
      const tokens = record.join(' ').split(/\s+/).filter(Boolean)
      if (tokens.length >= 5) {
        const wname = tokens[0].replace(/'/g, '')
        const well = result.wells.find(w => w.name === wname)
        if (well && well.topPerf_m === undefined) {
          // COMPDAT gives grid layer indices — we only flag perforations exist
          well.topPerf_m = well.depth_m
        }
      }
    }

    // ── WCONINJE ─────────────────────────────────────────────────────────────
    // Format: WELLNAME PHASE OPEN/SHUT CMODE RATE BHP /
    const wconinjeRecords = extractMultiRecordKeyword(text, 'WCONINJE')
    for (const record of wconinjeRecords) {
      const tokens = record.join(' ').split(/\s+/).filter(Boolean)
      if (tokens.length >= 5) {
        const wname = tokens[0].replace(/'/g, '')
        const well = result.wells.find(w => w.name === wname)
        if (well) {
          const rate = parseFloat(tokens[4])
          if (!isNaN(rate)) well.injectionRate_m3PerDay = rate
        }
      }
    }

    return result
  }
}

/** Convenience function — parse a .DATA string and return the result. */
export function parseEclipseDeck(text: string): EclipseParseResult {
  return new EclipseParser().parse(text)
}
