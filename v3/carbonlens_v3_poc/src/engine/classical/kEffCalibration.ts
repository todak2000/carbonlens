/**
 * k_eff Calibration Module
 * ========================
 *
 * Provides functions to back-calculate the effective buoyancy permeability (k_eff)
 * from field observations of CO2 plume radius, and to produce uncertainty-bounded
 * radius predictions (P10 / P50 / P90) once k_eff is known.
 *
 * Physical basis
 * --------------
 * The Boait (2012) VE gravity-current formula gives plume radius as:
 *
 *   r(t) = 1.15 × (ub × q / phi²)^0.25 × sqrt(t)
 *   where ub = delta_rho × k × g / mu_co2   [m/s]
 *
 * Inverting for k given an observed (r, t) pair:
 *
 *   k_eff = (r / (1.15 × sqrt(t)))^4 × phi² × mu_co2 / (delta_rho × g × q)
 *
 * The distinction between k_eff and k_abs is fundamental:
 *   k_abs = absolute formation permeability from core/well test data
 *   k_eff = effective permeability that governs VE gravity-current spreading
 *
 * k_eff < k_abs for heterogeneous formations because the VE model integrates
 * over vertical heterogeneity. For Sleipner Utsira (k_abs ~ 2000 mD),
 * Boait (2012) find k_eff ~ 200 mD — a factor-10 reduction.
 *
 * Uncertainty bounds
 * ------------------
 * P10 (conservative) uses k_eff × 0.5  → radius × (0.5)^0.25 ≈ -16%
 * P50 (best estimate) uses k_eff × 1.0
 * P90 (optimistic)   uses k_eff × 2.0  → radius × (2.0)^0.25 ≈ +19%
 *
 * This represents a factor-2 uncertainty in k_eff, which is typical for
 * VE model calibration against 4D seismic surveys.
 *
 * References:
 *   Boait et al. (2012) JGR 117:B03309 — Sleipner VE gravity-current calibration
 *   Nordbotten & Celia (2006) WRR 42:W01407 — VE model theoretical basis
 *   Chadwick et al. (2009) Energy Procedia 1:2103 — Sleipner seismic data
 */

/** A single field observation used to calibrate k_eff */
export interface CalibrationAnchor {
  /** Time since injection start (years). Must be > 0. */
  t_yr: number
  /** Observed equivalent plume radius (m) from seismic, monitoring well, or InSAR. */
  r_obs_m: number
  /** Data source description, e.g. '4D seismic top-seal', 'monitoring well', 'InSAR uplift' */
  source: string
}

/** Radius prediction curves with P10/P50/P90 uncertainty bounds */
export interface RadiusCurve {
  t_yr: number[]
  r_p10_m: number[]
  r_p50_m: number[]
  r_p90_m: number[]
}

/** Full output of the k_eff calibration workflow */
export interface CalibrationResult {
  k_eff_mD: number
  k_eff_m2: number
  /** Residual error at the anchor point (%) — should be < 0.1% by construction */
  calibrationError_pct: number
  isCalibrated: boolean
  source: CalibrationAnchor | null
  radiusCurve: RadiusCurve
}

// ─── CORE VE FORMULA ─────────────────────────────────────────────────────────

/**
 * Boait (2012) VE gravity-current radius at time t.
 * k_m2 is the effective buoyancy permeability in m².
 */
function veRadius(
  t_yr: number,
  k_m2: number,
  phi: number,
  delta_rho_kg_m3: number,
  mu_co2_Pa_s: number,
  q_m3_s: number,
): number {
  if (t_yr <= 0 || k_m2 <= 0) return 0
  const t_sec = t_yr * 3.156e7
  const ub = (delta_rho_kg_m3 * k_m2 * 9.81) / mu_co2_Pa_s
  return 1.15 * ((ub * q_m3_s) / phi ** 2) ** 0.25 * Math.sqrt(t_sec)
}

// ─── CALIBRATION ─────────────────────────────────────────────────────────────

/**
 * Back-calculate k_eff (mD) from a single field observation (r_obs at t_obs).
 *
 * Analytically inverts the Boait (2012) VE formula.
 * Clamps the result to >= 1 mD to avoid physically meaningless values.
 */
export function calibrateKeff(
  anchor: CalibrationAnchor,
  phi: number,
  delta_rho_kg_m3: number,
  mu_co2_Pa_s: number,
  q_m3_s: number,
): number {
  const t_sec = anchor.t_yr * 3.156e7
  const r = anchor.r_obs_m
  if (r <= 0 || t_sec <= 0) return 1
  // Inverted formula: k = (r / (1.15 * sqrt(t)))^4 * phi^2 * mu / (delta_rho * g * q)
  const inner = r / (1.15 * Math.sqrt(t_sec))
  const k_m2 = (inner ** 4) * (phi ** 2) * mu_co2_Pa_s / (delta_rho_kg_m3 * 9.81 * q_m3_s)
  const k_mD = k_m2 / 9.869e-16
  return Math.max(1, k_mD)
}

// ─── PREDICTION ──────────────────────────────────────────────────────────────

/**
 * Compute P10/P50/P90 radius curves from t=1 to t=T_yr given a k_eff value.
 *
 * Uncertainty is modelled as k_eff × {0.5, 1.0, 2.0}, representing
 * a factor-2 calibration uncertainty (typical for VE models against seismic).
 */
export function predictWithCalibration(
  k_eff_mD: number,
  phi: number,
  delta_rho_kg_m3: number,
  mu_co2_Pa_s: number,
  q_m3_s: number,
  T_yr: number,
): RadiusCurve {
  const k_p10_m2 = (k_eff_mD * 0.5)  * 9.869e-16   // conservative
  const k_p50_m2 = k_eff_mD           * 9.869e-16   // best estimate
  const k_p90_m2 = (k_eff_mD * 2.0)  * 9.869e-16   // optimistic

  const t_yr = Array.from({ length: Math.max(1, Math.round(T_yr)) }, (_, i) => i + 1)

  return {
    t_yr,
    r_p10_m: t_yr.map((t) => veRadius(t, k_p10_m2, phi, delta_rho_kg_m3, mu_co2_Pa_s, q_m3_s)),
    r_p50_m: t_yr.map((t) => veRadius(t, k_p50_m2, phi, delta_rho_kg_m3, mu_co2_Pa_s, q_m3_s)),
    r_p90_m: t_yr.map((t) => veRadius(t, k_p90_m2, phi, delta_rho_kg_m3, mu_co2_Pa_s, q_m3_s)),
  }
}

// ─── FULL WORKFLOW ───────────────────────────────────────────────────────────

/**
 * Full k_eff calibration: given one field anchor point, back-calculate k_eff,
 * verify the round-trip residual, and produce P10/P50/P90 radius curves.
 *
 * @param anchor          Single field observation (t_yr, r_obs_m, source)
 * @param phi             Porosity (fraction)
 * @param delta_rho_kg_m3 Density contrast brine - CO2 (kg/m³)
 * @param mu_co2_Pa_s     CO2 viscosity (Pa·s) at reservoir conditions
 * @param q_m3_s          Volumetric injection flux (m³/s)
 * @param T_yr            Number of years to project forward
 */
export function runKeffCalibration(
  anchor: CalibrationAnchor,
  phi: number,
  delta_rho_kg_m3: number,
  mu_co2_Pa_s: number,
  q_m3_s: number,
  T_yr: number,
): CalibrationResult {
  const k_eff_mD = calibrateKeff(anchor, phi, delta_rho_kg_m3, mu_co2_Pa_s, q_m3_s)
  const k_eff_m2 = k_eff_mD * 9.869e-16

  // Round-trip verification: apply k_eff back to VE formula and check residual
  const r_check = veRadius(anchor.t_yr, k_eff_m2, phi, delta_rho_kg_m3, mu_co2_Pa_s, q_m3_s)
  const calibrationError_pct =
    anchor.r_obs_m > 0
      ? Math.abs(r_check - anchor.r_obs_m) / anchor.r_obs_m * 100
      : 0

  const radiusCurve = predictWithCalibration(
    k_eff_mD, phi, delta_rho_kg_m3, mu_co2_Pa_s, q_m3_s, T_yr,
  )

  return {
    k_eff_mD,
    k_eff_m2,
    calibrationError_pct,
    isCalibrated: true,
    source: anchor,
    radiusCurve,
  }
}

/**
 * Convenience: run uncalibrated prediction using formation k (no anchor point).
 * Returns P10/P50/P90 curves with factor-2 uncertainty on formation k.
 * Clearly marks isCalibrated = false so callers can communicate the uncertainty.
 */
export function runUncalibratedPrediction(
  k_formation_mD: number,
  phi: number,
  delta_rho_kg_m3: number,
  mu_co2_Pa_s: number,
  q_m3_s: number,
  T_yr: number,
): CalibrationResult {
  const k_eff_m2 = k_formation_mD * 9.869e-16

  return {
    k_eff_mD: k_formation_mD,
    k_eff_m2,
    calibrationError_pct: 0,
    isCalibrated: false,
    source: null,
    radiusCurve: predictWithCalibration(
      k_formation_mD, phi, delta_rho_kg_m3, mu_co2_Pa_s, q_m3_s, T_yr,
    ),
  }
}
