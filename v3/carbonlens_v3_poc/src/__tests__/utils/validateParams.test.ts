import { describe, it, expect } from 'vitest'
import {
  sanitizeFormationParams,
  sanitizeWellPosition,
  sanitizeWellRate,
  sanitizePorosity,
  sanitizeZoneChanges,
  sanitizeFaultChanges,
} from '../../utils/validateParams'
import type { FormationParams } from '../../types'

const BASE: FormationParams = {
  depth: 2000,
  thickness: 100,
  porosity: 0.2,
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

describe('sanitizeFormationParams', () => {
  it('clamps porosity to [0.001, 0.55]', () => {
    expect(sanitizeFormationParams({ ...BASE, porosity: 0 }).porosity).toBe(0.001)
    expect(sanitizeFormationParams({ ...BASE, porosity: 2 }).porosity).toBe(0.55)
  })

  it('clamps permeability to >= 0.001', () => {
    expect(sanitizeFormationParams({ ...BASE, permeability: 0 }).permeability).toBe(0.001)
  })

  it('clamps pressure to [0.6, 100]', () => {
    expect(sanitizeFormationParams({ ...BASE, pressure: 0 }).pressure).toBe(0.6)
    expect(sanitizeFormationParams({ ...BASE, pressure: 200 }).pressure).toBe(100)
  })

  it('clamps temperature to [-50, 200]', () => {
    expect(sanitizeFormationParams({ ...BASE, temperature: -100 }).temperature).toBe(-50)
    expect(sanitizeFormationParams({ ...BASE, temperature: 500 }).temperature).toBe(200)
  })

  it('ensures methaneFraction + nitrogenFraction <= 1', () => {
    const p = sanitizeFormationParams({ ...BASE, methaneFraction: 0.8, nitrogenFraction: 0.8 })
    expect(p.methaneFraction + p.nitrogenFraction).toBeLessThanOrEqual(1)
  })

  it('clamps netToGross to [0, 1]', () => {
    expect(sanitizeFormationParams({ ...BASE, netToGross: -1 }).netToGross).toBe(0)
    expect(sanitizeFormationParams({ ...BASE, netToGross: 5 }).netToGross).toBe(1)
  })

  it('clamps biotCoefficient to [0, 1]', () => {
    expect(sanitizeFormationParams({ ...BASE, biotCoefficient: -1 }).biotCoefficient).toBe(0)
    expect(sanitizeFormationParams({ ...BASE, biotCoefficient: 2 }).biotCoefficient).toBe(1)
  })

  it('preserves enum fields unchanged', () => {
    const p = sanitizeFormationParams({ ...BASE, saltType: 'NaCl', geometryType: 'anticline' })
    expect(p.saltType).toBe('NaCl')
    expect(p.geometryType).toBe('anticline')
  })
})

describe('sanitizeWellPosition', () => {
  it('clamps to [-1, 1]', () => {
    expect(sanitizeWellPosition(-2, 3)).toEqual({ x: -1, z: 1 })
    expect(sanitizeWellPosition(0.5, -0.5)).toEqual({ x: 0.5, z: -0.5 })
  })
})

describe('sanitizeWellRate', () => {
  it('floors at 0.001', () => {
    expect(sanitizeWellRate(0)).toBe(0.001)
    expect(sanitizeWellRate(-5)).toBe(0.001)
  })

  it('passes positive rates through', () => {
    expect(sanitizeWellRate(2.5)).toBe(2.5)
  })
})

describe('sanitizePorosity', () => {
  it('clamps to [0.001, 0.55]', () => {
    expect(sanitizePorosity(0)).toBe(0.001)
    expect(sanitizePorosity(1)).toBe(0.55)
    expect(sanitizePorosity(0.25)).toBe(0.25)
  })
})

describe('sanitizeZoneChanges', () => {
  it('clamps numeric zone fields', () => {
    const result = sanitizeZoneChanges({ netToGross: 5, porosityMean: -1, kHorizontal: 0 })
    expect(result.netToGross).toBe(1)
    expect(result.porosityMean).toBe(0.001)
    expect(result.kHorizontal).toBe(0.001)
  })

  it('passes non-numeric fields unchanged', () => {
    const result = sanitizeZoneChanges({ name: 'test', lithology: 'sandstone' })
    expect(result.name).toBe('test')
    expect(result.lithology).toBe('sandstone')
  })
})

describe('sanitizeFaultChanges', () => {
  it('clamps numeric fault fields', () => {
    const result = sanitizeFaultChanges({ dip: 95, strike: 400, sealingFactor: 2 })
    expect(result.dip).toBe(90)
    expect(result.strike).toBe(360)
    expect(result.sealingFactor).toBe(1)
  })
})
