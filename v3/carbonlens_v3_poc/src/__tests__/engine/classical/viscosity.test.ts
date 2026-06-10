/**
 * Viscosity tests — validated against Fenghour, Wakeham & Vesovic (1998)
 * Appendix IV "Values of η Given at Specified T, P and ρ for Checking Computer Code"
 * J. Phys. Chem. Ref. Data 27(1), Table on p. 44.
 *
 * All reference values are in μPa·s from the original paper.
 * Tolerance: ±1% for non-critical-region conditions (paper uncertainty ≤ 0.3–5%).
 *             Critical-region case (304 K, 7 MPa) is tested separately with looser
 *             tolerance because Δηc (critical enhancement) is intentionally omitted.
 */

import { describe, it, expect } from 'vitest'
import { co2ViscosityFenghour, isNearCriticalRegion } from '../../../engine/classical/viscosity'

// ── Appendix IV reference data ────────────────────────────────────────────────
// { T_K, rho_kgm3, eta_ref_muPas, description }
const REFERENCE_DATA = [
  { T: 220,   rho:    2.440, eta: 11.06,  label: '220 K,  0.1 MPa, dilute gas'         },
  { T: 300,   rho:    1.773, eta: 15.02,  label: '300 K,  0.1 MPa, dilute gas'         },
  { T: 800,   rho:    0.662, eta: 35.09,  label: '800 K,  0.1 MPa, dilute gas'         },
  { T: 220,   rho: 1194.86,  eta: 269.37, label: '220 K, 15 MPa,  dense liquid'        },
  { T: 300,   rho: 1029.27,  eta: 132.55, label: '300 K, 50 MPa,  dense supercritical' },
  { T: 800,   rho:  407.828, eta:  48.74, label: '800 K, 75 MPa,  supercritical'       },
]

describe('co2ViscosityFenghour — exact Fenghour (1998) correlation', () => {

  describe('Appendix IV reference values (Table 13 of the paper)', () => {
    for (const { T, rho, eta: etaRef, label } of REFERENCE_DATA) {
      it(`matches paper within 1% — ${label}`, () => {
        const etaPas = co2ViscosityFenghour(T, rho)
        const etaMuPas = etaPas * 1e6
        const relErr = Math.abs(etaMuPas - etaRef) / etaRef
        expect(relErr).toBeLessThan(0.01) // ±1% tolerance
      })
    }
  })

  it('critical-region case (304 K, 7 MPa, ρ=254.32) background contribution correct', () => {
    // Full paper value is 20.99 μPa·s including Δηc critical enhancement.
    // Our implementation omits Δηc (Vesovic 1990) — background alone is ~20.90 μPa·s.
    // Verify we're within 2% of the full value (Δηc is small even at 304 K).
    const etaPas = co2ViscosityFenghour(304, 254.320)
    const etaMuPas = etaPas * 1e6
    const relErr = Math.abs(etaMuPas - 20.99) / 20.99
    expect(relErr).toBeLessThan(0.02) // looser tolerance: Δηc omitted
  })

  it('isNearCriticalRegion flags correctly', () => {
    expect(isNearCriticalRegion(304.0)).toBe(true)   // |304-304.107|/304.107 < 0.01
    expect(isNearCriticalRegion(310.0)).toBe(false)  // outside 1% band
    expect(isNearCriticalRegion(333.0)).toBe(false)  // typical reservoir T
  })

  it('viscosity increases with density at fixed temperature', () => {
    const T = 320
    expect(co2ViscosityFenghour(T, 200)).toBeLessThan(co2ViscosityFenghour(T, 700))
  })

  it('zero-density viscosity increases with temperature (gas-like)', () => {
    // Low density: dilute gas → viscosity increases with T (kinetic theory)
    const rho = 1.0
    expect(co2ViscosityFenghour(300, rho)).toBeLessThan(co2ViscosityFenghour(500, rho))
    expect(co2ViscosityFenghour(500, rho)).toBeLessThan(co2ViscosityFenghour(800, rho))
  })

  it('returns Pa·s (order of magnitude check)', () => {
    // Reservoir supercritical CO2 at 60°C / 20 MPa: expect ~4–7 × 10⁻⁵ Pa·s
    const eta = co2ViscosityFenghour(333, 700)
    expect(eta).toBeGreaterThan(3e-5)
    expect(eta).toBeLessThan(1e-4)
  })

  it('clamps to minimum positive value even at extreme inputs', () => {
    expect(co2ViscosityFenghour(200, 0)).toBeGreaterThan(0)
    expect(co2ViscosityFenghour(1500, 1400)).toBeGreaterThan(0)
    expect(isFinite(co2ViscosityFenghour(200, 0))).toBe(true)
    expect(isFinite(co2ViscosityFenghour(1500, 1400))).toBe(true)
  })
})
