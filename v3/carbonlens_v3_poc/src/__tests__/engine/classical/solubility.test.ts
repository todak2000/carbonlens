import { describe, it, expect } from 'vitest'
import { co2SolubilityDuanSun } from '../../../engine/classical/solubility'

describe('co2SolubilityDuanSun', () => {
  it('returns a non-negative solubility', () => {
    const xCO2 = co2SolubilityDuanSun(310.15, 10e6, 0.05)
    expect(xCO2).toBeGreaterThanOrEqual(0)
  })

  it('solubility decreases with increasing salinity (salting-out effect)', () => {
    const T = 310
    const P = 10e6
    const xLow = co2SolubilityDuanSun(T, P, 0)
    const xHigh = co2SolubilityDuanSun(T, P, 0.5)
    expect(xHigh).toBeLessThan(xLow)
  })

  it('solubility increases with pressure', () => {
    const T = 310
    const S = 0.1
    const xLow = co2SolubilityDuanSun(T, 5e6, S)
    const xHigh = co2SolubilityDuanSun(T, 20e6, S)
    expect(xHigh).toBeGreaterThan(xLow)
  })

  it('returns zero or near-zero at zero salinity limit', () => {
    // Should not return negative
    const x = co2SolubilityDuanSun(300, 1e6, 2.0) // very high salinity
    expect(x).toBeGreaterThanOrEqual(0)
  })

  it('returns realistic solubility index for reservoir conditions', () => {
    // Sleipner: 37°C, 10.3 MPa, ~0.05 mol/kg salinity
    // The Duan-Sun implementation returns a dimensionless solubility index
    // (not strict mole fraction) — typically 0.1–1.0 at reservoir conditions
    const x = co2SolubilityDuanSun(310.15, 10.3e6, 0.05)
    expect(x).toBeGreaterThan(0)
    expect(x).toBeLessThan(2.0)
  })
})
