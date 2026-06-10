export type ColorProperty = 'porosity' | 'permeability' | 'salinity' | 'ift' | 'co2Density' | 'solubility' | 'depth' | 'custom'
export type GeometryType = 'anticline' | 'dome' | 'fault' | 'layered' | 'stratigraphic' | 'channel' | 'gridfile'
export type SaltType = 'NaCl' | 'CaCl2' | 'Mixed'
export type Jurisdiction = 'US' | 'EU' | 'Malaysia' | 'Australia' | 'Norway'
export type SimulationStatus = 'idle' | 'running' | 'complete' | 'error'
export type ProjectVisibility = 'private' | 'shared'

export interface MarsInput {
  Pr: number
  Tr: number
  MCM: number
  BCM: number
  x_CH4: number
  x_N2: number
  drho_sq: number
  BCM_bin: number
  CH4_bin: number
  N2_bin: number
}

export interface MarsTerm {
  term_index: number
  term_label: string
  coefficient: number
  hinges: MarsHinge[]
}

export interface MarsHinge {
  feature: string
  direction: number
  knot: number
}

export interface MarsEquation {
  split: string
  n_terms: number
  intercept: number
  terms: MarsTerm[]
}

export interface MarsScalerParams {
  min: number
  max: number
}

export interface MarsScaler {
  feature_cols: string[]
  scale_min: number
  scale_max: number
  params: Record<string, MarsScalerParams>
}

export interface ADViolation {
  feature: string
  value: number
  min: number
  max: number
  pct_outside: number
}

export interface ADResult {
  status: 'green' | 'yellow' | 'red'
  pi_halfwidth: number
  pi_level: number
  violations: ADViolation[]
}

export interface ClassicalProperties {
  co2Density: number
  brineDensity: number
  densityDifference: number
  densityDifferenceSq: number
  co2Viscosity: number
  co2Solubility: number
  diffusionCoefficient: number
}

export interface FluidProperties {
  temperature: number
  pressure: number
  co2Density: number
  brineDensity: number
  densityDiff: number
  co2Viscosity: number
  solubility: number
  diffusion: number
  ift: number | null
  phaseState: 'subcritical' | 'supercritical'
}

export interface FormationParams {
  depth: number
  thickness: number
  porosity: number
  permeability: number
  pressure: number
  temperature: number
  monovalentSalinity: number
  bivalentSalinity: number
  saltType: SaltType
  methaneFraction: number
  nitrogenFraction: number
  area: number
  geometryType: GeometryType
  netToGross: number
  caprockFriction: number
  caprockCohesion: number
  biotCoefficient: number
}

export interface Well {
  id: string
  x: number
  z: number
  injectionRate: number
  label: string
  rampUpYears: number
  rampDownYears: number
}

export interface PressureFieldPoint {
  x: number
  z: number
  pressure: number // MPa
}

export interface SimulationResult {
  storageCapacity: number   // actual CO2 stored = totalCum (Mt)
  totalCapacity: number     // DOE P50 realistic capacity (2% of total pore volume, Mt)
  capacityP10: number       // DOE P10 capacity (0.51% Cc, Mt)
  capacityP90: number       // DOE P90 capacity (5.5% Cc, Mt)
  capacityUtilPct: number   // utilisation = storageCapacity / totalCapacity * 100
  overpressureRisk: boolean // true when stored CO2 exceeds P90 capacity (pressure unsafe)
  plumeRadius: number
  plumeHeight: number  // vertical extent of CO2 plume (m)
  injectionPressure: number // pressure at the wellbore (MPa)
  pressureField: PressureFieldPoint[] // spatial pressure distribution in the reservoir
  co2Density: number
  brineDensity: number
  densityDiff: number
  co2Viscosity: number
  solubility: number
  diffusion: number
  solubilityTrapping: number
  residualTrapping: number
  mineralTrapping: number
  mobilePlume: number
  containmentProbability: number
  ift: number | null
  adAssessment: ADResult | null
  p10: number  // DOE storage capacity P10 (low estimate, Mt)
  p50: number  // DOE storage capacity P50 (best estimate, Mt)
  p90: number  // DOE storage capacity P90 (high estimate, Mt)
  storageEfficiency: number  // effective P50 Cc as % (= Cc_P50 × 100 = 2.0%) for transparency
}

export interface GeomechanicsResult {
  capRockStress: number
  fracturePressure: number
  safetyFactor: number
  inducedSeismicityRisk: 'low' | 'moderate' | 'high'
  faultSlipPotential: number
  surfaceHeave: number
  // Mohr-Coulomb fields
  mohrSafetyMargin: number
  dcff: number
  frictionAngle: number
  cohesion: number
  biotCoefficient: number
  overburdenStress: number
  minHorizontalStress: number
  mohrFailed: boolean
  // MAIP fields
  maip: number
  maipMargin: number
  pressureFrontRadius: number
}

export interface StorageProject {
  id: string
  name: string
  description: string
  formation: FormationParams
  wells: Well[]
  jurisdiction: Jurisdiction
  createdAt: number
  updatedAt: number
  simulationResult: SimulationResult | null
  geomechanicsResult: GeomechanicsResult | null
  visibility: ProjectVisibility
  tags: string[]
}

export interface LasCurveData {
  depths: number[]
  values: number[]
  curveName: string
}

export interface LasState {
  curves: LasCurveData[]
  depthMin: number
  depthMax: number
}

export interface UserProfile {
  email: string
  displayName: string
  organization: string
  tier: 'free' | 'pro' | 'enterprise'
  createdAt: number
}

export * from './geological'
