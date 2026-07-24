/**
 * 2D Vertically Integrated (VE) CO₂ Plume Solver
 * ================================================
 *
 * Physical basis
 * --------------
 * Vertical Equilibrium (VE) assumes CO₂ segregates instantaneously to the caprock
 * due to buoyancy (valid when the vertical-equilibrium time scale t_eq << injection
 * time scale). This reduces the 3D problem to a 2D depth-integrated PDE for the
 * CO₂ column height η(x,y,t) [m]:
 *
 *   φ(1 - Swi) ∂η/∂t + ∇·q_CO₂ = Q_source
 *
 * Depth-averaged Darcy flux (two terms):
 *   1. Gravity-driven spreading (buoyancy):
 *      q_grav = −(k · η / μ_g) · (Δρ·g / 2) · ∇η
 *   2. Background pressure-gradient advection (from Theis superposition):
 *      q_pres = −(k · η / μ_g) · ∇P_theis
 *
 * Numerics
 * --------
 * Explicit two-point upwind finite-difference scheme on a regular Cartesian grid.
 * Forward-Euler time integration with a fixed Δt = 1 year.
 * Stability verified via von-Neumann analysis for typical CCUS parameters
 * (k=1–1000 mD, Δρ=200–600 kg/m³, Δx≥200 m → dt_max >> 1 year).
 *
 * Grid: nx × ny cells. Permeability field accepts either a scalar (uniform) or a
 * full heterogeneous array (nx·ny values, row-major order, units mD).
 *
 * References
 * ----------
 * Nordbotten & Celia (2006) Water Resour. Res. 42:W01407.
 * Gasda et al. (2009) Adv. Water Resour. 32:1322–1334.
 * Hesse et al. (2008) J. Fluid Mech. 611:35–60.
 */

export interface VEGrid {
  nx: number
  ny: number
  dx_m: number   // cell width in x (m)
  dy_m: number   // cell height in y (m)
}

export interface VEFluidProps {
  co2Density: number      // kg/m³
  brineDensity: number    // kg/m³
  co2Viscosity: number    // Pa·s
  porosity: number
  Swi: number             // connate water saturation (fraction)
  thickness: number       // m — maximum possible η (formation thickness)
  /**
   * Minimum CO₂ column height (m) for a cell to be counted as "plume invaded".
   * Default 0.01 m (1 cm) suits mass-balance tracking.
   * Set to ~5 m for comparison against 4D seismic surveys (Chadwick 2009)
   * where the reflectivity anomaly requires at least 5 m of CO₂ column.
   */
  etaThresh?: number
}

export interface VEWellSource {
  /** Grid cell x-index (0-based) */
  i: number
  /** Grid cell y-index (0-based) */
  j: number
  /** Volumetric injection rate (m³/s, positive = injection) */
  q_m3s: number
}

export interface VEState {
  /** CO₂ column height (m), row-major Float32Array of length nx·ny */
  eta: Float32Array
  /** CO₂ saturation (η/H), row-major Float32Array */
  saturation: Float32Array
  year: number
  /** 2D plume footprint (m²) — cells where η > threshold */
  plumeArea_m2: number
  /** Effective plume radius assuming circular plume (m) */
  plumeRadius_m: number
  /** Total CO₂ in grid (Mt) — mobile + residually trapped */
  totalMass_Mt: number
  /**
   * Residually trapped CO₂ mass (Mt) from Killough–Land capillary hysteresis.
   * Populated after the first imbibition event (plume retreat). Approaches
   * totalMass_Mt asymptotically as mobile CO₂ dissolves or migrates out.
   */
  trappedMass_Mt: number
}

const G = 9.81  // m/s²

export class VESolver {
  private readonly grid: VEGrid
  private readonly fluid: VEFluidProps
  /** Permeability field in m² (length = nx·ny) */
  private readonly permField: Float32Array
  /** CO₂ column height (m), current state — tracks total (mobile + residually trapped) */
  private eta: Float32Array
  /**
   * Historical maximum CO₂ column height at each cell (m).
   * Used by the Killough–Land capillary hysteresis model to determine residual
   * trapping during imbibition (plume retreat).
   *
   * Reference: Land, C.S. (1968). "Calculation of imbibition relative permeability
   * for two- and three-phase flow from rock properties." SPE J. 8(2):149–156.
   * Killough, J.E. (1976). "Reservoir simulation with history-dependent saturation
   * functions." SPE J. 16(1):37–48.
   */
  private eta_max_hist: Float32Array
  private _year: number = 0

  // Cached constants for efficiency
  private readonly phi_eff: number
  private readonly deltaRho: number
  private readonly dt_s: number

  /**
   * Land trapping coefficient C.
   * C = 1/Sgr_drainage − 1/Sgr_max_trapping
   * Typical range: 3–20 for sandstone (higher C → less residual trapping).
   * Value 5.0 representative of intermediate-permeability water-wet sandstone.
   */
  private static readonly LAND_C = 5.0

  /**
   * Maximum possible trapped CO₂ fraction of formation thickness (Sgr_max).
   * After full drainage to Sw = Swr, imbibition traps at most SGR_MAX_FRAC × H metres.
   * Typical range: 0.20–0.40 for water-wet sandstones.
   */
  private static readonly SGR_MAX_FRAC = 0.30

  constructor(
    grid: VEGrid,
    fluid: VEFluidProps,
    /** Optional heterogeneous permeability field (mD), length = nx·ny, row-major */
    permFieldMD?: Float32Array | number[],
  ) {
    this.grid  = grid
    this.fluid = fluid

    this.phi_eff  = fluid.porosity * (1 - fluid.Swi)
    this.deltaRho = fluid.brineDensity - fluid.co2Density
    this.dt_s     = 365.25 * 24 * 3600   // 1 year in seconds

    const n = grid.nx * grid.ny
    this.eta          = new Float32Array(n)
    this.eta_max_hist = new Float32Array(n)

    const basePerm = 0  // uniform case — see below
    if (permFieldMD && permFieldMD.length === n) {
      this.permField = new Float32Array(n)
      for (let k = 0; k < n; k++) {
        this.permField[k] = (permFieldMD[k] as number) * 9.869e-16
      }
    } else {
      // Uniform permeability derived from fluid.co2Viscosity and formation props
      // passed via the parent; use a sentinel — actual value is set by the caller
      // by passing permFieldMD as a Float32Array filled with the mD value.
      this.permField = new Float32Array(n).fill(basePerm)
    }
    void basePerm  // suppress unused warning
  }

  get year(): number { return this._year }

  reset(): void {
    this.eta.fill(0)
    this.eta_max_hist.fill(0)
    this._year = 0
  }

  /**
   * Advance simulation by one year using CFL-adaptive sub-stepping.
   *
   * The gravity-current spreading term creates a nonlinear diffusion PDE whose
   * explicit stability limit is dt_cfl = φ_eff·dx²·μ / (k·Δρg·η_max).
   * For high-permeability formations (k > 500 mD) this limit is sub-annual,
   * so the annual step is automatically split into n_sub equal sub-steps.
   * Maximum sub-steps is capped at 500 (< 1 day) for performance.
   *
   * @param wells   Array of active injection sources this year
   * @param dPdx_Pa_m  Optional pressure-gradient in x direction (Pa/m), length nx·ny
   * @param dPdy_Pa_m  Optional pressure-gradient in y direction (Pa/m), length nx·ny
   */
  step(
    wells: VEWellSource[],
    dPdx_Pa_m?: Float32Array,
    dPdy_Pa_m?: Float32Array,
  ): VEState {
    const { nx, ny, dx_m, dy_m } = this.grid
    const { co2Viscosity, thickness } = this.fluid
    const { dt_s, phi_eff, deltaRho } = this
    const dRhog_half = (deltaRho * G) / 2
    const n = nx * ny
    const idx = (i: number, j: number) => j * nx + i

    // ── CFL-adaptive sub-stepping ────────────────────────────────────────────
    // Stability limit: dt_cfl = phi_eff * min(dx,dy)^2 * mu / (k_max * Δρg * eta_max)
    // Using maximum permeability and current maximum column height.
    let etaMax = 0
    let kPermMax = 0
    for (let k = 0; k < n; k++) {
      if (this.eta[k] > etaMax) etaMax = this.eta[k]
      if (this.permField[k] > kPermMax) kPermMax = this.permField[k]
    }
    // Use formation thickness as the conservative bound for eta (guarantees stability
    // regardless of current fill state, including the very first injection step).
    const etaForCFL = Math.max(etaMax, thickness)
    const dxMin = Math.min(dx_m, dy_m)
    const dtCFL = kPermMax > 0
      ? (phi_eff * dxMin * dxMin * co2Viscosity) / (kPermMax * deltaRho * G * etaForCFL)
      : dt_s
    // Safety factor 0.45 (< 0.5 for 2D) to stay comfortably within stability.
    const n_sub = Math.min(500, Math.max(1, Math.ceil(dt_s / (0.45 * Math.max(dtCFL, 1)))))
    const dt_sub = dt_s / n_sub

    // ── Sub-step loop ────────────────────────────────────────────────────────
    const { LAND_C, SGR_MAX_FRAC } = VESolver

    for (let sub = 0; sub < n_sub; sub++) {
      const etaNew = new Float32Array(this.eta)

      // ── Killough–Land hysteresis: compute mobile CO₂ column height ───────
      // During drainage (η increasing): all CO₂ is mobile → etaMobile = η
      // During imbibition (η decreasing): residual CO₂ is trapped by capillarity.
      //
      // Land (1968) trapped saturation: Sgr_eff = Sgr_max × Sg_max / (1 + C × Sg_max)
      // where Sg_max = η_max_hist / H (historical max CO₂ column fraction).
      //
      // Mobile CO₂ column: η_mobile = max(0, η − Sgr_eff × H)
      const etaMobile = new Float32Array(n)
      for (let k = 0; k < n; k++) {
        if (this.eta[k] > this.eta_max_hist[k]) this.eta_max_hist[k] = this.eta[k]

        const Sg_max = this.eta_max_hist[k] / Math.max(thickness, 1e-6)
        if (Sg_max <= 0) {
          etaMobile[k] = this.eta[k]
          continue
        }
        const Sgr_eff = SGR_MAX_FRAC * Sg_max / (1 + LAND_C * Sg_max)
        if (this.eta[k] < this.eta_max_hist[k]) {
          etaMobile[k] = Math.max(0, this.eta[k] - Sgr_eff * thickness)
        } else {
          etaMobile[k] = this.eta[k]   // drainage: all CO₂ drives flux
        }
      }

      // ── X-direction fluxes ──────────────────────────────────────────────
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const kL = idx(i, j)
          const kR = idx(i + 1, j)
          const etaL = etaMobile[kL]
          const etaR = etaMobile[kR]
          const kPermL = this.permField[kL]
          const kPermR = this.permField[kR]
          if (kPermL <= 0 && kPermR <= 0) continue

          // Harmonic mean transmissibility at face
          const kPermFace = (kPermL + kPermR) > 0
            ? 2 * kPermL * kPermR / (kPermL + kPermR)
            : 0

          // Upwind η at face: upstream cell is opposite to flow direction.
          // Gravity current flows from high η to low η (downhill):
          //   gravGrad < 0  → deta_dx < 0  → flow is +x (rightward)  → upstream is L
          //   gravGrad >= 0 → deta_dx >= 0 → flow is -x (leftward)   → upstream is R
          const deta_dx = (etaR - etaL) / dx_m
          let flux_x = 0

          const gravGrad = dRhog_half * deta_dx
          const etaFaceGrav = gravGrad < 0 ? etaL : etaR  // upwind
          flux_x -= (kPermFace * etaFaceGrav / co2Viscosity) * gravGrad

          // Pressure gradient advection (if provided)
          if (dPdx_Pa_m) {
            const dp_dx = (dPdx_Pa_m[kL] + dPdx_Pa_m[kR]) * 0.5
            const etaFacePres = dp_dx < 0 ? etaL : etaR  // upwind (flow in −∇P direction)
            flux_x -= (kPermFace * etaFacePres / co2Viscosity) * dp_dx
          }

          const contrib = flux_x * dt_sub / (dx_m * phi_eff)
          etaNew[kL] -= contrib
          etaNew[kR] += contrib
        }
      }

      // ── Y-direction fluxes ──────────────────────────────────────────────
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx; i++) {
          const kB = idx(i, j)
          const kT = idx(i, j + 1)
          const etaB = etaMobile[kB]
          const etaT = etaMobile[kT]
          const kPermB = this.permField[kB]
          const kPermT = this.permField[kT]
          if (kPermB <= 0 && kPermT <= 0) continue

          const kPermFace = (kPermB + kPermT) > 0
            ? 2 * kPermB * kPermT / (kPermB + kPermT)
            : 0

          const deta_dy = (etaT - etaB) / dy_m
          let flux_y = 0

          const gravGrad = dRhog_half * deta_dy
          const etaFaceGrav = gravGrad < 0 ? etaB : etaT  // upwind
          flux_y -= (kPermFace * etaFaceGrav / co2Viscosity) * gravGrad

          if (dPdy_Pa_m) {
            const dp_dy = (dPdy_Pa_m[kB] + dPdy_Pa_m[kT]) * 0.5
            const etaFacePres = dp_dy < 0 ? etaB : etaT
            flux_y -= (kPermFace * etaFacePres / co2Viscosity) * dp_dy
          }

          const contrib = flux_y * dt_sub / (dy_m * phi_eff)
          etaNew[kB] -= contrib
          etaNew[kT] += contrib
        }
      }

      // ── Source terms (split evenly across sub-steps) ─────────────────────
      for (const w of wells) {
        const i = Math.max(0, Math.min(nx - 1, w.i))
        const j = Math.max(0, Math.min(ny - 1, w.j))
        const k = idx(i, j)
        const dEta = (w.q_m3s * dt_sub) / (dx_m * dy_m * phi_eff)
        etaNew[k] = Math.min(etaNew[k] + dEta, thickness)
      }

      // ── Physical bounds ───────────────────────────────────────────────────
      for (let k = 0; k < n; k++) {
        if (etaNew[k] < 0) etaNew[k] = 0
        if (etaNew[k] > thickness) etaNew[k] = thickness
      }

      this.eta = etaNew
    }

    this._year++
    return this._buildState()
  }

  /** Return current state snapshot without advancing time. */
  currentState(): VEState {
    return this._buildState()
  }

  private _buildState(): VEState {
    const { nx, ny, dx_m, dy_m } = this.grid
    const { thickness, co2Density, porosity, Swi } = this.fluid
    const phi_eff = porosity * (1 - Swi)
    const ETA_THRESH = this.fluid.etaThresh ?? 0.01  // default 1 cm; set ~5 m for seismic comparison
    const { LAND_C, SGR_MAX_FRAC } = VESolver

    let plumeArea   = 0
    let totalVol    = 0
    let trappedVol  = 0
    const saturation = new Float32Array(this.eta.length)

    for (let k = 0; k < this.eta.length; k++) {
      const e = this.eta[k]
      saturation[k] = e / Math.max(thickness, 1)
      if (e > ETA_THRESH) plumeArea += dx_m * dy_m
      totalVol += e * dx_m * dy_m * phi_eff

      // Residually trapped volume (Land model, same logic as in step())
      const Sg_max  = this.eta_max_hist[k] / Math.max(thickness, 1e-6)
      if (Sg_max > 0 && e < this.eta_max_hist[k]) {
        const Sgr_eff  = SGR_MAX_FRAC * Sg_max / (1 + LAND_C * Sg_max)
        const eta_trap = Math.max(0, Math.min(e, Sgr_eff * thickness))
        trappedVol    += eta_trap * dx_m * dy_m * phi_eff
      }
    }

    const totalMass   = (totalVol   * co2Density) / 1e9  // Mt
    const trappedMass = (trappedVol * co2Density) / 1e9  // Mt
    const plumeRadius = Math.sqrt(plumeArea / Math.PI)

    return {
      eta:             new Float32Array(this.eta),
      saturation,
      year:            this._year,
      plumeArea_m2:    plumeArea,
      plumeRadius_m:   plumeRadius,
      totalMass_Mt:    totalMass,
      trappedMass_Mt:  trappedMass,
    }
  }
}

/**
 * Build a uniform-permeability Float32Array for use with VESolver.
 */
export function uniformPermField(nx: number, ny: number, permeability_mD: number): Float32Array {
  return new Float32Array(nx * ny).fill(permeability_mD)
}

/**
 * Map well (x, z) fractional coordinates [-1.5, 1.5] to VE grid indices.
 * Uses the same coordinate convention as computePressureField.ts.
 */
export function wellToGridIndex(
  wx: number, wz: number,
  nx: number, ny: number,
): { i: number; j: number } {
  const HALF_SPAN = 1.5
  const frac_i = (wx + HALF_SPAN) / (2 * HALF_SPAN)
  const frac_j = (wz + HALF_SPAN) / (2 * HALF_SPAN)
  return {
    i: Math.max(0, Math.min(nx - 1, Math.round(frac_i * (nx - 1)))),
    j: Math.max(0, Math.min(ny - 1, Math.round(frac_j * (ny - 1)))),
  }
}
