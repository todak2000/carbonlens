/**
 * Kinetic mineral trapping model.
 *
 * Over centuries to millennia, CO2-saturated brine reacts with formation
 * minerals (feldspars, carbonates, iron oxides) to precipitate solid carbonate
 * minerals (calcite, dawsonite, siderite), permanently locking carbon.
 *
 * This simplified kinetic model captures the long-timescale behaviour without
 * a full geochemical solver. Rate constants are calibrated to match published
 * field-scale estimates (e.g. Xu et al. 2004, Zerai et al. 2006).
 */

import { LithologyType } from '../../types/geological'

/** Mineral trapping rate constant (fraction of dissolved CO2 per year) */
const MINERAL_RATE: Partial<Record<LithologyType, number>> = {
  arkosic_sandstone: 0.0020,   // high — feldspar reacts readily
  limestone:         0.0018,   // high — calcite dissolution/reprecipitation
  sandstone:         0.0008,   // moderate — quartz-dominant, slow reaction
  dolomite:          0.0012,   // moderate
  chalk:             0.0006,   // low — fine-grained, limited reactive surface
  siltstone:         0.0003,   // low
  shale:             0.0001,   // very low — already partially altered
  anhydrite:         0.0000,   // none
}

const DEFAULT_MINERAL_RATE = 0.0005  // fallback for unlisted lithologies

/**
 * Get the mineral trapping rate for a lithology.
 * Only active after CO2 has been dissolved long enough to acidify the brine.
 *
 * @param lithology  Rock type
 * @param temperature_C  Reservoir temperature (higher T → faster kinetics)
 */
export function getMineralRate(lithology: LithologyType, temperature_C: number): number {
  const base = MINERAL_RATE[lithology] ?? DEFAULT_MINERAL_RATE
  // Arrhenius-like temperature correction: doubles every ~20°C around 60°C
  const T_ref = 60
  const T_factor = Math.exp(0.035 * (temperature_C - T_ref))
  return base * T_factor
}

/**
 * Apply one year of mineral trapping to a dissolved CO2 fraction.
 *
 * @param Sg_dissolved   Current dissolved CO2 saturation fraction
 * @param lithology      Rock type of this cell
 * @param temperature_C  Reservoir temperature
 * @param year           Simulation year (trapping only begins meaningfully after year 100)
 * @returns              Amount of dissolved CO2 converted to mineral phase this step
 */
export function applyMineralTrapping(
  Sg_dissolved: number,
  lithology: LithologyType,
  temperature_C: number,
  year: number,
): number {
  if (year < 50 || Sg_dissolved <= 0) return 0  // not active in early phase

  // Ramp up: grows from year 50 to year 200 to allow solubility trapping to establish first
  const ramp = Math.min(1, (year - 50) / 150)
  const rate = getMineralRate(lithology, temperature_C) * ramp

  // Precipitated per timestep (capped at 50% of remaining dissolved per step)
  return Math.min(Sg_dissolved * 0.50, Sg_dissolved * rate)
}

/**
 * Cumulative mineral trapping fraction at a given year.
 * Used for analytics display (not the per-cell solver).
 */
export function cumulativeMineralFraction(
  lithology: LithologyType,
  temperature_C: number,
  year: number,
): number {
  if (year < 50) return 0
  const rate = getMineralRate(lithology, temperature_C)
  // Approximate integrated fraction (1 - exp(-rate × effective_years))
  const effectiveYears = Math.max(0, year - 50)
  return 1 - Math.exp(-rate * effectiveYears)
}
