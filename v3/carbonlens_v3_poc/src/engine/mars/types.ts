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

export interface MarsHinge {
  feature: keyof MarsInput | string
  direction: number
  knot: number
}

export interface MarsTerm {
  coefficient: number
  hinges: MarsHinge[]
}

export interface MarsEquation {
  intercept: number
  terms: MarsTerm[]
}

export interface ScalerParams {
  min: number
  max: number
}

export interface FeatureScaler {
  feature_cols: (keyof MarsInput)[]
  scale_min: number
  scale_max: number
  params: Record<string, ScalerParams>
}

export type PhaseRegime = 'subcritical' | 'supercritical'
