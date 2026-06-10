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

// ── Van Genuchten (1980) + Mualem (1976) relative permeability ────────────────
//
// Reference: van Genuchten, M.Th. (1980). "A closed-form equation for predicting
// the hydraulic conductivity of unsaturated soils." Soil Sci. Soc. Am. J. 44:892–898.
// Gas kr extension: Parker et al. (1987), Lenhard & Parker (1987).
// CCS-specific fitted parameters: Krevor et al. (2012) Water Resour. Res. 48:W02514.
//
// Compared to Brooks-Corey, the van Genuchten model provides a smoother pore-size
// distribution that better fits heterogeneous and finer-grained sandstones. It is
// the preferred model in modern CCS reservoir simulators (TOUGH2/ECO2N, OpenGeoSys).
//
// Formulation:
//   Se_w = (Sw - Swr) / (1 - Swr - Sgr)           effective water saturation
//   m    = 1 - 1/n                                   VG shape parameter
//   krw  = krw_max · Se_w^½ · (1 − (1 − Se_w^(1/m))^m)²   [Mualem conductivity]
//   krg  = krg_max · (1−Se_w)^½ · (1 − Se_w^(1/m))^(2m)    [Stone gas extension]

export interface VanGenuchtenParams {
  /** Residual water (connate brine) saturation — minimum Sw below which brine is immobile */
  Swr: number
  /** Residual gas (CO₂) saturation — trapped fraction after imbibition cycle */
  Sgr: number
  /** Shape parameter n (> 1). Typical sandstone: 1.5–3.5; carbonates: 3–6 */
  n: number
  /** Maximum gas (CO₂) relative permeability endpoint (0.5–0.9 for water-wet rock) */
  krg_max: number
  /** Maximum brine relative permeability endpoint (typically 1.0) */
  krw_max: number
}

/** Berea sandstone — Krevor et al. (2012) Table 2, drainage measurements */
export const VG_BEREA: VanGenuchtenParams = {
  Swr: 0.20, Sgr: 0.10, n: 2.5, krg_max: 0.70, krw_max: 1.00,
}

/** Fontainebleau sandstone — Krevor et al. (2012), clean high-perm quartz arenite */
export const VG_FONTAINEBLEAU: VanGenuchtenParams = {
  Swr: 0.05, Sgr: 0.05, n: 3.0, krg_max: 0.85, krw_max: 1.00,
}

/** Generic water-wet saline aquifer sandstone — representative CCS screening default */
export const DEFAULT_VG_PARAMS: VanGenuchtenParams = {
  Swr: 0.20, Sgr: 0.05, n: 2.5, krg_max: 0.80, krw_max: 1.00,
}

/**
 * Effective water saturation Se_w ∈ [0, 1] normalised over the mobile pore space.
 * Se_w = (Sw − Swr) / (1 − Swr − Sgr)
 */
function seWaterVG(Sg: number, p: VanGenuchtenParams): number {
  const Sw = 1 - Sg
  return Math.max(0, Math.min(1, (Sw - p.Swr) / (1 - p.Swr - p.Sgr)))
}

/**
 * Van Genuchten–Mualem gas (CO₂) relative permeability.
 *
 * krg = krg_max × (1 − Se_w)^½ × (1 − Se_w^(1/m))^(2m)
 *
 * Boundary behaviour:
 *   Sw = Swr  → Se_w = 0  → krg = krg_max    (maximum CO₂ mobility)
 *   Sw = 1−Sgr → Se_w = 1 → krg = 0          (CO₂ at residual, immobile)
 *
 * @param Sg  current gas (CO₂) saturation (0–1)
 * @param p   van Genuchten parameters
 */
export function krGasVG(Sg: number, p: VanGenuchtenParams = DEFAULT_VG_PARAMS): number {
  const Se = seWaterVG(Sg, p)
  if (Se >= 1) return 0
  const m = 1 - 1 / p.n
  // Guard: Se^(1/m) must stay in [0,1] — safe since Se∈[0,1] and m∈(0,1)
  const Se1m = Math.pow(Math.max(0, Se), 1 / m)
  return p.krg_max * Math.sqrt(1 - Se) * Math.pow(Math.max(0, 1 - Se1m), 2 * m)
}

/**
 * Van Genuchten–Mualem brine relative permeability.
 *
 * krw = krw_max × Se_w^½ × (1 − (1 − Se_w^(1/m))^m)²
 *
 * @param Sg  current gas (CO₂) saturation (0–1)
 * @param p   van Genuchten parameters
 */
export function krWaterVG(Sg: number, p: VanGenuchtenParams = DEFAULT_VG_PARAMS): number {
  const Se = seWaterVG(Sg, p)
  if (Se <= 0) return 0
  const m = 1 - 1 / p.n
  const inner = 1 - Math.pow(Math.max(0, 1 - Math.pow(Se, 1 / m)), m)
  return p.krw_max * Math.sqrt(Se) * inner * inner
}

/**
 * CO₂ fractional flow using van Genuchten kr curves.
 * f_CO₂ = (krg/μg) / (krg/μg + krw/μw)
 */
export function co2FractionalFlowVG(
  Sg: number,
  mu_co2: number,
  mu_brine: number,
  p: VanGenuchtenParams = DEFAULT_VG_PARAMS,
): number {
  const mg = krGasVG(Sg, p) / mu_co2
  const mw = krWaterVG(Sg, p) / mu_brine
  const denom = mg + mw
  return denom > 0 ? mg / denom : 0
}

/**
 * Total mobility with van Genuchten kr curves.
 * λ_t = krg/μg + krw/μw
 */
export function totalMobilityVG(
  Sg: number,
  mu_co2: number,
  mu_brine: number,
  p: VanGenuchtenParams = DEFAULT_VG_PARAMS,
): number {
  return krGasVG(Sg, p) / mu_co2 + krWaterVG(Sg, p) / mu_brine
}
