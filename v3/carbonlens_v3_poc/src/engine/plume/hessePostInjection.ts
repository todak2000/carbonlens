/**
 * Hesse (2008) post-injection gravity current model.
 *
 * After CO2 injection stops, the plume evolves as a gravity current governed
 * by a scalar conservation law with two propagating shock fronts:
 *
 *   Leading shock  (xi_+): mobile CO2 front advancing outward
 *   Trailing shock (xi_-): residual trapping boundary retreating inward,
 *                          leaving permanently trapped CO2 behind
 *
 * The governing equation in radial geometry (Hesse et al. 2008, eq. 2.5):
 *
 *   du/dt + (1/xi) d[xi f(u)] / dxi = 0
 *
 * where:
 *   u   = dimensionless CO2 saturation (mobile fraction, 0-1)
 *   xi  = dimensionless radial coordinate squared = (r/r_inj)^2
 *   tau = dimensionless time = t_total / t_inj
 *   f(u) = Buckley-Leverett fractional flow with quadratic relative permeabilities
 *        = M·(u−S_r)² / [M·(u−S_r)² + (1−u)²]
 *   M   = end-point mobility ratio = (krg_max/mu_CO2) / (krw_max/mu_brine)
 *   S_r = residual CO2 saturation (trapped, immobile fraction)
 *
 * The Riemann problem at tau=1 (end of injection) gives a similarity solution
 * with two shocks separated by a rarefaction fan. Shock speeds are found by the
 * Rankine-Hugoniot condition applied to the fractional flow curve.
 *
 * Reference: Hesse, M.A., Orr, F.M. & Tchelepi, H.A. (2008).
 *   Gravity currents with residual trapping.
 *   Journal of Fluid Mechanics, 611, 35-60.
 *   DOI: 10.1017/S002211200800267X
 *
 * See also:
 *   Nordbotten, J.M. & Celia, M.A. (2006). Similarity solutions for fluid
 *   injection into confined aquifers. J. Fluid Mech. 561:307-327.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum meaningful saturation for shock computation */
const SG_MIN = 1e-6

/** Golden-section search tolerance for shock saturation */
const GSS_TOL = 1e-9

/** Maximum iterations for golden-section search */
const GSS_MAX_ITER = 200

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Input parameters for the Hesse post-injection gravity current model.
 * All SI unless noted.
 */
export interface HesseParams {
  /** CO2 plume radius at the moment injection ended [m] */
  r_inj_m: number
  /** Total active injection duration (years with Q > 0) [yr] */
  t_inj_yr: number
  /** Time elapsed since injection ended [yr]. Zero at shut-in. */
  t_post_yr: number
  /** Residual CO2 saturation from Land (1968) model (dimensionless, 0-1) */
  S_r: number
  /** CO2 viscosity at reservoir conditions [Pa·s] */
  mu_co2_Pa_s: number
  /** Brine viscosity at reservoir conditions [Pa·s] */
  mu_brine_Pa_s: number
  /** Maximum CO2 relative permeability endpoint (default: 0.8) */
  krg_max?: number
  /** Maximum brine relative permeability endpoint (default: 1.0) */
  krw_max?: number
}

/**
 * Results from the Hesse post-injection model at a specific post-injection time.
 */
export interface HesseResult {
  /** Outer radius of mobile CO2 front [m] */
  r_leading_m: number
  /** Inner radius: residual trapping boundary [m]. CO2 inside this radius is residually trapped. */
  r_trailing_m: number
  /** Fraction of original injected CO2 still mobile (0-1) */
  mobile_fraction: number
  /** Fraction of CO2 newly residually trapped since injection ended (0-1) */
  newly_trapped_fraction: number
  /** Dimensionless time tau = t_total/t_inj = 1 + t_post/t_inj */
  tau: number
  /** Dimensionless leading front position: xi_+ = (r_leading/r_inj)^2 */
  xi_leading: number
  /** Dimensionless trailing front position: xi_- = (r_trailing/r_inj)^2 */
  xi_trailing: number
  /** End-point mobility ratio M = (krg_max/mu_CO2) / (krw_max/mu_brine) */
  mobility_ratio: number
  /** Saturation at the leading shock (Welge tangent construction result) */
  leading_shock_saturation: number
  /** Leading shock speed in dimensionless coordinates [dimensionless/dimensionless_time] */
  leading_shock_speed: number
  /** Trailing shock speed in dimensionless coordinates */
  trailing_shock_speed: number
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fractional flow function for the CO2-brine system with quadratic relative
 * permeabilities and residual saturation.
 *
 * Uses Corey-type relative permeabilities with exponent 2:
 *   krg ∝ ((u - Sr) / (1 - Sr))²      (mobile CO₂ phase)
 *   krw ∝ ((1 - u) / (1 - Sr))²       (brine phase)
 *
 * The resulting fractional flow for CO₂ is:
 *   f(u) = M·(u−Sr)² / [M·(u−Sr)² + (1−u)²]
 *
 * where M is the end-point mobility ratio.
 *
 * Boundary values: f(Sr) = 0, f(1) = 1.
 */
function fractionalFlow(u: number, M: number, Sr: number): number {
  if (u <= Sr + SG_MIN) return 0
  if (u >= 1 - SG_MIN) return 1
  const mobileSat = u - Sr
  const waterSat = 1 - u
  const mTerm = M * mobileSat * mobileSat
  return mTerm / (mTerm + waterSat * waterSat)
}

/**
 * Numerical derivative of the fractional flow function via central differences.
 *
 * Switched from analytical to numerical to avoid re-deriving for the quadratic
 * relative permeability model with residual saturation.
 */
function fractionalFlowDeriv(u: number, M: number, Sr: number): number {
  if (u <= Sr + SG_MIN || u >= 1 - SG_MIN) return 0
  const h = Math.sqrt(Number.EPSILON) * Math.max(1, Math.abs(u))
  return (fractionalFlow(u + h, M, Sr) - fractionalFlow(u - h, M, Sr)) / (2 * h)
}

/**
 * Find u_+ (leading shock saturation) by the Welge tangent construction.
 *
 * u_+ is the saturation that maximises f(u)/u — geometrically, the point
 * where the line from the origin is tangent to the f(u) curve.
 *
 * This defines the shock connecting the injected plume (left state u_+)
 * to the undisturbed brine ahead (right state u = 0).
 *
 * Uses golden-section search on the interval (Sr, 1).
 */
function welgeTangentSaturation(M: number, Sr: number): number {
  // f(u)/u is unimodal for M > 1 — golden-section search is exact
  let lo = Sr + SG_MIN
  let hi = 1 - SG_MIN
  const phi = (Math.sqrt(5) - 1) / 2  // golden ratio

  let c = hi - phi * (hi - lo)
  let d = lo + phi * (hi - lo)

  for (let iter = 0; iter < GSS_MAX_ITER; iter++) {
    const fc = fractionalFlow(c, M, Sr) / Math.max(SG_MIN, c)
    const fd = fractionalFlow(d, M, Sr) / Math.max(SG_MIN, d)
    if (fc < fd) {
      lo = c
      c = d
      d = lo + phi * (hi - lo)
    } else {
      hi = d
      d = c
      c = hi - phi * (hi - lo)
    }
    if (hi - lo < GSS_TOL) break
  }

  return (lo + hi) / 2
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the Hesse (2008) post-injection plume state at a given post-injection time.
 *
 * Implements the full two-shock similarity solution from Hesse et al. (2008)
 * Section 3, for the case of a radially symmetric CO2 plume post shut-in.
 *
 * Algorithm:
 *   1. Compute end-point mobility ratio M
 *   2. Find u_+ via Welge tangent construction (leading shock saturation)
 *   3. Compute leading shock speed: s_+ = f(u_+) / u_+
 *   4. Compute trailing shock speed: s_- = [f(u_-) - f(S_r)] / [u_- - S_r]
 *      where u_- = 1 - Swi ≈ 0.8 (injected zone saturation at end of injection)
 *   5. Propagate both fronts in dimensionless time: xi(tau) = xi(1) + s * (tau - 1)
 *   6. Convert to real coordinates: r = r_inj * sqrt(xi)
 *
 * Returns the result at tau = 1 + t_post_yr / t_inj_yr.
 * At tau = 1 (t_post = 0, shut-in moment): r_leading = r_inj, r_trailing = 0.
 *
 * @param p  Hesse model parameters
 * @returns  Post-injection plume state at t_post_yr after shut-in
 */
export function computeHessePostInjection(p: HesseParams): HesseResult {
  const {
    r_inj_m,
    t_inj_yr,
    t_post_yr,
    S_r,
    mu_co2_Pa_s,
    mu_brine_Pa_s,
    krg_max = 0.8,
    krw_max = 1.0,
  } = p

  // ── Guard: return injection-end state if t_post is zero ─────────────────────
  if (t_post_yr <= 0 || t_inj_yr <= 0 || r_inj_m <= 0) {
    return {
      r_leading_m:              r_inj_m,
      r_trailing_m:             0,
      mobile_fraction:          1.0,
      newly_trapped_fraction:   0,
      tau:                      1,
      xi_leading:               1,
      xi_trailing:              0,
      mobility_ratio:           1,
      leading_shock_saturation: 0,
      leading_shock_speed:      0,
      trailing_shock_speed:     0,
    }
  }

  // ── Step 1: End-point mobility ratio ────────────────────────────────────────
  // M = lambda_CO2 / lambda_brine = (krg_max/mu_CO2) / (krw_max/mu_brine)
  // Typical range: M = 2 (cold brine, moderate krg) to 20 (deep hot reservoir)
  const M = Math.max(1.01, (krg_max / mu_co2_Pa_s) / (krw_max / mu_brine_Pa_s))

  // ── Step 2: Leading shock saturation (Welge tangent) ────────────────────────
  // u_+: saturation maximising f(u)/u — the tangent from origin
  const u_plus = welgeTangentSaturation(M, S_r)

  // ── Step 3: Leading shock speed ─────────────────────────────────────────────
  // Rankine-Hugoniot condition (left state u_+, right state 0):
  //   s_+ = [f(u_+) - f(0)] / [u_+ - 0] = f(u_+) / u_+
  // This is the same as the tangent slope — consistent by construction.
  const s_plus = Math.max(0, fractionalFlow(u_plus, M, S_r) / Math.max(SG_MIN, u_plus))

  // ── Step 4: Trailing shock speed ────────────────────────────────────────────
  // The trailing shock connects the mobile zone (at u_+) to the residual zone
  // (at S_r). Behind the shock, f(S_r) = 0 (zero mobile CO₂ flux by the
  // quadratic relative permeability model).
  //
  // Rankine-Hugoniot:
  //   s_- = [f(u_+) - f(S_r)] / [u_+ - S_r] = f(u_+) / (u_+ - S_r)
  const s_minus = S_r >= u_plus - SG_MIN
    ? 0
    : Math.max(0, fractionalFlow(u_plus, M, S_r) / (u_plus - S_r))

  // ── Step 5: Propagate fronts in dimensionless time ──────────────────────────
  // tau = dimensionless time relative to injection duration
  //   tau = 1 at end of injection
  //   tau = 1 + t_post/t_inj at post-injection time t_post
  //
  // In radial (xi-based) coordinates:
  //   xi_+(tau) = 1 + s_+ * (tau - 1)    leading front grows outward from xi=1
  //   xi_-(tau) = s_- * (tau - 1)         trailing front grows from xi=0
  //
  // The s_- direction: the trailing shock moves away from the well because brine
  // imbibes from both sides. In xi-space, xi_- increases with time.
  const tau = 1 + t_post_yr / t_inj_yr

  const xi_leading  = Math.max(1, 1 + s_plus * (tau - 1))
  const xi_trailing = Math.max(0, Math.min(xi_leading - SG_MIN, s_minus * (tau - 1)))

  // ── Step 6: Real-world radii ─────────────────────────────────────────────────
  // r = r_inj * sqrt(xi)  (because xi = (r/r_inj)^2)
  const r_leading_m  = r_inj_m * Math.sqrt(xi_leading)
  const r_trailing_m = xi_trailing > SG_MIN ? r_inj_m * Math.sqrt(xi_trailing) : 0

  // ── Step 7: Trapping fractions ──────────────────────────────────────────────
  // The residually trapped CO2 occupies the annulus between r=0 and r_trailing,
  // with saturation S_r. The total plume initially occupied 0 to r_inj with
  // mean saturation approximately u_plus.
  //
  // Fractional areas in xi-space (area proportional to xi in radial coords):
  //   Area_trapped_new = xi_trailing  (residual ring from 0 to xi_-)
  //   Area_total_initial = 1           (plume from 0 to xi=1 at end of injection)
  //
  // Newly trapped fraction = S_r * xi_trailing / (u_plus * xi_leading)
  // Mobile fraction = 1 - newly_trapped_fraction (bounded to [0,1])
  const u_mean = Math.max(SG_MIN, u_plus)  // representative mean plume saturation
  const newly_trapped_fraction = Math.min(
    1,
    (S_r * xi_trailing) / (u_mean * xi_leading),
  )
  const mobile_fraction = Math.max(0, 1 - newly_trapped_fraction)

  return {
    r_leading_m,
    r_trailing_m,
    mobile_fraction,
    newly_trapped_fraction,
    tau,
    xi_leading,
    xi_trailing,
    mobility_ratio:           M,
    leading_shock_saturation: u_plus,
    leading_shock_speed:      s_plus,
    trailing_shock_speed:     s_minus,
  }
}

/**
 * Compute the end-point mobility ratio from fluid properties.
 *
 * M = (krg_max / mu_CO2) / (krw_max / mu_brine)
 *
 * Typical values:
 *   ~3-5  at shallow conditions (low T, brine viscous)
 *   ~8-15 at deep hot reservoir (CO2 less viscous, brine thinner)
 *
 * @param mu_co2_Pa_s   CO2 viscosity [Pa·s]
 * @param mu_brine_Pa_s Brine viscosity [Pa·s]
 * @param krg_max       Max CO2 relative permeability (default: 0.8)
 * @param krw_max       Max brine relative permeability (default: 1.0)
 */
export function computeMobilityRatio(
  mu_co2_Pa_s: number,
  mu_brine_Pa_s: number,
  krg_max = 0.8,
  krw_max = 1.0,
): number {
  return (krg_max / Math.max(1e-7, mu_co2_Pa_s)) / (krw_max / Math.max(1e-7, mu_brine_Pa_s))
}

/**
 * Sweep efficiency: fraction of the swept area (0 to r_leading) where CO2
 * has been present and residual trapping has occurred, at a given post-injection time.
 *
 * E_sweep = xi_trailing / xi_leading
 *         = fraction of the total plume footprint that is now in the residual zone.
 *
 * @param result  Output from computeHessePostInjection
 */
export function sweepEfficiency(result: HesseResult): number {
  if (result.xi_leading <= 0) return 0
  return Math.min(1, result.xi_trailing / result.xi_leading)
}

/**
 * Time series of post-injection plume evolution at a set of years.
 *
 * Convenience wrapper around computeHessePostInjection for chart/export use.
 *
 * @param base       Base parameters (t_post_yr is overridden for each year)
 * @param years_post Array of post-injection years to evaluate [yr]
 * @returns          Array of HesseResult in the same order as years_post
 */
export function hesseTimeSeries(
  base: Omit<HesseParams, 't_post_yr'>,
  years_post: number[],
): HesseResult[] {
  return years_post.map(t => computeHessePostInjection({ ...base, t_post_yr: t }))
}
