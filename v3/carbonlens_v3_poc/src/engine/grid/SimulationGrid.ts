import { GridCell, SimulationGridData } from '../../utils/geologicalModelToGrid'
import { saturationToColor, lithologyToColor, safetyFactorToColor } from '../../utils/colorMapping'
import * as THREE from 'three'
import type { PressureFieldPoint, GeomechanicsResult } from '../../types'

export const GRID_NX = 60
export const GRID_NY = 60
export const GRID_NZ = 20
export const GRID_CELL_COUNT = GRID_NX * GRID_NY * GRID_NZ  // 72 000 cells (default)
export const GRID_MAX_CELLS  = 100 * 100 * 30               // 300 000 — hard upper bound for InstancedMesh allocation

/**
 * SimulationGrid wraps SimulationGridData and provides:
 * - O(1) cell lookup by (i,j,k)
 * - In-place saturation updates (used by the flow solver in Phase 2)
 * - Color buffer generation for InstancedMesh GPU upload
 */
export class SimulationGrid {
  readonly cells: GridCell[]
  readonly nx: number
  readonly ny: number
  readonly nz: number
  readonly modelWidthM: number
  readonly modelLengthM: number
  readonly totalThicknessM: number
  readonly minDepthM: number
  readonly maxDepthM: number
  readonly dxArr: Float32Array
  readonly dyArr: Float32Array
  readonly dzArr: Float32Array

  // Flat index lookup: index(i,j,k) = k*ny*nx + j*nx + i
  private readonly _idx: (i: number, j: number, k: number) => number

  constructor(data: SimulationGridData) {
    this.cells          = data.cells
    this.nx             = data.nx
    this.ny             = data.ny
    this.nz             = data.nz
    this.modelWidthM    = data.modelWidthM
    this.modelLengthM   = data.modelLengthM
    this.totalThicknessM = data.totalThicknessM
    this.minDepthM      = data.minDepthM
    this.maxDepthM      = data.maxDepthM
    this.dxArr          = data.dxArr
    this.dyArr          = data.dyArr
    this.dzArr          = data.dzArr
    const nx = data.nx, ny = data.ny
    this._idx = (i, j, k) => k * ny * nx + j * nx + i
  }

  /** Get cell by grid coordinates. Returns undefined if out of bounds. */
  getCell(i: number, j: number, k: number): GridCell | undefined {
    if (i < 0 || i >= this.nx || j < 0 || j >= this.ny || k < 0 || k >= this.nz) return undefined
    return this.cells[this._idx(i, j, k)]
  }

  /** Get caprock k-index (topmost layer = k=0) */
  get caprockKIndex(): number { return 0 }

  /** Reset all CO2 saturations to zero */
  resetSaturation(): void {
    for (const cell of this.cells) {
      cell.co2Saturation = 0
      cell.co2Phase = 'none'
      cell.pressure = 0
    }
  }

  /**
   * Write per-instance colors into a THREE.InstancedMesh.
   * Call mesh.instanceColor!.needsUpdate = true after.
   * @param mesh  The InstancedMesh to update
   * @param mode  'geology' = lithology/property view (pre-sim)
   *              'co2'     = CO2 saturation view (during/after sim)
   */
  applyColorsToMesh(mesh: THREE.InstancedMesh, mode: 'geology' | 'co2'): void {
    const color = new THREE.Color()
    for (const cell of this.cells) {
      const rgb = mode === 'co2'
        ? saturationToColor(cell.co2Saturation, cell.co2Phase, cell.isCaprock)
        : lithologyToColor(cell, cell.isCaprock)
      color.setRGB(rgb[0], rgb[1], rgb[2])
      mesh.setColorAt(cell.instanceId, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  /**
   * Update colors for only the cells that changed this step.
   * More efficient than full re-upload during animation.
   */
  applyColorsDirty(mesh: THREE.InstancedMesh, dirtyIds: number[]): void {
    const color = new THREE.Color()
    for (const id of dirtyIds) {
      const cell = this.cells[id]
      if (!cell) continue
      const rgb = saturationToColor(cell.co2Saturation, cell.co2Phase, cell.isCaprock)
      color.setRGB(rgb[0], rgb[1], rgb[2])
      mesh.setColorAt(id, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  /** Scene-space cell dimensions for this grid */
  cellSceneDimensions(sceneW: number, sceneH: number): { cw: number; cd: number; ch: number } {
    return {
      cw: sceneW / this.nx,
      cd: sceneW / this.ny,
      ch: sceneH / this.nz,
    }
  }

  cellSceneWidths(sceneW: number): Float32Array {
    const arr = new Float32Array(this.nx)
    for (let i = 0; i < this.nx; i++) arr[i] = (this.dxArr[i] / this.modelWidthM) * sceneW
    return arr
  }

  cellSceneDepths(sceneW: number): Float32Array {
    const arr = new Float32Array(this.ny)
    for (let j = 0; j < this.ny; j++) arr[j] = (this.dyArr[j] / this.modelLengthM) * sceneW
    return arr
  }

  cellSceneHeights(sceneH: number): Float32Array {
    const arr = new Float32Array(this.nz)
    for (let k = 0; k < this.nz; k++) arr[k] = (this.dzArr[k] / this.totalThicknessM) * sceneH
    return arr
  }

  applyGeomechColors(
    mesh: THREE.InstancedMesh,
    pressureField: PressureFieldPoint[],
    geomechanics: GeomechanicsResult,
    initPressureMPa: number,
  ): void {
    const color = new THREE.Color()
    const globalSF = geomechanics.safetyFactor
    const maxExcess = geomechanics.maip - initPressureMPa

    for (const cell of this.cells) {
      let nearestP = initPressureMPa
      let minDist = Infinity
      for (const pt of pressureField) {
        const dx = pt.x - cell.centerX
        const dz = pt.z - cell.centerY
        const d = dx * dx + dz * dz
        if (d < minDist) { minDist = d; nearestP = pt.pressure }
      }
      const excess = Math.max(0, nearestP - initPressureMPa)
      const fraction = maxExcess > 0 ? Math.min(1, excess / maxExcess) : 0
      const localSF = globalSF - fraction * Math.max(0, globalSF - 1.0)
      const rgb = safetyFactorToColor(localSF)
      color.setRGB(rgb[0], rgb[1], rgb[2])
      mesh.setColorAt(cell.instanceId, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }
}
