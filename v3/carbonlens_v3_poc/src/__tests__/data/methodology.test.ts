/**
 * methodology.test.ts
 *
 * Tests for src/data/methodology.ts — the in-app equation registry.
 *
 * We validate:
 *   1. All required physics domains are present
 *   2. Every equation has all required fields populated
 *   3. Key citations are correct (authors and years)
 *   4. Physics domains cover all implemented modules
 *   5. No duplicate domain names
 */

import { describe, it, expect } from 'vitest'
import { METHODOLOGY, MARS_ATTRIBUTION, PROTOTYPE_SCOPE } from '../../data/methodology'
import type { MethodologySection, Equation } from '../../data/methodology'

// ── Structure ─────────────────────────────────────────────────────────────────

describe('METHODOLOGY — structure', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(METHODOLOGY)).toBe(true)
    expect(METHODOLOGY.length).toBeGreaterThan(0)
  })

  it('every section has a non-empty domain string', () => {
    for (const section of METHODOLOGY) {
      expect(typeof section.domain).toBe('string')
      expect(section.domain.length).toBeGreaterThan(0)
    }
  })

  it('every section has at least one equation', () => {
    for (const section of METHODOLOGY) {
      expect(Array.isArray(section.equations)).toBe(true)
      expect(section.equations.length, `${section.domain} has equations`).toBeGreaterThan(0)
    }
  })

  it('no duplicate domain names', () => {
    const names = METHODOLOGY.map(s => s.domain)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })
})

// ── Equation completeness ─────────────────────────────────────────────────────

describe('METHODOLOGY — equation field completeness', () => {
  it('every equation has name, formula, params, reference', () => {
    for (const section of METHODOLOGY) {
      for (const eq of section.equations) {
        expect(eq.name.length, `${section.domain} > name`).toBeGreaterThan(0)
        expect(eq.formula.length, `${section.domain} > formula`).toBeGreaterThan(0)
        expect(eq.params.length, `${section.domain} > params`).toBeGreaterThan(0)
        expect(eq.reference.length, `${section.domain} > reference`).toBeGreaterThan(0)
      }
    }
  })

  it('every reference contains a year (4 consecutive digits) or is marked "in prep"', () => {
    const yearPattern = /\d{4}/
    const inPrepPattern = /in prep/i
    for (const section of METHODOLOGY) {
      for (const eq of section.equations) {
        const hasYear = yearPattern.test(eq.reference)
        const isInPrep = inPrepPattern.test(eq.reference)
        expect(hasYear || isInPrep, `${eq.name} reference has year or is in-prep`).toBe(true)
      }
    }
  })

  it('no field contains placeholder text like "TODO" or "TBD"', () => {
    for (const section of METHODOLOGY) {
      for (const eq of section.equations) {
        for (const field of [eq.name, eq.formula, eq.params, eq.reference]) {
          expect(field).not.toMatch(/TODO|TBD|placeholder/i)
        }
      }
    }
  })
})

// ── Required physics domains ──────────────────────────────────────────────────

describe('METHODOLOGY — required domains', () => {
  const REQUIRED_DOMAINS = [
    'CO₂ Density',
    'Brine Density',
    'CO₂ Viscosity',
    'CO₂ Solubility',
    'Interfacial Tension',
    'Pressure Response',
    'Trapping Mechanisms',
    'Capillary Pressure',
    'Geomechanics',
    'Storage Capacity',
  ]

  it('contains all 10 required physics domains', () => {
    const domains = METHODOLOGY.map(s => s.domain)
    for (const req of REQUIRED_DOMAINS) {
      expect(domains, `Missing domain: ${req}`).toContain(req)
    }
  })
})

// ── Key citations ─────────────────────────────────────────────────────────────

describe('METHODOLOGY — key citations', () => {
  function allEquations(): Equation[] {
    return METHODOLOGY.flatMap(s => s.equations)
  }

  it('Span-Wagner (1996) EOS is cited for CO₂ density', () => {
    const eqs = allEquations()
    const sw = eqs.find(e => e.reference.includes('Span') && e.reference.includes('1996'))
    expect(sw).toBeDefined()
  })

  it('Duan-Sun (2003) is cited for CO₂ solubility', () => {
    const eqs = allEquations()
    const ds = eqs.find(e => e.reference.includes('Duan') && e.reference.includes('2003'))
    expect(ds).toBeDefined()
  })

  it('Theis (1935) is cited for pressure response', () => {
    const eqs = allEquations()
    const theis = eqs.find(e => e.reference.includes('Theis') && e.reference.includes('1935'))
    expect(theis).toBeDefined()
  })

  it('Land (1968) is cited for residual trapping', () => {
    const eqs = allEquations()
    const land = eqs.find(e => e.reference.includes('Land') && e.reference.includes('1968'))
    expect(land).toBeDefined()
  })

  it('Killough (1976) is cited for hysteresis', () => {
    const eqs = allEquations()
    const k = eqs.find(e => e.reference.includes('Killough') && e.reference.includes('1976'))
    expect(k).toBeDefined()
  })

  it('Brooks-Corey or Brooks & Corey (1964) is cited for capillary pressure', () => {
    const eqs = allEquations()
    const bc = eqs.find(e => e.reference.includes('Brooks') && e.reference.includes('1964'))
    expect(bc).toBeDefined()
  })

  it('Hubbert-Willis or Hubbert & Willis (1957) is cited for fracture pressure', () => {
    const eqs = allEquations()
    const hw = eqs.find(e => e.reference.includes('Hubbert') && e.reference.includes('1957'))
    expect(hw).toBeDefined()
  })

  it('Rutqvist or Kozeny-Carman cited for stress-dependent permeability', () => {
    const eqs = allEquations()
    const sd = eqs.find(e => e.reference.includes('Rutqvist') || e.reference.includes('Kozeny'))
    expect(sd).toBeDefined()
  })

  it('Goodman et al. or DOE cited for storage capacity', () => {
    const eqs = allEquations()
    const cap = eqs.find(e => e.reference.includes('Goodman') || e.reference.includes('DOE'))
    expect(cap).toBeDefined()
  })

  it('Riaz or convective mixing cited for dissolution enhancement', () => {
    const eqs = allEquations()
    const cv = eqs.find(e => e.reference.includes('Riaz'))
    expect(cv).toBeDefined()
  })
})

// ── Trapping domain completeness ──────────────────────────────────────────────

describe('METHODOLOGY — trapping mechanisms section', () => {
  const trapping = () => METHODOLOGY.find(s => s.domain === 'Trapping Mechanisms')!

  it('Trapping Mechanisms section exists', () => {
    expect(trapping()).toBeDefined()
  })

  it('covers all 4 CO₂ trapping mechanisms', () => {
    const eqs = trapping().equations.map(e => e.name.toLowerCase())
    const hasResidual = eqs.some(n => n.includes('residual') || n.includes('land'))
    const hasHysteresis = eqs.some(n => n.includes('killough') || n.includes('hysteresis'))
    const hasDissolution = eqs.some(n => n.includes('dissol'))
    const hasMineral = eqs.some(n => n.includes('mineral'))
    expect(hasResidual).toBe(true)
    expect(hasHysteresis).toBe(true)
    expect(hasDissolution).toBe(true)
    expect(hasMineral).toBe(true)
  })
})

// ── Benchmark Validation section ──────────────────────────────────────────────

describe('METHODOLOGY — benchmark validation section', () => {
  it('includes Benchmark Validation domain', () => {
    const section = METHODOLOGY.find(s => s.domain === 'Benchmark Validation')
    expect(section).toBeDefined()
  })

  it('Benchmark Validation has at least 2 equations', () => {
    const section = METHODOLOGY.find(s => s.domain === 'Benchmark Validation')!
    expect(section.equations.length).toBeGreaterThanOrEqual(2)
  })

  it('Sleipner equation references Furre (2017)', () => {
    const section = METHODOLOGY.find(s => s.domain === 'Benchmark Validation')!
    const eq = section.equations.find(e => e.name.toLowerCase().includes('sleipner'))
    expect(eq).toBeDefined()
    expect(eq!.reference).toMatch(/Furre.*2017|2017.*Furre/)
  })

  it('SPE11A equation references Nordbotten', () => {
    const section = METHODOLOGY.find(s => s.domain === 'Benchmark Validation')!
    const eq = section.equations.find(e => e.name.includes('SPE11A'))
    expect(eq).toBeDefined()
    expect(eq!.reference).toContain('Nordbotten')
  })
})

// ── MARS_ATTRIBUTION ──────────────────────────────────────────────────────────

describe('MARS_ATTRIBUTION', () => {
  it('has all required top-level fields', () => {
    const required = [
      'title', 'subtitle', 'author', 'institution', 'status',
      'dataset', 'framework', 'finding', 'models', 'uncertainty', 'scopeNote',
    ] as const
    for (const field of required) {
      expect(MARS_ATTRIBUTION).toHaveProperty(field)
    }
  })

  it('author includes Olagunju', () => {
    expect(MARS_ATTRIBUTION.author).toContain('Olagunju')
  })

  it('institution is CarbonLens R&D', () => {
    expect(MARS_ATTRIBUTION.institution).toMatch(/CarbonLens|Independent/)
  })

  it('dataset references 3265 data points', () => {
    expect(MARS_ATTRIBUTION.dataset).toMatch(/3[,.]?265/)
  })

  it('dataset references multiple laboratories', () => {
    expect(MARS_ATTRIBUTION.dataset).toMatch(/lab/i)
  })

  it('finding demonstrates ANN external failure vs MARS success', () => {
    // ANN external R² should be negative (catastrophic failure)
    expect(MARS_ATTRIBUTION.finding).toMatch(/ANN/)
    expect(MARS_ATTRIBUTION.finding).toMatch(/MARS/)
    // The finding uses a Unicode minus sign (−) before the negative R²
    expect(MARS_ATTRIBUTION.finding).toMatch(/[−-]0\.\d+/)
  })

  it('has exactly 2 regime models', () => {
    expect(MARS_ATTRIBUTION.models).toHaveLength(2)
  })

  it('subcritical model has fewer terms than supercritical', () => {
    const sub = MARS_ATTRIBUTION.models.find(m => m.regime.toLowerCase().includes('subcritical'))
    const sup = MARS_ATTRIBUTION.models.find(m => m.regime.toLowerCase().includes('supercritical'))
    expect(sub).toBeDefined()
    expect(sup).toBeDefined()
    expect(sub!.terms).toBeLessThan(sup!.terms)
  })

  it('each model has numeric terms and intercept', () => {
    for (const m of MARS_ATTRIBUTION.models) {
      expect(typeof m.terms).toBe('number')
      expect(m.terms).toBeGreaterThan(0)
      expect(typeof m.intercept).toBe('number')
    }
  })

  it('framework mentions cross-laboratory or CLEV', () => {
    expect(MARS_ATTRIBUTION.framework).toMatch(/cross.laboratory|CLEV/i)
  })

  it('status signals peer-reviewed correlation', () => {
    expect(MARS_ATTRIBUTION.status).toMatch(/correlation|Olagunju|2026/i)
  })

  it('scopeNote mentions future timeline', () => {
    expect(MARS_ATTRIBUTION.scopeNote).toMatch(/future/i)
  })

  it('uncertainty mentions conformal prediction', () => {
    expect(MARS_ATTRIBUTION.uncertainty).toMatch(/conformal/i)
  })
})

// ── PROTOTYPE_SCOPE ───────────────────────────────────────────────────────────

describe('PROTOTYPE_SCOPE', () => {
  it('has title, mlComponents, classicalComponents, phdNote', () => {
    expect(PROTOTYPE_SCOPE).toHaveProperty('title')
    expect(PROTOTYPE_SCOPE).toHaveProperty('mlComponents')
    expect(PROTOTYPE_SCOPE).toHaveProperty('classicalComponents')
    expect(PROTOTYPE_SCOPE).toHaveProperty('phdNote')
  })

  it('title is a non-empty string', () => {
    expect(typeof PROTOTYPE_SCOPE.title).toBe('string')
    expect(PROTOTYPE_SCOPE.title.length).toBeGreaterThan(5)
  })

  it('mlComponents has at least 1 entry', () => {
    expect(PROTOTYPE_SCOPE.mlComponents.length).toBeGreaterThanOrEqual(1)
  })

  it('IFT is listed in mlComponents', () => {
    const ift = PROTOTYPE_SCOPE.mlComponents.find(c => c.property.includes('IFT'))
    expect(ift).toBeDefined()
  })

  it('all mlComponents have property and model strings', () => {
    for (const c of PROTOTYPE_SCOPE.mlComponents) {
      expect(typeof c.property).toBe('string')
      expect(c.property.length).toBeGreaterThan(0)
      expect(typeof c.model).toBe('string')
      expect(c.model.length).toBeGreaterThan(0)
    }
  })

  it('classicalComponents has at least 5 entries', () => {
    expect(PROTOTYPE_SCOPE.classicalComponents.length).toBeGreaterThanOrEqual(5)
  })

  it('all classicalComponents have property (string), model (string), phd (boolean)', () => {
    for (const c of PROTOTYPE_SCOPE.classicalComponents) {
      expect(typeof c.property).toBe('string')
      expect(typeof c.model).toBe('string')
      expect(typeof c.phd).toBe('boolean')
    }
  })

  it('CO2 density classical component uses Span-Wagner', () => {
    const c = PROTOTYPE_SCOPE.classicalComponents.find(c =>
      c.property.toLowerCase().includes('density') && c.property.toLowerCase().includes('co')
    ) ?? PROTOTYPE_SCOPE.classicalComponents.find(c => c.property.toLowerCase().includes('density'))
    expect(c).toBeDefined()
    expect(c!.model).toMatch(/Span|Wagner/i)
  })

  it('phdNote mentions PhD timeline', () => {
    expect(PROTOTYPE_SCOPE.phdNote).toMatch(/PhD|2027|2028|2029/)
  })

  it('no field in scope contains TODO or TBD', () => {
    const allText = [
      PROTOTYPE_SCOPE.title,
      PROTOTYPE_SCOPE.phdNote,
      ...PROTOTYPE_SCOPE.mlComponents.map(c => c.property + c.model),
      ...PROTOTYPE_SCOPE.classicalComponents.map(c => c.property + c.model),
    ].join(' ')
    expect(allText).not.toMatch(/TODO|TBD/i)
  })
})
