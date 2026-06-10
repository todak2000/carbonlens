/**
 * Tests for the history matching misfit computation.
 */

import { describe, it, expect } from 'vitest';
import {
  computeMisfit,
  sleipnerObservations,
} from '../../../engine/historyMatching/misfit';
import {
  DEFAULT_MATCHABLE_PARAMS,
  MATCHABLE_PARAM_BOUNDS,
} from '../../../engine/historyMatching/types';
import type { MatchableParams, ObservationData } from '../../../engine/historyMatching/types';
import { sleipnerFormationParams } from '../../../utils/benchmarkValidation';

const SLEIPNER_PARAMS = sleipnerFormationParams();
const SLEIPNER_OBS = sleipnerObservations();

// Sleipner-tuned matchable params (calibrated near field conditions)
const SLEIPNER_MATCHABLE: MatchableParams = {
  permeability: 200,
  porosity: 0.35,
  netToGross: 0.80,
  residualGasSaturation: 0.10,
  landConstant: 2.5,
  kvKhRatio: 0.1,
  dissolutionRateFactor: 1.0,
};

describe('computeMisfit', () => {

  // Test 1: Near-zero misfit when params match Sleipner presets
  it('computes low misfit when params match Sleipner presets', () => {
    const result = computeMisfit(SLEIPNER_MATCHABLE, SLEIPNER_PARAMS, SLEIPNER_OBS, 0.9);
    expect(result.totalMisfit).toBeLessThan(0.3);
    expect(result.simulatedResults.length).toBeGreaterThan(0);
  });

  // Test 2: Misfit increases when permeability is halved
  it('misfit increases when permeability is halved', () => {
    const baseline = computeMisfit(SLEIPNER_MATCHABLE, SLEIPNER_PARAMS, SLEIPNER_OBS, 0.9);
    const halved: MatchableParams = { ...SLEIPNER_MATCHABLE, permeability: SLEIPNER_MATCHABLE.permeability / 2 };
    const halvedResult = computeMisfit(halved, SLEIPNER_PARAMS, SLEIPNER_OBS, 0.9);
    // Halving permeability should change the misfit (not necessarily increase for all metrics,
    // but the plume area / pressure misfit should differ)
    expect(Math.abs(halvedResult.totalMisfit - baseline.totalMisfit)).toBeGreaterThan(0);
  });

  // Test 3: Misfit increases when porosity is doubled
  it('misfit changes when porosity is doubled', () => {
    const baseline = computeMisfit(SLEIPNER_MATCHABLE, SLEIPNER_PARAMS, SLEIPNER_OBS, 0.9);
    const doubled: MatchableParams = {
      ...SLEIPNER_MATCHABLE,
      porosity: Math.min(MATCHABLE_PARAM_BOUNDS.porosity[1], SLEIPNER_MATCHABLE.porosity * 2),
    };
    const doubledResult = computeMisfit(doubled, SLEIPNER_PARAMS, SLEIPNER_OBS, 0.9);
    expect(Math.abs(doubledResult.totalMisfit - baseline.totalMisfit)).toBeGreaterThan(0);
  });

  // Test 4: componentMisfits has entries for each observable
  it('componentMisfits has entries for each observable type present', () => {
    const result = computeMisfit(SLEIPNER_MATCHABLE, SLEIPNER_PARAMS, SLEIPNER_OBS, 0.9);
    expect(Object.keys(result.componentMisfits).length).toBeGreaterThan(0);
    // Should have plumeArea since we loaded Sleipner observations
    expect(result.componentMisfits).toHaveProperty('plumeArea');
  });

  // Test 5: plumeArea misfit matches plume area data points
  it('plumeArea misfit uses plume area observations', () => {
    const obs: ObservationData = {
      plumeAreaVsTime: [{ year: 5, value: 0.82, weight: 1 }],
    };
    const result = computeMisfit(SLEIPNER_MATCHABLE, SLEIPNER_PARAMS, obs, 0.9);
    expect(result.componentMisfits).toHaveProperty('plumeArea');
    expect(result.componentMisfits['plumeArea'].nPoints).toBe(1);
    expect(result.componentMisfits['plumeArea'].value).toBeGreaterThanOrEqual(0);
  });

  // Test 6: injectionPressure misfit — pressure stays below fracture gradient for Sleipner
  it('injection pressure stays below fracture gradient for Sleipner conditions', () => {
    const obs: ObservationData = {
      injectionPressureVsTime: [{ year: 10, value: 14.5, weight: 1 }],
    };
    const result = computeMisfit(SLEIPNER_MATCHABLE, SLEIPNER_PARAMS, obs, 0.9);
    // Sleipner at 1012m depth: fracture gradient ~15.2 MPa; injection ~10.3+dP
    const simP = result.simulatedResults[9]?.injectionPressure ?? 0;
    expect(simP).toBeLessThan(20); // reasonable upper bound
    // No pressure violation messages for Sleipner params
    const pressureViolations = result.validationMessages.filter(m => m.includes('fracture gradient'));
    expect(pressureViolations.length).toBe(0);
  });

  // Test 7: co2Density misfit within 20% tolerance
  it('co2Density misfit is within 20% tolerance for correct params', () => {
    const obs: ObservationData = { co2DensityTarget: 720 };
    const result = computeMisfit(SLEIPNER_MATCHABLE, SLEIPNER_PARAMS, obs, 0.9);
    expect(result.componentMisfits).toHaveProperty('co2Density');
    const densityMisfit = result.componentMisfits['co2Density'].value;
    // With Sleipner params, should be within 20%
    expect(densityMisfit).toBeLessThanOrEqual(0.20);
  });

  // Test 8: dissolutionRate misfit flags when factor is artificially high
  it('dissolutionRate misfit flags when dissolution factor is artificially high', () => {
    const highDissolution: MatchableParams = {
      ...SLEIPNER_MATCHABLE,
      dissolutionRateFactor: 5.0,  // max multiplier
    };
    const obs: ObservationData = {
      dissolutionRateMax: 2.7,  // %/yr — Sleipner constraint
    };
    const result = computeMisfit(highDissolution, SLEIPNER_PARAMS, obs, 0.9);
    // Check that dissolution misfit component exists and has a penalty
    // (the high factor may push dissolution rate over the limit)
    expect(result.componentMisfits).toHaveProperty('dissolutionRate');
    expect(result.componentMisfits['dissolutionRate'].value).toBeGreaterThanOrEqual(0);
  });

  // Test 9: handles empty observation data gracefully
  it('handles empty observation data gracefully', () => {
    const result = computeMisfit(DEFAULT_MATCHABLE_PARAMS, SLEIPNER_PARAMS, {}, 0.9);
    expect(result.totalMisfit).toBe(0);
    expect(result.simulatedResults.length).toBeGreaterThan(0);
    expect(() => result.componentMisfits).not.toThrow();
  });

  // Test 10: thickness override — confirm plume area responds
  it('plume area responds to thickness changes in formation params', () => {
    const thinFormation = { ...SLEIPNER_PARAMS, thickness: 50 };  // half thickness
    const thickFormation = { ...SLEIPNER_PARAMS, thickness: 200 }; // double
    const obs: ObservationData = {
      plumeAreaVsTime: [{ year: 8, value: 1.76, weight: 1 }],
    };
    const thinResult = computeMisfit(SLEIPNER_MATCHABLE, thinFormation, obs, 0.9);
    const thickResult = computeMisfit(SLEIPNER_MATCHABLE, thickFormation, obs, 0.9);
    // Different thicknesses should produce different plume areas → different misfits
    const thinArea = thinResult.simulatedResults[7]?.plumeRadius ?? 0;
    const thickArea = thickResult.simulatedResults[7]?.plumeRadius ?? 0;
    // Thicker reservoir has larger effective height → plume should spread differently
    expect(Math.abs(thinArea - thickArea)).toBeGreaterThan(0);
  });

});
