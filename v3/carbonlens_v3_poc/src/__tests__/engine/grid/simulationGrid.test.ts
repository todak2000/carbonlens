/**
 * simulationGrid.test.ts
 *
 * Tests for SimulationGrid — the wrapper around SimulationGridData that provides:
 *   - O(1) cell lookup by (i,j,k)
 *   - resetSaturation() zeroes all cells
 *   - cellSceneDimensions() returns correct aspect ratios
 *   - caprockKIndex is always 0 (topmost layer)
 *   - getCell() returns undefined for out-of-bounds indices
 */

import { describe, it, expect } from 'vitest'
import { SimulationGrid, GRID_NX, GRID_NY, GRID_NZ, GRID_CELL_COUNT } from '../../../engine/grid/SimulationGrid'
import { geologicalModelToGrid } from '../../../utils/geologicalModelToGrid'
import type { GeologicalModel, StratigraphicZone } from '../../../types/geological'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCaprockZone(): StratigraphicZone {
  return {
    id: 'cap', name: 'Caprock', lithology: 'shale',
    topDepth: 900, thickness: 50, netToGross: 1,
    porosityMean: 0.05, porosityStdDev: 0,
    kHorizontal: 0.001, kVerticalRatio: 0.01,
    capillaryEntryPressure: 10,
    wettability: 'water_wet',
    horizonShape: 'flat', horizonParams: {},
    xMin: -1, xMax: 1, yMin: -1, yMax: 1,
    activeForInjection: false, isCaprock: true,
    color: '#666666',
  }
}

function makeReservoirZone(): StratigraphicZone {
  return {
    id: 'res', name: 'Reservoir', lithology: 'sandstone',
    topDepth: 950, thickness: 100, netToGross: 0.8,
    porosityMean: 0.22, porosityStdDev: 0.02,
    kHorizontal: 300, kVerticalRatio: 0.1,
    capillaryEntryPressure: 0.05,
    wettability: 'water_wet',
    horizonShape: 'flat', horizonParams: {},
    xMin: -1, xMax: 1, yMin: -1, yMax: 1,
    activeForInjection: true, isCaprock: false,
    color: '#d4a96a',
  }
}

function makeModel(): GeologicalModel {
  return {
    zones: [makeCaprockZone(), makeReservoirZone()],
    faults: [],
    modelWidthM: 5000,
    modelLengthM: 5000,
  }
}

function buildGrid(): SimulationGrid {
  const data = geologicalModelToGrid(makeModel(), GRID_NX, GRID_NY, GRID_NZ)
  return new SimulationGrid(data)
}

// ── Grid constants ────────────────────────────────────────────────────────────

describe('SimulationGrid — grid constants', () => {
  it('GRID_NX × GRID_NY × GRID_NZ equals GRID_CELL_COUNT', () => {
    expect(GRID_NX * GRID_NY * GRID_NZ).toBe(GRID_CELL_COUNT)
  })

  it('grid dimensions are 60×60×20 (default high-res)', () => {
    expect(GRID_NX).toBe(60)
    expect(GRID_NY).toBe(60)
    expect(GRID_NZ).toBe(20)
  })
})

// ── Construction ──────────────────────────────────────────────────────────────

describe('SimulationGrid — construction', () => {
  it('contains exactly nx * ny * nz cells', () => {
    const grid = buildGrid()
    expect(grid.cells.length).toBe(grid.nx * grid.ny * grid.nz)
  })

  it('exposes correct dimension metadata', () => {
    const grid = buildGrid()
    expect(grid.nx).toBe(GRID_NX)
    expect(grid.ny).toBe(GRID_NY)
    expect(grid.nz).toBe(GRID_NZ)
  })

  it('modelWidthM and modelLengthM are positive', () => {
    const grid = buildGrid()
    expect(grid.modelWidthM).toBeGreaterThan(0)
    expect(grid.modelLengthM).toBeGreaterThan(0)
  })

  it('minDepthM < maxDepthM', () => {
    const grid = buildGrid()
    expect(grid.minDepthM).toBeLessThan(grid.maxDepthM)
  })

  it('all instanceIds are unique and in [0, cellCount)', () => {
    const grid = buildGrid()
    const ids = new Set(grid.cells.map(c => c.instanceId))
    expect(ids.size).toBe(grid.cells.length)
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(0)
      expect(id).toBeLessThan(grid.cells.length)
    }
  })
})

// ── getCell() ─────────────────────────────────────────────────────────────────

describe('SimulationGrid — getCell()', () => {
  it('returns a cell for valid indices', () => {
    const grid = buildGrid()
    const cell = grid.getCell(0, 0, 0)
    expect(cell).toBeDefined()
  })

  it('returns undefined for out-of-bounds i', () => {
    const grid = buildGrid()
    expect(grid.getCell(-1, 0, 0)).toBeUndefined()
    expect(grid.getCell(GRID_NX, 0, 0)).toBeUndefined()
  })

  it('returns undefined for out-of-bounds j', () => {
    const grid = buildGrid()
    expect(grid.getCell(0, -1, 0)).toBeUndefined()
    expect(grid.getCell(0, GRID_NY, 0)).toBeUndefined()
  })

  it('returns undefined for out-of-bounds k', () => {
    const grid = buildGrid()
    expect(grid.getCell(0, 0, -1)).toBeUndefined()
    expect(grid.getCell(0, 0, GRID_NZ)).toBeUndefined()
  })

  it('returns distinct cells for different (i,j,k)', () => {
    const grid = buildGrid()
    const a = grid.getCell(0, 0, 0)
    const b = grid.getCell(1, 0, 0)
    const c = grid.getCell(0, 1, 0)
    expect(a!.instanceId).not.toBe(b!.instanceId)
    expect(a!.instanceId).not.toBe(c!.instanceId)
  })

  it('round-trips: getCell(i,j,k) has matching i,j,k fields', () => {
    const grid = buildGrid()
    for (const [i, j, k] of [[3,5,2],[0,0,0],[GRID_NX-1,GRID_NY-1,GRID_NZ-1]] as [number,number,number][]) {
      const cell = grid.getCell(i, j, k)
      expect(cell).toBeDefined()
      expect(cell!.i).toBe(i)
      expect(cell!.j).toBe(j)
      expect(cell!.k).toBe(k)
    }
  })
})

// ── caprockKIndex ─────────────────────────────────────────────────────────────

describe('SimulationGrid — caprockKIndex', () => {
  it('caprock k-index is always 0 (top layer)', () => {
    const grid = buildGrid()
    expect(grid.caprockKIndex).toBe(0)
  })

  it('cells at k=0 are marked isCaprock=true', () => {
    const grid = buildGrid()
    for (let i = 0; i < grid.nx; i++) {
      for (let j = 0; j < grid.ny; j++) {
        const cell = grid.getCell(i, j, 0)
        expect(cell!.isCaprock).toBe(true)
      }
    }
  })

  it('cells at k>0 are not all caprock', () => {
    const grid = buildGrid()
    const nonCapCount = grid.cells.filter(c => c.k > 0 && !c.isCaprock).length
    expect(nonCapCount).toBeGreaterThan(0)
  })
})

// ── resetSaturation() ─────────────────────────────────────────────────────────

describe('SimulationGrid — resetSaturation()', () => {
  it('sets all co2Saturation values to 0', () => {
    const grid = buildGrid()
    // Manually set some saturations
    for (const cell of grid.cells) { cell.co2Saturation = 0.5 }
    grid.resetSaturation()
    for (const cell of grid.cells) {
      expect(cell.co2Saturation).toBe(0)
    }
  })

  it('sets all co2Phase values to "none"', () => {
    const grid = buildGrid()
    for (const cell of grid.cells) { cell.co2Phase = 'free' }
    grid.resetSaturation()
    for (const cell of grid.cells) {
      expect(cell.co2Phase).toBe('none')
    }
  })

  it('sets all pressure values to 0', () => {
    const grid = buildGrid()
    for (const cell of grid.cells) { cell.pressure = 25 }
    grid.resetSaturation()
    for (const cell of grid.cells) {
      expect(cell.pressure).toBe(0)
    }
  })
})

// ── cellSceneDimensions() ─────────────────────────────────────────────────────

describe('SimulationGrid — cellSceneDimensions()', () => {
  it('returns positive cell dimensions', () => {
    const grid = buildGrid()
    const { cw, cd, ch } = grid.cellSceneDimensions(2.0, 1.0)
    expect(cw).toBeGreaterThan(0)
    expect(cd).toBeGreaterThan(0)
    expect(ch).toBeGreaterThan(0)
  })

  it('cw * nx == scene width', () => {
    const grid = buildGrid()
    const sceneW = 2.0
    const { cw } = grid.cellSceneDimensions(sceneW, 1.0)
    expect(cw * grid.nx).toBeCloseTo(sceneW, 10)
  })

  it('ch * nz == scene height', () => {
    const grid = buildGrid()
    const sceneH = 0.8
    const { ch } = grid.cellSceneDimensions(2.0, sceneH)
    expect(ch * grid.nz).toBeCloseTo(sceneH, 10)
  })
})

// ── Cell property ranges ──────────────────────────────────────────────────────

describe('SimulationGrid — cell property validity', () => {
  it('all cells have porosity in (0, 1]', () => {
    const grid = buildGrid()
    for (const cell of grid.cells) {
      expect(cell.porosity).toBeGreaterThan(0)
      expect(cell.porosity).toBeLessThanOrEqual(1)
    }
  })

  it('all cells have kHorizontal > 0', () => {
    const grid = buildGrid()
    for (const cell of grid.cells) {
      expect(cell.kHorizontal).toBeGreaterThan(0)
    }
  })

  it('fault transmissibilities are in [0, 1]', () => {
    const grid = buildGrid()
    for (const cell of grid.cells) {
      expect(cell.faultTransmX).toBeGreaterThanOrEqual(0)
      expect(cell.faultTransmX).toBeLessThanOrEqual(1)
      expect(cell.faultTransmY).toBeGreaterThanOrEqual(0)
      expect(cell.faultTransmY).toBeLessThanOrEqual(1)
    }
  })

  it('initial co2Saturation is 0 for all cells', () => {
    const grid = buildGrid()
    for (const cell of grid.cells) {
      expect(cell.co2Saturation).toBe(0)
    }
  })

  it('initial co2Phase is "none" for all cells', () => {
    const grid = buildGrid()
    for (const cell of grid.cells) {
      expect(cell.co2Phase).toBe('none')
    }
  })
})
