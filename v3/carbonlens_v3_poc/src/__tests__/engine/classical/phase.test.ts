import { describe, it, expect } from 'vitest'
import { determinePhase, computeTr, computePr } from '../../../engine/classical/phase'

describe('determinePhase', () => {
  it('returns supercritical for pure CO₂ above critical point (Tc=304.13K, Pc=7.377MPa)', () => {
    const result = determinePhase(310, 8, 0, 0) // T > 304.13K, P > 7.377 MPa
    expect(result).toBe('supercritical')
  })

  it('returns subcritical for pure CO₂ below critical temperature', () => {
    const result = determinePhase(290, 8, 0, 0) // T < 304.13K
    expect(result).toBe('subcritical')
  })

  it('returns subcritical for pure CO₂ below critical pressure', () => {
    const result = determinePhase(310, 5, 0, 0) // P < 7.377 MPa
    expect(result).toBe('subcritical')
  })

  it('returns subcritical when both T and P are below critical', () => {
    const result = determinePhase(280, 5, 0, 0)
    expect(result).toBe('subcritical')
  })

  it('applies Kays rule mixing for methane (lowers effective Tc)', () => {
    // CH4: Tc=190.56K, Pc=4.599MPa — blending shifts critical point
    const result = determinePhase(280, 6, 0.5, 0) // 50% CH4, 50% CO2
    // Effective Tc = 0.5*304.13 + 0.5*190.56 = 247.345 K
    // Effective Pc = 0.5*7.377 + 0.5*4.599 = 5.988 MPa
    // T=280 > 247.345 and P=6 > 5.988 → supercritical
    expect(result).toBe('supercritical')
  })

  it('nitrogen addition also shifts critical point', () => {
    // N2: Tc=126.19K, Pc=3.390MPa
    const result = determinePhase(200, 4, 0, 0.9) // 90% N2
    // Effective Tc = 0.1*304.13 + 0.9*126.19 ≈ 164.0 K
    // Effective Pc = 0.1*7.377 + 0.9*3.390 ≈ 3.789 MPa
    // T=200 > 164 and P=4 > 3.789 → supercritical
    expect(result).toBe('supercritical')
  })
})

describe('computeTr', () => {
  it('returns 1.0 at the effective critical temperature', () => {
    const Tc = 304.13 // pure CO2
    const Tr = computeTr(Tc, 0, 0)
    expect(Tr).toBeCloseTo(1.0, 5)
  })

  it('returns value > 1 above critical temperature', () => {
    const Tr = computeTr(400, 0, 0)
    expect(Tr).toBeGreaterThan(1.0)
  })
})

describe('computePr', () => {
  it('returns 1.0 at the effective critical pressure', () => {
    const Pc = 7.377 // pure CO2
    const Pr = computePr(Pc, 0, 0)
    expect(Pr).toBeCloseTo(1.0, 4)
  })

  it('returns value > 1 above critical pressure', () => {
    const Pr = computePr(15, 0, 0)
    expect(Pr).toBeGreaterThan(1.0)
  })
})
