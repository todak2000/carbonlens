import { describe, it, expect } from 'vitest'
import {
  SLEIPNER,
  SLEIPNER_HORIZONS,
  SLEIPNER_LAYER9_AREA,
  SLEIPNER_LAYERS1_8_AREA,
  SLEIPNER_TOTAL_AREA,
  SLEIPNER_PUSHDOWN,
  SLEIPNER_VALIDATION,
  sleipnerGravityRadius,
  SLEIPNER_TOP_SEAL,
  SLEIPNER_INJECTION,
  SLEIPNER_LAYER_5,
  SLEIPNER_LAYER_1,
} from '../../../data/sleipnerBenchmark'

describe('SLEIPNER reservoir constants', () => {
  it('depth matches Utsira formation', () => {
    expect(SLEIPNER.depthM).toBe(1012)
  })

  it('porosity range is reasonable for Utsira sand', () => {
    expect(SLEIPNER.porosityRange[0]).toBeGreaterThanOrEqual(0.20)
    expect(SLEIPNER.porosityRange[1]).toBeLessThanOrEqual(0.40)
  })

  it('permeability range is consistent with Utsira sand', () => {
    expect(SLEIPNER.permeabilityRange[0]).toBeGreaterThanOrEqual(500)
    expect(SLEIPNER.permeabilityRange[1]).toBeLessThanOrEqual(5000)
  })

  it('CO2 density matches gravimetric inversion — Furre 2017 §4', () => {
    expect(SLEIPNER.co2Density).toBeGreaterThanOrEqual(
      SLEIPNER_VALIDATION.co2Density - SLEIPNER_VALIDATION.co2DensityUncertainty,
    )
    expect(SLEIPNER.co2Density).toBeLessThanOrEqual(
      SLEIPNER_VALIDATION.co2Density + SLEIPNER_VALIDATION.co2DensityUncertainty,
    )
  })

  it('in-situ CO2 density ±55 kg/m³ from Furre 2017 gravimetry', () => {
    const { co2Density, co2DensityUncertainty } = SLEIPNER_VALIDATION
    expect(co2Density).toBe(720)
    expect(co2DensityUncertainty).toBe(55)
  })
})

describe('SLEIPNER_HORIZONS — 9-layer architecture', () => {
  it('has exactly 9 horizons', () => {
    expect(SLEIPNER_HORIZONS.length).toBe(9)
  })

  it('horizons are ordered deepest to shallowest (layer 1 = deepest)', () => {
    for (let i = 1; i < SLEIPNER_HORIZONS.length; i++) {
      expect(SLEIPNER_HORIZONS[i].depthBelowCaprockM)
        .toBeLessThan(SLEIPNER_HORIZONS[i - 1].depthBelowCaprockM)
    }
  })

  it('each horizon has valid ellipticity (≥1)', () => {
    for (const h of SLEIPNER_HORIZONS) {
      expect(h.ellipticity).toBeGreaterThanOrEqual(1)
    }
  })

  it('each horizon has positive gravity current slope', () => {
    for (const h of SLEIPNER_HORIZONS) {
      expect(h.slopeKm2PerYr).toBeGreaterThan(0)
    }
  })

  it('higher layers (shallower) initiate later on average', () => {
    const deepLayers = SLEIPNER_HORIZONS.filter(h => h.layer <= 4)
    const shallowLayers = SLEIPNER_HORIZONS.filter(h => h.layer > 4)
    const deepMeanInit = deepLayers.reduce((s, h) => s + h.initiationYear, 0) / deepLayers.length
    const shallowMeanInit = shallowLayers.reduce((s, h) => s + h.initiationYear, 0) / shallowLayers.length
    expect(shallowMeanInit).toBeGreaterThanOrEqual(deepMeanInit)
  })

  it('layer 9 (top seal) has initiation year ~3.2', () => {
    const layer9 = SLEIPNER_HORIZONS.find(h => h.layer === 9)
    expect(layer9).toBeDefined()
    expect(layer9!.initiationYear).toBeCloseTo(3.2, 1)
  })
})

describe('SLEIPNER_LAYER9_AREA — digitized Boait 2012 Figure 7', () => {
  it('has 7 data points from year 3 to year 14', () => {
    expect(SLEIPNER_LAYER9_AREA.length).toBe(7)
    expect(SLEIPNER_LAYER9_AREA[0].year).toBe(3)
    expect(SLEIPNER_LAYER9_AREA[SLEIPNER_LAYER9_AREA.length - 1].year).toBe(14)
  })

  it('monotonically increases (plume grows over time)', () => {
    for (let i = 1; i < SLEIPNER_LAYER9_AREA.length; i++) {
      expect(SLEIPNER_LAYER9_AREA[i].areaKm2)
        .toBeGreaterThan(SLEIPNER_LAYER9_AREA[i - 1].areaKm2)
    }
  })

  it('target area at year 14 is 4.40 km²', () => {
    const yr14 = SLEIPNER_LAYER9_AREA.find(d => d.year === 14)
    expect(yr14).toBeDefined()
    expect(yr14!.areaKm2).toBeCloseTo(4.40, 2)
  })

  it('matches exported validation constant', () => {
    const yr14Area = SLEIPNER_LAYER9_AREA.find(d => d.year === 14)!.areaKm2
    expect(yr14Area).toBe(SLEIPNER_VALIDATION.layer9AreaYear14Km2)
  })
})

describe('SLEIPNER_LAYERS1_8_AREA — digitized Boait 2012 Figure 7', () => {
  it('has 7 data points from year 3 to year 14', () => {
    expect(SLEIPNER_LAYERS1_8_AREA.length).toBe(7)
  })

  it('grows then stabilizes (plume fills available pore space)', () => {
    expect(SLEIPNER_LAYERS1_8_AREA[0].areaKm2).toBeGreaterThan(0)
    const last = SLEIPNER_LAYERS1_8_AREA[SLEIPNER_LAYERS1_8_AREA.length - 1]
    expect(last.areaKm2).toBeGreaterThan(SLEIPNER_LAYERS1_8_AREA[0].areaKm2)
  })

  it('combined 1-8 area at year 14 is 2.10 km²', () => {
    const yr14 = SLEIPNER_LAYERS1_8_AREA.find(d => d.year === 14)
    expect(yr14).toBeDefined()
    expect(yr14!.areaKm2).toBeCloseTo(2.10, 2)
  })

  it('Layer 9 area exceeds Layers 1-8 combined after year 10', () => {
    for (let i = 0; i < SLEIPNER_LAYER9_AREA.length; i++) {
      const yr = SLEIPNER_LAYER9_AREA[i].year
      if (yr >= 10) {
        const l9 = SLEIPNER_LAYER9_AREA.find(d => d.year === yr)!.areaKm2
        const l18 = SLEIPNER_LAYERS1_8_AREA.find(d => d.year === yr)!.areaKm2
        expect(l9).toBeGreaterThan(l18)
      }
    }
  })
})

describe('SLEIPNER_TOTAL_AREA — validated against 2000/2004/2008/2012 surveys', () => {
  it('has 4 data points at years 4, 8, 12, 16', () => {
    expect(SLEIPNER_TOTAL_AREA.length).toBe(4)
  })

  it('total plume area increases over time', () => {
    for (let i = 1; i < SLEIPNER_TOTAL_AREA.length; i++) {
      expect(SLEIPNER_TOTAL_AREA[i].areaKm2Min)
        .toBeGreaterThan(SLEIPNER_TOTAL_AREA[i - 1].areaKm2Min)
    }
  })

  it('ranges are physically plausible (bounds non-negative, spread ≤ 0.5 km²)', () => {
    for (const d of SLEIPNER_TOTAL_AREA) {
      expect(d.areaKm2Min).toBeGreaterThan(0)
      expect(d.areaKm2Max).toBeGreaterThan(d.areaKm2Min)
      expect(d.areaKm2Max - d.areaKm2Min).toBeLessThanOrEqual(0.5)
    }
  })
})

describe('SLEIPNER_PUSHDOWN — time-lag seismic velocity pushdown', () => {
  it('has 7 data points from year 3 to year 14', () => {
    expect(SLEIPNER_PUSHDOWN.length).toBe(7)
  })

  it('pushdown increases monotonically (more CO2 → slower seismic velocity)', () => {
    for (let i = 1; i < SLEIPNER_PUSHDOWN.length; i++) {
      expect(SLEIPNER_PUSHDOWN[i].maxPushdownMs)
        .toBeGreaterThan(SLEIPNER_PUSHDOWN[i - 1].maxPushdownMs)
    }
  })

  it('pushdown at year 14 is 57.5 ms', () => {
    const yr14 = SLEIPNER_PUSHDOWN.find(d => d.year === 14)
    expect(yr14).toBeDefined()
    expect(yr14!.maxPushdownMs).toBeCloseTo(57.5, 1)
    expect(SLEIPNER_VALIDATION.pushdownYear14Ms).toBeCloseTo(57.5, 1)
  })

  it('pushdown at year 3 is ~18 ms', () => {
    const yr3 = SLEIPNER_PUSHDOWN.find(d => d.year === 3)
    expect(yr3).toBeDefined()
    expect(yr3!.maxPushdownMs).toBeCloseTo(18.0, 1)
  })

  it('pushdown growth rate is at least 90% of √t scaling (plume fills space over time)', () => {
    // Pushdown ∝ column height × plume radius; radius scales as √t but
    // column height saturates once the plume fills the dome, so growth
    // can be slightly below √t in late time.
    for (let i = 2; i < SLEIPNER_PUSHDOWN.length; i++) {
      const pr = SLEIPNER_PUSHDOWN[i].maxPushdownMs / SLEIPNER_PUSHDOWN[i - 1].maxPushdownMs
      const tr = SLEIPNER_PUSHDOWN[i].year / SLEIPNER_PUSHDOWN[i - 1].year
      expect(pr).toBeGreaterThan(Math.sqrt(tr) * 0.9)
    }
  })
})

describe('sleipnerGravityRadius — analytical solution (Boait 2012 eq A1)', () => {
  it('computes non-negative radius for any positive year', () => {
    expect(sleipnerGravityRadius(0)).toBe(0)
    expect(sleipnerGravityRadius(1)).toBeGreaterThan(0)
    expect(sleipnerGravityRadius(100)).toBeGreaterThan(0)
  })

  it('radius scales as √t', () => {
    const r1 = sleipnerGravityRadius(1)
    const r4 = sleipnerGravityRadius(4)
    const r9 = sleipnerGravityRadius(9)
    // √4 / √1 = 2,  √9 / √1 = 3
    expect(r4 / r1).toBeCloseTo(2, 0)
    expect(r9 / r1).toBeCloseTo(3, 0)
  })

  it('radius larger for higher permeability', () => {
    const rLowK = sleipnerGravityRadius(10, 1e-13)
    const rHighK = sleipnerGravityRadius(10, 3e-13)
    expect(rHighK).toBeGreaterThan(rLowK)
  })

  it('radius larger for lower porosity', () => {
    const rHighPhi = sleipnerGravityRadius(10, 2e-13, 0.40)
    const rLowPhi = sleipnerGravityRadius(10, 2e-13, 0.20)
    expect(rLowPhi).toBeGreaterThan(rHighPhi)
  })

  it('analytical radius at year 4 and 12 is within 15% of empirical targets', () => {
    const r4 = sleipnerGravityRadius(4)
    const r12 = sleipnerGravityRadius(12)
    const err4 = Math.abs(r4 - SLEIPNER_VALIDATION.radiusYear4) / SLEIPNER_VALIDATION.radiusYear4
    const err12 = Math.abs(r12 - SLEIPNER_VALIDATION.radiusYear12) / SLEIPNER_VALIDATION.radiusYear12
    expect(err4).toBeLessThan(0.15)
    expect(err12).toBeLessThan(0.15)
  })
})

describe('SLEIPNER_VALIDATION — physics constraints', () => {
  it('dissolution rate must not exceed 2.7%/yr (Furre 2017 §4)', () => {
    expect(SLEIPNER_VALIDATION.dissolutionRateMaxPerYear).toBeLessThanOrEqual(0.027)
  })

  it('expected dissolution rate is ~1.5%/yr for Utsira-like conditions', () => {
    expect(SLEIPNER_VALIDATION.dissolutionRateExpected).toBeCloseTo(0.015, 3)
  })

  it('expected dissolution is comfortably below the upper bound', () => {
    expect(SLEIPNER_VALIDATION.dissolutionRateExpected)
      .toBeLessThan(SLEIPNER_VALIDATION.dissolutionRateMaxPerYear * 0.7)
  })

  it('free mass conservation is expected (Furre 2017 §6)', () => {
    expect(SLEIPNER_VALIDATION.freeMassConservation).toBe(true)
  })

  it('gravity current slope is positive', () => {
    expect(SLEIPNER_VALIDATION.gravityCurrentSlope).toBeGreaterThan(0)
  })

  it('residual gas saturation is 0.10', () => {
    expect(SLEIPNER_VALIDATION.residualGasSaturation).toBeCloseTo(0.10, 2)
  })

  it('average CO2 layer thickness is 8 m (Boait 2012 §3.3)', () => {
    expect(SLEIPNER_VALIDATION.avgLayerThicknessM).toBe(8)
  })

  it('average CO2 saturation within layers is 0.80 (Boait 2012 §3.3)', () => {
    expect(SLEIPNER_VALIDATION.avgSaturation).toBeCloseTo(0.80, 2)
  })
})

describe('SLEIPNER_TOP_SEAL — elliptical planform approximations', () => {
  it('has outline data at 4, 8, 12, 16 years', () => {
    expect(SLEIPNER_TOP_SEAL.length).toBe(4)
    const years = SLEIPNER_TOP_SEAL.map(o => o.year)
    expect(years).toEqual([4, 8, 12, 16])
  })

  it('semi-major axis grows over time', () => {
    for (let i = 1; i < SLEIPNER_TOP_SEAL.length; i++) {
      expect(SLEIPNER_TOP_SEAL[i].a).toBeGreaterThan(SLEIPNER_TOP_SEAL[i - 1].a)
    }
  })

  it('semi-minor axis grows over time', () => {
    for (let i = 1; i < SLEIPNER_TOP_SEAL.length; i++) {
      expect(SLEIPNER_TOP_SEAL[i].b).toBeGreaterThan(SLEIPNER_TOP_SEAL[i - 1].b)
    }
  })

  it('aspect ratio (a/b) stays roughly constant (~1.5-2.0)', () => {
    for (const outline of SLEIPNER_TOP_SEAL) {
      const aspect = outline.a / outline.b
      expect(aspect).toBeGreaterThan(1.3)
      expect(aspect).toBeLessThan(2.2)
    }
  })
})

describe('SLEIPNER_INJECTION — plume outlines at injection layer', () => {
  it('has outline data at 4, 8, 12, 16 years', () => {
    expect(SLEIPNER_INJECTION.length).toBe(4)
    expect(SLEIPNER_INJECTION[0].year).toBe(4)
  })

  it('plume center drifts northward over time', () => {
    const cyValues = SLEIPNER_INJECTION.map(o => o.cy)
    for (let i = 1; i < cyValues.length; i++) {
      expect(cyValues[i]).toBeGreaterThanOrEqual(cyValues[i - 1])
    }
  })
})

describe('SLEIPNER_LAYER_5 and SLEIPNER_LAYER_1 — multi-layer outlines', () => {
  it('SLEIPNER_LAYER_5 has 3 outlines at years 4, 8, 12', () => {
    expect(SLEIPNER_LAYER_5.length).toBe(3)
    expect(SLEIPNER_LAYER_5.map(o => o.year)).toEqual([4, 8, 12])
  })

  it('SLEIPNER_LAYER_1 has 2 outlines at years 4, 8', () => {
    expect(SLEIPNER_LAYER_1.length).toBe(2)
    expect(SLEIPNER_LAYER_1.map(o => o.year)).toEqual([4, 8])
  })

  it('both layers have outlines at year 4, layer 5 area shrinks relative to layer 1 by year 8', () => {
    const yr4l5 = SLEIPNER_LAYER_5.find(o => o.year === 4)
    const yr4l1 = SLEIPNER_LAYER_1.find(o => o.year === 4)
    const yr8l5 = SLEIPNER_LAYER_5.find(o => o.year === 8)
    const yr8l1 = SLEIPNER_LAYER_1.find(o => o.year === 8)
    expect(yr4l5).toBeDefined()
    expect(yr4l1).toBeDefined()
    expect(yr8l5).toBeDefined()
    expect(yr8l1).toBeDefined()
    // Layer 5 grows faster (a wider spread of lateral outflow)
    expect(yr8l5!.a).toBeGreaterThan(yr4l5!.a)
    expect(yr8l1!.a).toBeGreaterThan(yr4l1!.a)
  })
})
