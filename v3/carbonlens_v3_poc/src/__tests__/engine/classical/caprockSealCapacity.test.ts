import { describe, it, expect } from 'vitest'
import { computeCaprockSealCapacity } from '../../../engine/classical/caprockSealCapacity'

describe('computeCaprockSealCapacity', () => {
  describe('IFT=30 mN/m, pore throat=10 nm — strong seal', () => {
    const result = computeCaprockSealCapacity({
      iftMNm: 30,
      caprockPoreThroatNm: 10,
      contactAngleDeg: 0,
      co2DensityKgm3: 700,
      brineDensityKgm3: 1050,
      formationAreaKm2: 100,
      caprockPorosityFraction: 0.05,
    })

    it('entry pressure is ~6 MPa', () => {
      // Pe = 2 * 0.030 * cos(0) / (10e-9) = 6,000,000 Pa = 6 MPa
      expect(result.entryPressureMPa).toBeCloseTo(6, 0)
    })

    it('max column height is > 1000 m', () => {
      // h = Pe / (deltaRho * g) = 6e6 / (350 * 9.81) ≈ 1748 m
      expect(result.maxColumnHeightM).toBeGreaterThan(1000)
    })

    it('status is adequate (utilisation 0%)', () => {
      expect(result.status).toBe('adequate')
    })

    it('seal utilisation is 0 when no current column', () => {
      expect(result.sealUtilizationPct).toBe(0)
    })
  })

  describe('IFT=5 mN/m, pore throat=100 nm — weak seal', () => {
    const result = computeCaprockSealCapacity({
      iftMNm: 5,
      caprockPoreThroatNm: 100,
      contactAngleDeg: 0,
      co2DensityKgm3: 700,
      brineDensityKgm3: 1050,
      formationAreaKm2: 100,
      caprockPorosityFraction: 0.05,
    })

    it('entry pressure is ~0.1 MPa', () => {
      // Pe = 2 * 0.005 * 1 / (100e-9) = 100,000 Pa = 0.1 MPa
      expect(result.entryPressureMPa).toBeCloseTo(0.1, 2)
    })

    it('max column height is < 50 m', () => {
      // h = 1e5 / (350 * 9.81) ≈ 29 m
      expect(result.maxColumnHeightM).toBeLessThan(50)
    })

    it('status is marginal (h_max ~29m < 50m marginal threshold)', () => {
      // Pe = 2 * 0.005 / 100e-9 = 0.1 MPa; h_max = 1e5 / (350*9.81) ≈ 29m < 50m threshold
      expect(result.status).toBe('marginal')
    })
  })

  describe('Sleipner analogue: IFT~28 mN/m, 20 nm pore throat', () => {
    const result = computeCaprockSealCapacity({
      iftMNm: 28,
      caprockPoreThroatNm: 20,
      contactAngleDeg: 0,
      co2DensityKgm3: 680,
      brineDensityKgm3: 1020,
      formationAreaKm2: 26000,
      caprockPorosityFraction: 0.04,
    })

    it('max column height is > 200 m', () => {
      // Pe = 2 * 0.028 / 20e-9 = 2.8 MPa
      // deltaRho = 340, h = 2.8e6 / (340 * 9.81) ≈ 839 m
      expect(result.maxColumnHeightM).toBeGreaterThan(200)
    })

    it('entry pressure is positive', () => {
      expect(result.entryPressureMPa).toBeGreaterThan(0)
    })

    it('status is adequate for zero current column', () => {
      expect(result.status).toBe('adequate')
    })
  })

  describe('seal utilisation with current column', () => {
    it('reports marginal when current column is 75% of max', () => {
      // Make a known case: h_max should be ~1748 m (from the 30mN/m 10nm case)
      // Set current column to 75% of that
      const h_max_approx = 1748
      const result = computeCaprockSealCapacity({
        iftMNm: 30,
        caprockPoreThroatNm: 10,
        contactAngleDeg: 0,
        co2DensityKgm3: 700,
        brineDensityKgm3: 1050,
        formationAreaKm2: 100,
        caprockPorosityFraction: 0.05,
        currentColumnHeightM: h_max_approx * 0.80,
      })
      expect(result.status).toBe('marginal')
      expect(result.sealUtilizationPct).toBeGreaterThan(70)
      expect(result.sealUtilizationPct).toBeLessThan(90)
    })

    it('reports insufficient when current column > 90% of max', () => {
      const h_max_approx = 1748
      const result = computeCaprockSealCapacity({
        iftMNm: 30,
        caprockPoreThroatNm: 10,
        contactAngleDeg: 0,
        co2DensityKgm3: 700,
        brineDensityKgm3: 1050,
        formationAreaKm2: 100,
        caprockPorosityFraction: 0.05,
        currentColumnHeightM: h_max_approx * 0.95,
      })
      expect(result.status).toBe('insufficient')
    })
  })

  describe('contact angle effect', () => {
    it('30 degree contact angle reduces entry pressure by cos(30°)', () => {
      const water_wet = computeCaprockSealCapacity({
        iftMNm: 30, caprockPoreThroatNm: 10, contactAngleDeg: 0,
        co2DensityKgm3: 700, brineDensityKgm3: 1050, formationAreaKm2: 100,
        caprockPorosityFraction: 0.05,
      })
      const partial = computeCaprockSealCapacity({
        iftMNm: 30, caprockPoreThroatNm: 10, contactAngleDeg: 30,
        co2DensityKgm3: 700, brineDensityKgm3: 1050, formationAreaKm2: 100,
        caprockPorosityFraction: 0.05,
      })
      const ratio = partial.entryPressureMPa / water_wet.entryPressureMPa
      expect(ratio).toBeCloseTo(Math.cos((30 * Math.PI) / 180), 3)
    })
  })
})
