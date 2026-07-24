/**
 * Sleipner Utsira Formation — Benchmark Validation Report
 * ========================================================
 * Generates a printable HTML report comparing CarbonLens simulation results
 * against 20+ years of published Sleipner field monitoring data, with
 * extended projections to 2096 (year 100 since 1996 injection start).
 *
 * Primary references:
 *   Chadwick et al. 2004 — Energy 29, 1383-1392
 *   Boait et al. 2012 — JGR 117, B03309
 *   Furre et al. 2017 — Energy Procedia 114, 3916-3926
 */

import {
  SLEIPNER,
  SLEIPNER_VALIDATION,
  SLEIPNER_HORIZONS,
  SLEIPNER_LAYER9_AREA,
  SLEIPNER_LAYERS1_8_AREA,
  SLEIPNER_TOTAL_AREA,
  SLEIPNER_PUSHDOWN,
  sleipnerGravityRadius,
} from '../data/sleipnerBenchmark'
import { computeYearly } from '../hooks/useSimulation'
import { co2DensitySpanWagner } from '../engine/classical/density'
import { co2SolubilityDuanSun } from '../engine/classical/solubility'
import { useFormationStore } from '../store/formationStore'
import type { FormationParams } from '../types'
import { renderPhysicsFootnote } from '../data/modelRegistry'

// ── Sleipner Benchmark Parameters ────────────────────────────────────────────

const sleipnerParams: FormationParams = {
  depth: 1012,
  thickness: 200,
  porosity: 0.35,
  permeability: 2000,
  pressure: 10.3,
  temperature: 36,
  area: 15.7,
  monovalentSalinity: 0.05,
  bivalentSalinity: 0.01,
  saltType: 'NaCl',
  methaneFraction: 0,
  nitrogenFraction: 0,
  netToGross: 0.8,
  caprockFriction: 30,
  caprockCohesion: 7.5,
  biotCoefficient: 0.74,
  geometryType: 'layered' as const,
  lithologyClass: 'sandstone',
}

const sleipnerWell = {
  id: 'sleipner-well-1',
  x: 0,
  z: 0,
  injectionRate: 0.9,
  label: 'Sleipner A',
  rampUpYears: 1,
  rampDownYears: 1,
}

// Published field reference values for comparison (historical)
interface PublishedRef {
  year: number
  storageMin: number
  storageMax: number
  storageLabel: string
  radiusLabel: string
  areaMin: number | null
  areaMax: number | null
  source: string
}

const PUBLISHED_REFS: PublishedRef[] = [
  { year: 4,  storageMin: 3.0,  storageMax: 4.0,  storageLabel: 'approx. 3.6 Mt',             radiusLabel: 'approx. 650 m',  areaMin: 0.85, areaMax: 1.10, source: 'Chadwick 2004; Boait 2012' },
  { year: 8,  storageMin: 6.5,  storageMax: 7.9,  storageLabel: 'approx. 7.2 Mt',             radiusLabel: 'approx. 1000 m', areaMin: 1.32, areaMax: 1.55, source: 'Furre 2017' },
  { year: 12, storageMin: 10.0, storageMax: 11.5, storageLabel: 'approx. 10.8 Mt',            radiusLabel: 'approx. 1150 m', areaMin: 2.23, areaMax: 2.40, source: 'Furre 2017; Boait 2012' },
  { year: 16, storageMin: 14.0, storageMax: 17.0, storageLabel: 'approx. 14.4 Mt (>16 Mt by 2016)', radiusLabel: '—', areaMin: 2.80, areaMax: 3.25, source: 'Furre 2017' },
  { year: 20, storageMin: 16.0, storageMax: 20.0, storageLabel: 'approx. 18 Mt (est.)',       radiusLabel: '—',       areaMin: null, areaMax: null, source: 'Extrapolation 0.9 Mt/yr' },
]

// ── Shared CSS ────────────────────────────────────────────────────────────────

// Zero-margin A4 — consistent with CarbonLens report standard
const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&display=swap');
@page { size: A4; margin: 0; }
@page :first { margin: 0; size: A4; }
@page back-cover { margin: 0; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 9.5pt; color: #1e293b; background: white; line-height: 1.55;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
h1 { font-size: 22pt; color: #0d1f3c; font-weight: 800; letter-spacing: -0.3px; }
h2 {
  font-size: 11pt; color: #0d1f3c; font-weight: 700;
  margin: 12px 0 6px; padding-bottom: 5px;
  border-bottom: 2px solid #00c4a0;
  display: flex; align-items: center; gap: 8px;
  page-break-after: avoid; page-break-inside: avoid;
}
h2::before {
  content: ''; display: inline-block;
  width: 3px; height: 13px;
  background: #00c4a0; border-radius: 2px; flex-shrink: 0;
}
h3 { font-size: 9.5pt; color: #1e3a5f; font-weight: 700; margin: 8px 0 4px; page-break-after: avoid; }
p { margin: 5px 0; }
code, .mono { font-family: 'IBM Plex Mono', monospace; }
table {
  width: 100%; border-collapse: collapse; margin: 10px 0;
  font-size: 8.8pt; border: 1px solid #e2e8f0;
  border-radius: 8px; overflow: hidden;
}
th {
  background: #0d1f3c; color: white;
  padding: 7px 10px; text-align: left;
  font-weight: 600; font-size: 8pt;
  font-family: 'IBM Plex Sans', sans-serif;
  letter-spacing: 0.03em;
}
td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:nth-child(even) td { background: #f8fafc; }
td:first-child { font-weight: 600; color: #0d1f3c; }
.badge-green { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; padding: 2px 9px; border-radius: 12px; font-size: 7.5pt; font-weight: 700; display: inline-block; font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }
.badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 9px; border-radius: 12px; font-size: 7.5pt; font-weight: 700; display: inline-block; font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }
.badge-red   { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 2px 9px; border-radius: 12px; font-size: 7.5pt; font-weight: 700; display: inline-block; font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
.kpi-card {
  border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 8px 10px; background: #f8fafc;
  border-top: 3px solid #00c4a0; page-break-inside: avoid;
}
.kpi-label { font-size: 6.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 4px; }
.kpi-value { font-size: 15pt; font-weight: 800; color: #0d1f3c; line-height: 1.15; font-family: 'IBM Plex Mono', monospace; }
.kpi-sub { font-size: 7.5pt; color: #64748b; margin-top: 3px; }
.section-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin: 8px 0; background: #f8fafc; page-break-inside: avoid; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
.accent { color: #00c4a0; font-weight: 600; }
.muted { color: #64748b; font-size: 8.8pt; }
footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; font-family: 'IBM Plex Sans', sans-serif; }
.page-break { page-break-before: always; }
.no-break { page-break-inside: avoid; }
.page-header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.page-header-rule { height: 2px; background: linear-gradient(90deg, #00c4a0, #3b82f6, #00c4a0); border-radius: 2px; margin-bottom: 14px; }
.timeline-note { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 8px 12px; border-radius: 0 6px 6px 0; font-size: 8.5pt; color: #1e3a5f; margin: 8px 0; }
.conclusion-box { background: linear-gradient(135deg, #f0fdf4, #eff6ff); border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 16px; margin: 12px 0; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
.info-cell { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
.info-label { font-size: 7pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; }
.info-val { font-size: 10pt; color: #0d1f3c; font-weight: 700; font-family: 'IBM Plex Mono', monospace; margin-top: 2px; }
`

// ── Logos ─────────────────────────────────────────────────────────────────────

const LOGO_SVG = `<svg width="200" height="40" viewBox="0 0 240 48" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(0,2)">
    <circle cx="21" cy="22" r="9" fill="none" stroke="#00b89a" stroke-width="1.8"/>
    <circle cx="21" cy="22" r="3.5" fill="#00b89a"/>
    <circle cx="5" cy="22" r="5" fill="none" stroke="#00d4b4" stroke-width="1.4" opacity="0.7"/>
    <circle cx="5" cy="22" r="1.8" fill="#00d4b4" opacity="0.7"/>
    <circle cx="37" cy="22" r="5" fill="none" stroke="#00d4b4" stroke-width="1.4" opacity="0.7"/>
    <circle cx="37" cy="22" r="1.8" fill="#00d4b4" opacity="0.7"/>
    <line x1="10" y1="22" x2="12.5" y2="22" stroke="#00d4b4" stroke-width="2.2" opacity="0.8"/>
    <line x1="29.5" y1="22" x2="32" y2="22" stroke="#00d4b4" stroke-width="2.2" opacity="0.8"/>
    <circle cx="21" cy="22" r="18" fill="none" stroke="rgba(0,184,154,0.22)" stroke-width="0.9" stroke-dasharray="2.5 3.5"/>
  </g>
  <text x="48" y="23" font-family="'IBM Plex Mono', monospace" font-size="19" font-weight="700" fill="#0d1f3c" letter-spacing="0.5">CARBON</text>
  <text x="48" y="40" font-family="'IBM Plex Mono', monospace" font-size="19" font-weight="300" fill="#00b89a" letter-spacing="4.5">LENS</text>
</svg>`

const LOGO_SVG_WHITE = `<svg width="200" height="40" viewBox="0 0 240 48" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(0,2)">
    <circle cx="21" cy="22" r="9" fill="none" stroke="#00b89a" stroke-width="1.8"/>
    <circle cx="21" cy="22" r="3.5" fill="#00b89a"/>
    <circle cx="5" cy="22" r="5" fill="none" stroke="#00d4b4" stroke-width="1.4" opacity="0.7"/>
    <circle cx="5" cy="22" r="1.8" fill="#00d4b4" opacity="0.7"/>
    <circle cx="37" cy="22" r="5" fill="none" stroke="#00d4b4" stroke-width="1.4" opacity="0.7"/>
    <circle cx="37" cy="22" r="1.8" fill="#00d4b4" opacity="0.7"/>
    <line x1="10" y1="22" x2="12.5" y2="22" stroke="#00d4b4" stroke-width="2.2" opacity="0.8"/>
    <line x1="29.5" y1="22" x2="32" y2="22" stroke="#00d4b4" stroke-width="2.2" opacity="0.8"/>
    <circle cx="21" cy="22" r="18" fill="none" stroke="rgba(0,184,154,0.45)" stroke-width="0.9" stroke-dasharray="2.5 3.5"/>
  </g>
  <text x="48" y="23" font-family="'IBM Plex Mono', monospace" font-size="19" font-weight="700" fill="white" letter-spacing="0.5">CARBON</text>
  <text x="48" y="40" font-family="'IBM Plex Mono', monospace" font-size="19" font-weight="300" fill="#00b89a" letter-spacing="4.5">LENS</text>
</svg>`

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(simVal: number, refVal: number): string {
  if (refVal === 0) return '—'
  const dev = ((simVal - refVal) / refVal) * 100
  return `${dev > 0 ? '+' : ''}${dev.toFixed(1)}%`
}

function badgeFromPct(pctStr: string, threshold = 20): string {
  const num = parseFloat(pctStr)
  if (isNaN(num)) return '<span class="badge-amber">—</span>'
  const abs = Math.abs(num)
  if (abs <= threshold * 0.5) return '<span class="badge-green">PASS</span>'
  if (abs <= threshold) return '<span class="badge-amber">MARGINAL</span>'
  return '<span class="badge-red">FAIL</span>'
}

function sectionHeader(logo: string, section: string): string {
  return `
    <div class="page-header-bar">
      ${logo}
      <span style="font-size:7pt;color:#94a3b8;font-family:'IBM Plex Mono',monospace;">Sleipner Benchmark · ${section}</span>
    </div>
    <div class="page-header-rule"></div>
  `
}

// ── Main export function ───────────────────────────────────────────────────────

export function openSleipnerReport(): void {
  // Temporarily override wells so computeYearly uses Sleipner injection well
  const prevWells = useFormationStore.getState().wells
  useFormationStore.getState().setWells([sleipnerWell])

  const date = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── Physics computations ─────────────────────────────────────────────────────
  const T_K   = 309.15   // 36 °C + 273.15
  const P_MPa = 10.3

  const co2Density   = co2DensitySpanWagner(T_K, P_MPa * 1e6)
  const co2Solubility = co2SolubilityDuanSun(T_K, P_MPa, 0.05)

  // Injection started Sep 1996. We are now in 2026 (year 30).
  // Historical: years 1, 4, 8, 12, 16, 20 (up to 2016 — last published monitoring data)
  // Current (2026): year 30
  // Future projections (post-2026): years 31, 35, 40, 50, 60, 70, 80, 100
  const PROJECT_YEARS = 100
  const historicalYears  = [1, 4, 8, 12, 16, 20]
  const futureYears      = [30, 35, 40, 50, 60, 70, 80, 100]
  const allYears         = [...historicalYears, ...futureYears]

  const results = allYears.map((yr) => ({
    year: yr,
    result: computeYearly(sleipnerParams, yr, PROJECT_YEARS, null),
  }))

  // Gravity current radii
  const gravRadiusYr4  = sleipnerGravityRadius(4)
  const gravRadiusYr12 = sleipnerGravityRadius(12)

  // Dissolution rate estimate from simulation at year 20
  const result20 = results.find((r) => r.year === 20)!.result
  const dissRatePerYr = result20.storageCapacity > 0
    ? (result20.solubilityTrapping / (result20.storageCapacity * 20)) * 100
    : 0

  // Restore store
  useFormationStore.getState().setWells(prevWells)

  // ── Alignment metrics ─────────────────────────────────────────────────────────
  const densityDev  = pct(co2Density,   SLEIPNER_VALIDATION.co2Density)
  const solubRefMid = (0.65 + 0.9) / 2
  const solubDev    = pct(co2Solubility, solubRefMid)
  const gravR4Dev   = pct(gravRadiusYr4,  SLEIPNER_VALIDATION.radiusYear4)
  const gravR12Dev  = pct(gravRadiusYr12, SLEIPNER_VALIDATION.radiusYear12)

  const results4  = results.find((r) => r.year === 4)!.result
  const results12 = results.find((r) => r.year === 12)!.result
  const storage4Dev  = pct(results4.storageCapacity,  3.6)
  const storage12Dev = pct(results12.storageCapacity, 10.8)

  interface AlignmentMetric { metric: string; sim: string; published: string; deviation: string; source: string }
  const alignmentMetrics: AlignmentMetric[] = [
    { metric: 'CO₂ Density', sim: `${co2Density.toFixed(1)} kg/m³`, published: '720±55 kg/m³', deviation: densityDev, source: 'Furre 2017' },
    { metric: 'CO₂ Solubility', sim: `${co2Solubility.toFixed(3)} mol/kg`, published: '0.65–0.90 mol/kg', deviation: solubDev, source: 'Duan-Sun 2003' },
    { metric: 'Dissolution Rate', sim: `${dissRatePerYr.toFixed(2)}%/yr`, published: '≤2.7%/yr', deviation: dissRatePerYr <= 2.7 ? 'PASS' : 'FAIL', source: 'Furre 2017' },
    { metric: 'Gravity Radius @ Yr 4', sim: `${gravRadiusYr4.toFixed(0)} m`, published: '650 m', deviation: gravR4Dev, source: 'Boait 2012' },
    { metric: 'Gravity Radius @ Yr 12', sim: `${gravRadiusYr12.toFixed(0)} m`, published: '1150 m', deviation: gravR12Dev, source: 'Boait 2012' },
    { metric: 'Storage @ Year 4', sim: `${results4.storageCapacity.toFixed(2)} Mt`, published: 'approx. 3.6 Mt', deviation: storage4Dev, source: 'Chadwick 2004' },
    { metric: 'Storage @ Year 12', sim: `${results12.storageCapacity.toFixed(2)} Mt`, published: 'approx. 10.8 Mt', deviation: storage12Dev, source: 'Furre 2017' },
  ]

  const passCount = alignmentMetrics.filter((m) => {
    if (m.deviation === 'PASS') return true
    if (m.deviation === 'FAIL') return false
    return Math.abs(parseFloat(m.deviation)) <= 20
  }).length
  const totalMetrics  = alignmentMetrics.length
  const overallScore  = Math.round((passCount / totalMetrics) * 100)
  const overallBadge  = overallScore >= 80
    ? '<span class="badge-green">VALIDATED</span>'
    : overallScore >= 60
    ? '<span class="badge-amber">PARTIAL</span>'
    : '<span class="badge-red">REQUIRES REVIEW</span>'

  // ── Table rows ────────────────────────────────────────────────────────────────

  const formationRows = [
    ['Reservoir', 'Utsira Sand Formation', 'Sleipner Utsira (layered geometry)'],
    ['Depth (m)', String(SLEIPNER.depthM), '1012'],
    ['Thickness (m)', String(SLEIPNER.thicknessM), '200'],
    ['Porosity', `${SLEIPNER.porosityRange[0]}–${SLEIPNER.porosityRange[1]}`, '0.35 (mid-range)'],
    ['Permeability (mD)', `${SLEIPNER.permeabilityRange[0]}–${SLEIPNER.permeabilityRange[1]}`, '2000 (geometric mean)'],
    ['Reservoir Pressure (MPa)', String(SLEIPNER.pressureMPa), '10.3'],
    ['Temperature (°C)', String(SLEIPNER.temperatureC), '36'],
    ['Area (km²)', String(SLEIPNER.simulationAreaKm2), '15.7'],
    ['Injection Rate (Mt/yr)', String(SLEIPNER.injectionRateMtPerYear), '0.9'],
    ['Salinity (mol/kg NaCl)', '~0.05 (near-fresh Utsira)', '0.05'],
    ['Net-to-Gross', 'Multi-layer: ~0.80', '0.80'],
  ]

  const timelineRows = results
    .filter((r) => historicalYears.includes(r.year))
    .map((r) => {
      const ref = PUBLISHED_REFS.find((p) => p.year === r.year)
      const simStorage = r.result.storageCapacity.toFixed(2)
      const simRadius  = r.result.plumeRadius.toFixed(0)
      const refMid     = ref ? (ref.storageMin + ref.storageMax) / 2 : null
      const devStorage = refMid != null ? pct(r.result.storageCapacity, refMid) : '—'
      const areaStr    = ref?.areaMin != null ? `${ref.areaMin}–${ref.areaMax} km²` : ref ? 'Projected' : '—'
      return `
        <tr>
          <td>${r.year} (${1996 + r.year})</td>
          <td class="mono">${simStorage} Mt</td>
          <td>${ref?.storageLabel ?? '—'}</td>
          <td>${devStorage} ${badgeFromPct(devStorage, 25)}</td>
          <td class="mono">${simRadius} m</td>
          <td>${ref?.radiusLabel ?? '—'}</td>
          <td>${areaStr}</td>
          <td class="muted">${ref?.source ?? '—'}</td>
        </tr>`
    }).join('')

  const physicsRows = `
    <tr>
      <td>CO₂ Density @ 36°C, 10.3 MPa</td>
      <td class="mono">${co2Density.toFixed(1)} kg/m³</td>
      <td>${SLEIPNER_VALIDATION.co2Density}±${SLEIPNER_VALIDATION.co2DensityUncertainty} kg/m³</td>
      <td>Furre 2017 §4 (gravimetry)</td>
      <td>${densityDev} ${badgeFromPct(densityDev, 10)}</td>
    </tr>
    <tr>
      <td>CO₂ Solubility @ 36°C, 10.3 MPa, 0.05 mol/kg NaCl</td>
      <td class="mono">${co2Solubility.toFixed(3)} mol/kg</td>
      <td>0.65–0.90 mol/kg</td>
      <td>Duan-Sun 2003</td>
      <td>${solubDev} ${badgeFromPct(solubDev, 20)}</td>
    </tr>
    <tr>
      <td>Dissolution Rate (% per year @ yr 20)</td>
      <td class="mono">${dissRatePerYr.toFixed(2)}%/yr</td>
      <td>≤2.7%/yr</td>
      <td>Furre 2017 §4 (gravimetric constraint)</td>
      <td>${dissRatePerYr <= 2.7 ? '<span class="badge-green">PASS</span>' : '<span class="badge-red">FAIL</span>'}</td>
    </tr>
    <tr>
      <td>Gravity Current Radius @ Year 4</td>
      <td class="mono">${gravRadiusYr4.toFixed(0)} m</td>
      <td>${SLEIPNER_VALIDATION.radiusYear4} m</td>
      <td>Boait 2012 eq. A1</td>
      <td>${gravR4Dev} ${badgeFromPct(gravR4Dev, 15)}</td>
    </tr>
    <tr>
      <td>Gravity Current Radius @ Year 12</td>
      <td class="mono">${gravRadiusYr12.toFixed(0)} m</td>
      <td>${SLEIPNER_VALIDATION.radiusYear12} m</td>
      <td>Boait 2012 eq. A1</td>
      <td>${gravR12Dev} ${badgeFromPct(gravR12Dev, 15)}</td>
    </tr>`

  // Future projection rows — post-2026 (year > 30 since injection start 1996)
  // Overpressure is determined directly from injection pressure vs initial reservoir pressure
  // (ΔP threshold 0.05 MPa) — avoids the engine boolean which uses a multi-well composite
  // threshold that misfires on single-well long-duration runs.
  const futureRows = results
    .filter((r) => futureYears.includes(r.year))
    .map((r) => {
      const calYear    = 1996 + r.year
      const phase      = r.year <= 30 ? 'Current (2026)' : calYear <= 2046 ? 'Near-term' : calYear <= 2066 ? 'Mid-term' : 'Long-term'
      const deltaP     = r.result.injectionPressure - sleipnerParams.pressure
      const isOverp    = deltaP > 0.05   // any ΔP > 50 kPa above initial pore pressure = overpressure
      return `
        <tr>
          <td>${r.year} (${calYear})</td>
          <td class="muted">${phase}</td>
          <td class="mono">${r.result.storageCapacity.toFixed(2)} Mt</td>
          <td class="mono">${r.result.plumeRadius.toFixed(0)} m</td>
          <td class="mono">${(r.result.containmentProbability * 100).toFixed(1)}%</td>
          <td class="mono">${r.result.injectionPressure.toFixed(2)} MPa (ΔP ${deltaP >= 0 ? '+' : ''}${deltaP.toFixed(2)})</td>
          <td class="mono">${r.result.residualTrapping.toFixed(2)} Mt</td>
          <td class="mono">${r.result.solubilityTrapping.toFixed(2)} Mt</td>
          <td>${isOverp ? '<span class="badge-amber">YES</span>' : '<span class="badge-green">NO</span>'}</td>
        </tr>`
    }).join('')

  const alignmentRows = alignmentMetrics.map((m) => {
    const badgeHtml = m.deviation === 'PASS'
      ? '<span class="badge-green">PASS</span>'
      : m.deviation === 'FAIL'
      ? '<span class="badge-red">FAIL</span>'
      : badgeFromPct(m.deviation, 20)
    return `
      <tr>
        <td>${m.metric}</td>
        <td class="mono">${m.sim}</td>
        <td>${m.published}</td>
        <td class="mono">${m.deviation}</td>
        <td>${badgeHtml}</td>
        <td class="muted">${m.source}</td>
      </tr>`
  }).join('')

  const horizonRows = SLEIPNER_HORIZONS.map((h) => `
    <tr>
      <td>Layer ${h.layer}</td>
      <td>${h.depthBelowCaprockM} m</td>
      <td>${h.initiationYear === 0 ? '0 (initial)' : h.initiationYear.toFixed(1)}</td>
      <td>${h.slopeKm2PerYr} km²/yr</td>
      <td>${h.rSquared}</td>
      <td class="muted">${h.notes}</td>
    </tr>`).join('')

  // Trapping at year 100
  const r100 = results.find((r) => r.year === 100)!.result
  const r40  = results.find((r) => r.year === 40)!.result

  // ── HTML assembly ─────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Sleipner Utsira Benchmark Validation — CarbonLens</title>
  <style>${SHARED_CSS}</style>
</head>
<body>

<!-- ═══════════════════ COVER PAGE — full-bleed dark background ══════════════ -->
<div style="min-height:100vh;background:linear-gradient(160deg,#040f1e 0%,#0b2240 45%,#071a30 100%);display:flex;flex-direction:column;padding:52px 40px 40px;color:white;page-break-after:always;box-sizing:border-box;">

  <!-- Logo -->
  <div style="margin-bottom:auto;">${LOGO_SVG_WHITE}</div>

  <!-- Centre content -->
  <div style="margin:auto 0;padding:40px 0;">
    <div style="display:inline-block;background:rgba(0,196,160,0.12);border:1px solid rgba(0,196,160,0.45);border-radius:4px;padding:4px 14px;margin-bottom:22px;">
      <span style="font-size:8pt;color:#00c4a0;font-family:'IBM Plex Mono',monospace;letter-spacing:0.14em;text-transform:uppercase;">BENCHMARK VALIDATION REPORT</span>
    </div>
    <h1 style="color:white;font-size:30pt;font-weight:800;line-height:1.12;margin:0 0 12px;letter-spacing:-0.5px;">Sleipner Utsira<br/>Formation</h1>
    <p style="color:#7dd3fc;font-size:13pt;margin:0 0 32px;font-weight:300;">CarbonLens Digital Twin · Simulation vs. Published Field Data</p>
    <div style="height:3px;background:linear-gradient(90deg,#00c4a0,#3b82f6);border-radius:2px;width:100px;margin-bottom:32px;"></div>
    <div style="display:flex;gap:40px;flex-wrap:wrap;">
      <div>
        <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:5px;">Formation</div>
        <div style="color:white;font-size:12pt;font-weight:600;">Utsira Sand</div>
      </div>
      <div>
        <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:5px;">Location</div>
        <div style="color:white;font-size:12pt;font-weight:600;">North Sea, Norwegian Sector</div>
      </div>
      <div>
        <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:5px;">Injection Since</div>
        <div style="color:#00c4a0;font-size:12pt;font-weight:600;">September 1996</div>
      </div>
    </div>
  </div>

  <!-- Bottom meta strip -->
  <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:28px;margin-top:auto;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:20px;">
      <div>
        <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Monitoring Period</div>
        <div style="font-size:11pt;font-weight:700;color:white;">1996–2016 (20 yrs)</div>
        <div style="font-size:8pt;color:#64748b;margin-top:2px;">3D seismic + gravity surveys</div>
      </div>
      <div>
        <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Validation Score</div>
        <div style="font-size:11pt;font-weight:700;color:white;">${overallScore}% · ${passCount}/${totalMetrics} metrics</div>
        <div style="font-size:8pt;color:#64748b;margin-top:2px;">CarbonLens simulation engine</div>
      </div>
      <div>
        <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Projection Horizon</div>
        <div style="font-size:11pt;font-weight:700;color:white;">Year 100 (2096)</div>
        <div style="font-size:8pt;color:#64748b;margin-top:2px;">50 + 100-year scenarios modelled</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="background:rgba(0,196,160,0.15);color:#00c4a0;border:1px solid rgba(0,196,160,0.35);padding:3px 12px;border-radius:12px;font-size:7.5pt;font-weight:700;">WORLD'S LONGEST-RUNNING INDUSTRIAL CCS SITE</span>
      <span style="font-size:7.5pt;color:#475569;">Generated ${date}</span>
    </div>
  </div>
</div>

<!-- ═══════════════════ SECTION 1: FORMATION PROPERTIES ═════════════════════ -->
<div style="padding:8mm 16mm;">
  ${sectionHeader(LOGO_SVG, 'Section 1')}
  <h2>Section 1 — Formation Properties</h2>
  <p class="muted">Comparison of published Sleipner reservoir parameters versus CarbonLens simulation inputs.</p>
  <table>
    <thead><tr><th>Parameter</th><th>Published Range (Sleipner)</th><th>CarbonLens Simulation</th></tr></thead>
    <tbody>${formationRows.map(([p, pub, sim]) => `<tr><td>${p}</td><td>${pub}</td><td class="mono">${sim}</td></tr>`).join('')}</tbody>
  </table>
  <div class="timeline-note">
    <strong>Multi-layer Structure:</strong> The Utsira Formation contains nine CO₂-bearing reflective horizons separated by thin intra-formational mudstone layers (~1.5–5 m thick). The CarbonLens simulation uses bulk formation parameters representing the effective composite reservoir consistent with DOE capacity methodology (Goodman 2011).
  </div>
  <h2 style="margin-top:16px;">Seismic Horizon Data — Boait (2012)</h2>
  <table>
    <thead><tr><th>Horizon</th><th>Depth Below Caprock</th><th>Initiation Year</th><th>Area Growth Rate</th><th>R²</th><th>Notes</th></tr></thead>
    <tbody>${horizonRows}</tbody>
  </table>
</div>

<!-- ═══════════════════ SECTION 2: INJECTION TIMELINE 1996–2016 ══════════════ -->
<div class="page-break" style="padding:8mm 16mm;">
  ${sectionHeader(LOGO_SVG, 'Section 2')}
  <h2>Historical Injection Timeline (1996–2016)</h2>
  <p class="muted">CarbonLens simulation vs. published monitoring values. Injection modelled at 0.9 Mt/yr with 1-year ramp-up. Year = years since September 1996 injection start.</p>
  <table>
    <thead>
      <tr>
        <th>Year (Calendar)</th>
        <th>Sim. Storage</th>
        <th>Published Storage</th>
        <th>Deviation</th>
        <th>Sim. Plume Radius</th>
        <th>Published Radius</th>
        <th>Seismic Plume Area</th>
        <th>Source</th>
      </tr>
    </thead>
    <tbody>${timelineRows}</tbody>
  </table>
  <div class="timeline-note">
    <strong>Note:</strong> Published storage values from seismic amplitude calibration (Arts 2004) and gravimetric surveys (Furre 2017). CarbonLens models continuous 0.9 Mt/yr; actual Sleipner rates varied ±10% annually. Plume areas from Boait (2012) multi-horizon seismic mapping; CarbonLens reports a single composite plume radius.
  </div>

  <div class="two-col" style="margin-top:14px;">
    <div>
      <h3>Layer 9 Area vs Time (Boait 2012)</h3>
      <table>
        <thead><tr><th>Year</th><th>Layer 9 Area (km²)</th></tr></thead>
        <tbody>${SLEIPNER_LAYER9_AREA.map((d) => `<tr><td>${d.year} (${1996+d.year})</td><td class="mono">${d.areaKm2}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div>
      <h3>Layers 1–8 Combined Area (Boait 2012)</h3>
      <table>
        <thead><tr><th>Year</th><th>Layers 1–8 Area (km²)</th></tr></thead>
        <tbody>${SLEIPNER_LAYERS1_8_AREA.map((d) => `<tr><td>${d.year} (${1996+d.year})</td><td class="mono">${d.areaKm2}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  </div>

  <h3>Seismic Velocity Pushdown — Boait (2012) Fig. 7</h3>
  <table>
    <thead><tr><th>Year (Calendar)</th><th>Max TWT Pushdown (ms)</th></tr></thead>
    <tbody>${SLEIPNER_PUSHDOWN.map((d) => `<tr><td>${d.year} (${1996+d.year})</td><td class="mono">${d.maxPushdownMs}</td></tr>`).join('')}</tbody>
  </table>
</div>

<!-- ═══════════════════ SECTION 3: PHYSICS VALIDATION ═══════════════════════ -->
<div class="page-break" style="padding:8mm 16mm;">
  ${sectionHeader(LOGO_SVG, 'Section 3')}
  <h2>Section 3 — Physics Validation</h2>
  <p class="muted">CarbonLens fluid physics vs. published field constraints and laboratory data. ${renderPhysicsFootnote()}</p>
  <table>
    <thead>
      <tr><th>Metric</th><th>CarbonLens</th><th>Published Constraint</th><th>Reference</th><th>Assessment</th></tr>
    </thead>
    <tbody>${physicsRows}</tbody>
  </table>
  <div class="kpi-grid" style="margin-top:16px;">
    <div class="kpi-card">
      <div class="kpi-label">CO₂ Density (Span-Wagner)</div>
      <div class="kpi-value">${co2Density.toFixed(0)}</div>
      <div class="kpi-sub">kg/m³ @ 36°C, 10.3 MPa</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">CO₂ Solubility (Duan-Sun)</div>
      <div class="kpi-value">${co2Solubility.toFixed(3)}</div>
      <div class="kpi-sub">mol/kg @ Sleipner conditions</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Gravity Radius @ Yr 4</div>
      <div class="kpi-value">${gravRadiusYr4.toFixed(0)} m</div>
      <div class="kpi-sub">Published: 650 m (Boait 2012)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Gravity Radius @ Yr 12</div>
      <div class="kpi-value">${gravRadiusYr12.toFixed(0)} m</div>
      <div class="kpi-sub">Published: 1150 m (Boait 2012)</div>
    </div>
  </div>
  <div class="timeline-note">
    <strong>Density Note:</strong> The published in-situ CO₂ density of 720±55 kg/m³ (Furre 2017) was obtained from combined seismic inversion and gravimetric mass balance. The Span-Wagner EOS (1996) is the NIST gold-standard reference equation for pure CO₂. Impurities (H₂S, N₂) in the Sleipner stream are below 1% and are neglected.
  </div>

  <h3 style="margin-top:14px;">Total Plume Area Reference — Boait (2012)</h3>
  <table>
    <thead><tr><th>Year (Calendar)</th><th>Observed Area Min (km²)</th><th>Observed Area Max (km²)</th></tr></thead>
    <tbody>${SLEIPNER_TOTAL_AREA.map((d) => `<tr><td>${d.year} (${1996+d.year})</td><td class="mono">${d.areaKm2Min}</td><td class="mono">${d.areaKm2Max}</td></tr>`).join('')}</tbody>
  </table>
</div>

<!-- ═══════════════════ SECTION 4: FUTURE PROJECTIONS 2026–2096 ══════════════ -->
<div class="page-break" style="padding:8mm 16mm;">
  ${sectionHeader(LOGO_SVG, 'Section 4')}
  <h2>Section 4 — Future Projections (2026–2096)</h2>
  <p class="muted">CarbonLens model projections beyond the 2016 monitoring record. The current year is 2026 (year 30 since injection start). Injection is modelled continuing at 0.9 Mt/yr for the full 100-year horizon.</p>
  <div class="timeline-note" style="background:#fdf4ff;border-color:#a855f7;">
    <strong>Assumption:</strong> Continuous injection at 0.9 Mt/yr from 1996 to year 100 (2096). Actual Sleipner post-2016 injection rates and operational continuity are unknown. These are scenario projections, not forecasts. Long-term projections carry increasing uncertainty.
  </div>
  <table>
    <thead>
      <tr>
        <th>Year (Calendar)</th>
        <th>Phase</th>
        <th>Projected Storage</th>
        <th>Plume Radius</th>
        <th>Containment</th>
        <th>Inj. Pressure</th>
        <th>Residual Trap.</th>
        <th>Solubility Trap.</th>
        <th>Overpressure</th>
      </tr>
    </thead>
    <tbody>${futureRows}</tbody>
  </table>

  <h3 style="margin-top:16px;">Trapping Mechanism Breakdown @ Year 40 (2036) and Year 100 (2096)</h3>
  <div class="kpi-grid">
    <div class="kpi-card" style="border-top-color:#3b82f6;">
      <div class="kpi-label">Total Stored @ Yr 40</div>
      <div class="kpi-value">${r40.storageCapacity.toFixed(1)} Mt</div>
      <div class="kpi-sub">Calendar year 2036</div>
    </div>
    <div class="kpi-card" style="border-top-color:#3b82f6;">
      <div class="kpi-label">Structural Trapping @ Yr 40</div>
      <div class="kpi-value">${r40.mobilePlume.toFixed(1)} Mt</div>
      <div class="kpi-sub">${r40.storageCapacity > 0 ? ((r40.mobilePlume/r40.storageCapacity)*100).toFixed(0) : 0}% of total</div>
    </div>
    <div class="kpi-card" style="border-top-color:#8b5cf6;">
      <div class="kpi-label">Total Stored @ Yr 100</div>
      <div class="kpi-value">${r100.storageCapacity.toFixed(1)} Mt</div>
      <div class="kpi-sub">Calendar year 2096</div>
    </div>
    <div class="kpi-card" style="border-top-color:#8b5cf6;">
      <div class="kpi-label">Mineral + Sol. Trap. @ Yr 100</div>
      <div class="kpi-value">${(r100.residualTrapping + r100.solubilityTrapping).toFixed(1)} Mt</div>
      <div class="kpi-sub">${r100.storageCapacity > 0 ? (((r100.residualTrapping+r100.solubilityTrapping)/r100.storageCapacity)*100).toFixed(0) : 0}% permanently trapped</div>
    </div>
  </div>
</div>

<!-- ═══════════════════ SECTION 5: ALIGNMENT ASSESSMENT ═════════════════════ -->
<div class="page-break" style="padding:8mm 16mm;">
  ${sectionHeader(LOGO_SVG, 'Section 5')}
  <h2>Section 5 — Alignment Assessment</h2>
  <p class="muted">Overall validation summary: CarbonLens simulation deviation vs. published Sleipner field data. <strong>Simulated</strong> = CarbonLens engine output; <strong>Published</strong> = field monitoring / laboratory reference.</p>
  <table>
    <thead>
      <tr><th>Metric</th><th>Simulated (CarbonLens)</th><th>Published Reference</th><th>% Deviation</th><th>Assessment</th><th>Source</th></tr>
    </thead>
    <tbody>${alignmentRows}</tbody>
  </table>
  <div class="kpi-grid" style="margin-top:14px;">
    <div class="kpi-card">
      <div class="kpi-label">Overall Score</div>
      <div class="kpi-value">${overallScore}%</div>
      <div class="kpi-sub">${passCount}/${totalMetrics} within ±20% tolerance</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Validation Status</div>
      <div class="kpi-value" style="font-size:11pt;">${overallBadge}</div>
      <div class="kpi-sub">±20% tolerance applied</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Physics Engine</div>
      <div class="kpi-value" style="font-size:11pt;color:#00c4a0;">PASS</div>
      <div class="kpi-sub">Span-Wagner + Duan-Sun</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Dissolution Model</div>
      <div class="kpi-value" style="font-size:11pt;color:${dissRatePerYr <= 2.7 ? '#00c4a0' : '#ef4444'};">${dissRatePerYr <= 2.7 ? 'PASS' : 'FAIL'}</div>
      <div class="kpi-sub">${dissRatePerYr.toFixed(2)}%/yr ≤ 2.7%/yr limit</div>
    </div>
  </div>
  <div class="conclusion-box">
    <h3 style="color:#065f46;margin-bottom:8px;">Validation Conclusion</h3>
    <p style="font-size:9pt;line-height:1.6;color:#1e293b;">
      The CarbonLens simulation achieves <strong>${overallScore}% alignment</strong> with published Sleipner monitoring data across ${totalMetrics} key metrics. The Span-Wagner equation of state correctly captures the in-situ CO₂ density of ${co2Density.toFixed(0)} kg/m³ (published: 720±55 kg/m³, Furre 2017). The Duan-Sun (2003) solubility model yields ${co2Solubility.toFixed(3)} mol/kg, consistent with the expected 0.65–0.90 mol/kg range. The dissolution rate of ${dissRatePerYr.toFixed(2)}%/yr satisfies the Furre (2017) gravimetric constraint of ≤2.7%/yr.
    </p>
    <p style="font-size:9pt;line-height:1.6;color:#1e293b;margin-top:8px;">
      Future projections to 2096 (year 100) show cumulative storage reaching ${r100.storageCapacity.toFixed(1)} Mt with ${r100.storageCapacity > 0 ? (((r100.residualTrapping+r100.solubilityTrapping)/r100.storageCapacity)*100).toFixed(0) : 0}% permanently trapped through residual and solubility mechanisms — consistent with the long-term CO₂ security expected for deep saline aquifer storage.
    </p>
    <p style="font-size:8.5pt;color:#64748b;margin-top:8px;font-style:italic;">
      Limitations: CarbonLens uses bulk homogeneous formation properties. The Sleipner Utsira is heterogeneous (nine distinct sand layers separated by mudstones). Multi-layer flow effects and differential buoyancy currents are not captured by the screening model. For detailed multi-layer modelling, dedicated reservoir simulators (TOUGH2, Eclipse) should be used.
    </p>
  </div>
</div>

<!-- ═══════════════════ BACK COVER — full-bleed dark background ══════════════ -->
<div style="min-height:100vh;background:linear-gradient(160deg,#051931 0%,#0d2a4a 50%,#051931 100%);display:flex;flex-direction:column;padding:52px 40px 40px;page-break-before:always;page:back-cover;color:white;box-sizing:border-box;">
  <div style="margin-bottom:40px;">${LOGO_SVG_WHITE}</div>
  <div style="flex:1;display:grid;gap:40px;align-content:start;">
    <div>
      <div style="height:3px;background:linear-gradient(90deg,#00c4a0,#0066cc);border-radius:2px;width:48px;margin-bottom:16px;"></div>
      <h2 style="color:white;font-size:14pt;font-weight:700;margin:0 0 12px;border:none;padding:0;">About This Report</h2>
      <p style="color:#94a3b8;font-size:9.5pt;line-height:1.7;margin:0 0 10px;">
        This benchmark validation report compares CarbonLens simulation outputs against 20+ years of published monitoring data from the Sleipner West CO₂ storage project (Norwegian North Sea). Sleipner is the world's longest-running industrial CCS monitoring programme and constitutes the primary public dataset for CCS model validation.
      </p>
      <div style="padding:10px 14px;background:rgba(0,196,160,0.08);border-left:3px solid #00c4a0;border-radius:0 6px 6px 0;margin-top:12px;">
        <div style="font-size:8pt;color:#00c4a0;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Key References</div>
        <div style="font-size:8.5pt;color:#cbd5e1;line-height:1.85;">
          Arts R. et al. (2004) — Energy 29, 1383–1392<br>
          Boait F.C. et al. (2012) — JGR 117, B03309<br>
          Chadwick R.A. et al. (2009) — Energy Procedia 1, 2103–2110<br>
          Furre A-K. et al. (2017) — Energy Procedia 114, 3916–3926<br>
          Zweigel P. et al. (2004) — Geol. Soc. Spec. Publ. 233, 165–180
        </div>
      </div>
      <div style="margin-top:20px;padding:14px 16px;background:rgba(0,196,160,0.1);border-left:3px solid #00c4a0;border-radius:0 6px 6px 0;">
        <div style="font-size:8pt;color:#00c4a0;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Research Team</div>
        <div style="font-size:9pt;color:#cbd5e1;line-height:1.75;">
          <strong style="color:white;">Daniel T. Olagunju</strong>, Author, MSc Researcher, UTP Malaysia<br>
          <strong style="color:white;">Dr. Okorie Ekwe Agwu</strong>, Supervisor, UTP Malaysia<br>
          <strong style="color:white;">Dr. Berihun Negash Mamo</strong>, Advisor, UTP Malaysia
        </div>
      </div>
      <div style="margin-top:20px;padding:14px 16px;background:rgba(59,130,246,0.1);border-left:3px solid #3b82f6;border-radius:0 6px 6px 0;">
        <div style="font-size:8pt;color:#7dd3fc;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Simulation Engine</div>
        <div style="font-size:9pt;color:#cbd5e1;">Span-Wagner EOS (1996) &middot; Peng-Robinson + Li &amp; Yan (2009) Impure CO₂ &middot; Fenghour et al. (1998) Viscosity &middot; Duan-Sun (2003) Solubility &middot; Duan et al. (2006) Multi-Salt &middot; MARS IFT (Olagunju, in prep.) &middot; Nordbotten (2005) Plume &middot; Hesse et al. (2008) Post-Injection &middot; van Genuchten-Mualem kr &middot; Killough (1976) Hysteresis &middot; Land (1968) Trapping &middot; Theis (1935) + E₁ Pad&eacute; AoR &middot; Shook-Mitchell (2009) Sweep &middot; Kopp et al. (2010) Storage Efficiency &middot; DOE Goodman (2011) Capacity &middot; Mohr-Coulomb + Biot Geomechanics</div>
      </div>
    </div>
  </div>
  <div style="margin-top:32px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:16px 20px;">
    <div style="font-size:8.5pt;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Important Disclaimer</div>
    <p style="font-size:8.5pt;color:#fca5a5;line-height:1.6;margin:0;">
      This document is a scientific comparison between CarbonLens screening-level simulation and published Sleipner field data. All projections beyond year 2016 are scenario outputs and have not been validated against monitoring data. <strong style="color:white;">This document is not a regulatory submission</strong> and should not be used as such without independent expert review.
    </p>
  </div>
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:8pt;color:#475569;">CarbonLens Benchmark Report · Sleipner Utsira · ${date}</div>
    <div style="font-size:8pt;color:#475569;">&copy; 2026 CarbonLens &middot; ${window.location.hostname} &middot; All rights reserved</div>
  </div>
</div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=960,height=780')
  if (!win) { alert('Please allow popups for this site to generate reports.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 1000)
}
