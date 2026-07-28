/**
 * Gas-replacement volumetric storage capacity for depleted gas fields.
 *
 * Method: The CO2 storage volume equals the pore volume originally occupied
 * by gas at initial reservoir conditions. CO2 replaces gas at the target
 * injection pressure (MAIP, approximately equal to the initial reservoir
 * pressure for full re-pressurization). This is the standard industry
 * gas-replacement volumetric approach (Bachu et al. 2007; Orr 2009).
 *
 * Formula:
 *   PV_gas (m3) = GIIP_std x Bg_initial
 *   Bg_initial  = z_i x (T_res / P_res_initial) x (P_std / T_std)
 *   rho_CO2     = density at (T_res, P_res_initial) [injection target = MAIP ~ P_initial]
 *   Storage (kg) = PV_gas x rho_CO2 x fill_factor
 *   Storage (Mt) = Storage (kg) / 1e9
 *
 * CO2 DENSITY REFERENCE PRESSURE:
 *   Per Bachu et al. (2007) IJGGC 1(4):430-443, the CO2 mass stored is
 *   computed at the target injection pressure, which for a re-pressurization
 *   scenario equals the original reservoir pressure (P_res_initial). Using
 *   the abandonment pressure (P_abandon) instead gives gas-like CO2 at low
 *   density (~75 kg/m3 vs ~650 kg/m3 for Kasawari), dramatically
 *   underestimating mass storage capacity.
 *
 * FILL FACTORS (Bachu et al. 2007; Orr 2009; IEAGHG 2009):
 *   Fill factors account for residual gas saturation, sweep efficiency,
 *   heterogeneity and caprock geometry. They are lithology-dependent:
 *     Carbonate: P90=0.30, P50=0.50, P10=0.75
 *       (strong heterogeneity, fractures, wettability effects)
 *     Chalk: P90=0.25, P50=0.40, P10=0.65
 *       (highly compressible, low sweep efficiency)
 *     Sandstone / default: P90=0.40, P50=0.60, P10=0.85
 *       (well-sorted, high sweep efficiency)
 *
 * Standard conditions: P_std = 0.101325 MPa (1 atm), T_std = 293.15 K (20 degC)
 *
 * References:
 *   Bachu, S. et al. (2007) CO2 storage capacity estimation: Methodology
 *     and gaps. IJGGC 1(4), 430-443.
 *   Orr, F.M. (2009) CO2 capture and storage: are we ready? Energy &
 *     Environ. Sci. 2, 449-458.
 *   IEAGHG (2009) CO2 storage in depleted oilfields. Report 2009/12.
 */

import { co2DensityWithImpurities } from './pengrobin'

const P_STD_MPA = 0.101325  // standard pressure [MPa]
const T_STD_K   = 293.15    // standard temperature [K] (20 degC)

/**
 * Bg_initial: gas formation volume factor at initial reservoir conditions [m3res / m3std]
 * Uses z = 1 (acceptable for screening grade; +-5% error vs. Standing-Katz for CH4 at P < 30 MPa)
 */
export function gasFormationVolumeFactor(T_K: number, P_MPa: number): number {
  return (T_K / P_MPa) * (P_STD_MPA / T_STD_K)
}

export interface DepletedFieldCapacityResult {
  /** Pore volume originally occupied by gas [m3 reservoir] */
  gasFilledPV_m3: number
  /** CO2 density at initial reservoir conditions (injection target pressure) [kg/m3] */
  co2DensityAtInjectionTarget: number
  /** Storage capacity at P50 estimate [Mt] */
  storageMt: number
  /** Storage capacity at P90 (conservative) [Mt] */
  storageP90_Mt: number
  /** Storage capacity at P10 (optimistic) [Mt] */
  storageP10_Mt: number
  /** Bg at initial conditions [m3res/m3std] */
  bg_initial: number
  /** Method label for UI */
  method: string
  /**
   * @deprecated Use co2DensityAtInjectionTarget. Kept for backward compatibility.
   * This field now returns density at P_res_initial (not P_abandon) per Bachu 2007 fix.
   */
  co2DensityAbandonment: number
}

/**
 * Compute CO2 storage capacity for a depleted gas field using the
 * gas-replacement volumetric method.
 *
 * @param giip_Bcm          Gas Initially In Place [Bcm = 10^9 m3 at standard conditions]
 * @param T_res_K           Reservoir temperature [K]
 * @param P_res_initial_MPa Initial (pre-depletion) reservoir pressure [MPa] — used for Bg AND CO2 density
 * @param P_abandon_MPa     Abandonment pressure at start of CO2 injection [MPa] — not used for density (see note above)
 * @param fillFactor_P50    Override P50 fill factor (ignored when lithologyClass is provided)
 * @param methaneFraction   CH4 mole fraction in CO2 stream (0-1, default 0)
 * @param nitrogenFraction  N2 mole fraction in CO2 stream (0-1, default 0)
 * @param lithologyClass    Reservoir matrix type governs fill factors (carbonate / chalk / sandstone)
 */
export function computeDepletedFieldCapacity(
  giip_Bcm: number,
  T_res_K: number,
  P_res_initial_MPa: number,
  P_abandon_MPa: number,
  fillFactor_P50 = 0.60,
  methaneFraction = 0,
  nitrogenFraction = 0,
  lithologyClass?: 'sandstone' | 'carbonate' | 'chalk',
): DepletedFieldCapacityResult {
  const giip_m3std = giip_Bcm * 1e9

  // Bg at initial reservoir conditions (gas expansion from reservoir to surface)
  const bg_initial = gasFormationVolumeFactor(T_res_K, P_res_initial_MPa)
  const gasFilledPV_m3 = giip_m3std * bg_initial

  // CO2 density at the INJECTION TARGET pressure = P_res_initial (MAIP ~ re-pressurization to original P).
  // Per Bachu et al. (2007): storage mass = PV x rho_CO2(T, P_injection_target) x fill_factor.
  // Using P_abandon here would give gas-like CO2 (~75 kg/m3) instead of dense supercritical
  // CO2 (~650 kg/m3), underestimating mass capacity by up to 8x for deep reservoirs.
  const rho_co2 = co2DensityWithImpurities(
    T_res_K,
    P_res_initial_MPa * 1e6,
    methaneFraction,
    nitrogenFraction,
  )

  // Fill factors by lithology class (Bachu et al. 2007; IEAGHG 2009 Report 2009/12)
  // Carbonate reservoirs: stronger heterogeneity, fracture networks and wettability
  // reduce effective sweep vs. sandstone.
  const fills = lithologyClass === 'carbonate'
    ? { p90: 0.30, p50: 0.50, p10: 0.75 }
    : lithologyClass === 'chalk'
    ? { p90: 0.25, p50: 0.40, p10: 0.65 }
    : { p90: 0.40, p50: fillFactor_P50, p10: 0.85 }

  const storageMt      = gasFilledPV_m3 * fills.p50 * rho_co2 / 1e9
  const storageP90_Mt  = gasFilledPV_m3 * fills.p90 * rho_co2 / 1e9
  const storageP10_Mt  = gasFilledPV_m3 * fills.p10 * rho_co2 / 1e9

  return {
    gasFilledPV_m3,
    co2DensityAtInjectionTarget: rho_co2,
    co2DensityAbandonment: rho_co2,  // backward-compat alias (now equals injection-target density)
    storageMt,
    storageP90_Mt,
    storageP10_Mt,
    bg_initial,
    method: 'Gas-replacement volumetric (Bachu et al. 2007); rho at P_initial per MAIP assumption',
  }
}
