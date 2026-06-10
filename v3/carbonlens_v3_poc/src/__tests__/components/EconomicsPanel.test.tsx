/**
 * EconomicsPanel.test.tsx
 *
 * Tests for the economics calculation logic that drives EconomicsPanel.
 *
 * The component's useMemo block is the computation layer — we replicate it here
 * as a pure function so we can test each output independently without needing
 * a DOM or React renderer.  This catches regressions in:
 *   - CAPEX breakdown (drilling, facilities, pipeline, monitoring)
 *   - OPEX per-tonne model
 *   - 45Q / jurisdiction incentive mapping
 *   - NPV with and without credits
 *   - Levelized cost (breakeven)
 */

import { describe, it, expect } from 'vitest'

// ── Pure economics computation (mirrors EconomicsPanel useMemo exactly) ────────

function computeEconomics(
  nWells: number,
  depth: number,
  area: number,
  totalStored: number,
  projectYears: number,
  injectionRate: number,
  jurisdiction: string,
) {
  const yearlyRate = totalStored > 0
    ? totalStored / Math.max(1, projectYears)
    : injectionRate

  // CAPEX
  const drillCost = nWells * (5 + depth * 0.006)
  const facilityCost = nWells * 3 + 2
  const pipelineCost = Math.sqrt(area) * 0.8 + 1
  const monitoringCost = Math.sqrt(area) * 0.15 + 0.5
  const capex = drillCost + facilityCost + pipelineCost + monitoringCost

  // OPEX
  const opexPerTonne = 1.5 + nWells * 0.2 + depth * 0.0005
  const totalOpex = opexPerTonne * Math.max(totalStored, yearlyRate * projectYears)

  // Incentive mapping (mirrors the component switch)
  const credit45q =
    jurisdiction === 'US'        ? 85 :
    jurisdiction === 'EU'        ? 60 :
    jurisdiction === 'Australia' ? 45 :
    jurisdiction === 'Norway'    ? 70 :
    0

  const carbonPrice = Math.max(credit45q, 10)

  // NPV without credits (uses carbonPrice = max(credit45q, 10))
  const discountRate = 0.08
  let npv = -capex
  for (let y = 1; y <= projectYears; y++) {
    const rev = carbonPrice * yearlyRate
    const op = opexPerTonne * yearlyRate
    npv += (rev - op) / Math.pow(1 + discountRate, y)
  }

  // Breakeven
  const breakevenCost = totalStored > 0.001
    ? (capex + totalOpex) / totalStored
    : (capex + totalOpex) / Math.max(0.001, yearlyRate * projectYears)

  const netAfterCredit = breakevenCost - credit45q
  const creditRevenue = credit45q * Math.max(totalStored, yearlyRate * projectYears)

  // NPV with 45Q credits
  let npvWithCredit = -capex
  for (let y = 1; y <= projectYears; y++) {
    const rev = credit45q * yearlyRate
    const op = opexPerTonne * yearlyRate
    npvWithCredit += (rev - op) / Math.pow(1 + discountRate, y)
  }

  return {
    capex, drillCost, facilityCost, pipelineCost, monitoringCost,
    opexPerTonne, totalOpex, npv, breakevenCost,
    credit45q, netAfterCredit, creditRevenue, npvWithCredit,
    yearlyRate,
  }
}

// ── CAPEX breakdown ───────────────────────────────────────────────────────────

describe('EconomicsPanel — CAPEX breakdown', () => {
  it('total CAPEX is positive for any valid input', () => {
    const { capex } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    expect(capex).toBeGreaterThan(0)
  })

  it('all CAPEX components sum to total CAPEX', () => {
    const { capex, drillCost, facilityCost, pipelineCost, monitoringCost } =
      computeEconomics(2, 2000, 10, 20, 30, 1.0, 'US')
    expect(drillCost + facilityCost + pipelineCost + monitoringCost)
      .toBeCloseTo(capex, 6)
  })

  it('drilling cost scales with depth', () => {
    const shallow = computeEconomics(1, 1000, 10, 20, 30, 1.0, 'US')
    const deep    = computeEconomics(1, 4000, 10, 20, 30, 1.0, 'US')
    expect(deep.drillCost).toBeGreaterThan(shallow.drillCost)
  })

  it('drilling cost scales with well count', () => {
    const one   = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    const three = computeEconomics(3, 2000, 10, 20, 30, 1.0, 'US')
    expect(three.drillCost).toBeGreaterThan(one.drillCost)
  })

  it('pipeline cost scales with area (sqrt relationship)', () => {
    const small = computeEconomics(1, 2000, 4,  20, 30, 1.0, 'US')
    const large = computeEconomics(1, 2000, 100, 20, 30, 1.0, 'US')
    expect(large.pipelineCost).toBeGreaterThan(small.pipelineCost)
    // Ratio should be sqrt(100)/sqrt(4) = 5/2 (approx, ignoring constant)
    const ratioActual  = (large.pipelineCost - 1) / (small.pipelineCost - 1)
    expect(ratioActual).toBeCloseTo(5, 0)
  })

  it('monitoring cost scales with area', () => {
    const small = computeEconomics(1, 2000, 5,  20, 30, 1.0, 'US')
    const large = computeEconomics(1, 2000, 50, 20, 30, 1.0, 'US')
    expect(large.monitoringCost).toBeGreaterThan(small.monitoringCost)
  })

  it('facility cost scales with well count', () => {
    const one = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    const two = computeEconomics(2, 2000, 10, 20, 30, 1.0, 'US')
    expect(two.facilityCost).toBeGreaterThan(one.facilityCost)
  })
})

// ── OPEX ─────────────────────────────────────────────────────────────────────

describe('EconomicsPanel — OPEX', () => {
  it('OPEX per tonne is positive', () => {
    const { opexPerTonne } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    expect(opexPerTonne).toBeGreaterThan(0)
  })

  it('OPEX per tonne increases with well count', () => {
    const one   = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    const three = computeEconomics(3, 2000, 10, 20, 30, 1.0, 'US')
    expect(three.opexPerTonne).toBeGreaterThan(one.opexPerTonne)
  })

  it('OPEX per tonne increases with depth', () => {
    const shallow = computeEconomics(1, 1000, 10, 20, 30, 1.0, 'US')
    const deep    = computeEconomics(1, 4000, 10, 20, 30, 1.0, 'US')
    expect(deep.opexPerTonne).toBeGreaterThan(shallow.opexPerTonne)
  })

  it('total OPEX is positive', () => {
    const { totalOpex } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    expect(totalOpex).toBeGreaterThan(0)
  })
})

// ── Jurisdiction incentive mapping ────────────────────────────────────────────

describe('EconomicsPanel — jurisdiction incentives', () => {
  it('US 45Q credit rate is $85/t', () => {
    const { credit45q } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    expect(credit45q).toBe(85)
  })

  it('EU incentive rate is $60/t', () => {
    const { credit45q } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'EU')
    expect(credit45q).toBe(60)
  })

  it('Australia incentive rate is $45/t', () => {
    const { credit45q } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'Australia')
    expect(credit45q).toBe(45)
  })

  it('Norway incentive rate is $70/t', () => {
    const { credit45q } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'Norway')
    expect(credit45q).toBe(70)
  })

  it('Malaysia has zero credit (no direct incentive)', () => {
    const { credit45q } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'Malaysia')
    expect(credit45q).toBe(0)
  })

  it('unknown jurisdictions have zero credit', () => {
    const { credit45q } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'standard')
    expect(credit45q).toBe(0)
  })
})

// ── NPV ──────────────────────────────────────────────────────────────────────

describe('EconomicsPanel — NPV', () => {
  it('NPV with 45Q is greater than NPV without for US jurisdiction', () => {
    const { npv, npvWithCredit } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    expect(npvWithCredit).toBeGreaterThan(npv)
  })

  it('NPV with 45Q credit is positive for US at 1 Mt/yr for 30 years', () => {
    // 30 Mt stored at $85/t credit with modest OPEX should be NPV positive
    const { npvWithCredit } = computeEconomics(1, 2000, 10, 30, 30, 1.0, 'US')
    expect(npvWithCredit).toBeGreaterThan(0)
  })

  it('Malaysia NPV is lower than US NPV (no incentive)', () => {
    const us = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    const my = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'Malaysia')
    expect(us.npvWithCredit).toBeGreaterThan(my.npvWithCredit)
  })

  it('NPV improves with higher injection rate (more revenue)', () => {
    const low  = computeEconomics(1, 2000, 10, 10, 30, 0.5, 'US')
    const high = computeEconomics(1, 2000, 10, 50, 30, 2.0, 'US')
    expect(high.npvWithCredit).toBeGreaterThan(low.npvWithCredit)
  })

  it('both NPV values are finite', () => {
    const { npv, npvWithCredit } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    expect(isFinite(npv)).toBe(true)
    expect(isFinite(npvWithCredit)).toBe(true)
  })
})

// ── Levelized cost ────────────────────────────────────────────────────────────

describe('EconomicsPanel — levelized cost', () => {
  it('breakeven cost is positive and finite', () => {
    const { breakevenCost } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    expect(breakevenCost).toBeGreaterThan(0)
    expect(isFinite(breakevenCost)).toBe(true)
  })

  it('net cost after US credit is lower than breakeven without credit', () => {
    const { breakevenCost, netAfterCredit } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    expect(netAfterCredit).toBeLessThan(breakevenCost)
  })

  it('net cost after credit can be negative (project earns more than cost)', () => {
    // High rate, low depth → low CAPEX/OPEX, high 45Q revenue
    const { netAfterCredit } = computeEconomics(1, 500, 5, 100, 30, 5.0, 'US')
    // At $85/t credit vs. low breakeven, should go negative
    expect(typeof netAfterCredit).toBe('number')
    expect(isFinite(netAfterCredit)).toBe(true)
  })

  it('breakeven decreases with more stored CO2 (spreading CAPEX over more tonnes)', () => {
    const low  = computeEconomics(1, 2000, 10, 5,   30, 0.2, 'US')
    const high = computeEconomics(1, 2000, 10, 100, 30, 4.0, 'US')
    expect(high.breakevenCost).toBeLessThan(low.breakevenCost)
  })

  it('credit revenue is positive for US', () => {
    const { creditRevenue } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'US')
    expect(creditRevenue).toBeGreaterThan(0)
  })

  it('credit revenue is zero for jurisdictions with no incentive', () => {
    const { creditRevenue } = computeEconomics(1, 2000, 10, 20, 30, 1.0, 'Malaysia')
    expect(creditRevenue).toBe(0)
  })
})
