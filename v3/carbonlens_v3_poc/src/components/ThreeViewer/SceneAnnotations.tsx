/**
 * SceneAnnotations — visual polish elements for grid view:
 *
 *  WellGlowLights   Pulsing PointLight + orb at each active injector
 *  PressureWaveRings Expanding teal ring from each well during injection
 *  CurrentPhaseLabel DOM badge showing dominant CO2 trapping phase
 *
 * All 3D elements use group [0, -0.4, 0] (matching GridReservoir).
 * Well positions use w.x / w.z directly as group-local x/z coords.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useFormationStore } from '../../store/formationStore'

// ── Well Glow Lights ─────────────────────────────────────────────────────────

function WellGlowLights() {
  const wells       = useFormationStore((s) => s.wells)
  const thickness   = useFormationStore((s) => s.params.thickness)
  const result      = useSimulationStore((s) => s.result)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const h           = 0.3 + thickness / 500
  const GLOW_Y      = -h / 2 + h * 0.35   // lower third of formation

  // One ref per well for the light and orb material
  const lightRefs = useRef<(THREE.PointLight | null)[]>([])
  const orbRefs   = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    wells.forEach((w, i) => {
      const baseIntensity = w.injectionRate > 0 ? 0.35 + w.injectionRate * 0.08 : 0
      const pulse = baseIntensity * (0.75 + 0.25 * Math.sin(t * 2.2 + i * 1.3))

      const light = lightRefs.current[i]
      if (light) light.intensity = isAnimating ? pulse : baseIntensity * 0.25

      const orb = orbRefs.current[i]
      if (orb) orb.opacity = isAnimating ? (0.25 + 0.15 * Math.sin(t * 2.2 + i * 1.3)) : 0.12
    })
  })

  if (!result && !isAnimating) return null

  return (
    <group position={[0, -0.4, 0]}>
      {wells.map((w, i) => (
        <group key={w.id} position={[w.x, GLOW_Y, w.z]}>
          <pointLight
            ref={(el) => { lightRefs.current[i] = el }}
            color="#00e8c0"
            intensity={0.3}
            distance={1.2}
            decay={2}
          />
          {/* Glow orb */}
          <mesh>
            <sphereGeometry args={[0.025, 10, 8]} />
            <meshBasicMaterial
              ref={(el) => { orbRefs.current[i] = el }}
              color="#00e8c0"
              transparent
              opacity={0.18}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Bright core */}
          <mesh>
            <sphereGeometry args={[0.008, 8, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── Pressure Wave Rings ───────────────────────────────────────────────────────

function PressureWaveRings() {
  const wells       = useFormationStore((s) => s.wells)
  const thickness   = useFormationStore((s) => s.params.thickness)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const result      = useSimulationStore((s) => s.result)
  const h           = 0.3 + thickness / 500
  const RING_Y      = h / 2 - 0.015   // just below caprock ceiling

  // Each well gets its own phase, offset so they're not in sync
  const phaseRef = useRef<number[]>([])
  const ringRefs = useRef<(THREE.Mesh | null)[]>([])
  const matRefs  = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  // Initialise phases (once)
  if (phaseRef.current.length !== wells.length) {
    phaseRef.current = wells.map((_, i) => (i / Math.max(wells.length, 1)) % 1)
  }

  const ringGeo = useMemo(() => new THREE.RingGeometry(0.02, 0.04, 64), [])

  useFrame((_, delta) => {
    if (!isAnimating || !result) return

    wells.forEach((w, i) => {
      phaseRef.current[i] = (phaseRef.current[i] + delta / 5) % 1
      const phase = phaseRef.current[i]

      const mesh = ringRefs.current[i]
      if (mesh) {
        const scale = 0.1 + phase * 2.0
        mesh.scale.set(scale, scale, 1)
      }

      const mat = matRefs.current[i]
      if (mat) {
        mat.opacity = Math.max(0, (1 - phase) * 0.55)
      }
    })
  })

  if (!result) return null

  return (
    <group position={[0, -0.4, 0]}>
      {wells.map((w, i) => (
        <mesh
          key={w.id}
          ref={(el) => { ringRefs.current[i] = el }}
          geometry={ringGeo}
          position={[w.x, RING_Y, w.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial
            ref={(el) => { matRefs.current[i] = el }}
            color="#00e8c0"
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Current Phase Label (DOM overlay) ────────────────────────────────────────

function CurrentPhaseLabel() {
  const result      = useSimulationStore((s) => s.result)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const timestep    = useUIStore((s) => s.timestep)
  const showGridView = useUIStore((s) => s.showGridView)

  if (!result || !showGridView) return null

  // Determine dominant phase from actual trapping values
  const free     = result.mobilePlume
  const residual = result.residualTrapping
  const dissolved = result.solubilityTrapping
  const mineral  = result.mineralTrapping

  let phase = { label: 'Structural', sublabel: 'CO₂ rising to caprock', color: '#ef4444' }

  if (timestep === 0 || (free === 0 && residual === 0)) {
    phase = { label: 'Pre-injection', sublabel: 'Awaiting injection', color: '#64748b' }
  } else if (mineral > 0.001 && mineral >= dissolved * 0.5) {
    phase = { label: 'Mineral Trapping', sublabel: 'Geochemical precipitation', color: '#b45309' }
  } else if (dissolved > residual) {
    phase = { label: 'Dissolution', sublabel: 'CO₂ dissolving into brine', color: '#14b8a6' }
  } else if (residual > free * 0.3) {
    phase = { label: 'Residual Trapping', sublabel: 'Capillary snap-off active', color: '#10b981' }
  } else {
    phase = { label: 'Structural', sublabel: 'CO₂ migrating to seal', color: '#ef4444' }
  }

  return (
    <div
      className="absolute top-12 right-3 pointer-events-none select-none z-10"
      style={{ width: 170 }}
    >
      <div
        className="px-3 py-2 rounded-md"
        style={{
          background: 'rgba(6,12,20,0.82)',
          backdropFilter: 'blur(4px)',
          border: `1px solid ${phase.color}40`,
        }}
      >
        <p className="text-[8px] font-mono text-muted uppercase tracking-wider mb-0.5">Dominant Phase</p>
        <p className="text-[11px] font-mono font-bold" style={{ color: phase.color }}>
          {phase.label}
        </p>
        <p className="text-[8px] font-mono text-muted mt-0.5">{phase.sublabel}</p>
        {isAnimating && (
          <div
            className="mt-1.5 h-0.5 rounded-full"
            style={{ background: `linear-gradient(90deg, ${phase.color}, transparent)` }}
          />
        )}
      </div>
    </div>
  )
}

// ── Convection Fingers ────────────────────────────────────────────────────────
// Downward-moving dark-teal particle trails below the dissolved CO2 zone,
// representing density-driven convective mixing (brine + dissolved CO2 is denser).

const FINGER_COUNT = 80
const FINGER_STRIDE = 6  // x, y, z, vy, age, opacity

function ConvectionFingers() {
  const result      = useSimulationStore((s) => s.result)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const showGridView = useUIStore((s) => s.showGridView)
  const thickness   = useFormationStore((s) => s.params.thickness)
  const h           = 0.3 + thickness / 500
  const CAPROCK_Y   = h / 2
  const RESERVOIR_BOT = -h / 2

  const pointsRef = useRef<THREE.Points>(null)
  const dataRef   = useRef(new Float32Array(FINGER_COUNT * FINGER_STRIDE))
  const posArr    = useRef(new Float32Array(FINGER_COUNT * 3))
  const colArr    = useRef(new Float32Array(FINGER_COUNT * 3))
  const spawnAcc  = useRef(0)

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr.current, 3))
    g.setAttribute('color',    new THREE.BufferAttribute(colArr.current, 3))
    return g
  }, [])

  useFrame((_, delta) => {
    if (!result || !isAnimating || !showGridView) return

    const dissolvedFrac = Math.min(1, result.solubilityTrapping / Math.max(0.001, result.storageCapacity))
    if (dissolvedFrac < 0.02) return   // not enough dissolution yet

    const dt = Math.min(delta, 0.05) * 1.5
    const data = dataRef.current
    const pos  = posArr.current
    const col  = colArr.current

    // Spawn new fingers below caprock (where dissolved CO2 sits)
    spawnAcc.current += dissolvedFrac * 3 * dt
    while (spawnAcc.current >= 1) {
      spawnAcc.current -= 1
      for (let i = 0; i < FINGER_COUNT; i++) {
        if (data[i * FINGER_STRIDE + 5] <= 0) {
          // Spawn near caprock, random X/Z
          data[i * FINGER_STRIDE + 0] = (Math.random() - 0.5) * 2.4
          data[i * FINGER_STRIDE + 1] = CAPROCK_Y - 0.03 - Math.random() * 0.06
          data[i * FINGER_STRIDE + 2] = (Math.random() - 0.5) * 2.4
          data[i * FINGER_STRIDE + 3] = -(0.001 + Math.random() * 0.002)  // vy (downward)
          data[i * FINGER_STRIDE + 4] = 0
          data[i * FINGER_STRIDE + 5] = 0.8 + Math.random() * 0.2
          break
        }
      }
    }

    for (let i = 0; i < FINGER_COUNT; i++) {
      const op = data[i * FINGER_STRIDE + 5]
      if (op <= 0) {
        pos[i * 3 + 1] = -999
        continue
      }

      data[i * FINGER_STRIDE + 1] += data[i * FINGER_STRIDE + 3]  // move down
      data[i * FINGER_STRIDE + 4] += dt
      data[i * FINGER_STRIDE + 5] -= dt * 0.08  // fade slowly

      const y = data[i * FINGER_STRIDE + 1]
      if (y < RESERVOIR_BOT + 0.02) data[i * FINGER_STRIDE + 5] = 0

      pos[i * 3 + 0] = data[i * FINGER_STRIDE + 0]
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = data[i * FINGER_STRIDE + 2]

      const fade = Math.max(0, data[i * FINGER_STRIDE + 5])
      col[i * 3 + 0] = 0.05 * fade
      col[i * 3 + 1] = 0.55 * fade
      col[i * 3 + 2] = 0.60 * fade
    }

    if (pointsRef.current) {
      const g = pointsRef.current.geometry
      g.attributes.position.needsUpdate = true
      g.attributes.color.needsUpdate    = true
    }
  })

  if (!result || !showGridView) return null

  return (
    <group position={[0, -0.4, 0]}>
      <points ref={pointsRef} geometry={geo}>
        <pointsMaterial
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          size={0.012}
        />
      </points>
    </group>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export { WellGlowLights, PressureWaveRings, CurrentPhaseLabel, ConvectionFingers }
