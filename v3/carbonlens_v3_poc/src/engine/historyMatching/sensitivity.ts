/**
 * sensitivity.ts
 *
 * One-at-a-time (OAT) parameter sweep for sensitivity analysis.
 * Varies a single parameter across its range while holding all others fixed.
 */

import type {
  MatchableParams,
  SensitivityResult,
  SweepPoint,
  ObservationData,
} from './types';
import type { FormationParams } from '../../types';
import { computeMisfit } from './misfit';

/**
 * Vary `paramKey` across `nSteps` linearly between bounds,
 * holding all other params at `baseParams`.
 *
 * @param baseParams  Base parameter set (other params are fixed here)
 * @param paramKey    Parameter to sweep
 * @param bounds      [min, max] physical range for the sweep
 * @param nSteps      Number of steps (default 20)
 * @param formation   Formation parameters for forward model
 * @param observations Observed data for misfit calculation
 * @returns           SensitivityResult with sweep points
 */
export function oneAtATimeSweep(
  baseParams: MatchableParams,
  paramKey: keyof MatchableParams,
  bounds: [number, number],
  nSteps: number = 20,
  formation: FormationParams,
  observations: ObservationData,
): SensitivityResult {
  const [lo, hi] = bounds;
  const step = (hi - lo) / Math.max(1, nSteps - 1);

  // Compute baseline misfit
  const baselineMisfitResult = computeMisfit(baseParams, formation, observations);
  const baselineMisfit = baselineMisfitResult.totalMisfit;

  const sweep: SweepPoint[] = [];

  for (let i = 0; i < nSteps; i++) {
    const paramValue = lo + i * step;
    const params: MatchableParams = { ...baseParams, [paramKey]: paramValue };
    const result = computeMisfit(params, formation, observations);
    sweep.push({ paramValue, misfit: result.totalMisfit });
  }

  return {
    param: paramKey,
    sweep,
    baselineMisfit,
  };
}
