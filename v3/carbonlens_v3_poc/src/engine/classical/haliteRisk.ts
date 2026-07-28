/**
 * Halite (NaCl) precipitation risk screening near the CO₂ injection wellbore.
 *
 * Mechanism: supercritical CO₂ is essentially dry — it evaporates water from
 * formation brine in the near-wellbore region. If the water-evaporation flux
 * exceeds back-diffusion of dissolved salt, NaCl (halite) crystallises in pore
 * throats, progressively blocking flow and increasing skin (injectivity loss).
 *
 * This screen implements the Zeidouni et al. (2012) dryout-radius model:
 *
 *   r_dry = √[ Q_CO₂ · t_inj · ρ_CO₂ / (π · h · φ · Swi · ρ_brine) ]
 *
 * The risk is then assessed against salinity and temperature multipliers.
 *
 * Risk categories (following Muller et al. 2009 field criteria):
 *   LOW      r_dry < 0.5 m  OR  salinity < 100 g/L
 *   MODERATE r_dry 0.5–2 m AND salinity 100–250 g/L
 *   HIGH     r_dry > 2 m   AND salinity > 250 g/L
 *
 * References:
 *   Zeidouni, M., Pooladi-Darvish, M., & Keith, D. (2009). Analytical solution
 *     to evaluate salt precipitation during CO₂ injection in saline aquifers.
 *     Int. J. Greenhouse Gas Control, 3(5), 600–611.
 *   Muller, N., et al. (2009). CO₂ injection impairment due to halite
 *     precipitation. Energy Procedia, 1(1), 3507–3514.
 */

export interface HaliteRiskResult {
  risk: 'low' | 'moderate' | 'high'
  dryoutRadius_m: number
  salinityGPL: number       // total dissolved solids (g/L)
  message: string
  recommendation: string
}

/**
 * Equilibrium water content of the CO₂-rich phase (mass fraction kg_H2O / kg_fluid).
 *
 * Simplified from Spycher & Pruess (2005) Geochim. Cosmochim. Acta 69(13):3309.
 * Uses Buck (1981) saturation pressure + enhancement factor ≈ 2.5 for dissolved-CO₂
 * activity correction. Valid for T = 10–120°C, P = 5–80 MPa (supercritical range).
 *
 * Typical values: 0.002–0.005 at 50–100°C, 10–30 MPa.
 * The previous approximation (χ_w ≈ ρ_CO₂/ρ_brine ≈ 0.41) was wrong by ~100×,
 * inflating the dryout radius by an order of magnitude.
 */
function co2WaterContent_kgPerKg(T_C: number, P_MPa: number): number {
  // Buck (1981) saturation pressure of water (MPa), valid 10-120°C
  const P_sat_MPa = 6.1121e-4 * Math.exp((18.678 - T_C / 234.5) * T_C / (257.14 + T_C))
  // Enhancement factor (≈ 2.5) accounts for non-ideal CO₂-H₂O mixing at high P
  const y_w = Math.min(0.04, 2.5 * P_sat_MPa / Math.max(P_MPa, 0.1))
  return Math.max(5e-4, y_w * 18.015 / (y_w * 18.015 + (1.0 - y_w) * 44.01))
}

/**
 * Compute halite precipitation risk for a single injection well.
 *
 * @param injectionRate_MtPerYear  Peak injection rate (Mt/yr)
 * @param thickness_m              Net pay thickness (m)
 * @param porosity                 Formation porosity (fraction)
 * @param Swi                      Connate water saturation (fraction); default 0.15
 * @param monovalentSalinity       NaCl-equivalent molality (mol/kg)
 * @param bivalentSalinity         CaCl₂-equivalent molality (mol/kg)
 * @param co2Density_kgm3          CO₂ density at reservoir conditions (kg/m³)
 * @param brineDensity_kgm3        Brine density (kg/m³)
 * @param temperature_C            Reservoir temperature (°C)
 * @param projectYears             Injection duration (years) — sets cumulative exposure
 * @param pressure_MPa             Reservoir pressure (MPa) — needed for χ_w; default 15
 */
export function computeHaliteRisk(
  injectionRate_MtPerYear: number,
  thickness_m: number,
  porosity: number,
  Swi: number = 0.15,
  monovalentSalinity: number,
  bivalentSalinity: number,
  co2Density_kgm3: number,
  brineDensity_kgm3: number,
  temperature_C: number,
  projectYears: number,
  pressure_MPa: number = 15,
): HaliteRiskResult {
  // ── Salinity in g/L ───────────────────────────────────────────────────────
  // NaCl MW = 58.44, CaCl₂ MW = 110.98  (g/mol)
  const mNaCl_gkg  = monovalentSalinity * 58.44
  const mCaCl2_gkg = bivalentSalinity   * 110.98
  const tds_gkg    = mNaCl_gkg + mCaCl2_gkg          // g/kg solution
  const salinityGPL = tds_gkg * (brineDensity_kgm3 / 1000)  // g/L

  // ── CO₂ volumetric rate (m³/s) ────────────────────────────────────────────
  const q_m3s = injectionRate_MtPerYear * 1e9 / (co2Density_kgm3 * 365.25 * 24 * 3600)

  // ── Cumulative injection time (s) ─────────────────────────────────────────
  const t_s = projectYears * 365.25 * 24 * 3600

  // ── Dryout radius — Zeidouni (2009) Eq. 17 ───────────────────────────────
  // Mass balance: M_CO₂_injected × χ_w = π × r_d² × h × φ × Swi × ρ_brine
  //   r_d = sqrt[ Q_CO₂_mass × t × χ_w / (π × h × φ × Swi × ρ_brine) ]
  //       = sqrt[ q_m3s × ρ_CO₂ × t_s × χ_w / (π × h × φ × Swi × ρ_brine) ]
  //
  // χ_w: equilibrium water content (kg H₂O / kg CO₂-rich fluid) from Spycher & Pruess (2005).
  // Previous code used χ_w ≈ ρ_CO₂/ρ_brine ≈ 0.41 — wrong by ~100×, inflating r_d ~10×.
  const Swi_eff = Math.max(Swi, 0.05)
  const chi_w = co2WaterContent_kgPerKg(temperature_C, pressure_MPa)
  const denominator = Math.PI * thickness_m * porosity * Swi_eff * Math.max(brineDensity_kgm3, 1)
  const dryoutRadius_m = denominator > 0
    ? Math.sqrt(Math.max(0, q_m3s * co2Density_kgm3 * t_s * chi_w / denominator))
    : 0

  // ── Temperature multiplier: higher T → more water evaporation ─────────────
  const tempFactor = temperature_C > 80 ? 1.4 : temperature_C > 60 ? 1.2 : 1.0

  const effectiveDryout = dryoutRadius_m * tempFactor

  // ── Risk classification ───────────────────────────────────────────────────
  const highSalinity = salinityGPL > 200          // high TDS formation
  const veryHighSal  = salinityGPL > 300          // hypersaline
  const largeDryout  = effectiveDryout  > 2.0     // extends beyond near-wellbore skin zone
  const moderateDryout = effectiveDryout > 0.5

  let risk: 'low' | 'moderate' | 'high'
  let message: string
  let recommendation: string

  if (!highSalinity || !moderateDryout) {
    risk = 'low'
    message =
      `Halite risk LOW. Dryout radius ${effectiveDryout.toFixed(2)} m; ` +
      `brine TDS ${salinityGPL.toFixed(0)} g/L. ` +
      `Near-wellbore water evaporation is insufficient to precipitate significant salt volumes.`
    recommendation =
      'Standard wellhead pressure monitoring during injection commissioning is sufficient. ' +
      'No pre-flush required.'
  } else if (veryHighSal && largeDryout) {
    risk = 'high'
    message =
      `HIGH halite risk. Effective dryout radius ${effectiveDryout.toFixed(2)} m ` +
      `(${salinityGPL.toFixed(0)} g/L TDS, ${temperature_C.toFixed(0)}°C). ` +
      `Salt crystal accumulation in the near-wellbore pore network will cause progressive ` +
      `skin increase and injectivity decline over the ${projectYears}-year injection period.`
    recommendation =
      '① Pre-flush with low-salinity water (≥5 PV at wellbore) before CO₂ injection. ' +
      '② Plan periodic freshwater slug injection (annual or bi-annual) to redissolve halite deposits. ' +
      '③ Monitor BHP trend closely — rising BHP at constant rate signals growing halite skin. ' +
      '④ Consider reduced injection rate during early commissioning to limit dryout zone growth.'
  } else {
    risk = 'moderate'
    message =
      `Moderate halite risk. Dryout radius ${effectiveDryout.toFixed(2)} m ` +
      `(${salinityGPL.toFixed(0)} g/L TDS). ` +
      `Localised near-wellbore salt precipitation may develop; ` +
      `injectivity impairment likely only if injection rate is sustained at peak without remediation.`
    recommendation =
      '① Monitor injection pressure trend — rising BHP signals halite skin build-up. ' +
      '② Consider periodic freshwater slug injection to redissolve near-wellbore deposits. ' +
      '③ Assess coiled-tubing acid wash (HCl) as a contingency workover option.'
  }

  if (temperature_C > 80 && risk !== 'low') {
    message += ` Elevated temperature (${temperature_C.toFixed(0)}°C) increases CO₂ water-carrying capacity by ~${((tempFactor - 1) * 100).toFixed(0)}%, amplifying dryout zone.`
  }

  return { risk, dryoutRadius_m: effectiveDryout, salinityGPL, message, recommendation }
}
