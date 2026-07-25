import { describe, it, expect } from 'vitest'
import { buildFaultMultField } from '../../../engine/classical/faultTransmissibility'
import type { FaultDefinition } from '../../../types/geological'

const GRID = { nx: 20, ny: 20, dx_m: 200, dy_m: 200 }
const MODEL_W = 4000
const MODEL_L = 4000

function makeFault(overrides: Partial<FaultDefinition>): FaultDefinition {
  return {
    id: 'f1', name: 'Test Fault',
    positionX: 0.5, positionY: 0.5,
    strike: 0, dip: 90, throw: 20, length: 2000,
    sealingFactor: 0, claySmearFactor: 0, faultZoneThickness: 1,
    ...overrides,
  }
}

describe('buildFaultMultField', () => {
  it('no faults returns all-ones array', () => {
    const field = buildFaultMultField(GRID, [], MODEL_W, MODEL_L)
    expect(field.length).toBe(2 * 20 * 20)
    for (let k = 0; k < field.length; k++) {
      expect(field[k]).toBe(1)
    }
  })

  it('perfectly sealing fault sets some faces to 0', () => {
    const field = buildFaultMultField(GRID, [makeFault({ sealingFactor: 0 })], MODEL_W, MODEL_L)
    const hasZero = Array.from(field).some(v => v === 0)
    expect(hasZero).toBe(true)
  })

  it('fully open fault does not reduce any face below 1', () => {
    const field = buildFaultMultField(GRID, [makeFault({ sealingFactor: 1 })], MODEL_W, MODEL_L)
    for (let k = 0; k < field.length; k++) {
      expect(field[k]).toBe(1)
    }
  })

  it('partial sealing fault keeps multiplier in [0,1]', () => {
    const field = buildFaultMultField(GRID, [makeFault({ sealingFactor: 0.5 })], MODEL_W, MODEL_L)
    for (let k = 0; k < field.length; k++) {
      expect(field[k]).toBeGreaterThanOrEqual(0)
      expect(field[k]).toBeLessThanOrEqual(1)
    }
  })

  it('array length is 2*nx*ny', () => {
    const field = buildFaultMultField(GRID, [makeFault({})], MODEL_W, MODEL_L)
    expect(field.length).toBe(2 * GRID.nx * GRID.ny)
  })
})
