/**
 * Brooks-Corey relative permeability functions for CO2/brine system.
 * Standard for CO2 storage; used in industry reservoir simulation workflows.
 *
 * Drainage (CO2 entering):   k_r_gas  = k_r_max × ((Sg - Sgr) / (1 - Swi - Sgr))^n
 * Imbibition (brine re-entry): k_r_gas falls on lower curve per Land model (see landTrapping.ts)
 */

// ── Default endpoint parameters (can be overridden per lithology) ────────────
export interface BrooksCoreyParams {
  /** Residual gas (CO2) saturation — below this k_r_gas = 0 (capillary trapped) */
  Sgr: number
  /** Irreducible water saturation — maximum possible CO2 saturation = 1 - Swi */
  Swi: number
  /** Corey exponent for gas phase (2–3 for CO2/brine, use 2 for all lithologies) */
  n_gas: number
  /** Maximum gas relative permeability endpoint (0.6–0.9 for water-wet) */
  krg_max: number
  /** Corey exponent for aqueous phase (2–4) */
  n_water: number
  /** Maximum water relative permeability endpoint */
  krw_max: number
}

/** Default parameters representative of a water-wet sandstone */
export const DEFAULT_BC_PARAMS: BrooksCoreyParams = {
  Sgr: 0.10,
  Swi: 0.20,
  n_gas: 2.0,
  krg_max: 0.80,
  n_water: 3.0,
  krw_max: 1.00,
}

/**
 * Gas (CO2) relative permeability — drainage curve.
 * @param Sg   Current gas saturation (0–1)
 * @param p    Brooks-Corey parameters
 */
export function krGas(Sg: number, p: BrooksCoreyParams = DEFAULT_BC_PARAMS): number {
  const Se = (Sg - p.Sgr) / (1 - p.Swi - p.Sgr)
  if (Se <= 0) return 0
  return p.krg_max * Math.min(1, Se ** p.n_gas)
}

/**
 * Water (brine) relative permeability.
 * @param Sg   Current gas saturation (0–1)
 * @param p    Brooks-Corey parameters
 */
export function krWater(Sg: number, p: BrooksCoreyParams = DEFAULT_BC_PARAMS): number {
  const Sw = 1 - Sg
  const Se = (Sw - p.Swi) / (1 - p.Swi - p.Sgr)
  if (Se <= 0) return 0
  return p.krw_max * Math.min(1, Se ** p.n_water)
}

/**
 * CO2 fractional flow — used to partition fluid movement between phases.
 * f_CO2 = krg/μg / (krg/μg + krw/μw)
 */
export function co2FractionalFlow(
  Sg: number,
  mu_co2: number,
  mu_brine: number,
  p: BrooksCoreyParams = DEFAULT_BC_PARAMS,
): number {
  const mg = krGas(Sg, p) / mu_co2
  const mw = krWater(Sg, p) / mu_brine
  const denom = mg + mw
  return denom > 0 ? mg / denom : 0
}

/**
 * Total mobility (for pressure normalisation).
 * λ_t = k_rg/μg + k_rw/μw   [1/Pa·s = m²/(Pa·s·m²)]
 */
export function totalMobility(
  Sg: number,
  mu_co2: number,
  mu_brine: number,
  p: BrooksCoreyParams = DEFAULT_BC_PARAMS,
): number {
  return krGas(Sg, p) / mu_co2 + krWater(Sg, p) / mu_brine
}
