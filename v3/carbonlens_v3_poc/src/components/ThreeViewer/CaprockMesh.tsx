/**
 * CaprockMesh — semi-transparent teal plane marking the caprock seal in grid view.
 *
 * Rendered inside group [0, -0.4, 0] to align with GridReservoir.
 * Two layers:
 *   1. Filled plane: teal, ~12% opacity — hints at the seal without blocking view
 *   2. Edge outline: lineSegments of EdgesGeometry — bright teal, clearly marks the boundary
 */
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useUIStore } from '../../store/uiStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useFormationStore } from '../../store/formationStore'

const SCENE_W = 3.0

export default function CaprockMesh() {
  const showGridView = useUIStore((s) => s.showGridView)
  const result       = useSimulationStore((s) => s.result)
  const isAnimating  = useSimulationStore((s) => s.isAnimating)
  const thickness    = useFormationStore((s) => s.params.thickness)
  // BUG-04 fix: match GridReservoir's SCENE_H_BASE=0.5 formula so caprock sits at exact top cell boundary
  const h            = Math.max(0.3, 0.5 + thickness / 500)
  const CAPROCK_Y    = h / 2
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  // Pulse opacity when CO2 is actively injecting
  useFrame(({ clock }) => {
    if (!matRef.current) return
    if (isAnimating && result) {
      const pulse = 0.08 + 0.05 * Math.sin(clock.getElapsedTime() * 1.4)
      matRef.current.opacity = pulse
    } else {
      matRef.current.opacity = result ? 0.10 : 0.06
    }
  })

  const edgesGeo = useMemo(() => {
    const plane = new THREE.PlaneGeometry(SCENE_W * 0.985, SCENE_W * 0.985)
    return new THREE.EdgesGeometry(plane)
  }, [])

  if (!showGridView) return null

  return (
    <group position={[0, -0.4, 0]}>
      {/* Filled surface — low opacity seal indicator */}
      <mesh position={[0, CAPROCK_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SCENE_W * 0.985, SCENE_W * 0.985]} />
        <meshBasicMaterial
          ref={matRef}
          color="#00c4a0"
          transparent
          opacity={0.06}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Edge outline — bright teal border */}
      <lineSegments
        geometry={edgesGeo}
        position={[0, CAPROCK_Y + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <lineBasicMaterial color="#00e8c0" transparent opacity={0.65} />
      </lineSegments>

      {/* Second outline slightly below — creates a subtle depth band */}
      <lineSegments
        geometry={edgesGeo}
        position={[0, CAPROCK_Y - 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <lineBasicMaterial color="#14b8a6" transparent opacity={0.30} />
      </lineSegments>
    </group>
  )
}
