import { describe, it, expect } from 'vitest'
import { co2SolubilityDuanSun } from '../../../engine/classical/solubility'

describe('co2SolubilityDuanSun', () => {
  it('returns a non-negative solubility', () => {
    // T in K, P in MPa, salinity in mol/kg
    const m = co2SolubilityDuanSun(310.15, 10, 0.86)  // 0.86 mol/kg ≈ 50 000 ppm NaCl
    expect(m).toBeGreaterThanOrEqual(0)
  })

  it('solubility decreases with increasing salinity (salting-out effect)', () => {
    const T = 310  // K
    const P = 10   // MPa
    const mLow = co2SolubilityDuanSun(T, P, 0)
    const mHigh = co2SolubilityDuanSun(T, P, 2.0)  // 2 mol/kg NaCl — typical deep saline aquifer
    expect(mHigh).toBeLessThan(mLow)
  })

  it('solubility increases with pressure', () => {
    const T = 310   // K
    const S = 1.71  // mol/kg ≈ 100 000 ppm NaCl
    const mLow = co2SolubilityDuanSun(T, 5, S)
    const mHigh = co2SolubilityDuanSun(T, 20, S)
    expect(mHigh).toBeGreaterThan(mLow)
  })

  it('returns minimum floor value at extreme synthetic conditions', () => {
    // Ionic strength >> 28 mol/kg drives salting-out below the 0.01 floor; floor must hold.
    // This is a synthetic robustness test — physically impossible salinity.
    const m = co2SolubilityDuanSun(298, 1, 30.0)
    expect(m).toBeGreaterThanOrEqual(0.01)
  })

  it('returns realistic solubility for reservoir conditions (mol/kg)', () => {
    // Sleipner approx: ~37°C = 310K, ~10.3 MPa, ~0.86 mol/kg NaCl (≈50 000 ppm)
    // Duan & Sun predicts ~1.0–1.5 mol/kg at these conditions
    const m = co2SolubilityDuanSun(310.15, 10.3, 0.86)
    expect(m).toBeGreaterThan(0.5)
    expect(m).toBeLessThan(3.0)
  })

  it('returns ~1.1 mol/kg at 90°C, 22 MPa (benchmark validation)', () => {
    // 90°C = 363.15 K, 22 MPa, fresh water (zero salinity)
    const m = co2SolubilityDuanSun(363.15, 22, 0)
    expect(m).toBeGreaterThan(0.8)
    expect(m).toBeLessThan(1.5)
  })
})
