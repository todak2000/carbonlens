import { GeologicalModel, StratigraphicZone, FaultDefinition } from '../types/geological'

export interface GridCell {
  instanceId: number
  i: number
  j: number
  k: number
  zoneId: string
  zoneName: string
  isCaprock: boolean
  activeForInjection: boolean
  porosity: number
  kHorizontal: number
  kVertical: number
  capillaryEntryPressure: number
  faultTransmX: number  // transmissibility multiplier on +X face
  faultTransmY: number  // transmissibility multiplier on +Y face
  co2Saturation: number
  co2Phase: 'none' | 'free' | 'residual' | 'dissolved' | 'mineral' | 'imbibition'
  pressure: number
  centerX: number       // normalised model coords -1 to 1
  centerY: number
  centerZ: number       // normalised -1 (base) to 1 (top)
  depthM: number        // real-world depth in metres (centre of cell)
  kHorizontal0: number  // initial horizontal permeability (for stress-dependent tracking)
  kVertical0: number    // initial vertical permeability
  porosity0: number     // initial porosity
}

export interface SimulationGridData {
  cells: GridCell[]
  nx: number
  ny: number
  nz: number
  modelWidthM: number
  modelLengthM: number
  totalThicknessM: number
  minDepthM: number
  maxDepthM: number
  dxArr: Float32Array
  dyArr: Float32Array
  dzArr: Float32Array
}

function makeRefinedSpacing(n: number, totalLength: number, refinementRatio = 3.0): Float32Array {
  const arr = new Float32Array(n)
  let sum = 0
  const raw = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const cosBell = Math.cos(Math.PI * (t - 0.5))
    // Inverted cosine-bell: center cells are finest (smallest), boundary cells coarsest.
    // cosBell = 1 at center, 0 at boundaries.
    // raw = 1 at center (fine), refinementRatio at boundaries (coarse).
    raw[i] = 1 + (refinementRatio - 1) * (1 - cosBell * cosBell)
    sum += raw[i]
  }
  const scale = totalLength / sum
  for (let i = 0; i < n; i++) arr[i] = raw[i] * scale
  return arr
}

// Simple LCG pseudo-random for deterministic noise
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123
  return x - Math.floor(x)
}

function spatialNoise(i: number, j: number, k: number, seed: number): number {
  return pseudoRandom(i * 1973 + j * 9737 + k * 4337 + seed)
}

function getZoneAtDepth(zones: StratigraphicZone[], depthM: number): StratigraphicZone | null {
  const sorted = [...zones].sort((a, b) => a.topDepth - b.topDepth)
  for (const zone of sorted) {
    if (depthM >= zone.topDepth && depthM < zone.topDepth + zone.thickness) {
      return zone
    }
  }
  return null
}

function computeFaultTransm(
  faults: FaultDefinition[],
  cx: number, cy: number,   // normalised 0–1 cell centre
  axis: 'x' | 'y',
  modelWidthM: number,
  modelLengthM: number
): number {
  let minTransm = 1.0
  for (const fault of faults) {
    // Convert fault position to normalised coords
    const fx = fault.positionX
    const fy = fault.positionY
    // Fault half-length in normalised coords
    const halfLenNorm = (fault.length / 2) / (axis === 'x' ? modelWidthM : modelLengthM)
    const angleRad = ((fault.strike - 90) * Math.PI) / 180
    // Check if this cell face intersects the fault trace
    const dx = cx - fx
    const dy = cy - fy
    // Project onto fault-perpendicular direction
    const perpDist = Math.abs(dx * Math.sin(angleRad) - dy * Math.cos(angleRad))
    const parallelDist = Math.abs(dx * Math.cos(angleRad) + dy * Math.sin(angleRad))
    const faultWidth = Math.max(fault.faultZoneThickness / modelWidthM, 0.002)
    if (perpDist < faultWidth && parallelDist < halfLenNorm) {
      // Effective sealing = max of sealing factor and clay smear
      const effectiveSeal = Math.max(fault.sealingFactor, fault.claySmearFactor)
      // Transmissibility = 1 - effective seal (0 = perfectly sealing)
      const transmult = 1.0 - effectiveSeal
      minTransm = Math.min(minTransm, transmult)
    }
  }
  return minTransm
}

export function geologicalModelToGrid(
  model: GeologicalModel,
  nx = 20,
  ny = 20,
  nz = 10
): SimulationGridData {
  const sortedZones = [...model.zones].sort((a, b) => a.topDepth - b.topDepth)

  if (sortedZones.length === 0) {
    return {
      cells: [], nx, ny, nz,
      modelWidthM: model.modelWidthM,
      modelLengthM: model.modelLengthM,
      totalThicknessM: 0,
      minDepthM: 0,
      maxDepthM: 0,
      dxArr: makeRefinedSpacing(nx, model.modelWidthM),
      dyArr: makeRefinedSpacing(ny, model.modelLengthM),
      dzArr: new Float32Array(nz).fill(1),
    }
  }

  const minDepthM = sortedZones[0].topDepth
  const lastZone = sortedZones[sortedZones.length - 1]
  const maxDepthM = lastZone.topDepth + lastZone.thickness
  const totalThicknessM = maxDepthM - minDepthM

  const dxArr = makeRefinedSpacing(nx, model.modelWidthM)
  const dyArr = makeRefinedSpacing(ny, model.modelLengthM)
  const dzArr = makeRefinedSpacing(nz, totalThicknessM)

  const xCum = new Float32Array(nx + 1)
  const yCum = new Float32Array(ny + 1)
  const zCum = new Float32Array(nz + 1)
  for (let i = 0; i < nx; i++) xCum[i + 1] = xCum[i] + dxArr[i]
  for (let j = 0; j < ny; j++) yCum[j + 1] = yCum[j] + dyArr[j]
  for (let k = 0; k < nz; k++) zCum[k + 1] = zCum[k] + dzArr[k]

  const cells: GridCell[] = []
  let instanceId = 0

  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const cx = (xCum[i] + xCum[i + 1]) / 2 / model.modelWidthM
        const cy = (yCum[j] + yCum[j + 1]) / 2 / model.modelLengthM
        const cz = (zCum[k] + zCum[k + 1]) / 2 / totalThicknessM

        // Real depth of cell centre
        const depthM = minDepthM + cz * totalThicknessM

        // Find which stratigraphic zone this depth belongs to
        const matchedZone = getZoneAtDepth(sortedZones, depthM)
        const zone = matchedZone ?? {
          id: '__gap__',
          name: 'Gap',
          lithology: 'shale' as const,
          topDepth: depthM - 1,
          thickness: 2,
          netToGross: 0.1,
          porosityMean: 0.01,
          porosityStdDev: 0.01,
          kHorizontal: 1e-6,
          kVerticalRatio: 0.01,
          capillaryEntryPressure: 10,
          wettability: 'water_wet' as const,
          horizonShape: 'none' as const,
          horizonParams: {} as any,
          xMin: -1, xMax: 1, yMin: -1, yMax: 1,
          activeForInjection: false,
          isCaprock: true,
          color: '#666666',
        }

        // Spatially correlated porosity (FBM-like)
        const noiseVal = spatialNoise(i, j, k, 42)
        const porosity = Math.max(
          0.01,
          Math.min(
            0.55,
            zone.porosityMean + (noiseVal - 0.5) * 2 * zone.porosityStdDev * 2
          )
        )

        // Log-normal permeability variation
        const kNoise = spatialNoise(i, j, k, 137)
        const logK = Math.log10(Math.max(1e-6, zone.kHorizontal))
        const kHorizontal = Math.pow(10, logK + (kNoise - 0.5) * 0.6)
        const kVertical = kHorizontal * zone.kVerticalRatio

        // Fault transmissibility
        const faultTransmX = computeFaultTransm(model.faults, cx, cy, 'x', model.modelWidthM, model.modelLengthM)
        const faultTransmY = computeFaultTransm(model.faults, cx, cy, 'y', model.modelWidthM, model.modelLengthM)

        cells.push({
          instanceId: instanceId++,
          i, j, k,
          zoneId: zone.id,
          zoneName: zone.name,
          isCaprock: zone.isCaprock,
          activeForInjection: zone.activeForInjection,
          porosity,
          kHorizontal,
          kVertical,
          capillaryEntryPressure: zone.capillaryEntryPressure,
          faultTransmX,
          faultTransmY,
          co2Saturation: 0,
          co2Phase: 'none',
          pressure: 0,
          centerX: cx * 2 - 1,     // -1 to 1
          centerY: cy * 2 - 1,
          centerZ: -(cz * 2 - 1),  // 1 = top, -1 = base (Three.js y-up)
          depthM,
          kHorizontal0: kHorizontal,
          kVertical0: kVertical,
          porosity0: porosity,
        })
      }
    }
  }

  return { cells, nx, ny, nz, modelWidthM: model.modelWidthM, modelLengthM: model.modelLengthM, totalThicknessM, minDepthM, maxDepthM, dxArr, dyArr, dzArr }
}
