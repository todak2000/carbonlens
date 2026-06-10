/**
 * Thermal effects for CO2 injection — geothermal gradient and Joule-Thomson cooling.
 *
 * For CO2 storage screening, two thermal effects matter:
 *
 *  1. Geothermal gradient: T increases with depth at ~25–30°C/km in sedimentary basins.
 *     This governs reservoir temperature, CO2 phase state, and viscosity/density.
 *
 *  2. Joule-Thomson cooling: CO2 expands as it enters the reservoir from the wellbore.
 *     Near-wellbore T drops by 5–15°C depending on rate and conditions. This can cause
 *     CO2 to cross into two-phase or solid regions near the well, increasing skin factor.
 *
 *  3. Heat diffusion: CO2 warms up within ~100 m of the wellbore as it equilibrates
 *     with the geothermal temperature of the rock.
 *
 * References:
 *  - Benson & Cole (2008) "CO2 Sequestration in Deep Sedimentary Formations"
 *  - Mathias et al. (2010) "Approximate solutions for pressure buildup during CO2 injection"
 *  - Ziabakhsh-Ganji & Kooi (2012) Joule-Thomson coefficients for CO2-brine
 */

export interface ThermalParams {
  surfaceTemperature_C: number      // T at surface (°C), typically 15–25
  geothermalGradient_CPerKm: number // dT/dz in °C/km, typically 25–35
  injectionTemperature_C: number    // wellhead injection T (°C)
  thermalDiffusivity_m2s: number    // reservoir rock thermal diffusivity (m²/s), typ 1e-6
}

export const DEFAULT_THERMAL: ThermalParams = {
  surfaceTemperature_C: 20,
  geothermalGradient_CPerKm: 30,
  injectionTemperature_C: 35,    // typical wellhead CO2 temp
  thermalDiffusivity_m2s: 1.0e-6,
}

/**
 * Reservoir temperature at a given depth (m).
 * T(z) = T_surface + gradient × z
 *
 * @param depth_m depth below surface (m, positive downward)
 * @param params  thermal parameters
 * @returns temperature in °C
 */
export function reservoirTemperature(depth_m: number, params: ThermalParams): number {
  return params.surfaceTemperature_C + params.geothermalGradient_CPerKm * (depth_m / 1000)
}

/**
 * Joule-Thomson temperature drop near the injection wellbore.
 *
 * The Joule-Thomson coefficient for CO2 near reservoir conditions is approximately
 * μ_JT = 0.5–1.5 K/MPa depending on T and P (Ziabakhsh-Ganji & Kooi 2012).
 * Temperature drop = μ_JT × (Pwellhead - Preservoir)
 *
 * This is a screening-level estimate. Use NIST REFPROP for rigorous values.
 *
 * @param wellheadPressure_MPa    injection pressure at wellhead (MPa)
 * @param reservoirPressure_MPa   initial reservoir pressure (MPa)
 * @param temperature_C           reservoir temperature (°C)
 * @returns temperature reduction at wellbore face (°C, negative = cooling)
 */
export function jouleThomstonCooling(
  wellheadPressure_MPa: number,
  reservoirPressure_MPa: number,
  temperature_C: number,
): number {
  const dP = Math.max(0, wellheadPressure_MPa - reservoirPressure_MPa)  // MPa

  // Approximate JT coefficient for CO2 at reservoir T:
  // At T < 50°C and P > 8 MPa (supercritical): μ_JT ≈ 0.5–0.8 K/MPa
  // At T > 100°C: μ_JT ≈ 0.3–0.5 K/MPa
  // Piecewise linear approximation (conservative screening estimate)
  const T = temperature_C
  const mu_JT = T < 50 ? 0.70 : T < 100 ? 0.50 : 0.35   // K/MPa

  return dP === 0 ? 0 : -mu_JT * dP  // negative = temperature reduction; guard against -0
}

/**
 * Radial temperature profile around injection well after time t.
 * Uses line-source heat-conduction solution (analytical):
 *
 *   ΔT(r, t) = ΔT₀ · erfc(r / (2 · √(α·t)))
 *
 * where ΔT₀ = injection T - reservoir T (negative = cooling)
 * and erfc is the complementary error function.
 *
 * @param r_m        radial distance from well (m)
 * @param t_years    injection duration (years)
 * @param dT0_C     initial temperature perturbation at wellbore (°C)
 * @param alpha      thermal diffusivity (m²/s)
 * @returns temperature perturbation at radius r (°C)
 */
export function radialTemperatureProfile(
  r_m: number,
  t_years: number,
  dT0_C: number,
  alpha: number,
): number {
  const t_s = t_years * 365.25 * 24 * 3600
  const arg = r_m / (2 * Math.sqrt(alpha * t_s))
  return dT0_C * erfc(arg)
}

/**
 * Complementary error function approximation (Abramowitz & Stegun 7.1.26).
 * Accuracy: |ε| < 1.5e-7 for all x ≥ 0.
 */
function erfc(x: number): number {
  if (x < 0) return 2 - erfc(-x)
  const t = 1 / (1 + 0.3275911 * x)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return poly * Math.exp(-x * x)
}

/**
 * Effective near-wellbore temperature accounting for JT cooling and thermal recovery.
 * Returns temperature in °C at radius r_m after t_years of injection.
 *
 * @param r_m                   radial distance (m)
 * @param t_years               injection duration (years)
 * @param depth_m               injection depth (m)
 * @param wellheadPressure_MPa  wellhead injection pressure (MPa)
 * @param reservoirPressure_MPa reservoir initial pressure (MPa)
 * @param params                thermal parameters
 */
export function effectiveTemperature(
  r_m: number,
  t_years: number,
  depth_m: number,
  wellheadPressure_MPa: number,
  reservoirPressure_MPa: number,
  params: ThermalParams,
): number {
  const T_res = reservoirTemperature(depth_m, params)
  const dT_JT = jouleThomstonCooling(wellheadPressure_MPa, reservoirPressure_MPa, T_res)

  // JT cooling is strongest at the wellbore face (r→0) and decays radially
  // Use radial heat diffusion to model spatial extent
  const dT_radial = radialTemperatureProfile(r_m, Math.max(t_years, 0.01), dT_JT, params.thermalDiffusivity_m2s)

  return T_res + dT_radial
}

/**
 * Check if CO2 is in supercritical state at given T and P.
 * CO2 critical point: Tc=304.13 K (31.0°C), Pc=7.38 MPa
 * Returns true if conditions are supercritical (T > Tc AND P > Pc).
 */
export function isCO2Supercritical(T_C: number, P_MPa: number): boolean {
  return T_C > 31.0 && P_MPa > 7.38
}

/**
 * Phase state of CO2 at given T and P for display purposes.
 */
export type CO2PhaseState = 'supercritical' | 'gas' | 'liquid' | 'near-critical'

export function co2PhaseState(T_C: number, P_MPa: number): CO2PhaseState {
  const T_K = T_C + 273.15
  if (Math.abs(T_K - 304.107) / 304.107 < 0.02 && Math.abs(P_MPa - 7.377) / 7.377 < 0.05) {
    return 'near-critical'
  }
  if (T_C > 31.0 && P_MPa > 7.38) return 'supercritical'
  if (P_MPa > 7.38) return 'liquid'
  return 'gas'
}
