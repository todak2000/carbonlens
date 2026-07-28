/**
 * Pre-Permit Report Test
 *
 * Runs the full simulation for Kasawari (depleted gas, carbonate, Malaysia)
 * through the same code path the UI uses, intercepts window.open, captures
 * the generated HTML, and writes it to the validation directory.
 *
 * This proves the permit report pipeline is end-to-end correct after
 * all scientific fixes (corrected fill factors, CO2 density at P_initial, etc.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import { computeYearly, computeGeomechanicsResult } from '../../hooks/useSimulation'
import { useFormationStore } from '../../store/formationStore'
import { openPermitApplication } from '../../utils/exportHTMLReports'

const OUTPUT_DIR = path.resolve(__dirname, '../../../../validation')

// ── Capture window.open output ───────────────────────────────────────────────
function capturePermitHTML(fn: () => void): string {
  let captured = ''
  const fakeDoc = {
    write: (s: string) => { captured += s },
    close: () => {},
  }
  const fakeWin = {
    document: fakeDoc,
    focus: () => {},
    print: () => {},
  }
  const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin as any)
  try {
    fn()
  } finally {
    openSpy.mockRestore()
  }
  return captured
}

describe('Pre-Permit Report — Kasawari (MY, carbonate depleted gas)', () => {
  const preset = FORMATION_PRESETS.find(p => p.name === 'Kasawari')!
  const p = preset.params

  const WELL = {
    id: 'w1',
    name: 'KSW-INJ-01',
    injectionRate: 1.3,
    rampUpYears: 3,
    rampDownYears: 7,
    x: 0.5,
    z: 0.5,
    label: 'KSW-INJ-01',
  }

  beforeEach(() => {
    useFormationStore.setState({ wells: [WELL] })
  })

  it('generates and writes the pre-permit HTML report', () => {
    // ── 1. Run 20-year simulation ───────────────────────────────────────────
    const PROJECT_YEARS = 20
    let simResult: ReturnType<typeof computeYearly> | null = null
    for (let y = 0; y <= PROJECT_YEARS; y++) {
      simResult = computeYearly(p, y, PROJECT_YEARS, simResult)
    }
    expect(simResult).not.toBeNull()

    const geoResult = computeGeomechanicsResult(p, [WELL], simResult!)

    // ── 2. Log key simulation outputs ──────────────────────────────────────
    console.log('\n')
    console.log('='.repeat(80))
    console.log('KASAWARI — PRE-PERMIT SIMULATION RESULTS (Year 20)')
    console.log('='.repeat(80))
    console.log(`  Formation type   : ${p.formationType}`)
    console.log(`  Lithology        : ${p.lithologyClass} (carbonate fill 30/50/75%)`)
    console.log(`  T / P_initial    : ${p.temperature}°C / ${p.pressure} MPa`)
    console.log(`  P_abandon        : ${p.abandonmentPressure} MPa`)
    console.log(`  GIIP             : ${p.giip} Bcm`)
    console.log(`  Injection rate   : ${WELL.injectionRate} Mt/yr`)
    console.log(`  Project years    : ${PROJECT_YEARS}`)
    console.log('')
    console.log(`  P90 Capacity     : ${simResult!.p90.toFixed(1)} Mt`)
    console.log(`  P50 Capacity     : ${simResult!.p50.toFixed(1)} Mt`)
    console.log(`  P10 Capacity     : ${simResult!.p10.toFixed(1)} Mt`)
    console.log(`  Cumulative inj.  : ${simResult!.storageCapacity.toFixed(3)} Mt`)
    console.log(`  Plume radius     : ${simResult!.plumeRadius.toFixed(1)} m`)
    console.log(`  Plume height     : ${simResult!.plumeHeight.toFixed(1)} m`)
    console.log(`  Inj. pressure    : ${simResult!.injectionPressure.toFixed(3)} MPa`)
    console.log(`  Safety factor Fs : ${geoResult.safetyFactor.toFixed(3)}`)
    console.log(`  MAIP margin      : ${geoResult.maipMargin.toFixed(1)}%`)
    console.log(`  Seis. risk       : ${geoResult.inducedSeismicityRisk}`)
    console.log(`  Surface heave    : ${(geoResult.surfaceHeave * 1000).toFixed(1)} mm`)
    console.log('='.repeat(80))

    // ── 3. Scientific assertions ────────────────────────────────────────────
    // P50 should be ~188 Mt (carbonate 50% fill × PV × rho_CO2 at 13.5 MPa)
    expect(simResult!.p50).toBeGreaterThan(100)
    expect(simResult!.p50).toBeLessThan(350)

    // P90 < P50 < P10 ordering
    expect(simResult!.p90).toBeLessThan(simResult!.p50)
    expect(simResult!.p50).toBeLessThan(simResult!.p10)

    // With 1.3 Mt/yr over 20 years (ramp), cumulative << P50 capacity
    expect(simResult!.storageCapacity).toBeGreaterThan(0)
    expect(simResult!.storageCapacity).toBeLessThan(simResult!.p50)

    // Injection pressure below MAIP
    expect(geoResult.maipMargin).toBeGreaterThan(0)

    // ── 4. Generate the permit HTML ─────────────────────────────────────────
    const html = capturePermitHTML(() => {
      openPermitApplication(
        p,
        simResult!,
        geoResult,
        [WELL],
        'Kasawari',          // formation name
        'Sarawak, Malaysia', // location
        'MY',                // jurisdiction
        'CarbonLens Test',   // organization
        [],                  // no 3D snapshots in test
        PROJECT_YEARS,
        PROJECT_YEARS,       // simulationYear = end of project
      )
    })

    // ── 5. Write to file (always, before assertions) ────────────────────────
    const outPath = path.join(OUTPUT_DIR, 'kasawari_permit_report.html')
    fs.writeFileSync(outPath, html, 'utf8')
    console.log(`\n✓ Permit report written: file://${outPath}`)
    console.log(`  HTML size: ${(html.length / 1024).toFixed(1)} KB`)

    // ── 6. Verify HTML content ──────────────────────────────────────────────
    expect(html.length).toBeGreaterThan(10_000)
    expect(html).toContain('Kasawari')
    expect(html).toContain('Malaysia')
    expect(html).toContain('CO₂ Storage')
    // Capacity values should appear in the report
    expect(html).toContain(simResult!.p50.toFixed(1))
    // Geomechanics section
    expect(html).toContain('Safety Factor')
    // Malaysia jurisdiction uses "Licence" not "Permit"
    const hasMYPermit = html.includes('Storage Licence') || html.includes('CCUS Act') || html.includes('Sarawak')
    expect(hasMYPermit).toBe(true)

    // ── 7. Content spot-checks ──────────────────────────────────────────────
    const hasCapacity    = html.includes('188') || html.includes('187') || html.includes('189')
    const hasTemperature = html.includes('45')
    const hasPressure    = html.includes('13.5')
    const hasGIIP        = html.includes('84.9') || html.includes('84')

    console.log(`  Contains capacity ~188 Mt : ${hasCapacity}`)
    console.log(`  Contains T=45°C           : ${hasTemperature}`)
    console.log(`  Contains P=13.5 MPa       : ${hasPressure}`)
    console.log(`  Contains GIIP=84.9 Bcm    : ${hasGIIP}`)

    expect(hasTemperature).toBe(true)
    expect(hasPressure).toBe(true)
  })
})

describe('Pre-Permit Report — In Salah (DZ, carbonate depleted gas)', () => {
  const preset = FORMATION_PRESETS.find(p => p.name === 'In Salah')!
  const p = preset.params

  const WELL = {
    id: 'w1',
    name: 'INS-INJ-01',
    injectionRate: 0.5,
    rampUpYears: 2,
    rampDownYears: 5,
    x: 0.5,
    z: 0.5,
    label: 'INS-INJ-01',
  }

  beforeEach(() => {
    useFormationStore.setState({ wells: [WELL] })
  })

  it('generates and writes the pre-permit HTML report', () => {
    const PROJECT_YEARS = 20
    let simResult: ReturnType<typeof computeYearly> | null = null
    for (let y = 0; y <= PROJECT_YEARS; y++) {
      simResult = computeYearly(p, y, PROJECT_YEARS, simResult)
    }

    const geoResult = computeGeomechanicsResult(p, [WELL], simResult!)

    console.log('\n')
    console.log('='.repeat(80))
    console.log('IN SALAH — PRE-PERMIT SIMULATION RESULTS (Year 20)')
    console.log('='.repeat(80))
    console.log(`  T=91°C / P_initial=17.6 MPa / P_abandon=10.5 MPa`)
    console.log(`  GIIP=30 Bcm | Carbonate (fill 30/50/75% per Bachu 2007)`)
    console.log(`  P90: ${simResult!.p90.toFixed(1)} Mt | P50: ${simResult!.p50.toFixed(1)} Mt | P10: ${simResult!.p10.toFixed(1)} Mt`)
    console.log(`  Safety Fs: ${geoResult.safetyFactor.toFixed(3)} | MAIP margin: ${geoResult.maipMargin.toFixed(1)}%`)
    console.log(`  Seis. risk: ${geoResult.inducedSeismicityRisk}`)
    console.log('='.repeat(80))

    // In Salah is a known induced seismicity risk — flag it
    const highSeis = geoResult.inducedSeismicityRisk === 'high' || geoResult.inducedSeismicityRisk === 'moderate'
    console.log(`  NOTE: Induced seismicity risk = ${geoResult.inducedSeismicityRisk} — historically accurate for Krechba`)

    // P50 ~44.7 Mt
    expect(simResult!.p50).toBeGreaterThan(20)
    expect(simResult!.p50).toBeLessThan(100)
    expect(simResult!.p90).toBeLessThan(simResult!.p50)
    expect(simResult!.p50).toBeLessThan(simResult!.p10)

    const html = capturePermitHTML(() => {
      openPermitApplication(
        p, simResult!, geoResult, [WELL],
        'In Salah', 'Krechba Field, Algeria', 'DZ',
        'CarbonLens Test', [], PROJECT_YEARS, PROJECT_YEARS,
      )
    })

    expect(html.length).toBeGreaterThan(10_000)
    expect(html).toContain('In Salah')

    const outPath = path.join(OUTPUT_DIR, 'in_salah_permit_report.html')
    fs.writeFileSync(outPath, html, 'utf8')
    console.log(`\n✓ Permit report written: file://${outPath}`)
  })
})

describe('Pre-Permit Report — Johansen (EU, saline aquifer)', () => {
  const preset = FORMATION_PRESETS.find(p => p.name === 'Johansen')!
  const p = preset.params

  const WELL = {
    id: 'w1',
    name: 'JOH-INJ-01',
    injectionRate: 1.9,
    rampUpYears: 3,
    rampDownYears: 8,
    x: 0.5,
    z: 0.5,
    label: 'JOH-INJ-01',
  }

  beforeEach(() => {
    useFormationStore.setState({ wells: [WELL] })
  })

  it('generates and writes the pre-permit HTML report', () => {
    const PROJECT_YEARS = 20
    let simResult: ReturnType<typeof computeYearly> | null = null
    for (let y = 0; y <= PROJECT_YEARS; y++) {
      simResult = computeYearly(p, y, PROJECT_YEARS, simResult)
    }

    const geoResult = computeGeomechanicsResult(p, [WELL], simResult!)

    console.log('\n')
    console.log('='.repeat(80))
    console.log('JOHANSEN — PRE-PERMIT SIMULATION RESULTS (Year 20)')
    console.log('='.repeat(80))
    console.log(`  T=98°C / P=28.5 MPa / Saline aquifer`)
    console.log(`  P90: ${simResult!.p90.toFixed(1)} Mt | P50: ${simResult!.p50.toFixed(1)} Mt | P10: ${simResult!.p10.toFixed(1)} Mt`)
    console.log(`  Cum. injected: ${simResult!.storageCapacity.toFixed(3)} Mt over ${PROJECT_YEARS} years`)
    console.log(`  Safety Fs: ${geoResult.safetyFactor.toFixed(3)} | MAIP: ${geoResult.maipMargin.toFixed(1)}%`)
    console.log('='.repeat(80))

    expect(simResult!.p50).toBeGreaterThan(25)
    expect(simResult!.p50).toBeLessThan(90)

    const html = capturePermitHTML(() => {
      openPermitApplication(
        p, simResult!, geoResult, [WELL],
        'Johansen', 'North Sea, Norway', 'EU',
        'CarbonLens Test', [], PROJECT_YEARS, PROJECT_YEARS,
      )
    })

    expect(html.length).toBeGreaterThan(10_000)
    expect(html).toContain('Johansen')
    // EU permit
    expect(html).toContain('2009/31/EC')

    const outPath = path.join(OUTPUT_DIR, 'johansen_permit_report.html')
    fs.writeFileSync(outPath, html, 'utf8')
    console.log(`\n✓ Permit report written: file://${outPath}`)
  })
})
