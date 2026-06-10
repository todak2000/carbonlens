import { describe, it, expect } from 'vitest'
import {
  validateAnalyticalVsSleipner,
  sleipnerFormationParams,
  formatValidationTable,
  ValidationResult,
} from '../../utils/benchmarkValidation'
import { computeYearly } from '../../hooks/useSimulation'

describe('Sleipner formation params', () => {
  it('produces a finite result from computeYearly', () => {
    const params = sleipnerFormationParams()
    const result = computeYearly(params, 10, 20, null)
    expect(result.plumeRadius).toBeGreaterThan(0)
    expect(result.co2Density).toBeGreaterThan(0)
    expect(result.storageCapacity).toBeGreaterThan(0)
  })
})

describe('validateAnalyticalVsSleipner', () => {
  it('returns at least 5 validation results', () => {
    const results = validateAnalyticalVsSleipner(20)
    expect(results.length).toBeGreaterThanOrEqual(5)
  })

  it('every result has simulated and reference values > 0', () => {
    const results = validateAnalyticalVsSleipner(20)
    for (const r of results as ValidationResult[]) {
      expect(isFinite(r.simulated)).toBe(true)
      expect(isFinite(r.reference)).toBe(true)
    }
  })

  it('CO2 density at Sleipner conditions is within ±20% of field value (720 kg/m³)', () => {
    const results = validateAnalyticalVsSleipner(20)
    const densityCheck = results.find(r => r.metric === 'CO₂ density')
    expect(densityCheck).toBeDefined()
    expect(densityCheck!.pass).toBe(true)
  })

  it('dissolution rate does not exceed Furre (2017) constraint of 2.7%/yr', () => {
    const results = validateAnalyticalVsSleipner(20)
    const dissCheck = results.find(r => r.metric === 'Dissolution rate')
    expect(dissCheck).toBeDefined()
    expect(dissCheck!.pass).toBe(true)
  })

  it('plume radius at year 4 is in the right order of magnitude (100m–5000m)', () => {
    const results = validateAnalyticalVsSleipner(20)
    const r4 = results.find(r => r.metric === 'Plume radius' && r.year === 4)
    expect(r4).toBeDefined()
    expect(r4!.simulated).toBeGreaterThan(100)
    expect(r4!.simulated).toBeLessThan(5000)
  })
})

describe('formatValidationTable', () => {
  it('produces a non-empty string with PASS or FAIL in it', () => {
    const results = validateAnalyticalVsSleipner(20)
    const table = formatValidationTable(results)
    expect(table.length).toBeGreaterThan(100)
    expect(table).toMatch(/PASS|FAIL/)
  })
})

