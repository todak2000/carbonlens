import { describe, it, expect } from 'vitest'
import { parseEclipseDeck } from '../../utils/eclipseParser'

// ── Minimal synthetic .DATA deck ─────────────────────────────────────────────
const SYNTHETIC_DECK = `
-- Simple CarbonLens test deck
-- Grid: 5×5×3

RUNSPEC

DIMENS
  5 5 3 /

GRID

DX
  75*100.0 /

DY
  75*100.0 /

DZ
  75*10.0 /

TOPS
  25*2500.0 /

PORO
  75*0.25 /

PERMX
  75*300.0 /

PERMY
  75*300.0 /

PERMZ
  75*100.0 /

SOLUTION

PRESSURE
  75*280.0 /

TEMPERATURE
  75*95.0 /

SCHEDULE

WELSPECS
  'INJ1' 'G1' 3 3 2500.0 'CO2' /
/

WCONINJE
  'INJ1' 'GAS' 'OPEN' 'RATE' 1000 /
/
`

describe('parseEclipseDeck', () => {
  const result = parseEclipseDeck(SYNTHETIC_DECK)

  it('parses grid dimensions', () => {
    expect(result.grid).toBeDefined()
    expect(result.grid!.nx).toBe(5)
    expect(result.grid!.ny).toBe(5)
    expect(result.grid!.nz).toBe(3)
  })

  it('parses cell dimensions', () => {
    expect(result.dx_m).toBeCloseTo(100, 1)
    expect(result.dy_m).toBeCloseTo(100, 1)
    expect(result.dz_m).toBeCloseTo(10, 1)
  })

  it('parses TOPS — top depth', () => {
    expect(result.topDepth_m).toBeCloseTo(2500, 0)
  })

  it('parses mean porosity', () => {
    expect(result.meanPorosity).toBeCloseTo(0.25, 4)
  })

  it('parses mean PERMX', () => {
    expect(result.meanPermX_mD).toBeCloseTo(300, 1)
  })

  it('parses mean PERMZ', () => {
    expect(result.meanPermZ_mD).toBeCloseTo(100, 1)
  })

  it('converts pressure from bara to MPa (÷10)', () => {
    // 280 bara ÷ 10 = 28 MPa
    expect(result.initPressure_MPa).toBeCloseTo(28, 2)
  })

  it('parses temperature', () => {
    expect(result.temperature_C).toBeCloseTo(95, 0)
  })

  it('parses WELSPECS — one well named INJ1', () => {
    expect(result.wells).toHaveLength(1)
    expect(result.wells[0].name).toBe('INJ1')
    expect(result.wells[0].i).toBe(3)
    expect(result.wells[0].j).toBe(3)
    expect(result.wells[0].depth_m).toBeCloseTo(2500, 0)
  })

  it('parses WCONINJE — injection rate on well', () => {
    expect(result.wells[0].injectionRate_m3PerDay).toBeCloseTo(1000, 0)
  })

  it('produces no fatal errors', () => {
    expect(result.errors).toHaveLength(0)
  })
})

// ── Repeat notation ──────────────────────────────────────────────────────────
describe('parseEclipseDeck — repeat notation', () => {
  it('expands mixed repeat notation correctly', () => {
    const deck = `
DIMENS
  2 2 1 /
PORO
  2*0.20 2*0.30 /
`
    const r = parseEclipseDeck(deck)
    // mean of [0.20, 0.20, 0.30, 0.30] = 0.25
    expect(r.meanPorosity).toBeCloseTo(0.25, 4)
  })

  it('handles comment stripping', () => {
    const deck = `
-- Header comment
DIMENS
  3 3 2 / -- inline comment should be stripped
PORO
  18*0.18 /
`
    const r = parseEclipseDeck(deck)
    expect(r.grid).toBeDefined()
    expect(r.grid!.nx).toBe(3)
    expect(r.meanPorosity).toBeCloseTo(0.18, 4)
  })
})
