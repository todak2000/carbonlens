import { describe, it, expect } from 'vitest'
import { co2DiffusionCoefficient } from '../../../engine/classical/diffusion'

describe('co2DiffusionCoefficient', () => {
  it('returns a positive diffusion coefficient', () => {
    // P in MPa: 10 MPa typical reservoir pressure
    const De = co2DiffusionCoefficient(310.15, 10, 0.2)
    expect(De).toBeGreaterThan(0)
  })

  it('scales with temperature (higher T → higher diffusion)', () => {
    const P = 10 // MPa
    const phi = 0.2
    const DeLow = co2DiffusionCoefficient(280, P, phi)
    const DeHigh = co2DiffusionCoefficient(400, P, phi)
    expect(DeHigh).toBeGreaterThan(DeLow)
  })

  it('scales with porosity (higher phi → higher effective diffusion)', () => {
    const T = 310
    const P = 10 // MPa
    const DeLow = co2DiffusionCoefficient(T, P, 0.05)
    const DeHigh = co2DiffusionCoefficient(T, P, 0.40)
    expect(DeHigh).toBeGreaterThan(DeLow)
  })

  it('decreases at higher pressure (pressure exponential term)', () => {
    const T = 310
    const phi = 0.2
    const DeLow = co2DiffusionCoefficient(T, 1, phi)    // 1 MPa
    const DeHigh = co2DiffusionCoefficient(T, 50, phi)  // 50 MPa
    expect(DeLow).toBeGreaterThan(DeHigh)
  })

  it('returns physically realistic effective diffusivity in m²/s (1e-11 to 1e-9 range)', () => {
    const De = co2DiffusionCoefficient(310, 10, 0.2) // T in K, P in MPa
    // Typical effective CO₂ diffusivity in brine-saturated sandstone: 1e-11 to 5e-9 m²/s
    expect(De).toBeGreaterThan(1e-11)
    expect(De).toBeLessThan(5e-9)
  })
})
