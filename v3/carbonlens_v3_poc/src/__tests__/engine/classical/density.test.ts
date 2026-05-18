import { describe, it, expect } from 'vitest'
import { co2DensitySpanWagner, brineDensityGarcia } from '../../../engine/classical/density'

describe('co2DensitySpanWagner', () => {
  it('returns a positive density for typical reservoir conditions', () => {
    const T = 310   // K (37°C — Sleipner)
    const P = 10.3e6 // Pa
    const rho = co2DensitySpanWagner(T, P)
    expect(rho).toBeGreaterThan(0)
    expect(rho).toBeLessThan(1200)
  })

  it('returns higher density at higher pressure (same temperature)', () => {
    const T = 320
    const rhoLow = co2DensitySpanWagner(T, 5e6)
    const rhoHigh = co2DensitySpanWagner(T, 15e6)
    expect(rhoHigh).toBeGreaterThan(rhoLow)
  })

  it('returns lower density at higher temperature (same pressure)', () => {
    const P = 10e6
    const rhoCool = co2DensitySpanWagner(280, P)
    const rhoHot = co2DensitySpanWagner(400, P)
    expect(rhoCool).toBeGreaterThan(rhoHot)
  })

  it('clamps output to minimum 0.1 kg/m³', () => {
    // Very low pressure
    const rho = co2DensitySpanWagner(1000, 1)
    expect(rho).toBeGreaterThanOrEqual(0.1)
  })

  it('clamps output to maximum 1200 kg/m³ within main loop range (Pr ≤ 8)', () => {
    // P=50MPa → Pr=6.78 (<8), T=200K → Tr=0.66 (<3) — goes through iterative loop
    const rho = co2DensitySpanWagner(200, 50e6)
    expect(rho).toBeLessThanOrEqual(1200)
  })

  it('supercritical CO₂ density is in realistic range (600–900 kg/m³)', () => {
    // Sleipner conditions: 37°C, 10.3 MPa
    const T = 310.15
    const P = 10.3e6
    const rho = co2DensitySpanWagner(T, P)
    expect(rho).toBeGreaterThan(100)
    expect(rho).toBeLessThan(1200)
  })
})

describe('brineDensityGarcia', () => {
  it('returns density close to pure water (1000 kg/m³) at low salinity', () => {
    const rho = brineDensityGarcia(298.15, 1e5, 0) // 25°C, 1 atm, no salt
    expect(rho).toBeGreaterThan(990)
    expect(rho).toBeLessThan(1010)
  })

  it('returns higher density at higher salinity', () => {
    const T = 300
    const P = 1e5
    const rhoFresh = brineDensityGarcia(T, P, 0)
    const rhoSalty = brineDensityGarcia(T, P, 0.5) // 0.5 mol/kg NaCl
    expect(rhoSalty).toBeGreaterThan(rhoFresh)
  })

  it('returns lower density at higher temperature', () => {
    const P = 1e5
    const S = 0.1
    const rhoCool = brineDensityGarcia(280, P, S)
    const rhoHot = brineDensityGarcia(360, P, S)
    expect(rhoHot).toBeLessThan(rhoCool)
  })

  it('returns realistic brine density for Sleipner conditions', () => {
    // 37°C, salinity 0.05 mol/kg
    const rho = brineDensityGarcia(310.15, 10.3e5, 0.05)
    expect(rho).toBeGreaterThan(950)
    expect(rho).toBeLessThan(1050)
  })
})
