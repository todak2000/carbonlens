/**
 * Gas-replacement volumetric storage capacity for depleted gas fields.
 *
 * Method: The CO₂ storage volume equals the pore volume originally occupied
 * by gas at initial reservoir conditions. CO₂ replaces gas at abandonment
 * pressure (or up to MAIP). This is the standard industry gas-replacement
 * volumetric approach (Bachu et al. 2007; Orr 2009).
 *
 * Formula:
 *   PV_gas (m³) = GIIP_std × Bg_initial
 *   Bg_initial  = z_i × (T_res / P_res_initial) × (P_std / T_std)
 *   Storage (kg) = PV_gas × ρ_CO2(T_res, P_abandon)
 *   Storage (Mt) = Storage (kg) / 1e9
 *
 * With z≈1 (valid for methane at moderate conditions) and SI units:
 *   P_std = 0.101325 MPa, T_std = 293.15 K
 *
 * References:
 *   Bachu, S. et al. (2007) CO2 storage capacity estimation: Methodology
 *     and gaps. IJGGC 1(4), 430–443.
 *   Orr, F.M. (2009) CO2 capture and storage: are we ready? Energy &
 *     Environ. Sci. 2, 449–458.
 */

import { co2DensitySpanWagner } from './density'

const P_STD_MPA = 0.101325  // standard pressure [MPa]
const T_STD_K   = 293.15    // standard temperature [K]

/**
 * Bg_initial: gas formation volume factor at initial reservoir conditions [m³res / m³std]
 * Uses z≈1 (acceptable for screening grade; ±5% error vs. Standing-Katz for CH4 @ P<30 MPa)
 */
export function gasFormationVolumeFactor(T_K: number, P_MPa: number): number {
  return (T_K / P_MPa) * (P_STD_MPA / T_STD_K)
}

export interface DepletedFieldCapacityResult {
  /** Pore volume originally occupied by gas [m³ reservoir] */
  gasFilledPV_m3: number
  /** CO₂ density at abandonment conditions [kg/m³] */
  co2DensityAbandonment: number
  /** Storage capacity — P50 estimate [Mt] */
  storageMt: number
  /** Storage capacity — P10 (conservative, 75% fill) [Mt] */
  storageP10_Mt: number
  /** Storage capacity — P90 (optimistic, full pore volume) [Mt] */
  storageP90_Mt: number
  /** Bg at initial conditions [m³res/m³std] */
  bg_initial: number
  /** Method label for UI */
  method: string
}

/**
 * Compute CO₂ storage capacity for a depleted gas field using the
 * gas-replacement volumetric method.
 *
 * @param giip_Bcm          Gas Initially In Place [Bcm = 10⁹ m³ at standard conditions]
 * @param T_res_K           Reservoir temperature [K]
 * @param P_res_initial_MPa Initial (pre-depletion) reservoir pressure [MPa]
 * @param P_abandon_MPa     Abandonment pressure — CO₂ injection brings this back up [MPa]
 * @param fillFactor_P50    Fraction of gas-filled PV that CO₂ can realistically occupy (default 0.85)
 */
export function computeDepletedFieldCapacity(
  giip_Bcm: number,
  T_res_K: number,
  P_res_initial_MPa: number,
  P_abandon_MPa: number,
  fillFactor_P50 = 0.85,
): DepletedFieldCapacityResult {
  const giip_m3std = giip_Bcm * 1e9

  const bg_initial = gasFormationVolumeFactor(T_res_K, P_res_initial_MPa)
  const gasFilledPV_m3 = giip_m3std * bg_initial

  // CO₂ density at abandonment pressure (injection pressure will re-pressurise up to P_abandon)
  const rho_co2 = co2DensitySpanWagner(T_res_K, P_abandon_MPa * 1e6)

  const storageMt      = gasFilledPV_m3 * fillFactor_P50 * rho_co2 / 1e9
  const storageP10_Mt  = gasFilledPV_m3 * 0.60 * rho_co2 / 1e9
  const storageP90_Mt  = gasFilledPV_m3 * 1.00 * rho_co2 / 1e9

  return {
    gasFilledPV_m3,
    co2DensityAbandonment: rho_co2,
    storageMt,
    storageP10_Mt,
    storageP90_Mt,
    bg_initial,
    method: 'Gas-replacement volumetric (Bachu et al. 2007)',
  }
}
