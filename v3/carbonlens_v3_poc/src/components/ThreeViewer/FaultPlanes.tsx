import { useMemo } from 'react'
import * as THREE from 'three'
import { useGeologicalStore } from '../../store/geologicalStore'

export default function FaultPlanes() {
  const { model } = useGeologicalStore()

  if (model.faults.length === 0) return null

  return (
    <group>
      {model.faults.map((fault) => {
        const isSealing = fault.sealingFactor < 0.3
        const isOpen = fault.sealingFactor > 0.7
        const color = isSealing ? '#ef4444' : isOpen ? '#10b981' : '#f59e0b'
        const opacity = isSealing ? 0.35 : 0.25

        // Convert normalised position (0-1) to Three.js coords (-1.5 to 1.5 model space)
        const px = (fault.positionX * 2 - 1) * 1.5
        const pz = (fault.positionY * 2 - 1) * 1.5
        const strikeRad = (fault.strike * Math.PI) / 180
        const dipRad = (fault.dip * Math.PI) / 180

        // Fault plane height in normalised units
        const faultH = 1.2
        // Fault plane width from length (normalised to model scale)
        const faultW = Math.min((fault.length / model.modelWidthM) * 3, 3.0)

        return (
          <group key={fault.id} position={[px, 0, pz]} rotation={[0, -strikeRad, 0]}>
            <mesh rotation={[dipRad - Math.PI / 2, 0, 0]}>
              <planeGeometry args={[faultW, faultH, 1, 1]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={opacity}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Fault trace line on top surface */}
            <lineSegments>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([
                    -faultW / 2, 0.5, 0,
                     faultW / 2, 0.5, 0,
                  ]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.8} />
            </lineSegments>
          </group>
        )
      })}
    </group>
  )
}
