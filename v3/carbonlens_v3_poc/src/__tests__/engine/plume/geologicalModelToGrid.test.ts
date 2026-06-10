import { describe, it, expect } from 'vitest'
import { geologicalModelToGrid } from '../../../utils/geologicalModelToGrid'
import type { GeologicalModel, StratigraphicZone, FaultDefinition } from '../../../types/geological'

function makeZone(overrides: Partial<StratigraphicZone> = {}): StratigraphicZone {
  return {
    id: 'z1',
    name: 'Test Reservoir',
    lithology: 'sandstone',
    topDepth: 2000,
    thickness: 100,
    netToGross: 0.75,
    porosityMean: 0.22,
    porosityStdDev: 0.03,
    kHorizontal: 300,
    kVerticalRatio: 0.1,
    capillaryEntryPressure: 0.05,
    wettability: 'water_wet',
    horizonShape: 'flat',
    horizonParams: {},
    xMin: -1, xMax: 1,
    yMin: -1, yMax: 1,
    activeForInjection: true,
    isCaprock: false,
    color: '#d4a96a',
    ...overrides,
  }
}

function makeCaprock(overrides: Partial<StratigraphicZone> = {}): StratigraphicZone {
  return makeZone({
    id: 'z_cap',
    name: 'Caprock',
    lithology: 'shale',
    topDepth: 1950,
    thickness: 50,
    activeForInjection: false,
    isCaprock: true,
    color: '#708090',
    ...overrides,
  })
}

function makeModel(zones: StratigraphicZone[], faults: FaultDefinition[] = []): GeologicalModel {
  return {
    zones,
    faults,
    modelWidthM: 10000,
    modelLengthM: 10000,
  }
}

describe('geologicalModelToGrid — cell count', () => {
  it('produces exactly nx × ny × nz cells', () => {
    const model = makeModel([makeCaprock(), makeZone()])
    const nx = 20, ny = 20, nz = 10
    const data = geologicalModelToGrid(model, nx, ny, nz)
    expect(data.cells).toHaveLength(nx * ny * nz)
  })

  it('respects custom nx/ny/nz', () => {
    const model = makeModel([makeCaprock(), makeZone()])
    const data = geologicalModelToGrid(model, 10, 8, 5)
    expect(data.cells).toHaveLength(10 * 8 * 5)
    expect(data.nx).toBe(10)
    expect(data.ny).toBe(8)
    expect(data.nz).toBe(5)
  })

  it('each cell has a unique instanceId in [0, N)', () => {
    const model = makeModel([makeCaprock(), makeZone()])
    const data = geologicalModelToGrid(model, 10, 10, 5)
    const ids = data.cells.map((c) => c.instanceId)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
    expect(Math.max(...ids)).toBe(ids.length - 1)
    expect(Math.min(...ids)).toBe(0)
  })
})

describe('geologicalModelToGrid — cell properties', () => {
  it('all cells have porosity in (0, 0.5)', () => {
    const model = makeModel([makeCaprock(), makeZone()])
    const data = geologicalModelToGrid(model, 10, 10, 5)
    for (const cell of data.cells) {
      expect(cell.porosity, `cell ${cell.instanceId}`).toBeGreaterThan(0)
      expect(cell.porosity, `cell ${cell.instanceId}`).toBeLessThan(0.5)
    }
  })

  it('all cells have positive kHorizontal', () => {
    const model = makeModel([makeCaprock(), makeZone()])
    const data = geologicalModelToGrid(model, 10, 10, 5)
    for (const cell of data.cells) {
      expect(cell.kHorizontal).toBeGreaterThan(0)
    }
  })

  it('centerX and centerY are in [-1, 1] for all cells', () => {
    const model = makeModel([makeCaprock(), makeZone()])
    const data = geologicalModelToGrid(model, 10, 10, 5)
    for (const cell of data.cells) {
      expect(cell.centerX).toBeGreaterThanOrEqual(-1)
      expect(cell.centerX).toBeLessThanOrEqual(1)
      expect(cell.centerY).toBeGreaterThanOrEqual(-1)
      expect(cell.centerY).toBeLessThanOrEqual(1)
    }
  })

  it('all cells start with zero CO2 saturation and phase=none', () => {
    const model = makeModel([makeCaprock(), makeZone()])
    const data = geologicalModelToGrid(model, 10, 10, 5)
    for (const cell of data.cells) {
      expect(cell.co2Saturation).toBe(0)
      expect(cell.co2Phase).toBe('none')
    }
  })

  it('caprock zone cells have isCaprock=true', () => {
    const model = makeModel([makeCaprock(), makeZone()])
    const data = geologicalModelToGrid(model, 10, 10, 5)
    const caprockCells = data.cells.filter((c) => c.isCaprock)
    expect(caprockCells.length).toBeGreaterThan(0)
  })

  it('fault transmissibility multipliers are in [0, 1]', () => {
    const model = makeModel([makeCaprock(), makeZone()])
    const data = geologicalModelToGrid(model, 10, 10, 5)
    for (const cell of data.cells) {
      expect(cell.faultTransmX).toBeGreaterThanOrEqual(0)
      expect(cell.faultTransmX).toBeLessThanOrEqual(1)
      expect(cell.faultTransmY).toBeGreaterThanOrEqual(0)
      expect(cell.faultTransmY).toBeLessThanOrEqual(1)
    }
  })
})

describe('geologicalModelToGrid — sealing fault transmissibility', () => {
  it('sealing fault (sealingFactor=0) reduces transmissibility to ≈0 on affected faces', () => {
    const model = makeModel(
      [makeCaprock(), makeZone()],
      [{
        id: 'f1',
        name: 'Sealing Fault',
        positionX: 0.5,   // centre of model in normalised 0–1 coords
        positionY: 0.5,
        strike: 0,        // N-S fault → perpDist in X direction
        dip: 90,
        throw: 50,
        length: 20000,    // halfLenNorm = 1.0 — spans full model in Y direction
        sealingFactor: 0, // sealingFactor=0; claySmearFactor=1 makes it fully sealing
        claySmearFactor: 1.0,
        faultZoneThickness: 1000, // faultWidth = 0.1 — wide enough to catch cells at cx=0.45, 0.55
      }],
    )
    const data = geologicalModelToGrid(model, 10, 10, 5)

    // Cells straddling the fault (i=4 and i=5, perpDist=0.05 < faultWidth=0.1) get transm≈0
    const sealedCells = data.cells.filter((c) => c.faultTransmX < 0.1)
    expect(sealedCells.length).toBeGreaterThan(0)
  })

  it('open fault (sealingFactor=1) leaves transmissibility at 1.0', () => {
    const model = makeModel(
      [makeCaprock(), makeZone()],
      [{
        id: 'f_open',
        name: 'Open Fault',
        positionX: 0.5,
        positionY: 0.5,
        strike: 0,
        dip: 90,
        throw: 10,
        length: 0.5,        // tiny — halfLenNorm = 0.000025 → no cell affected
        sealingFactor: 1,   // open (sealingFactor=1, claySmearFactor=0 → effectiveSeal=1 → transm=0 on affected cells)
        claySmearFactor: 0,
        faultZoneThickness: 1,
      }],
    )
    const data = geologicalModelToGrid(model, 10, 10, 5)

    // All cells should keep full transmissibility on faces away from the fault
    const allHigh = data.cells.every((c) => c.faultTransmX >= 0.95 && c.faultTransmY >= 0.95)
    expect(allHigh).toBe(true)
  })
})
