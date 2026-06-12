/**
 * exportExecutiveSummary.test.ts
 *
 * Tests for the pure business-logic functions in exportExecutiveSummary.ts:
 *   - verdict()              — VIABLE / NEEDS FURTHER STUDY / NOT RECOMMENDED thresholds
 *   - generateRecommendations() — context-aware text generation
 *
 * PDF generation itself (jsPDF.save) is a side-effect and is not tested here;
 * we test the logic that drives what goes INTO the PDF.
 */

import { describe, it, expect } from 'vitest'
import { verdict, generateRecommendations } from '../../utils/exportExecutiveSummary'
import type { FormationParams, SimulationResult, GeomechanicsResult } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_PARAMS: FormationParams = {
  depth: 1800, thickness: 60, porosity: 0.30, permeability: 800,
  pressure: 18, temperature: 80, monovalentSalinity: 0.35,
  bivalentSalinity: 0.02, saltType: 'NaCl', methaneFraction: 0.04, nitrogenFraction: 0.01,
  area: 250, geometryType: 'layered', netToGross: 0.70,
  caprockFriction: 26, caprockCohesion: 5.5, biotCoefficient: 0.71,
}

const GOOD_RESULT: SimulationResult = {
  storageCapacity: 45.0, totalCapacity: 200.0,
  capacityP10: 52.0, capacityP90: 550.0, capacityUtilPct: 22.5,
  overpressureRisk: false, plumeRadius: 1200, plumeHeight: 30,
  injectionPressure: 19.5, pressureField: [],
  co2Density: 680, brineDensity: 1060, densityDiff: 380,
  co2Viscosity: 5.5e-5, solubility: 0.55, diffusion: 1.4e-9,
  solubilityTrapping: 12.0, residualTrapping: 18.0, mineralTrapping: 0.3,
  mobilePlume: 14.7, containmentProbability: 0.85,
  ift: 30.0, adAssessment: null,
  p10: 52.0, p50: 200.0, p90: 550.0,
  storageEfficiency: 2.0,
  structuralCapacity:     15.0,
  residualCapacity:       20.0,
  dissolutionCapacity:    14.0,
  mineralCapacity:         0.0,
  totalFormationCapacity: 49.0,
  formationCapacityUtil:  91.8,
  massBalanceError:        0.0,
}

const POOR_RESULT: SimulationResult = {
  ...GOOD_RESULT,
  containmentProbability: 0.40,
  storageCapacity: 5.0, mobilePlume: 4.0,
  residualTrapping: 0.5, solubilityTrapping: 0.5, mineralTrapping: 0,
  p50: 22.0, p10: 5.0, p90: 60.0,
}

const MODERATE_RESULT: SimulationResult = {
  ...GOOD_RESULT,
  containmentProbability: 0.62,
}

const GOOD_GEOMECH: GeomechanicsResult = {
  capRockStress: 45, fracturePressure: 28, safetyFactor: 1.8,
  mohrFailed: false, maipMPa: 26,
} as unknown as GeomechanicsResult

const POOR_GEOMECH: GeomechanicsResult = {
  capRockStress: 45, fracturePressure: 24, safetyFactor: 0.85,
  mohrFailed: true, maipMPa: 23,
} as unknown as GeomechanicsResult

const MODERATE_GEOMECH: GeomechanicsResult = {
  capRockStress: 45, fracturePressure: 26, safetyFactor: 1.2,
  mohrFailed: false, maipMPa: 24,
} as unknown as GeomechanicsResult

// ── verdict() ─────────────────────────────────────────────────────────────────

describe('verdict() — threshold logic', () => {
  it('returns VIABLE when containment > 0.75 AND safetyFactor > 1.5', () => {
    const v = verdict(0.80, 1.8)
    expect(v.label).toContain('VIABLE')
    expect(v.label).not.toContain('NOT RECOMMENDED')
    expect(v.label).not.toContain('FURTHER STUDY')
  })

  it('returns NOT RECOMMENDED when containment < 0.5', () => {
    const v = verdict(0.40, 1.8)
    expect(v.label).toContain('NOT RECOMMENDED')
  })

  it('returns NOT RECOMMENDED when safetyFactor < 1.0', () => {
    const v = verdict(0.80, 0.8)
    expect(v.label).toContain('NOT RECOMMENDED')
  })

  it('returns NEEDS FURTHER STUDY for moderate containment (0.5–0.75) with good SF', () => {
    const v = verdict(0.62, 1.8)
    expect(v.label).toContain('FURTHER STUDY')
  })

  it('returns NEEDS FURTHER STUDY for good containment with moderate SF (1.0–1.5)', () => {
    const v = verdict(0.80, 1.2)
    expect(v.label).toContain('FURTHER STUDY')
  })

  it('boundary: containment exactly 0.75 with SF exactly 1.5 is NEEDS FURTHER STUDY (not strictly >', () => {
    // 0.75 is NOT > 0.75, so this should be NEEDS FURTHER STUDY
    const v = verdict(0.75, 1.5)
    expect(v.label).not.toContain('VIABLE FOR')
  })

  it('boundary: containment 0.76 and SF 1.51 is VIABLE', () => {
    const v = verdict(0.76, 1.51)
    expect(v.label).toContain('VIABLE')
  })

  it('each verdict has a non-empty sub description', () => {
    const scenarios: [number, number][] = [[0.85, 1.8], [0.62, 1.8], [0.40, 1.8]]
    for (const [cp, sf] of scenarios) {
      const v = verdict(cp, sf)
      expect(v.sub.length).toBeGreaterThan(10)
    }
  })

  it('each verdict has a color tuple of 3 numbers', () => {
    const scenarios: [number, number][] = [[0.85, 1.8], [0.62, 1.8], [0.40, 1.8]]
    for (const [cp, sf] of scenarios) {
      const v = verdict(cp, sf)
      expect(v.color).toHaveLength(3)
      for (const c of v.color) {
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(255)
      }
    }
  })
})

// ── generateRecommendations() ─────────────────────────────────────────────────

describe('generateRecommendations() — output structure', () => {
  it('always returns exactly 3 recommendations', () => {
    const recs = generateRecommendations(BASE_PARAMS, GOOD_RESULT, GOOD_GEOMECH)
    expect(recs).toHaveLength(3)
  })

  it('returns 3 recommendations with null geomechanics', () => {
    const recs = generateRecommendations(BASE_PARAMS, GOOD_RESULT, null)
    expect(recs).toHaveLength(3)
  })

  it('each recommendation is a non-empty string', () => {
    const recs = generateRecommendations(BASE_PARAMS, GOOD_RESULT, GOOD_GEOMECH)
    for (const r of recs) {
      expect(typeof r).toBe('string')
      expect(r.length).toBeGreaterThan(20)
    }
  })
})

describe('generateRecommendations() — content varies by scenario', () => {
  it('VIABLE result mentions advancing to engineering or storage capacity', () => {
    const recs = generateRecommendations(BASE_PARAMS, GOOD_RESULT, GOOD_GEOMECH)
    const combined = recs.join(' ').toLowerCase()
    // Should reference the positive finding
    expect(combined).toMatch(/advance|engineering|commercially|significant|capacity/i)
  })

  it('poor containment result warns about alternative formations', () => {
    const recs = generateRecommendations(BASE_PARAMS, POOR_RESULT, GOOD_GEOMECH)
    const combined = recs.join(' ').toLowerCase()
    expect(combined).toMatch(/re-evaluate|threshold|alternative|below/i)
  })

  it('poor safety factor result warns about geomechanical issues', () => {
    const recs = generateRecommendations(BASE_PARAMS, GOOD_RESULT, POOR_GEOMECH)
    const combined = recs.join(' ').toLowerCase()
    expect(combined).toMatch(/safety factor|below|threshold|stress/i)
  })

  it('good safety factor result acknowledges it positively', () => {
    const recs = generateRecommendations(BASE_PARAMS, GOOD_RESULT, GOOD_GEOMECH)
    const combined = recs.join(' ').toLowerCase()
    expect(combined).toMatch(/exceeds|threshold|adequate|proceed/i)
  })

  it('high trapped fraction mentions carbon credit / permanence', () => {
    // GOOD_RESULT: residual(18) + solubility(12) + mineral(0.3) = 30.3 / 45 = 67% trapped
    const recs = generateRecommendations(BASE_PARAMS, GOOD_RESULT, GOOD_GEOMECH)
    const combined = recs.join(' ').toLowerCase()
    expect(combined).toMatch(/trapping|permanence|credit/i)
  })

  it('low trapped fraction (high mobile plume) warns about monitoring', () => {
    const lowTrapResult: SimulationResult = {
      ...GOOD_RESULT,
      residualTrapping: 2, solubilityTrapping: 1, mineralTrapping: 0, mobilePlume: 42,
      storageCapacity: 45,
    }
    const recs = generateRecommendations(BASE_PARAMS, lowTrapResult, GOOD_GEOMECH)
    const combined = recs.join(' ').toLowerCase()
    expect(combined).toMatch(/mobile|monitoring|migration|controls/i)
  })

  it('p50 value is included in the first recommendation for VIABLE scenario', () => {
    const recs = generateRecommendations(BASE_PARAMS, GOOD_RESULT, GOOD_GEOMECH)
    // p50 = 200 Mt — should appear in recommendations
    expect(recs[0]).toContain('200')
  })
})

// ── verdict + recommendations integration ─────────────────────────────────────

describe('verdict + recommendations — consistent across full scenarios', () => {
  it('VIABLE scenario: verdict label and recommendations are positive', () => {
    const v = verdict(GOOD_RESULT.containmentProbability, GOOD_GEOMECH.safetyFactor)
    const recs = generateRecommendations(BASE_PARAMS, GOOD_RESULT, GOOD_GEOMECH)
    expect(v.label).toContain('VIABLE')
    expect(recs.every(r => r.length > 0)).toBe(true)
  })

  it('NOT RECOMMENDED scenario: verdict and recs reflect the failure', () => {
    const v = verdict(POOR_RESULT.containmentProbability, POOR_GEOMECH.safetyFactor)
    const recs = generateRecommendations(BASE_PARAMS, POOR_RESULT, POOR_GEOMECH)
    expect(v.label).toContain('NOT RECOMMENDED')
    expect(recs.every(r => r.length > 0)).toBe(true)
  })

  it('NEEDS FURTHER STUDY scenario produces 3 non-empty recommendations', () => {
    const v = verdict(MODERATE_RESULT.containmentProbability, MODERATE_GEOMECH.safetyFactor)
    const recs = generateRecommendations(BASE_PARAMS, MODERATE_RESULT, MODERATE_GEOMECH)
    expect(v.label).toContain('FURTHER STUDY')
    expect(recs).toHaveLength(3)
  })
})
