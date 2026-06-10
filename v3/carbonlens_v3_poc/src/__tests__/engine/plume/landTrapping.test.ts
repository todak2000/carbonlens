import { describe, it, expect } from 'vitest'
import {
  computeResidualSaturation,
  makeLandState,
  applyLandTrapping,
  tickLandState,
  landResidualFraction,
} from '../../../engine/plume/landTrapping'

describe('computeResidualSaturation', () => {
  it('returns 0 when Sg_max is 0', () => {
    expect(computeResidualSaturation(0)).toBe(0)
  })

  it('follows Land (1968) formula: Sgr = Sg_max / (1 + C × Sg_max)', () => {
    const Sg_max = 0.4
    const C = 2.5
    const expected = Sg_max / (1 + C * Sg_max)
    expect(computeResidualSaturation(Sg_max, C)).toBeCloseTo(expected, 10)
  })

  it('Sgr is always less than Sg_max', () => {
    for (const sg of [0.1, 0.2, 0.4, 0.6, 0.8]) {
      expect(computeResidualSaturation(sg, 2.5)).toBeLessThan(sg)
    }
  })

  it('higher Land coefficient C → lower Sgr (more trapping)', () => {
    const sg = 0.4
    const sgrLowC  = computeResidualSaturation(sg, 1.0)
    const sgrHighC = computeResidualSaturation(sg, 5.0)
    expect(sgrHighC).toBeLessThan(sgrLowC)
  })
})

describe('applyLandTrapping — imbibition locking', () => {
  it('locks Sg_free at Sgr when saturation falls below it during imbibition', () => {
    const state = makeLandState(2.5)

    // Drainage: push saturation up to 0.4
    applyLandTrapping(0.4, 0.0, state)
    tickLandState(state, 0.4)

    // Imbibition starts: saturation is falling
    applyLandTrapping(0.35, 0.4, state)
    tickLandState(state, 0.35)

    // Push well below Sgr — should be locked at Sgr
    const Sgr = computeResidualSaturation(0.4, 2.5)
    const { Sg_free } = applyLandTrapping(Sgr - 0.05, 0.35, state)

    expect(Sg_free).toBeCloseTo(Sgr, 6)
  })

  it('tracks Sg_max correctly during drainage', () => {
    const state = makeLandState(2.5)

    applyLandTrapping(0.2, 0.0, state)
    tickLandState(state, 0.2)

    applyLandTrapping(0.4, 0.2, state)
    tickLandState(state, 0.4)

    applyLandTrapping(0.35, 0.4, state)
    tickLandState(state, 0.35)

    // Sg_max should have been captured at 0.4
    expect(state.Sg_max).toBeCloseTo(0.4, 6)
  })

  it('does NOT lock during drainage phase (saturation increasing)', () => {
    const state = makeLandState(2.5)

    applyLandTrapping(0.2, 0.0, state)
    tickLandState(state, 0.2)

    const { Sg_free } = applyLandTrapping(0.35, 0.2, state)
    // Should pass through — no locking during drainage
    expect(Sg_free).toBeCloseTo(0.35, 6)
  })

  it('returns Sg_free = Sg_new when saturation is above Sgr', () => {
    const state = makeLandState(2.5)
    // No previous drainage — just a rising saturation
    const { Sg_free } = applyLandTrapping(0.25, 0.0, state)
    expect(Sg_free).toBeCloseTo(0.25, 6)
  })
})

describe('landResidualFraction', () => {
  it('returns a fraction in [0, 1]', () => {
    for (const C of [1, 2.5, 5]) {
      const f = landResidualFraction(C)
      expect(f).toBeGreaterThan(0)
      expect(f).toBeLessThan(1)
    }
  })

  it('higher C → lower residual fraction (more trapping at lower Sgr/Sg_max ratio)', () => {
    // Higher C means lower Sgr relative to Sg_max, so a smaller fraction is trapped
    // BUT the function returns fraction trapped = Sgr/Sg_max = 1/(1+C*Sg_max)
    // At nominal Sg_max=0.5: f = 1/(1+C*0.5) → decreases as C increases
    const fLow  = landResidualFraction(1.0)
    const fHigh = landResidualFraction(5.0)
    expect(fHigh).toBeLessThan(fLow)
  })
})
