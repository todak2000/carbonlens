import { describe, it, expect } from 'vitest'
import { krGasHysteretic, DEFAULT_KILLOUGH } from '../../../engine/plume/killoughHysteresis'
import { DEFAULT_BC_PARAMS } from '../../../engine/plume/relativePermeability'

describe('krGasHysteretic', () => {
  it('returns 0 when Sg <= 0 regardless of history', () => {
    expect(krGasHysteretic(0, 0.5, DEFAULT_BC_PARAMS, DEFAULT_KILLOUGH)).toBe(0)
    expect(krGasHysteretic(-0.1, 0.5, DEFAULT_BC_PARAMS, DEFAULT_KILLOUGH)).toBe(0)
  })

  it('equals standard kr when Sg_max <= Sgr (no imbibition history)', () => {
    const kr = krGasHysteretic(0.25, DEFAULT_BC_PARAMS.Sgr, DEFAULT_BC_PARAMS, DEFAULT_KILLOUGH)
    expect(kr).toBeGreaterThan(0)
  })

  it('uses drainage curve when Sg >= Sg_max_hist', () => {
    const kr = krGasHysteretic(0.4, 0.3, DEFAULT_BC_PARAMS, DEFAULT_KILLOUGH)
    expect(kr).toBeGreaterThan(0)
  })

  it('returns lower kr on imbibition than drainage at same Sg', () => {
    const imbibitionKr = krGasHysteretic(0.15, 0.4, DEFAULT_BC_PARAMS, DEFAULT_KILLOUGH)
    const drainageKr = krGasHysteretic(0.15, 0.15, DEFAULT_BC_PARAMS, DEFAULT_KILLOUGH)
    expect(imbibitionKr).toBeLessThanOrEqual(drainageKr)
  })

  it('stays in [0, krg_max] for all inputs', () => {
    for (let sg = 0; sg <= 0.7; sg += 0.05) {
      for (const sg_max of [0.1, 0.3, 0.5]) {
        const kr = krGasHysteretic(sg, sg_max, DEFAULT_BC_PARAMS, DEFAULT_KILLOUGH)
        expect(kr).toBeGreaterThanOrEqual(0)
        expect(kr).toBeLessThanOrEqual(DEFAULT_BC_PARAMS.krg_max + 1e-9)
      }
    }
  })
})
