import { describe, it, expect } from 'vitest'
import {
  calculateDissolution,
  convectiveEnhancement,
  makeDissolutionParams,
} from '../../../engine/plume/dissolutionTrapping'

const DT = 3.156e7
const G = 9.81
const MU_BRINE = 6e-4

describe('convectiveEnhancement', () => {
  it('returns 1 when H_dissolved is near zero (no free convection)', () => {
    const Ra = convectiveEnhancement(100, 0.2, 0.001, G, MU_BRINE)
    expect(Ra).toBe(1)
  })

  it('increases above 1 for large H and high permeability', () => {
    const Ra = convectiveEnhancement(1000, 0.3, 20, G, MU_BRINE)
    expect(Ra).toBeGreaterThan(1)
  })

  it('scales with permeability', () => {
    const lowK = convectiveEnhancement(10, 0.2, 20, G, MU_BRINE)
    const highK = convectiveEnhancement(500, 0.2, 20, G, MU_BRINE)
    expect(highK).toBeGreaterThanOrEqual(lowK)
  })
})

describe('calculateDissolution', () => {
  it('returns 0 when Sg is near zero', () => {
    const rate = calculateDissolution(0, 0, 0.2, 200, 5, G, MU_BRINE, DT)
    expect(rate).toBe(0)
  })

  it('returns 0 when fully saturated (deficit = 0)', () => {
    const params = makeDissolutionParams(0.05)
    const rate = calculateDissolution(0.3, 0.05, 0.2, 200, 5, G, MU_BRINE, DT, params)
    expect(rate).toBe(0)
  })

  it('returns positive rate for undersaturated CO2 plume', () => {
    const params = makeDissolutionParams(0.05)
    const rate = calculateDissolution(0.3, 0, 0.2, 200, 5, G, MU_BRINE, DT, params)
    expect(rate).toBeGreaterThan(0)
  })

  it('does not exceed half the free CO2', () => {
    const params = makeDissolutionParams(0.05)
    const freeSg = 0.2
    const rate = calculateDissolution(freeSg, 0, 0.2, 200, 5, G, MU_BRINE, DT, params)
    expect(rate).toBeLessThanOrEqual(freeSg * 0.5)
  })

  it('does not exceed solubility capacity', () => {
    const params = makeDissolutionParams(0.02)
    const rate = calculateDissolution(0.3, 0.01, 0.2, 200, 5, G, MU_BRINE, DT, params)
    expect(rate).toBeLessThanOrEqual(0.02)
  })
})
