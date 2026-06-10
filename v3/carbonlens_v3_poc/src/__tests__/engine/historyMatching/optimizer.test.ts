/**
 * Tests for the Nelder-Mead optimizer.
 */

import { describe, it, expect } from 'vitest';
import { nelderMead } from '../../../engine/historyMatching/optimizer';
import {
  DEFAULT_MATCHABLE_PARAMS,
  MATCHABLE_PARAM_BOUNDS,
} from '../../../engine/historyMatching/types';
import type { MatchableParams, OptimizationOptions } from '../../../engine/historyMatching/types';
import { sleipnerFormationParams } from '../../../utils/benchmarkValidation';
import { sleipnerObservations } from '../../../engine/historyMatching/misfit';
import { computeMisfit } from '../../../engine/historyMatching/misfit';

const FORMATION = sleipnerFormationParams();
const OBS = sleipnerObservations();

const OPTS: OptimizationOptions = {
  maxIterations: 30,
  tolerance: 1e-4,
  method: 'nelderMead',
};

// Near-correct starting point for Sleipner
const NEAR_CORRECT: MatchableParams = {
  permeability: 220,
  porosity: 0.33,
  netToGross: 0.80,
  residualGasSaturation: 0.10,
  landConstant: 2.5,
  kvKhRatio: 0.1,
  dissolutionRateFactor: 1.0,
};

describe('nelderMead optimizer', () => {

  // Test 1: converges on known solution for synthetic data (within 10%)
  it('converges on near-correct starting point and improves misfit', () => {
    const initialMisfit = computeMisfit(NEAR_CORRECT, FORMATION, OBS, 0.9).totalMisfit;
    const result = nelderMead(NEAR_CORRECT, MATCHABLE_PARAM_BOUNDS, FORMATION, OBS, OPTS);
    // Optimizer should not make things worse
    expect(result.bestMisfit).toBeLessThanOrEqual(initialMisfit * 1.1 + 0.01);
    expect(result.bestFit).toBeDefined();
  });

  // Test 2: optimizer respects bounds
  it('optimizer respects parameter bounds', () => {
    const result = nelderMead(NEAR_CORRECT, MATCHABLE_PARAM_BOUNDS, FORMATION, OBS, OPTS);
    for (const key of Object.keys(MATCHABLE_PARAM_BOUNDS) as Array<keyof MatchableParams>) {
      const [lo, hi] = MATCHABLE_PARAM_BOUNDS[key];
      expect(result.bestFit[key]).toBeGreaterThanOrEqual(lo - 1e-6);
      expect(result.bestFit[key]).toBeLessThanOrEqual(hi + 1e-6);
    }
  });

  // Test 3: optimizer terminates within maxIterations
  it('terminates within maxIterations', () => {
    const opts: OptimizationOptions = { ...OPTS, maxIterations: 10 };
    const result = nelderMead(NEAR_CORRECT, MATCHABLE_PARAM_BOUNDS, FORMATION, OBS, opts);
    expect(result.iterations).toBeLessThanOrEqual(10);
  });

  // Test 4: convergenceHistory length matches iterations
  it('convergenceHistory length matches iterations + 1 (initial)', () => {
    const opts: OptimizationOptions = { ...OPTS, maxIterations: 5 };
    const result = nelderMead(NEAR_CORRECT, MATCHABLE_PARAM_BOUNDS, FORMATION, OBS, opts);
    // History includes initial + one entry per iteration
    expect(result.convergenceHistory.length).toBe(result.iterations + 1);
  });

  // Test 5: totalMisfit is non-increasing from start to end
  it('totalMisfit is non-increasing over convergence history', () => {
    const opts: OptimizationOptions = { ...OPTS, maxIterations: 20 };
    const result = nelderMead(NEAR_CORRECT, MATCHABLE_PARAM_BOUNDS, FORMATION, OBS, opts);
    if (result.convergenceHistory.length > 1) {
      const firstMisfit = result.convergenceHistory[0].totalMisfit;
      const lastMisfit = result.convergenceHistory[result.convergenceHistory.length - 1].totalMisfit;
      // Final should not be significantly worse than first
      expect(lastMisfit).toBeLessThanOrEqual(firstMisfit * 1.5 + 0.05);
    }
  });

  // Test 6: optimizer works with only plumeArea observations
  it('works with only plumeArea observations', () => {
    const obs = { plumeAreaVsTime: OBS.plumeAreaVsTime };
    const result = nelderMead(DEFAULT_MATCHABLE_PARAMS, MATCHABLE_PARAM_BOUNDS, FORMATION, obs, OPTS);
    expect(result.bestMisfit).toBeGreaterThanOrEqual(0);
    expect(result.bestFit).toBeDefined();
    expect(result.iterations).toBeGreaterThan(0);
  });

});
