/**
 * Per-cell thermal property field for the VE solver.
 *
 * Computes spatially-varying CO2 density and viscosity fields based on
 * the geothermal temperature profile and Joule-Thomson cooling near the
 * injection wellbore. Both effects are computed analytically using the
 * existing thermalEffects module — no new PDE is needed.
 *
 * Temperature at each grid cell:
 *   T(i,j) = T_reservoir(depth) + dT_JT(r_ij, t)
 *
 * where r_ij is the distance from cell centre to the nearest injection well.
 * T feeds directly into the Span-Wagner density (co2DensityWithImpurities)
 * and Fenghour viscosity (co2ViscosityFenghour) correlations.
 *
 * References:
 *   Benson & Cole (2008) "CO2 Sequestration in Deep Sedimentary Formations"
 *   Mathias et al. (2010) "Approximate solutions for pressure buildup during CO2 injection"
 */

import type { VEGrid } from '../ve/VESolver'
import { effectiveTemperature, type ThermalParams } from '../plume/thermalEffects'
import { co2DensityWithImpurities } from './pengrobin'
import { co2ViscosityFenghour } from './viscosity'

export interface ThermalFieldInput {
  grid: VEGrid
  /** Formation top depth (m TVD, positive downward) */
  topDepth_m: number
  /** Gross formation thickness (m) */
  thickness_m: number
  /** Current reservoir pressure (MPa) */
  pressure_MPa: number
  /** Wellhead injection pressure (MPa) — used for JT cooling dP */
  wellheadPressure_MPa: number
  /** Current simulation year */
  year: number
  /** Injection well positions as grid indices */
  wellIndices: Array<{ i: number; j: number }>
  /** Thermal parameters */
  thermalParams: ThermalParams
  /** Methane mole fraction (0-1) — for Span-Wagner impure CO2 */
  methaneFrac?: number
  /** Nitrogen mole fraction (0-1) — for Span-Wagner impure CO2 */
  nitrogenFrac?: number
}

export interface ThermalFieldOutput {
  /** Per-cell CO2 density (kg/m3), row-major Float32Array of length nx*ny */
  densityField: Float32Array
  /** Per-cell CO2 viscosity (Pa*s), row-major Float32Array of length nx*ny */
  viscosityField: Float32Array
  /** Domain-averaged temperature (C) — for diagnostics */
  meanTemperature_C: number
}

/**
 * Compute per-cell CO2 density and viscosity from the thermal field.
 *
 * The formation mid-point depth is used for each cell (uniform for a flat
 * horizontal formation). For dipping formations, this gives the correct
 * domain-average temperature — cell-by-cell depth correction would require
 * the topDepthField from the structural module and can be added later.
 */
export function computeThermalPropertyField(input: ThermalFieldInput): ThermalFieldOutput {
  const { grid, topDepth_m, thickness_m, pressure_MPa, wellheadPressure_MPa,
          year, wellIndices, thermalParams, methaneFrac = 0, nitrogenFrac = 0 } = input
  const { nx, ny, dx_m, dy_m } = grid
  const n = nx * ny

  // Formation mid-point depth — used for T(depth)
  const midDepth_m = topDepth_m + 0.5 * thickness_m

  // Reservoir pressure in Pa (for EOS calls)
  const P_Pa = Math.max(0.5e6, Math.min(80e6, pressure_MPa * 1e6))

  const densityField  = new Float32Array(n)
  const viscosityField = new Float32Array(n)
  let sumT = 0

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i

      // Physical cell centre coordinates (m from domain corner)
      const x_m = (i + 0.5) * dx_m
      const y_m = (j + 0.5) * dy_m

      // Distance to nearest injection well (m)
      let r_min = Infinity
      for (const w of wellIndices) {
        const wx_m = (w.i + 0.5) * dx_m
        const wy_m = (w.j + 0.5) * dy_m
        const r = Math.sqrt((x_m - wx_m) ** 2 + (y_m - wy_m) ** 2)
        if (r < r_min) r_min = r
      }
      // Minimum physical radius = 1 m (avoid log singularity in erfc at r=0)
      const r_m = Math.max(1, r_min)

      // Effective temperature at this cell
      const T_C = effectiveTemperature(
        r_m,
        Math.max(0.01, year),
        midDepth_m,
        wellheadPressure_MPa,
        pressure_MPa,
        thermalParams,
      )
      const T_K = T_C + 273.15
      sumT += T_C

      // Span-Wagner CO2 density at local T and reservoir P
      const rhoRaw = co2DensityWithImpurities(T_K, P_Pa, methaneFrac, nitrogenFrac)
      const rho = (Number.isFinite(rhoRaw) && rhoRaw > 0 && rhoRaw < 1100) ? rhoRaw : 700

      // Fenghour viscosity at local T and density
      const mu = co2ViscosityFenghour(T_K, rho)

      densityField[k]   = rho
      viscosityField[k] = mu
    }
  }

  return {
    densityField,
    viscosityField,
    meanTemperature_C: sumT / n,
  }
}
