import { describe, it, expect } from 'vitest'
import { FORMATION_PRESETS } from '../../data/formationPresets'

describe('FORMATION_PRESETS', () => {
  // ── Count ───────────────────────────────────────────────────────────────────
  it('contains exactly 16 presets (9 original + 7 new global coverage presets)', () => {
    expect(FORMATION_PRESETS).toHaveLength(16)
  })

  // ── Original presets ────────────────────────────────────────────────────────
  it('includes Johansen (Norwegian North Sea) preset', () => {
    const johansen = FORMATION_PRESETS.find(p => p.name === 'Johansen')
    expect(johansen).toBeDefined()
    expect(johansen?.location).toContain('Norway')
    expect(johansen?.params.depth).toBeGreaterThan(2000)
    expect(johansen?.params.depth).toBeLessThan(3500)
    expect(johansen?.params.porosity).toBeGreaterThanOrEqual(0.20)
    expect(johansen?.params.porosity).toBeLessThanOrEqual(0.30)
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

  // ── New Global South presets ─────────────────────────────────────────────────
  it('includes Malay Basin (Malaysia) preset', () => {
    const p = FORMATION_PRESETS.find(p => p.name === 'Malay Basin')
    expect(p).toBeDefined()
    expect(p?.location).toContain('Malaysia')
    expect(p?.params.depth).toBe(1500)
    expect(p?.params.porosity).toBe(0.25)
    expect(p?.params.permeability).toBe(250)
    expect(p?.params.temperature).toBe(75)
  })

  it('includes Niger Delta (Nigeria) preset', () => {
    const p = FORMATION_PRESETS.find(p => p.name === 'Niger Delta')
    expect(p).toBeDefined()
    expect(p?.location).toContain('Nigeria')
    expect(p?.params.depth).toBe(1800)
    expect(p?.params.porosity).toBe(0.30)
    // High permeability Agbada sandstone
    expect(p?.params.permeability).toBeGreaterThanOrEqual(500)
  })

  it('includes North Sumatra Basin (Indonesia) preset', () => {
    const p = FORMATION_PRESETS.find(p => p.name === 'North Sumatra Basin')
    expect(p).toBeDefined()
    expect(p?.location).toContain('Indonesia')
    expect(p?.params.depth).toBe(1600)
    expect(p?.params.porosity).toBe(0.22)
  })

  it('includes Nile Delta (Egypt) preset with high caprock cohesion (evaporite)', () => {
    const p = FORMATION_PRESETS.find(p => p.name === 'Nile Delta')
    expect(p).toBeDefined()
    expect(p?.location).toContain('Egypt')
    expect(p?.params.depth).toBe(2200)
    // Messinian evaporite caprock — strong seal, higher cohesion than siliciclastic
    expect(p?.params.caprockCohesion).toBeGreaterThan(10)
  })

  // ── New deep-pocket market presets ───────────────────────────────────────────
  it('includes Abu Dhabi Basin (UAE) preset for Al Reyadah project', () => {
    const p = FORMATION_PRESETS.find(p => p.name === 'Abu Dhabi Basin')
    expect(p).toBeDefined()
    expect(p?.location).toContain('UAE')
    expect(p?.params.depth).toBe(2800)
    // High temperature deep reservoir
    expect(p?.params.temperature).toBeGreaterThanOrEqual(100)
    // High salinity brine (deep carbonate)
    expect(p?.params.monovalentSalinity).toBeGreaterThan(1.0)
  })

  it('includes Rotterdam / North Sea (Netherlands) Porthos preset', () => {
    const p = FORMATION_PRESETS.find(p => p.name === 'Rotterdam / North Sea')
    expect(p).toBeDefined()
    expect(p?.location).toContain('Netherlands')
    expect(p?.params.depth).toBe(3100)
    expect(p?.params.temperature).toBeGreaterThanOrEqual(100)
    // Bunter Sandstone — high salinity
    expect(p?.params.monovalentSalinity).toBeGreaterThan(2.0)
  })

  it('includes Alberta Basin (Canada) Quest CCS preset', () => {
    const p = FORMATION_PRESETS.find(p => p.name === 'Alberta Basin')
    expect(p).toBeDefined()
    expect(p?.location).toContain('Canada')
    expect(p?.params.depth).toBe(2200)
    // Basal Cambrian Sandstone — tight, low permeability
    expect(p?.params.permeability).toBeLessThanOrEqual(100)
    // Very high salinity brine
    expect(p?.params.monovalentSalinity).toBeGreaterThan(2.5)
  })

  // ── Universal field invariants ──────────────────────────────────────────────
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
      'pressure', 'temperature', 'area',
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

  it('all presets have non-empty name and location', () => {
    for (const preset of FORMATION_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0)
      expect(preset.location.length).toBeGreaterThan(0)
    }
  })

  it('all presets have a description', () => {
    for (const preset of FORMATION_PRESETS) {
      expect(preset.description.length).toBeGreaterThan(10)
    }
  })

  it('all presets have valid Biot coefficient between 0 and 1', () => {
    for (const preset of FORMATION_PRESETS) {
      expect(preset.params.biotCoefficient).toBeGreaterThan(0)
      expect(preset.params.biotCoefficient).toBeLessThanOrEqual(1)
    }
  })

  it('all presets have positive caprock friction and cohesion', () => {
    for (const preset of FORMATION_PRESETS) {
      expect(preset.params.caprockFriction).toBeGreaterThan(0)
      expect(preset.params.caprockCohesion).toBeGreaterThan(0)
    }
  })

  it('no two presets share the same name', () => {
    const names = FORMATION_PRESETS.map(p => p.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('global coverage spans at least 4 distinct continents', () => {
    const locations = FORMATION_PRESETS.map(p => p.location)
    const hasEurope = locations.some(l => l.includes('Norway') || l.includes('Netherlands') || l.includes('Algeria'))
    const hasAsia = locations.some(l => l.includes('Malaysia') || l.includes('Indonesia') || l.includes('UAE') || l.includes('Egypt'))
    const hasAmericas = locations.some(l => l.includes('USA') || l.includes('Canada') || l.includes('Illinois'))
    const hasAustralia = locations.some(l => l.includes('Australia'))
    expect(hasEurope).toBe(true)
    expect(hasAsia).toBe(true)
    expect(hasAmericas).toBe(true)
    expect(hasAustralia).toBe(true)
  })
})
