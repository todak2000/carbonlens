import { describe, it, expect } from 'vitest'
import { hinge, evaluateMars } from '../../../engine/mars/evaluate'
import { MarsEquation } from '../../../engine/mars/types'

describe('hinge function', () => {
  it('direction=2 returns the value directly (linear term)', () => {
    expect(hinge(3.5, 0, 2)).toBe(3.5)
    expect(hinge(-1.0, 5, 2)).toBe(-1.0)
  })

  it('direction=1 returns max(0, value - knot) — right hinge', () => {
    expect(hinge(5, 2, 1)).toBeCloseTo(3, 5)
    expect(hinge(1, 2, 1)).toBe(0)  // below knot → zero
    expect(hinge(2, 2, 1)).toBe(0)  // at knot → zero
  })

  it('direction=-1 returns max(0, knot - value) — left hinge', () => {
    expect(hinge(1, 4, -1)).toBeCloseTo(3, 5)
    expect(hinge(5, 4, -1)).toBe(0) // above knot → zero
    expect(hinge(4, 4, -1)).toBe(0) // at knot → zero
  })

  it('returns 0 for unknown direction', () => {
    expect(hinge(5, 2, 99)).toBe(0)
  })
})

describe('evaluateMars', () => {
  it('returns intercept when all hinge functions evaluate to zero', () => {
    const eq: MarsEquation = {
      intercept: 42.0,
      terms: [
        { coefficient: 10.0, hinges: [{ feature: 'Pr', direction: 1, knot: 999 }] }
      ],
    }
    const result = evaluateMars({ Pr: 0.5 } as any, eq)
    expect(result).toBeCloseTo(42.0, 5)
  })

  it('adds term product when hinge is active', () => {
    const eq: MarsEquation = {
      intercept: 10.0,
      terms: [
        { coefficient: 2.0, hinges: [{ feature: 'Tr', direction: 1, knot: 0.0 }] }
      ],
    }
    // hinge(1.5, 0, 1) = 1.5, so result = 10 + 2 * 1.5 = 13
    const result = evaluateMars({ Tr: 1.5 } as any, eq)
    expect(result).toBeCloseTo(13.0, 5)
  })

  it('handles multi-hinge terms (product of hinges)', () => {
    const eq: MarsEquation = {
      intercept: 0.0,
      terms: [
        {
          coefficient: 5.0,
          hinges: [
            { feature: 'Pr', direction: 1, knot: 0.0 },
            { feature: 'Tr', direction: 1, knot: 0.0 },
          ],
        },
      ],
    }
    // hinge(2,0,1)=2, hinge(3,0,1)=3 → 5 * 2 * 3 = 30
    const result = evaluateMars({ Pr: 2, Tr: 3 } as any, eq)
    expect(result).toBeCloseTo(30.0, 5)
  })

  it('returns intercept when features are missing (defaults to 0)', () => {
    const eq: MarsEquation = {
      intercept: 25.0,
      terms: [
        { coefficient: 100, hinges: [{ feature: 'nonexistent_feature', direction: 1, knot: 0.01 }] }
      ],
    }
    const result = evaluateMars({} as any, eq)
    // feature defaults to 0, hinge(0, 0.01, 1) = max(0, 0 - 0.01) = 0
    expect(result).toBeCloseTo(25.0, 5)
  })
})
