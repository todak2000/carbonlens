export { evaluateMars, scaleInput, subEquation, subScaler, supEquation, supScaler, hinge, assessApplicabilityDomain } from './mars'
export type { MarsInput, MarsEquation, FeatureScaler, PhaseRegime, ADResult, ADViolation } from './mars'
export {
  co2DensitySpanWagner,
  co2DensityPR,
  brineDensityGarcia,
  co2ViscosityFenghour,
  co2ViscosityLaeseckeMuzny,
  isNearCriticalRegion,
  co2SolubilityDuanSun,
  co2DiffusionCoefficient,
  determinePhase,
  computeTr,
  computePr,
} from './classical'
