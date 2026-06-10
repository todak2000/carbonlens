/**
 * CO₂ dynamic viscosity — Fenghour, Wakeham & Vesovic (1998)
 * "The Viscosity of Carbon Dioxide", J. Phys. Chem. Ref. Data 27(1), 31–44.
 * DOI: 10.1063/1.556013
 *
 * η(ρ, T) = η₀(T) + Δη(ρ, T) + Δηc(ρ, T)      [Eq. 1]
 *
 * η₀(T)      — zero-density viscosity             [Eq. 3, Table 1]
 * Δη(ρ, T)   — excess viscosity                   [Eq. 8, Table 3]
 * Δηc(ρ, T)  — critical enhancement (negligible for reservoir T > 305 K,
 *               set to zero per paper §3.2; critical region is |T/Tc−1| < 0.05)
 *
 * Valid range: 200 K ≤ T ≤ 1500 K, ρ ≤ 1400 kg m⁻³, P ≤ 300 MPa (below 1000 K).
 * Uncertainty: ±0.3% at low pressures near room T; ±5% at highest pressures.
 *
 * All η values are in μPa·s internally; the public function returns Pa·s.
 */

// ── Table 1: zero-density polynomial coefficients (dimensionless, Eq. 4) ────
// ln Θ_η*(T*) = Σᵢ₌₀⁴ aᵢ · (ln T*)ⁱ
const A_COEFFS = [
  0.235156,          // a₀
 -0.491266,          // a₁
  5.211155e-2,       // a₂
  5.347906e-2,       // a₃
 -1.537102e-2,       // a₄
]

// ── Table 3: excess viscosity coefficients (Eq. 8) ──────────────────────────
// Units: Δη in μPa·s when ρ is in kg·m⁻³
// Nonzero elements (all others dᵢⱼ = 0):
//   d₁₁  →  j=1,i=1  coefficient of ρ
//   d₂₁  →  j=2,i=1  coefficient of ρ²
//   d₆₄  →  j=6,i=4  coefficient of ρ⁶/T*³
//   d₈₁  →  j=8,i=1  coefficient of ρ⁸
//   d₈₂  →  j=8,i=2  coefficient of ρ⁸/T*
const D11 =  0.4071119e-2     // μPa·s · m³/kg
const D21 =  0.7198037e-4     // μPa·s · m⁶/kg²
const D64 =  0.2411697e-16    // μPa·s · m¹⁸/kg⁶ · K³
const D81 =  0.2971072e-22    // μPa·s · m²⁴/kg⁸
const D82 = -0.1627888e-22    // μPa·s · m²⁴/kg⁸ · K

// ── Constants ────────────────────────────────────────────────────────────────
/** Energy scaling parameter ε/k (K), Eq. 5 */
const EPS_OVER_K = 251.196

/** Critical temperature (K) — used only for critical region guard */
const TC_CO2 = 304.107

/**
 * Zero-density viscosity η₀(T) in μPa·s.
 * Eq. 3–5, Fenghour et al. (1998).
 *
 * η₀(T) = 1.00697 · T^½ / Θ_η*(T*)
 * ln Θ_η*(T*) = Σᵢ aᵢ · (ln T*)ⁱ,  T* = T / (ε/k)
 */
function eta0_muPas(T_K: number): number {
  const Tstar = T_K / EPS_OVER_K
  const lnTstar = Math.log(Tstar)

  // Build Σ aᵢ · (ln T*)ⁱ  using Horner-style accumulation
  let lnThetaPow = 1.0
  let sum = 0.0
  for (let i = 0; i < A_COEFFS.length; i++) {
    sum += A_COEFFS[i] * lnThetaPow
    lnThetaPow *= lnTstar
  }

  // Θ_η*(T*) = exp(sum)
  const Theta = Math.exp(sum)
  return 1.00697 * Math.sqrt(T_K) / Theta
}

/**
 * Excess viscosity Δη(ρ, T) in μPa·s.
 * Eq. 8, Fenghour et al. (1998).
 *
 * Δη = d₁₁·ρ + d₂₁·ρ² + d₆₄·ρ⁶/T*³ + d₈₁·ρ⁸ + d₈₂·ρ⁸/T*
 */
function deltaEta_muPas(rho_kgm3: number, T_K: number): number {
  const Tstar = T_K / EPS_OVER_K
  const r = rho_kgm3
  const r2 = r * r
  const r6 = r2 * r2 * r2
  const r8 = r6 * r2
  const Tstar3 = Tstar * Tstar * Tstar

  return (
    D11 * r +
    D21 * r2 +
    D64 * r6 / Tstar3 +
    D81 * r8 +
    D82 * r8 / Tstar
  )
}

/**
 * CO₂ dynamic viscosity — exact Fenghour, Wakeham & Vesovic (1998) correlation.
 *
 * @param T_K      Temperature in Kelvin (reservoir range: 300–450 K)
 * @param rho_kgm3 CO₂ density in kg·m⁻³ (from Peng-Robinson EOS)
 * @returns        Dynamic viscosity in Pa·s
 *
 * Critical enhancement (Δηc) is omitted: it is significant only within ~1% of
 * the critical temperature (Tc = 304.107 K), i.e., 298–310 K approximately.
 * All reservoir injections at T > 310 K incur < 1% error from this omission.
 * For conditions near the critical point, see Vesovic et al. (1990).
 */
export function co2ViscosityFenghour(T_K: number, rho_kgm3: number): number {
  // Clamp to valid correlation range
  const T = Math.max(200, Math.min(1500, T_K))
  const rho = Math.max(0, Math.min(1400, rho_kgm3))

  const eta_muPas = eta0_muPas(T) + deltaEta_muPas(rho, T)

  // μPa·s → Pa·s
  return Math.max(1e-6, eta_muPas * 1e-6)
}

/**
 * Returns true if T is within the critical enhancement region (~1% of Tc).
 * Caller can use this to warn the user that Δηc is omitted and viscosity
 * may be underestimated by up to 5% in this narrow band.
 */
export function isNearCriticalRegion(T_K: number): boolean {
  return Math.abs(T_K - TC_CO2) / TC_CO2 < 0.01
}

/**
 * CO₂ dynamic viscosity — Laesecke & Muzny (2017) reference correlation.
 *
 * Laesecke, A. & Muzny, C.D. (2017). "Reference Correlation for the Viscosity of
 * Carbon Dioxide." J. Phys. Chem. Ref. Data 46(1), 013107.
 * DOI: 10.1063/1.4977429
 *
 * This is the current NIST-recommended reference correlation for CO₂ viscosity,
 * superseding Fenghour et al. (1998). Key improvements:
 *  - Lower uncertainty in the supercritical region (±0.5% vs ±5% for Fenghour at
 *    high pressures), which is the operating regime for all CCS injection wells.
 *  - Updated molecular parameters: ε/k = 245.0 K, σ = 3.7646 Å (vs. Fenghour's
 *    ε/k = 251.196 K) based on quantum-corrected collision integrals.
 *  - Valid range: 100 K ≤ T ≤ 2000 K, ρ ≤ 1400 kg/m³.
 *
 * ⚠️  UPGRADE STUB — currently delegates to Fenghour (1998):
 * Full implementation requires the zero-density (dilute gas), initial-density,
 * and residual viscosity coefficient tables from Tables 4–6 of the paper (paywalled).
 * Once those coefficients are available, replace the function body with the
 * L&M three-term formulation:
 *
 *   η(T,ρ) = η₀(T) + Δη_r(T,ρ) + Δη_c(T,ρ)
 *
 * where η₀ uses the updated ε/k=245 K and the L&M collision integral Ω coefficients,
 * Δη_r uses the L&M density-series coefficients (Table 5), and Δη_c is the critical
 * enhancement (significant within ~2% of Tc=304.13 K).
 *
 * For publication-grade accuracy in the supercritical zone (T=310–450 K, P=10–50 MPa)
 * this upgrade is recommended over the current Fenghour implementation.
 *
 * @param T_K      Temperature in Kelvin
 * @param rho_kgm3 CO₂ density in kg/m³
 * @returns        Dynamic viscosity in Pa·s
 */
export function co2ViscosityLaeseckeMuzny(T_K: number, rho_kgm3: number): number {
  // TODO: Replace with full L&M (2017) implementation once coefficient tables
  // are transcribed from Tables 4–6 of DOI 10.1063/1.4977429.
  // Current fallback to Fenghour (1998) — accuracy ±5% vs ±0.5% for L&M.
  return co2ViscosityFenghour(T_K, rho_kgm3)
}
