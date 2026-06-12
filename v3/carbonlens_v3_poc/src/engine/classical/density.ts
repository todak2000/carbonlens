/**
 * CO₂ density — Span-Wagner (1996) multi-parameter Helmholtz energy EOS.
 *
 * Span, R. & Wagner, W. (1996). "A New Equation of State for Carbon Dioxide
 * Covering the Fluid Region from the Triple-Point Temperature to 1100 K at
 * Pressures up to 800 MPa." J. Phys. Chem. Ref. Data 25(6):1509–1596.
 * DOI: 10.1063/1.555991
 *
 * Accuracy: ±0.03–0.05% for p-ρ-T in most of the fluid region; gold-standard
 * reference EOS for pure CO₂ (used by NIST REFPROP / CoolProp).
 *
 * All coefficients from Table 31 of the 1996 paper.  The equation is
 * expressed as a dimensionless Helmholtz free energy:
 *
 *   α(δ, τ) = α⁰(δ, τ) + αr(δ, τ)
 *
 * with reduced density δ = ρ/ρ_c and inverse reduced temperature τ = T_c/T.
 * The pressure follows from:
 *
 *   P = ρ R_spec T (1 + δ ∂αr/∂δ)
 *
 * Given T and P we solve for ρ via bisection on P(δ) – P_target = 0.
 */

// Gas constant and molar mass
const R_UNIV = 8.314462618        // J/(mol·K)
const M_CO2  = 0.04401            // kg/mol

// Critical constants (Section 3.2 of Span & Wagner 1996)
const TC   = 304.1282             // K
const RHOC = 467.6                // kg/m³
const R_SW = R_UNIV / M_CO2      // 188.9241 J/(kg·K)

// ─────────────────────────────────────────────────────────────────────────────
// Table 31: coefficients and exponents of Eq. (6.5) — residual Helmholtz αr
// ─────────────────────────────────────────────────────────────────────────────
// Polynomial terms (i = 1…7): n_i δ^{d_i} τ^{t_i}
const POLY_N = [
  0.38856823203161, 0.29385475942740e1, -0.55867188534934e1,
  -0.76753199592477, 0.31729005580416, 0.54803315897767,
  0.12279411220335
]
const POLY_D = [1, 1, 1, 1, 2, 2, 3]
const POLY_T = [0.0, 0.75, 1.0, 2.0, 0.75, 2.0, 0.75]

// Exponential terms (all 27 terms combined)
const EXP_N = [
  0.21658961543220e1, 0.15841735109724e1, -0.23132705405503,
  0.58116916431436e-1, -0.55369137205382, 0.48946615909422,
  -0.24275739843501e-1, 0.62494790501678e-1, -0.12175860225246,
  -0.37055685270086, -0.16775879700426e-1, -0.11960736637987,
  -0.045619362508778, 0.35612789270346e-1, -0.74427727132052e-2,
  -0.17395704902432e-2, -0.021810121289527, 0.24332166559236e-1,
  -0.37440133423463e-1, 0.14338715756878, -0.13491969083286,
  -0.23151225053480e-1, 0.12363125492901e-1, 0.21058321972940e-2,
  -0.33958519026368e-3, 0.0055993651771592, -.30335118055646e-3
]
const EXP_D = [1, 2, 4, 5, 5, 5, 6, 6, 6, 1, 1, 4, 4, 4, 7, 8, 2, 3, 3, 5, 5, 6, 7, 8, 10, 4, 8]
const EXP_T = [1.5, 1.5, 2.5, 0.0, 1.5, 2.0, 0.0, 1.0, 2.0, 3.0, 6.0, 3.0, 6.0, 8.0, 6.0, 0.0, 7.0, 12.0, 16.0, 22.0, 24.0, 16.0, 24.0, 8.0, 2.0, 28.0, 14.0]
const EXP_C = [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 6]

// Gaussian bell-shaped terms (5 terms)
const GAUSS_N = [
  -0.21365488688320e3, 0.26641569149272e5, -0.24027212204557e5,
  -0.28341603423999e3, 0.21247284400179e3
]
const GAUSS_D = [2, 2, 2, 3, 3]
const GAUSS_T = [1.0, 0.0, 1.0, 3.0, 3.0]
const GAUSS_A = [25.0, 25.0, 25.0, 15.0, 20.0]
const GAUSS_B = [325.0, 300.0, 300.0, 275.0, 275.0]
const GAUSS_G = [1.16, 1.19, 1.19, 1.25, 1.22]
const GAUSS_E = [1.0, 1.0, 1.0, 1.0, 1.0]

// Non-analytic terms (3 terms)
const NANAL_N = [-0.66642276540751, 0.72608632349897, 0.55068668612842e-1]
const NANAL_A = [3.5, 3.5, 3.0]
const NANAL_B_B = [0.875, 0.925, 0.875] // Exponent b on Delta
const NANAL_BETA = [0.3, 0.3, 0.3] // Exponent beta in theta
const NANAL_AA = [0.7, 0.7, 0.7] // A in theta
const NANAL_BB = [0.3, 0.3, 1.0] // B in Delta
const NANAL_C = [10.0, 10.0, 12.5]
const NANAL_D = [275.0, 275.0, 275.0]

// ─────────────────────────────────────────────────────────────────────────────
// Core function: δ ∂αr/∂δ  (compressibility factor contribution)
// Returns Z – 1 = δ ∂αr/∂δ  where P = ρ R T (1 + δ ∂αr/∂δ) = ρ R T Z
// ─────────────────────────────────────────────────────────────────────────────
function swDeltaPhirDelta(delta: number, tau: number): number {
  let s = 0.0

  // 1. Polynomial terms: contribution = n d δ^d τ^t
  for (let i = 0; i < POLY_N.length; i++) {
    s += POLY_N[i] * POLY_D[i] * Math.pow(delta, POLY_D[i]) * Math.pow(tau, POLY_T[i])
  }

  // 2. Exponential terms: contribution = n δ^d e^{-g δ^c} τ^t (d - g c δ^c)
  for (let i = 0; i < EXP_N.length; i++) {
    const n = EXP_N[i]
    const d = EXP_D[i]
    const t = EXP_T[i]
    const c = EXP_C[i]
    s += n * Math.exp(-Math.pow(delta, c)) * Math.pow(delta, d) * Math.pow(tau, t) * (d - c * Math.pow(delta, c))
  }

  // 3. Gaussian terms
  for (let i = 0; i < GAUSS_N.length; i++) {
    const dme = delta - GAUSS_E[i]
    const tmg = tau   - GAUSS_G[i]
    const expG = Math.exp(-GAUSS_A[i] * dme * dme - GAUSS_B[i] * tmg * tmg)
    s += GAUSS_N[i] * Math.pow(tau, GAUSS_T[i]) * Math.pow(delta, GAUSS_D[i])
       * expG * (GAUSS_D[i] - 2.0 * GAUSS_A[i] * delta * dme)
  }

  // 4. Nonanalytic terms
  const dm1 = delta - 1.0
  const tm1 = tau   - 1.0
  for (let i = 0; i < NANAL_N.length; i++) {
    const dm1sq = dm1 * dm1
    const exp1o2b = 1.0 / (2.0 * NANAL_BETA[i])
    const dm1sq_1o2b = dm1sq > 0 ? Math.pow(dm1sq, exp1o2b) : 0.0
    const theta = -tm1 + NANAL_AA[i] * dm1sq_1o2b
    const dm1sq_a = dm1sq > 0 ? Math.pow(dm1sq, NANAL_A[i]) : 0.0
    const Delta = theta * theta + NANAL_BB[i] * dm1sq_a
    if (Delta <= 0) continue
    const DeltaBb = Math.pow(Delta, NANAL_B_B[i])
    const Psi = Math.exp(-NANAL_C[i] * dm1sq - NANAL_D[i] * tm1 * tm1)

    // dTheta/dDelta
    const dTheta_dDelta = dm1 > 1e-15 || dm1 < -1e-15
      ? NANAL_AA[i] * exp1o2b * 2.0 * dm1 * Math.pow(dm1sq, exp1o2b - 1.0)
      : 0.0
    const dDm1sq_a_dDelta = dm1 > 1e-15 || dm1 < -1e-15
      ? 2.0 * dm1 * NANAL_A[i] * Math.pow(dm1sq, NANAL_A[i] - 1.0)
      : 0.0
    const dDelta_dDelta = 2.0 * theta * dTheta_dDelta + NANAL_BB[i] * dDm1sq_a_dDelta
    const dDeltaBb_dDelta = NANAL_B_B[i] * Math.pow(Delta, NANAL_B_B[i] - 1.0) * dDelta_dDelta
    const dPsi_dDelta = -2.0 * NANAL_C[i] * dm1 * Psi

    s += NANAL_N[i] * delta * (
      DeltaBb * (Psi + delta * dPsi_dDelta) +
      dDeltaBb_dDelta * delta * Psi
    )
  }

  return s
}

/**
 * CO₂ density via Span-Wagner (1996) Helmholtz EOS.
 * Solves P = ρ R_spec T (1 + δ ∂αr/∂δ) for ρ by bisection.
 *
 * @param T  Temperature in Kelvin
 * @param P  Pressure in Pa
 * @returns  CO₂ density in kg/m³  (clamped to [0.1, 1200])
 */
export function co2DensitySpanWagner(T: number, P: number): number {
  const tau = TC / Math.max(T, 1.0)

  // Pressure at given reduced density δ
  const Pcalc = (delta: number): number => {
    const rho = delta * RHOC
    return rho * R_SW * T * (1.0 + swDeltaPhirDelta(delta, tau))
  }

  // ── Root search ───────────────────────────────────────────────────────────
  // Scan from low to high δ to find the FIRST bracket where Pcalc crosses P.
  // This guarantees we pick the lowest-density (gas/supercritical gas) root,
  // which is the physically correct root for CCS reservoir conditions.
  // The Helmholtz P(δ) isotherm can have multiple crossings near the critical
  // point even slightly above Tc; we always want the first (stable gas) root.
  const DELTA_MAX = 2.80   // δ = 2.80 → ρ ≈ 1309 kg/m³ (covers all CO2 phases)
  const SCAN_STEP = 0.04   // 70 scan steps — adequate resolution near Tc

  let bracketLo = 1e-4
  let bracketHi = DELTA_MAX

  let scanA = bracketLo
  let scanPa = Pcalc(scanA)

  // Ideal-gas check: if P is below Pcalc at the very first point, use ideal gas
  if (scanPa > P) {
    const rhoIdeal = P * M_CO2 / (R_UNIV * T)
    return Math.max(0.1, Math.min(1200, rhoIdeal))
  }

  // Walk forward to find the first crossing
  let foundBracket = false
  for (let d = bracketLo + SCAN_STEP; d <= DELTA_MAX + SCAN_STEP * 0.5; d += SCAN_STEP) {
    const dClamped = Math.min(d, DELTA_MAX)
    const Pd = Pcalc(dClamped)
    if (Pd >= P) {
      bracketLo = scanA
      bracketHi = dClamped
      foundBracket = true
      break
    }
    scanA = dClamped
    scanPa = Pd
  }

  if (!foundBracket) {
    // P exceeds Pcalc at all scan points — pressure is above our bracket range
    return 1200
  }

  // Bisection in the located bracket — 60 iterations → ~10⁻¹⁸ relative error
  let a = bracketLo
  let b = bracketHi
  for (let iter = 0; iter < 60; iter++) {
    const mid = 0.5 * (a + b)
    if (Pcalc(mid) < P) { a = mid } else { b = mid }
    if ((b - a) < 1e-12) break
  }

  const rho = 0.5 * (a + b) * RHOC
  return Math.max(0.1, Math.min(1200, rho))
}

/**
 * Alias with the historically-used name — same computation.
 * @deprecated prefer co2DensitySpanWagner
 */
export function co2DensityPR(T: number, P: number): number {
  return co2DensitySpanWagner(T, P)
}

// ─────────────────────────────────────────────────────────────────────────────
// Brine density — Garcia (2001) correlation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Brine density — Garcia (2001) salinity correction on Bigg (1967) pure-water
 * polynomial with Kell (1975) pressure correction.
 *
 * Garcia, J.E. (2001). LBNL-49023. Lawrence Berkeley National Laboratory.
 * Bigg, P.H. (1967). Br. J. Appl. Phys., 18, 521–525.
 * Kell, G.S. (1975). J. Chem. Eng. Data, 20(1), 97–105.
 *
 * @param T              Temperature in Kelvin
 * @param P              Pressure in MPa
 * @param monoSalinity   Monovalent salinity (NaCl equivalent) in mol/kg
 * @param biSalinity     Bivalent salinity (CaCl₂ equivalent) in mol/kg
 * @returns              Brine density in kg/m³
 */
export function brineDensityGarcia(
  T: number,
  P: number,
  monoSalinity: number,
  biSalinity: number = 0,
): number {
  const T_c = Math.max(0, Math.min(200, T - 273.15))  // °C, clamped

  // Bigg (1967) polynomial for pure water at atmospheric pressure (kg/m³)
  const rho_atm = 999.842594
    + 6.793952e-2  * T_c
    - 9.09529e-3   * T_c ** 2
    + 1.001685e-4  * T_c ** 3
    - 1.120083e-6  * T_c ** 4
    + 6.536332e-9  * T_c ** 5

  // Kell (1975) isothermal compressibility (MPa⁻¹): κ_T ≈ 1/(2179 + 10.9·T_c)
  // Pressure correction: Δρ = ρ_atm · κ_T · (P – P_ref)  where P_ref = 0.1 MPa
  const P_MPa = Math.max(0.1, P)  // P supplied in MPa
  const kappa_T = 1.0 / (2179 + 10.9 * T_c)
  const rho_pure = rho_atm * (1 + kappa_T * (P_MPa - 0.1))

  // Garcia (1982) salinity correction — convert mol/kg to g/kg via molar masses
  const A = 8.044e-1  - 4.886e-3 * T_c + 5.234e-5 * T_c ** 2 - 3.147e-7 * T_c ** 3 + 7.945e-10 * T_c ** 4
  const B = -5.819e-4 + 1.665e-5 * T_c - 1.156e-6 * T_c ** 2 + 6.659e-9 * T_c ** 3 - 1.403e-11 * T_c ** 4
  const C = 4.929e-6  - 6.529e-8 * T_c + 1.758e-9 * T_c ** 2 - 1.386e-11 * T_c ** 3 + 3.242e-14 * T_c ** 4

  // NaCl molar mass 58.44 g/mol; CaCl₂ 110.98 g/mol
  const S = monoSalinity * 58.44 + biSalinity * 110.98
  return Math.max(800, Math.min(1300, rho_pure + A * S + B * S ** 1.5 + C * S ** 2))
}
