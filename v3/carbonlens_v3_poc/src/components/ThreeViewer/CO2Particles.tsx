/**
 * CO2Particles — Three.js Points-based particle system for grid view mode.
 *
 * Uses ParticleEngine for all lifecycle logic (emit → rise → caprock →
 * lateral spread → trap/dissolve/recycle) and updates GPU buffers each frame
 * via useFrame. Designed to work alongside GridReservoir.
 *
 * Particle coordinates match the grid scene space:
 *   X/Z: -1.5 to +1.5 (SCENE_W = 3.0)
 *   Y:   -0.25 to +0.25 (SCENE_H_BASE = 0.5)
 *   Group is offset down by 0.4 to align with GridReservoir origin.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useFormationStore } from '../../store/formationStore'
import {
  ParticleEngine,
  ParticleSource,
  ParticleEngineConfig,
  MAX_PARTICLES,
} from '../../engine/plume/particleEngine'

const SCENE_W = 3.0
const HALF_W  = SCENE_W / 2   // 1.5

export default function CO2Particles() {
  const result      = useSimulationStore((s) => s.result)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const timestep    = useUIStore((s) => s.timestep)
  const wells       = useFormationStore((s) => s.wells)
  const thickness   = useFormationStore((s) => s.params.thickness)

  const h            = 0.3 + thickness / 500
  const CAPROCK_Y    = h / 2 - 0.005
  const RESERVOIR_BOT_Y = -h / 2 + 0.005

  const pointsRef = useRef<THREE.Points>(null)

  // Stable engine instance — never re-created between renders
  const engine = useMemo(() => new ParticleEngine(), [])

  // Reset engine when simulation resets (timestep goes to 0)
  const prevTimestep = useRef(0)
  if (timestep === 0 && prevTimestep.current !== 0) {
    engine.reset()
  }
  prevTimestep.current = timestep

  // Sprite texture — soft radial gradient dot
  const dotTex = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 32; cv.height = 32
    const ctx = cv.getContext('2d')!
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    g.addColorStop(0.00, 'rgba(255,255,255,1.0)')
    g.addColorStop(0.18, 'rgba(255,255,255,0.85)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.25)')
    g.addColorStop(1.00, 'rgba(255,255,255,0.0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 32, 32)
    const t = new THREE.CanvasTexture(cv)
    t.needsUpdate = true
    return t
  }, [])

  // THREE.BufferGeometry backed directly by engine's typed arrays
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(engine.positions, 3))
    g.setAttribute('color',    new THREE.BufferAttribute(engine.colors,    3))
    g.setAttribute('size',     new THREE.BufferAttribute(engine.sizes,     1))
    return g
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  useFrame((_, delta) => {
    if (!result) return

    // Build well sources from formation store wells
    const sources: ParticleSource[] = wells
      .filter((w) => w.injectionRate > 0)
      .map((w) => ({
        x: w.x,
        z: w.z,
        injectionRateMtPerYear: w.injectionRate,
      }))

    // Trapping fractions from result (used for probabilistic state transitions)
    const total = Math.max(0.001, result.storageCapacity)
    const dissolvedFrac = Math.min(1, result.solubilityTrapping / total)
    const residualFrac  = Math.min(1, result.residualTrapping   / total)

    const cfg: ParticleEngineConfig = {
      caprockY:        CAPROCK_Y,
      reservoirBottomY: RESERVOIR_BOT_Y,
      sceneHalfW:      HALF_W,
      dissolvedFraction: dissolvedFrac,
      residualFraction:  residualFrac,
    }

    engine.tick(delta, sources, cfg, isAnimating)

    if (pointsRef.current) {
      const g = pointsRef.current.geometry
      g.attributes.position.needsUpdate = true
      g.attributes.color.needsUpdate    = true
      g.attributes.size.needsUpdate     = true
      g.drawRange.count = MAX_PARTICLES
    }
  })

  // Don't render before simulation has started
  if (!result) return null

  return (
    // Offset matches GridReservoir's group position={[0, -0.4, 0]}
    <group position={[0, -0.4, 0]}>
      <points ref={pointsRef} geometry={geo}>
        <pointsMaterial
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.88}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          size={0.018}
          map={dotTex}
        />
      </points>
    </group>
  )
}
