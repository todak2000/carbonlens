import { describe, it, expect } from 'vitest'
import {
  co2DensityPengRobinson,
  co2DensityWithImpurities,
} from '../../../engine/classical/pengrobin'
import { co2DensitySpanWagner } from '../../../engine/classical/density'

// ── Reference SW densities for pure-CO₂ comparison ───────────────────────────
const SW_400_20 = co2DensitySpanWagner(400, 20e6)   // supercritical, far from Tc
const SW_320_10 = co2DensitySpanWagner(320, 10e6)   // near critical
const SW_300_5  = co2DensitySpanWagner(300, 5e6)    // subcritical gas

// ─── Peng-Robinson density ────────────────────────────────────────────────────
describe('co2DensityPengRobinson — pure CO₂ vs Span-Wagner', () => {
  it('returns a positive finite density for supercritical pure CO₂ (400 K, 20 MPa)', () => {
    const rho = co2DensityPengRobinson(400, 20e6, { xCO2: 1 })
    expect(rho).toBeGreaterThan(0)
    expect(rho).toBeLessThan(1200)
    expect(Number.isFinite(rho)).toBe(true)
  })

  it('is within 25 % of SW for pure CO₂ at 400 K, 20 MPa', () => {
    const rho = co2DensityPengRobinson(400, 20e6, { xCO2: 1 })
    const diff = Math.abs(rho - SW_400_20) / SW_400_20
    expect(diff).toBeLessThan(0.25)
  })

  it('returns a positive finite density near critical (320 K, 10 MPa)', () => {
    const rho = co2DensityPengRobinson(320, 10e6, { xCO2: 1 })
    expect(rho).toBeGreaterThan(0)
    expect(Number.isFinite(rho)).toBe(true)
  })

  it('returns a positive finite density for subcritical gas (300 K, 5 MPa)', () => {
    const rho = co2DensityPengRobinson(300, 5e6, { xCO2: 1 })
    expect(rho).toBeGreaterThan(0)
    expect(Number.isFinite(rho)).toBe(true)
  })
})

describe('co2DensityPengRobinson — monotonicity', () => {
  it('increases density with pressure at fixed temperature', () => {
    const rho10 = co2DensityPengRobinson(400, 10e6, { xCO2: 1 })
    const rho20 = co2DensityPengRobinson(400, 20e6, { xCO2: 1 })
    expect(rho20).toBeGreaterThan(rho10)
  })

  it('decreases density with temperature at fixed pressure', () => {
    const rho350 = co2DensityPengRobinson(350, 15e6, { xCO2: 1 })
    const rho450 = co2DensityPengRobinson(450, 15e6, { xCO2: 1 })
    expect(rho450).toBeLessThan(rho350)
  })
})

describe('co2DensityPengRobinson — impurity effects', () => {
  it('5 % CH₄ reduces density vs pure CO₂', () => {
    const pure = co2DensityPengRobinson(400, 20e6, { xCO2: 1 })
    const mix  = co2DensityPengRobinson(400, 20e6, { xCO2: 0.95, xCH4: 0.05 })
    expect(mix).toBeLessThan(pure)
  })

  it('10 % CH₄ reduces density more than 5 % CH₄', () => {
    const mix5  = co2DensityPengRobinson(400, 20e6, { xCO2: 0.95, xCH4: 0.05 })
    const mix10 = co2DensityPengRobinson(400, 20e6, { xCO2: 0.90, xCH4: 0.10 })
    expect(mix10).toBeLessThan(mix5)
  })

  it('5 % N₂ reduces density vs pure CO₂', () => {
    const pure = co2DensityPengRobinson(400, 20e6, { xCO2: 1 })
    const mix  = co2DensityPengRobinson(400, 20e6, { xCO2: 0.95, xN2: 0.05 })
    expect(mix).toBeLessThan(pure)
  })

  it('CH₄ + N₂ combined reduces density more than either alone', () => {
    const ch4only = co2DensityPengRobinson(400, 20e6, { xCO2: 0.95, xCH4: 0.05 })
    const both    = co2DensityPengRobinson(400, 20e6, { xCO2: 0.90, xCH4: 0.05, xN2: 0.05 })
    expect(both).toBeLessThan(ch4only)
  })
})

describe('co2DensityPengRobinson — numerical stability', () => {
  it('produces compressibility Z in (0.1, 3) across reservoir T,P range', () => {
    const points = [
      { T: 310, P: 5e6 },  { T: 310, P: 15e6 },
      { T: 350, P: 10e6 }, { T: 350, P: 30e6 },
      { T: 400, P: 10e6 }, { T: 400, P: 40e6 },
      { T: 450, P: 20e6 }, { T: 500, P: 50e6 },
    ]
    for (const pt of points) {
      const rho = co2DensityPengRobinson(pt.T, pt.P, { xCO2: 1 })
      const Z = pt.P * 0.04401 / (rho * 8.314462618 * pt.T)
      expect(Z).toBeGreaterThan(0.1)
      expect(Z).toBeLessThan(3)
    }
  })

  it('clamps density to minimum 0.1 kg/m³ at very high T, low P', () => {
    const rho = co2DensityPengRobinson(1000, 1, { xCO2: 1 })
    expect(rho).toBeGreaterThanOrEqual(0.1)
  })

  it('clamps density to maximum 1200 kg/m³ at very high P', () => {
    const rho = co2DensityPengRobinson(200, 100e6, { xCO2: 1 })
    expect(rho).toBeLessThanOrEqual(1200)
  })
})

// ─── Impurity-aware wrapper ───────────────────────────────────────────────────
describe('co2DensityWithImpurities', () => {
  it('delegates to Span-Wagner when impurities are zero', () => {
    const rho = co2DensityWithImpurities(400, 20e6, 0, 0)
    expect(rho).toBe(SW_400_20)
  })

  it('uses PR when CH₄ is present', () => {
    const rhoSpan = co2DensityWithImpurities(400, 20e6, 0, 0)
    const rhoPR   = co2DensityWithImpurities(400, 20e6, 0.05, 0)
    expect(rhoPR).not.toBe(rhoSpan)
    expect(rhoPR).toBeGreaterThan(0)
  })

  it('uses PR when N₂ is present', () => {
    const rhoSpan = co2DensityWithImpurities(400, 20e6, 0, 0)
    const rhoPR   = co2DensityWithImpurities(400, 20e6, 0, 0.05)
    expect(rhoPR).not.toBe(rhoSpan)
    expect(rhoPR).toBeGreaterThan(0)
  })
})
