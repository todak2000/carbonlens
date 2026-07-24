/**
 * PlumeGrid — high-level driver for the CO2 saturation flow solver.
 *
 * Owns the SolverState, receives the SimulationGrid reference,
 * fluid props from the existing engine, and well schedules.
 * Called once per animation year from the animation loop.
 */

import type { LithologyType } from '../../types/geological'
import { SimulationGrid } from '../grid/SimulationGrid'
import {
  stepSaturation,
  stepSaturationIMPES,
  makeSolverState,
  SolverState,
  FluidProps,
  WellSource,
  SaturationSolverOverrides,
} from './saturationSolver'
import { SimulationResult } from '../../types'
import { Well } from '../../types'
import type { MatchableParams } from '../historyMatching/types'

export class PlumeGrid {
  private readonly grid: SimulationGrid
  private state: SolverState
  private projectYears: number
  private wells: WellSource[]
  private _currentYear = 0
  private initialPressure: number
  private _temperatureC: number
  private _matchableOverrides: Partial<MatchableParams> | undefined

  constructor(
    grid: SimulationGrid,
    wells: Well[],
    projectYears: number,
    initialPressure: number,
    zoneLithologyMap?: Map<string, LithologyType>,
    temperatureC?: number,
    matchableOverrides?: Partial<MatchableParams>,
  ) {
    this.grid = grid
    this.projectYears = projectYears
    this.initialPressure = initialPressure
    this._temperatureC = temperatureC ?? 60
    this._matchableOverrides = matchableOverrides
    this.wells = wells.map((w) => ({
      x: w.x,
      z: w.z,
      injectionRateMtPerYear: w.injectionRate,
      rampUpYears: w.rampUpYears,
      rampDownYears: w.rampDownYears,
      perforations: w.perforations,
    }))
    this.state = makeSolverState(grid.cells.length)

    const zMap = zoneLithologyMap ?? new Map()
    for (const cell of grid.cells) {
      const lith = this._findZone(cell.zoneId, zMap)
      if (lith) (cell as any).__lithology = lith
    }
  }

  private _findZone(zoneId: string, zMap: Map<string, LithologyType>): LithologyType | undefined {
    return zMap.get(zoneId)
  }

  /** Advance the plume by one simulation year */
  step(year: number, result: SimulationResult | null, useIMPES = false): void {
    this._currentYear = year
    if (year <= 0) return

    const fluid = this._fluidFromResult(result)

    const solverOverrides: SaturationSolverOverrides | undefined = this._matchableOverrides
      ? {
          kvKhRatio: this._matchableOverrides.kvKhRatio,
          Sgr_override: this._matchableOverrides.residualGasSaturation,
          landConstant_override: this._matchableOverrides.landConstant,
        }
      : undefined

    const dims = {
      totalThicknessM: this.grid.totalThicknessM,
      modelWidthM:     this.grid.modelWidthM,
      modelLengthM:    this.grid.modelLengthM,
      dxArr:           this.grid.dxArr,
      dzArr:           this.grid.dzArr,
    }

    const solver = useIMPES ? stepSaturationIMPES : stepSaturation
    solver(
      this.grid.cells,
      this.state,
      this.grid.nx,
      this.grid.ny,
      this.grid.nz,
      dims,
      fluid,
      this.wells,
      year,
      this.projectYears,
      solverOverrides,
    )
  }

  /** Reset grid back to initial brine state */
  reset(): void {
    this.grid.resetSaturation()
    this.state = makeSolverState(this.grid.cells.length)
    this._currentYear = 0
  }

  get currentYear(): number { return this._currentYear }

  /** Aggregate trapping breakdown for the SimulationPanel HUD */
  trappingBreakdown(): {
    freeMt: number; residualMt: number; dissolvedMt: number; mineralMt: number
  } {
    let free = 0, residual = 0, dissolved = 0, mineral = 0
    const { cells } = this.grid
    for (let i = 0; i < cells.length; i++) {
      residual += this.state.Sg_residual[i] * cells[i].porosity
      dissolved += this.state.Sg_dissolved[i] * cells[i].porosity
      mineral   += this.state.Sg_mineral[i]   * cells[i].porosity
      // co2Saturation now always holds the total free CO2 (Sg) regardless of co2Phase.
      // The old guard `cells[i].co2Phase === 'free'` excluded dissolved/residual-labelled
      // cells from the free count — under-counting mobile CO2 and inflating the apparent
      // mass balance gap.  Read free CO2 directly from co2Saturation for all non-caprock cells.
      if (!cells[i].isCaprock) {
        const f = Math.max(0, cells[i].co2Saturation - this.state.Sg_residual[i])
        free += f * cells[i].porosity
      }
    }
    // Scale to Mt using average cell pore volume
    const n = cells.length
    const cellVolM3 = (this.grid.modelWidthM / this.grid.nx)
      * (this.grid.modelLengthM / this.grid.ny)
      * (this.grid.totalThicknessM / this.grid.nz)
    const poreVolAvg = cellVolM3 / n
    const rho = 650  // kg/m³ approximate
    const toMt = (sat: number) => sat * poreVolAvg * n * rho / 1e9

    return {
      freeMt:     toMt(free),
      residualMt: toMt(residual),
      dissolvedMt:toMt(dissolved),
      mineralMt:  toMt(mineral),
    }
  }

  private _fluidFromResult(result: SimulationResult | null): FluidProps {
    const injectionP = result?.injectionPressure ?? this.initialPressure
    // result.co2Viscosity is stored in mPa·s for display; saturationSolver needs Pa·s
    const visc_Pas = result?.co2Viscosity != null
      ? result.co2Viscosity / 1000  // mPa·s → Pa·s
      : 5e-5
    return {
      co2Density:   result?.co2Density    ?? 650,
      brineDensity: result?.brineDensity  ?? 1050,
      co2Viscosity: visc_Pas,
      solubility:   result?.solubility    ?? 0.5,
      temperature:  this._temperatureC,
      pressureIncrease: Math.max(0, injectionP - this.initialPressure),
    }
  }
}
