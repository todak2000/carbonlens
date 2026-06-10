export type LithologyType =
  | 'sandstone'
  | 'arkosic_sandstone'
  | 'limestone'
  | 'dolomite'
  | 'chalk'
  | 'siltstone'
  | 'shale'
  | 'anhydrite'

export type HorizonShape =
  | 'flat'
  | 'tilted'
  | 'anticline'
  | 'dome'
  | 'wedge'
  | 'onlap'
  | 'thin_rim'
  | 'unconformity'
  | 'imported'

export interface HorizonShapeParams {
  dipAngle?: number        // degrees
  dipAzimuth?: number      // degrees
  foldAmplitude?: number   // metres
  foldWavelength?: number  // metres
  foldAxisAzimuth?: number // degrees
  domeRadius?: number      // metres
  domeAmplitude?: number   // metres
  wedgeThinningAzimuth?: number // degrees
  rimWidth?: number        // metres
  importedGrid?: number[][] // depth offsets (nx x ny)
}

export interface StratigraphicZone {
  id: string
  name: string
  lithology: LithologyType
  topDepth: number           // metres TVD
  thickness: number          // gross thickness metres
  netToGross: number         // 0–1
  porosityMean: number       // fraction 0–1
  porosityStdDev: number     // fraction 0–1
  kHorizontal: number        // mD
  kVerticalRatio: number     // k_v/k_h 0–1
  capillaryEntryPressure: number // MPa
  wettability: 'water_wet' | 'mixed_wet'
  horizonShape: HorizonShape
  horizonParams: HorizonShapeParams
  xMin: number               // normalised model coords -1 to 1
  xMax: number
  yMin: number
  yMax: number
  activeForInjection: boolean
  isCaprock: boolean
  color: string              // hex color
}

export interface FaultDefinition {
  id: string
  name: string
  positionX: number          // normalised model coords 0–1
  positionY: number
  strike: number             // degrees 0–360
  dip: number                // degrees 0–90
  throw: number              // metres
  length: number             // metres
  sealingFactor: number      // 0 sealing – 1 open
  claySmearFactor: number    // 0–1
  faultZoneThickness: number // metres
}

export interface GeologicalModel {
  zones: StratigraphicZone[] // ordered top to bottom
  faults: FaultDefinition[]
  modelWidthM: number        // real-world model width metres
  modelLengthM: number       // real-world model length metres
}

export interface LithologyDefaults {
  porosityMin: number
  porosityMax: number
  porosityDefault: number
  kMin: number
  kMax: number
  kDefault: number
  kvkhDefault: number
  capillaryEntryPressureDefault: number
  color: string
  label: string
  description: string
  mineralTrapPotential: 'none' | 'low' | 'moderate' | 'high'
}
