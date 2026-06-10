/**
 * misfit.ts
 *
 * Computes normalized RMSE misfit between simulated and observed data
 * for the history matching engine.
 */

import type { ObservationData, MatchableParams, MisfitResult, MisfitComponent } from './types';
import type { FormationParams } from '../../types';
import { runForwardModel } from './forwardAdapter';
import { SLEIPNER_LAYER9_AREA, SLEIPNER, SLEIPNER_VALIDATION, SLEIPNER_PUSHDOWN } from '../../data/sleipnerBenchmark';

// Re-export for external use
export { SLEIPNER_LAYER9_AREA };

/**
 * Compute normalized RMSE for a set of (observed, simulated) pairs.
 * RMSE is normalized by the mean of observed values to make it dimensionless.
 */
function normalizedRMSE(
  pairs: Array<{ observed: number; simulated: number; weight: number }>,
): number {
  if (pairs.length === 0) return 0;
  let sumSqErr = 0;
  let sumObs = 0;
  let totalWeight = 0;
  for (const p of pairs) {
    const w = p.weight ?? 1;
    sumSqErr += w * (p.observed - p.simulated) ** 2;
    sumObs += w * p.observed;
    totalWeight += w;
  }
  const meanObs = sumObs / totalWeight;
  if (Math.abs(meanObs) < 1e-10) return 0;
  return Math.sqrt(sumSqErr / totalWeight) / Math.abs(meanObs);
}

/**
 * Compute the composite misfit between a given parameter set and field observations.
 */
export function computeMisfit(
  matchable: MatchableParams,
  formation: FormationParams,
  observations: ObservationData,
  injectionRateMtPerYear: number = 0.9,
): MisfitResult {
  const validationMessages: string[] = [];

  // Determine maximum year needed from all observation sets
  // If only dissolutionRateMax is given, we need at least 10 years for a meaningful rate
  let maxYear = 1;
  if (observations.plumeAreaVsTime) {
    for (const p of observations.plumeAreaVsTime) maxYear = Math.max(maxYear, p.year);
  }
  if (observations.injectionPressureVsTime) {
    for (const p of observations.injectionPressureVsTime) maxYear = Math.max(maxYear, p.year);
  }
  if (observations.pushdownVsTime) {
    for (const p of observations.pushdownVsTime) maxYear = Math.max(maxYear, p.year);
  }
  if (observations.plumeRadiusTargets) {
    for (const p of observations.plumeRadiusTargets) maxYear = Math.max(maxYear, p.year);
  }
  if (observations.co2DensityTarget) maxYear = Math.max(maxYear, 5);
  // Dissolution rate check requires at least 10 years of history for a meaningful rate
  if (observations.dissolutionRateMax !== undefined) maxYear = Math.max(maxYear, 10);

  // Run forward model
  const simulatedResults = runForwardModel(formation, matchable, maxYear, injectionRateMtPerYear);

  // Helper: get result at a specific year (1-indexed)
  const resultAt = (year: number) => simulatedResults[Math.min(year, simulatedResults.length) - 1];

  const componentMisfits: Record<string, MisfitComponent> = {};

  // ── 1. Plume area vs time ────────────────────────────────────────────────
  if (observations.plumeAreaVsTime && observations.plumeAreaVsTime.length > 0) {
    const pairs: Array<{ observed: number; simulated: number; weight: number }> = [];
    for (const obs of observations.plumeAreaVsTime) {
      const sim = resultAt(obs.year);
      // Convert plume radius (m) to area (km²): A = π * r²  / 1e6
      const simAreaKm2 = Math.PI * sim.plumeRadius ** 2 / 1e6;
      pairs.push({ observed: obs.value, simulated: simAreaKm2, weight: obs.weight ?? 1 });
    }
    const rmse = normalizedRMSE(pairs);
    componentMisfits['plumeArea'] = {
      name: 'Plume Area',
      value: rmse,
      weight: 1.0,
      nPoints: pairs.length,
    };
  }

  // ── 2. Injection pressure vs time ─────────────────────────────────────────
  if (observations.injectionPressureVsTime && observations.injectionPressureVsTime.length > 0) {
    const pairs: Array<{ observed: number; simulated: number; weight: number }> = [];
    for (const obs of observations.injectionPressureVsTime) {
      const sim = resultAt(obs.year);
      pairs.push({ observed: obs.value, simulated: sim.injectionPressure, weight: obs.weight ?? 1 });
    }
    const rmse = normalizedRMSE(pairs);
    componentMisfits['injectionPressure'] = {
      name: 'Injection Pressure',
      value: rmse,
      weight: 1.0,
      nPoints: pairs.length,
    };

    // Validation: check pressure stays below fracture gradient
    const fracGradient = 0.015 * formation.depth; // MPa — simplified
    for (const obs of observations.injectionPressureVsTime) {
      const sim = resultAt(obs.year);
      if (sim.injectionPressure > fracGradient) {
        validationMessages.push(
          `Pressure ${sim.injectionPressure.toFixed(1)} MPa exceeds fracture gradient ${fracGradient.toFixed(1)} MPa at year ${obs.year}`
        );
      }
    }
  }

  // ── 3. Plume radius targets ────────────────────────────────────────────────
  if (observations.plumeRadiusTargets && observations.plumeRadiusTargets.length > 0) {
    const pairs: Array<{ observed: number; simulated: number; weight: number }> = [];
    for (const obs of observations.plumeRadiusTargets) {
      const sim = resultAt(obs.year);
      pairs.push({ observed: obs.value, simulated: sim.plumeRadius, weight: obs.weight ?? 1 });
    }
    const rmse = normalizedRMSE(pairs);
    componentMisfits['plumeRadius'] = {
      name: 'Plume Radius',
      value: rmse,
      weight: 0.8,
      nPoints: pairs.length,
    };
  }

  // ── 4. CO2 density target (year 5) ────────────────────────────────────────
  if (observations.co2DensityTarget !== undefined) {
    const sim5 = resultAt(Math.min(5, maxYear));
    const simDensity = sim5.co2Density;
    const refDensity = observations.co2DensityTarget;
    const pctDev = Math.abs(simDensity - refDensity) / refDensity;

    componentMisfits['co2Density'] = {
      name: 'CO₂ Density',
      value: pctDev,
      weight: 0.5,
      nPoints: 1,
    };

    // Validation: within 20% tolerance
    if (pctDev > 0.20) {
      validationMessages.push(
        `CO₂ density ${simDensity.toFixed(0)} kg/m³ deviates ${(pctDev * 100).toFixed(1)}% from target ${refDensity} kg/m³ (>20%)`
      );
    }
  }

  // ── 5. Dissolution rate constraint ────────────────────────────────────────
  if (observations.dissolutionRateMax !== undefined && simulatedResults.length >= 2) {
    const simLate = simulatedResults[simulatedResults.length - 1];
    const dissolvedFraction = simLate.solubilityTrapping / Math.max(0.001, simLate.storageCapacity);
    const annualRate = dissolvedFraction / simulatedResults.length;
    const maxRate = observations.dissolutionRateMax / 100; // convert %/yr to fraction/yr

    // Penalty if exceeds the cap: proportional to how much it exceeds
    const penalty = Math.max(0, annualRate - maxRate) / maxRate;

    componentMisfits['dissolutionRate'] = {
      name: 'Dissolution Rate',
      value: penalty,
      weight: 0.6,
      nPoints: 1,
    };

    if (annualRate > maxRate) {
      validationMessages.push(
        `Dissolution rate ${(annualRate * 100).toFixed(2)}%/yr exceeds max allowed ${observations.dissolutionRateMax}%/yr`
      );
    }
  }

  // ── Compute total weighted misfit ─────────────────────────────────────────
  let totalMisfit = 0;
  let totalWeight = 0;
  for (const comp of Object.values(componentMisfits)) {
    totalMisfit += comp.value * comp.weight;
    totalWeight += comp.weight;
  }
  if (totalWeight > 0) totalMisfit /= totalWeight;

  // ── Validity check ─────────────────────────────────────────────────────────
  const isValid = validationMessages.length === 0;

  return {
    totalMisfit,
    componentMisfits,
    simulatedResults,
    parameterSet: matchable,
    isValid,
    validationMessages,
  };
}

/**
 * Returns default Sleipner field observations suitable for history matching.
 * Uses Layer 9 area data, pushdown, co2Density, and plume radii from
 * Boait 2012 and Furre 2017.
 */
export function sleipnerObservations(): ObservationData {
  const plumeAreaVsTime = SLEIPNER_LAYER9_AREA.map(d => ({
    year: d.year,
    value: d.areaKm2,
    weight: 1.0,
  }));

  // Injection pressure: field wellhead ~6.3 MPa + hydrostatic head → reservoir ~10–14 MPa
  const injectionPressureVsTime = [
    { year: 4,  value: 11.2, weight: 0.8 },
    { year: 8,  value: 11.8, weight: 0.8 },
    { year: 12, value: 12.3, weight: 0.8 },
  ];

  // Pushdown proxy (ms TWT) — we don't directly model TWT so use low weight
  const pushdownVsTime = SLEIPNER_PUSHDOWN.map(d => ({
    year: d.year,
    value: d.maxPushdownMs,
    weight: 0.3,
  }));

  // Plume radii from Sleipner validation constants
  const plumeRadiusTargets = [
    { year: 4,  value: SLEIPNER_VALIDATION.radiusYear4,  weight: 1.0 },
    { year: 12, value: SLEIPNER_VALIDATION.radiusYear12, weight: 1.0 },
  ];

  return {
    plumeAreaVsTime,
    injectionPressureVsTime,
    pushdownVsTime,
    dissolutionRateMax: SLEIPNER_VALIDATION.dissolutionRateMaxPerYear * 100, // → %/yr
    co2DensityTarget: SLEIPNER_VALIDATION.co2Density,
    plumeRadiusTargets,
  };
}
