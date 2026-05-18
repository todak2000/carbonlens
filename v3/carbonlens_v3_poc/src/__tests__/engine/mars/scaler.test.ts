import { describe, it, expect } from 'vitest'
import { scaleInput } from '../../../engine/mars/scaler'
import { FeatureScaler, MarsInput } from '../../../engine/mars/types'

const mockScaler: FeatureScaler = {
  feature_cols: ['Pr', 'Tr'],
  scale_min: -1,
  scale_max: 1,
  params: {
    Pr: { min: 0, max: 10 },
    Tr: { min: 0, max: 5 },
  },
}

describe('scaleInput', () => {
  it('scales mid-range values to 0', () => {
    const input = { Pr: 5, Tr: 2.5 } as unknown as MarsInput
    const scaled = scaleInput(input, mockScaler)
    expect((scaled as any).Pr).toBeCloseTo(0, 5)
    expect((scaled as any).Tr).toBeCloseTo(0, 5)
  })

  it('scales minimum value to -1', () => {
    const input = { Pr: 0, Tr: 0 } as unknown as MarsInput
    const scaled = scaleInput(input, mockScaler)
    expect((scaled as any).Pr).toBeCloseTo(-1, 5)
    expect((scaled as any).Tr).toBeCloseTo(-1, 5)
  })

  it('scales maximum value to +1', () => {
    const input = { Pr: 10, Tr: 5 } as unknown as MarsInput
    const scaled = scaleInput(input, mockScaler)
    expect((scaled as any).Pr).toBeCloseTo(1, 5)
    expect((scaled as any).Tr).toBeCloseTo(1, 5)
  })

  it('passes through features not in scaler.params as-is', () => {
    const scalerWithMissing: FeatureScaler = {
      feature_cols: ['Pr', 'x_CH4'],
      scale_min: -1,
      scale_max: 1,
      params: { Pr: { min: 0, max: 10 } },
    }
    const input = { Pr: 5, x_CH4: 42 } as unknown as MarsInput
    const scaled = scaleInput(input, scalerWithMissing)
    expect((scaled as any).x_CH4).toBe(42)
  })

  it('returns 0 when feature min equals max (avoids division by zero)', () => {
    const equalScaler: FeatureScaler = {
      feature_cols: ['Pr'],
      scale_min: -1,
      scale_max: 1,
      params: { Pr: { min: 7, max: 7 } },
    }
    const input = { Pr: 7 } as unknown as MarsInput
    const scaled = scaleInput(input, equalScaler)
    expect((scaled as any).Pr).toBe(0)
  })
})
