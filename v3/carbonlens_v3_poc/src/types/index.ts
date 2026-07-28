export type ColorProperty = 'porosity' | 'permeability' | 'salinity' | 'ift' | 'co2Density' | 'solubility' | 'depth' | 'pressure' | 'geomechanics' | 'custom'
export type GeometryType = 'anticline' | 'dome' | 'fault' | 'layered' | 'stratigraphic' | 'channel' | 'gridfile'
export type SaltType = 'NaCl' | 'CaCl2' | 'Mixed'
export type FormationType = 'saline_aquifer' | 'depleted_gas' | 'depleted_oil' | 'hybrid'
export type Jurisdiction = 'US' | 'EU' | 'Malaysia' | 'Australia' | 'Norway' | 'MY' | 'AU' | 'DZ' | 'NG' | 'ID' | 'EG' | 'AE' | 'CA'
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
  formationType?: FormationType         // default = saline_aquifer if absent
  isOverpressured?: boolean             // flag: pressure regime is above hydrostatic (North Sumatra, Malay Basin)
  giip?: number                         // Gas Initially In Place [Bcm] — depleted fields only
  abandonmentPressure?: number          // Current sub-hydrostatic pressure [MPa] — depleted fields only
  // ── Site-specific geomechanical parameters ─────────────────────────────────
  poissonRatio?: number                 // reservoir/overburden Poisson ratio (default 0.30)
  overburdenGradient?: number           // overburden stress gradient [MPa/m] (default 0.023)
  stressRatioK0?: number                // σh/σv ratio — extensional ~0.55–0.65, compressional ~0.90–1.20 (default 0.82)
  reservoirYoungsModulus?: number       // Young's modulus [GPa] for heave calc — 5 sandstone, 15–30 carbonate (default 5)
  fracturedReservoir?: boolean          // true → apply fracture compliance factor (0.20×) to heave estimate
  lithologyClass?: 'carbonate' | 'sandstone' | 'chalk'  // reservoir matrix type — governs mineral trapping kinetics
  // ── Heterogeneous formation parameters ──────────────────────────────────────
  k_Vdp?: number                       // Dykstra-Parsons permeability variation coefficient V (0 to 0.85); default 0 = homogeneous
  k_layer_ratio?: number               // kh/kv anisotropy ratio (≥1); default 1 = isotropic
  n_layers?: number                    // Number of permeability layers in formation; default 1 = homogeneous
  // ── Validation / benchmark overrides ────────────────────────────────────────
  co2DensityOverride?: number          // kg/m³ — pin CO2 density to a prescribed value, bypassing EOS (for benchmark matching)
  swiConnate?: number                  // connate water saturation fraction (default 0.15); expose for benchmark alignment
  // ── k_eff calibration (kEffCalibration.ts) ──────────────────────────────────
  // When set, VE gravity-current predictions use this calibrated effective permeability
  // instead of the raw formation permeability. Back-calculated from a field anchor point
  // using the Boait (2012) inversion. Units: mD.
  k_eff_calibrated_mD?: number
  geothermalGradient?: number   // °C per 100m depth (typical 2.5-4.0); if set, overrides temperature at reservoir midpoint
  surfaceTemperatureC?: number  // surface reference temperature °C (default 15); only used with geothermalGradient
}

export interface Perforation {
  topFrac: number
  bottomFrac: number
  flowFraction: number
}

export interface Well {
  id: string
  x: number
  z: number
  injectionRate: number
  label: string
  rampUpYears: number
  rampDownYears: number
  perforations?: Perforation[]
}

export interface PressureFieldPoint {
  x: number
  z: number
  pressure: number // MPa
}

export interface SimulationResult {
  storageCapacity: number   // actual CO2 stored = totalCum (Mt)
  totalCapacity: number     // DOE P50 realistic capacity (2% of total pore volume, Mt)
  capacityP90: number       // DOE P90 capacity (0.51% Cc, conservative, Mt)
  capacityP10: number       // DOE P10 capacity (5.5% Cc, optimistic, Mt)
  capacityUtilPct: number   // utilisation = storageCapacity / totalCapacity * 100
  overpressureRisk: boolean // true when stored CO2 exceeds P50 capacity (consistent with rate optimisation target)
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
  p90: number  // DOE storage capacity P90 (conservative / low estimate, Mt)
  p50: number  // DOE storage capacity P50 (expected estimate, Mt)
  p10: number  // DOE storage capacity P10 (optimistic / high estimate, Mt)
  storageEfficiency: number   // effective P50 Cc as % (= Cc_P50 × 100 = 2.0%) for transparency
  peacemanBHP?: number        // Peaceman (1978) wellbore BHP — accounts for skin & completion (MPa)
  injectivityIndex?: number   // J = q / ΔP  [m³/(d·MPa)] — diagnostic for injectivity assessment
  haliteRisk?: import('../engine/classical/haliteRisk').HaliteRiskResult
  vePlumeArea?: number        // VE solver: 2D plume footprint (km²)
  vePlumeRadius?: number      // VE solver: effective circular radius of VE plume (m)
  veSatGrid?: Float32Array | null  // VE solver: per-cell saturation (η/H), 60×60 row-major, for 3D render
  // Physics-based independent trapping capacities (Bachu et al. 2007 framework)
  // Each capacity is derived solely from formation properties — none is a residual of the others.
  structuralCapacity: number      // closure trap volume × ρ_CO₂ from geometry (Mt)
  residualCapacity: number        // Land(1968) snap-off in swept pore volume (Mt)
  dissolutionCapacity: number     // Duan-Sun solubility + Fick + Rayleigh convection (Mt)
  mineralCapacity: number         // mineral trapping (~0 at ≤20 yr) (Mt)
  totalFormationCapacity: number  // sum of all four independent capacities (Mt)
  formationCapacityUtil: number   // injected / totalFormationCapacity × 100%
  // Multiphase closure diagnostics (Nordbotten & Celia 2006)
  massBalanceError: number        // ε = injected − (residual + dissolved + mobile); ≥0 for unswept CO₂
  // Post-injection gravity current (Hesse et al. 2008) — present only when all wells have shut in
  hessePostInjection?: import('../engine/plume/hessePostInjection').HesseResult
  // Heterogeneous formation corrections (Shook & Mitchell 2009, Kopp et al. 2010)
  heterogeneityCorrected?: boolean     // true when k_Vdp > 0.05
  heterogeneityCitation?: string       // "Shook & Mitchell (2009), Kopp et al. (2010)"
  sweepEfficiency?: number             // E_s from Shook correlation (0 to 1)
  aorHeterogeneityFactor?: number      // multiplier on homogeneous AoR radius (≥1)
  // Physics regime classification (Nordbotten & Celia 2006, NETL 2015)
  formationRegime?: import('../engine/classical/formationRegimeClassifier').FormationRegime
  // ── In-situ PVT field statistics (co2PVTTable.ts) ───────────────────────────
  // Computed from the spatial pressure field at each simulation year.
  // Replaces the single-point density assumption with a field-average from
  // Span-Wagner EOS evaluated at local pressure for each pressure field point.
  pvtStats?: import('../engine/pvt/co2PVTTable').PVTFieldStats
  // ── Wellbore hydraulics (hydrostatic BHP) ───────────────────────────────────
  // Complementary to peacemanBHP (reservoir-side Darcy pressure).
  // hydrostaticBHP = WHP + rho_CO2 * g * depth — what you see at the perforations
  // when injecting at a given wellhead pressure. Useful for surface facility design
  // and for checking that the wellhead can sustain the required injection pressure.
  hydrostaticBHP_MPa?: number
  // Margin between fracture pressure and the higher of (peacemanBHP, hydrostaticBHP).
  // Positive = safe; negative = fracture risk at current injection rate or WHP.
  bhpMargin_MPa?: number
  temperatureAtTopC?: number    // T at reservoir top from geothermal gradient
  temperatureAtBaseC?: number   // T at reservoir base from geothermal gradient
  tubingFrictionDrop_MPa?: number  // Darcy-Weisbach friction loss along injection tubing (MPa)
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
