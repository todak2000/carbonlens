import { describe, it, expect } from 'vitest'
import { assessStorageScreening } from '../../../engine/classical/storageScreening'
import type { FormationParams } from '../../../types'

// Sleipner Utsira formation reference parameters
const SLEIPNER_PARAMS: FormationParams = {
  depth: 1012,
  thickness: 250,
  porosity: 0.37,
  permeability: 2000,
  pressure: 10.5,
  temperature: 37,
  monovalentSalinity: 0.035,
  bivalentSalinity: 0.003,
  saltType: 'NaCl',
  methaneFraction: 0,
  nitrogenFraction: 0,
  area: 26000,
  geometryType: 'layered',
  netToGross: 0.80,
  caprockFriction: 30,
  caprockCohesion: 7.5,
  biotCoefficient: 0.74,
}

describe('assessStorageScreening', () => {
  describe('Sleipner Utsira — reference case', () => {
    it('returns exactly 10 criteria', () => {
      const result = assessStorageScreening(SLEIPNER_PARAMS)
      expect(result.criteria).toHaveLength(10)
    })

    it('all 10 criteria are green for Sleipner', () => {
      const result = assessStorageScreening(SLEIPNER_PARAMS)
      const notGreen = result.criteria.filter((c) => c.status !== 'green')
      expect(notGreen).toHaveLength(0)
    })

    it('canProceed is true', () => {
      expect(assessStorageScreening(SLEIPNER_PARAMS).canProceed).toBe(true)
    })

    it('requiresAcknowledgment is false', () => {
      expect(assessStorageScreening(SLEIPNER_PARAMS).requiresAcknowledgment).toBe(false)
    })

    it('score is 100', () => {
      expect(assessStorageScreening(SLEIPNER_PARAMS).score).toBe(100)
    })
  })

  describe('depth=500m — fails supercritical depth criterion', () => {
    const shallowParams = { ...SLEIPNER_PARAMS, depth: 500 }

    it('criterion "depth" is red', () => {
      const result = assessStorageScreening(shallowParams)
      const depthCrit = result.criteria.find((c) => c.id === 'depth')
      expect(depthCrit?.status).toBe('red')
    })

    it('canProceed is false', () => {
      expect(assessStorageScreening(shallowParams).canProceed).toBe(false)
    })

    it('totalFailed >= 1', () => {
      expect(assessStorageScreening(shallowParams).totalFailed).toBeGreaterThanOrEqual(1)
    })
  })

  describe('depth=900m, porosity=0.12 — two amber criteria', () => {
    const marginalParams = { ...SLEIPNER_PARAMS, depth: 900, porosity: 0.12 }

    it('criterion "depth" is amber', () => {
      const result = assessStorageScreening(marginalParams)
      const depthCrit = result.criteria.find((c) => c.id === 'depth')
      expect(depthCrit?.status).toBe('amber')
    })

    it('criterion "porosity" is amber', () => {
      const result = assessStorageScreening(marginalParams)
      const porosityCrit = result.criteria.find((c) => c.id === 'porosity')
      expect(porosityCrit?.status).toBe('amber')
    })

    it('canProceed is true (no red)', () => {
      expect(assessStorageScreening(marginalParams).canProceed).toBe(true)
    })

    it('requiresAcknowledgment is true', () => {
      expect(assessStorageScreening(marginalParams).requiresAcknowledgment).toBe(true)
    })
  })

  describe('subcritical conditions — temperature below critical point', () => {
    const subcriticalParams = { ...SLEIPNER_PARAMS, temperature: 25, pressure: 5 }

    it('co2Phase criterion is red', () => {
      const result = assessStorageScreening(subcriticalParams)
      const phaseCrit = result.criteria.find((c) => c.id === 'co2Phase')
      expect(phaseCrit?.status).toBe('red')
    })

    it('temperature criterion is red', () => {
      const result = assessStorageScreening(subcriticalParams)
      const tempCrit = result.criteria.find((c) => c.id === 'temperature')
      expect(tempCrit?.status).toBe('red')
    })
  })

  describe('score computation', () => {
    it('all green gives 100', () => {
      expect(assessStorageScreening(SLEIPNER_PARAMS).score).toBe(100)
    })

    it('score is between 0 and 100 for any valid input', () => {
      const worstCase: FormationParams = {
        ...SLEIPNER_PARAMS,
        depth: 100, temperature: 20, pressure: 3, porosity: 0.05,
        permeability: 1, thickness: 5, netToGross: 0.1, area: 0.5,
      }
      const result = assessStorageScreening(worstCase)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })
  })

  describe('criterion IDs are unique and complete', () => {
    it('all 10 criterion IDs are unique', () => {
      const result = assessStorageScreening(SLEIPNER_PARAMS)
      const ids = result.criteria.map((c) => c.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(10)
    })

    it('contains all required criterion IDs', () => {
      const result = assessStorageScreening(SLEIPNER_PARAMS)
      const ids = result.criteria.map((c) => c.id)
      expect(ids).toContain('depth')
      expect(ids).toContain('temperature')
      expect(ids).toContain('pressure')
      expect(ids).toContain('porosity')
      expect(ids).toContain('permeability')
      expect(ids).toContain('thickness')
      expect(ids).toContain('netToGross')
      expect(ids).toContain('area')
      expect(ids).toContain('co2Phase')
      expect(ids).toContain('injectivity')
    })
  })
})
