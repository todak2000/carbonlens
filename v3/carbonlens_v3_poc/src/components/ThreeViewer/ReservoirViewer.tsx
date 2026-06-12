import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Box, Waves } from 'lucide-react'
import { Canvas, useFrame, useThree, addAfterEffect } from '@react-three/fiber'
import { OrbitControls, Text, Line, DragControls } from '@react-three/drei'
import * as THREE from 'three'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { GeometryType, ColorProperty, LasState, Well } from '../../types'
import { fbm } from '../../utils/noise'
import { useSimulation } from '../../hooks/useSimulation'
import { wellRateAtTime, cumulativeInjection } from '../../utils/gridParser'
import { getDeformation, getGridDeformation } from '../../utils/deformation'
import CrossSection from './CrossSection'
import GeologyLayers from './GeologyLayers'
import FaultPlanes from './FaultPlanes'
import GridReservoir, { GridReservoirHandle } from './GridReservoir'
import SimulationHUD from './SimulationHUD'
import CO2Particles from './CO2Particles'
import CaprockMesh from './CaprockMesh'
import { WellGlowLights, PressureWaveRings, CurrentPhaseLabel, ConvectionFingers } from './SceneAnnotations'

function sampleDepthCurve(las: LasState, depth: number): number | null {
  const curve = las.curves.find(
    (c) => c.curveName.toUpperCase().includes('POR') || c.curveName === 'POROSITY'
  )
  if (!curve || curve.depths.length < 2) return null
  const { depths, values } = curve
  if (depth <= depths[0]) return values[0]
  if (depth >= depths[depths.length - 1]) return values[depths.length - 1]
  let lo = 0, hi = depths.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (depths[mid] < depth) lo = mid
    else hi = mid
  }
  const t = (depth - depths[lo]) / (depths[hi] - depths[lo])
  return values[lo] + (values[hi] - values[lo]) * t
}

function getSurfaceHeight(x: number, z: number, type: GeometryType, thickness: number, gridData?: { deformations: number[][]; nx: number; nz: number } | null): number {
  const h = 0.3 + thickness / 500
  const sx = x, sz = z
  const macro = type === 'gridfile' && gridData
    ? getGridDeformation(x, z, gridData.deformations, gridData.nx, gridData.nz)
    : getDeformation(type, sx, sz)
  const seed = { anticline: 1, dome: 2, fault: 3, layered: 4, stratigraphic: 5, channel: 6, gridfile: 7 }[type] || 1
  if (type !== 'gridfile') {
    const nv = fbm(sx * 1.8 + 50, sz * 1.8 + 50, 3, seed)
    return h / 2 + macro + (nv - 0.5) * 0.10
  }
  return h / 2 + macro
}

const PROP_RANGES: Record<string, { min: number; max: number; label: string }> = {
  porosity: { min: 0.05, max: 0.35, label: '0.05' },
  permeability: { min: 0.1, max: 3000, label: '0.1' },
  salinity: { min: 0, max: 5, label: '0' },
  ift: { min: 0, max: 80, label: '0' },
  co2Density: { min: 200, max: 1000, label: '200' },
  solubility: { min: 0, max: 2.5, label: '0' },
  depth: { min: 500, max: 4000, label: '500' },
  custom: { min: 0, max: 1, label: '0' },
}

const FIELD_SEEDS: Record<string, number> = {
  porosity: 101,
  permeability: 202,
  salinity: 303,
  ift: 505,
  co2Density: 606,
  solubility: 707,
  depth: 404,
  custom: 808,
}

const FIELD_FREQ: Record<string, number> = {
  porosity: 2.5,
  permeability: 1.8,
  salinity: 2.2,
  ift: 2.0,
  co2Density: 1.6,
  solubility: 2.8,
  depth: 1.0,
  custom: 2.0,
}

function spatialField(x: number, z: number, ny: number, seed: number, freq: number, varyVertical: boolean): number {
  const lateral = fbm(x * freq + seed, z * freq + seed, 4, seed)
  if (varyVertical) {
    const vertical = fbm(0, ny * 3 + seed * 2, 2, seed + 50)
    return lateral * 0.5 + vertical * 0.5
  }
  return lateral
}

function propertyValueAt(
  x: number, z: number, ny: number,
  params: ReturnType<typeof useFormationStore.getState>['params'],
  property: ColorProperty, las: LasState | null,
  result: ReturnType<typeof useSimulationStore.getState>['result'] | null,
  ui: ReturnType<typeof useUIStore.getState>
): number {
  if (property === 'custom') {
    const v1 = propertyValueAt(x, z, ny, params, ui.customBlendPrimary, las, result, ui)
    const v2 = propertyValueAt(x, z, ny, params, ui.customBlendSecondary, las, result, ui)
    const r1 = PROP_RANGES[ui.customBlendPrimary]
    const r2 = PROP_RANGES[ui.customBlendSecondary]
    const n1 = (v1 - r1.min) / (r1.max - r1.min)
    const n2 = (v2 - r2.min) / (r2.max - r2.min)
    const blend = n1 * ui.customBlendWeight + n2 * (1 - ui.customBlendWeight)
    const val = Math.max(0, Math.min(1, blend))
    return val * (PROP_RANGES.porosity.max - PROP_RANGES.porosity.min) + PROP_RANGES.porosity.min
  }

  const range = PROP_RANGES[property]
  const seed = FIELD_SEEDS[property]
  const freq = FIELD_FREQ[property]
  const field = spatialField(x, z, ny, seed, freq, property === 'salinity')

  if (property === 'porosity') {
    if (las) {
      const depth = params.depth + (1 - ny) * params.thickness
      const sampled = sampleDepthCurve(las, depth)
      if (sampled !== null && sampled > 0) return Math.max(range.min, Math.min(range.max, sampled))
    }
    const spread = 0.7
    const base = (params.porosity - range.min) / (range.max - range.min)
    const val = Math.max(0, Math.min(1, base + (field - 0.5) * spread))
    return range.min + val * (range.max - range.min)
  }

  if (property === 'permeability') {
    const spread = 0.8
    const logBase = Math.log10(Math.max(0.1, params.permeability))
    const logMin = Math.log10(range.min)
    const logMax = Math.log10(range.max)
    const normBase = (logBase - logMin) / (logMax - logMin)
    const normVal = Math.max(0, Math.min(1, normBase + (field - 0.5) * spread))
    return Math.pow(10, logMin + normVal * (logMax - logMin))
  }

  if (property === 'salinity') {
    const totalSalt = params.monovalentSalinity + params.bivalentSalinity
    const spread = 0.5
    const base = (totalSalt - range.min) / (range.max - range.min)
    const val = Math.max(0, Math.min(1, base + (field - 0.5) * spread))
    return range.min + val * (range.max - range.min)
  }

  if (property === 'ift' || property === 'co2Density' || property === 'solubility') {
    let mean: number
    if (property === 'ift') mean = result?.ift ?? 30
    else if (property === 'co2Density') mean = result?.co2Density ?? 600
    else mean = result?.solubility ?? 0.5
    const spread = 0.4
    const base = (mean - range.min) / (range.max - range.min)
    const val = Math.max(0, Math.min(1, base + (field - 0.5) * spread))
    return range.min + val * (range.max - range.min)
  }

  const base = (params.depth - range.min) / (range.max - range.min)
  const val = Math.max(0, Math.min(1, base + (field - 0.5) * 0.15))
  return range.min + val * (range.max - range.min)
}

function valueToColor(value: number, property: ColorProperty): [number, number, number] {
  const range = PROP_RANGES[property]
  const t = property === 'permeability'
    ? (Math.log10(Math.max(0.1, value)) - Math.log10(range.min)) / (Math.log10(range.max) - Math.log10(range.min))
    : (value - range.min) / (range.max - range.min)
  const p = Math.max(0, Math.min(1, t))
  if (p < 0.5) {
    const s = p / 0.5
    return [1, s, 0]
  }
  const s = (p - 0.5) / 0.5
  return [1 - s, 1, 0]
}

const SEG = 48

/**
 * Option C: Build a non-rectangular reservoir solid from a boundary polygon.
 *
 * Algorithm:
 *   1. Create a THREE.Shape from the boundary polygon (points in normalised -1..1 XZ coords).
 *      Polygon Z is negated when building the Shape so that after rotateX(-PI/2) the world Z
 *      axis is correctly oriented (not mirrored).
 *   2. Extrude the shape along Z with depth=h using ExtrudeGeometry.
 *   3. Rotate -90° around X: Shape XY → world XZ; extruded Z → world Y (vertical).
 *   4. Translate -h/2 in Y to centre the solid.
 *   5. Displace top-face vertices (world Y ≈ +h/2) by the deformation field.
 *   6. Recompute normals, apply vertex colours.
 */
function buildPolygonGeometry(
  polygon: [number, number][],
  type: GeometryType,
  thickness: number,
  porosity: number,
  permeability: number,
  property: ColorProperty,
  las: LasState | null,
  gridData: ReturnType<typeof useFormationStore.getState>['gridData'],
  params: ReturnType<typeof useFormationStore.getState>['params'],
  result: ReturnType<typeof useSimulationStore.getState>['result'] | null,
  ui: ReturnType<typeof useUIStore.getState>,
): THREE.BufferGeometry {
  const SCALE = 1.5  // scene radius: polygon -1..1 → -1.5..1.5 scene units
  const h = 0.3 + thickness / 500

  // Build 2D shape — polygon X stays X, polygon Z is negated so world Z is correct after rotateX(-PI/2)
  const shape = new THREE.Shape()
  shape.moveTo(polygon[0][0] * SCALE, -polygon[0][1] * SCALE)
  for (let i = 1; i < polygon.length; i++) {
    shape.lineTo(polygon[i][0] * SCALE, -polygon[i][1] * SCALE)
  }
  shape.closePath()

  // Extrude — steps=4 gives interior subdivision for visual quality; uvGenerator default is fine
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    steps: 4,
  })

  // Orient: XY shape → XZ world; extrusion Z (0..h) → world Y (0..h)
  geo.rotateX(-Math.PI / 2)
  // Centre vertically: world Y shifts from (0..h) to (-h/2..+h/2)
  geo.translate(0, -h / 2, 0)

  // Displace top-face vertices (world Y near +h/2) using the deformation field
  const pos = geo.attributes.position
  const topThreshold = h / 2 - h * 0.05  // vertices within 5% of top
  const seed = { anticline: 1, dome: 2, fault: 3, layered: 4, stratigraphic: 5, channel: 6, gridfile: 7 }[type] || 7

  for (let i = 0; i < pos.count; i++) {
    const wy = pos.getY(i)
    if (wy < topThreshold) continue  // only top face

    const wx = pos.getX(i)
    const wz = pos.getZ(i)
    // Map world coords back to normalised -1..1 for deformation lookup
    const nx = wx / SCALE
    const nz = wz / SCALE
    const macro = gridData?.deformations
      ? getGridDeformation(nx, nz, gridData.deformations, gridData.nx, gridData.nz)
      : getDeformation(type, nx, nz)
    const roughScale = Math.max(0.3, Math.min(1, permeability / 2000))
    const nv = fbm(wx * 1.8 + 50, wz * 1.8 + 50, 3, seed)
    pos.setY(i, wy + macro + (nv - 0.5) * 0.10 * roughScale)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  // Vertex colours (same logic as buildSmoothGeometry)
  const colors: number[] = []
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i)
    const wy = pos.getY(i)
    const wz = pos.getZ(i)
    const ny = (wy + h / 2) / h
    const pv = propertyValueAt(wx, wz, ny, params, property, las, result, ui)
    const base = valueToColor(pv, property)
    const varN = fbm(wx * 4 + seed * 100, wz * 4 + seed * 100, 2, seed + 10) * 0.08 - 0.04
    const bright = 0.65 + ny * 0.35
    colors.push(
      (base[0] + varN) * bright,
      (base[1] + varN * 0.8) * bright,
      (base[2] + varN * 0.5) * bright,
    )
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

function buildSmoothGeometry(
  type: GeometryType, thickness: number, depth: number,
  porosity: number, permeability: number, property: ColorProperty, las: LasState | null,
  gridData: ReturnType<typeof useFormationStore.getState>['gridData'],
  params: ReturnType<typeof useFormationStore.getState>['params'],
  result: ReturnType<typeof useSimulationStore.getState>['result'] | null,
  ui: ReturnType<typeof useUIStore.getState>
): THREE.BufferGeometry {
  // Option C: custom polygon footprint — delegate to dedicated builder
  if (gridData?.boundary_polygon && gridData.boundary_polygon.length >= 3) {
    return buildPolygonGeometry(
      gridData.boundary_polygon, type, thickness, porosity, permeability,
      property, las, gridData, params, result, ui,
    )
  }

  const w = 3, d = 3, h = 0.3 + thickness / 500
  const geo = new THREE.BoxGeometry(w, h, d, SEG, 1, SEG)
  const pos = geo.attributes.position
  const seed = { anticline: 1, dome: 2, fault: 3, layered: 4, stratigraphic: 5, channel: 6, gridfile: 7 }[type] || 1
  const roughScale = Math.max(0.3, Math.min(1, permeability / 2000))

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i)
    const ny = (y + h / 2) / h
    if (ny > 0.5) {
      const t = (ny - 0.5) / 0.5
      const macro = type === 'gridfile' && gridData
        ? getGridDeformation(x, z, gridData.deformations, gridData.nx, gridData.nz)
        : getDeformation(type, x, z)
      const nv = fbm(x * 1.8 + 50, z * 1.8 + 50, 3, seed)
      pos.setY(i, y + (macro + (nv - 0.5) * 0.10 * roughScale) * t)
    }
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  const colors: number[] = []
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i)
    const ny = (y + h / 2) / h
    const pv = propertyValueAt(x, z, ny, params, property, las, result, ui)
    const base = valueToColor(pv, property)
    const varN = fbm(x * 4 + seed * 100, z * 4 + seed * 100, 2, seed + 10) * 0.08 - 0.04
    const bright = 0.65 + ny * 0.35
    colors.push(
      (base[0] + varN) * bright,
      (base[1] + varN * 0.8) * bright,
      (base[2] + varN * 0.5) * bright,
    )
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

function FormationMesh() {
  const meshRef = useRef<THREE.Mesh>(null)
  const baseRef = useRef<Float32Array | null>(null)
  const params = useFormationStore((s) => s.params)
  const las = useFormationStore((s) => s.las)
  const gridData = useFormationStore((s) => s.gridData)
  const cp = useUIStore((s) => s.colorProperty)
  const result = useSimulationStore((s) => s.result)
  const timestep = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const wells = useFormationStore((s) => s.wells)
  const hasSim = result !== null

  const geometry = useMemo(() => {
    const ui = useUIStore.getState()
    const g = buildSmoothGeometry(params.geometryType, params.thickness, params.depth, params.porosity, params.permeability, cp, las, gridData, params, result, ui)
    baseRef.current = new Float32Array(g.attributes.color.array)
    return g
  }, [params, cp, las, gridData, result])

  // ── CO2 saturation overlay (drainage → imbibition → final balance) ────────
  useEffect(() => {
    const m = meshRef.current
    if (!m || !hasSim || !baseRef.current) return
    const geo = m.geometry as THREE.BufferGeometry
    const pos = geo.attributes.position
    const col = geo.attributes.color
    const colors = col.array as Float32Array
    const base = baseRef.current
    const h = 0.3 + params.thickness / 500

    // Determine global injection phase
    const anyInjecting = wells.some(w => wellRateAtTime(w.injectionRate, timestep, w.rampUpYears, w.rampDownYears, projectYears) > 0)

    // Last timestep when any well has positive injection
    let endYear = 0
    for (const w of wells) {
      const wy = w.rampUpYears + (projectYears - w.rampUpYears - w.rampDownYears)
      if (wy > endYear) endYear = wy
    }
    const postYears = anyInjecting ? 0 : Math.max(0, timestep - endYear)

    const co2Color: [number, number, number] = [0.02, 0.95, 0.78]
    const brineColor: [number, number, number] = [0.08, 0.18, 0.48]
    const gangliaColor: [number, number, number] = [0.95, 0.65, 0.10]
    const dissolvedColor: [number, number, number] = [0.15, 0.40, 0.80]
    const mineralColor: [number, number, number] = [0.45, 0.50, 0.45]

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const ny = (y + h / 2) / h

      let co2Sat = 0
      let wellDist = 1000
      for (const w of wells) {
        const dx = x - w.x, dz = z - w.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < wellDist) wellDist = dist

        const cum = cumulativeInjection(w.injectionRate, timestep, w.rampUpYears, w.rampDownYears, projectYears)
        const maxCum = w.injectionRate * projectYears
        const fill = Math.min(1, cum / Math.max(0.001, maxCum))

        const plumeR = Math.min(1.4, 0.7 * Math.sqrt(fill) + 0.04)
        if (dist >= plumeR) continue

        const radial = 1 - (dist / Math.max(0.001, plumeR)) ** 2
        const heightW = Math.max(0, Math.min(1, (ny - 0.15) / 0.65))

        let sat = radial * heightW * fill * 0.9

        if (postYears > 0) {
          const edgeFactor = 0.1 + 0.9 * Math.min(1, dist / Math.max(0.001, plumeR))
          const decay = 1 / (1 + Math.exp(-(postYears - 4) * 0.6))
          const localDecay = Math.min(1, decay * edgeFactor)
          const residualGanglia = 0.18
          const dissolvedFrac = 0.08
          const mineralized = 0.04
          const totalResidual = residualGanglia + dissolvedFrac + mineralized
          const mobileLeaves = localDecay * (1 - totalResidual)
          sat *= Math.max(totalResidual, 1 - mobileLeaves)
        }

        if (sat > co2Sat) co2Sat = sat
      }

      const s = Math.min(1, co2Sat)
      const baseR = base[i * 3], baseG = base[i * 3 + 1], baseB = base[i * 3 + 2]

      if (s > 0.005) {
        // Brine → CO2 transition: blue at low sat, teal at high sat
        const phase = Math.min(1, s * 2.5)
        const mixR = brineColor[0] * (1 - phase) + co2Color[0] * phase
        const mixG = brineColor[1] * (1 - phase) + co2Color[1] * phase
        const mixB = brineColor[2] * (1 - phase) + co2Color[2] * phase
        // If post-injection, shift toward residual colors
        if (postYears > 3) {
          const resT = Math.min(1, (postYears - 3) / 5)
          const gR = gangliaColor[0], gG = gangliaColor[1], gB = gangliaColor[2]
          const dR = dissolvedColor[0], dG = dissolvedColor[1], dB = dissolvedColor[2]
          const mR = mineralColor[0], mG = mineralColor[1], mB = mineralColor[2]
          // Ganglia fraction = 0.18/0.30, dissolved = 0.08/0.30, mineralized = 0.04/0.30
          const gFrac = 0.6, dFrac = 0.27, mFrac = 0.13
          const resR = gR * gFrac + dR * dFrac + mR * mFrac
          const resG = gG * gFrac + dG * dFrac + mG * mFrac
          const resB = gB * gFrac + dB * dFrac + mB * mFrac
          colors[i * 3]     = mixR * (1 - resT) + resR * resT
          colors[i * 3 + 1] = mixG * (1 - resT) + resG * resT
          colors[i * 3 + 2] = mixB * (1 - resT) + resB * resT
        } else {
          colors[i * 3]     = mixR
          colors[i * 3 + 1] = mixG
          colors[i * 3 + 2] = mixB
        }
      } else {
        // Non-invaded: deep brine ocean blue
        const depthFade = Math.min(1, (1 - ny) * 0.6 + 0.4)
        colors[i * 3]     = baseR * 0.3 + brineColor[0] * depthFade
        colors[i * 3 + 1] = baseG * 0.3 + brineColor[1] * depthFade
        colors[i * 3 + 2] = baseB * 0.3 + brineColor[2] * depthFade
      }
    }
    col.needsUpdate = true
  }, [hasSim, result, timestep, wells, projectYears, params.thickness])

  // Restore base colors when simulation is reset
  useEffect(() => {
    const m = meshRef.current
    if (!m || !baseRef.current || hasSim) return
    const geo = m.geometry as THREE.BufferGeometry
    const col = geo.attributes.color
    ;(col.array as Float32Array).set(baseRef.current)
    col.needsUpdate = true
  }, [hasSim])

  return (
    <group position={[0, -0.4, 0]}>
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow renderOrder={hasSim ? -1 : 0}>
        <meshPhongMaterial
          vertexColors side={THREE.DoubleSide} shininess={6}
          transparent={hasSim}
          opacity={hasSim ? 0.92 : 1.0}
          depthWrite={!hasSim}
          depthTest={true}
        />
      </mesh>
      <lineSegments geometry={new THREE.WireframeGeometry(geometry)} renderOrder={hasSim ? -1 : 0}>
        <lineBasicMaterial color="#8b7d6b" transparent opacity={hasSim ? 0.04 : 0.06} depthWrite={false} />
      </lineSegments>
    </group>
  )
}

// ── CAPROCK LAYER ─────────────────────────────────────────────────────────────
// Visually distinct caprock/seal layer rendered as a separate thin mesh on top
// of the reservoir body, with characteristic grey-brown seal rock appearance.
function CaprockLayer() {
  const params = useFormationStore((s) => s.params)
  const gridData = useFormationStore((s) => s.gridData)
  const result = useSimulationStore((s) => s.result)
  const type = params.geometryType
  const h = 0.3 + params.thickness / 500
  const caprockThickness = 0.028
  const hasSim = result !== null  // thin but visible seal layer

  const geo = useMemo(() => {
    const seg = 40
    const g = new THREE.PlaneGeometry(3.0, 3.0, seg, seg)
    const pos = g.attributes.position
    const seed = { anticline: 1, dome: 2, fault: 3, layered: 4, stratigraphic: 5, channel: 6, gridfile: 7 }[type] || 1
    const colors: number[] = []

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getY(i)
      // Match the formation surface deformation
      const macro = type === 'gridfile' && gridData
        ? getGridDeformation(x, z, gridData.deformations, gridData.nx, gridData.nz)
        : getDeformation(type, x, z)
      const nv = fbm(x * 1.8 + 50, z * 1.8 + 50, 3, seed)
      pos.setZ(i, macro + (nv - 0.5) * 0.10)

      // Caprock color: layered grey-brown representing tight mudstone/shale seal
      // Slight variation to show heterogeneity in seal quality
      const sealVar = fbm(x * 3.5 + 200, z * 3.5 + 200, 2, seed + 99)
      const base = 0.30 + sealVar * 0.12
      colors.push(base * 0.75, base * 0.65, base * 0.55) // warm grey-brown
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    // Rotate to horizontal
    g.rotateX(-Math.PI / 2)
    return g
  }, [type, params.thickness, gridData])

  const sealOutlinePts: [number, number, number][] = []
  const r = 1.55
  for (let i = 0; i <= 40; i++) {
    const theta = (i / 40) * Math.PI * 2
    const x = r * Math.cos(theta), z = r * Math.sin(theta)
    const seed = { anticline: 1, dome: 2, fault: 3, layered: 4, stratigraphic: 5, channel: 6, gridfile: 7 }[type] || 1
    const yOff = getDeformation(type, x, z) + (fbm(x * 1.5 + 50, z * 1.5 + 50, 2, seed) - 0.5) * 0.04
    sealOutlinePts.push([x, yOff, z])
  }

  return (
    <group position={[0, -0.4 + h / 2, 0]}>
      {/* Main caprock mesh */}
      <mesh geometry={geo} position={[0, caprockThickness / 2, 0]} renderOrder={hasSim ? -1 : 0}>
        <meshPhongMaterial vertexColors transparent opacity={hasSim ? 0.68 : 0.82} side={THREE.DoubleSide} shininess={2} depthWrite={!hasSim} />
      </mesh>
      {/* Top surface of caprock — slightly emissive to distinguish it */}
      <mesh geometry={geo} position={[0, caprockThickness, 0]} renderOrder={hasSim ? -1 : 0}>
        <meshBasicMaterial color="#4a3f35" transparent opacity={hasSim ? 0.08 : 0.25} side={THREE.FrontSide} depthWrite={false} />
      </mesh>
      {/* Seal outline ring */}
      <Line points={sealOutlinePts} color="#7c6d5e" lineWidth={1.2} transparent opacity={hasSim ? 0.15 : 0.5} renderOrder={hasSim ? -1 : 0} />
      {/* Label */}
      <Text position={[-1.4, 0.12, 0]} fontSize={0.045} color="#a89880" fillOpacity={0.7} anchorX="left">Caprock Seal</Text>
    </group>
  )
}

function SealOutline() {
  const type = useFormationStore((s) => s.params.geometryType)
  const pts: [number, number, number][] = []
  const r = 1.7
  for (let i = 0; i <= 36; i++) {
    const theta = (i / 36) * Math.PI * 2
    const x = r * Math.cos(theta), z = r * Math.sin(theta)
    const seed = { anticline: 1, dome: 2, fault: 3, layered: 4, stratigraphic: 5, channel: 6, gridfile: 7 }[type] || 1
    let yOff = getDeformation(type, x, z)
    yOff += (fbm(x * 1.5 + 50, z * 1.5 + 50, 2, seed) - 0.5) * 0.04
    pts.push([x, 0.20 + yOff, z])
  }
  return (
    <group position={[0, -0.4, 0]}>
      <Line points={pts} color="#00b89a" lineWidth={1} transparent opacity={0.2} />
      <Text position={[0, 0.60, 0]} fontSize={0.06} color="#00b89a" fillOpacity={0.3}>Seal</Text>
    </group>
  )
}

function viridis(t: number): [number, number, number] {
  const p = Math.max(0, Math.min(1, t))
  const r = 0.002 + 0.272 * p + 0.890 * p ** 2 - 1.087 * p ** 3 + 0.921 * p ** 4
  const g = 0.005 + 0.116 * p + 0.672 * p ** 2 - 0.656 * p ** 3 + 0.864 * p ** 4
  const b = 0.518 + 0.552 * p - 0.441 * p ** 2 - 0.305 * p ** 3 + 0.676 * p ** 4
  return [r, g, b]
}

// ── INJECTION PLUME — full downhole CO2 visualization ─────────────────────────
// Shows three distinct zones of CO2 behaviour:
//   1. Injection zone disk  — radial CO2 spread at the perforation interval
//   2. Saturation slices    — horizontal CO2 front at N depths (CT-scan style)
//   3. Rising column        — buoyant CO2 column from injection to caprock
// The existing CO2SaturationTop shows lateral spread under caprock (zone 4).
//
// IMPORTANT: All hooks (useMemo) are called unconditionally at the top.
// Visibility is controlled in the return JSX, not by early return.
const N_SLICES = 8
function InjectionPlume({ well, result }: {
  well: Well
  result: NonNullable<ReturnType<typeof useSimulationStore.getState>['result']>
}) {
  const timestep     = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const params       = useFormationStore((s) => s.params)

  // ── All derived values (no hooks here, just math) ─────────────────────────
  const h                    = 0.3 + params.thickness / 500
  const caprockLocalY        = h / 2 - 0.01
  const reservoirBottomLocalY = -h / 2 + 0.02
  const perfMidY             = reservoirBottomLocalY + h * 0.125
  const colHeight            = Math.max(0.01, caprockLocalY - perfMidY)

  const cum      = cumulativeInjection(well.injectionRate, timestep, well.rampUpYears, well.rampDownYears, projectYears)
  const totalMax = Math.max(1, well.injectionRate * projectYears)
  const rawFill  = Math.min(1, cum / totalMax)

  // Force minimum visibility from day 1: boost small fill values for display
  const wFill    = Math.max(0.12, rawFill)

  const maxReach  = Math.max(0.02, Math.min(1.3 - Math.max(Math.abs(well.x), Math.abs(well.z)), 1.0))
  const injRadius = Math.max(0.02, Math.min(maxReach, (result.plumeRadius / 2000) * Math.sqrt(rawFill) * 1.1))
  const capRadius = Math.max(0.02, Math.min(maxReach, (result.plumeRadius / 1500) * Math.sqrt(rawFill) + 0.05))

  // ── ALL hooks unconditionally above any early return ──────────────────────

  // Wellbore pipe glow — visible column from surface down to perforation
  const wellboreGeo = useMemo(() => {
    const r = 0.015
    const g = new THREE.CylinderGeometry(r, r * 0.6, caprockLocalY - perfMidY + 0.15, 8, 1, true)
    const pos = g.attributes.position
    const colors: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const ny = (pos.getY(i) + (caprockLocalY - perfMidY + 0.15) / 2) / (caprockLocalY - perfMidY + 0.15)
      const glow = 0.5 + ny * 0.5
      colors.push(glow * 1.0, glow * 0.6, glow * 0.15)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [caprockLocalY, perfMidY])

  const pipeRef = useRef<THREE.Mesh>(null)
  const isInjecting = wellRateAtTime(well.injectionRate, timestep, well.rampUpYears, well.rampDownYears, projectYears) > 0

  useFrame(({ clock }) => {
    if (!pipeRef.current) return
    const mat = pipeRef.current.material as THREE.MeshBasicMaterial
    if (isInjecting) {
      const flow = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 4 + well.x * 3)
      mat.opacity = Math.min(0.92, (0.35 + wFill * 0.5) * flow)
    } else {
      const fade = Math.max(0.08, 0.35 + wFill * 0.5 - 0.1 * Math.sin(clock.elapsedTime * 0.3))
      mat.opacity = fade
    }
  })

  // Injection zone disk — opened cylindrical shell at perforation interval
  const injDiskGeo = useMemo(() => {
    const r = Math.max(0.02, injRadius)
    const g = new THREE.CylinderGeometry(r, r * 0.65, h * 0.24, 32, 1, true)
    const pos = g.attributes.position
    const colors: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const y    = pos.getY(i)
      const ny   = (y + h * 0.12) / (h * 0.24)
      const dist = Math.sqrt(pos.getX(i) ** 2 + pos.getZ(i) ** 2) / r
      const sat  = Math.max(0, (1 - dist) * 0.9 + ny * 0.1) * wFill
      colors.push(sat * 0.95 + 0.05, sat * 0.55, sat * 0.15)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [injRadius, wFill, h])

  // Saturation slices — horizontal CO2 front at each depth level
  const sliceGeos = useMemo(() => {
    const ir = Math.max(0.02, injRadius)
    const cr = Math.max(0.02, capRadius)
    const ch = Math.max(0.01, colHeight)
    const geos: { geo: THREE.BufferGeometry; y: number; alpha: number }[] = []
    for (let si = 0; si < N_SLICES; si++) {
      const t      = N_SLICES > 1 ? si / (N_SLICES - 1) : 0
      const sliceR = ir * (1 - t) + cr * t
      const sliceY = perfMidY + t * ch
      const alpha  = (0.28 + t * 0.22) * wFill
      const g = new THREE.CircleGeometry(Math.max(0.02, sliceR), 28)
      const pos = g.attributes.position
      const colors: number[] = []
      for (let i = 0; i < pos.count; i++) {
        const dist = Math.sqrt(pos.getX(i) ** 2 + pos.getY(i) ** 2) / Math.max(sliceR, 0.001)
        const sat  = Math.max(0, 1 - dist * dist) * wFill
        colors.push(sat * 0.05, sat * 0.85, sat * 0.75)
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      geos.push({ geo: g, y: sliceY, alpha })
    }
    return geos
  }, [injRadius, capRadius, wFill, perfMidY, colHeight])

  // Rising CO2 column — buoyant stream from injection to caprock
  const columnGeo = useMemo(() => {
    const colR = Math.max(0.01, injRadius * 0.18)
    const ch   = Math.max(0.01, colHeight)
    const g = new THREE.CylinderGeometry(colR * 1.4, colR, ch, 12, 6)
    const pos = g.attributes.position
    const colors: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const ny = (pos.getY(i) + ch / 2) / ch
      colors.push(ny * 0.05, 0.7 + ny * 0.25, 0.6 + ny * 0.35)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [injRadius, colHeight])

  const showAnim = true

  return (
    <group position={[well.x, 0, well.z]}>
      {/* Wellbore pipe glow — CO2 flowing down the pipe */}
        <mesh ref={pipeRef} geometry={wellboreGeo} position={[0, perfMidY - 0.07, 0]}>
          <meshBasicMaterial vertexColors transparent opacity={Math.min(0.85, 0.35 + wFill * 0.5)} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>

      {/* Injection zone disk at perforation interval */}
      <mesh geometry={injDiskGeo} position={[0, perfMidY, 0]}>
        <meshPhongMaterial vertexColors transparent opacity={Math.min(0.9, 0.35 + wFill * 0.55)} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Saturation slices — CO2 front at each depth level */}
      {showAnim && sliceGeos.map(({ geo, y, alpha }, i) => (
        <mesh key={i} geometry={geo} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial vertexColors transparent opacity={alpha} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Buoyant rising column from injection to caprock */}
      {showAnim && (
        <mesh geometry={columnGeo} position={[0, perfMidY + colHeight / 2, 0]}>
          <meshPhongMaterial vertexColors transparent opacity={Math.min(0.7, 0.2 + wFill * 0.5)} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  )
}

function StressOverlay() {
  const show = useUIStore((s) => s.showStressField)
  const params = useFormationStore((s) => s.params)
  const timestep = useUIStore((s) => s.timestep)
  const [geo] = useMemo(() => {
    if (!show) return [null]
    const w = 3, d = 3, h = 0.3 + params.thickness / 500
    const seg = 32
    const g = new THREE.PlaneGeometry(w, d, seg, seg)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors: number[] = []
    const depth = params.depth
    const overburden = depth * 0.023
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const dist = Math.sqrt(x * x + z * z) / 1.5
      const stress = overburden * (1 + 0.1 * Math.exp(-dist * 2) * (timestep / 50))
      const frac = Math.min(1, Math.max(0, (stress - depth * 0.017) / (depth * 0.025 - depth * 0.017)))
      const r = frac, gv = 1 - frac, b = 0.2 * (1 - frac)
      colors.push(r, gv, b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return [g]
  }, [show, params.depth, params.thickness, timestep])
  if (!geo || !show) return null
  return (
    <mesh geometry={geo} position={[0, 0.25, 0]}>
      <meshPhongMaterial vertexColors transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

function PressureOverlay() {
  const show = useUIStore((s) => s.showPressureField)
  const result = useSimulationStore((s) => s.result)
  const params = useFormationStore((s) => s.params)
  const [geo] = useMemo(() => {
    if (!show || !result?.pressureField) return [null]
    const w = 3, d = 3, h = 0.3 + params.thickness / 500
    const seg = 24
    const g = new THREE.PlaneGeometry(w, d, seg, seg)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors: number[] = []
    const field = result.pressureField
    const fieldRes = Math.round(Math.sqrt(field.length))
    const baseP = params.pressure
    const maxDP = 20

    function sampleField(mx: number, mz: number): number {
      let closest = baseP
      let minDist = Infinity
      for (const pt of field) {
        const d2 = (pt.x - mx) ** 2 + (pt.z - mz) ** 2
        if (d2 < minDist) {
          minDist = d2
          closest = pt.pressure
        }
      }
      return closest
    }

    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), pz = pos.getZ(i)
      const pVal = sampleField(px, pz)
      const frac = Math.max(0, Math.min(1, (pVal - baseP) / maxDP))
      const r = Math.min(1, frac * 1.8)
      const gv = Math.max(0, 1 - frac * 1.5)
      const b = Math.max(0, 1 - frac * 1.2)
      colors.push(r, gv, b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return [g]
  }, [show, result?.pressureField, params.thickness, params.pressure])
  if (!geo || !show) return null
  return (
    <mesh geometry={geo} position={[0, 0.25, 0]}>
      <meshPhongMaterial vertexColors transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

function PlumeMeshes() {
  const result = useSimulationStore((s) => s.result)
  const wells  = useFormationStore((s) => s.wells)
  if (!result) return null
  return (
    <group position={[0, -0.4, 0]}>
      {wells.map((w) => (
        <InjectionPlume key={w.id} well={w} result={result} />
      ))}
    </group>
  )
}

// ── CO2 SATURATION TOP SURFACE ────────────────────────────────────────────────
// Surface-conforming plume disk: each vertex Y is set to follow the actual
// deformed formation surface (minus a small inset), so it can never protrude
// above the caprock regardless of structural geometry.
function CO2SaturationTop() {
  const result = useSimulationStore((s) => s.result)
  const timestep = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const wells = useFormationStore((s) => s.wells)
  const params = useFormationStore((s) => s.params)
  const gridData = useFormationStore((s) => s.gridData)
  const h = 0.3 + params.thickness / 500
  const type = params.geometryType
  const seed = { anticline: 1, dome: 2, fault: 3, layered: 4, stratigraphic: 5, channel: 6, gridfile: 7 }[type] || 1

  // The saturation plane is positioned at the group origin; each vertex computes
  // its own height to match the formation surface minus INSET below caprock.
  const INSET = 0.035  // how far below the deformed surface to keep the disk

  const geo = useMemo(() => {
    if (!result || wells.length === 0) return null
    const seg = 64
    const g = new THREE.PlaneGeometry(3.0, 3.0, seg, seg)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors: number[] = []
    const trapFrac = Math.min(0.5, timestep * 0.01)

    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), pz = pos.getZ(i)

      // Hard clip to formation footprint (avoid any outside-boundary artifacts)
      const distFromCenter = Math.sqrt(px * px + pz * pz)
      if (distFromCenter > 1.44) {
        pos.setY(i, -h)  // hide vertex far below
        colors.push(0, 0, 0)
        continue
      }

      // Conform vertex Y to deformed formation surface — this is the critical fix.
      // getSurfaceHeight returns local Y of the formation top in the group space.
      // After rotateX, pos.getY is the "height" we can set freely.
      const surfH = getSurfaceHeight(px, pz, type, params.thickness, gridData)
      // surfH is relative to the group at y=-0.4; we want the disk just below the surface
      // The mesh has no extra position offset (placed at group origin), so:
      pos.setY(i, surfH - INSET)

      let sat = 0
      for (const w of wells) {
        const cum = cumulativeInjection(w.injectionRate, timestep, w.rampUpYears, w.rampDownYears, projectYears)
        const totalMax = w.injectionRate * projectYears
        const rawFill = Math.min(1, cum / Math.max(1, totalMax))
        const wFill = Math.max(0.08, rawFill)
        const plumeR = Math.min(1.4, (result.plumeRadius / 1500) * Math.sqrt(rawFill) + 0.06)
        const dist = Math.sqrt((px - w.x) ** 2 + (pz - w.z) ** 2)
        sat = Math.max(sat, Math.max(0, 1 - (dist / plumeR) ** 2) * wFill)
      }
      const mobile = sat * (1 - trapFrac)
      const residual = sat * trapFrac * 0.7
      const dissolved = sat * trapFrac * 0.3
      colors.push(
        (mobile * 0.05 + residual * 1.1 + dissolved * 0.2) * 2.2,
        (mobile * 0.85 + residual * 0.68 + dissolved * 0.55) * 2.2,
        (mobile * 0.70 + residual * 0.12 + dissolved * 0.90) * 2.2,
      )
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [result, wells, timestep, projectYears, params.thickness, params.geometryType, gridData])

  if (!result || !geo) return null

  // No position offset needed — each vertex already encodes its own height
  return (
    <group position={[0, -0.4, 0]}>
      <mesh geometry={geo}>
        <meshBasicMaterial vertexColors transparent opacity={0.92} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

// ── PLUME GLOW SPHERES ────────────────────────────────────────────────────────
// Additive-blended glowing ellipsoids inside the formation — visible through
// the semi-transparent formation mesh. Shows mobile CO2 (teal), residual (amber)
// and dissolution (blue) phases building up around each well over time.
function PlumeGlowSpheres() {
  const result = useSimulationStore((s) => s.result)
  const timestep = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const wells = useFormationStore((s) => s.wells)
  const params = useFormationStore((s) => s.params)
  const h = 0.3 + params.thickness / 500

  if (!result || wells.length === 0) return null

  const trapFrac = Math.min(0.5, timestep * 0.01)

  return (
    <group position={[0, -0.4, 0]}>
      {wells.map((w) => {
        const cum = cumulativeInjection(w.injectionRate, timestep, w.rampUpYears, w.rampDownYears, projectYears)
        const totalMax = w.injectionRate * projectYears
        const rawFill = Math.min(1, cum / Math.max(1, totalMax))
        const fillFrac = Math.max(0.08, rawFill)
        const r = Math.min(1.3, (result.plumeRadius / 1500) * Math.sqrt(rawFill) + 0.06)
        return (
          <group key={w.id} position={[w.x, 0, w.z]}>
            {/* Core glow — mobile CO2 column, flattened ellipsoid */}
            <mesh scale={[1, 0.55, 1]}>
              <sphereGeometry args={[r * 0.6, 18, 12]} />
              <meshBasicMaterial color="#00e8c0" transparent opacity={Math.min(0.35, 0.2 + fillFrac * 0.18)} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            {/* Dissolution shimmer — blue, at reservoir bottom */}
            <mesh position={[0, -h * 0.3, 0]} scale={[1, 0.22, 1]}>
              <sphereGeometry args={[r * 0.95, 14, 10]} />
              <meshBasicMaterial color="#3090d8" transparent opacity={Math.min(0.18, 0.08 + trapFrac * fillFrac * 0.12)} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ── 3D PARTICLE PLUME ─────────────────────────────────────────────────────────
const MAX_3D_PARTICLES = 80
// state: 0=inject(radial near-well), 1=free(buoyant rise), 2=cap(lateral spread), 3=residual
const STRIDE = 9 // x,y,z, vx,vy,vz, state(0-4), age, wellIdx

function PlumeParticles3D() {
  const result = useSimulationStore((s) => s.result)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const wells = useFormationStore((s) => s.wells)
  const params = useFormationStore((s) => s.params)
  const timestep = useUIStore((s) => s.timestep)

  const pointsRef = useRef<THREE.Points>(null)
  const dataRef = useRef<Float32Array>(new Float32Array(MAX_3D_PARTICLES * STRIDE))
  const aliveRef = useRef<Uint8Array>(new Uint8Array(MAX_3D_PARTICLES))
  const posArr = useRef<Float32Array>(new Float32Array(MAX_3D_PARTICLES * 3))
  const colArr = useRef<Float32Array>(new Float32Array(MAX_3D_PARTICLES * 3))
  const sizeArr = useRef<Float32Array>(new Float32Array(MAX_3D_PARTICLES))
  const spawnAccRef = useRef(0)
  const countRef = useRef(0)

  const h = 0.3 + params.thickness / 500
  const caprockLocalY = h / 2 - 0.01
  const reservoirBottomLocalY = -h / 2 + 0.02

  // Circular sprite texture for soft round particles (not square dots)
  const dotTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 32; c.height = 32
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.15, 'rgba(255,255,255,0.85)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.3)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 32, 32)
    const t = new THREE.CanvasTexture(c)
    t.needsUpdate = true
    return t
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr.current, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colArr.current, 3))
    g.setAttribute('size', new THREE.BufferAttribute(sizeArr.current, 1))
    return g
  }, [])

  useFrame((_, delta) => {
    if (!result || wells.length === 0) return
    const data = dataRef.current
    const alive = aliveRef.current
    const pos = posArr.current
    const col = colArr.current
    const sz = sizeArr.current

    const dt = Math.min(delta, 0.05) * 2.0

    // Spawn new particles — at perforation interval (bottom 25% of reservoir)
    const perfMidY = reservoirBottomLocalY + h * 0.125
    if (countRef.current < MAX_3D_PARTICLES * 0.85) {
      const totalRate = wells.reduce((s, w) => s + w.injectionRate, 0)
      const spawnRate = isAnimating ? 2 + totalRate * 1 : 0
      spawnAccRef.current += spawnRate * dt
      while (spawnAccRef.current >= 1 && countRef.current < MAX_3D_PARTICLES) {
        spawnAccRef.current -= 1
        let slot = -1
        for (let i = 0; i < MAX_3D_PARTICLES; i++) {
          if (!alive[i]) { slot = i; break }
        }
        if (slot === -1) break
        const w = wells[Math.floor(Math.random() * wells.length)]
        const base = slot * STRIDE
        const spawnAngle = Math.random() * Math.PI * 2
        // 35% spawn along the well column (layer-by-layer invasion)
        const isColumnSpawn3D = Math.random() < 0.35
        const spawnY3D = isColumnSpawn3D
          ? reservoirBottomLocalY + (caprockLocalY - reservoirBottomLocalY) * (0.05 + Math.random() * 0.82)
          : perfMidY + (Math.random() - 0.5) * h * 0.12
        data[base + 0] = w.x + Math.cos(spawnAngle) * (isColumnSpawn3D ? 0.015 : 0.02)
        data[base + 1] = spawnY3D
        data[base + 2] = w.z + Math.sin(spawnAngle) * (isColumnSpawn3D ? 0.015 : 0.02)
        data[base + 3] = Math.cos(spawnAngle) * (isColumnSpawn3D ? 0.005 + Math.random() * 0.005 : 0.003 + Math.random() * 0.004)
        data[base + 4] = isColumnSpawn3D ? 0.0015 + Math.random() * 0.001 : 0.001
        data[base + 5] = Math.sin(spawnAngle) * (isColumnSpawn3D ? 0.005 + Math.random() * 0.005 : 0.003 + Math.random() * 0.004)
        data[base + 6] = isColumnSpawn3D ? 1 : 0
        data[base + 7] = 0
        data[base + 8] = wells.indexOf(w)
        alive[slot] = 1
        countRef.current++
      }
    }

    // states: 0=inject(radial), 1=free(buoyant rise), 2=cap(lateral), 3=residual
    const perfTopY = reservoirBottomLocalY + h * 0.25

    for (let i = 0; i < MAX_3D_PARTICLES; i++) {
      if (!alive[i]) {
        pos[i * 3] = 0; pos[i * 3 + 1] = -999; pos[i * 3 + 2] = 0
        sz[i] = 0
        continue
      }
      const base = i * STRIDE
      const state = data[base + 6]
      data[base + 7] += dt

      if (state === 3) {
        // residual: stay put
      } else if (state === 2) {
        // cap: spread laterally under caprock
        data[base + 3] += (Math.random() - 0.5) * 0.0015 * dt
        data[base + 3] *= 0.995
        data[base + 5] += (Math.random() - 0.5) * 0.0015 * dt
        data[base + 5] *= 0.995
        data[base + 0] += data[base + 3]
        data[base + 2] += data[base + 5]
        data[base + 1] = caprockLocalY - 0.005 - Math.random() * 0.01
        if (Math.abs(data[base + 0]) > 1.4) data[base + 3] *= -0.8
        if (Math.abs(data[base + 2]) > 1.4) data[base + 5] *= -0.8
        if (data[base + 7] > 5 && Math.random() < 0.004 * dt) {
          data[base + 6] = 3 // residual
        }
      } else if (state === 1) {
        // free: buoyant rise toward caprock
        data[base + 3] += (Math.random() - 0.5) * 0.001 * dt; data[base + 3] *= 0.99
        data[base + 5] += (Math.random() - 0.5) * 0.001 * dt; data[base + 5] *= 0.99
        data[base + 4] = Math.min(data[base + 4] + 0.0004 * dt, 0.007) // accelerate upward
        data[base + 0] += data[base + 3]
        data[base + 1] += data[base + 4]
        data[base + 2] += data[base + 5]
        if (data[base + 1] >= caprockLocalY) {
          data[base + 1] = caprockLocalY - 0.005
          data[base + 6] = 2 // transition to cap state
          const wellIdx = Math.round(data[base + 8])
          const w = wells[wellIdx] || wells[0]
          const dx = data[base + 0] - w.x, dz = data[base + 2] - w.z
          const d = Math.sqrt(dx * dx + dz * dz) + 0.001
          data[base + 3] = (dx / d) * (0.003 + Math.random() * 0.008)
          data[base + 5] = (dz / d) * (0.003 + Math.random() * 0.008)
        }
        if (Math.abs(data[base + 0]) > 1.45) data[base + 3] *= -0.9
        if (Math.abs(data[base + 2]) > 1.45) data[base + 5] *= -0.9
      } else {
        // state 0: inject — radial spread near wellbore from perforation interval
        data[base + 3] *= 0.96  // slow down radial spread (viscous drag)
        data[base + 5] *= 0.96
        data[base + 0] += data[base + 3]
        data[base + 1] += data[base + 4]
        data[base + 2] += data[base + 5]
        // Transition to buoyant rise once particle has moved away from well or risen above perf zone
        if (data[base + 7] > 0.8 || data[base + 1] > perfTopY) {
          data[base + 6] = 1 // free (buoyant)
          data[base + 4] = 0.003 + Math.random() * 0.004  // upward velocity
        }
      }

      pos[i * 3]     = data[base + 0]
      pos[i * 3 + 1] = data[base + 1]
      pos[i * 3 + 2] = data[base + 2]

      // Color by state
      if (state === 0) {       // inject: orange-red (hot injection)
        col[i * 3] = 1.0; col[i * 3 + 1] = 0.5; col[i * 3 + 2] = 0.05
      } else if (state === 1) { // free: bright teal (rising CO2)
        col[i * 3] = 0.0;  col[i * 3 + 1] = 1.0; col[i * 3 + 2] = 0.95
      } else if (state === 2) { // cap: light cyan (caprock spread)
        col[i * 3] = 0.1;  col[i * 3 + 1] = 1.0; col[i * 3 + 2] = 1.0
      } else {                  // residual: amber
        col[i * 3] = 1.0; col[i * 3 + 1] = 0.7; col[i * 3 + 2] = 0.1
      }

      sz[i] = state === 0 ? 1.5 : state === 1 ? 1.2 : state === 2 ? 1.5 : 1.0
    }

    if (pointsRef.current) {
      const g = pointsRef.current.geometry
      g.attributes.position.needsUpdate = true
      g.attributes.color.needsUpdate = true
      g.attributes.size.needsUpdate = true
      g.drawRange.count = MAX_3D_PARTICLES
    }
  })

  if (!result) return null

  return (
    <group position={[0, -0.4, 0]}>
      <points ref={pointsRef} geometry={geo}>
        <pointsMaterial
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.92}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          size={0.015}
          map={dotTex}
        />
      </points>
    </group>
  )
}

// ── CAPROCK FAILURE PARTICLE EFFECT ────────────────────────────────────────────
// Upward CO₂ particle fountain simulating seal breach when MAIP is persistently exceeded
function BlowoutEffect() {
  const N = 200
  const ref = useRef<THREE.Points>(null)
  const p = useRef(new Float32Array(N * 3))
  const v = useRef(new Float32Array(N * 3))
  const c = useRef(new Float32Array(N * 3))
  const a = useRef(new Uint8Array(N))

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p.current, 3))
    g.setAttribute('color', new THREE.BufferAttribute(c.current, 3))
    return g
  }, [])

  const dotTex = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 32; cv.height = 32
    const ctx = cv.getContext('2d')!
    const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.2, 'rgba(255,255,255,0.6)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gr
    ctx.fillRect(0, 0, 32, 32)
    const t = new THREE.CanvasTexture(cv)
    t.needsUpdate = true
    return t
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * 2
    for (let i = 0; i < N; i++) {
      if (!a.current[i]) {
        a.current[i] = 1
        const ang = Math.random() * Math.PI * 2
        const r = 0.05 + Math.random() * 0.4
        p.current[i * 3] = Math.cos(ang) * r
        p.current[i * 3 + 1] = 0.3 + Math.random() * 0.05
        p.current[i * 3 + 2] = Math.sin(ang) * r
        v.current[i * 3] = (Math.random() - 0.5) * 0.04
        v.current[i * 3 + 1] = 0.04 + Math.random() * 0.06
        v.current[i * 3 + 2] = (Math.random() - 0.5) * 0.04
        c.current[i * 3] = 1; c.current[i * 3 + 1] = 0.7 + Math.random() * 0.3; c.current[i * 3 + 2] = 0.1
        break
      }
    }
    for (let i = 0; i < N; i++) {
      if (!a.current[i]) { p.current[i * 3 + 1] = -10; continue }
      p.current[i * 3] += v.current[i * 3] * dt
      p.current[i * 3 + 1] += v.current[i * 3 + 1] * dt
      p.current[i * 3 + 2] += v.current[i * 3 + 2] * dt
      if (p.current[i * 3 + 1] > 1.8 || Math.abs(p.current[i * 3]) > 1.8 || Math.abs(p.current[i * 3 + 2]) > 1.8) a.current[i] = 0
    }
    const g = ref.current?.geometry
    if (g) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true }
  })

  return (
    <group position={[0, -0.4, 0]}>
      <points ref={ref} geometry={geo}>
        <pointsMaterial vertexColors sizeAttenuation transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} size={0.04} map={dotTex} />
      </points>
    </group>
  )
}

function WellMarker({ well }: { well: { id: string; x: number; z: number; label: string; injectionRate: number } }) {
  const params = useFormationStore((s) => s.params)
  const updateWellPosition = useFormationStore((s) => s.updateWellPosition)
  const gridData = useFormationStore((s) => s.gridData)
  const hasResult = useSimulationStore((s) => s.result) !== null
  const groupRef = useRef<THREE.Group>(null)

  const surfaceY = getSurfaceHeight(well.x, well.z, params.geometryType, params.thickness, gridData)

  const _onDragEnd = () => {
    if (groupRef.current) {
      const wp = new THREE.Vector3()
      groupRef.current.getWorldPosition(wp)
      updateWellPosition(well.id, wp.x, wp.z)
    }
  }

  const content = (
    <group ref={groupRef} position={[well.x, surfaceY + 0.05, well.z]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.008, 0.012, 0.5, 6]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <cylinderGeometry args={[0.022, 0.018, 0.03, 6]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.52, 0]}>
          <cylinderGeometry args={[0.015, 0.020, 0.04, 6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
        </mesh>
        {well.injectionRate > 0 && (
          <mesh position={[0, 0.51, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.018, 0.004, 6, 16]} />
            <meshPhongMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} transparent opacity={0.8} />
          </mesh>
        )}
        <Text position={[0, 0.60, 0]} fontSize={0.04} color="#94a3b8">{well.label}</Text>
        {well.injectionRate > 0 && (
          <Text position={[0, 0.65, 0]} fontSize={0.025} color="#64748b" fillOpacity={0.6}>
            {well.injectionRate.toFixed(1)} Mt/yr
          </Text>
        )}
        <mesh position={[0, 0.3, 0]} visible={false}>
          <sphereGeometry args={[0.12, 4, 4]} />
          <meshBasicMaterial />
        </mesh>
      </group>
  )

  return hasResult ? content : <DragControls axisLock="y" onDragEnd={_onDragEnd}>{content}</DragControls>
}

function WellTrajectory({ well }: { well: { id: string; x: number; z: number; injectionRate: number } }) {
  const params = useFormationStore((s) => s.params)
  const gridData = useFormationStore((s) => s.gridData)
  const h = 0.3 + params.thickness / 500
  const surfaceY = getSurfaceHeight(well.x, well.z, params.geometryType, params.thickness, gridData)

  // Injection (perforation) interval: bottom 25% of the reservoir thickness
  const reservoirBottom = -h / 2
  const perfTop = reservoirBottom + h * 0.25   // top of perforated zone
  const perfMid = reservoirBottom + h * 0.125  // midpoint for indicators

  const pts: [number, number, number][] = [
    [well.x, surfaceY + 0.4, well.z],
    [well.x, surfaceY + 0.02, well.z],
    [well.x, reservoirBottom, well.z],
  ]

  return (
    <group position={[0, -0.4, 0]}>
      {/* Main wellbore trajectory line */}
      <Line points={pts} color="#475569" lineWidth={0.5} transparent opacity={0.4} dashed dashSize={0.02} gapSize={0.01} />

      {/* Casing tube */}
      <mesh position={[well.x, (reservoirBottom + surfaceY + 0.02) / 2, well.z]}>
        <cylinderGeometry args={[0.006, 0.006, surfaceY + 0.42 + h / 2, 4]} />
        <meshPhongMaterial color="#64748b" transparent opacity={0.15} />
      </mesh>

      {/* Perforated interval — bright orange tube showing where CO2 enters rock */}
      {well.injectionRate > 0 && (
        <mesh position={[well.x, perfMid, well.z]}>
          <cylinderGeometry args={[0.010, 0.010, h * 0.25, 8]} />
          <meshPhongMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.75} transparent opacity={0.95} />
        </mesh>
      )}

      {/* Perforation ticks — small horizontal spikes indicating perforated zones */}
      {well.injectionRate > 0 && [0.05, 0.12, 0.19].map((offset, i) => (
        <mesh key={i} position={[well.x, reservoirBottom + offset, well.z]} rotation={[0, (i * Math.PI) / 3, Math.PI / 2]}>
          <cylinderGeometry args={[0.003, 0.003, 0.04, 4]} />
          <meshPhongMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.6} />
        </mesh>
      ))}

      {/* Perforation zone label */}
      {well.injectionRate > 0 && (
        <Text
          position={[well.x + 0.06, perfMid, well.z]}
          fontSize={0.030}
          color="#fb923c"
          anchorX="left"
          fillOpacity={0.85}
        >
          Perf. Interval
        </Text>
      )}

      {/* Injection point sphere — at reservoir bottom where CO2 enters, clearly marked */}
      <mesh position={[well.x, reservoirBottom, well.z]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshPhongMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} transparent opacity={0.9} />
      </mesh>

      {/* Near-wellbore radial pressure halo at injection depth */}
      {well.injectionRate > 0 && (
        <mesh position={[well.x, perfTop - 0.005, well.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.035, 0.12, 24]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  )
}

function WellMarkers() {
  const wells = useFormationStore((s) => s.wells)
  if (wells.length === 0) {
    return (
      <group position={[0, -0.4, 0]}>
        <Text position={[0, 0.2, 1.8]} fontSize={0.06} color="#ef4444">No wells — add in Formation panel</Text>
      </group>
    )
  }
  return (
    <group position={[0, -0.4, 0]}>
      {wells.map((w) => (
        <group key={w.id}>
          <WellTrajectory well={{ id: w.id, x: w.x, z: w.z, injectionRate: w.injectionRate }} />
          <WellMarker well={w} />
        </group>
      ))}
    </group>
  )
}

function BoundingBox() {
  const params = useFormationStore((s) => s.params)
  const h = 0.3 + params.thickness / 500
  const hw = 1.7, hh = h / 2 + 0.35, hd = 1.7
  const pts: [number, number, number][] = [
    [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd], [-hw, -hh, -hd],
    [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd], [-hw, hh, -hd],
    [hw, hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [hw, hh, hd],
    [-hw, hh, hd], [-hw, -hh, hd],
  ]
  return (
    <group position={[0, -0.4, 0]}>
      <Line points={pts} color="#334155" lineWidth={0.5} transparent opacity={0.5} />
      <Text position={[hw + 0.1, 0, 0]} fontSize={0.065} color="#475569">X</Text>
      <Text position={[0, hh + 0.1, 0]} fontSize={0.065} color="#475569">Y</Text>
      <Text position={[0, 0, hd + 0.1]} fontSize={0.065} color="#475569">Z</Text>
      <Text position={[hw + 0.1, -hh - 0.05, 0]} fontSize={0.035} color="#475569" fillOpacity={0.4}>X-axis</Text>
      <Text position={[0, hh + 0.1, 0]} fontSize={0.035} color="#475569" fillOpacity={0.4}>Y-axis</Text>
      <Text position={[0, -hh - 0.05, hd + 0.1]} fontSize={0.035} color="#475569" fillOpacity={0.4}>Z-axis</Text>
    </group>
  )
}

function PropertyLabels() {
  const params = useFormationStore((s) => s.params)
  const cp = useUIStore((s) => s.colorProperty)
  const las = useFormationStore((s) => s.las)
  return (
    <group position={[0, -0.4, 0]}>
      <Text position={[0, -0.35, 1.8]} fontSize={0.04} color="#64748b">
        {`Colour: ${cp} | φ=${(params.porosity * 100).toFixed(0)}% k=${params.permeability.toFixed(0)}mD | ${params.geometryType}${las ? ' | LAS' : ''}`}
      </Text>
    </group>
  )
}

// ── DIMENSION ANNOTATIONS ─────────────────────────────────────────────────────
// Shows real-world depth, thickness, width and plume height on the 3D model.
function DimensionAnnotations() {
  const params   = useFormationStore((s) => s.params)
  const result   = useSimulationStore((s) => s.result)
  const timestep = useUIStore((s) => s.timestep)
  const wells    = useFormationStore((s) => s.wells)
  const h = 0.3 + params.thickness / 500

  // Real-world conversions
  const thicknessM  = params.thickness                // m
  const depthTopM   = params.depth                    // m to top of reservoir
  const depthBotM   = params.depth + params.thickness // m to bottom
  const widthKm     = Math.sqrt(params.area).toFixed(2) + ' km'  // side length assuming square
  const thicknessLbl = `${thicknessM} m`
  const depthTopLbl  = `${depthTopM} m bgl`

  // Plume height: from perforation midpoint to caprock
  const perfMidFrac = 0.125  // bottom 12.5% of h
  const perfMidLocalY = -h / 2 + h * perfMidFrac
  const caprockLocalY = h / 2
  const plumeHeightLocal = caprockLocalY - perfMidLocalY  // in model units
  const plumeHeightM = Math.round(plumeHeightLocal * 500)  // convert model → metres (1 unit ≈ 500m)

  const sideX = 1.75  // annotation placement outside formation

  // Y positions (in formation group local coords, group offset = -0.4)
  const topY    = h / 2 + 0.01  // formation top
  const botY    = -h / 2        // formation bottom
  const midY    = 0             // formation centre

  return (
    <group position={[0, -0.4, 0]}>
      {/* ── Thickness arrow — left side (X=-sideX) ─── */}
      <Line points={[[-sideX, botY, 0], [-sideX, topY, 0]]} color="#4a7090" lineWidth={0.6} transparent opacity={0.7} />
      <Line points={[[-sideX - 0.05, topY, 0], [-sideX + 0.05, topY, 0]]} color="#4a7090" lineWidth={0.6} transparent opacity={0.7} />
      <Line points={[[-sideX - 0.05, botY, 0], [-sideX + 0.05, botY, 0]]} color="#4a7090" lineWidth={0.6} transparent opacity={0.7} />
      <Text position={[-sideX - 0.14, midY, 0]} fontSize={0.038} color="#6090b0" anchorX="right" rotation={[0, 0, Math.PI / 2]}>
        {thicknessLbl} thick
      </Text>

      {/* ── Depth label — top left ─── */}
      <Text position={[-sideX - 0.14, topY, 0]} fontSize={0.034} color="#506080" anchorX="right">
        {depthTopLbl}
      </Text>
      <Text position={[-sideX - 0.14, botY, 0]} fontSize={0.034} color="#506080" anchorX="right">
        {depthBotM} m bgl
      </Text>

      {/* ── Width annotation — front edge (Z=+1.55) ─── */}
      <Line points={[[-1.5, botY - 0.06, 1.55], [1.5, botY - 0.06, 1.55]]} color="#4a7090" lineWidth={0.6} transparent opacity={0.7} />
      <Line points={[[-1.5, botY - 0.10, 1.55], [-1.5, botY - 0.02, 1.55]]} color="#4a7090" lineWidth={0.6} transparent opacity={0.7} />
      <Line points={[[1.5, botY - 0.10, 1.55], [1.5, botY - 0.02, 1.55]]} color="#4a7090" lineWidth={0.6} transparent opacity={0.7} />
      <Text position={[0, botY - 0.10, 1.62]} fontSize={0.036} color="#6090b0" anchorX="center">
        {widthKm} wide
      </Text>

      {/* ── Plume height indicator — shown only when simulation running ─── */}
      {result && timestep > 2 && wells.length > 0 && (
        <group position={[wells[0].x + 0.18, 0, wells[0].z]}>
          <Line
            points={[[0, perfMidLocalY, 0], [0, caprockLocalY, 0]]}
            color="#00c4a0" lineWidth={1.0} transparent opacity={0.8}
          />
          <Line points={[[-0.04, perfMidLocalY, 0], [0.04, perfMidLocalY, 0]]} color="#00c4a0" lineWidth={0.8} transparent opacity={0.8} />
          <Line points={[[-0.04, caprockLocalY, 0], [0.04, caprockLocalY, 0]]} color="#00c4a0" lineWidth={0.8} transparent opacity={0.8} />
          <Text position={[0.08, (perfMidLocalY + caprockLocalY) / 2, 0]} fontSize={0.032} color="#00c4a0" anchorX="left">
            {`↕ ${plumeHeightM}m plume`}
          </Text>
        </group>
      )}
    </group>
  )
}

function GridHelper() {
  const thickness = useFormationStore((s) => s.params.thickness)
  const h = 0.3 + thickness / 500
  const yPos = -0.4 - h / 2 - 0.02
  const lines: [number, number, number][][] = []
  const s = 1.8
  for (let i = -6; i <= 6; i++) {
    const p = (i / 6) * s
    lines.push([[p, yPos, -s], [p, yPos, s]])
    lines.push([[-s, yPos, p], [s, yPos, p]])
  }
  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#334155" lineWidth={0.5} transparent opacity={0.35} />
      ))}
      <Line points={[[-s, yPos, -s], [s, yPos, -s], [s, yPos, s], [-s, yPos, s], [-s, yPos, -s]]} color="#475569" lineWidth={0.8} transparent opacity={0.7} />
    </group>
  )
}

const LEGEND_GRADIENTS: Record<string, string> = {
  porosity: 'linear-gradient(to right, #1a3a5c, #2e6fa3, #7bc9eb)',
  permeability: 'linear-gradient(to right, #4a1942, #c94b4b, #f5c542)',
  salinity: 'linear-gradient(to right, #2d6a4f, #e9c46a, #e76f51)',
  ift: 'linear-gradient(to right, #e76f51, #e9c46a, #2d6a4f)',
  co2Density: 'linear-gradient(to right, #e9c46a, #e07a5f, #9c1c1c)',
  solubility: 'linear-gradient(to right, #9c1c1c, #e9c46a, #2d6a4f)',
  depth: 'linear-gradient(to right, #e9c46a, #2e6fa3, #1a3a5c)',
  custom: 'linear-gradient(to right, #4a1942, #7bc9eb, #2d6a4f)',
}

const LEGEND_LABELS: Record<string, { min: string; max: string }> = {
  porosity: { min: 'Low φ (5%)', max: 'High φ (35%)' },
  permeability: { min: 'Low k (0.1 mD)', max: 'High k (3000 mD)' },
  salinity: { min: 'Fresh (0 mol/kg)', max: 'Brine (5 mol/kg)' },
  ift: { min: 'Low IFT (0 mN/m)', max: 'High IFT (80 mN/m)' },
  co2Density: { min: 'Low ρ (200 kg/m³)', max: 'High ρ (1000 kg/m³)' },
  solubility: { min: 'Low S (0 mol/kg)', max: 'High S (2.5 mol/kg)' },
  depth: { min: 'Shallow (500 m)', max: 'Deep (4000 m)' },
  custom: { min: 'Low blend', max: 'High blend' },
}

function ColorLegendOverlay() {
  const cp = useUIStore((s) => s.colorProperty)
  const setColorProperty = useUIStore((s) => s.setColorProperty)
  const blendPrimary = useUIStore((s) => s.customBlendPrimary)
  const blendSecondary = useUIStore((s) => s.customBlendSecondary)
  const blendWeight = useUIStore((s) => s.customBlendWeight)
  const setCustomBlend = useUIStore((s) => s.setCustomBlend)
  const PROP_OPTIONS: ColorProperty[] = ['porosity', 'permeability', 'salinity', 'ift', 'co2Density', 'solubility', 'depth']
  return (
    <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1 pointer-events-auto select-none font-mono text-[9px] text-muted">
      <div className="flex items-center gap-2">
        <select value={cp} onChange={(e) => setColorProperty(e.target.value as ColorProperty)}
          className="bg-tertiary text-secondary border border-theme rounded px-1.5 py-0.5 text-[9px] font-mono outline-none cursor-pointer"
        >
          {PROP_OPTIONS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          <option value="custom">Custom Blend</option>
        </select>
        <span>{LEGEND_LABELS[cp]?.min || ''}</span>
        <div className="w-20 h-2 rounded-sm" style={{ background: LEGEND_GRADIENTS[cp] || LEGEND_GRADIENTS.porosity }} />
        <span>{LEGEND_LABELS[cp]?.max || ''}</span>
      </div>
      {cp === 'custom' && (
        <div className="flex items-center gap-2 bg-tertiary/80 rounded px-2 py-1">
          <select value={blendPrimary} onChange={(e) => setCustomBlend(e.target.value as ColorProperty, blendSecondary, blendWeight)}
            className="bg-page text-secondary border border-theme rounded px-1 py-0.5 text-[8px] font-mono outline-none"
          >
            {PROP_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="text-[8px] text-muted">{(blendWeight * 100).toFixed(0)}%</span>
          <input type="range" min={0} max={100} step={5} value={blendWeight * 100}
            onChange={(e) => setCustomBlend(blendPrimary, blendSecondary, Number(e.target.value) / 100)}
            className="w-12 h-1 accent-accent"
          />
          <select value={blendSecondary} onChange={(e) => setCustomBlend(blendPrimary, e.target.value as ColorProperty, blendWeight)}
            className="bg-page text-secondary border border-theme rounded px-1 py-0.5 text-[8px] font-mono outline-none"
          >
            {PROP_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

const FORMATTERS: Record<string, (v: number) => string> = {
  porosity: (v) => `${(v * 100).toFixed(1)}%`,
  permeability: (v) => `${v.toFixed(0)} mD`,
  salinity: (v) => `${v.toFixed(2)} mol/kg`,
  ift: (v) => `${v.toFixed(2)} mN/m`,
  co2Density: (v) => `${v.toFixed(0)} kg/m³`,
  solubility: (v) => `${v.toFixed(3)} mol/kg`,
  depth: (v) => `${v.toFixed(0)} m`,
  custom: (v) => `${(v * 100).toFixed(1)}% blend`,
}

const COMPUTED_PROPS = new Set<string>(['ift', 'co2Density', 'solubility'])

function StatsOverlay() {
  const cp = useUIStore((s) => s.colorProperty)
  const params = useFormationStore((s) => s.params)
  const result = useSimulationStore((s) => s.result)
  const showGridView = useUIStore((s) => s.showGridView)

  const fmt = FORMATTERS[cp]
  const isComputed = COMPUTED_PROPS.has(cp)
  const range = PROP_RANGES[cp]

  let meanValue: number
  if (cp === 'custom') meanValue = 0.5
  else if (cp === 'salinity') meanValue = params.monovalentSalinity + params.bivalentSalinity
  else if (cp === 'ift') meanValue = result?.ift ?? 30
  else if (cp === 'co2Density') meanValue = result?.co2Density ?? 600
  else if (cp === 'solubility') meanValue = result?.solubility ?? 0.5
  else if (cp === 'porosity') meanValue = params.porosity
  else if (cp === 'permeability') meanValue = params.permeability
  else meanValue = params.depth

  return (
    <div className="absolute top-11 right-3 pointer-events-none select-none font-mono text-[9px] text-muted bg-page/80 backdrop-blur-sm border border-theme rounded px-2.5 py-2 min-w-[130px]">
      <div className="text-[10px] text-secondary font-semibold uppercase tracking-wider mb-1.5 border-b border-theme pb-1">
        {cp === 'custom' ? 'Custom Blend' :
         cp === 'porosity' ? 'Porosity' :
         cp === 'permeability' ? 'Permeability' :
         cp === 'salinity' ? 'Salinity' :
         cp === 'ift' ? 'IFT' :
         cp === 'co2Density' ? 'CO₂ Density' :
         cp === 'solubility' ? 'Solubility' : 'Depth'}
      </div>

      {isComputed && result ? (
        <>
          <div className="flex justify-between"><span>P10</span><span className="text-secondary">{fmt(result.p10)}</span></div>
          <div className="flex justify-between"><span>P50</span><span className="text-accent">{fmt(result.p50)}</span></div>
          <div className="flex justify-between"><span>P90</span><span className="text-secondary">{fmt(result.p90)}</span></div>
        </>
      ) : isComputed ? (
        <div className="text-[8px] italic">Run simulation for P10/P50/P90</div>
      ) : (
        <div className="flex justify-between"><span>Avg</span><span className="text-secondary">{fmt(meanValue)}</span></div>
      )}

      <div className="text-[8px] text-muted/60 mt-1.5 pt-1 border-t border-theme/50">
        Range: {cp === 'custom' ? '0 – 1' : `${range?.min ?? 0} – ${range?.max ?? 1}`}
      </div>

      {showGridView && (
        <>
          <div className="mt-2 pt-1.5 border-t border-theme/50">
            <div className="text-[8px] text-secondary font-semibold uppercase tracking-wider mb-1">Trapping</div>
            <div className="space-y-0.5 text-[8px]">
              <div className="flex justify-between"><span>Structural</span><span className="text-accent">✓ Seal</span></div>
              <div className="flex justify-between">
                <span>Residual</span>
                <span className="text-muted">{result ? `${(result.residualTrapping / (result.residualTrapping + result.solubilityTrapping + (result.mobilePlume || 1)) * 100).toFixed(1)}%` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Solubility</span>
                <span className="text-muted">{result ? `${(result.solubilityTrapping / (result.residualTrapping + result.solubilityTrapping + (result.mobilePlume || 1)) * 100).toFixed(1)}%` : '—'}</span>
              </div>
              <div className="flex justify-between"><span>Mineral</span><span className="text-muted">△ slow</span></div>
            </div>
          </div>

          {result && (
            <div className="mt-2 pt-1.5 border-t border-theme/50">
              <div className="text-[8px] text-secondary font-semibold uppercase tracking-wider mb-1">Plume</div>
              <div className="space-y-0.5 text-[8px]">
                <div className="flex justify-between">
                  <span>Radius</span>
                  <span className="text-accent">{result.plumeRadius.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between">
                  <span>Height</span>
                  <span className="text-accent">{result.plumeHeight.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between">
                  <span>Fill</span>
                  <span className="text-muted">{result.capacityUtilPct.toFixed(1)}%</span>
                </div>
                {result.overpressureRisk && (
                  <div className="flex justify-between text-error font-bold mt-1 pt-1 border-t border-error">
                    <span>⚠ Overpressure</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TimestepSlider() {
  const timestep = useUIStore((s) => s.timestep)
  const setTimestep = useUIStore((s) => s.setTimestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const wells = useFormationStore((s) => s.wells)
  const result = useSimulationStore((s) => s.result)
  const isAnimating = useSimulationStore((s) => s.isAnimating)

  // Cumulative injected at current slider position
  const totalCum = useMemo(() =>
    wells.reduce((sum, w) => sum + cumulativeInjection(w.injectionRate, timestep, w.rampUpYears, w.rampDownYears, projectYears), 0),
  [wells, timestep, projectYears])

  // Stored CO2 = actual cumulative injection (no cap — injection continues freely)
  const storedCO2 = totalCum

  // Utilisation vs P50 DOE capacity (may exceed 100% → overpressure regime)
  const utilPct = result && result.totalCapacity > 0
    ? (storedCO2 / result.totalCapacity) * 100
    : null

  const isOverpressure = result?.overpressureRisk ?? false

  return (
    <div className="absolute top-11 left-1/2 -translate-x-1/2 pointer-events-auto select-none font-mono text-[9px] text-muted bg-page/70 backdrop-blur-sm border border-theme rounded px-3 py-1.5 flex items-center gap-3 min-w-[320px] shadow-lg">
      <span className="whitespace-nowrap">Year {timestep} / {projectYears}{isAnimating ? ' ▶' : ''}</span>
      <input type="range" min={0} max={projectYears} step={1} value={timestep}
        onChange={(e) => setTimestep(Number(e.target.value))}
        className="flex-1 h-1 accent-accent"
      />
      <span className={`text-[8px] w-32 text-right whitespace-nowrap ${isOverpressure ? 'text-error' : 'text-accent'}`}>
        {result
          ? `${storedCO2.toFixed(3)} Mt${utilPct !== null ? ` (${utilPct.toFixed(2)}%)` : ''}`
          : '—'}
        {isOverpressure ? ' ⚠' : ''}
      </span>
    </div>
  )
}

function DepthRuler() {
  const params      = useFormationStore((s) => s.params)
  const result      = useSimulationStore((s) => s.result)
  const showGridView = useUIStore((s) => s.showGridView)

  if (!showGridView) return null

  const topDepth    = params.depth           // m
  const botDepth    = params.depth + params.thickness
  const mid1        = Math.round(topDepth  + params.thickness * 0.33)
  const mid2        = Math.round(topDepth  + params.thickness * 0.67)
  const ticks       = [topDepth, mid1, mid2, botDepth]

  return (
    <div
      className="absolute left-2 pointer-events-none select-none z-10 flex items-stretch"
      style={{ top: 48, bottom: 48 }}
    >
      {/* Tick bar */}
      <div className="flex flex-col justify-between items-end pr-1.5 py-0.5">
        {ticks.map((d) => (
          <span key={d} className="text-[8px] font-mono text-muted/60" style={{ lineHeight: 1 }}>
            {d}m
          </span>
        ))}
      </div>
      {/* Vertical line */}
      <div
        className="w-px flex flex-col justify-between"
        style={{ background: 'rgba(0,196,160,0.20)' }}
      >
        {ticks.map((d) => (
          <div key={d} className="w-1.5 h-px" style={{ background: 'rgba(0,196,160,0.45)' }} />
        ))}
      </div>
    </div>
  )
}

function CaptureHelper({ onReady }: { onReady: (capture: () => string) => void }) {
  const { gl } = useThree()
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const offscreen = document.createElement('canvas')
    offscreenRef.current = offscreen
    const ctx = offscreen.getContext('2d')!

    const unsub = addAfterEffect(() => {
      const src = gl.domElement
      if (!src.width || !src.height) return
      offscreen.width = src.width
      offscreen.height = src.height
      ctx.drawImage(src, 0, 0)
    })
    return unsub
  }, [gl])

  useEffect(() => {
    onReady(() => {
      const c = offscreenRef.current
      return c ? c.toDataURL('image/png') : ''
    })
  }, [onReady])

  return null
}

export default function ReservoirViewer() {
  const gridReservoirRef = useRef<GridReservoirHandle>(null)
  useSimulation(gridReservoirRef)
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  const theme = useUIStore((s) => s.theme)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const toggleStress = useUIStore((s) => s.toggleStressField)
  const showStress = useUIStore((s) => s.showStressField)
  const showPressure = useUIStore((s) => s.showPressureField)
  const togglePressure = useUIStore((s) => s.togglePressureField)
  const result = useSimulationStore((s) => s.result)
  const warningCount = useUIStore((s) => s.warningCount)
  const blowoutActive = useUIStore((s) => s.blowoutActive)
  const incrementWarning = useUIStore((s) => s.incrementWarning)
  const setBlowout = useUIStore((s) => s.setBlowout)
  const timestep = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const showGridView = useUIStore((s) => s.showGridView)
  const toggleGridView = useUIStore((s) => s.toggleGridView)

  useEffect(() => {
    if (isAnimating) {
      setViewMode('3d')
      useUIStore.getState().setColorProperty('co2Density')
    }
  }, [isAnimating])

  // ── Overpressure warning → blowout cascade ────────────────────────────────
  useEffect(() => {
    if (!isAnimating || !result?.overpressureRisk || blowoutActive) return
    const id = setInterval(() => {
      const s = useUIStore.getState()
      if (s.warningCount >= 3) {
        s.setBlowout(true)
        useFormationStore.getState().setWells(
          useFormationStore.getState().wells.map(w => ({ ...w, injectionRate: 0 }))
        )
        clearInterval(id)
        return
      }
      s.incrementWarning()
    }, 2000)
    return () => clearInterval(id)
  }, [isAnimating, result?.overpressureRisk, blowoutActive])

  // ── Capture helpers ───────────────────────────────────────────────────────
  const capRef = useRef<HTMLDivElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const framesRef = useRef<string[]>([])
  const captureFrameRef = useRef<(() => string) | null>(null)

  const capturePNG = useCallback(() => {
    const fn = captureFrameRef.current
    if (!fn) return
    const dataUrl = fn()
    const link = document.createElement('a')
    link.download = `carbonlens_ts${timestep}.png`
    link.href = dataUrl
    link.click()
  }, [timestep])

  const startRecording = useCallback(() => {
    framesRef.current = []
    setIsRecording(true)
  }, [])

  const stopRecording = useCallback(async () => {
    setIsRecording(false)
    setIsProcessing(true)
    const frames = framesRef.current
    if (frames.length === 0) { setIsProcessing(false); return }
    try {
      const { recordFramesToGif } = await import('../../utils/gifRecorder')
      const gifBlob = await recordFramesToGif(frames, 150)
      const url = URL.createObjectURL(gifBlob)
      const link = document.createElement('a')
      link.download = `carbonlens_animation_ts${timestep}_${frames.length}fr.gif`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      frames.forEach((dataUrl, i) => {
        const link = document.createElement('a')
        link.download = `carbonlens_frame_${i + 1}_of_${frames.length}.png`
        link.href = dataUrl
        link.click()
      })
    }
    framesRef.current = []
    setIsProcessing(false)
  }, [timestep])

  // Capture frame at fixed interval during recording
  useEffect(() => {
    if (!isRecording) return
    const fn = captureFrameRef.current
    if (!fn) return
    const id = setInterval(() => {
      const dataUrl = fn()
      if (dataUrl) framesRef.current.push(dataUrl)
    }, 80)
    return () => clearInterval(id)
  }, [isRecording])

  return (
    <div className="relative w-full h-full" ref={capRef}>
      {/* Tab bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center pointer-events-auto"
        style={{
          height: '32px',
          background: blowoutActive ? 'rgba(180,20,10,0.35)' : 'var(--bg-elevated)',
          borderBottom: blowoutActive ? '1px solid rgba(255,60,40,0.6)' : '1px solid var(--border)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <button
          onClick={() => setViewMode('3d')}
          style={{
            padding: '0 16px', height: '100%', fontSize: '10px', fontFamily: 'monospace',
            background: viewMode === '3d' ? 'var(--accent-bg)' : 'transparent',
            color: viewMode === '3d' ? 'var(--accent)' : 'var(--text-muted)',
            borderRight: '1px solid var(--border)',
            borderBottom: viewMode === '3d' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', outline: 'none',
          }}
        >
          <Box size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} /> 3D Model
        </button>
        <button
          onClick={() => setViewMode('2d')}
          style={{
            padding: '0 16px', height: '100%', fontSize: '10px', fontFamily: 'monospace',
            background: viewMode === '2d' ? 'var(--accent-bg)' : 'transparent',
            color: viewMode === '2d' ? 'var(--accent)' : 'var(--text-muted)',
            borderRight: '1px solid var(--border)',
            borderBottom: viewMode === '2d' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', outline: 'none',
          }}
        >
          <Waves size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} /> 2D Section
        </button>

        {/* Capture + Warning + Blowout UI */}
        <div className="ml-auto flex gap-1 pr-3 items-center">
          {/* Capture buttons */}
          <button onClick={capturePNG}
            className="text-[9px] font-mono px-2 py-1 rounded border border-theme bg-tertiary text-muted hover:text-secondary"
          >
            📷 PNG
          </button>
          <button onClick={isProcessing ? undefined : isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`text-[9px] font-mono px-2 py-1 rounded border ${isProcessing ? 'bg-amber-600 text-white border-amber-500 animate-pulse' : isRecording ? 'bg-red-600 text-white border-red-500' : 'border-theme bg-tertiary text-muted hover:text-secondary'}`}
          >
            {isProcessing ? '⏳ Encoding...' : isRecording ? '⏹ Stop' : '🎥 Record'}
          </button>

          {/* Overpressure → caprock failure countdown */}
          {warningCount > 0 && !blowoutActive && (
            <div className="text-[9px] font-mono px-2 py-1 rounded bg-error border border-error text-error animate-pulse">
              ⚠ P90 EXCEEDED — CAPROCK STRESS {warningCount}/3
            </div>
          )}

          {/* Caprock failure indicator */}
          {blowoutActive && (
            <div className="text-[9px] font-mono px-2 py-1 rounded bg-error border border-error text-error animate-pulse font-bold">
              ⚠ CAPROCK FAILURE — SEAL BREACH SIMULATED
            </div>
          )}

          <button onClick={togglePressure}
            className={`text-[9px] font-mono px-2 py-1 rounded border ${showPressure ? 'bg-accent text-white border-accent' : 'bg-tertiary text-muted hover:text-secondary border-theme'}`}
          >
            {showPressure ? '✕ P-field' : '⊞ P-field'}
          </button>
          <button onClick={toggleStress}
            className={`text-[9px] font-mono px-2 py-1 rounded border ${showStress ? 'bg-accent text-white border-accent' : 'bg-tertiary text-muted hover:text-secondary border-theme'}`}
          >
            {showStress ? '✕ Stress' : '⊟ Stress'}
          </button>
          <button onClick={toggleGridView}
            className={`text-[9px] font-mono px-2 py-1 rounded border ${showGridView ? 'bg-accent text-white border-accent' : 'bg-tertiary text-muted hover:text-secondary border-theme'}`}
            title={showGridView ? 'Switch to smooth mesh view' : 'Switch to cellular grid view'}
          >
            {showGridView ? '⊞ Grid' : '⊡ Mesh'}
          </button>
        </div>
      </div>

      {/* 3D View */}
      {viewMode === '3d' && (
        <div className="absolute inset-0 pt-8">
          <Canvas camera={{ position: [3.5, 2.8, 3.5], fov: 40 }} gl={{ preserveDrawingBuffer: true }}>
            <color attach="background" args={blowoutActive ? ['#1a0505'] : [theme === 'dark' ? '#0a1015' : '#dce2ec']} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={0.9} />
            <directionalLight position={[-3, -5, -3]} intensity={0.15} />
            <directionalLight position={[0, -3, 5]} intensity={0.2} />
            <CaptureHelper onReady={(fn) => { captureFrameRef.current = fn }} />
            {showGridView
              ? <GridReservoir ref={gridReservoirRef} />
              : <><FormationMesh /><CaprockLayer /></>
            }
            <SealOutline />
            <PlumeMeshes />
            <CO2SaturationTop />
            <PlumeGlowSpheres />
            {showGridView ? <CO2Particles /> : <PlumeParticles3D />}
            {blowoutActive && <BlowoutEffect />}
            <PressureOverlay />
            <StressOverlay />
            <WellMarkers />
            <PropertyLabels />
            <DimensionAnnotations />
            <GeologyLayers />
            <FaultPlanes />
            <CaprockMesh />
            {showGridView && <WellGlowLights />}
            {showGridView && <PressureWaveRings />}
            {showGridView && <ConvectionFingers />}
            <BoundingBox />
            <GridHelper />
            <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={1.2} maxDistance={8} />
          </Canvas>
          <StatsOverlay />
          <SimulationHUD />
          <ColorLegendOverlay />
          <TimestepSlider />
          <CurrentPhaseLabel />
          <DepthRuler />
        </div>
      )}

      {/* 2D Plume Section View */}
      {viewMode === '2d' && (
        <div className="absolute inset-0 pt-8">
          <CrossSection fullScreen={true} />
        </div>
      )}

      {/* Caprock failure full-screen overlay */}
      {blowoutActive && (
        <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center pt-8 gap-4">
          {/* Headline */}
          <div className="text-center">
            <div className="text-3xl font-bold text-error opacity-90 animate-pulse font-mono tracking-wide">
              ⚠ CAPROCK FAILURE EVENT
            </div>
            <div className="text-sm text-error/80 mt-1 font-mono">
              Simulated CO₂ migration through fractured seal — injection halted
            </div>
          </div>
          {/* Cause + fix panel */}
          <div
            className="rounded-xl border border-error/40 bg-black/60 backdrop-blur-sm px-5 py-4 max-w-sm text-left space-y-2"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="text-[10px] text-error font-mono font-semibold uppercase tracking-wider mb-1">What happened</div>
            <p className="text-[11px] text-white/80 font-mono leading-relaxed">
              Cumulative injected CO₂ exceeded the P90 storage capacity estimate.
              Sustained overpressure caused the simulated reservoir pressure to approach
              the <strong className="text-white">fracture pressure</strong> of the caprock seal,
              triggering hydraulic fracturing — the primary CO₂ leakage pathway in CCS.
            </p>
            <div className="text-[10px] text-amber-300 font-mono font-semibold uppercase tracking-wider mt-2 mb-1">How to prevent it</div>
            <ul className="text-[11px] text-white/70 font-mono space-y-1">
              <li>→ <strong className="text-white">Reduce injection rate</strong> (Formation panel → well Mt/yr)</li>
              <li>→ <strong className="text-white">Check MAIP margin</strong> in Geomechanics panel before running</li>
              <li>→ <strong className="text-white">Increase formation area</strong> to raise P90 capacity</li>
              <li>→ <strong className="text-white">Increase caprock cohesion / friction</strong> to raise fracture pressure</li>
            </ul>
            <div className="text-[9px] text-white/30 font-mono pt-1 border-t border-white/10">
              MAIP = Maximum Allowable Injection Pressure = 90% × fracture pressure (Hubbert-Willis)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
