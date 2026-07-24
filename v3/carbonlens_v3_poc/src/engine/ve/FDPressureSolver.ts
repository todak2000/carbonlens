/**
 * FDPressureSolver.ts
 * ===================
 * Implicit finite-difference (backward Euler) 2D pressure solver for the VE grid.
 *
 * Solves the transient compressible pressure equation:
 *
 *   φ·ct·V/Δt × (P - P_prev) - ∇·(k·H/μ × ∇P) = Q_well    (m³/s)
 *
 * This replaces the Nordbotten/Theis analytical model for the pressure field.
 * Key advantages over the analytical model:
 *   1. Correctly models bounded domains — pressure builds up after the pulse
 *      reaches the domain boundary, not escaping to infinity as Theis assumes.
 *   2. Naturally handles multiple wells with exact superposition (no approximation).
 *   3. Accepts heterogeneous permeability fields from future geological models.
 *   4. Produces spatial ∇P field that drives CO2 migration in the VE solver.
 *
 * Numerics
 * --------
 * The pressure equation is discretized using a standard 5-point finite-difference
 * stencil on the regular Cartesian VE grid. Face transmissibilities use harmonic
 * mean permeability. No-flow boundary conditions (default) are automatically
 * satisfied by omitting boundary face fluxes.
 *
 * The resulting linear system A·P = b is symmetric positive definite (SPD).
 * It is solved with a matrix-free conjugate gradient (CG) method — no explicit
 * matrix is formed, saving memory. The initial guess is P_prev (warm start).
 * For 3600 unknowns (60×60), CG typically converges in 60–120 iterations
 * (condition number ~ nx², improved by the accumulation-term regulariser).
 *
 * BHP
 * ---
 * The FD solve gives the grid-block average pressure at the well cell.
 * True wellbore BHP is then:
 *   BHP = P_block + Q·μ·ln(r_eq/r_w) / (2π·k·H)
 *   r_eq = 0.1982·Δx   (Peaceman 1978 equivalent radius for square cells)
 *   r_w  = 0.1 m        (wellbore radius)
 * This Peaceman correction is applied externally in useSimulation.ts.
 *
 * References
 * ----------
 * Peaceman, D.W. (1978) Interpretation of Well-Block Pressures in Numerical
 *   Reservoir Simulation. SPE-6893-PA.
 * Nordbotten, J.M. & Celia, M.A. (2006) Similarity solutions for fluid injection
 *   into confined aquifers. J. Fluid Mech. 561:307–327.
 */

const MDARCY_TO_M2 = 9.869233e-16  // 1 mD in m²

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FDPressureConfig {
  /** Grid dimensions (must match the VE solver grid) */
  nx: number
  ny: number
  /** Cell width in x (m) */
  dx_m: number
  /** Cell height in y (m) */
  dy_m: number
  /** Permeability field in mD, length = nx·ny, row-major (i varies fastest) */
  permField_mD: Float32Array
  /** Total formation thickness H (m) — depth-integrated */
  formationH: number
  /** Porosity (fraction, uniform) */
  porosity: number
  /**
   * Total compressibility ct (Pa⁻¹) = rock compressibility + fluid compressibility.
   * Typical sandstone aquifer: 1e-9 Pa⁻¹ (Freeze & Cherry 1979).
   * Higher ct → more storage, slower pressure buildup.
   */
  totalCompressibility: number
  /**
   * Brine viscosity (Pa·s).
   * Pressure propagates through the brine (carrier fluid, ~60% of pore volume).
   * Use CO2 viscosity only in the near-well Peaceman correction (external).
   */
  brineViscosity: number
  /** Active injection wells this timestep */
  wells: Array<{
    i: number      // grid column (0-based)
    j: number      // grid row (0-based)
    q_m3s: number  // volumetric injection rate (m³/s, positive = injection)
  }>
  /** Pressure at the START of this timestep (Pa), length = nx·ny */
  P_prev_Pa: Float32Array
  /** Timestep length (s) */
  dt_s: number
}

export interface FDPressureResult {
  /** Pressure field at END of timestep (Pa), length = nx·ny */
  P_Pa: Float32Array
  /** x-direction pressure gradient at cell centres (Pa/m), length = nx·ny */
  dPdx_Pa_m: Float32Array
  /** y-direction pressure gradient at cell centres (Pa/m), length = nx·ny */
  dPdy_Pa_m: Float32Array
  /** Grid-block pressure at each well cell (Pa), one per well */
  P_well_Pa: number[]
  /** Whether CG converged within the iteration limit */
  converged: boolean
  /** Number of CG iterations used */
  iterations: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute face transmissibilities (m³/(Pa·s)):
 *   Tx[k] = east-face transmissibility of cell k   (connects k ↔ k+1)
 *   Ty[k] = north-face transmissibility of cell k  (connects k ↔ k+nx)
 * Boundary faces (i=nx-1 east, j=ny-1 north) remain 0 → no-flow BCs.
 */
function buildTransmissibilities(
  permField_mD: Float32Array,
  nx: number, ny: number,
  dx_m: number, dy_m: number,
  H: number, mu: number,
): { Tx: Float32Array; Ty: Float32Array } {
  const n = nx * ny
  const Tx = new Float32Array(n)  // east-face
  const Ty = new Float32Array(n)  // north-face

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      const kL_m2 = permField_mD[k] * MDARCY_TO_M2

      // East face: cell (i,j) ↔ cell (i+1,j)
      if (i < nx - 1) {
        const kR_m2 = permField_mD[k + 1] * MDARCY_TO_M2
        const k_harm = (kL_m2 + kR_m2) > 0 ? 2 * kL_m2 * kR_m2 / (kL_m2 + kR_m2) : 0
        // T = k_harm × (face area) / (μ × distance between centers)
        //   = k_harm × H × dy / (μ × dx)   [m² × m × m / (Pa·s × m) = m³/(Pa·s)]
        Tx[k] = k_harm * H * dy_m / (mu * dx_m)
      }

      // North face: cell (i,j) ↔ cell (i,j+1)
      if (j < ny - 1) {
        const kT_m2 = permField_mD[k + nx] * MDARCY_TO_M2
        const k_harm = (kL_m2 + kT_m2) > 0 ? 2 * kL_m2 * kT_m2 / (kL_m2 + kT_m2) : 0
        Ty[k] = k_harm * H * dx_m / (mu * dy_m)
      }
    }
  }
  return { Tx, Ty }
}

/**
 * Matrix-free A×x operation for the FD pressure system.
 *
 * A = (φ·ct·V/Δt) × I  +  L
 * where L is the transmissibility (Laplacian-like) operator.
 *
 * Diagonal: S + ΣT_faces (all neighbouring face transmissibilities)
 * Off-diag:  -T_face (coupling to each neighbour)
 *
 * A is symmetric positive definite: safe for conjugate gradient.
 */
function matVecFD(
  x: Float32Array,
  Ax: Float32Array,
  Tx: Float32Array,
  Ty: Float32Array,
  S: number,   // scalar storage per cell: φ·ct·V_cell/Δt  (m³/(Pa·s))
  nx: number,
  ny: number,
): void {
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      let val = S * x[k]   // accumulation term

      // East coupling
      if (i < nx - 1) {
        const T = Tx[k]
        val += T * (x[k] - x[k + 1])
      }
      // West coupling  (east face of cell k-1)
      if (i > 0) {
        const T = Tx[k - 1]
        val += T * (x[k] - x[k - 1])
      }
      // North coupling
      if (j < ny - 1) {
        const T = Ty[k]
        val += T * (x[k] - x[k + nx])
      }
      // South coupling  (north face of cell k-nx)
      if (j > 0) {
        const T = Ty[k - nx]
        val += T * (x[k] - x[k - nx])
      }

      Ax[k] = val
    }
  }
}

/**
 * Conjugate gradient solver for A·x = b where A is SPD.
 * Matrix-free: A is provided as a function (x, Ax) -> void.
 *
 * Initial guess is x0 (warm-start from previous timestep typically reduces
 * iterations to ~20-40 for slowly varying reservoir pressure).
 *
 * Convergence criterion: ||r|| < tol × max(||b||, 1)
 */
function cgSolve(
  b: Float32Array,
  x0: Float32Array,
  matvec: (x: Float32Array, Ax: Float32Array) => void,
  tol = 1e-6,
  maxIter = 300,
): { x: Float32Array; iter: number; converged: boolean } {
  const n = b.length
  const x  = new Float32Array(x0)   // solution (copy of initial guess)
  const r  = new Float32Array(n)    // residual
  const p  = new Float32Array(n)    // search direction
  const Ap = new Float32Array(n)    // A × p

  // r₀ = b - A·x₀
  matvec(x, Ap)
  let bnorm2 = 0
  for (let i = 0; i < n; i++) {
    r[i] = b[i] - Ap[i]
    p[i] = r[i]
    bnorm2 += b[i] * b[i]
  }
  const tolAbs = tol * Math.max(Math.sqrt(bnorm2), 1.0)

  let rsold = 0
  for (let i = 0; i < n; i++) rsold += r[i] * r[i]

  let iter = 0
  let converged = false

  for (iter = 0; iter < maxIter; iter++) {
    if (Math.sqrt(rsold) <= tolAbs) { converged = true; break }

    matvec(p, Ap)
    let pAp = 0
    for (let i = 0; i < n; i++) pAp += p[i] * Ap[i]
    if (Math.abs(pAp) < 1e-30) break   // breakdown — unlikely for SPD

    const alpha = rsold / pAp
    let rsnew = 0
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i]
      r[i] -= alpha * Ap[i]
      rsnew += r[i] * r[i]
    }

    if (Math.sqrt(rsnew) <= tolAbs) { iter++; converged = true; break }

    const beta = rsnew / rsold
    for (let i = 0; i < n; i++) p[i] = r[i] + beta * p[i]
    rsold = rsnew
  }

  return { x, iter, converged }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Solve for the 2D pressure field on the VE grid using backward-Euler FD.
 *
 * Returns the new pressure field, cell-centred gradients, and per-well
 * block pressures. The block pressures can be converted to true wellbore
 * BHP by the caller using the Peaceman formula.
 *
 * Falls back gracefully if CG does not converge: the partially-converged
 * solution is returned with `converged: false`. The caller should check
 * this flag and fall back to the analytical pressure if needed.
 */
export function solveFDPressure(cfg: FDPressureConfig): FDPressureResult {
  const {
    nx, ny, dx_m, dy_m,
    permField_mD, formationH,
    porosity, totalCompressibility, brineViscosity,
    wells, P_prev_Pa, dt_s,
  } = cfg
  const n = nx * ny

  // 1. Face transmissibilities
  const { Tx, Ty } = buildTransmissibilities(
    permField_mD, nx, ny, dx_m, dy_m, formationH, brineViscosity,
  )

  // 2. Per-cell storage coefficient (scalar for uniform φ and cell size)
  //    S = φ·ct·V_cell/Δt   [m³/(Pa·s)]
  const V_cell = dx_m * dy_m * formationH
  const S = porosity * totalCompressibility * V_cell / dt_s

  // 3. Build right-hand side: b[k] = S·P_prev[k] + Q_well[k]
  const b = new Float32Array(n)
  for (let k = 0; k < n; k++) b[k] = S * P_prev_Pa[k]
  for (const w of wells) {
    const wi = Math.max(0, Math.min(nx - 1, w.i))
    const wj = Math.max(0, Math.min(ny - 1, w.j))
    b[wj * nx + wi] += w.q_m3s
  }

  // 4. Define matrix-vector product (closure captures Tx, Ty, S, nx, ny)
  const matvec = (x: Float32Array, Ax: Float32Array): void =>
    matVecFD(x, Ax, Tx, Ty, S, nx, ny)

  // 5. Solve  A·P = b  with warm start = P_prev
  const { x: P_Pa, iter, converged } = cgSolve(b, P_prev_Pa, matvec)

  // 6. Compute cell-centre pressure gradients (central differences, one-sided at boundaries)
  const dPdx = new Float32Array(n)
  const dPdy = new Float32Array(n)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      dPdx[k] = i === 0
        ? (P_Pa[k + 1] - P_Pa[k]) / dx_m
        : i === nx - 1
          ? (P_Pa[k] - P_Pa[k - 1]) / dx_m
          : (P_Pa[k + 1] - P_Pa[k - 1]) / (2 * dx_m)

      dPdy[k] = j === 0
        ? (P_Pa[k + nx] - P_Pa[k]) / dy_m
        : j === ny - 1
          ? (P_Pa[k] - P_Pa[k - nx]) / dy_m
          : (P_Pa[k + nx] - P_Pa[k - nx]) / (2 * dy_m)
    }
  }

  // 7. Extract well-block pressures
  const P_well_Pa = wells.map(w => {
    const wi = Math.max(0, Math.min(nx - 1, w.i))
    const wj = Math.max(0, Math.min(ny - 1, w.j))
    return P_Pa[wj * nx + wi]
  })

  return {
    P_Pa,
    dPdx_Pa_m: dPdx,
    dPdy_Pa_m: dPdy,
    P_well_Pa,
    converged,
    iterations: iter,
  }
}
