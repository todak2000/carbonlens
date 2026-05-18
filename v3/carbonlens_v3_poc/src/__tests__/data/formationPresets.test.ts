import { describe, it, expect } from 'vitest'
import { FORMATION_PRESETS } from '../../data/formationPresets'

describe('FORMATION_PRESETS', () => {
  it('contains exactly 8 presets', () => {
    expect(FORMATION_PRESETS).toHaveLength(8)
  })

  it('includes Sleipner as first preset with correct location', () => {
    const sleipner = FORMATION_PRESETS[0]
    expect(sleipner.name).toBe('Sleipner Utsira')
    expect(sleipner.location).toContain('Norway')
  })

  it('includes Kasawari (Malaysia) preset', () => {
    const kasawari = FORMATION_PRESETS.find(p => p.name === 'Kasawari')
    expect(kasawari).toBeDefined()
    expect(kasawari?.location).toContain('Malaysia')
  })

  it('includes Duyong (Malaysia) preset with first CCS permit reference', () => {
    const duyong = FORMATION_PRESETS.find(p => p.name === 'Duyong')
    expect(duyong).toBeDefined()
    expect(duyong?.description).toContain('2025')
  })

  it('all presets have valid porosity between 0 and 1', () => {
    for (const preset of FORMATION_PRESETS) {
      expect(preset.params.porosity).toBeGreaterThan(0)
      expect(preset.params.porosity).toBeLessThanOrEqual(1)
    }
  })

  it('all presets have positive permeability', () => {
    for (const preset of FORMATION_PRESETS) {
      expect(preset.params.permeability).toBeGreaterThan(0)
    }
  })

  it('all presets have positive depth', () => {
    for (const preset of FORMATION_PRESETS) {
      expect(preset.params.depth).toBeGreaterThan(0)
    }
  })

  it('all presets have required params fields', () => {
    const requiredFields = [
      'depth', 'thickness', 'porosity', 'permeability',
      'pressure', 'temperature', 'salinity', 'area',
      'geometryType', 'netToGross',
    ]
    for (const preset of FORMATION_PRESETS) {
      for (const field of requiredFields) {
        expect(preset.params).toHaveProperty(field)
      }
    }
  })

  it('Sleipner porosity matches published literature (0.35–0.42)', () => {
    const sleipner = FORMATION_PRESETS[0]
    expect(sleipner.params.porosity).toBeGreaterThanOrEqual(0.35)
    expect(sleipner.params.porosity).toBeLessThanOrEqual(0.42)
  })

  it('all presets have valid salt types', () => {
    const validSaltTypes = ['NaCl', 'CaCl2', 'Mixed']
    for (const preset of FORMATION_PRESETS) {
      expect(validSaltTypes).toContain(preset.params.saltType)
    }
  })

  it('all presets have valid geometry types', () => {
    const validGeometries = ['anticline', 'dome', 'fault', 'layered', 'stratigraphic', 'channel', 'gridfile']
    for (const preset of FORMATION_PRESETS) {
      expect(validGeometries).toContain(preset.params.geometryType)
    }
  })
})
