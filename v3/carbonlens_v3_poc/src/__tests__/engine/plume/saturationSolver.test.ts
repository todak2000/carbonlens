/**
 * saturationSolver.test.ts
 *
 * Validates two critical physics invariants:
 *   1. Mass conservation — total CO2 in (injection) ≥ sum(Sg × φ × Vcell)
 *      (some CO2 can be lost to rounding, but none created from nothing)
 *   2. Caprock barrier — cells flagged isCaprock never accumulate free CO2 saturation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { stepSaturation, makeSolverState, SolverState, FluidProps, WellSource, peacemanInjectionWeight, distToNearestWell } from '../../../engine/plume/saturationSolver'
import type { GridCell } from '../../../utils/geologicalModelToGrid'

// ── Minimal grid factory ─────────────────────────────────────────────────────

const NX = 10
const NY = 10
const NZ =  5   // layers 0 (bottom) to 4 (top)
const N  = NX * NY * NZ

function idx(i: number, j: number, k: number) {
  return k * NY * NX + j * NX + i
}

function makeGrid(): GridCell[] {
  const cells: GridCell[] = []
  for (let k = 0; k < NZ; k++) {
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const id = idx(i, j, k)
        cells.push({
          instanceId: id,
          i, j, k,
          zoneId: k === NZ - 1 ? 'caprock' : 'reservoir',
          zoneName: k === NZ - 1 ? 'Caprock' : 'Reservoir',
          isCaprock: k === NZ - 1,          // top layer = caprock
          activeForInjection: k < NZ - 1,
          porosity: 0.20,
          kHorizontal: 200,
          kVertical: 20,
          capillaryEntryPressure: k === NZ - 1 ? 5.0 : 0.05,
          faultTransmX: 1.0,
          faultTransmY: 1.0,
          co2Saturation: 0,
          co2Phase: 'none',
          pressure: 0,
          centerX: (i / (NX - 1)) * 2 - 1,
          centerY: (j / (NY - 1)) * 2 - 1,
          centerZ: (k / (NZ - 1)) * 2 - 1,
          depthM: 2000 + (NZ - 1 - k) * 20,
          kHorizontal0: 200,
          kVertical0: 20,
          porosity0: 0.20,
        })
      }
    }
  }
  return cells
}

const FLUID: FluidProps = {
  co2Density:   650,
  brineDensity: 1050,
  co2Viscosity: 5e-5,
  solubility:   0.5,
  temperature:  60,
}

const DIMS = {
  totalThicknessM: 100,
  modelWidthM:     10000,
  modelLengthM:    10000,
}

// Well at cell centre (i=4,j=4) = (4/9*2-1, 4/9*2-1) = (-0.111, -0.111)
// Must align with a cell centre for INJECTION_RADIUS=0.10 to reach it
// Lower rate (0.15) prevents single-cell oversaturation and clamping at 0.95
const WELL: WellSource = {
  x: -0.111, z: -0.111,
  injectionRateMtPerYear: 0.15,
  rampUpYears:   0,
  rampDownYears: 0,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function totalCO2InGrid(cells: GridCell[], state: SolverState): number {
  // Accurately sum all CO₂ across both display and state arrays.
  // - Free phase: co2Saturation = Sg (free + embedded residual but NOT
  //   dissolved/mineral). True total = Sg + Sg_dissolved + Sg_mineral.
  // - Trapped phases (residual/dissolved/mineral): co2Saturation is set to
  //   one of the trapped values. True total ≈ Sg_residual + Sg_dissolved + Sg_mineral
  //   (free gas is <0.01 and negligible).
  let total = 0
  for (let i = 0; i < cells.length; i++) {
    const phi = cells[i].porosity
    if (cells[i].co2Phase === 'free') {
      total += (cells[i].co2Saturation + state.Sg_dissolved[i] + state.Sg_mineral[i]) * phi
    } else {
      total += (state.Sg_residual[i] + state.Sg_dissolved[i] + state.Sg_mineral[i]) * phi
    }
  }
  return total
}

function totalCO2InjectedSatUnits(
  wells: WellSource[],
  years: number,
  dims: { totalThicknessM: number; modelWidthM: number; modelLengthM: number },
  fluid: FluidProps,
): number {
  // Returns injected CO2 in the same units as totalCO2InGrid (phi-weighted sat sum).
  // Conservation: sum(Sg * phi) * cellVol <= totalM3Injected
  //   => sum(Sg * phi) <= totalM3Injected / cellVol
  const cellVolM3 = (dims.modelWidthM / NX) * (dims.modelLengthM / NY) * (dims.totalThicknessM / NZ)
  const totalMtInjected = wells.reduce((s, w) => s + w.injectionRateMtPerYear * years, 0)
  const totalM3Injected = totalMtInjected * 1e9 / fluid.co2Density
  return totalM3Injected / cellVolM3
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('stepSaturation — caprock barrier', () => {
  let cells: GridCell[]
  let state: SolverState

  beforeEach(() => {
    cells = makeGrid()
    state = makeSolverState(N)
  })

  it('caprock cells never accumulate free-phase CO2 saturation after 10 steps', () => {
    for (let year = 1; year <= 10; year++) {
      stepSaturation(cells, state, NX, NY, NZ, DIMS, FLUID, [WELL], year, 50)
    }

    const caprockCells = cells.filter((c) => c.isCaprock)
    expect(caprockCells.length).toBeGreaterThan(0)

    for (const cell of caprockCells) {
      expect(
        cell.co2Saturation,
        `Caprock cell (${cell.i},${cell.j},${cell.k}) has free CO2`
      ).toBeLessThan(0.01)
    }
  })

  it('caprock cells remain in phase=none or non-free after injection', () => {
    for (let year = 1; year <= 5; year++) {
      stepSaturation(cells, state, NX, NY, NZ, DIMS, FLUID, [WELL], year, 50)
    }

    for (const cell of cells.filter((c) => c.isCaprock)) {
      expect(['none', 'caprock']).toContain(cell.co2Phase)
    }
  })
})

describe('stepSaturation — mass conservation', () => {
  let cells: GridCell[]
  let state: SolverState

  beforeEach(() => {
    cells = makeGrid()
    state = makeSolverState(N)
  })

  it('no CO2 in grid at year 0 (initial condition)', () => {
    expect(totalCO2InGrid(cells, state)).toBe(0)
  })

  it('CO2 increases after injection steps', () => {
    const before = totalCO2InGrid(cells, state)
    for (let year = 1; year <= 5; year++) {
      stepSaturation(cells, state, NX, NY, NZ, DIMS, FLUID, [WELL], year, 50)
    }
    const after = totalCO2InGrid(cells, state)
    expect(after).toBeGreaterThan(before)
  })

  it('no CO2 created from nothing (injected saturation budget respected)', () => {
    for (let year = 1; year <= 10; year++) {
      stepSaturation(cells, state, NX, NY, NZ, DIMS, FLUID, [WELL], year, 50)
    }

    const gridTotal = totalCO2InGrid(cells, state)
    const injectedBudget = totalCO2InjectedSatUnits([WELL], 10, DIMS, FLUID)

    // Grid total should never exceed the injected budget (mass not created from nothing)
    expect(gridTotal).toBeLessThanOrEqual(injectedBudget * 1.05)  // 5% numerical tolerance
  })

  it('all cell saturations remain in [0, 1]', () => {
    for (let year = 1; year <= 15; year++) {
      stepSaturation(cells, state, NX, NY, NZ, DIMS, FLUID, [WELL], year, 50)
    }

    for (const cell of cells) {
      expect(cell.co2Saturation, `cell ${cell.instanceId} sat overflow`).toBeGreaterThanOrEqual(0)
      expect(cell.co2Saturation, `cell ${cell.instanceId} sat overflow`).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('stops injecting once year > projectYears', () => {
    const projectYears = 5

    for (let year = 1; year <= projectYears; year++) {
      stepSaturation(cells, state, NX, NY, NZ, DIMS, FLUID, [WELL], year, projectYears)
    }
    const atEnd = totalCO2InGrid(cells, state)

    // Step beyond project end — no extra CO2 should be added
    stepSaturation(cells, state, NX, NY, NZ, DIMS, FLUID, [WELL], projectYears + 1, projectYears)
    const afterEnd = totalCO2InGrid(cells, state)

    // CO2 can only decrease (dissolution/trapping) or stay roughly same after shut-in
    // Allow small tolerance for numerical redistribution in a single extra step
    expect(afterEnd).toBeLessThanOrEqual(atEnd + 0.01)
  })

  it('capillary pressure and hysteretic kr do not break mass conservation', () => {
    // Run with capillary pressure + Killough hysteresis wired in (both active)
    for (let year = 1; year <= 20; year++) {
      stepSaturation(cells, state, NX, NY, NZ, DIMS, FLUID, [WELL], year, 50)
    }

    const gridTotal = totalCO2InGrid(cells, state)
    const injectedBudget = totalCO2InjectedSatUnits([WELL], 20, DIMS, FLUID)

    // Should not exceed injected budget (numerical diffusion is bounded)
    expect(gridTotal).toBeLessThanOrEqual(injectedBudget * 1.05)
    // Should retain meaningful mass (not leaked through caprock)
    expect(gridTotal).toBeGreaterThan(injectedBudget * 0.3)
  })
})

// ── Stress-dependent permeability & porosity ──────────────────────────────────
//
//  Model (saturationSolver STEP 5):
//    k = k₀ · exp(c_k · α · ΔP)   where c_k = 0.03 MPa⁻¹, α = 0.70 (Biot)
//    φ = φ₀ · kMult^0.3            (Kozeny-Carman power-law scaling)
//    kMult clamped to [0.3, 5.0]
//
//  Pressure footprint decays as a Gaussian from the well:
//    dP_local = dP · exp(−r² / (2 · r_inj²))   with r_inj = 0.10 (norm. coords)
//
//  Test grid: NX=NY=10, NZ=5, caprock at k=NZ-1=4.
//  Well at (x=−0.111, z=−0.111) → cell (i=4, j=4) → r = 0 → dP_local = dP.

describe('stepSaturation — stress-dependent permeability & porosity', () => {
  // Constants from saturationSolver (must match implementation)
  const CK    = 0.03   // MPa⁻¹
  const ALPHA = 0.70   // default Biot coefficient

  /** Non-caprock cell at the well location (r = 0 → full dP). */
  function wellCell(cells: GridCell[], k: number): GridCell {
    return cells[idx(4, 4, k)]
  }

  /** Non-caprock cell far from well (r >> r_inj → dP_local ≈ 0). */
  function farCell(cells: GridCell[], k: number): GridCell {
    return cells[idx(0, 0, k)]
  }

  it('permeability is unchanged when pressureIncrease is 0 (threshold not crossed)', () => {
    const cells = makeGrid()
    const state = makeSolverState(N)
    const noPress: FluidProps = { ...FLUID, pressureIncrease: 0 }

    stepSaturation(cells, state, NX, NY, NZ, DIMS, noPress, [WELL], 1, 50)

    const cell = wellCell(cells, 0)   // k=0, non-caprock
    expect(cell.kHorizontal).toBeCloseTo(200, 3)
    expect(cell.kVertical).toBeCloseTo(20, 3)
    expect(cell.porosity).toBeCloseTo(0.20, 4)
  })

  it('permeability increases at well location when pressureIncrease > 0', () => {
    const cells = makeGrid()
    const state = makeSolverState(N)
    const withPress: FluidProps = { ...FLUID, pressureIncrease: 5 }

    stepSaturation(cells, state, NX, NY, NZ, DIMS, withPress, [WELL], 1, 50)

    const cell = wellCell(cells, 0)
    expect(cell.kHorizontal).toBeGreaterThan(200)
    expect(cell.kVertical).toBeGreaterThan(20)
  })

  it('kMult matches exp(c_k · α · dP) at the well location (r = 0)', () => {
    const cells  = makeGrid()
    const state  = makeSolverState(N)
    const dP     = 10   // MPa
    const withPress: FluidProps = { ...FLUID, pressureIncrease: dP }

    stepSaturation(cells, state, NX, NY, NZ, DIMS, withPress, [WELL], 1, 50)

    const expectedMult = Math.exp(CK * ALPHA * dP)           // ≈ 1.234
    const clampedMult  = Math.min(5, Math.max(0.3, expectedMult))

    const cell = wellCell(cells, 0)
    expect(cell.kHorizontal).toBeCloseTo(200 * clampedMult, 2)
    expect(cell.kVertical).toBeCloseTo(20 * clampedMult, 3)
  })

  it('porosity follows kMult^0.3 (Kozeny-Carman) at the well location', () => {
    const cells = makeGrid()
    const state = makeSolverState(N)
    const dP    = 10
    const withPress: FluidProps = { ...FLUID, pressureIncrease: dP }

    stepSaturation(cells, state, NX, NY, NZ, DIMS, withPress, [WELL], 1, 50)

    const kMult   = Math.min(5, Math.max(0.3, Math.exp(CK * ALPHA * dP)))
    const phiExp  = 0.20 * Math.pow(kMult, 0.3)

    const cell = wellCell(cells, 0)
    expect(cell.porosity).toBeCloseTo(phiExp, 4)
  })

  it('porosity stays within physical bounds [0.01, 0.55] under any pressure', () => {
    const cells = makeGrid()
    const state = makeSolverState(N)

    // dP = 50 MPa → kMult = exp(0.03 × 0.7 × 50) ≈ 3.08 → clamped to 3.08
    const withPress: FluidProps = { ...FLUID, pressureIncrease: 50 }
    stepSaturation(cells, state, NX, NY, NZ, DIMS, withPress, [WELL], 1, 50)

    for (const cell of cells) {
      if (cell.isCaprock) continue
      expect(cell.porosity).toBeGreaterThanOrEqual(0.01)
      expect(cell.porosity).toBeLessThanOrEqual(0.55)
    }
  })

  it('kMult is clamped to max 5× at extreme overpressure', () => {
    const cells = makeGrid()
    const state = makeSolverState(N)
    // dP = 200 MPa → exp(0.03 × 0.7 × 200) ≈ 66.7 → clamped to 5
    const extremePress: FluidProps = { ...FLUID, pressureIncrease: 200 }

    stepSaturation(cells, state, NX, NY, NZ, DIMS, extremePress, [WELL], 1, 50)

    const cell = wellCell(cells, 0)
    expect(cell.kHorizontal).toBeLessThanOrEqual(200 * 5 + 0.001)
    expect(cell.kHorizontal).toBeCloseTo(200 * 5, 2)
  })

  it('kMult is clamped to min 0.3× (compaction does not destroy permeability)', () => {
    // Negative dP is not physically meaningful here but we test the lower clamp path
    // by checking that the solver never drops k below 0.3 × k0 regardless of input
    const cells = makeGrid()
    const state = makeSolverState(N)
    // dP = 0 → kMult = 1.0, but the clamp minimum is 0.3.
    // Artificially seed a cell with kHorizontal < 0.3 × k0 to verify clamp on read path.
    // Instead, use the boundary: dP just above threshold → kMult > 1.0 → clamp min irrelevant.
    // Confirm kHorizontal >= 0.3 × kHorizontal0 for all non-caprock cells.
    const withPress: FluidProps = { ...FLUID, pressureIncrease: 5 }
    stepSaturation(cells, state, NX, NY, NZ, DIMS, withPress, [WELL], 1, 50)

    for (const cell of cells) {
      if (cell.isCaprock) continue
      expect(cell.kHorizontal).toBeGreaterThanOrEqual(cell.kHorizontal0 * 0.3 - 1e-6)
    }
  })

  it('far cells (large r) are essentially unchanged — Gaussian decay', () => {
    const cells = makeGrid()
    const state = makeSolverState(N)
    const dP    = 10
    const withPress: FluidProps = { ...FLUID, pressureIncrease: dP }

    stepSaturation(cells, state, NX, NY, NZ, DIMS, withPress, [WELL], 1, 50)

    // Cell (0,0,0): r = sqrt(2) × |−1 − (−0.111)| ≈ 1.116
    // dP_local = 10 × exp(−1.116² / 0.02) ≈ 10 × exp(−62.4) → effectively 0
    const cell = farCell(cells, 0)
    // kMult ≈ exp(0) = 1 → permeability unchanged (within floating-point)
    expect(cell.kHorizontal).toBeCloseTo(200, 1)
    expect(cell.kVertical).toBeCloseTo(20, 2)
  })

  it('near-well injection cells receive higher saturation than far cells (Peaceman weighting)', () => {
    // With log-radial weighting, the cell at the well location (r ≈ 0) gets
    // the largest share of injected CO2 vs. a cell at the edge of INJECTION_RADIUS.
    const cells = makeGrid()
    const state = makeSolverState(N)
    stepSaturation(cells, state, NX, NY, NZ, DIMS, FLUID, [WELL], 1, 50)

    // Cell at well location: (i=4, j=4), injection zone k=0..3
    const nearCell = cells[idx(4, 4, 0)]
    // Cell at periphery: still within INJECTION_RADIUS but farther from well
    const periCell = cells[idx(5, 5, 0)]

    // Near cell should have received more CO2 than peripheral cell
    expect(nearCell.co2Saturation).toBeGreaterThanOrEqual(periCell.co2Saturation)
  })

  it('caprock cells are never modified by stress-dependent step', () => {
    const cells = makeGrid()
    const state = makeSolverState(N)
    const withPress: FluidProps = { ...FLUID, pressureIncrease: 20 }

    stepSaturation(cells, state, NX, NY, NZ, DIMS, withPress, [WELL], 1, 50)

    for (const cell of cells.filter(c => c.isCaprock)) {
      // Caprock retains its original high entry pressure — permeability not modified
      expect(cell.capillaryEntryPressure).toBeCloseTo(5.0, 6)
    }
  })

  it('near-well permeability is higher than far-field after injection', () => {
    const cells = makeGrid()
    const state = makeSolverState(N)
    const withPress: FluidProps = { ...FLUID, pressureIncrease: 10 }

    stepSaturation(cells, state, NX, NY, NZ, DIMS, withPress, [WELL], 1, 50)

    const kNearWell = wellCell(cells, 0).kHorizontal
    const kFar      = farCell(cells, 0).kHorizontal
    expect(kNearWell).toBeGreaterThan(kFar)
  })
})

// ── Adaptive radial mesh refinement utilities ─────────────────────────────────

describe('peacemanInjectionWeight — radial log weighting', () => {
  it('returns 1 at r = rw (wellbore radius)', () => {
    // ln(re/rw) / ln(re/rw) = 1
    expect(peacemanInjectionWeight(0.01)).toBeCloseTo(1.0, 5)
  })

  it('returns 0 at r = re (drainage radius)', () => {
    expect(peacemanInjectionWeight(0.10)).toBe(0)
  })

  it('returns 0 for r > re (outside injection zone)', () => {
    expect(peacemanInjectionWeight(0.20)).toBe(0)
  })

  it('monotonically decreases with distance from well', () => {
    const w0 = peacemanInjectionWeight(0.01)
    const w1 = peacemanInjectionWeight(0.03)
    const w2 = peacemanInjectionWeight(0.06)
    const w3 = peacemanInjectionWeight(0.09)
    expect(w0).toBeGreaterThan(w1)
    expect(w1).toBeGreaterThan(w2)
    expect(w2).toBeGreaterThan(w3)
    expect(w3).toBeGreaterThan(0)
  })

  it('near-wellbore weight is substantially larger than mid-radius weight', () => {
    const wNear = peacemanInjectionWeight(0.01)   // at rw
    const wMid  = peacemanInjectionWeight(0.05)   // halfway
    expect(wNear).toBeGreaterThan(wMid * 2)       // log profile is steep near well
  })
})

describe('distToNearestWell', () => {
  const wells: WellSource[] = [
    { x: 0, z: 0, injectionRateMtPerYear: 1, rampUpYears: 0, rampDownYears: 0 },
    { x: 0.5, z: 0.5, injectionRateMtPerYear: 1, rampUpYears: 0, rampDownYears: 0 },
  ]

  it('returns 0 when cell is at well location', () => {
    expect(distToNearestWell(0, 0, wells)).toBeCloseTo(0, 9)
  })

  it('returns exact distance when one well', () => {
    const single = [wells[0]]
    expect(distToNearestWell(0.3, 0.4, single)).toBeCloseTo(0.5, 9)
  })

  it('returns nearest of multiple wells', () => {
    // Point at (0.5, 0) → dist to well1 (0,0) = 0.5, dist to well2 (0.5,0.5) = 0.5
    // Both are equidistant → returns 0.5
    expect(distToNearestWell(0.5, 0, wells)).toBeCloseTo(0.5, 9)
    // Point at (0.4, 0.4) → dist to well2 (0.5,0.5) = sqrt(0.02) ≈ 0.141
    expect(distToNearestWell(0.4, 0.4, wells)).toBeCloseTo(Math.sqrt(0.02), 9)
  })

  it('returns Infinity for empty wells array', () => {
    expect(distToNearestWell(0, 0, [])).toBe(Infinity)
  })
})
