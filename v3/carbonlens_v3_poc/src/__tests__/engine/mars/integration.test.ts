import { describe, it, expect } from 'vitest'
import { subEquation, subScaler } from '../../../engine/mars/subModel'
import { evaluateMars } from '../../../engine/mars/evaluate'
import { scaleInput } from '../../../engine/mars/scaler'
import { MarsInput } from '../../../engine/mars/types'

describe('MARS subcritical model — end-to-end', () => {
  it('produces a finite IFT prediction for typical subcritical inputs', () => {
    // Representative subcritical CO₂/brine system (below 304.13 K or 7.377 MPa)
    const rawInput: MarsInput = {
      Pr: 0.5,      // reduced pressure
      Tr: 0.9,      // reduced temperature (subcritical)
      MCM: 0.0,
      BCM: 0.0,
      x_CH4: 0.0,
      x_N2: 0.0,
      drho_sq: 0.3,
      BCM_bin: 0,
      CH4_bin: 0,
      N2_bin: 0,
    }

    const scaledInput = scaleInput(rawInput, subScaler)
    const ift = evaluateMars(scaledInput, subEquation)

    expect(isFinite(ift)).toBe(true)
    // IFT for CO₂-brine should be in mN/m range (roughly 10–70 mN/m)
    expect(ift).toBeGreaterThan(0)
  })

  it('subcritical model has 16 terms as specified', () => {
    expect(subEquation.terms).toHaveLength(15) // 15 additional terms + intercept
  })

  it('intercept matches known value from MARS model JSON', () => {
    expect(subEquation.intercept).toBeCloseTo(51.6235553861666, 5)
  })
})
