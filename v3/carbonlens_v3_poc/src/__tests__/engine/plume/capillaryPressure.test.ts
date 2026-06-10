import { describe, it, expect } from 'vitest'
import {
  pcDrainage,
  pcImbibition,
  capillaryFlux,
  makeCapillaryParams,
  getCapillaryLambda,
} from '../../../engine/plume/capillaryPressure'

describe('getCapillaryLambda', () => {
  it('returns lithology-specific lambda', () => {
    expect(getCapillaryLambda('sandstone')).toBe(2.5)
    expect(getCapillaryLambda('shale')).toBe(3.0)
    expect(getCapillaryLambda('chalk')).toBe(0.8)
  })

  it('returns default lambda for unknown lithologies', () => {
    expect(getCapillaryLambda('granite' as any)).toBe(2.0)
  })
})

describe('pcDrainage', () => {
  const params = makeCapillaryParams(0.05, 'sandstone')

  it('returns 0 at Sw = 1 (fully brine-saturated)', () => {
    expect(pcDrainage(1, params)).toBe(0)
  })

  it('returns capped entry pressure below residual water', () => {
    const pc = pcDrainage(0.05, params)
    expect(pc).toBeGreaterThan(0)
    expect(pc).toBe(0.5)
  })

  it('increases as Sw decreases', () => {
    const pc1 = pcDrainage(0.8, params)
    const pc2 = pcDrainage(0.5, params)
    const pc3 = pcDrainage(0.3, params)
    expect(pc2).toBeGreaterThan(pc1)
    expect(pc3).toBeGreaterThan(pc2)
  })

  it('is capped at PC_MAX_MULTIPLIER * entryPressure', () => {
    const highPc = pcDrainage(0.01, params)
    expect(highPc).toBeLessThanOrEqual(0.5)
  })
})

describe('pcImbibition', () => {
  const params = makeCapillaryParams(0.05, 'sandstone')

  it('returns lower Pc than drainage for same Sw with non-zero Sg_max', () => {
    const drainage = pcDrainage(0.6, params)
    const imbibition = pcImbibition(0.6, params, 0.3)
    expect(imbibition).toBeLessThanOrEqual(drainage)
  })

  it('equals drainage when Sg_max = 0', () => {
    expect(pcImbibition(0.6, params, 0)).toBe(pcDrainage(0.6, params))
  })

  it('returns 0 at Sw = 1 regardless of history', () => {
    expect(pcImbibition(1, params, 0.5)).toBe(0)
  })
})

describe('capillaryFlux', () => {
  it('returns 0 when pressures are equal', () => {
    const flux = capillaryFlux(1e-14, 0.5, 5e-5, 0.1, 0.1, 100)
    expect(flux).toBe(0)
  })

  it('flows from higher Pc to lower Pc (positive when Pc_there > Pc_here)', () => {
    const flux = capillaryFlux(1e-14, 0.5, 5e-5, 0.1, 0.2, 100)
    expect(flux).toBeGreaterThan(0)
  })

  it('returns 0 for NaN or infinite results', () => {
    expect(capillaryFlux(0, 0.5, 5e-5, 0.1, 0.2, 100)).toBe(0)
  })
})
