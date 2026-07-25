/**
 * useSimulation.test.ts
 *
 * Unit tests for the two pure functions exported from useSimulation:
 *   - computeYearly  — annual physics roll-up (pressure, trapping, plume)
 *   - validateGeomechanics — caprock/fracture/Mohr-Coulomb/MAIP safety checks
 *
 * These functions are pure enough to test in isolation: the only external
 * dependency is the Zustand store, which we initialise directly.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { computeYearly, validateGeomechanics } from '../../hooks/useSimulation'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import type { FormationParams, Well } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_PARAMS: FormationParams = {
  depth: 2000,
  thickness: 100,
  porosity: 0.20,
  permeability: 500,
  pressure: 20,
  temperature: 60,
  monovalentSalinity: 0.12,
  bivalentSalinity: 0.03,
  saltType: 'Mixed',
  methaneFraction: 0,
  nitrogenFraction: 0,
  area: 10,
  geometryType: 'anticline',
  netToGross: 0.75,
  caprockFriction: 30,
  caprockCohesion: 7.5,
  biotCoefficient: 0.74,
}

const BASE_WELLS: Well[] = [{
  id: 'w1', x: 0, z: 0, injectionRate: 1.0, label: 'Well 1',
  rampUpYears: 5, rampDownYears: 10,
}]

// ── computeYearly ─────────────────────────────────────────────────────────────

describe('computeYearly', () => {
  beforeEach(() => {
    // computeYearly reads wells from the Zustand store internally
    useFormationStore.setState({ wells: BASE_WELLS })
    useSimulationStore.setState({ result: null })
  })

  it('returns finite results for typical reservoir conditions', () => {
    const r = computeYearly(BASE_PARAMS, 5, 30)
    expect(isFinite(r.storageCapacity)).toBe(true)
    expect(isFinite(r.co2Density)).toBe(true)
    expect(isFinite(r.injectionPressure)).toBe(true)
    expect(isFinite(r.plumeRadius)).toBe(true)
    expect(isFinite(r.totalCapacity)).toBe(true)
  })

  it('returns zero (or near-zero) storage at year 0', () => {
    const r = computeYearly(BASE_PARAMS, 0, 30, null)
    expect(r.storageCapacity).toBeCloseTo(0, 5)
  })

  it('storage capacity grows with injection year', () => {
    const r5 = computeYearly(BASE_PARAMS, 5, 30, null)
    const r10 = computeYearly(BASE_PARAMS, 10, 30, null)
    expect(r10.storageCapacity).toBeGreaterThan(r5.storageCapacity)
  })

  it('injection pressure is at or above initial reservoir pressure', () => {
    const r = computeYearly(BASE_PARAMS, 5, 30, null)
    expect(r.injectionPressure).toBeGreaterThanOrEqual(BASE_PARAMS.pressure)
  })

  it('injection pressure does not exceed initial + 25 MPa cap', () => {
    const r = computeYearly(BASE_PARAMS, 5, 30, null)
    expect(r.injectionPressure).toBeLessThanOrEqual(BASE_PARAMS.pressure + 25 + 0.001)
  })

  it('p90 < p50 < p10 capacity ordering is always maintained', () => {
    const r = computeYearly(BASE_PARAMS, 10, 30, null)
    expect(r.p90).toBeLessThan(r.p50)
    expect(r.p50).toBeLessThan(r.p10)
  })

  it('CO2 density is physically plausible at supercritical conditions', () => {
    // Supercritical CO2 at 2000 m depth: 600–900 kg/m³
    const r = computeYearly(BASE_PARAMS, 5, 30, null)
    expect(r.co2Density).toBeGreaterThan(300)
    expect(r.co2Density).toBeLessThan(1000)
  })

  it('brine density is in a physical range', () => {
    const r = computeYearly(BASE_PARAMS, 5, 30, null)
    expect(r.brineDensity).toBeGreaterThan(900)
    expect(r.brineDensity).toBeLessThan(1300)
  })

  it('density difference is positive (brine denser than CO2)', () => {
    const r = computeYearly(BASE_PARAMS, 5, 30, null)
    expect(r.densityDiff).toBeGreaterThan(0)
  })

  it('plume radius grows over time', () => {
    const r5 = computeYearly(BASE_PARAMS, 5, 30, null)
    const r15 = computeYearly(BASE_PARAMS, 15, 30, null)
    expect(r15.plumeRadius).toBeGreaterThan(r5.plumeRadius)
  })

  it('containment probability is in [0, 1]', () => {
    const r = computeYearly(BASE_PARAMS, 10, 30, null)
    expect(r.containmentProbability).toBeGreaterThanOrEqual(0)
    expect(r.containmentProbability).toBeLessThanOrEqual(1)
  })

  it('trapping components are non-negative after ramp-up', () => {
    const r = computeYearly(BASE_PARAMS, 15, 30, null)
    expect(r.residualTrapping).toBeGreaterThanOrEqual(0)
    expect(r.solubilityTrapping).toBeGreaterThanOrEqual(0)
    expect(r.mobilePlume).toBeGreaterThanOrEqual(0)
  })

  it('trapping increases monotonically: residual + solubility grows over time', () => {
    const r10 = computeYearly(BASE_PARAMS, 10, 30, null)
    const r20 = computeYearly(BASE_PARAMS, 20, 30, null)
    const trapped10 = r10.residualTrapping + r10.solubilityTrapping
    const trapped20 = r20.residualTrapping + r20.solubilityTrapping
    expect(trapped20).toBeGreaterThan(trapped10)
  })

  it('mass balance: residual + solubility + mobile + ε === storageCapacity at each year', () => {
    // Each mechanism is computed from independent saturation physics.
    // massBalanceError (ε) captures CO₂ outside the swept zone (tight/low-sweep formations).
    // The full accounting: residual + dissolved + mobile + ε = totalCum.
    // For well-swept formations ε ≈ 0; for tight formations ε may be substantial.
    let prev: ReturnType<typeof computeYearly> | null = null
    for (let yr = 1; yr <= 30; yr++) {
      const r = computeYearly(BASE_PARAMS, yr, 30, prev)
      const componentSum = r.residualTrapping + r.solubilityTrapping + r.mineralTrapping + r.mobilePlume + r.massBalanceError
      expect(componentSum).toBeCloseTo(r.storageCapacity, 6)
      prev = r
    }
  })

  it('massBalanceError is non-negative at each year', () => {
    let prev: ReturnType<typeof computeYearly> | null = null
    for (let yr = 1; yr <= 30; yr++) {
      const r = computeYearly(BASE_PARAMS, yr, 30, prev)
      expect(r.massBalanceError).toBeGreaterThanOrEqual(0)
      prev = r
    }
  })

  it('pressureField is an array', () => {
    const r = computeYearly(BASE_PARAMS, 5, 30, null)
    expect(Array.isArray(r.pressureField)).toBe(true)
  })

  it('solubility is positive at reservoir conditions', () => {
    const r = computeYearly(BASE_PARAMS, 5, 30, null)
    expect(r.solubility).toBeGreaterThan(0)
  })

  it('adAssessment is returned (green/yellow/red)', () => {
    const r = computeYearly(BASE_PARAMS, 5, 30, null)
    if (r.adAssessment !== null) {
      expect(['green', 'yellow', 'red']).toContain(r.adAssessment.status)
    }
  })

  it('multiple wells sum injection correctly — more wells means more CO2 stored', () => {
    const twoWells: Well[] = [
      { id: 'w1', x: -0.5, z: 0, injectionRate: 1.0, label: 'Well 1', rampUpYears: 5, rampDownYears: 10 },
      { id: 'w2', x:  0.5, z: 0, injectionRate: 1.0, label: 'Well 2', rampUpYears: 5, rampDownYears: 10 },
    ]
    useFormationStore.setState({ wells: twoWells })
    const rTwo = computeYearly(BASE_PARAMS, 10, 30, null)

    useFormationStore.setState({ wells: BASE_WELLS })
    const rOne = computeYearly(BASE_PARAMS, 10, 30, null)

    expect(rTwo.storageCapacity).toBeGreaterThan(rOne.storageCapacity)
  })
})

// ── validateGeomechanics ──────────────────────────────────────────────────────

describe('validateGeomechanics', () => {
  it('returns valid=true for safe default parameters', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    expect(result.valid).toBe(true)
  })

  it('estimated injection pressure exceeds initial reservoir pressure', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    expect(result.estimatedPInj).toBeGreaterThan(BASE_PARAMS.pressure)
  })

  it('estimated injection pressure is capped at pressure + 25 MPa', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    expect(result.estimatedPInj).toBeLessThanOrEqual(BASE_PARAMS.pressure + 25 + 0.001)
  })

  it('returns valid=false when injection rate is extreme (200 Mt/yr, no ramp)', () => {
    // rampUpYears: 0 → full 200 Mt/yr applied in year-1 Theis estimate → dP > fracture pressure
    const dangerousWells = [{ ...BASE_WELLS[0], injectionRate: 200, rampUpYears: 0 }]
    const result = validateGeomechanics(BASE_PARAMS, dangerousWells)
    expect(result.valid).toBe(false)
  })

  it('safety factor passes for nominal conditions (sf >= 1.2)', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    expect(result.checks.safetyFactor.ok).toBe(true)
    expect(result.checks.safetyFactor.value).toBeGreaterThan(1.2)
  })

  it('caprock check passes for nominal conditions', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    expect(result.checks.caprock.ok).toBe(true)
  })

  it('result contains all four check keys', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    expect(result.checks).toHaveProperty('caprock')
    expect(result.checks).toHaveProperty('safetyFactor')
    expect(result.checks).toHaveProperty('mohr')
    expect(result.checks).toHaveProperty('maip')
  })

  it('each check has ok, value, threshold, message, fix properties', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    for (const check of Object.values(result.checks)) {
      expect(check).toHaveProperty('ok')
      expect(check).toHaveProperty('value')
      expect(check).toHaveProperty('threshold')
      expect(check).toHaveProperty('message')
      expect(check).toHaveProperty('fix')
      expect(typeof check.ok).toBe('boolean')
      expect(typeof check.value).toBe('number')
      expect(typeof check.threshold).toBe('number')
      expect(isFinite(check.value)).toBe(true)
    }
  })

  it('fix string is non-empty only when check fails', () => {
    // Use high injection rate to trigger some failures
    const highRateWells = [{ ...BASE_WELLS[0], injectionRate: 100 }]
    const result = validateGeomechanics(BASE_PARAMS, highRateWells)
    for (const check of Object.values(result.checks)) {
      if (!check.ok) {
        expect(check.fix.length).toBeGreaterThan(0)
      }
    }
  })

  it('Mohr-Coulomb check is stable (returns boolean)', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    expect(typeof result.checks.mohr.ok).toBe('boolean')
    expect(isFinite(result.checks.mohr.value)).toBe(true)
  })

  it('MAIP margin is finite', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    expect(isFinite(result.checks.maip.value)).toBe(true)
  })

  it('valid = AND of all four checks', () => {
    const result = validateGeomechanics(BASE_PARAMS, BASE_WELLS)
    const allOk =
      result.checks.caprock.ok &&
      result.checks.safetyFactor.ok &&
      result.checks.mohr.ok &&
      result.checks.maip.ok
    expect(result.valid).toBe(allOk)
  })

  it('empty wells array returns a finite estimatedPInj', () => {
    const result = validateGeomechanics(BASE_PARAMS, [])
    expect(isFinite(result.estimatedPInj)).toBe(true)
    // No injection → no pressure buildup → estP equals initial pressure
    expect(result.estimatedPInj).toBeCloseTo(BASE_PARAMS.pressure, 1)
  })
})
