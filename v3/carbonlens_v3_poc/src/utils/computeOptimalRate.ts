import type { FormationParams, Well } from '../types'
import { co2DensityWithImpurities, computeDepletedFieldCapacity } from '../engine'
import { cumulativeInjection } from './gridParser'

export interface RateEnvelope {
  optimalRate: number   // P50 DOE — target rate per well (Mt/yr)
  minRate: number       // P90 (conservative) lower bound — below this, formation is under-utilised
  maxRate: number       // P10 (optimistic) upper bound — beyond this, overpressure risk
  totalCapacityP50: number  // Mt — expected capacity (50% exceedance)
  totalCapacityP10: number  // Mt — optimistic capacity (10% exceedance, HIGH)
  totalCapacityP90: number  // Mt — conservative capacity (90% exceedance, LOW)
}

/**
 * Derive per-well optimal/min/max injection rates such that the total
 * cumulative injection over `projectYears` matches DOE capacity estimates.
 *
 * DOE exceedance probability convention (Goodman 2011):
 *   P90 = 90% exceedance = conservative/low (Cc = 0.0051)  → minRate
 *   P50 = 50% exceedance = expected        (Cc = 0.0200)  → optimalRate
 *   P10 = 10% exceedance = optimistic/high (Cc = 0.0550)  → maxRate
 *
 * Because cumulativeInjection is linear in `rate`, we solve directly:
 *   optimalRate = P50_capacity / (nWells × cumulativeAtUnitRate)
 */
export function computeOptimalRate(
  params: FormationParams,
  wells: Well[],
  projectYears: number,
): RateEnvelope {
  const T_K = params.temperature + 273.15

  // Route capacity calculation by formation type — must match useSimulation.ts
  const isDepletedField = params.formationType === 'depleted_gas' || params.formationType === 'depleted_oil'
  let totalCapacityP10: number
  let totalCapacityP50: number
  let totalCapacityP90: number

  if (isDepletedField && params.giip != null && params.abandonmentPressure != null) {
    // Gas-replacement volumetric (Bachu et al. 2007): area changes do NOT affect capacity.
    // fillFactor_P50=0.60 and lithologyClass must match useSimulation.ts to keep all three
    // capacity sources (panel, rateEnv, sim) consistent (checked by capacityConsistencyAudit).
    const dep = computeDepletedFieldCapacity(
      params.giip, T_K, params.pressure, params.abandonmentPressure,
      0.60, params.methaneFraction, params.nitrogenFraction, params.lithologyClass,
    )
    totalCapacityP90 = dep.storageP90_Mt   // conservative (carbonate 30%, sandstone 40%)
    totalCapacityP50 = dep.storageMt        // expected    (carbonate 50%, sandstone 60%)
    totalCapacityP10 = dep.storageP10_Mt    // optimistic  (carbonate 75%, sandstone 85%)
  } else {
    // DOE Goodman 2011 saline aquifer — gross pore volume (no NTG, matching useSimulation)
    const rhoCO2 = co2DensityWithImpurities(T_K, params.pressure * 1e6, params.methaneFraction, params.nitrogenFraction)
    const A = params.area * 1e6       // m²
    const totalPoreVolume = A * params.thickness * params.porosity  // m³ (gross, no NTG)
    totalCapacityP90 = totalPoreVolume * 0.0051 * rhoCO2 / 1e9  // conservative (90% exceedance)
    totalCapacityP50 = totalPoreVolume * 0.0200 * rhoCO2 / 1e9  // expected   (50% exceedance)
    totalCapacityP10 = totalPoreVolume * 0.0550 * rhoCO2 / 1e9  // optimistic (10% exceedance)
  }

  const nWells = Math.max(1, wells.length)

  // Use average ramp-up/down across wells (representative schedule)
  const avgRampUp   = wells.reduce((s, w) => s + w.rampUpYears,   0) / nWells || 5
  const avgRampDown = wells.reduce((s, w) => s + w.rampDownYears, 0) / nWells || 10

  // Effective injected Mt per Mt/yr of rate for one well over project lifetime
  const unitCum = cumulativeInjection(1, projectYears, avgRampUp, avgRampDown, projectYears)
  const safeUnitCum = Math.max(unitCum, 0.001)

  return {
    optimalRate:        totalCapacityP50 / (nWells * safeUnitCum),
    // P90 (conservative, low Cc) → lower rate bound; P10 (optimistic, high Cc) → upper rate bound
    minRate:            totalCapacityP90 / (nWells * safeUnitCum),
    maxRate:            totalCapacityP10 / (nWells * safeUnitCum),
    totalCapacityP50,
    totalCapacityP10,
    totalCapacityP90,
  }
}

export type RateStatus = 'below_min' | 'low' | 'optimal' | 'high' | 'exceeds_max'

/** Classify where `rate` sits relative to the envelope. */
export function classifyRate(rate: number, env: RateEnvelope): RateStatus {
  if (rate > env.maxRate)                         return 'exceeds_max'
  if (rate > env.optimalRate * 1.2)               return 'high'
  if (rate >= env.optimalRate * 0.8)              return 'optimal'
  if (rate >= env.minRate)                        return 'low'
  return 'below_min'
}

export const RATE_STATUS_META: Record<RateStatus, { label: string; color: string; bg: string }> = {
  exceeds_max: { label: 'Above P10 limit — overpressure risk',       color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
  high:        { label: 'Above optimal — approaching P10 limit',     color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  optimal:     { label: 'Near optimal (DOE P50)',                     color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  low:         { label: 'Below optimal — formation under-used',       color: '#facc15', bg: 'rgba(250,204,21,0.10)' },
  below_min:   { label: 'Below P90 conservative — very low utilisation', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
}
