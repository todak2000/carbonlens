/**
 * ExportPanel.test.tsx
 *
 * Tests for the export/permit logic that powers ExportPanel.
 *
 * We test:
 *   1. PERMIT_TEMPLATES — structure, completeness, jurisdiction coverage
 *   2. renderPermitReport — output format, content, null-safety
 *
 * These are the pure functions underlying ExportPanel's template selector
 * and preview/download actions.  No DOM rendering is required.
 */

import { describe, it, expect } from 'vitest'
import {
  PERMIT_TEMPLATES,
  renderPermitReport,
  DEFAULT_JURISDICTION,
} from '../../utils/permitTemplates'
import type { FormationParams, Well, SimulationResult } from '../../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_PARAMS: FormationParams = {
  depth: 2000,
  thickness: 100,
  porosity: 0.20,
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

const BASE_WELLS: Well[] = [
  {
    id: 'w1', x: 0.0, z: 0.0, injectionRate: 1.0, label: 'Well 1',
    rampUpYears: 5, rampDownYears: 10,
  },
  {
    id: 'w2', x: -0.5, z: 0.5, injectionRate: 0.8, label: 'Well 2',
    rampUpYears: 3, rampDownYears: 5,
  },
]

const MOCK_RESULT: SimulationResult = {
  storageCapacity:    20.00,
  totalCapacity:      85.00,
  capacityP10:        21.00,
  capacityP90:       234.00,
  capacityUtilPct:   23.50,
  overpressureRisk:  false,
  plumeRadius:       800,
  plumeHeight:        45,
  injectionPressure: 23.5,
  pressureField:     [],
  co2Density:        720,
  brineDensity:     1045,
  densityDiff:       325,
  co2Viscosity:      5e-5,
  solubility:          0.5,
  diffusion:           1.5e-9,
  solubilityTrapping:  3.0,
  residualTrapping:    5.0,
  mineralTrapping:     0.0,
  mobilePlume:        12.0,
  containmentProbability: 0.85,
  ift:               28.0,
  adAssessment:      null,
  p10:               21.00,
  p50:               85.00,
  p90:              234.00,
  storageEfficiency: 2.0,
}

// ── PERMIT_TEMPLATES structure ─────────────────────────────────────────────────

describe('PERMIT_TEMPLATES — structure and completeness', () => {
  const REQUIRED_KEYS = ['US', 'EU', 'UK', 'AU', 'MY', 'MY_SAR']

  it('contains all required jurisdiction keys', () => {
    for (const key of REQUIRED_KEYS) {
      expect(PERMIT_TEMPLATES, `Missing template: ${key}`).toHaveProperty(key)
    }
  })

  it('each template has id, name, jurisdiction, regulator, legislation, sections', () => {
    for (const [key, t] of Object.entries(PERMIT_TEMPLATES)) {
      expect(t.id,           `${key}.id`).toBeTruthy()
      expect(t.name,         `${key}.name`).toBeTruthy()
      expect(t.jurisdiction, `${key}.jurisdiction`).toBeTruthy()
      expect(t.regulator,    `${key}.regulator`).toBeTruthy()
      expect(t.legislation,  `${key}.legislation`).toBeTruthy()
      expect(typeof t.sections, `${key}.sections`).toBe('function')
    }
  })

  it('template id matches its key', () => {
    for (const [key, t] of Object.entries(PERMIT_TEMPLATES)) {
      expect(t.id).toBe(key)
    }
  })

  it('default jurisdiction is US', () => {
    expect(DEFAULT_JURISDICTION).toBe('US')
    expect(PERMIT_TEMPLATES).toHaveProperty(DEFAULT_JURISDICTION)
  })

  it('US template references EPA', () => {
    expect(PERMIT_TEMPLATES['US'].regulator).toContain('EPA')
  })

  it('US template legislation references 40 CFR', () => {
    expect(PERMIT_TEMPLATES['US'].legislation).toContain('40 CFR')
  })

  it('EU template legislation references Directive 2009/31/EC', () => {
    expect(PERMIT_TEMPLATES['EU'].legislation).toContain('2009/31/EC')
  })

  it('UK template regulator references NSTA', () => {
    expect(PERMIT_TEMPLATES['UK'].regulator).toContain('NSTA')
  })

  it('AU template regulator references NOPSEMA', () => {
    expect(PERMIT_TEMPLATES['AU'].regulator).toContain('NOPSEMA')
  })

  it('MY template regulator references MyCCUS Agency', () => {
    expect(PERMIT_TEMPLATES['MY'].regulator).toContain('MyCCUS')
  })

  it('MY template legislation references CCUS Act 2025', () => {
    expect(PERMIT_TEMPLATES['MY'].legislation).toContain('CCUS Act 2025')
  })

  it('MY_SAR template references Sarawak in legislation', () => {
    expect(PERMIT_TEMPLATES['MY_SAR'].legislation).toContain('Sarawak')
  })

  it('sections() returns an array of PermitSection objects', () => {
    for (const [key, t] of Object.entries(PERMIT_TEMPLATES)) {
      const sections = t.sections(BASE_PARAMS, BASE_WELLS, null)
      expect(Array.isArray(sections), `${key} sections is array`).toBe(true)
      expect(sections.length, `${key} has at least one section`).toBeGreaterThan(0)
      for (const section of sections) {
        expect(section).toHaveProperty('title')
        expect(section).toHaveProperty('lines')
        expect(Array.isArray(section.lines)).toBe(true)
      }
    }
  })
})

// ── renderPermitReport — output content ──────────────────────────────────────

describe('renderPermitReport — basic output', () => {
  it('returns a non-empty string for US template without result', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, null)
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(200)
  })

  it('includes "CarbonLens" header in every report', () => {
    for (const t of Object.values(PERMIT_TEMPLATES)) {
      const report = renderPermitReport(t, BASE_PARAMS, BASE_WELLS, null)
      expect(report).toContain('CarbonLens')
    }
  })

  it('includes the report date (today) in the output', () => {
    const today = new Date().toISOString().slice(0, 10)
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain(today)
  })

  it('includes disclaimer footer in every report', () => {
    for (const t of Object.values(PERMIT_TEMPLATES)) {
      const report = renderPermitReport(t, BASE_PARAMS, BASE_WELLS, null)
      expect(report).toContain('does not constitute a legal permit')
    }
  })

  it('includes template name and jurisdiction in header', () => {
    const t = PERMIT_TEMPLATES['US']
    const report = renderPermitReport(t, BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain(t.name)
    expect(report).toContain(t.jurisdiction)
  })
})

// ── renderPermitReport — formation data ──────────────────────────────────────

describe('renderPermitReport — formation data in output', () => {
  it('includes formation depth', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain(`${BASE_PARAMS.depth} m`)
  })

  it('includes formation thickness', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain(`${BASE_PARAMS.thickness} m`)
  })

  it('includes formation temperature', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain(`${BASE_PARAMS.temperature}`)
  })

  it('includes well labels for all configured wells', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, null)
    for (const well of BASE_WELLS) {
      expect(report).toContain(well.label)
    }
  })

  it('includes well injection rates', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, null)
    for (const well of BASE_WELLS) {
      expect(report).toContain(`${well.injectionRate} Mt/yr`)
    }
  })
})

// ── renderPermitReport — simulation result section ───────────────────────────

describe('renderPermitReport — simulation result handling', () => {
  it('includes SIMULATION RESULTS section when result is provided', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, MOCK_RESULT)
    expect(report).toContain('SIMULATION RESULTS')
  })

  it('includes stored CO2 value when result is provided', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, MOCK_RESULT)
    expect(report).toContain('20.00 Mt')
  })

  it('includes containment probability when result is provided', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, MOCK_RESULT)
    expect(report).toContain('85 %')   // 0.85 × 100 = 85
  })

  it('omits SIMULATION RESULTS section when result is null', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).not.toContain('SIMULATION RESULTS')
  })

  it('includes trapping breakdown in results section', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, MOCK_RESULT)
    expect(report).toContain('TRAPPING MECHANISMS')
    expect(report).toContain('Residual')
    expect(report).toContain('Dissolved')
  })

  it('shows overpressure risk as "No" when false', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, MOCK_RESULT)
    expect(report).toContain('No')
  })

  it('shows overpressure warning when risk is true', () => {
    const riskResult = { ...MOCK_RESULT, overpressureRisk: true }
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, riskResult)
    expect(report).toContain('YES')
  })
})

// ── renderPermitReport — jurisdiction-specific content ────────────────────────

describe('renderPermitReport — jurisdiction-specific content', () => {
  it('each jurisdiction produces distinct output', () => {
    const reports = Object.values(PERMIT_TEMPLATES).map(t =>
      renderPermitReport(t, BASE_PARAMS, BASE_WELLS, null)
    )
    const unique = new Set(reports)
    expect(unique.size).toBe(reports.length)
  })

  it('MY report includes MyCCUS Agency fee schedule', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['MY'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain('RM 80,000')
    expect(report).toContain('RM 120,000')
  })

  it('MY report distinguishes Assessment Permit from Storage Licence', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['MY'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain('Offshore Assessment Permit')
    expect(report).toContain('Storage Licence')
  })

  it('MY_SAR report references PETROS', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['MY_SAR'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain('PETROS')
  })

  it('UK report references NSTA', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['UK'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain('NSTA')
  })

  it('US report references Class VI UIC', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['US'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain('Class VI')
  })

  it('AU report references OPGGS Act', () => {
    const report = renderPermitReport(PERMIT_TEMPLATES['AU'], BASE_PARAMS, BASE_WELLS, null)
    expect(report).toContain('OPGGS')
  })
})
