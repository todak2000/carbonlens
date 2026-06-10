/**
 * Peaceman Well Model — CO2 injection wellbore pressure and flow
 * Peaceman (1978) "Interpretation of Well-Block Pressures in Numerical Reservoir Simulation"
 * SPE-6893-PA. For CO2 storage screening.
 *
 * Computes:
 *   1. Bottomhole flowing pressure (BHP) from surface injection rate
 *   2. Equivalent wellbore radius (Peaceman r_eq) for grid-cell injection
 *   3. Near-wellbore pressure drawdown profile
 *   4. Injectivity index (J, m³/day/MPa)
 */

export interface WellboreParams {
  wellRadius_m: number        // wellbore radius (m), default 0.1 m
  skinFactor: number          // dimensionless skin (0 = undamaged, +5 = damaged, -3 = stimulated)
  perforationInterval_m: number // perforated length (m)
  surfacePressure_MPa: number  // wellhead injection pressure (MPa)
}

export const DEFAULT_WELLBORE: WellboreParams = {
  wellRadius_m: 0.1,
  skinFactor: 0,
  perforationInterval_m: 30,
  surfacePressure_MPa: 15,
}

export interface WellboreResult {
  bhp_MPa: number             // bottomhole flowing pressure (MPa)
  injectivityIndex_m3dMPa: number  // J = q/(Pbhp - Pr) in m³/(d·MPa)
  peacemanRadius_m: number    // equivalent radius r_eq = 0.2·dx for square cells
  pressureDropWellbore_MPa: number  // ΔP across near-wellbore skin zone
  maxSustainableRate_MtPerYear: number  // rate at fracture pressure limit
}

/**
 * Peaceman equivalent radius for a square grid cell of width dx (m).
 * r_eq = 0.1982 * dx (Peaceman 1978, square grid)
 */
export function peacemanRadius(dx_m: number): number {
  return 0.1982 * dx_m
}

/**
 * Wellbore injectivity index (Darcy's Law, radial flow).
 * J = 2π·k·h / (μ · (ln(re/rw) + S))  [m³/(s·Pa)]
 *
 * @param k_mD       horizontal permeability (mD)
 * @param h_m        perforated interval (m)
 * @param mu_Pas     CO2 viscosity (Pa·s)
 * @param re_m       drainage radius (m) — use peacemanRadius(dx)
 * @param rw_m       wellbore radius (m)
 * @param skin       skin factor (dimensionless)
 */
export function injectivityIndex(
  k_mD: number,
  h_m: number,
  mu_Pas: number,
  re_m: number,
  rw_m: number,
  skin: number,
): number {
  const k_m2 = k_mD * 9.869233e-16   // mD → m²
  const lnTerm = Math.log(re_m / Math.max(rw_m, 0.001)) + skin
  if (lnTerm <= 0) return 0
  return (2 * Math.PI * k_m2 * h_m) / (mu_Pas * lnTerm)  // m³/(s·Pa)
}

/**
 * Bottomhole pressure from surface injection rate.
 * BHP = Pr + q/J (linear Darcy approximation)
 * where Pr is reservoir pressure and q is volumetric rate.
 *
 * @param reservoirPressure_MPa  initial reservoir pressure (MPa)
 * @param injectionRate_MtPerYear injection mass rate (Mt/year)
 * @param co2Density_kgm3       CO2 density at reservoir conditions (kg/m³)
 * @param J_m3sPa               injectivity index (m³/(s·Pa))
 * @returns BHP in MPa
 */
export function bottomholePressure(
  reservoirPressure_MPa: number,
  injectionRate_MtPerYear: number,
  co2Density_kgm3: number,
  J_m3sPa: number,
): number {
  const qMass_kgPerSec = injectionRate_MtPerYear * 1e9 / (365.25 * 24 * 3600)
  const qVol_m3PerSec = qMass_kgPerSec / Math.max(co2Density_kgm3, 1)
  const dP_Pa = J_m3sPa > 0 ? qVol_m3PerSec / J_m3sPa : 0
  return reservoirPressure_MPa + dP_Pa * 1e-6  // Pa → MPa
}

/**
 * Maximum sustainable injection rate before hydraulic fracture.
 * Uses fracture pressure = lithostatic gradient × depth.
 * Typical fracture gradient: 0.018–0.023 MPa/m (sandstone–carbonate).
 *
 * @param k_mD         permeability (mD)
 * @param h_m          perforated interval (m)
 * @param mu_Pas       viscosity (Pa·s)
 * @param re_m         drainage radius (m)
 * @param rw_m         wellbore radius (m)
 * @param skin         skin factor
 * @param Pr_MPa       reservoir pressure (MPa)
 * @param Pfrac_MPa    fracture pressure (MPa) = fracGrad × depth
 * @param co2Density   CO2 density (kg/m³)
 */
export function maxInjectionRate(
  k_mD: number,
  h_m: number,
  mu_Pas: number,
  re_m: number,
  rw_m: number,
  skin: number,
  Pr_MPa: number,
  Pfrac_MPa: number,
  co2Density_kgm3: number,
): number {
  const J = injectivityIndex(k_mD, h_m, mu_Pas, re_m, rw_m, skin)
  const dP_Pa = Math.max(0, Pfrac_MPa - Pr_MPa) * 1e6
  const qVol_m3PerSec = J * dP_Pa
  const qMass_kgPerSec = qVol_m3PerSec * co2Density_kgm3
  return qMass_kgPerSec * 365.25 * 24 * 3600 / 1e9  // kg/s → Mt/year
}

/**
 * Full wellbore diagnostics for a single injection well.
 */
export function computeWellboreDiagnostics(
  params: WellboreParams,
  k_mD: number,
  cellWidth_m: number,
  mu_Pas: number,
  reservoirPressure_MPa: number,
  injectionRate_MtPerYear: number,
  co2Density_kgm3: number,
  depth_m: number,
  fracGradient_MPaPerM: number = 0.018,
): WellboreResult {
  const re_m = peacemanRadius(cellWidth_m)
  const J_m3sPa = injectivityIndex(
    k_mD, params.perforationInterval_m, mu_Pas, re_m, params.wellRadius_m, params.skinFactor
  )
  const bhp = bottomholePressure(reservoirPressure_MPa, injectionRate_MtPerYear, co2Density_kgm3, J_m3sPa)
  const Pfrac = fracGradient_MPaPerM * depth_m
  const qMax = maxInjectionRate(
    k_mD, params.perforationInterval_m, mu_Pas, re_m, params.wellRadius_m,
    params.skinFactor, reservoirPressure_MPa, Pfrac, co2Density_kgm3
  )

  // Pressure drop in near-wellbore skin zone (MPa)
  const qMass_kgPerSec = injectionRate_MtPerYear * 1e9 / (365.25 * 24 * 3600)
  const qVol_m3PerSec = qMass_kgPerSec / Math.max(co2Density_kgm3, 1)
  const dP_skin_Pa = J_m3sPa > 0 ? (qVol_m3PerSec / J_m3sPa) * params.skinFactor / Math.max(1, Math.log(re_m / params.wellRadius_m)) : 0

  // J in m³/(day·MPa) for display
  const J_m3dMPa = J_m3sPa * 86400 * 1e6

  return {
    bhp_MPa: Math.min(bhp, Pfrac),
    injectivityIndex_m3dMPa: J_m3dMPa,
    peacemanRadius_m: re_m,
    pressureDropWellbore_MPa: Math.abs(dP_skin_Pa) * 1e-6,
    maxSustainableRate_MtPerYear: qMax,
  }
}
