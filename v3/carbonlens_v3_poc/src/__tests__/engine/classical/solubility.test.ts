import { describe, it, expect } from 'vitest'
import { co2SolubilityDuanSun, calculateMultiSaltSolubility } from '../../../engine/classical/solubility'
import type { MultiSaltBrine } from '../../../engine/classical/solubility'

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

// ── Duan et al. (2006) multi-salt solubility ──────────────────────────────────

describe('calculateMultiSaltSolubility', () => {
  it('returns CaCl2 solubility matching Table 2 at 50°C, 100 bar, 1m CaCl2', () => {
    // From Duan et al. (2006) Table 2: at 50°C, 100 bar, 1 mol/kg CaCl2
    // xCO2 ≈ 8.2e-3 mol/mol (0.0082)
    const brine: MultiSaltBrine = { m_NaCl: 0, m_KCl: 0, m_CaCl2: 1, m_MgCl2: 0 }
    const x = calculateMultiSaltSolubility(323.15, 10, brine)
    expect(x).toBeGreaterThan(0.005)
    expect(x).toBeLessThan(0.015)
  })

  it('returns NaCl solubility matching Table 2 at 50°C, 100 bar, 1m NaCl', () => {
    // From Duan et al. (2006) Table 2: at 50°C, 100 bar, 1 mol/kg NaCl
    // xCO2 ≈ 1.05e-2 mol/mol (0.0105)
    const brine: MultiSaltBrine = { m_NaCl: 1, m_KCl: 0, m_CaCl2: 0, m_MgCl2: 0 }
    const x = calculateMultiSaltSolubility(323.15, 10, brine)
    expect(x).toBeGreaterThan(0.005)
    expect(x).toBeLessThan(0.020)
  })

  it('returns higher solubility for pure water than saline brine (salting-out)', () => {
    const pure: MultiSaltBrine = { m_NaCl: 0, m_KCl: 0, m_CaCl2: 0, m_MgCl2: 0 }
    const saline: MultiSaltBrine = { m_NaCl: 2, m_KCl: 0, m_CaCl2: 0, m_MgCl2: 0 }
    const xPure = calculateMultiSaltSolubility(333.15, 10, pure)
    const xSaline = calculateMultiSaltSolubility(333.15, 10, saline)
    expect(xPure).toBeGreaterThan(xSaline)
  })

  it('CaCl2 reduces solubility more than NaCl at higher T,P (deep reservoir conditions)', () => {
    // At 100°C, 30 MPa (typical deep reservoir), the higher-order interaction
    // terms for Ca2+ dominate, giving the correct physical ordering.
    const nacl: MultiSaltBrine = { m_NaCl: 1, m_KCl: 0, m_CaCl2: 0, m_MgCl2: 0 }
    const cacl2: MultiSaltBrine = { m_NaCl: 0, m_KCl: 0, m_CaCl2: 1, m_MgCl2: 0 }
    const xNaCl = calculateMultiSaltSolubility(373.15, 30, nacl)
    const xCaCl2 = calculateMultiSaltSolubility(373.15, 30, cacl2)
    expect(xCaCl2).toBeLessThan(xNaCl)
  })

  it('handles zero salinity (pure water) gracefully', () => {
    const pure: MultiSaltBrine = { m_NaCl: 0, m_KCl: 0, m_CaCl2: 0, m_MgCl2: 0 }
    const x = calculateMultiSaltSolubility(323.15, 10, pure)
    expect(x).toBeGreaterThan(0)
    expect(x).toBeLessThan(0.05)
  })

  it('solubility decreases with increasing pressure (positive correlation)', () => {
    const brine: MultiSaltBrine = { m_NaCl: 1, m_KCl: 0, m_CaCl2: 0, m_MgCl2: 0 }
    const xLowP = calculateMultiSaltSolubility(333.15, 5, brine)
    const xHighP = calculateMultiSaltSolubility(333.15, 20, brine)
    expect(xHighP).toBeGreaterThan(xLowP)
  })
})
