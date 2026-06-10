import { useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useGeologicalStore } from '../../store/geologicalStore'
import { useSimulationStore } from '../../store/simulationStore'
import { geologicalModelToGrid } from '../../utils/geologicalModelToGrid'
import { SimulationGrid, GRID_NX, GRID_NY, GRID_NZ, GRID_CELL_COUNT } from '../../engine/grid/SimulationGrid'

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
  const result   = useSimulationStore((s) => s.result)

  // ── Build grid from geological model ──────────────────────────────────────
  const gridData = useMemo(
    () => geologicalModelToGrid(model, GRID_NX, GRID_NY, GRID_NZ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model.zones, model.faults, model.modelWidthM, model.modelLengthM],
  )

  const simGrid = useMemo(() => new SimulationGrid(gridData), [gridData])

  // Keep ref in sync so Phase 2 solver can access it without re-renders
  useEffect(() => { gridRef.current = simGrid }, [simGrid])

  // ── Scene dimensions ───────────────────────────────────────────────────────
  const { sceneH, cw, cd, ch } = useMemo(() => {
    const totalM = gridData.totalThicknessM
    const sceneH = totalM > 0 ? Math.max(0.3, SCENE_H_BASE + totalM / 500) : SCENE_H_BASE
    const { cw, cd, ch } = simGrid.cellSceneDimensions(SCENE_W, sceneH)
    return { sceneH, cw, cd, ch }
  }, [gridData.totalThicknessM, simGrid])

  // ── Cell box geometry (shared across all instances) ───────────────────────
  const boxGeo = useMemo(
    () => new THREE.BoxGeometry(cw * (1 - CELL_GAP), ch * (1 - CELL_GAP), cd * (1 - CELL_GAP)),
    [cw, ch, cd],
  )

  // ── Set instance matrices (positions) when grid changes ───────────────────
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || gridData.cells.length === 0) return

    const matrix = new THREE.Matrix4()
    const hw = SCENE_W / 2     // half-width for centering

    for (const cell of gridData.cells) {
      // centerX/centerY/centerZ are in [-1, 1] range (from geologicalModelToGrid)
      const px =  cell.centerX * hw        // -1.5 → 1.5
      const py =  cell.centerZ * (sceneH / 2)  // centerZ: 1=top, -1=base
      const pz =  cell.centerY * hw        // -1.5 → 1.5
      matrix.makeTranslation(px, py, pz)
      mesh.setMatrixAt(cell.instanceId, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [gridData, sceneH])

  // ── Apply initial colors (geology/lithology view) ─────────────────────────
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || gridData.cells.length === 0) return
    simGrid.applyColorsToMesh(mesh, result ? 'co2' : 'geology')
  }, [simGrid, result, gridData])

  // ── Expose handle for Phase 2 solver ──────────────────────────────────────
  useImperativeHandle(ref, () => ({
    updateCO2Colors: () => {
      const mesh = meshRef.current
      if (!mesh || !gridRef.current) return
      gridRef.current.applyColorsToMesh(mesh, 'co2')
    },
    get grid() { return gridRef.current },
  }))

  // ── Render ─────────────────────────────────────────────────────────────────
  if (gridData.cells.length === 0) return null

  return (
    <group position={[0, -0.4, 0]}>
      <instancedMesh
        ref={meshRef}
        args={[boxGeo, undefined, GRID_CELL_COUNT]}
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
