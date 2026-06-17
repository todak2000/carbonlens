/**
 * FluidFlower Post-Injection Validation
 *
 * The FluidFlower experiment (Flemisch et al. 2023, Int. J. Greenhouse Gas Control)
 * is a physical analog experiment for CO2 storage using a 2D sandbox:
 *   - Sandbox dimensions: ~1.2 m wide x 0.86 m tall (2D analog domain)
 *   - Injection rate: 10 mL/min into a 5 mm-thick 2D domain
 *   - Post-injection: CO2 migrates as gravity current through layered sand
 *   - Key observable: CO2 footprint evolves as gravity current after injection stops
 *
 * This test validates the Hesse (2008) model from hessePostInjection.ts against
 * qualitatively expected physical behavior derived from the FluidFlower experiment.
 *
 * FluidFlower is a 2D analog with simplified geometry; 20-30% agreement expected
 * on dimensionless quantities.
 *
 * Reference:
 *   Flemisch, B. et al. (2023). The FluidFlower International Benchmark Study.
 *   International Journal of Greenhouse Gas Control, 126, 103902.
 *   DOI: 10.1016/j.ijggc.2023.103902
 *
 *   Hesse, M.A., Orr, F.M. & Tchelepi, H.A. (2008). Gravity currents with residual
 *   trapping. Journal of Fluid Mechanics, 611, 35-60.
 */

import { describe, it, expect } from 'vitest'
import { computeHessePostInjection } from '../../engine/plume/hessePostInjection'

// FluidFlower-representative parameters
const R_INJ = 0.15          // m: plume radius at end of injection in scaled geometry
const S_R   = 0.20          // residual saturation, typical for sand
const M_RATIO = 3.0         // mobility ratio CO2/brine at lab conditions

// Dimensionless post-injection times to evaluate
const T_POST_VALUES = [0.5, 1.0, 2.0, 5.0]

// Convert mobility ratio to viscosity ratio for the Hesse model:
// M = (krg_max/mu_co2) / (krw_max/mu_brine)
// Use krg_max=0.8, krw_max=1.0, choose viscosities such that M = 3.0
// M = (0.8 / mu_co2) / (1.0 / mu_brine) => mu_co2/mu_brine = 0.8/M
// With mu_brine = 1e-3 Pa.s (water at room temp):
const MU_BRINE = 1e-3       // Pa.s (water at lab conditions)
const MU_CO2   = MU_BRINE * (0.8 / M_RATIO)  // Pa.s resulting in M=3.0

// Injection duration: set equal to dimensionless time=1 (1 year as reference unit)
const T_INJ_YR = 1.0

describe('FluidFlower Post-Injection: Hesse (2008) qualitative validation', () => {
  const results = T_POST_VALUES.map((t_post) =>
    computeHessePostInjection({
      r_inj_m: R_INJ,
      t_inj_yr: T_INJ_YR,
      t_post_yr: t_post,
      S_r: S_R,
      mu_co2_Pa_s: MU_CO2,
      mu_brine_Pa_s: MU_BRINE,
      krg_max: 0.8,
      krw_max: 1.0,
    })
  )

  it('returns finite, non-NaN values for all post-injection times', () => {
    results.forEach((r, i) => {
      expect(isFinite(r.r_leading_m),  `r_leading finite at t=${T_POST_VALUES[i]}`).toBe(true)
      expect(isFinite(r.r_trailing_m), `r_trailing finite at t=${T_POST_VALUES[i]}`).toBe(true)
      expect(isFinite(r.mobile_fraction),        `mobile_fraction finite at t=${T_POST_VALUES[i]}`).toBe(true)
      expect(isFinite(r.newly_trapped_fraction), `trapped_fraction finite at t=${T_POST_VALUES[i]}`).toBe(true)
      expect(isNaN(r.r_leading_m)).toBe(false)
      expect(isNaN(r.r_trailing_m)).toBe(false)
    })
  })

  it('r_leading increases with t_post (leading front advances outward)', () => {
    for (let i = 1; i < results.length; i++) {
      expect(results[i].r_leading_m).toBeGreaterThan(results[i - 1].r_leading_m)
    }
  })

  it('r_trailing increases with t_post (residual boundary expands outward)', () => {
    for (let i = 1; i < results.length; i++) {
      expect(results[i].r_trailing_m).toBeGreaterThanOrEqual(results[i - 1].r_trailing_m)
    }
  })

  it('r_leading > r_trailing at all times (leading front always ahead of residual boundary)', () => {
    results.forEach((r) => {
      expect(r.r_leading_m).toBeGreaterThan(r.r_trailing_m)
    })
  })

  it('newly_trapped_fraction increases with t_post (progressive residual trapping)', () => {
    for (let i = 1; i < results.length; i++) {
      expect(results[i].newly_trapped_fraction).toBeGreaterThanOrEqual(
        results[i - 1].newly_trapped_fraction
      )
    }
  })

  it('mass balance: mobile_fraction + trapped_fraction <= 1.0 at all times', () => {
    results.forEach((r, i) => {
      const total = r.mobile_fraction + r.newly_trapped_fraction
      expect(total).toBeLessThanOrEqual(1.0 + 1e-9)  // small numerical tolerance
    })
  })

  it('at t_post=5: trapped_fraction > 0.3 (significant residual trapping has occurred)', () => {
    const lastResult = results[results.length - 1]  // t_post = 5.0
    expect(lastResult.newly_trapped_fraction).toBeGreaterThan(0.3)
  })

  it('leading front has advanced beyond injection radius at all t_post > 0', () => {
    results.forEach((r, i) => {
      expect(r.r_leading_m).toBeGreaterThan(R_INJ)
    })
  })

  it('mobility ratio is in physically expected range for sand at lab conditions', () => {
    const firstResult = results[0]
    expect(firstResult.mobility_ratio).toBeGreaterThan(1.0)
    expect(firstResult.mobility_ratio).toBeLessThan(20.0)
  })

  it('dimensionless tau = 1 + t_post/t_inj for all output times', () => {
    results.forEach((r, i) => {
      const expectedTau = 1 + T_POST_VALUES[i] / T_INJ_YR
      expect(r.tau).toBeCloseTo(expectedTau, 6)
    })
  })

  it('at t_post=0.5 (early post-injection): mobile fraction still > 0.5 (most CO2 mobile)', () => {
    const earlyResult = results[0]  // t_post = 0.5
    expect(earlyResult.mobile_fraction).toBeGreaterThan(0.5)
  })
})
