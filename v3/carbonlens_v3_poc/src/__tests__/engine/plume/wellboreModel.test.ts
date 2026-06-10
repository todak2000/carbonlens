import { describe, it, expect } from 'vitest'
import {
  peacemanRadius,
  injectivityIndex,
  bottomholePressure,
  computeWellboreDiagnostics,
  DEFAULT_WELLBORE,
} from '../../../engine/plume/wellboreModel'

describe('wellboreModel', () => {
  it('peacemanRadius gives ~20% of cell width', () => {
    const re = peacemanRadius(100)
    expect(re).toBeCloseTo(19.82, 1)
  })

  it('injectivityIndex scales linearly with permeability', () => {
    const J1 = injectivityIndex(100, 30, 5e-5, 19.82, 0.1, 0)
    const J2 = injectivityIndex(200, 30, 5e-5, 19.82, 0.1, 0)
    expect(J2 / J1).toBeCloseTo(2, 2)
  })

  it('skin factor reduces injectivity', () => {
    const Jclean = injectivityIndex(100, 30, 5e-5, 19.82, 0.1, 0)
    const Jdamaged = injectivityIndex(100, 30, 5e-5, 19.82, 0.1, 5)
    expect(Jdamaged).toBeLessThan(Jclean)
  })

  it('BHP increases with injection rate', () => {
    const bhp1 = bottomholePressure(20, 0.5, 700, 1e-9)
    const bhp2 = bottomholePressure(20, 1.0, 700, 1e-9)
    expect(bhp2).toBeGreaterThan(bhp1)
  })

  it('computeWellboreDiagnostics returns physical values', () => {
    // depth=2000m → Pfrac=0.018×2000=36 MPa > Pr=12 MPa, so max rate > 0
    const result = computeWellboreDiagnostics(
      DEFAULT_WELLBORE, 200, 100, 5e-5, 12, 1.0, 700, 2000, 0.018
    )
    expect(result.bhp_MPa).toBeGreaterThan(0)
    expect(result.injectivityIndex_m3dMPa).toBeGreaterThan(0)
    expect(result.peacemanRadius_m).toBeCloseTo(19.82, 1)
    expect(result.maxSustainableRate_MtPerYear).toBeGreaterThan(0)
  })
})
