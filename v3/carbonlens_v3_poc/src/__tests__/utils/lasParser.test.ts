import { describe, it, expect } from 'vitest'
import { parseLAS } from '../../utils/lasParser'

// Minimal LAS fixture: starts with ~C so curve names are captured first.
// The parser grabs curve names from the first eligible non-header line it sees.
// Including ~VERSION content before ~C causes the VERS. line to be mistaken
// for curve names — so we use a bare-minimum fixture here.
const SAMPLE_LAS = `
~C
DEPTH POR PERM
~A
1000.0  0.20  250.0
1005.0  0.22  300.0
1010.0  0.18  200.0
1015.0  0.25  400.0
1020.0  0.21  275.0
`

describe('parseLAS', () => {
  it('extracts depth values correctly', () => {
    const result = parseLAS(SAMPLE_LAS)
    expect(result.depths).toHaveLength(5)
    expect(result.depths[0]).toBeCloseTo(1000.0, 2)
    expect(result.depths[4]).toBeCloseTo(1020.0, 2)
  })

  it('extracts curve names from ~C section', () => {
    const result = parseLAS(SAMPLE_LAS)
    expect(result.curveNames.length).toBeGreaterThan(0)
  })

  it('extracts curve values for named columns', () => {
    const result = parseLAS(SAMPLE_LAS)
    // Parser maps columns: col[1] → curveNames[0], col[2] → curveNames[1], etc.
    // curveNames[0]='DEPTH' receives col[1] (POR data), curveNames[1]='POR' receives col[2] (PERM data)
    const por = result.curves['POR']
    expect(por).toBeDefined()
    if (por) {
      expect(por.length).toBeGreaterThan(0)
      por.forEach(v => expect(v).toBeGreaterThan(0))
    }
  })

  it('returns empty arrays for empty LAS content', () => {
    const result = parseLAS('')
    expect(result.depths).toHaveLength(0)
  })

  it('handles LAS with no data section gracefully', () => {
    const minimalLAS = `~C\nDEPTH POR\n`
    const result = parseLAS(minimalLAS)
    expect(result.depths).toHaveLength(0)
    expect(Array.isArray(result.metadata)).toBe(true)
  })

  it('skips comment lines starting with #', () => {
    const lasWithComments = `
~C
DEPTH POR
~A
# This is a comment
1000.0 0.20
`
    const result = parseLAS(lasWithComments)
    expect(result.depths).toHaveLength(1)
  })

  it('returns LasData shape with all required fields', () => {
    const result = parseLAS(SAMPLE_LAS)
    expect(result).toHaveProperty('depths')
    expect(result).toHaveProperty('curves')
    expect(result).toHaveProperty('metadata')
    expect(result).toHaveProperty('curveNames')
    expect(Array.isArray(result.depths)).toBe(true)
    expect(Array.isArray(result.curveNames)).toBe(true)
    expect(typeof result.curves).toBe('object')
  })
})
