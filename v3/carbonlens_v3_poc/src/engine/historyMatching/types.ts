import type { FormationParams, SimulationResult } from '../../types';

export interface MatchableParams {
  permeability: number;           // mD [50–5000]
  porosity: number;               // fraction [0.05–0.40]
  netToGross: number;             // fraction [0.3–1.0]
  residualGasSaturation: number;  // fraction [0.05–0.35]
  landConstant: number;           // [1.5–5.0]
  kvKhRatio: number;              // [0.01–1.0]
  dissolutionRateFactor: number;  // multiplier on kLa [0.1–5.0]
}

export const DEFAULT_MATCHABLE_PARAMS: MatchableParams = {
  permeability: 1000,
  porosity: 0.27,
  netToGross: 0.85,
  residualGasSaturation: 0.10,
  landConstant: 2.5,
  kvKhRatio: 0.1,
  dissolutionRateFactor: 1.0,
};

export const MATCHABLE_PARAM_BOUNDS: Record<keyof MatchableParams, [number, number]> = {
  permeability: [50, 5000],
  porosity: [0.05, 0.40],
  netToGross: [0.3, 1.0],
  residualGasSaturation: [0.05, 0.35],
  landConstant: [1.5, 5.0],
  kvKhRatio: [0.01, 1.0],
  dissolutionRateFactor: [0.1, 5.0],
};

export const MATCHABLE_PARAM_LABELS: Record<keyof MatchableParams, string> = {
  permeability: 'Permeability (mD)',
  porosity: 'Porosity',
  netToGross: 'Net-to-Gross',
  residualGasSaturation: 'Residual Gas Sat.',
  landConstant: 'Land Constant C',
  kvKhRatio: 'kv/kh Ratio',
  dissolutionRateFactor: 'Dissolution Rate Factor',
};

export interface ObservationPoint {
  year: number;
  value: number;
  weight?: number;
}

export interface ObservationData {
  plumeAreaVsTime?: ObservationPoint[];       // km²
  injectionPressureVsTime?: ObservationPoint[]; // MPa
  pushdownVsTime?: ObservationPoint[];         // ms (seismic pushdown)
  dissolutionRateMax?: number;                 // %/yr
  co2DensityTarget?: number;                   // kg/m³
  plumeRadiusTargets?: ObservationPoint[];     // m
}

export interface MisfitComponent {
  name: string;
  value: number;      // normalized RMSE for this observable
  weight: number;
  nPoints: number;
}

export interface MisfitResult {
  totalMisfit: number;
  componentMisfits: Record<string, MisfitComponent>;
  simulatedResults: SimulationResult[];
  parameterSet: MatchableParams;
  isValid: boolean;
  validationMessages: string[];
}

export interface OptimizationOptions {
  maxIterations: number;
  tolerance: number;
  method: 'nelderMead';
}

export interface OptimizationResult {
  bestFit: MatchableParams;
  bestMisfit: number;
  convergenceHistory: MisfitResult[];
  converged: boolean;
  iterations: number;
}

export interface SweepPoint {
  paramValue: number;
  misfit: number;
}

export interface SensitivityResult {
  param: keyof MatchableParams;
  sweep: SweepPoint[];
  baselineMisfit: number;
}

// Re-export FormationParams for internal use within historyMatching module
export type { FormationParams, SimulationResult };
