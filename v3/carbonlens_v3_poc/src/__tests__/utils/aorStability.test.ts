import { describe, it, expect } from 'vitest'
import { expIntegralE1, computeAoRRadius } from '../../utils/computePressureField'
import type { FormationParams, Well } from '../../types'

// ── Tight-formation test inputs ──────────────────────────────────────────────
// k = 0.1 mD, phi = 0.05 → very tight, low-porosity formation
// t = 100 yr → large Theis u values at moderate distance
const TIGHT_FORMATION: FormationParams = {
  depth: 2000,
  thickness: 50,
  porosity: 0.05,
  permeability: 0.1,             // 0.1 mD
  pressure: 20,
  temperature: 333,
  monovalentSalinity: 1.0,
  bivalentSalinity: 0,
  saltType: 'NaCl',
  methaneFraction: 0,
  nitrogenFraction: 0,
  area: 1000,
  geometryType: 'anticline',
  netToGross: 1.0,
  caprockFriction: 0.577,
  caprockCohesion: 10,
  biotCoefficient: 1.0,
}

const TEST_WELL: Well = {
  id: 'inj-1',
  x: 0,
  z: 0,
  injectionRate: 0.5,            // 0.5 Mt/yr
  label: 'Injector',
  rampUpYears: 0,
  rampDownYears: 1,              // 1-year ramp-down avoids 0/0 when year ≈ projectYears
}

const RHO_CO2 = 700     // kg/m³ at reservoir conditions
const MU_CO2 = 6.5e-5   // Pa·s
const PROJECT_YEARS = 101       // injection runs for 100 active years (years 0..100, ramp down at 100..101)

// ── E1 large-argument stability ──────────────────────────────────────────────
describe('expIntegralE1 large-argument stability', () => {
  it('returns a positive finite value at u = 50', () => {
    const e1 = expIntegralE1(50)
    expect(e1).toBeGreaterThan(0)
    expect(Number.isFinite(e1)).toBe(true)
  })

  it('returns a positive finite value at u = 100', () => {
    const e1 = expIntegralE1(100)
    expect(e1).toBeGreaterThan(0)
    expect(Number.isFinite(e1)).toBe(true)
  })

  it('returns a positive finite value at u = 500', () => {
    const e1 = expIntegralE1(500)
    expect(e1).toBeGreaterThan(0)
    expect(Number.isFinite(e1)).toBe(true)
  })

  it('returns a positive finite value at u = 709 (near exp underflow limit)', () => {
    const e1 = expIntegralE1(709)
    expect(e1).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(e1)).toBe(true)
  })

  it('returns 0 at u = 750 (beyond Math.exp underflow)', () => {
    const e1 = expIntegralE1(750)
    expect(e1).toBe(0)
  })

  it('is strictly monotonically decreasing for u > 1', () => {
    const points = [1, 2, 5, 10, 20, 50, 100, 200, 500]
    for (let i = 1; i < points.length; i++) {
      expect(expIntegralE1(points[i])).toBeLessThan(expIntegralE1(points[i - 1]))
    }
  })

  it('handles u near 0 (small argument series)', () => {
    const e1 = expIntegralE1(1e-6)
    expect(e1).toBeGreaterThan(10)
    expect(Number.isFinite(e1)).toBe(true)
  })

  it('returns a large sentinel for u <= 0', () => {
    expect(expIntegralE1(0)).toBe(1e10)
    expect(expIntegralE1(-1)).toBe(1e10)
  })
})

// ── AoR stability for tight formations ───────────────────────────────────────
describe('computeAoRRadius tight-formation stability', () => {
  it('returns positive radius for tight formation (0.1 mD, 0.5 Mt/yr, 99 yrs)', () => {
    // Use year < projectYears - rampDown so wellRateAtTime returns full rate
    const r = computeAoRRadius(TIGHT_FORMATION, [TEST_WELL], 99, PROJECT_YEARS, RHO_CO2, MU_CO2)
    expect(r).toBeGreaterThan(0)
    expect(Number.isFinite(r)).toBe(true)
    expect(r).toBeLessThan(100_000)
  })

  it('returns positive radius for ultra-tight formation (0.01 mD)', () => {
    const ultraTight: FormationParams = { ...TIGHT_FORMATION, permeability: 0.01 }
    const r = computeAoRRadius(ultraTight, [TEST_WELL], 99, PROJECT_YEARS, RHO_CO2, MU_CO2)
    expect(r).toBeGreaterThan(0)
    expect(Number.isFinite(r)).toBe(true)
  })

  it('returns 0 when injection rate is zero', () => {
    const r = computeAoRRadius(TIGHT_FORMATION, [], 99, PROJECT_YEARS, RHO_CO2, MU_CO2)
    expect(r).toBe(0)
  })

  it('returns 0 when pressure threshold is not exceeded at wellbore', () => {
    // Tiny injection from low-permeability formation into vacuum-like conditions
    const microWell: Well = { ...TEST_WELL, injectionRate: 1e-8 }
    const r = computeAoRRadius(TIGHT_FORMATION, [microWell], 99, PROJECT_YEARS, RHO_CO2, MU_CO2)
    expect(r).toBe(0)
  })

  it('caps AoR at CAP_M = 300 km when threshold still exceeded at max range', () => {
    // Large-volume injection into a high-permeability, thick formation
    const bigForm: FormationParams = {
      ...TIGHT_FORMATION,
      permeability: 5000,
      thickness: 200,
      porosity: 0.25,
    }
    // 50 Mt/yr pushes pressure front well beyond 300 km, triggering the cap
    const bigWell: Well = { ...TEST_WELL, injectionRate: 50 }
    const r = computeAoRRadius(bigForm, [bigWell], 99, PROJECT_YEARS, RHO_CO2, MU_CO2)
    expect(r).toBe(300_000)
  })
})
