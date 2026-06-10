import { describe, it, expect } from 'vitest'
import {
  krGas,
  krWater,
  co2FractionalFlow,
  DEFAULT_BC_PARAMS,
} from '../../../engine/plume/relativePermeability'

describe('krGas (Brooks-Corey)', () => {
  it('returns 0 at residual CO2 saturation (Sgr)', () => {
    const { Sgr } = DEFAULT_BC_PARAMS
    expect(krGas(Sgr, DEFAULT_BC_PARAMS)).toBeCloseTo(0, 6)
  })

  it('returns 0 below residual saturation', () => {
    expect(krGas(0, DEFAULT_BC_PARAMS)).toBe(0)
    expect(krGas(DEFAULT_BC_PARAMS.Sgr - 0.01, DEFAULT_BC_PARAMS)).toBe(0)
  })

  it('returns krg_max at full CO2 saturation (Sg = 1 − Swi)', () => {
    const { Swi, krg_max } = DEFAULT_BC_PARAMS
    expect(krGas(1 - Swi, DEFAULT_BC_PARAMS)).toBeCloseTo(krg_max, 5)
  })

  it('is monotonically increasing with saturation', () => {
    const saturations = [0.15, 0.20, 0.30, 0.40, 0.50, 0.70]
    const krs = saturations.map((s) => krGas(s, DEFAULT_BC_PARAMS))
    for (let i = 1; i < krs.length; i++) {
      expect(krs[i]).toBeGreaterThanOrEqual(krs[i - 1])
    }
  })

  it('stays within [0, krg_max] for all saturations', () => {
    for (let sg = 0; sg <= 0.8; sg += 0.05) {
      const kr = krGas(sg, DEFAULT_BC_PARAMS)
      expect(kr).toBeGreaterThanOrEqual(0)
      expect(kr).toBeLessThanOrEqual(DEFAULT_BC_PARAMS.krg_max + 1e-9)
    }
  })
})

describe('krWater (Brooks-Corey)', () => {
  it('returns 1 at zero CO2 saturation (pure brine)', () => {
    expect(krWater(0, DEFAULT_BC_PARAMS)).toBeCloseTo(1, 5)
  })

  it('is monotonically decreasing as CO2 saturation increases', () => {
    const saturations = [0, 0.1, 0.2, 0.35, 0.5, 0.7]
    const krs = saturations.map((s) => krWater(s, DEFAULT_BC_PARAMS))
    for (let i = 1; i < krs.length; i++) {
      expect(krs[i]).toBeLessThanOrEqual(krs[i - 1])
    }
  })

  it('returns a value in [0, 1]', () => {
    for (let sg = 0; sg <= 0.75; sg += 0.05) {
      const kr = krWater(sg, DEFAULT_BC_PARAMS)
      expect(kr).toBeGreaterThanOrEqual(0)
      expect(kr).toBeLessThanOrEqual(1 + 1e-9)
    }
  })
})

describe('co2FractionalFlow', () => {
  it('returns a value in [0, 1] across the full saturation range', () => {
    for (let sg = 0; sg <= 0.75; sg += 0.05) {
      const fw = co2FractionalFlow(sg, 5e-5, 1e-3, DEFAULT_BC_PARAMS)
      expect(fw).toBeGreaterThanOrEqual(0)
      expect(fw).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('increases with CO2 saturation', () => {
    const f1 = co2FractionalFlow(0.15, 5e-5, 1e-3, DEFAULT_BC_PARAMS)
    const f2 = co2FractionalFlow(0.45, 5e-5, 1e-3, DEFAULT_BC_PARAMS)
    expect(f2).toBeGreaterThan(f1)
  })
})
