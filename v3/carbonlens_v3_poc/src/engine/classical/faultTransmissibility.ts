/**
 * Fault transmissibility multipliers for the VE solver.
 *
 * Maps FaultDefinition objects (position, strike, throw, sealingFactor) to
 * per-face transmissibility multipliers on the VE Cartesian grid.
 *
 * Convention:
 *   faultMult = 0   — perfectly sealing (T_face = 0, no cross-fault flow)
 *   faultMult = 1   — fully open       (T_face unchanged)
 *
 * Note: sealingFactor on FaultDefinition is 0=sealing, 1=open — it maps
 * directly as faultMult = sealingFactor.
 *
 * Result array layout (length 2*nx*ny):
 *   [0, nx*ny)    — x-direction face mults: face between cell(i,j) and cell(i+1,j)
 *                   index = j*nx + i  (0 <= i < nx, 0 <= j < ny)
 *   [nx*ny, 2*nx*ny) — y-direction face mults: face between cell(i,j) and cell(i,j+1)
 *                   index = nx*ny + j*nx + i  (0 <= i < nx, 0 <= j < ny)
 *
 * Reference: Manzocchi et al. (1999) "Fault transmissibility multipliers
 * for flow simulation models." Pet. Geosci. 5(1):53-63.
 */

import type { VEGrid } from '../ve/VESolver'
import type { FaultDefinition } from '../../types/geological'

/**
 * Build fault transmissibility multiplier array from fault definitions.
 *
 * Each fault is rasterised onto the VE grid by projecting the fault trace
 * (centre, strike, length) onto grid faces and assigning sealingFactor as
 * the transmissibility multiplier.
 *
 * Where multiple faults cross the same face, the minimum (most sealing)
 * multiplier is used.
 *
 * @param grid       VE grid dimensions
 * @param faults     Fault definitions from GeologicalModel
 * @param modelWidth_m   Physical model width (m) — for coordinate mapping
 * @param modelLength_m  Physical model length (m)
 */
export function buildFaultMultField(
  grid: VEGrid,
  faults: FaultDefinition[],
  modelWidth_m: number,
  modelLength_m: number,
): Float32Array {
  const { nx, ny } = grid
  const n = nx * ny
  // Default: all faces fully open (mult = 1)
  const field = new Float32Array(2 * n).fill(1)

  if (faults.length === 0) return field

  const cx = modelWidth_m  / nx   // cell width (m)
  const cy = modelLength_m / ny   // cell height (m)

  for (const fault of faults) {
    const mult = Math.max(0, Math.min(1, fault.sealingFactor))  // 0=sealing, 1=open
    // Fault centre in model coordinates (m): positionX/Y are 0-1 fractions
    const fx_m = fault.positionX * modelWidth_m
    const fy_m = fault.positionY * modelLength_m
    // Fault strike: azimuth from north (degrees). Convert to radians.
    const strikeRad = (fault.strike * Math.PI) / 180
    // Fault half-length in each direction along strike
    const halfLen = Math.max(cx, fault.length / 2)
    // Direction unit vector along fault strike
    const ux = Math.sin(strikeRad)
    const uy = Math.cos(strikeRad)

    // Sample fault trace at sub-cell resolution
    const nSamples = Math.ceil(fault.length / Math.min(cx, cy)) * 4 + 1
    for (let s = 0; s <= nSamples; s++) {
      const t = (s / nSamples) * 2 * halfLen - halfLen
      const px = fx_m + t * ux
      const py = fy_m + t * uy

      // Which cell does this fault sample fall in?
      const ci = Math.floor(px / cx)
      const cj = Math.floor(py / cy)

      // Mark x-faces to left and right of this cell
      for (const di of [-1, 0]) {
        const fi = ci + di
        if (fi >= 0 && fi < nx - 1 && cj >= 0 && cj < ny) {
          const idx = cj * nx + fi
          field[idx] = Math.min(field[idx], mult)
        }
      }
      // Mark y-faces above and below this cell
      for (const dj of [-1, 0]) {
        const fj = cj + dj
        if (ci >= 0 && ci < nx && fj >= 0 && fj < ny - 1) {
          const idx = n + fj * nx + ci
          field[idx] = Math.min(field[idx], mult)
        }
      }
    }
  }

  return field
}
