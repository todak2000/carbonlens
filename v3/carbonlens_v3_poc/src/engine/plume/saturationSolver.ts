/**
 * CO2 saturation flow solver.
 *
 * Physically motivated per-cell advection model for real-time browser simulation.
 * Governing physics:
 *   1. Injection source term   — CO2 added at wellbore cells
 *   2. Buoyancy-driven ascent  — CO2 rises due to Δρ (brine - CO2)
 *   3. Caprock spreading       — CO2 spreads laterally once it hits the seal
 *   4. Lateral gravity spread  — tilt-driven flow at each layer
 *   5. Residual trapping       — Land snap-off when brine imbibes
 *   6. Solubility trapping     — dissolution into brine (Henry's Law budget)
 *   7. Mineral trapping        — long-timescale kinetic precipitation
 */

import { GridCell } from '../../utils/geologicalModelToGrid'
import { krGasHysteretic } from './killoughHysteresis'
import { calculateDissolution, makeDissolutionParams } from './dissolutionTrapping'
import { applyMineralTrapping } from './mineralTrapping'
import { LithologyType } from '../../types/geological'
import { pcDrainage, makeCapillaryParams } from './capillaryPressure'

// ── Physical constants ───────────────────────────────────────────────────────
const G = 9.81           // m/s²
const DT = 3.156e7       // 1 year in seconds (365.25 × 24 × 3600)
const MU_BRINE = 6e-4    // brine viscosity, Pa·s (60°C, moderate salinity)

// ── Solver configuration ─────────────────────────────────────────────────────
/** Injection radius in normalised grid coords (centerX/centerY are -1 to 1)
 *  ~1 cell width at 20×20 resolution. Smaller radius concentrates CO₂
 *  for realistic near-wellbore saturation, enabling buoyancy-driven rise. */
const INJECTION_RADIUS = 0.10
/** Lower fraction of reservoir used as injection interval */
const INJECTION_ZONE_FRAC = 0.40
/** Stability limiter: max saturation change per cell per year from buoyancy */
const MAX_BUOY_DELTA = 0.25
/** Stability limiter: max saturation change per cell per year from lateral flow */
const MAX_LAT_DELTA = 0.20
/** Minimum residual CO2 trapping coefficient (capillary trapping fraction) */
const LAND_C = 2.5

/** Near-wellbore radial refinement: number of sub-steps for cells within
 *  the injection zone. Equivalent to 4× finer temporal resolution near wells,
 *  matching an AMR refinement ratio of 4 for explicit time integration. */
const NEARWELL_SUBSTEPS = 4

/**
 * Peaceman log-radial injection weight for a cell at normalised distance r
 * from the well.  Mirrors the log(re/r) pressure profile in radial flow.
 *
 * Weight = ln(re/max(r, rw)) / ln(re/rw)
 * where re = INJECTION_RADIUS, rw = 0.01 (well radius in normalised coords).
 * Returns 0 for cells outside re.
 */
export function peacemanInjectionWeight(r: number, re = INJECTION_RADIUS, rw = 0.01): number {
  if (r >= re) return 0
  const rClamped = Math.max(r, rw)
  const lnRe = Math.log(re / rw)
  if (lnRe <= 0) return 1
  return Math.log(re / rClamped) / lnRe
}

/**
 * Distance from a cell to the nearest active injection well (normalised coords).
 * Returns Infinity if wells array is empty.
 */
export function distToNearestWell(cx: number, cy: number, wells: WellSource[]): number {
  let minDist = Infinity
  for (const w of wells) {
    const dx = cx - w.x; const dy = cy - w.z
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < minDist) minDist = d
  }
  return minDist
}

/** Biot coefficient for effective stress calculation (default) */
const DEFAULT_BIOT = 0.70
/** Permeability-stress sensitivity in MPa⁻¹ (3% change per MPa) */
const STRESS_SENSITIVITY = 0.03

export interface FluidProps {
  co2Density: number       // kg/m³
  brineDensity: number     // kg/m³
  co2Viscosity: number     // Pa·s
  solubility: number       // mol/kg  (Duan-Sun)
  temperature: number      // °C
  pressureIncrease?: number // MPa — well pressure rise above initial (for stress-dependent k/φ)
}

export interface WellSource {
  x: number                // normalised scene coords (-1 to 1)
  z: number                // normalised scene coords (-1 to 1)
  injectionRateMtPerYear: number
  rampUpYears: number
  rampDownYears: number
}

/** Per-cell solver state (allocated once, reused across steps) */
export interface SolverState {
  /** Saturation at previous step — for detecting imbibition onset */
  prevSg: Float32Array
  /** Maximum drainage saturation seen — for Land model */
  Sg_max: Float32Array
  /** True once imbibition has begun for this cell */
  inImbibition: Uint8Array
  /** Residual gas saturation (permanently trapped, accumulates) */
  Sg_residual: Float32Array
  /** Dissolved CO2 saturation (aqueous phase) */
  Sg_dissolved: Float32Array
  /** Mineral CO2 saturation (solid phase) */
  Sg_mineral: Float32Array
}

export function makeSolverState(cellCount: number): SolverState {
  return {
    prevSg:       new Float32Array(cellCount),
    Sg_max:       new Float32Array(cellCount),
    inImbibition: new Uint8Array(cellCount),
    Sg_residual:  new Float32Array(cellCount),
    Sg_dissolved: new Float32Array(cellCount),
    Sg_mineral:   new Float32Array(cellCount),
  }
}

/** Rate function for ramp-up/down schedule (Mt/year actually flowing) */
function effectiveRate(
  rate: number,
  year: number,
  rampUp: number,
  rampDown: number,
  projectYears: number,
): number {
  if (year <= 0) return 0
  if (year < rampUp) return rate * (year / rampUp)
  const shutIn = projectYears - rampDown
  if (year >= projectYears) return 0
  if (year > shutIn) return rate * (1 - (year - shutIn) / rampDown)
  return rate
}

/**
 * Optional overrides for history-matching integration.
 * All fields default to undefined (preserving existing behavior).
 */
export interface SaturationSolverOverrides {
  /** kv/kh ratio — scales vertical Darcy velocity. Default: 1.0 (isotropic). */
  kvKhRatio?: number
  /** Override residual gas saturation (Sgr) in the Land model. Default: uses LAND_C. */
  Sgr_override?: number
  /** Override Land constant C. Default: LAND_C = 2.5. */
  landConstant_override?: number
}

/**
 * Advance simulation by one year.
 *
 * @param cells      Flat grid cell array (mutated in place)
 * @param state      Per-cell solver state (mutated in place)
 * @param nx/ny/nz   Grid dimensions
 * @param dims       Real-world dimensions (metres)
 * @param fluid      Fluid properties from existing engine
 * @param wells      Injection well schedule
 * @param year       Current simulation year
 * @param projectYears Total simulation duration
 * @param overrides  Optional history-matching parameter overrides
 */
export function stepSaturation(
  cells: GridCell[],
  state: SolverState,
  nx: number,
  ny: number,
  nz: number,
  dims: { totalThicknessM: number; modelWidthM: number; modelLengthM: number },
  fluid: FluidProps,
  wells: WellSource[],
  year: number,
  projectYears: number,
  overrides?: SaturationSolverOverrides,
): void {
  const cellCount = nx * ny * nz
  if (cellCount === 0) return

  const { co2Density, brineDensity, co2Viscosity, solubility, temperature } = fluid
  const deltaRho = Math.max(0, brineDensity - co2Density)   // positive = CO2 buoyant

  // Extract override values (defaults preserve existing behavior)
  const kvKhRatio = overrides?.kvKhRatio ?? 1.0
  const Sgr_override = overrides?.Sgr_override
  const landConstant_override = overrides?.landConstant_override ?? LAND_C

  const dz = dims.totalThicknessM / nz        // cell height, metres
  const dx = dims.modelWidthM / nx             // cell width,  metres
  const dy = dims.modelLengthM / ny            // cell depth,  metres

  // Helper: flat index from grid coords
  const idx = (i: number, j: number, k: number) => k * ny * nx + j * nx + i

  // ── Temporary flux arrays (avoids double-counting) ─────────────────────────
  const delta = new Float32Array(cellCount)    // net saturation change this step

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Injection source terms
  // ═══════════════════════════════════════════════════════════════════════════
  for (const well of wells) {
    const qMt = effectiveRate(well.injectionRateMtPerYear, year, well.rampUpYears, well.rampDownYears, projectYears)
    if (qMt <= 0) continue

    // Convert Mt/year → m³/year at reservoir CO2 density
    const qVol = (qMt * 1e9) / co2Density   // m³/year

    // Gather injection zone cells (lower INJECTION_ZONE_FRAC of reservoir, active)
    const kInjMin = Math.floor(nz * (1 - INJECTION_ZONE_FRAC))
    const injCells: number[] = []

    for (let k = kInjMin; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const cell = cells[idx(i, j, k)]
          if (!cell.activeForInjection || cell.isCaprock) continue
          // well.x and well.z are in the same normalised space as centerX / centerY
          const ddx = cell.centerX - well.x
          const ddy = cell.centerY - well.z
          const dist = Math.sqrt(ddx * ddx + ddy * ddy)
          if (dist <= INJECTION_RADIUS) injCells.push(cell.instanceId)
        }
      }
    }

    if (injCells.length === 0) continue

    // ── Peaceman log-radial injection weighting ────────────────────────────
    // Distribute volume weighted by ln(re/r), matching the true log-linear
    // pressure profile in radial Darcy flow (Peaceman 1978).
    // This concentrates injected CO₂ near the well (physically correct) and
    // is equivalent to AMR near-wellbore refinement for the injection term.
    const weights: number[] = []
    let totalWeight = 0
    for (const cid of injCells) {
      const cell = cells[cid]
      const ddx = cell.centerX - well.x; const ddy = cell.centerY - well.z
      const r = Math.sqrt(ddx * ddx + ddy * ddy)
      const w = peacemanInjectionWeight(r)
      weights.push(w)
      totalWeight += w
    }
    if (totalWeight <= 0) {
      // Fallback: uniform distribution
      for (const cid of injCells) {
        const cell = cells[cid]
        const poreVol = (dims.modelWidthM / nx) * (dims.modelLengthM / ny) * (dims.totalThicknessM / nz) * cell.porosity
        delta[cid] += qVol / (injCells.length * poreVol)
      }
    } else {
      for (let wi = 0; wi < injCells.length; wi++) {
        const cid = injCells[wi]
        const cell = cells[cid]
        const poreVol = (dims.modelWidthM / nx) * (dims.modelLengthM / ny) * (dims.totalThicknessM / nz) * cell.porosity
        // Weight normalised so total mass is conserved
        const dSg = (qVol * weights[wi] / totalWeight) / poreVol
        delta[cid] += dSg
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Buoyancy-driven vertical ascent (CO2 rises from k_high to k_low)
  //   k = 0 is the shallowest (top / caprock side)
  //   k = nz-1 is the deepest (injection zone)
  //   centerZ: 1 = top, -1 = base → k=0 is top
  // ═══════════════════════════════════════════════════════════════════════════
  for (let k = nz - 1; k >= 1; k--) {            // iterate from base upward
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const cell = cells[idx(i, j, k)]
        const cellAbove = cells[idx(i, j, k - 1)]

        if (cell.isCaprock || cellAbove.isCaprock) continue
        const Sg = Math.max(0, cell.co2Saturation + delta[cell.instanceId])
        if (Sg <= 0.001) continue

        // ── Adaptive near-well sub-stepping ───────────────────────────────
        // Cells within INJECTION_RADIUS of any well use NEARWELL_SUBSTEPS
        // sub-steps with dt/N each — equivalent to local temporal AMR.
        // This captures the steep near-wellbore buoyancy flux accurately.
        const rMin = distToNearestWell(cell.centerX, cell.centerY, wells)
        const nSubsteps = rMin < INJECTION_RADIUS * 2 ? NEARWELL_SUBSTEPS : 1
        const dtSub = DT / nSubsteps

        // Darcy buoyancy velocity (m/s)
        // kvKhRatio scales vertical permeability to model anisotropy (history matching override)
        const kv_m2 = cell.kVertical * 9.869e-16 * kvKhRatio    // mD → m², scaled by kv/kh
        const kr = krGasHysteretic(Sg, state.Sg_max[cell.instanceId])
        const v_buoy = (kv_m2 * kr / co2Viscosity) * deltaRho * G  // m/s

        // Volume fraction of cell moved upward (accumulated over sub-steps)
        let dSgTotal = 0
        let SgRemaining = Sg
        for (let sub = 0; sub < nSubsteps; sub++) {
          let dSgSub = (v_buoy * dtSub / dz)
          dSgSub = Math.min(dSgSub, SgRemaining * 0.6, MAX_BUOY_DELTA / nSubsteps)
          if (dSgSub <= 0) break
          dSgTotal += dSgSub
          SgRemaining -= dSgSub
        }
        if (dSgTotal <= 0) continue

        // Check caprock directly above: if cellAbove is the caprock boundary, block
        if (cellAbove.isCaprock) continue

        // Mass-conserving transfer (porosity-weighted)
        const phiRatio = cell.porosity / Math.max(0.001, cellAbove.porosity)
        delta[cell.instanceId]      -= dSgTotal
        delta[cellAbove.instanceId] += dSgTotal * Math.min(phiRatio, 2.0)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Lateral spreading at each layer
  //   CO2 spreads sideways driven by horizontal permeability and gravity.
  //   Near the caprock interface (k=0,1): gravity current model — the buoyant CO2
  //   pool spreads as a thin gravity current with effective diffusivity
  //   D_gc = k_h·kr·Δρ·g·h_CO2/(μ·φ) (Nordbotten & Celia 2006, eq. 14).
  //   Deeper reservoir layers: gradient-driven diffusive spreading.
  // ═══════════════════════════════════════════════════════════════════════════
  for (let k = 0; k < nz; k++) {
    const isNearCaprock = k <= 1   // amplified lateral spread just below caprock

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const cell = cells[idx(i, j, k)]
        if (cell.isCaprock) continue
        const Sg = Math.max(0, cell.co2Saturation + delta[cell.instanceId])
        if (Sg <= 0.001 && !isNearCaprock) continue

        const kh_m2 = cell.kHorizontal * 9.869e-16
        const kr = krGasHysteretic(Sg, state.Sg_max[cell.instanceId])
        // Effective lateral diffusivity [m²/s]
        // Near caprock: physics-based gravity current model (Nordbotten & Celia 2006)
        //   D_gc = k_h × kr × Δρ × g × h_CO2 / (μ × φ)
        //   where h_CO2 ≈ Sg × dz is the local CO2 column thickness contribution.
        // Deeper reservoir: simplified gradient-driven term.
        let D_eff: number
        if (isNearCaprock && deltaRho > 0 && Sg > 0.001) {
          // CFL stability limit for explicit 1-year step
          const D_cfl = dx * dx / (4 * DT)
          const D_gc = (kh_m2 * kr * deltaRho * G * Sg * dz) / (co2Viscosity * Math.max(0.01, cell.porosity))
          D_eff = Math.min(D_gc, D_cfl)
        } else {
          D_eff = (kh_m2 * kr) / co2Viscosity * 1.5
        }

        // Capillary pressure for this cell
        const Sw = Math.min(1, Math.max(0, 1 - Sg))
        const cpHere = makeCapillaryParams(cell.capillaryEntryPressure, (cell as any).__lithology ?? 'sandstone')
        const PcHere = pcDrainage(Sw, cpHere)

        // Capillary-driven flux helper: returns saturation change per year
        const capFlux = (neighbor: GridCell, d: number): number => {
          const SgN = Math.max(0, neighbor.co2Saturation + delta[neighbor.instanceId])
          if (SgN <= 0.001 && !isNearCaprock) return 0
          const SwN = Math.min(1, Math.max(0, 1 - SgN))
          const cpN = makeCapillaryParams(neighbor.capillaryEntryPressure, (neighbor as any).__lithology ?? 'sandstone')
          const PcN = pcDrainage(SwN, cpN)
          const v = (kh_m2 * kr) / co2Viscosity * (PcN - PcHere) * 1e6 / d
          const dSg = v * DT / d
          return Math.min(Math.abs(dSg), MAX_LAT_DELTA * 0.3) * Math.sign(dSg)
        }

        // X-direction
        if (i > 0) {
          const cLeft = cells[idx(i - 1, j, k)]
          if (!cLeft.isCaprock) {
            const SgL = Math.max(0, cLeft.co2Saturation + delta[cLeft.instanceId])
            const flux = D_eff * (Sg - SgL) * DT / (dx * dx)
            const dSgX = Math.min(Math.abs(flux), MAX_LAT_DELTA) * Math.sign(flux)

            const dSgTotal = dSgX + capFlux(cLeft, dx)
            const blocked = dSgTotal * Math.min(cell.faultTransmX, cLeft.faultTransmX)
            delta[cell.instanceId]   -= blocked
            delta[cLeft.instanceId]  += blocked * (cell.porosity / Math.max(0.001, cLeft.porosity))
          }
        }

        // Y-direction
        if (j > 0) {
          const cFront = cells[idx(i, j - 1, k)]
          if (!cFront.isCaprock) {
            const SgF = Math.max(0, cFront.co2Saturation + delta[cFront.instanceId])
            const flux = D_eff * (Sg - SgF) * DT / (dy * dy)
            const dSgY = Math.min(Math.abs(flux), MAX_LAT_DELTA) * Math.sign(flux)

            const dSgTotal = dSgY + capFlux(cFront, dy)
            const blocked = dSgTotal * Math.min(cell.faultTransmY, cFront.faultTransmY)
            delta[cell.instanceId]   -= blocked
            delta[cFront.instanceId] += blocked * (cell.porosity / Math.max(0.001, cFront.porosity))
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Apply delta, clamp, trapping, dissolution, mineralisation
  // ═══════════════════════════════════════════════════════════════════════════
  const dissolutionBudget = solubility * 0.001   // normalised dissolution capacity

  for (let cid = 0; cid < cellCount; cid++) {
    const cell = cells[cid]
    if (cell.isCaprock) continue

    const prevSg = state.prevSg[cid]
    let Sg = Math.max(0, Math.min(1 - 0.05, (cell.co2Saturation) + delta[cid]))

    // ── Land residual trapping ─────────────────────────────────────────────
    if (Sg > state.Sg_max[cid]) {
      state.Sg_max[cid] = Sg
      state.inImbibition[cid] = 0
    } else if (Sg < prevSg - 0.001 && !state.inImbibition[cid]) {
      // Imbibition onset: lock residual
      state.inImbibition[cid] = 1
      // Use Sgr_override if provided; otherwise compute from Land model with
      // landConstant_override (defaults to LAND_C = 2.5, preserving existing behavior).
      const Sgr = Sgr_override !== undefined
        ? Sgr_override
        : state.Sg_max[cid] / (1 + landConstant_override * state.Sg_max[cid])
      const newResidual = Math.max(0, Sgr - state.Sg_residual[cid])
      state.Sg_residual[cid] += newResidual
      // Deduct newly trapped from free phase
      Sg = Math.max(0, Sg - newResidual)
    }

    // Enforce residual floor: free CO2 cannot go below residual while in imbibition
    if (state.inImbibition[cid]) {
      Sg = Math.max(Sg, state.Sg_residual[cid])
    }

    // ── Solubility trapping (interfacial-area-limited + convective mixing) ──
    const dissParams = makeDissolutionParams(dissolutionBudget)
    const dDissolved = calculateDissolution(
      Math.max(0, Sg - state.Sg_residual[cid]),
      state.Sg_dissolved[cid],
      cell.porosity,
      cell.kHorizontal,
      dz,
      G,
      MU_BRINE,
      DT,
      dissParams,
    )
    if (dDissolved > 0) {
      Sg -= dDissolved
      state.Sg_dissolved[cid] += dDissolved
    }

    // ── Mineral trapping ───────────────────────────────────────────────────
    const lithology = (cell as any).__lithology as LithologyType | undefined
    if (state.Sg_dissolved[cid] > 0.001) {
      const dMineral = applyMineralTrapping(
        state.Sg_dissolved[cid],
        lithology ?? 'sandstone',
        temperature,
        year,
      )
      state.Sg_dissolved[cid] -= dMineral
      state.Sg_mineral[cid]   += dMineral
    }

    // ── Update cell CO2 phase ─────────────────────────────────────────────
    const totalImmobile = state.Sg_residual[cid] + state.Sg_dissolved[cid] + state.Sg_mineral[cid]

    // Assign phase to display: most "interesting" phase wins
    const freeFinal = Math.max(0, Sg - state.Sg_residual[cid])
    if (state.Sg_mineral[cid] > 0.005 && state.Sg_mineral[cid] >= state.Sg_dissolved[cid] * 0.5) {
      cell.co2Phase = 'mineral'
      cell.co2Saturation = state.Sg_mineral[cid]
    } else if (state.Sg_dissolved[cid] > 0.008) {
      cell.co2Phase = 'dissolved'
      cell.co2Saturation = state.Sg_dissolved[cid]
    } else if (state.Sg_residual[cid] > 0.005 && freeFinal < 0.01) {
      cell.co2Phase = 'residual'
      cell.co2Saturation = state.Sg_residual[cid]
    } else if (Sg > 0.003) {
      cell.co2Phase = 'free'
      cell.co2Saturation = Sg
    } else {
      cell.co2Phase = 'none'
      cell.co2Saturation = 0
    }

    // Track previous step for imbibition detection
    state.prevSg[cid] = Sg
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5 — Stress-dependent permeability & porosity evolution
  //   Pore pressure increase reduces effective stress, opening micro-fractures
  //   and increasing permeability.  Model: k = k₀ · exp(c_k · α · ΔP)
  //   where c_k = stress sensitivity (~0.03 MPa⁻¹), α = Biot coefficient (~0.7).
  //   Porosity follows via power-law: φ/φ₀ = (k/k₀)^(1/3) (Kozeny-Carman scaling).
  // ═══════════════════════════════════════════════════════════════════════════
  const dP = fluid.pressureIncrease ?? 0
  if (dP > 0.01) {
    const ck = STRESS_SENSITIVITY
    const alpha = DEFAULT_BIOT
    for (let cid = 0; cid < cellCount; cid++) {
      const cell = cells[cid]
      if (cell.isCaprock) continue

      const well = wells.length > 0 ? wells[0] : null
      let dP_local = dP
      if (well) {
        const dx = cell.centerX - well.x
        const dy = cell.centerY - well.z
        const r = Math.sqrt(dx * dx + dy * dy)
        const r_inj = INJECTION_RADIUS
        dP_local = dP * Math.exp(-(r * r) / (2 * r_inj * r_inj))
      }

      const kMult = Math.exp(ck * alpha * dP_local)
      const kClamped = Math.max(0.3, Math.min(5, kMult))
      cell.kHorizontal = cell.kHorizontal0 * kClamped
      cell.kVertical = cell.kVertical0 * kClamped
      cell.porosity = Math.max(0.01, Math.min(0.55, cell.porosity0 * Math.pow(kClamped, 0.3)))
    }
  }
}
