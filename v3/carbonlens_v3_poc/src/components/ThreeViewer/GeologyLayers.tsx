import { useMemo } from 'react'
import * as THREE from 'three'
import { useGeologicalStore } from '../../store/geologicalStore'
import { StratigraphicZone } from '../../types/geological'
import { LITHOLOGY_DEFAULTS } from '../../data/lithologyDefaults'

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

function computeHorizonY(
  normX: number, normZ: number,
  zone: StratigraphicZone,
  scaleY: number
): number {
  const p = zone.horizonParams
  switch (zone.horizonShape) {
    case 'tilted': {
      const dip = (p.dipAngle ?? 5) * Math.PI / 180
      return -Math.tan(dip) * normX * scaleY * 0.5
    }
    case 'anticline': {
      const amp = (p.foldAmplitude ?? 50) / 1000
      return Math.sin(normX * Math.PI) * amp * scaleY
    }
    case 'dome': {
      const r = normX * normX + normZ * normZ
      return Math.max(0, 1 - r * 4) * (p.domeAmplitude ?? 80) / 1000 * scaleY
    }
    case 'wedge': {
      return normX * (p.foldAmplitude ?? 30) / 1000 * scaleY * -0.5
    }
    default:
      return 0
  }
}

interface LayerMeshProps {
  zone: StratigraphicZone
  minDepth: number
  totalThickness: number
  modelScaleXZ: number
}

function LayerMesh({ zone, minDepth, totalThickness, modelScaleXZ }: LayerMeshProps) {
  const segments = 20

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(modelScaleXZ * 2, modelScaleXZ * 2, segments, segments)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const scaleY = modelScaleXZ / (totalThickness > 0 ? totalThickness / 300 : 1)

    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= segments; j++) {
        const idx = (i * (segments + 1) + j) * 3
        const normX = (j / segments) * 2 - 1
        const normZ = (i / segments) * 2 - 1
        pos.array[idx + 1] = computeHorizonY(normX, normZ, zone, 0.3)
      }
    }
    geo.computeVertexNormals()
    return geo
  }, [zone.horizonShape, zone.horizonParams, modelScaleXZ, totalThickness])

  const depthNorm = (zone.topDepth - minDepth) / (totalThickness || 1)
  const yPos = 0.5 - depthNorm
  const thickNorm = zone.thickness / (totalThickness || 1)
  const [r, g, b] = hexToRgb(zone.color)

  return (
    <group position={[0, yPos, 0]}>
      {/* Top surface */}
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color={new THREE.Color(r, g, b)}
          transparent
          opacity={zone.isCaprock ? 0.35 : 0.55}
          side={THREE.DoubleSide}
          wireframe={zone.isCaprock}
        />
      </mesh>
      {/* Thin volume box representing the zone thickness */}
      <mesh position={[0, -thickNorm / 2, 0]}>
        <boxGeometry args={[modelScaleXZ * 2, thickNorm, modelScaleXZ * 2]} />
        <meshStandardMaterial
          color={new THREE.Color(r, g, b)}
          transparent
          opacity={zone.isCaprock ? 0.12 : 0.20}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}

export default function GeologyLayers() {
  const { model } = useGeologicalStore()

  if (model.zones.length === 0) return null

  const sorted = [...model.zones].sort((a, b) => a.topDepth - b.topDepth)
  const minDepth = sorted[0].topDepth
  const lastZone = sorted[sorted.length - 1]
  const totalThickness = lastZone.topDepth + lastZone.thickness - minDepth
  const modelScaleXZ = 1.5

  return (
    <group>
      {sorted.map((zone) => (
        <LayerMesh
          key={zone.id}
          zone={zone}
          minDepth={minDepth}
          totalThickness={totalThickness}
          modelScaleXZ={modelScaleXZ}
        />
      ))}
    </group>
  )
}
