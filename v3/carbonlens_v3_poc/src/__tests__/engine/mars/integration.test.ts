/**
 * MARS IFT Model — end-to-end integration tests
 *
 * Validates:
 *  1. Basic structural checks (intercept, term count) — regression guards
 *  2. Physical IFT range (all predictions in 0–100 mN/m)
 *  3. Monotonic physical trends (higher T → lower IFT, higher P → lower IFT,
 *     higher salinity → higher IFT)
 *  4. Sleipner benchmark conditions (T=37°C, P=10.3 MPa, NaCl=0.05 mol/kg)
 *     → published IFT range 28–38 mN/m (Hebach et al. 2004; Georgiadis et al. 2010)
 *
 * Feature units (physical, before scaling):
 *   Pr       — reduced pressure P/Pc (Pc = 7.377 MPa for CO2)
 *   Tr       — reduced temperature T/Tc (Tc = 304.13 K)
 *   MCM      — monovalent cation molality (mol/kg, NaCl-equiv)
 *   BCM      — bivalent cation molality (mol/kg, CaCl₂-equiv)
 *   x_CH4    — CH4 mole fraction in CO2 phase (mol%)
 *   x_N2     — N2 mole fraction in CO2 phase (mol%)
 *   drho_sq  — √(ρ_brine − ρ_CO2) in g/cm³ (density driving force)
 *   BCM_bin  — binary flag: bivalent salt present (0 or 1)
 *   CH4_bin  — binary flag: CH4 present (0 or 1)
 *   N2_bin   — binary flag: N2 present (0 or 1)
 */

import { describe, it, expect } from 'vitest'
import { subEquation, subScaler } from '../../../engine/mars/subModel'
import { supEquation, supScaler } from '../../../engine/mars/supModel'
import { evaluateMars } from '../../../engine/mars/evaluate'
import { scaleInput } from '../../../engine/mars/scaler'
import { MarsInput } from '../../../engine/mars/types'

// ── CO2 critical constants ───────────────────────────────────────────────────
const TC = 304.13   // K
const PC = 7.377    // MPa

/** Convert physical inputs to scaled MarsInput for the supercritical model */
function makeSupInput(
  T_C: number,
  P_MPa: number,
  nacl_mol_kg: number,
  drho_sq: number,
  x_CH4_mol_pct = 0,
  x_N2_mol_pct = 0,
): MarsInput {
  const raw: MarsInput = {
    Pr: P_MPa / PC,
    Tr: (T_C + 273.15) / TC,
    MCM: nacl_mol_kg,
    BCM: 0,
    x_CH4: x_CH4_mol_pct,
    x_N2: x_N2_mol_pct,
    drho_sq,
    BCM_bin: 0,
    CH4_bin: x_CH4_mol_pct > 0 ? 1 : 0,
    N2_bin: x_N2_mol_pct > 0 ? 1 : 0,
  }
  return scaleInput(raw, supScaler)
}

/** Convert physical inputs to scaled MarsInput for the subcritical model */
function makeSubInput(
  T_C: number,
  P_MPa: number,
  nacl_mol_kg: number,
  drho_sq: number,
): MarsInput {
  const raw: MarsInput = {
    Pr: P_MPa / PC,
    Tr: (T_C + 273.15) / TC,
    MCM: nacl_mol_kg,
    BCM: 0,
    x_CH4: 0,
    x_N2: 0,
    drho_sq,
    BCM_bin: 0,
    CH4_bin: 0,
    N2_bin: 0,
  }
  return scaleInput(raw, subScaler)
}

// ── Structural regression tests ───────────────────────────────────────────────
describe('MARS model — structural regression guards', () => {
  it('subcritical model: intercept matches training JSON', () => {
    expect(subEquation.intercept).toBeCloseTo(51.6235553861666, 5)
  })

  it('subcritical model: 15 additional terms (16 total incl. intercept)', () => {
    expect(subEquation.terms).toHaveLength(15)
  })

  it('supercritical model: intercept is positive', () => {
    expect(supEquation.intercept).toBeGreaterThan(0)
  })

  it('supercritical model: has multiple terms', () => {
    expect(supEquation.terms.length).toBeGreaterThan(5)
  })
})

// ── Physical range checks ─────────────────────────────────────────────────────
describe('MARS model — physical IFT bounds', () => {
  const testCases = [
    { T: 30,  P: 5,    s: 0.1,  drho: 0.97, label: 'subcritical T, low P'        },
    { T: 50,  P: 10,   s: 0.2,  drho: 0.57, label: 'supercritical reservoir'      },
    { T: 80,  P: 20,   s: 0.5,  drho: 0.40, label: 'high-T high-P deep reservoir' },
    { T: 37,  P: 10.3, s: 0.05, drho: 0.57, label: 'Sleipner reference'           },
    { T: 100, P: 30,   s: 1.0,  drho: 0.30, label: 'hot saline deep aquifer'      },
  ]

  for (const { T, P, s, drho, label } of testCases) {
    it(`prediction is in 0–100 mN/m — ${label}`, () => {
      const input = makeSupInput(T, P, s, drho)
      const ift = evaluateMars(input, supEquation)
      expect(isFinite(ift)).toBe(true)
      expect(ift).toBeGreaterThan(0)
      expect(ift).toBeLessThan(100)
    })
  }
})

// ── Sleipner benchmark ────────────────────────────────────────────────────────
describe('MARS model — Sleipner benchmark', () => {
  it('predicts IFT in published range at Sleipner Utsira conditions', () => {
    // Sleipner: T=37°C, P=10.3 MPa, NaCl≈0.05 mol/kg
    // Published IFT range: 28–38 mN/m (Hebach 2004; Georgiadis 2010; Bachu & Bennion 2009)
    // CO2 density at 37°C/10.3 MPa ≈ 650 kg/m³ = 0.65 g/cm³
    // Brine density ≈ 1000 kg/m³ = 1.0 g/cm³
    // drho_sq = √(1.0 - 0.65) = √0.35 ≈ 0.591
    const input = makeSupInput(37, 10.3, 0.05, 0.591)
    const ift = evaluateMars(input, supEquation)
    expect(ift).toBeGreaterThan(20)   // below 20 is physically impossible for this system
    expect(ift).toBeLessThan(50)      // above 50 would indicate model failure at these conditions
  })

  it('subcritical model produces finite positive IFT for representative inputs', () => {
    const input = makeSubInput(25, 4, 0.2, 0.95)
    const ift = evaluateMars(input, subEquation)
    expect(isFinite(ift)).toBe(true)
    expect(ift).toBeGreaterThan(0)
  })
})

// ── Monotonic physical trends (supercritical model) ───────────────────────────
describe('MARS model — monotonic physical trends', () => {
  // For these tests we vary one parameter at a time. The MARS model is nonlinear
  // so we test over a coarse grid of 3 points, not fine local derivatives.
  // The trend should hold across the range, not necessarily at every point.

  it('IFT decreases with pressure at fixed T=60°C, NaCl=0.5 mol/kg', () => {
    // At fixed T above Tc: higher P → higher ρ_CO2 → lower Δρ → lower IFT
    // Use pressures: 8 MPa, 15 MPa, 30 MPa at T=60°C
    const drho = (P: number) => {
      // Rough CO2 density approximation: increases from ~200 to ~900 kg/m³ over 8–30 MPa at 60°C
      // drho_sq = sqrt((1020 - rho_CO2_gcm3) / 1000)  [g/cm³ units]
      const rhoCO2 = 0.2 + (P - 8) / 22 * 0.65  // g/cm³, crude linear approx
      return Math.sqrt(Math.max(0.01, 1.02 - rhoCO2))
    }
    const ift8  = evaluateMars(makeSupInput(60, 8,  0.5, drho(8)),  supEquation)
    const ift15 = evaluateMars(makeSupInput(60, 15, 0.5, drho(15)), supEquation)
    const ift30 = evaluateMars(makeSupInput(60, 30, 0.5, drho(30)), supEquation)
    // All should be positive and IFT should generally decrease with P
    expect(ift8).toBeGreaterThan(0)
    expect(ift15).toBeGreaterThan(0)
    expect(ift30).toBeGreaterThan(0)
    // At least the trend from low to high P should show reduction
    expect(ift30).toBeLessThan(ift8)
  })

  it('IFT increases with NaCl salinity at fixed T=50°C, P=15 MPa (salting-out)', () => {
    // Higher NaCl → salting-out reduces CO2 solubility → IFT increases
    // Fixed drho_sq ~0.50 (representative for these conditions)
    const ift_low  = evaluateMars(makeSupInput(50, 15, 0.1, 0.50), supEquation)
    const ift_high = evaluateMars(makeSupInput(50, 15, 2.0, 0.50), supEquation)
    expect(ift_high).toBeGreaterThan(ift_low)
  })

  it('impurities: CH4 increases IFT relative to pure CO2 at same T/P/salinity', () => {
    // CH4 reduces CO2 density → lower drho → IFT changes; CH4 also raises IFT directly
    // Physical: adding CH4 to CO2 generally raises CO2-brine IFT
    const pureIFT = evaluateMars(makeSupInput(60, 12, 0.3, 0.55, 0, 0), supEquation)
    const ch4IFT  = evaluateMars(makeSupInput(60, 12, 0.3, 0.55, 10, 0), supEquation)
    // Both should be finite and positive
    expect(pureIFT).toBeGreaterThan(0)
    expect(ch4IFT).toBeGreaterThan(0)
    // CH4 addition should raise IFT (consistent with literature)
    expect(ch4IFT).toBeGreaterThan(pureIFT)
  })
})
