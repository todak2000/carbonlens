export { co2DensitySpanWagner, co2DensityPR, brineDensityGarcia } from './density'
export { co2ViscosityFenghour, co2ViscosityLaeseckeMuzny, isNearCriticalRegion } from './viscosity'
export { co2SolubilityDuanSun, calculateMultiSaltSolubility } from './solubility'
export type { MultiSaltBrine } from './solubility'
export { co2DiffusionCoefficient } from './diffusion'
export { determinePhase, computeTr, computePr } from './phase'
export { co2DensityPengRobinson, co2DensityWithImpurities } from './pengrobin'
export type { GasComposition } from './pengrobin'
export {
  computeSweepEfficiency,
  computeStorageEfficiency,
  computeAoRHeterogeneityFactor,
  computeHeterogeneityCorrections,
} from './heterogeneityCorrection'
export type { HeterogeneityCorrectionResult } from './heterogeneityCorrection'
