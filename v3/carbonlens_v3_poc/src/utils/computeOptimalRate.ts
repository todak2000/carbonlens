import type { FormationParams, Well } from '../types'
import { co2DensitySpanWagner } from '../engine'
import { cumulativeInjection } from './gridParser'

export interface RateEnvelope {
  optimalRate: number   // P50 DOE — target rate per well (Mt/yr)
  minRate: number       // P10 DOE — lower bound; below this, formation is under-utilised
  maxRate: number       // P90 DOE — upper bound; beyond this, overpressure risk
  totalCapacityP50: number  // Mt
  totalCapacityP10: number  // Mt
  totalCapacityP90: number  // Mt
}

/**
 * Derive per-well optimal/min/max injection rates such that the total
 * cumulative injection over `projectYears` matches the DOE P50 (optimal),
 * P10 (lower bound), and P90 (upper bound) storage capacities.
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
  const rhoCO2 = co2DensitySpanWagner(T_K, params.pressure * 1e6)
  const A = params.area * 1e6       // m²
  const totalPoreVolume = A * params.thickness * params.netToGross * params.porosity  // m³

  const totalCapacityP10 = totalPoreVolume * 0.0051 * rhoCO2 / 1e9  // Mt
  const totalCapacityP50 = totalPoreVolume * 0.0200 * rhoCO2 / 1e9  // Mt
  const totalCapacityP90 = totalPoreVolume * 0.0550 * rhoCO2 / 1e9  // Mt

  const nWells = Math.max(1, wells.length)

  // Use average ramp-up/down across wells (representative schedule)
  const avgRampUp   = wells.reduce((s, w) => s + w.rampUpYears,   0) / nWells || 5
  const avgRampDown = wells.reduce((s, w) => s + w.rampDownYears, 0) / nWells || 10

  // Effective injected Mt per Mt/yr of rate for one well over project lifetime
  const unitCum = cumulativeInjection(1, projectYears, avgRampUp, avgRampDown, projectYears)
  const safeUnitCum = Math.max(unitCum, 0.001)

  return {
    optimalRate:        totalCapacityP50 / (nWells * safeUnitCum),
    minRate:            totalCapacityP10 / (nWells * safeUnitCum),
    maxRate:            totalCapacityP90 / (nWells * safeUnitCum),
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
  exceeds_max: { label: 'Exceeds P90 — overpressure risk',       color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
  high:        { label: 'Above optimal — approaching P90 limit', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  optimal:     { label: 'Near optimal (DOE P50)',                 color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  low:         { label: 'Below optimal — formation under-used',   color: '#facc15', bg: 'rgba(250,204,21,0.10)' },
  below_min:   { label: 'Below P10 — very low utilisation',       color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
}
