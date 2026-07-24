import { useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useGeologicalStore } from '../../store/geologicalStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { geologicalModelToGrid } from '../../utils/geologicalModelToGrid'
import { SimulationGrid, GRID_MAX_CELLS } from '../../engine/grid/SimulationGrid'
import type { PressureFieldPoint } from '../../types'

// ── Scene scale constants (match existing ReservoirViewer coordinate space) ─
const SCENE_W = 3.0   // XZ full width (matches existing w=3 in FormationMesh)
const SCENE_H_BASE = 0.5  // baseline height; scaled by thickness below

// Gap between cells (fraction of cell size) — makes grid lines visible
const CELL_GAP = 0.07

export interface GridReservoirHandle {
  /** Called by Phase 2 solver each step to push updated colors to GPU */
  updateCO2Colors: () => void
  /** Access to the underlying SimulationGrid for the solver */
  grid: SimulationGrid | null
}

const GridReservoir = forwardRef<GridReservoirHandle>((_, ref) => {
  const meshRef  = useRef<THREE.InstancedMesh>(null)
  const gridRef  = useRef<SimulationGrid | null>(null)

  const model    = useGeologicalStore((s) => s.model)
  const gridNx   = useGeologicalStore((s) => s.gridNx)
  const gridNy   = useGeologicalStore((s) => s.gridNy)
  const gridNz   = useGeologicalStore((s) => s.gridNz)
  const result   = useSimulationStore((s) => s.result)
  const colorProperty = useUIStore((s) => s.colorProperty)
  const geomechanics  = useSimulationStore((s) => s.geomechanics)
  const pressureField = useSimulationStore((s) => s.result?.pressureField) as PressureFieldPoint[] | undefined
  const initPressure  = useSimulationStore((s) => s.result?.injectionPressure)

  // ── Build grid from geological model ──────────────────────────────────────
  const gridData = useMemo(
    () => geologicalModelToGrid(model, gridNx, gridNy, gridNz),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model.zones, model.faults, model.modelWidthM, model.modelLengthM, gridNx, gridNy, gridNz],
  )

  const simGrid = useMemo(() => new SimulationGrid(gridData), [gridData])

  // Keep ref in sync so Phase 2 solver can access it without re-renders
  useEffect(() => { gridRef.current = simGrid }, [simGrid])

  // ── Scene dimensions ───────────────────────────────────────────────────────
  const sceneH = useMemo(() => {
    const totalM = gridData.totalThicknessM
    return totalM > 0 ? Math.max(0.3, SCENE_H_BASE + totalM / 500) : SCENE_H_BASE
  }, [gridData.totalThicknessM])

  // ── Unit box geometry (per-instance scale applied in matrix effect) ────────
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  // ── Set instance matrices (positions + scale) when grid changes ───────────
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || gridData.cells.length === 0) return

    const matrix = new THREE.Matrix4()
    const hw = SCENE_W / 2
    const sceneWidths  = simGrid.cellSceneWidths(SCENE_W)
    const sceneDepths  = simGrid.cellSceneDepths(SCENE_W)
    const sceneHeights = simGrid.cellSceneHeights(sceneH)

    for (const cell of gridData.cells) {
      const px =  cell.centerX * hw
      const py =  cell.centerZ * (sceneH / 2)
      const pz =  cell.centerY * hw
      const cw_i = sceneWidths[cell.i]
      const cd_j = sceneDepths[cell.j]
      const ch_k = sceneHeights[cell.k]
      matrix.makeScale(cw_i * (1 - CELL_GAP), ch_k * (1 - CELL_GAP), cd_j * (1 - CELL_GAP))
      matrix.setPosition(px, py, pz)
      mesh.setMatrixAt(cell.instanceId, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    const scale0 = new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0))
    for (let id = gridData.cells.length; id < GRID_MAX_CELLS; id++) {
      mesh.setMatrixAt(id, scale0)
    }
  }, [gridData, sceneH, simGrid])

  // ── Apply colors ──────────────────────────────────────────────────────────
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || gridData.cells.length === 0) return
    if (colorProperty === 'geomechanics' && geomechanics && pressureField && initPressure != null) {
      simGrid.applyGeomechColors(mesh, pressureField, geomechanics, initPressure)
    } else {
      simGrid.applyColorsToMesh(mesh, result ? 'co2' : 'geology')
    }
  }, [simGrid, result, gridData, colorProperty, geomechanics, pressureField, initPressure])

  // ── Expose handle for Phase 2 solver ──────────────────────────────────────
  useImperativeHandle(ref, () => ({
    updateCO2Colors: () => {
      const mesh = meshRef.current
      const grid = gridRef.current
      if (!mesh || !grid) return
      const cp = useUIStore.getState().colorProperty
      const geo = useSimulationStore.getState().geomechanics
      const pf = useSimulationStore.getState().result?.pressureField
      const ip = useSimulationStore.getState().result?.injectionPressure
      if (cp === 'geomechanics' && geo && pf && ip != null) {
        grid.applyGeomechColors(mesh, pf, geo, ip)
      } else {
        grid.applyColorsToMesh(mesh, 'co2')
      }
    },
    get grid() { return gridRef.current },
  }))

  // ── Render ─────────────────────────────────────────────────────────────────
  if (gridData.cells.length === 0) return null

  return (
    <group position={[0, -0.4, 0]}>
      <instancedMesh
        ref={meshRef}
        args={[boxGeo, undefined, GRID_MAX_CELLS]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.75}
          metalness={0.05}
          transparent={false}
        />
      </instancedMesh>
    </group>
  )
})

GridReservoir.displayName = 'GridReservoir'
export default GridReservoir
