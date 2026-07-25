/**
 * Structural top-surface depth map for the VE solver.
 *
 * Converts geological horizon shape parameters (dip, anticline, dome) into
 * a per-cell formation top depth array D(i,j) [m TVD, positive downward].
 *
 * This feeds the VESolver's structural dip correction:
 *   gravity flux proportional to grad(eta - 2*D) instead of grad(eta) alone
 *
 * CO2 migrates up structural dip (toward smaller D = shallower depths),
 * pooling at anticline crests and dome apices.
 *
 * Reference: Nilsen, H.M. et al. (2012) "Characterization of CO2 storage
 * capacity based on a top-surface grid." Comput. Geosci. 16(2):399-416.
 */

import type { VEGrid } from '../ve/VESolver'
import type { HorizonShape, HorizonShapeParams } from '../../types/geological'

export interface StructuralMapInput {
  grid: VEGrid
  /** Formation top depth at model centre (m TVD) */
  baseDepth_m: number
  horizonShape: HorizonShape
  params: HorizonShapeParams
  /** Physical model extent (m) — same as modelWidthM on GeologicalModel */
  modelWidth_m: number
  modelLength_m: number
}

/**
 * Build a Float32Array of length nx*ny containing the formation top depth (m TVD)
 * at each cell centre. Positive downward; smaller values = shallower = up-dip.
 *
 * Supported shapes:
 *  flat          — uniform depth (returns constant array)
 *  tilted        — planar dip (dipAngle, dipAzimuth)
 *  anticline     — sinusoidal fold (foldAmplitude, foldWavelength, foldAxisAzimuth)
 *  dome          — Gaussian dome (domeRadius, domeAmplitude)
 *  imported      — user-supplied depth offset grid (importedGrid)
 *  others        — treated as flat (safe fallback)
 */
export function buildTopDepthField(input: StructuralMapInput): Float32Array {
  const { grid, baseDepth_m, horizonShape, params, modelWidth_m, modelLength_m } = input
  const { nx, ny } = grid
  const n = nx * ny
  const field = new Float32Array(n).fill(baseDepth_m)

  // Cell dimensions in model coordinates (m)
  const cx = modelWidth_m  / nx
  const cy = modelLength_m / ny

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      // Cell centre offset from model centre (m)
      const dx = (i + 0.5) * cx - modelWidth_m  / 2
      const dy = (j + 0.5) * cy - modelLength_m / 2

      let dD = 0  // depth offset from baseDepth (positive = deeper)

      switch (horizonShape) {
        case 'flat':
          dD = 0
          break

        case 'tilted': {
          const dipRad = ((params.dipAngle ?? 2) * Math.PI) / 180
          const azRad  = ((params.dipAzimuth ?? 0) * Math.PI) / 180
          // Down-dip direction vector (unit vector pointing in dip direction in plan)
          const ux = Math.sin(azRad)
          const uy = Math.cos(azRad)
          // Projection of cell position onto down-dip direction
          const distDownDip = dx * ux + dy * uy
          // Depth increases down-dip: dD = dist * tan(dip)
          dD = distDownDip * Math.tan(dipRad)
          break
        }

        case 'anticline': {
          const amp = params.foldAmplitude ?? 50           // m
          const wav = Math.max(1, params.foldWavelength ?? 5000)  // m
          const axRad = ((params.foldAxisAzimuth ?? 0) * Math.PI) / 180
          // Distance perpendicular to fold axis (in plan)
          const perpDist = -dx * Math.cos(axRad) + dy * Math.sin(axRad)
          // Anticline: depth minimum at axis (dD < 0 = shallower at crest)
          dD = -amp * Math.cos((2 * Math.PI * perpDist) / wav)
          break
        }

        case 'dome': {
          const r0   = Math.max(1, params.domeRadius ?? 2000)   // m
          const amp  = params.domeAmplitude ?? 100               // m
          const r    = Math.sqrt(dx * dx + dy * dy)
          // Gaussian dome: shallowest at centre, deepens radially
          dD = -amp * Math.exp(-(r * r) / (2 * r0 * r0))
          break
        }

        case 'imported': {
          if (params.importedGrid && params.importedGrid.length > 0) {
            const nRowsImp = params.importedGrid.length
            const nColsImp = params.importedGrid[0]?.length ?? 1
            // Bilinear index into imported grid
            const fi = Math.min(nColsImp - 1, Math.max(0, Math.floor((i / nx) * nColsImp)))
            const fj = Math.min(nRowsImp - 1, Math.max(0, Math.floor((j / ny) * nRowsImp)))
            dD = params.importedGrid[fj]?.[fi] ?? 0
          }
          break
        }

        default:
          dD = 0
      }

      field[k] = baseDepth_m + dD
    }
  }

  return field
}

/**
 * Compute the maximum structural closure (m) in the depth field.
 * Closure = depth of shallowest cell subtracted from deepest cell.
 * Used for structural capacity screening (Bachu 2003).
 */
export function structuralClosure(topDepthField: Float32Array): { minDepth_m: number; maxDepth_m: number; closure_m: number } {
  let minD = Infinity
  let maxD = -Infinity
  for (let k = 0; k < topDepthField.length; k++) {
    if (topDepthField[k] < minD) minD = topDepthField[k]
    if (topDepthField[k] > maxD) maxD = topDepthField[k]
  }
  return { minDepth_m: minD, maxDepth_m: maxD, closure_m: maxD - minD }
}
