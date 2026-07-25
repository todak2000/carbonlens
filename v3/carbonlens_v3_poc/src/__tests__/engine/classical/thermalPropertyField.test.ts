import { describe, it, expect } from 'vitest'
import { computeThermalPropertyField } from '../../../engine/classical/thermalPropertyField'
import { DEFAULT_THERMAL } from '../../../engine/plume/thermalEffects'

const GRID = { nx: 10, ny: 10, dx_m: 500, dy_m: 500 }

describe('computeThermalPropertyField', () => {
  it('returns arrays of correct length', () => {
    const result = computeThermalPropertyField({
      grid: GRID, topDepth_m: 1000, thickness_m: 50, pressure_MPa: 15,
      wellheadPressure_MPa: 20, year: 5,
      wellIndices: [{ i: 5, j: 5 }],
      thermalParams: DEFAULT_THERMAL,
    })
    expect(result.densityField.length).toBe(100)
    expect(result.viscosityField.length).toBe(100)
  })

  it('density is physically plausible for supercritical CO2', () => {
    const result = computeThermalPropertyField({
      grid: GRID, topDepth_m: 1000, thickness_m: 50, pressure_MPa: 15,
      wellheadPressure_MPa: 20, year: 5,
      wellIndices: [{ i: 5, j: 5 }],
      thermalParams: DEFAULT_THERMAL,
    })
    for (let k = 0; k < result.densityField.length; k++) {
      expect(result.densityField[k]).toBeGreaterThan(100)
      expect(result.densityField[k]).toBeLessThan(1100)
    }
  })

  it('viscosity is positive everywhere', () => {
    const result = computeThermalPropertyField({
      grid: GRID, topDepth_m: 1000, thickness_m: 50, pressure_MPa: 15,
      wellheadPressure_MPa: 20, year: 5,
      wellIndices: [{ i: 5, j: 5 }],
      thermalParams: DEFAULT_THERMAL,
    })
    for (let k = 0; k < result.viscosityField.length; k++) {
      expect(result.viscosityField[k]).toBeGreaterThan(0)
    }
  })

  it('near-wellbore cell has lower T (JT cooling) than far cell', () => {
    // Deeper formation yields higher T base, but JT cooling cools near wellbore.
    // We check that density near the well differs from far cells
    // (JT cooling at year 1 is strongest near wellbore r approaching 0)
    const thermalParams = { ...DEFAULT_THERMAL, injectionTemperature_C: 10, geothermalGradient_CPerKm: 30 }
    const r1 = computeThermalPropertyField({
      grid: GRID, topDepth_m: 2000, thickness_m: 50, pressure_MPa: 20,
      wellheadPressure_MPa: 30, year: 1,
      wellIndices: [{ i: 0, j: 0 }],  // corner well
      thermalParams,
    })
    // Near-wellbore cell (0,0) vs far cell (9,9)
    const nearIdx = 0 * 10 + 0
    const farIdx  = 9 * 10 + 9
    // At lower T, CO2 is denser — near-wellbore (JT cooled) should be denser than far
    expect(r1.densityField[nearIdx]).toBeGreaterThanOrEqual(r1.densityField[farIdx])
  })

  it('mean temperature is within geothermal range', () => {
    const result = computeThermalPropertyField({
      grid: GRID, topDepth_m: 1500, thickness_m: 100, pressure_MPa: 15,
      wellheadPressure_MPa: 20, year: 5,
      wellIndices: [{ i: 5, j: 5 }],
      thermalParams: DEFAULT_THERMAL,
    })
    // T = 20 + 30 * (1550/1000) = 66.5 deg C at midpoint
    expect(result.meanTemperature_C).toBeGreaterThan(30)
    expect(result.meanTemperature_C).toBeLessThan(150)
  })
})
