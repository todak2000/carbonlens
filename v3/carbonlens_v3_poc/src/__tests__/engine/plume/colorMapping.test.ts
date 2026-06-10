import { describe, it, expect } from 'vitest'
import { saturationToColor } from '../../../utils/colorMapping'

describe('saturationToColor', () => {
  it('returns navy-blue at zero saturation (brine cell)', () => {
    const [r, g, b] = saturationToColor(0, 'none', false)
    // Brine deep: #0d2137 → [0.051, 0.129, 0.216]
    expect(r).toBeLessThan(0.15)
    expect(g).toBeLessThan(0.20)
    expect(b).toBeGreaterThan(0.15)
  })

  it('returns red-dominant at full free CO2 saturation (Sg ≈ 1)', () => {
    const [r, g, b] = saturationToColor(1.0, 'free', false)
    expect(r).toBeGreaterThan(g)
    expect(r).toBeGreaterThan(b)
  })

  it('returns green-dominant for residual phase', () => {
    const [r, g, b] = saturationToColor(0.3, 'residual', false)
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
  })

  it('returns teal (high blue+green) for dissolved phase', () => {
    const [r, g, b] = saturationToColor(0.25, 'dissolved', false)
    // Dissolved = #14b8a6 → roughly equal high g and b, low r
    expect(g).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(r)
  })

  it('returns brownish (high r+g, low b) for mineral phase', () => {
    const [r, g, b] = saturationToColor(0.1, 'mineral', false)
    // Mineral = #b45309 → r > g > b
    expect(r).toBeGreaterThan(b)
  })

  it('returns grey for caprock cells regardless of saturation', () => {
    const [r0, g0, b0] = saturationToColor(0, 'none', true)
    const [r1, g1, b1] = saturationToColor(0.5, 'free', true)
    // Caprock grey: #64748b → all channels similar, roughly 0.39, 0.45, 0.55
    // Both should be in the same grey range
    expect(Math.abs(r0 - r1)).toBeLessThan(0.1)
    expect(Math.abs(g0 - g1)).toBeLessThan(0.1)
    expect(Math.abs(b0 - b1)).toBeLessThan(0.1)
  })

  it('all output channels are in [0, 1]', () => {
    const phases = ['none', 'free', 'residual', 'dissolved', 'mineral'] as const
    for (const phase of phases) {
      for (const sat of [0, 0.25, 0.5, 0.75, 1.0]) {
        const [r, g, b] = saturationToColor(sat, phase, false)
        expect(r).toBeGreaterThanOrEqual(0)
        expect(r).toBeLessThanOrEqual(1)
        expect(g).toBeGreaterThanOrEqual(0)
        expect(g).toBeLessThanOrEqual(1)
        expect(b).toBeGreaterThanOrEqual(0)
        expect(b).toBeLessThanOrEqual(1)
      }
    }
  })
})
