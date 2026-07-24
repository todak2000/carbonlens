/**
 * Formation Physics Regime Classifier
 * =====================================
 *
 * Classifies a CO2 storage formation into one of four flow regimes based on
 * permeability, injectivity, and screening results. The regime determines which
 * simulation model is valid and which primary validation metric should be used.
 *
 * Regime thresholds (literature basis):
 *   k >= 100 mD AND II >= 1 kg/(s·MPa):   BUOYANCY_DOMINATED — VE model valid
 *   20 <= k < 100 mD OR 0.1 <= II < 1:    MIXED — VE valid with expanded uncertainty
 *   k < 20 mD OR II < 0.1:                PRESSURE_DOMINATED — VE invalid; use Theis BHP
 *   maxSafeRate < targetRate:              INJECTIVITY_LIMITED — rate cap applied
 *
 * References:
 *   Nordbotten & Celia (2006) WRR 42:W01407 — VE validity domain (buoyancy vs viscous)
 *   NETL (2015) DOE/NETL-2015/1632 — injectivity index criteria
 *   Bachu (2003) Environ. Geol. 44:277 — permeability thresholds for storage screening
 *   Chadwick et al. (2008) BGS OPN14 — practical VE applicability
 */

import type { FormationParams } from '../../types'
import { assessStorageScreening } from './storageScreening'
import type { StorageScreeningResult } from './storageScreening'

export type RegimeType =
  | 'BUOYANCY_DOMINATED'
  | 'MIXED'
  | 'PRESSURE_DOMINATED'
  | 'INJECTIVITY_LIMITED'

export type PrimaryMetric = 'plume_radius' | 'bhp_buildup' | 'injectivity_index'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_APPLICABLE'

export interface FormationRegime {
  /** Physics flow regime classification */
  type: RegimeType
  /** Whether the VE gravity-current model is physically valid for this formation */
  veIsValid: boolean
  /** Which metric should be the primary validation target */
  primaryMetric: PrimaryMetric
  /**
   * Model confidence given permeability range and calibration status.
   * HIGH   = k >= 500 mD, buoyancy-dominated, well within VE validity domain
   * MEDIUM = k 50-500 mD, buoyancy-dominated but approaching transition
   * LOW    = k 20-50 mD, MIXED regime — VE result has ±30% uncertainty
   * NOT_APPLICABLE = k < 20 mD or II < 0.1 — VE model should not be used
   */
  confidence: ConfidenceLevel
  /**
   * Maximum safe injection rate computed from Darcy injectivity index × max delta-P.
   * Delta-P_max = 0.90 × fracture_gradient × depth − initial_pressure.
   * Units: Mt/yr.
   */
  maxSafeRate_Mtyr: number
  /** True when maxSafeRate < targetRate (formation cannot accept the full target injection) */
  injectivityLimited: boolean
  /**
   * Effective rate to use in simulations: min(targetRate, maxSafeRate).
   * Equals targetRate when not injectivity-limited.
   */
  effectiveRate_Mtyr: number
  /**
   * Human-readable warning message for UI banners and report headers.
   * Empty string for BUOYANCY_DOMINATED (no warning needed).
   */
  warningBanner: string
  /** Default permeability value to use in VE formula (same as formation k) */
  kEffDefault_mD: number
  /** Pass-through of the Bachu (2003) 10-criterion screening score (0-100) */
  screeningScore: number
  /** Criterion IDs that returned red (failed) status from storage screening */
  failedCriteria: string[]
  /** Criterion IDs that returned amber (marginal) status from storage screening */
  amberCriteria: string[]
}

/**
 * Compute the maximum safe injection rate from Darcy radial injectivity.
 *
 * Uses the injectivity index already computed by the screening engine (criterion #10):
 *   II = k_m2 * h_m / (mu_CO2 * ln(re/rw))   [m³/(s·Pa)] converted to kg/(s·MPa)
 *
 * Max delta-P before fracture is limited to 90% of fracture gradient minus initial pressure:
 *   fracture_P ≈ 0.016 MPa/m × depth (conservative extensional gradient)
 *   delta_P_max = 0.90 × fracture_P − P_initial
 *
 * Returns max safe rate in Mt/yr. Returns Infinity when II is very large (no practical limit).
 */
function computeMaxSafeRate(
  II_kg_s_MPa: number,
  depth_m: number,
  P_initial_MPa: number,
): number {
  const fracture_P_MPa = 0.016 * depth_m                     // ~16 MPa at 1 km, typical extension
  const delta_P_max = Math.max(0, fracture_P_MPa * 0.90 - P_initial_MPa)
  if (delta_P_max <= 0) return 0
  const max_kg_s = II_kg_s_MPa * delta_P_max                 // kg/s
  const max_Mt_yr = max_kg_s * 3.156e7 / 1e9                 // convert to Mt/yr
  return max_Mt_yr
}

/**
 * Classify a formation into a physics flow regime.
 *
 * Reads from the existing screening result where possible to avoid recomputing.
 * If no screening result is provided, it is computed fresh from params.
 *
 * @param params         Formation parameters (depth, thickness, k, phi, P, T, area)
 * @param targetRate_Mtyr Target injection rate (Mt/yr) from the simulation scenario
 * @param screeningResult Optional pre-computed StorageScreeningResult to avoid redundant work
 */
export function classifyFormationRegime(
  params: FormationParams,
  targetRate_Mtyr: number,
  screeningResult?: StorageScreeningResult,
): FormationRegime {
  const screening = screeningResult ?? assessStorageScreening(params)

  // Read values directly from screening criteria (no recomputation)
  const permCriterion    = screening.criteria.find((c) => c.id === 'permeability')
  const injectCriterion  = screening.criteria.find((c) => c.id === 'injectivity')
  const k_mD  = permCriterion?.yourValue   ?? params.permeability
  const II     = injectCriterion?.yourValue ?? 0

  const failedCriteria = screening.criteria.filter((c) => c.status === 'red').map((c)  => c.id)
  const amberCriteria  = screening.criteria.filter((c) => c.status === 'amber').map((c) => c.id)

  // Maximum safe injection rate
  const maxSafeRate_Mtyr     = computeMaxSafeRate(II, params.depth, params.pressure)
  const injectivityLimited   = maxSafeRate_Mtyr > 0 && maxSafeRate_Mtyr < targetRate_Mtyr * 0.95
  const effectiveRate_Mtyr   = injectivityLimited
    ? Math.max(0.001, maxSafeRate_Mtyr)
    : targetRate_Mtyr

  // Classify flow regime
  let type: RegimeType
  let confidence: ConfidenceLevel
  let veIsValid: boolean
  let primaryMetric: PrimaryMetric
  let warningBanner: string

  if (k_mD < 20 || II < 0.1) {
    type          = 'PRESSURE_DOMINATED'
    veIsValid     = false
    primaryMetric = 'bhp_buildup'
    confidence    = 'NOT_APPLICABLE'
    warningBanner =
      `VE MODEL NOT VALID: Formation permeability (k = ${k_mD.toFixed(0)} mD) is below the ` +
      `buoyancy-dominated flow threshold. At k < 20 mD viscous pressure forces dominate over ` +
      `gravity-driven spreading. The VE plume radius is not meaningful for this formation. ` +
      `Primary validation metric: BHP and pressure buildup at the injection well. ` +
      `Reference: Nordbotten & Celia (2006) WRR 42:W01407.`
  } else if (k_mD < 100 || (II >= 0.1 && II < 1.0)) {
    type          = 'MIXED'
    veIsValid     = true
    primaryMetric = 'plume_radius'
    confidence    = 'LOW'
    warningBanner =
      `MIXED FLOW REGIME: Formation permeability (k = ${k_mD.toFixed(0)} mD) is in the transitional ` +
      `zone between buoyancy-dominated and pressure-dominated flow. The VE model is applicable but ` +
      `carries expanded uncertainty (±30% on radius). Pressure buildup is also a meaningful ` +
      `secondary validation metric for this formation.`
  } else {
    type          = 'BUOYANCY_DOMINATED'
    veIsValid     = true
    primaryMetric = 'plume_radius'
    confidence    = k_mD >= 500 ? 'HIGH' : 'MEDIUM'
    warningBanner = ''
  }

  // Injectivity limit takes precedence over regime type when severe (>50% rate shortfall)
  if (injectivityLimited && effectiveRate_Mtyr < targetRate_Mtyr * 0.5) {
    type          = 'INJECTIVITY_LIMITED'
    primaryMetric = 'injectivity_index'
    warningBanner =
      `INJECTIVITY LIMITED: The target injection rate (${targetRate_Mtyr.toFixed(2)} Mt/yr) exceeds ` +
      `the maximum safe rate (${maxSafeRate_Mtyr.toFixed(3)} Mt/yr) at 90% of the fracture gradient. ` +
      `Simulation runs at the capped rate. To achieve the target rate: add injection wells, use ` +
      `horizontal completions, or reduce the injection rate per well. ` +
      `Injectivity Index: ${II.toFixed(2)} kg/(s·MPa).`
  }

  return {
    type,
    veIsValid,
    primaryMetric,
    confidence,
    maxSafeRate_Mtyr,
    injectivityLimited,
    effectiveRate_Mtyr,
    warningBanner,
    kEffDefault_mD: k_mD,
    screeningScore: screening.score,
    failedCriteria,
    amberCriteria,
  }
}
