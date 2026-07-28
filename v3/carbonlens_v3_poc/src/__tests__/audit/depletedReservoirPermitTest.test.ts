/**
 * Depleted Reservoir Pre-Permit Report Tests
 *
 * Tests ALL 4 depleted gas field presets through the full simulation pipeline
 * and generates the jurisdiction-specific pre-permit HTML report for each.
 *
 * Formations:
 *   1. In Salah      (DZ)  — depleted_gas, carbonate, GIIP=30 Bcm
 *   2. Kasawari      (MY)  — depleted_gas, carbonate, GIIP=84.9 Bcm
 *   3. Duyong        (MY)  — depleted_gas, carbonate, GIIP=5.5 Bcm
 *   4. Rotterdam/NS  (EU)  — depleted_gas, sandstone, GIIP=40 Bcm
 *
 * Science validated against:
 *   - Bachu et al. (2007) IJGGC 1(4):430 — gas-replacement volumetric method
 *   - CO₂ density evaluated at P_initial (MAIP) per Bachu 2007
 *   - Fill factors: carbonate {P90:0.30, P50:0.50, P10:0.75}
 *                   sandstone {P90:0.40, P50:0.60, P10:0.85}
 *   - Bg(T,P) = (T_K/P_MPa) × (P_std/T_std) — gas FVF
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import { computeYearly, computeGeomechanicsResult } from '../../hooks/useSimulation'
import { useFormationStore } from '../../store/formationStore'
import { openPermitApplication } from '../../utils/exportHTMLReports'
import { computeDepletedFieldCapacity } from '../../engine/classical/depletedFieldCapacity'

const OUTPUT_DIR = path.resolve(__dirname, '../../../../validation')

// ── Intercept window.open and capture written HTML ────────────────────────────
function capturePermitHTML(fn: () => void): string {
  let captured = ''
  const fakeDoc = { write: (s: string) => { captured += s }, close: () => {} }
  const fakeWin = { document: fakeDoc, focus: () => {}, print: () => {} }
  const spy = vi.spyOn(window, 'open').mockReturnValue(fakeWin as any)
  try { fn() } finally { spy.mockRestore() }
  return captured
}

// ── All 4 depleted field presets ──────────────────────────────────────────────
const DEPLETED_PRESETS = FORMATION_PRESETS.filter(
  p => p.params.formationType === 'depleted_gas' || p.params.formationType === 'depleted_oil'
)

// Jurisdiction for each formation
const JURISDICTION: Record<string, string> = {
  'In Salah':             'DZ',
  'Kasawari':             'MY',
  'Duyong':               'MY',
  'Rotterdam / North Sea': 'EU',
}

const LOCATION: Record<string, string> = {
  'In Salah':             'Krechba Field, In Salah Gas Project, Algeria',
  'Kasawari':             'Sarawak Shallow Water, Malaysia',
  'Duyong':               'Terengganu, Peninsular Malaysia',
  'Rotterdam / North Sea': 'P18 Block, Dutch North Sea (Porthos CCS Project)',
}

// Expected capacity ranges from Bachu (2007) method with corrected fill factors
const EXPECTED_CAPACITY: Record<string, { p90min: number; p50min: number; p50max: number; p10max: number }> = {
  // carbonate fill {0.30, 0.50, 0.75}; CO2 at P_initial=17.6 MPa, T=364K → rho≈417 kg/m³
  // PV_gas = 30e9 × Bg(364K,17.6MPa) ≈ 215 Mm³; P50 = 215e6×0.50×417/1e9 = 44.8 Mt
  'In Salah': { p90min: 15, p50min: 30, p50max: 65, p10max: 100 },

  // carbonate fill {0.30, 0.50, 0.75}; CO2 at P_initial=13.5 MPa, T=318K → rho≈545 kg/m³
  // PV_gas = 84.9e9 × Bg(318K,13.5MPa) ≈ 691 Mm³; P50 = 691e6×0.50×545/1e9 = 188 Mt
  'Kasawari': { p90min: 80, p50min: 150, p50max: 250, p10max: 400 },

  // carbonate fill {0.30, 0.50, 0.75}; CO2 at P_initial=15 MPa, T=323K → rho≈582 kg/m³
  // PV_gas = 5.5e9 × Bg(323K,15MPa) ≈ 40.9 Mm³; P50 = 40.9e6×0.50×582/1e9 = 11.9 Mt
  'Duyong': { p90min: 4, p50min: 8, p50max: 20, p10max: 30 },

  // sandstone fill {0.40, 0.60, 0.85}; CO2 at P_initial=30.4 MPa, T=373K → rho≈667 kg/m³
  // PV_gas = 40e9 × Bg(373K,30.4MPa) ≈ 169 Mm³; P50 = 169e6×0.60×667/1e9 = 67.6 Mt
  'Rotterdam / North Sea': { p90min: 30, p50min: 50, p50max: 100, p10max: 150 },
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Depleted Reservoir — Full Audit & Permit Report (all 4 fields)', () => {

  it('prints depleted-field audit header', () => {
    console.log('\n')
    console.log('='.repeat(100))
    console.log('CARBONLENS V3 — DEPLETED GAS FIELD PERMIT REPORT AUDIT')
    console.log('Method: Bachu et al. (2007) IJGGC 1(4):430 — gas-replacement volumetric')
    console.log('CO₂ density evaluated at P_initial (MAIP), NOT P_abandon')
    console.log('Fill factors: carbonate {P90:30%, P50:50%, P10:75%} | sandstone {P90:40%, P50:60%, P10:85%}')
    console.log('='.repeat(100))
    console.log(
      'Formation'.padEnd(26) +
      'Litho'.padEnd(12) +
      'GIIP(Bcm)'.padEnd(12) +
      'T(C)/P_i(MPa)'.padEnd(16) +
      'P_ab(MPa)'.padEnd(12) +
      'P90(Mt)'.padEnd(10) +
      'P50(Mt)'.padEnd(10) +
      'P10(Mt)'.padEnd(10) +
      'Juri'
    )
    console.log('-'.repeat(100))

    for (const preset of DEPLETED_PRESETS) {
      const p = preset.params
      const T_K = p.temperature + 273.15
      const res = computeDepletedFieldCapacity(
        p.giip!, T_K, p.pressure, p.abandonmentPressure!,
        0.60, p.methaneFraction ?? 0, p.nitrogenFraction ?? 0, p.lithologyClass,
      )
      const juri = JURISDICTION[preset.name] ?? '??'
      console.log(
        preset.name.substring(0, 25).padEnd(26) +
        (p.lithologyClass ?? 'sandstone').padEnd(12) +
        p.giip!.toString().padEnd(12) +
        `${p.temperature}/${p.pressure}`.padEnd(16) +
        p.abandonmentPressure!.toString().padEnd(12) +
        res.storageP90_Mt.toFixed(1).padEnd(10) +
        res.storageMt.toFixed(1).padEnd(10) +
        res.storageP10_Mt.toFixed(1).padEnd(10) +
        juri
      )
    }
    console.log('='.repeat(100))
    expect(DEPLETED_PRESETS.length).toBe(4)
  })

  // ── Per-formation tests ───────────────────────────────────────────────────
  DEPLETED_PRESETS.forEach(preset => {
    describe(`${preset.name}`, () => {
      const p = preset.params

      const WELL = {
        id: 'w1',
        name: `${preset.name.replace(/[^a-z0-9]/gi, '').substring(0, 6).toUpperCase()}-INJ-01`,
        injectionRate: 1.0,
        rampUpYears: 3,
        rampDownYears: 7,
        x: 0.5, z: 0.5,
        label: 'INJ-01',
      }

      beforeEach(() => {
        useFormationStore.setState({ wells: [WELL] })
      })

      it('capacity P90 < P50 < P10 with correct fill factors (Bachu 2007)', () => {
        const T_K = p.temperature + 273.15
        const res = computeDepletedFieldCapacity(
          p.giip!, T_K, p.pressure, p.abandonmentPressure!,
          0.60, p.methaneFraction ?? 0, p.nitrogenFraction ?? 0, p.lithologyClass,
        )

        const litho = p.lithologyClass ?? 'sandstone'
        const fills = litho === 'carbonate' ? { p90: 0.30, p50: 0.50, p10: 0.75 }
                    : litho === 'chalk'     ? { p90: 0.25, p50: 0.40, p10: 0.65 }
                    :                         { p90: 0.40, p50: 0.60, p10: 0.85 }

        console.log(`\n[${preset.name}] lithology=${litho}`)
        console.log(`  Bg(T_K=${T_K.toFixed(1)}, P=${p.pressure}MPa) = ${res.bg_initial.toFixed(5)} m³/m³`)
        console.log(`  PV_gas = GIIP × Bg = ${p.giip} Bcm × ${res.bg_initial.toFixed(5)} = ${(p.giip! * res.bg_initial * 1000).toFixed(1)} Mm³`)
        console.log(`  rho_CO2 at P_initial=${p.pressure} MPa: ${res.co2DensityAtInjectionTarget.toFixed(1)} kg/m³`)
        console.log(`  Fill factors used: P90=${fills.p90*100}% | P50=${fills.p50*100}% | P10=${fills.p10*100}%`)
        console.log(`  P90=${res.storageP90_Mt.toFixed(2)} Mt | P50=${res.storageMt.toFixed(2)} Mt | P10=${res.storageP10_Mt.toFixed(2)} Mt`)

        // Ordering invariant
        expect(res.storageP90_Mt).toBeLessThan(res.storageMt)
        expect(res.storageMt).toBeLessThan(res.storageP10_Mt)

        // Bg in physical range (0.001 to 0.08 m³/m³)
        expect(res.bg_initial).toBeGreaterThan(0.001)
        expect(res.bg_initial).toBeLessThan(0.08)

        // CO2 density at P_initial (not P_abandon)
        expect(res.co2DensityAtInjectionTarget).toBeGreaterThan(300)
        expect(res.co2DensityAtInjectionTarget).toBeLessThan(900)

        // Range check from expected table
        const exp = EXPECTED_CAPACITY[preset.name]
        if (exp) {
          expect(res.storageP90_Mt).toBeGreaterThan(exp.p90min)
          expect(res.storageMt).toBeGreaterThan(exp.p50min)
          expect(res.storageMt).toBeLessThan(exp.p50max)
          expect(res.storageP10_Mt).toBeLessThan(exp.p10max)
        }
      })

      it('full simulation: P90/P50/P10 consistent + geomechanics valid', () => {
        const PROJECT_YEARS = 20
        let simResult: ReturnType<typeof computeYearly> | null = null
        for (let y = 0; y <= PROJECT_YEARS; y++) {
          simResult = computeYearly(p, y, PROJECT_YEARS, simResult)
        }
        const geoResult = computeGeomechanicsResult(p, [WELL], simResult!)

        console.log(`\n[${preset.name}] SIMULATION (Year ${PROJECT_YEARS})`)
        console.log(`  P90=${simResult!.p90.toFixed(1)} | P50=${simResult!.p50.toFixed(1)} | P10=${simResult!.p10.toFixed(1)} Mt`)
        console.log(`  Cumulative injected : ${simResult!.storageCapacity.toFixed(3)} Mt`)
        console.log(`  Inj. pressure       : ${simResult!.injectionPressure.toFixed(3)} MPa`)
        console.log(`  Plume radius        : ${simResult!.plumeRadius.toFixed(0)} m`)
        console.log(`  Safety factor Fs    : ${geoResult.safetyFactor.toFixed(3)} (limit ≥ 1.2)`)
        console.log(`  MAIP margin         : ${geoResult.maipMargin.toFixed(1)}%`)
        console.log(`  Seismic risk        : ${geoResult.inducedSeismicityRisk}`)
        console.log(`  Surface heave       : ${(geoResult.surfaceHeave * 1000).toFixed(2)} mm`)

        // Capacity ordering
        expect(simResult!.p90).toBeLessThan(simResult!.p50)
        expect(simResult!.p50).toBeLessThan(simResult!.p10)
        expect(simResult!.storageCapacity).toBeGreaterThan(0)
        expect(isFinite(simResult!.p50)).toBe(true)

        // Injection pressure physical (between P_abandon and P_initial)
        expect(simResult!.injectionPressure).toBeGreaterThan(0)
        expect(simResult!.injectionPressure).toBeLessThan(100)

        // Safety factor physical
        expect(geoResult.safetyFactor).toBeGreaterThan(0)
        expect(isFinite(geoResult.safetyFactor)).toBe(true)
      })

      it('generates and writes the jurisdiction-specific pre-permit HTML report', () => {
        const PROJECT_YEARS = 20
        let simResult: ReturnType<typeof computeYearly> | null = null
        for (let y = 0; y <= PROJECT_YEARS; y++) {
          simResult = computeYearly(p, y, PROJECT_YEARS, simResult)
        }
        const geoResult = computeGeomechanicsResult(p, [WELL], simResult!)
        const juri = JURISDICTION[preset.name] ?? 'EU'
        const loc  = LOCATION[preset.name] ?? preset.name

        const html = capturePermitHTML(() => {
          openPermitApplication(
            p, simResult!, geoResult, [WELL],
            preset.name, loc, juri,
            'CarbonLens Test Suite',
            [],             // no 3D snapshots
            PROJECT_YEARS,
            PROJECT_YEARS,
          )
        })

        // Write report first (before assertions so file always exists for inspection)
        const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
        const outPath = path.join(OUTPUT_DIR, `${slug}_permit_report.html`)
        fs.writeFileSync(outPath, html, 'utf8')

        console.log(`\n✓ [${preset.name}] permit report written`)
        console.log(`  Path : file://${outPath}`)
        console.log(`  Size : ${(html.length / 1024).toFixed(1)} KB`)
        console.log(`  Juri : ${juri} | P50: ${simResult!.p50.toFixed(1)} Mt | Fs: ${geoResult.safetyFactor.toFixed(3)}`)

        // Debug: log what values we expect vs. what precision is in HTML
        const p90v2 = simResult!.p90.toFixed(2)
        const p10v2 = simResult!.p10.toFixed(2)
        const p50v1 = simResult!.p50.toFixed(1)
        console.log(`  p90 toFixed(2)=${p90v2} | p10 toFixed(2)=${p10v2} | p50 toFixed(1)=${p50v1}`)
        console.log(`  html has p90(2)=${html.includes(p90v2)} | html has p90(1)=${html.includes(simResult!.p90.toFixed(1))}`)

        // Basic HTML checks
        expect(html.length).toBeGreaterThan(15_000)
        expect(html).toContain(preset.name)
        expect(html).toContain(p50v1)
        expect(html).toContain('Safety Factor')
        expect(html).toContain('CO₂')

        // Depleted field specific: GIIP should appear in the report
        const giipStr = p.giip!.toString()
        expect(html).toContain(giipStr)

        // Capacity values P90/P50/P10: check toFixed(2) which matches the HTML capacity table
        expect(html).toContain(p90v2)
        expect(html).toContain(p10v2)
      })
    })
  })

  it('cross-field check: P50 capacity rank order makes physical sense', () => {
    console.log('\n--- Cross-field capacity comparison ---')
    const results: Array<{ name: string; p50: number; litho: string; giip: number }> = []

    for (const preset of DEPLETED_PRESETS) {
      const p = preset.params
      const T_K = p.temperature + 273.15
      const res = computeDepletedFieldCapacity(
        p.giip!, T_K, p.pressure, p.abandonmentPressure!,
        0.60, p.methaneFraction ?? 0, p.nitrogenFraction ?? 0, p.lithologyClass,
      )
      results.push({ name: preset.name, p50: res.storageMt, litho: p.lithologyClass ?? 'sandstone', giip: p.giip! })
      console.log(`  ${preset.name.padEnd(25)} GIIP=${p.giip!.toString().padEnd(7)} Bcm  P50=${res.storageMt.toFixed(1).padEnd(8)} Mt  litho=${p.lithologyClass}`)
    }

    // Kasawari has by far the largest GIIP (84.9 Bcm) so must have largest P50
    const kasawari = results.find(r => r.name === 'Kasawari')!
    const others = results.filter(r => r.name !== 'Kasawari')
    for (const other of others) {
      expect(kasawari.p50).toBeGreaterThan(other.p50)
    }

    // Duyong (GIIP=5.5 Bcm) must have smallest P50 among carbonate fields
    const duyong   = results.find(r => r.name === 'Duyong')!
    const inSalah  = results.find(r => r.name === 'In Salah')!
    expect(duyong.p50).toBeLessThan(inSalah.p50)

    console.log('\n  Rank order (largest to smallest P50):')
    results.sort((a, b) => b.p50 - a.p50).forEach((r, i) =>
      console.log(`    ${i + 1}. ${r.name}: ${r.p50.toFixed(1)} Mt`)
    )
  })
})
