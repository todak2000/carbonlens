import { describe, it, expect } from 'vitest'
import { LITHOLOGY_DEFAULTS, LITHOLOGY_ORDER } from '../../../data/lithologyDefaults'
import type { LithologyType } from '../../../types/geological'

describe('LITHOLOGY_DEFAULTS', () => {
  it('defines all 8 lithology types', () => {
    const requiredTypes: LithologyType[] = [
      'sandstone', 'limestone', 'shale', 'siltstone',
      'chalk', 'arkosic_sandstone', 'dolomite', 'anhydrite',
    ]
    for (const t of requiredTypes) {
      expect(LITHOLOGY_DEFAULTS[t], `Missing lithology: ${t}`).toBeDefined()
    }
  })

  it('LITHOLOGY_ORDER contains all 8 types', () => {
    expect(LITHOLOGY_ORDER).toHaveLength(8)
  })

  it('all entries have valid porosity default (0.01 – 0.45)', () => {
    for (const [type, def] of Object.entries(LITHOLOGY_DEFAULTS)) {
      expect(def.porosityDefault, `${type}: porosityDefault`).toBeGreaterThanOrEqual(0.01)
      expect(def.porosityDefault, `${type}: porosityDefault`).toBeLessThanOrEqual(0.45)
    }
  })

  it('all entries have positive horizontal permeability (mD)', () => {
    for (const [type, def] of Object.entries(LITHOLOGY_DEFAULTS)) {
      expect(def.kDefault, `${type}: kDefault`).toBeGreaterThan(0)
    }
  })

  it('shale has permeability < 1 mD (caprock-grade)', () => {
    expect(LITHOLOGY_DEFAULTS['shale'].kDefault).toBeLessThan(1)
  })

  it('sandstone has permeability > 10 mD (reservoir-grade)', () => {
    expect(LITHOLOGY_DEFAULTS['sandstone'].kDefault).toBeGreaterThan(10)
  })

  it('all entries have a capillary entry pressure in (0, 30] MPa', () => {
    for (const [type, def] of Object.entries(LITHOLOGY_DEFAULTS)) {
      expect(def.capillaryEntryPressureDefault, `${type}: capillaryEntryPressureDefault`).toBeGreaterThan(0)
      expect(def.capillaryEntryPressureDefault, `${type}: capillaryEntryPressureDefault`).toBeLessThanOrEqual(30)
    }
  })

  it('anhydrite has the highest capillary entry pressure (perfect seal)', () => {
    const anhydritePC = LITHOLOGY_DEFAULTS['anhydrite'].capillaryEntryPressureDefault
    for (const [type, def] of Object.entries(LITHOLOGY_DEFAULTS)) {
      if (type === 'anhydrite') continue
      expect(
        anhydritePC,
        `anhydrite Pc should be >= ${type} Pc`
      ).toBeGreaterThanOrEqual(def.capillaryEntryPressureDefault)
    }
  })

  it('all entries have a valid CSS color string', () => {
    for (const [type, def] of Object.entries(LITHOLOGY_DEFAULTS)) {
      expect(def.color, `${type}: color`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('mineral trap potential is a valid enum value', () => {
    const valid = ['none', 'low', 'moderate', 'high']
    for (const [type, def] of Object.entries(LITHOLOGY_DEFAULTS)) {
      expect(valid, `${type}: mineralTrapPotential`).toContain(def.mineralTrapPotential)
    }
  })

  it('anhydrite has the lowest mineral trap potential (chemically inert)', () => {
    expect(LITHOLOGY_DEFAULTS['anhydrite'].mineralTrapPotential).toBe('none')
  })
})
