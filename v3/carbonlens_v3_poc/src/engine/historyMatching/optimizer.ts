/**
 * optimizer.ts
 *
 * Nelder-Mead simplex optimization in normalized parameter space [0,1].
 * All parameters are mapped to [0,1] before evaluation and back to physical
 * values before calling the misfit function.
 */

import type {
  MatchableParams,
  OptimizationOptions,
  OptimizationResult,
  ObservationData,
} from './types';
import { MATCHABLE_PARAM_BOUNDS } from './types';
import type { FormationParams } from '../../types';
import { computeMisfit } from './misfit';

type NormedVector = number[]; // length = nParams

const PARAM_KEYS = Object.keys(MATCHABLE_PARAM_BOUNDS) as Array<keyof MatchableParams>;
const N = PARAM_KEYS.length;

/** Map physical value → [0, 1] */
function normalize(key: keyof MatchableParams, value: number): number {
  const [lo, hi] = MATCHABLE_PARAM_BOUNDS[key];
  return Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
}

/** Map [0, 1] → physical value, clamped to bounds */
function denormalize(key: keyof MatchableParams, normed: number): number {
  const [lo, hi] = MATCHABLE_PARAM_BOUNDS[key];
  return lo + Math.max(0, Math.min(1, normed)) * (hi - lo);
}

function toNormed(p: MatchableParams): NormedVector {
  return PARAM_KEYS.map(k => normalize(k, p[k]));
}

function toPhysical(v: NormedVector): MatchableParams {
  const out = {} as MatchableParams;
  for (let i = 0; i < N; i++) {
    out[PARAM_KEYS[i]] = denormalize(PARAM_KEYS[i], v[i]);
  }
  return out;
}

function vecAdd(a: NormedVector, b: NormedVector): NormedVector {
  return a.map((ai, i) => ai + b[i]);
}

function vecSub(a: NormedVector, b: NormedVector): NormedVector {
  return a.map((ai, i) => ai - b[i]);
}

function vecScale(a: NormedVector, s: number): NormedVector {
  return a.map(ai => ai * s);
}

function centroid(vertices: NormedVector[], excludeIdx: number): NormedVector {
  const c = new Array<number>(N).fill(0);
  let count = 0;
  for (let i = 0; i < vertices.length; i++) {
    if (i === excludeIdx) continue;
    for (let j = 0; j < N; j++) c[j] += vertices[i][j];
    count++;
  }
  return c.map(x => x / count);
}

/**
 * Run Nelder-Mead simplex optimization over the normalized parameter space.
 */
export function nelderMead(
  initialGuess: MatchableParams,
  bounds: Record<keyof MatchableParams, [number, number]>,
  fixedParams: FormationParams,
  observations: ObservationData,
  options: OptimizationOptions,
): OptimizationResult {
  const { maxIterations, tolerance } = options;

  // NM coefficients (standard)
  const alpha = 1.0;  // reflection
  const gamma = 2.0;  // expansion
  const rho = 0.5;    // contraction
  const sigma = 0.5;  // shrink

  // Build initial simplex: one vertex at guess + N perturbations of ±20% of range
  const x0 = toNormed(initialGuess);
  const simplex: NormedVector[] = [x0];
  for (let i = 0; i < N; i++) {
    const x = [...x0];
    // Perturb 20% in normalized space
    x[i] = Math.max(0, Math.min(1, x[i] + 0.20));
    simplex.push(x);
  }

  // Evaluate all initial vertices
  const objectiveFn = (v: NormedVector): number => {
    const params = toPhysical(v);
    const result = computeMisfit(params, fixedParams, observations);
    return result.totalMisfit;
  };

  let fValues = simplex.map(objectiveFn);
  const convergenceHistory: import('./types').MisfitResult[] = [];

  // Initial best
  let bestIdx = fValues.indexOf(Math.min(...fValues));
  convergenceHistory.push(
    computeMisfit(toPhysical(simplex[bestIdx]), fixedParams, observations)
  );

  let iterations = 0;
  let converged = false;

  while (iterations < maxIterations) {
    iterations++;

    // Sort by function value
    const order = fValues.map((_, i) => i).sort((a, b) => fValues[a] - fValues[b]);
    const sorted = order.map(i => ({ v: simplex[i], f: fValues[i] }));

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const secondWorst = sorted[sorted.length - 2];

    // Convergence check: range of misfit values
    const fRange = worst.f - best.f;
    if (fRange < tolerance) {
      converged = true;
      break;
    }

    // Centroid of all but worst
    const worstOrigIdx = order[order.length - 1];
    const xCentroid = centroid(simplex, worstOrigIdx);

    // Reflection
    const xReflect = vecAdd(xCentroid, vecScale(vecSub(xCentroid, worst.v), alpha));
    const fReflect = objectiveFn(xReflect);

    if (fReflect < best.f) {
      // Expansion
      const xExpand = vecAdd(xCentroid, vecScale(vecSub(xReflect, xCentroid), gamma));
      const fExpand = objectiveFn(xExpand);
      if (fExpand < fReflect) {
        simplex[worstOrigIdx] = xExpand;
        fValues[worstOrigIdx] = fExpand;
      } else {
        simplex[worstOrigIdx] = xReflect;
        fValues[worstOrigIdx] = fReflect;
      }
    } else if (fReflect < secondWorst.f) {
      simplex[worstOrigIdx] = xReflect;
      fValues[worstOrigIdx] = fReflect;
    } else {
      // Contraction
      if (fReflect < worst.f) {
        // Outside contraction
        const xContract = vecAdd(xCentroid, vecScale(vecSub(xReflect, xCentroid), rho));
        const fContract = objectiveFn(xContract);
        if (fContract <= fReflect) {
          simplex[worstOrigIdx] = xContract;
          fValues[worstOrigIdx] = fContract;
        } else {
          // Shrink
          const bestOrigIdx = order[0];
          for (let i = 0; i < simplex.length; i++) {
            if (i === bestOrigIdx) continue;
            simplex[i] = vecAdd(simplex[bestOrigIdx], vecScale(vecSub(simplex[i], simplex[bestOrigIdx]), sigma));
            fValues[i] = objectiveFn(simplex[i]);
          }
        }
      } else {
        // Inside contraction
        const xContract = vecAdd(xCentroid, vecScale(vecSub(worst.v, xCentroid), rho));
        const fContract = objectiveFn(xContract);
        if (fContract < worst.f) {
          simplex[worstOrigIdx] = xContract;
          fValues[worstOrigIdx] = fContract;
        } else {
          // Shrink
          const bestOrigIdx = order[0];
          for (let i = 0; i < simplex.length; i++) {
            if (i === bestOrigIdx) continue;
            simplex[i] = vecAdd(simplex[bestOrigIdx], vecScale(vecSub(simplex[i], simplex[bestOrigIdx]), sigma));
            fValues[i] = objectiveFn(simplex[i]);
          }
        }
      }
    }

    // Track best
    bestIdx = fValues.indexOf(Math.min(...fValues));
    const iterBestParams = toPhysical(simplex[bestIdx]);
    const iterResult = computeMisfit(iterBestParams, fixedParams, observations);
    convergenceHistory.push(iterResult);
  }

  bestIdx = fValues.indexOf(Math.min(...fValues));
  const bestFit = toPhysical(simplex[bestIdx]);
  const bestMisfit = fValues[bestIdx];

  return {
    bestFit,
    bestMisfit,
    convergenceHistory,
    converged,
    iterations,
  };
}
