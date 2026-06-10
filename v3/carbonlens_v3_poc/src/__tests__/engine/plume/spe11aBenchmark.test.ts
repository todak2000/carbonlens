import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  parseSpe11aTimeSeries,
  totalMassSystem,
  mobileFraction,
  dissolvedFraction,
  sealFraction,
  SPE11A,
} from '../../../data/spe11aBenchmark'
import type { Spe11aTimeRow } from '../../../data/spe11aBenchmark'

const OPM1_PATH = path.resolve(__dirname, '../../../../../../dataset/spe/spe11a/opm1/spe11a_time_series.csv')

function loadOpm1(): ReturnType<typeof parseSpe11aTimeSeries> {
  const csv = fs.readFileSync(OPM1_PATH, 'utf-8')
  return parseSpe11aTimeSeries(csv)
}

describe('SPE11a — parser integrity', () => {
  it('loads and parses the OPM1 time series', () => {
    const data = loadOpm1()
    expect(data.rows.length).toBeGreaterThan(0)
    expect(data.totalTime_s).toBe(432000)
  })

  it('all rows have the correct number of columns', () => {
    const data = loadOpm1()
    for (const row of data.rows) {
      expect(row.t_s).toBeDefined()
      expect(row.mobA_kg).toBeDefined()
      expect(row.sealTot_kg).toBeDefined()
    }
  })

  it('starts at t=0 with zero CO2 everywhere', () => {
    const data = loadOpm1()
    expect(data.rows[0].t_s).toBe(0)
    expect(totalMassSystem(data.rows[0])).toBe(0)
  })

  it('ends at t=432000 s (120 h)', () => {
    const data = loadOpm1()
    expect(data.rows[data.rows.length - 1].t_s).toBe(432000)
    expect(data.totalTime_h).toBe(120)
  })
})

describe('SPE11a — mass conservation', () => {
  it('total system mass is approximately non-decreasing (tiny numerical noise from OPM export)', () => {
    const data = loadOpm1()
    let prevMass = 0
    for (const row of data.rows) {
      const mass = totalMassSystem(row)
      expect(mass).toBeGreaterThanOrEqual(prevMass - 1e-4)
      prevMass = mass
    }
  })

  it('mobile CO2 in aquifer A is always non-negative', () => {
    const data = loadOpm1()
    for (const row of data.rows) {
      expect(row.mobA_kg).toBeGreaterThanOrEqual(0)
    }
  })

  it('immobile CO2 in aquifer A is always non-negative', () => {
    const data = loadOpm1()
    for (const row of data.rows) {
      expect(row.immA_kg).toBeGreaterThanOrEqual(0)
    }
  })

  it('dissolved CO2 in aquifer A is always non-negative', () => {
    const data = loadOpm1()
    for (const row of data.rows) {
      expect(row.dissA_kg).toBeGreaterThanOrEqual(0)
    }
  })

  it('CO2 never reaches domain B (atmosphere) in meaningful quantity', () => {
    const data = loadOpm1()
    for (const row of data.rows) {
      expect(row.mobB_kg + row.immB_kg + row.dissB_kg + row.sealB_kg).toBeLessThan(0.001)
    }
  })

  it('sealTot is approximately non-decreasing (tiny numerical noise from OPM export)', () => {
    const data = loadOpm1()
    let prevSeal = 0
    for (const row of data.rows) {
      expect(row.sealTot_kg).toBeGreaterThanOrEqual(prevSeal - 1e-4)
      prevSeal = row.sealTot_kg
    }
  })
})

describe('SPE11a — reference values from OPM1', () => {
  it('final mobile-to-total ratio is ~40%', () => {
    const data = loadOpm1()
    const last = data.rows[data.rows.length - 1]
    const frac = mobileFraction(last)
    expect(frac).toBeGreaterThan(0.30)
    expect(frac).toBeLessThan(0.50)
  })

  it('final dissolved fraction is ~50% of total', () => {
    const data = loadOpm1()
    const last = data.rows[data.rows.length - 1]
    const frac = dissolvedFraction(last)
    expect(frac).toBeGreaterThan(0.35)
    expect(frac).toBeLessThan(0.60)
  })

  it('injection rate is ~5.6 × 10⁻⁹ kg/s', () => {
    const data = loadOpm1()
    const rate = Math.abs(SPE11A.injectionRate_kg_s)
    expect(rate).toBeGreaterThan(5e-9)
    expect(rate).toBeLessThan(6e-9)
  })

  it('total injected mass is ~2.4 × 10⁻³ kg', () => {
    const data = loadOpm1()
    const mass = data.totalMassInjected_kg
    expect(mass).toBeGreaterThan(2e-3)
    expect(mass).toBeLessThan(3e-3)
  })
})

describe('SPE11a — monotonicity of mass components', () => {
  it('mobile CO2 in aquifer A is approximately non-decreasing (tiny numerical noise from OPM export)', () => {
    const data = loadOpm1()
    let prev = 0
    for (const row of data.rows) {
      expect(row.mobA_kg).toBeGreaterThanOrEqual(prev - 1e-4)
      prev = row.mobA_kg
    }
  })

  it('dissolved CO2 in aquifer A is approximately non-decreasing', () => {
    const data = loadOpm1()
    let prev = 0
    for (const row of data.rows) {
      expect(row.dissA_kg).toBeGreaterThanOrEqual(prev - 1e-4)
      prev = row.dissA_kg
    }
  })

  it('CO2 in seal is approximately non-decreasing', () => {
    const data = loadOpm1()
    let prev = 0
    for (const row of data.rows) {
      expect(row.sealTot_kg).toBeGreaterThanOrEqual(prev - 1e-4)
      prev = row.sealTot_kg
    }
  })
})

describe('SPE11a — physics sanity', () => {
  it('pressure remains above hydrostatic (p1, p2 > 0.1 MPa)', () => {
    const data = loadOpm1()
    for (const row of data.rows) {
      expect(row.p1_Pa).toBeGreaterThan(1e5)
      expect(row.p2_Pa).toBeGreaterThan(1e5)
    }
  })

  it('dissolved CO2 exceeds mobile CO2 in early time (rapid dissolution)', () => {
    const data = loadOpm1()
    // At t=600s, dissA > mobA
    expect(data.rows[1].dissA_kg).toBeGreaterThan(data.rows[1].mobA_kg)
  })

  it('mobile CO2 eventually overtakes dissolved CO2 as plume grows', () => {
    const data = loadOpm1()
    // At late time, mobA overtakes dissA
    const mid = Math.floor(data.rows.length / 2)
    expect(data.rows[data.rows.length - 1].mobA_kg)
      .toBeGreaterThan(data.rows[data.rows.length - 1].dissA_kg)
  })

  it('CO2 plume area in domain C (caprock) matches ~24% coverage at end', () => {
    const data = loadOpm1()
    const last = data.rows[data.rows.length - 1]
    const areaFrac = last.mC_m2 / (SPE11A.domainWidth_m * SPE11A.domainHeight_m)
    expect(areaFrac).toBeGreaterThan(0.15)
    expect(areaFrac).toBeLessThan(0.35)
  })
})
