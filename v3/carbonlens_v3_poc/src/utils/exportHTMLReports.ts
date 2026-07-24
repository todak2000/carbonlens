import type { FormationParams, SimulationResult, Well } from '../types'
import type { GeomechanicsResult } from '../types'
import type { OptimizationResult } from '../engine/historyMatching/types'
import type { PersistedMCResult } from '../store/mcStore'
import { computeAoRRadius, computeAoRRadiusTwoPhase } from './computePressureField'
import { defaultWellDesign, type WellDesign } from '../types/wellDesign'
import { generateWellboreSVGString } from '../components/WellboreSchematic'
import { computeYearly, computeGeomechanicsResult } from '../hooks/useSimulation'
import { wellRateAtTime } from './gridParser'
import { useUIStore } from '../store/uiStore'
import { renderSimEngineAttribution, renderProvenanceTableRows } from '../data/modelRegistry'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&display=swap');

@page { size: A4; margin: 10mm 10mm 10mm 10mm; }
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

.bar-track { background: #e2e8f0; border-radius: 4px; height: 8px; margin: 4px 0; overflow: hidden; }

.section-box {
  border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 10px 12px; margin: 8px 0;
  background: #f8fafc; page-break-inside: avoid;
}
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }

.accent { color: #00c4a0; font-weight: 600; }
.muted { color: #64748b; font-size: 8.8pt; }

footer {
  margin-top: 22px; padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  font-size: 7.5pt; color: #94a3b8;
  display: flex; justify-content: space-between;
  font-family: 'IBM Plex Sans', sans-serif;
}

.page-break { page-break-before: always; }
.no-break { page-break-inside: avoid; }

.page-header-bar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 4px;
}
.page-header-rule {
  height: 2px;
  background: linear-gradient(90deg, #00c4a0, #3b82f6, #00c4a0);
  border-radius: 2px; margin-bottom: 14px;
}

.cover { min-height: 240px; display: flex; flex-direction: column; justify-content: center; }
.cover-bar { background: linear-gradient(135deg, #0d1f3c 0%, #1e3a5f 100%); color: white; padding: 28px 32px; border-radius: 10px; margin-bottom: 20px; }
.risk-low     { color: #065f46; font-weight: 600; }
.risk-moderate{ color: #92400e; font-weight: 600; }
.risk-high    { color: #991b1b; font-weight: 600; }
.checklist-item { padding: 5px 0; border-bottom: 1px solid #f1f5f9; display: flex; align-items: flex-start; gap: 8px; font-size: 9pt; }
.check-yes { color: #065f46; font-weight: 700; }
.check-no  { color: #64748b; }
ol.numbered { padding-left: 18px; }
ol.numbered li { margin: 6px 0; font-size: 9pt; }
`

// ---------------------------------------------------------------------------
// Snapshot selection — pick exactly 10 evenly-spaced frames from projectYears
// ---------------------------------------------------------------------------
function selectTenSnapshots(
  snapshots: Array<{year: number; dataUrl: string}>,
  projectYears: number,
): Array<{year: number; dataUrl: string}> {
  if (!snapshots || snapshots.length === 0) return []
  if (snapshots.length <= 10) return snapshots
  const count = 10
  const step = projectYears / count
  const targets = Array.from({ length: count }, (_, i) => Math.round((i + 1) * step))
  const seen = new Set<number>()
  return targets
    .map((t) => snapshots.reduce((best, s) =>
      Math.abs(s.year - t) < Math.abs(best.year - t) ? s : best,
    ))
    .filter((s) => { if (seen.has(s.year)) return false; seen.add(s.year); return true })
}

function generatePressureRateChartSVG(
  params: FormationParams,
  wells: Well[],
  geomechanics: GeomechanicsResult | null,
  projectYears?: number,
): string {
  const numYears = projectYears || 20
  const profile: Array<{ year: number; pressure: number; rate: number }> = []

  let prevSim: any = null
  for (let y = 0; y <= numYears; y++) {
    const sim = computeYearly(params, y, numYears, prevSim)
    const totalRate = wells.reduce(
      (s, w) => s + wellRateAtTime(w.injectionRate, y, w.rampUpYears, w.rampDownYears, numYears),
      0
    )
    profile.push({
      year: y,
      pressure: sim.injectionPressure,
      rate: totalRate,
    })
    prevSim = sim
  }

  const geo = geomechanics || computeGeomechanicsResult(params, wells, prevSim)
  const fracP = geo.fracturePressure
  const maipVal = geo.maip

  // Find min/max for scaling
  const maxP = Math.max(fracP, ...profile.map((p) => p.pressure))
  const minP = Math.min(params.pressure, ...profile.map((p) => p.pressure))
  const maxRate = Math.max(0.1, ...profile.map((p) => p.rate))

  // SVG parameters
  const w = 550
  const h = 220
  const padL = 45
  const padR = 45
  const padT = 25
  const padB = 35

  const graphW = w - padL - padR
  const graphH = h - padT - padB

  // Scaling helpers
  const getX = (year: number) => padL + (year / numYears) * graphW
  const getY_P = (press: number) => {
    const range = maxP - minP || 1
    return padT + graphH - ((press - minP) / range) * graphH
  }
  const getY_R = (rate: number) => {
    return padT + graphH - (rate / maxRate) * graphH
  }

  // Generate SVG elements
  const gridLines: string[] = []
  const xTicks = Math.min(10, numYears)
  for (let i = 0; i <= xTicks; i++) {
    const yr = Math.round((i / xTicks) * numYears)
    const x = getX(yr)
    gridLines.push(`
      <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + graphH}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="2 3"/>
      <text x="${x}" y="${padT + graphH + 15}" font-size="7pt" fill="#64748b" text-anchor="middle">Yr ${yr}</text>
    `)
  }

  const yTicksCount = 5
  for (let i = 0; i <= yTicksCount; i++) {
    const frac = i / yTicksCount
    const pVal = minP + frac * (maxP - minP)
    const rVal = frac * maxRate
    const y = padT + graphH - frac * graphH
    gridLines.push(`
      <line x1="${padL}" y1="${y}" x2="${padL + graphW}" y2="${y}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="2 3"/>
      <text x="${padL - 8}" y="${y + 3}" font-size="7pt" fill="#1e40af" text-anchor="end">${pVal.toFixed(1)}</text>
      <text x="${padL + graphW + 8}" y="${y + 3}" font-size="7pt" fill="#0d9488" text-anchor="start">${rVal.toFixed(2)}</text>
    `)
  }

  // Draw Rate line/area
  let ratePoints = ''
  let rateAreaPoints = `${getX(0)},${padT + graphH} `
  profile.forEach((pt) => {
    ratePoints += `${getX(pt.year)},${getY_R(pt.rate)} `
    rateAreaPoints += `${getX(pt.year)},${getY_R(pt.rate)} `
  })
  rateAreaPoints += `${getX(numYears)},${padT + graphH}`

  // Draw Pressure line
  let pressPoints = ''
  profile.forEach((pt) => {
    pressPoints += `${getX(pt.year)},${getY_P(pt.pressure)} `
  })

  // Fracture and MAIP lines
  const fracY = getY_P(fracP)
  const maipY = getY_P(maipVal)

  return `
  <div style="page-break-inside:avoid; margin: 15px 0;">
    <p style="font-size:8.5pt; color:#64748b; font-weight:600; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.06em;">Injection Pressure &amp; Flow Rate Profile</p>
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-family:sans-serif;">
      <!-- Background Grid & Labels -->
      ${gridLines.join('')}

      <!-- Left Axis Title (Pressure) -->
      <text x="${padL - 8}" y="${padT - 10}" font-size="7pt" font-weight="700" fill="#1e40af" text-anchor="end">Pressure (MPa)</text>
      <!-- Right Axis Title (Rate) -->
      <text x="${padL + graphW + 8}" y="${padT - 10}" font-size="7pt" font-weight="700" fill="#0d9488" text-anchor="start">Rate (Mt/yr)</text>

      <!-- Rate Area & Line -->
      <polygon points="${rateAreaPoints}" fill="rgba(13,148,136,0.08)"/>
      <polyline points="${ratePoints}" fill="none" stroke="#0d9488" stroke-width="2"/>

      <!-- Pressure Line -->
      <polyline points="${pressPoints}" fill="none" stroke="#1e40af" stroke-width="2.5"/>

      <!-- Fracture Pressure Line -->
      <line x1="${padL}" y1="${fracY}" x2="${padL + graphW}" y2="${fracY}" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="4 4"/>
      <text x="${padL + 10}" y="${fracY - 4}" font-size="6.5pt" font-weight="700" fill="#ef4444">Fracture Limit (${fracP.toFixed(1)} MPa)</text>

      <!-- MAIP Line -->
      <line x1="${padL}" y1="${maipY}" x2="${padL + graphW}" y2="${maipY}" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="3 3"/>
      <text x="${padL + 10}" y="${maipY - 4}" font-size="6.5pt" font-weight="700" fill="#d97706">MAIP (${maipVal.toFixed(1)} MPa)</text>

      <!-- Legend -->
      <g transform="translate(${padL + 10}, ${padT + 12})">
        <!-- Pressure Legend -->
        <rect x="0" y="0" width="8" height="8" fill="#1e40af" rx="1"/>
        <text x="12" y="7" font-size="7pt" fill="#1e293b">Injection pressure (BHP)</text>

        <!-- Rate Legend -->
        <rect x="130" y="0" width="8" height="8" fill="#0d9488" rx="1"/>
        <text x="142" y="7" font-size="7pt" fill="#1e293b">Total injection rate</text>
      </g>
    </svg>
  </div>
  `
}

function generateEconomicsNPVChartSVG(
  params: FormationParams,
  wells: Well[],
  result: SimulationResult | null,
  projectYears?: number,
  jurisdictionOverride?: string,
): string {
  const numYears = projectYears || 20
  const nWells = Math.max(1, wells.length)
  const totalStored = result?.storageCapacity ?? 0
  const yearlyRate = totalStored > 0 ? totalStored / Math.max(1, numYears) : wells.reduce((s, w) => s + w.injectionRate, 0)

  // CAPEX & OPEX formulas from EconomicsPanel.tsx
  const drillCost = nWells * (5 + params.depth * 0.006)
  const facilityCost = nWells * 3 + 2
  const pipelineCost = Math.sqrt(params.area) * 0.8 + 1
  const monitoringCost = Math.sqrt(params.area) * 0.15 + 0.5
  const capex = drillCost + facilityCost + pipelineCost + monitoringCost

  const opexPerTonne = 1.5 + nWells * 0.2 + params.depth * 0.0005

  // Use override if provided (from formation preset), fall back to UIStore
  const jurisdiction = jurisdictionOverride ?? useUIStore.getState().jurisdiction ?? 'US'
  const credit45q = jurisdiction === 'US' ? 85
    : jurisdiction === 'EU' ? 60
    : (jurisdiction === 'AU' || jurisdiction === 'Australia') ? 45
    : (jurisdiction === 'UK') ? 60
    : jurisdiction === 'Norway' ? 70
    : jurisdiction === 'CA' ? 48
    : jurisdiction === 'MY' || jurisdiction === 'MY_SAR' ? 25
    : jurisdiction === 'NG' ? 15
    : jurisdiction === 'ID' ? 20
    : jurisdiction === 'EG' ? 10
    : jurisdiction === 'AE' ? 15
    : jurisdiction === 'DZ' ? 5
    : 0
  // Local-currency display label — CA TIER is priced in CAD; all others used as USD equivalents
  const carbonPriceDisplay = jurisdiction === 'US' ? `USD ${credit45q}/t (45Q tax credit)`
    : jurisdiction === 'EU' ? `EUR ${credit45q}/t (EU ETS)`
    : jurisdiction === 'UK' ? `GBP ${credit45q}/t (UK ETS)`
    : (jurisdiction === 'AU' || jurisdiction === 'Australia') ? `AUD ${credit45q}/t`
    : jurisdiction === 'Norway' ? `NOK ${credit45q}/t (CO₂ tax)`
    : jurisdiction === 'CA' ? `CAD 65/t (≈ USD ${credit45q}/t, Alberta TIER 2024)`
    : (jurisdiction === 'MY' || jurisdiction === 'MY_SAR') ? `MYR ${credit45q}/t`
    : `USD ${credit45q}/t`
  const carbonPrice = Math.max(credit45q, 10)
  const discountRate = 0.08

  // Compute NPV profiles
  const profile: Array<{ year: number; cumNPV: number; cumNPVWithCredit: number }> = [
    { year: 0, cumNPV: -capex, cumNPVWithCredit: -capex }
  ]

  let runningNPV = -capex
  let runningNPVWithCredit = -capex

  for (let y = 1; y <= numYears; y++) {
    const rev = carbonPrice * yearlyRate
    const revWithCredit = credit45q * yearlyRate
    const op = opexPerTonne * yearlyRate

    runningNPV += (rev - op) / Math.pow(1 + discountRate, y)
    runningNPVWithCredit += (revWithCredit - op) / Math.pow(1 + discountRate, y)

    profile.push({
      year: y,
      cumNPV: runningNPV,
      cumNPVWithCredit: runningNPVWithCredit,
    })
  }

  // Find bounds for plotting
  const allVals = profile.flatMap(p => [p.cumNPV, p.cumNPVWithCredit])
  const maxVal = Math.max(10, ...allVals)
  const minVal = Math.min(-capex, ...allVals)

  // SVG parameters
  const w = 550
  const h = 220
  const padL = 45
  const padR = 15
  const padT = 25
  const padB = 35

  const graphW = w - padL - padR
  const graphH = h - padT - padB

  // Scaling helpers
  const getX = (year: number) => padL + (year / numYears) * graphW
  const getY = (val: number) => {
    const range = maxVal - minVal || 1
    return padT + graphH - ((val - minVal) / range) * graphH
  }

  // Generate grid & ticks
  const gridLines: string[] = []
  const xTicks = Math.min(10, numYears)
  for (let i = 0; i <= xTicks; i++) {
    const yr = Math.round((i / xTicks) * numYears)
    const x = getX(yr)
    gridLines.push(`
      <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + graphH}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="2 3"/>
      <text x="${x}" y="${padT + graphH + 15}" font-size="7pt" fill="#64748b" text-anchor="middle">Yr ${yr}</text>
    `)
  }

  const yTicksCount = 5
  for (let i = 0; i <= yTicksCount; i++) {
    const frac = i / yTicksCount
    const val = minVal + frac * (maxVal - minVal)
    const y = padT + graphH - frac * graphH
    gridLines.push(`
      <line x1="${padL}" y1="${y}" x2="${padL + graphW}" y2="${y}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="2 3"/>
      <text x="${padL - 8}" y="${y + 3}" font-size="7pt" fill="#475569" text-anchor="end">$${val.toFixed(1)}M</text>
    `)
  }

  // Draw lines
  let npvPoints = ''
  let npvCreditPoints = ''
  profile.forEach((pt) => {
    npvPoints += `${getX(pt.year)},${getY(pt.cumNPV)} `
    npvCreditPoints += `${getX(pt.year)},${getY(pt.cumNPVWithCredit)} `
  })

  const zeroY = getY(0)

  return `
  <div style="page-break-inside:avoid; margin: 15px 0;">
    <p style="font-size:8.5pt; color:#64748b; font-weight:600; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.06em;">Project Cumulative Net Present Value (NPV) Profile</p>
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-family:sans-serif;">
      <!-- Grid Lines -->
      ${gridLines.join('')}

      <!-- Zero Line -->
      <line x1="${padL}" y1="${zeroY}" x2="${padL + graphW}" y2="${zeroY}" stroke="#94a3b8" stroke-width="1.2"/>
      <text x="${padL + graphW - 5}" y="${zeroY - 4}" font-size="6pt" fill="#94a3b8" text-anchor="end">Breakeven Line ($0M)</text>

      <!-- NPV (no credits) Line -->
      <polyline points="${npvPoints}" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="3 3"/>

      <!-- NPV (with credits) Line -->
      <polyline points="${npvCreditPoints}" fill="none" stroke="#22c55e" stroke-width="2.5"/>

      <!-- Title/Legend -->
      <g transform="translate(${padL + 10}, ${padT + 12})">
        <!-- NPV with Credit Legend -->
        <rect x="0" y="0" width="8" height="8" fill="#22c55e" rx="1"/>
        <text x="12" y="7" font-size="7pt" fill="#1e293b">NPV with ${jurisdiction} credits ($${runningNPVWithCredit.toFixed(1)}M)</text>

        <!-- NPV without Credit Legend -->
        <rect x="180" y="0" width="8" height="8" fill="#64748b" rx="1"/>
        <text x="192" y="7" font-size="7pt" fill="#1e293b">NPV (no credits/incentive) ($${runningNPV.toFixed(1)}M)</text>
      </g>
    </svg>
  </div>
  `
}

function generateSensitivityTornadoSVG(
  params: FormationParams,
  result: SimulationResult | null,
  mcResult?: PersistedMCResult,
): string {
  const p50 = mcResult?.p50_Mt ?? result?.p50 ?? 0
  if (p50 <= 0) {
    return `<div style="padding:10px; border:1px dashed #cbd5e1; border-radius:6px; color:#64748b; font-size:8.5pt;">Run simulation to view sensitivity tornado chart.</div>`
  }

  // Use actual MC config uncertainty values if available, otherwise fall back to fixed defaults.
  // This prevents axis labels from leaking a prior formation's cached parameter bands.
  const areaPct   = mcResult?.areaUncertPct   ?? 20
  const thickPct  = mcResult?.thickUncertPct  ?? 15
  // porosity uncertainty is stored as absolute (e.g. 0.03) — convert to % of base porosity
  const poroAbsUncert = mcResult?.poroUncertAbs ?? 0.03
  const poroPct   = params.porosity > 0 ? Math.round((poroAbsUncert / params.porosity) * 100) : 15
  const permPct   = mcResult?.permUncertPct   ?? 30

  // P10/P90 from MC run are the authoritative bar endpoints; fall back to linear scaling
  const p10 = mcResult?.p10_Mt ?? p50 * (1 - areaPct / 100)
  const p90 = mcResult?.p90_Mt ?? p50 * (1 + areaPct / 100)

  const sensitivityData = [
    { label: `Area (±${areaPct}%)`,      negPct: -areaPct,  posPct: areaPct,  colorNeg: '#ef4444', colorPos: '#22c55e', valNeg: p50 * (1 - areaPct/100),  valPos: p50 * (1 + areaPct/100) },
    { label: `Thickness (±${thickPct}%)`, negPct: -thickPct, posPct: thickPct, colorNeg: '#ef4444', colorPos: '#22c55e', valNeg: p50 * (1 - thickPct/100), valPos: p50 * (1 + thickPct/100) },
    { label: `Porosity (±${poroPct}%)`,   negPct: -poroPct,  posPct: poroPct,  colorNeg: '#ef4444', colorPos: '#22c55e', valNeg: p10, valPos: p90 },
    { label: `Permeability (±${permPct}%)`, negPct: -Math.min(permPct, 40), posPct: Math.min(permPct, 40), colorNeg: '#f87171', colorPos: '#4ade80', valNeg: p50 * (1 - Math.min(permPct,40)/100), valPos: p50 * (1 + Math.min(permPct,40)/100) },
  ]

  const w = 550
  const h = 160
  const padL = 120
  const padR = 40
  const padT = 30
  const padB = 25
  const graphW = w - padL - padR
  const graphH = h - padT - padB

  const midX = padL + graphW / 2

  // Mapping function — axis spans ±axisMax% derived from the widest sensitivity bar
  const maxAbsPct = Math.max(...sensitivityData.map(d => Math.max(Math.abs(d.negPct), Math.abs(d.posPct))))
  const axisMax = Math.ceil(maxAbsPct / 5) * 5  // round up to nearest 5% (e.g. 20% → 20, 22% → 25)
  const getX = (pct: number) => {
    const scale = graphW / (axisMax * 2) // total span = axisMax × 2
    return midX + pct * scale
  }

  // Generate grid ticks based on dynamic axisMax
  const ticks: string[] = []
  for (let val = -axisMax; val <= axisMax; val += 5) {
    const x = getX(val)
    ticks.push(`
      <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + graphH}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="2 2"/>
      <text x="${x}" y="${padT + graphH + 12}" font-size="7pt" fill="#64748b" text-anchor="middle">${val > 0 ? '+' : ''}${val}%</text>
    `)
  }

  const rowHeight = graphH / sensitivityData.length
  const bars: string[] = []

  sensitivityData.forEach((row, idx) => {
    const yCenter = padT + idx * rowHeight + rowHeight / 2
    const barH = 14

    const xNeg = getX(row.negPct)
    const xPos = getX(row.posPct)

    // Left bar (negative change)
    bars.push(`
      <rect x="${xNeg}" y="${yCenter - barH / 2}" width="${midX - xNeg}" height="${barH}" fill="${row.colorNeg}" rx="2"/>
      <text x="${xNeg - 5}" y="${yCenter + 3}" font-size="7pt" fill="#475569" text-anchor="end">${row.valNeg.toFixed(1)} Mt</text>
    `)

    // Right bar (positive change)
    bars.push(`
      <rect x="${midX}" y="${yCenter - barH / 2}" width="${xPos - midX}" height="${barH}" fill="${row.colorPos}" rx="2"/>
      <text x="${xPos + 5}" y="${yCenter + 3}" font-size="7pt" fill="#475569" text-anchor="start">${row.valPos.toFixed(1)} Mt</text>
    `)

    // Parameter label
    bars.push(`
      <text x="${padL - 30}" y="${yCenter + 3}" font-size="8pt" font-weight="600" fill="#1e293b" text-anchor="end">${row.label}</text>
    `)
  })

  return `
  <div style="page-break-inside:avoid; margin: 15px 0;">
    <p style="font-size:8.5pt; color:#64748b; font-weight:600; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.06em;">P50 Capacity Sensitivity Tornado Chart (Base: ${p50.toFixed(1)} Mt)</p>
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-family:sans-serif;">
      <!-- Grid Ticks -->
      ${ticks.join('')}

      <!-- Center Axis (0% change) -->
      <line x1="${midX}" y1="${padT - 5}" x2="${midX}" y2="${padT + graphH + 5}" stroke="#475569" stroke-width="1.2"/>
      <text x="${midX}" y="${padT - 10}" font-size="7.5pt" font-weight="700" fill="#475569" text-anchor="middle">Baseline (P50)</text>

      <!-- Bars and Labels -->
      ${bars.join('')}
    </svg>
  </div>
  `
}

function buildCertificateBadge(opts: {
  assetId: string
  formationName: string
  storedMt: number
  safetyFactor: number | null
  containmentPct: number
  jurisdiction: string
  dateStr: string
}): string {
  const verifyUrl = `${window.location.origin}/registry/verify/${opts.assetId}`
  const isVerified = opts.containmentPct >= 85 && (opts.safetyFactor ?? 0) >= 1.2
  const statusLabel = isVerified ? 'VERIFIED' : 'PENDING REVIEW'
  const statusColor = isVerified ? '#00c4a0' : '#f59e0b'
  const statusBg = isVerified ? 'rgba(0,196,160,0.12)' : 'rgba(245,158,11,0.12)'

  // Simple SVG QR-code placeholder (grid pattern)
  const qrSize = 64
  const qrCells = 7
  const cellSize = qrSize / qrCells
  const qrPattern = [
    [1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],[1,0,1,0,1,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]
  ]
  const qrCells2 = qrPattern.flatMap((row, r) =>
    row.map((cell, c) => cell ? `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize - 0.5}" height="${cellSize - 0.5}" fill="#0d1f3c" rx="0.5"/>` : '')
  ).join('')

  return `
  <div style="margin:16px 0;padding:16px 18px;background:${statusBg};border:1.5px solid ${statusColor};border-radius:10px;display:flex;gap:18px;align-items:center;page-break-inside:avoid;">
    <!-- QR code placeholder -->
    <div style="flex-shrink:0;">
      <svg width="${qrSize}" height="${qrSize}" viewBox="0 0 ${qrSize} ${qrSize}" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc;border-radius:4px;padding:2px;">
        ${qrCells2}
      </svg>
    </div>
    <!-- Certificate content -->
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:8pt;font-weight:700;color:${statusColor};font-family:'IBM Plex Mono',monospace;letter-spacing:0.1em;text-transform:uppercase;">&#x2714; Digital Twin Registry &mdash; ${statusLabel}</span>
      </div>
      <div style="font-size:9pt;font-weight:700;color:#0d1f3c;margin-bottom:4px;">${opts.formationName} CO&#x2082; Geological Storage Certificate</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:6px;">
        <div><span style="font-size:7.5pt;color:#64748b;">Asset ID: </span><span style="font-size:7.5pt;font-family:'IBM Plex Mono',monospace;color:#0d1f3c;font-weight:600;">${opts.assetId}</span></div>
        <div><span style="font-size:7.5pt;color:#64748b;">Stored: </span><span style="font-size:7.5pt;font-family:'IBM Plex Mono',monospace;color:#0d1f3c;font-weight:600;">${opts.storedMt.toFixed(2)} Mt CO&#x2082;</span></div>
        <div><span style="font-size:7.5pt;color:#64748b;">Containment: </span><span style="font-size:7.5pt;font-family:'IBM Plex Mono',monospace;color:${opts.containmentPct >= 85 ? '#00c4a0' : '#f59e0b'};font-weight:600;">${opts.containmentPct.toFixed(0)}%</span></div>
        ${opts.safetyFactor != null ? `<div><span style="font-size:7.5pt;color:#64748b;">Safety Factor: </span><span style="font-size:7.5pt;font-family:'IBM Plex Mono',monospace;color:${opts.safetyFactor >= 1.5 ? '#00c4a0' : '#f59e0b'};font-weight:600;">${opts.safetyFactor.toFixed(3)}</span></div>` : ''}
        <div><span style="font-size:7.5pt;color:#64748b;">Jurisdiction: </span><span style="font-size:7.5pt;font-family:'IBM Plex Mono',monospace;color:#0d1f3c;font-weight:600;">${opts.jurisdiction}</span></div>
      </div>
      <div style="font-size:7pt;color:#64748b;word-break:break-all;">
        <span style="color:#475569;">Share: </span>
        <span style="font-family:'IBM Plex Mono',monospace;color:#3b82f6;">${verifyUrl}</span>
        <span style="margin-left:8px;color:#94a3b8;">&mdash; Issued ${opts.dateStr} by CarbonLens Studio v3</span>
      </div>
    </div>
  </div>
  `
}

function buildHMCalibrationCard(hmResult: OptimizationResult): string {
  const rmse = hmResult.bestMisfit ?? 0
  const quality = rmse < 0.05 ? 'Excellent' : rmse < 0.15 ? 'Good' : rmse < 0.30 ? 'Acceptable' : 'Poor'
  const qualityColor = rmse < 0.05 ? '#00c4a0' : rmse < 0.15 ? '#22c55e' : rmse < 0.30 ? '#f59e0b' : '#ef4444'
  return `
  <div style="margin:10px 0;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;page-break-inside:avoid;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:8pt;font-weight:700;color:#166534;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:0.08em;">&#x1F4CC; History Match Calibration Record</span>
      <span style="font-size:7.5pt;font-weight:700;color:${qualityColor};background:rgba(0,0,0,0.06);padding:2px 8px;border-radius:10px;">${quality.toUpperCase()} FIT</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:8pt;">
      <div><span style="color:#64748b;">Algorithm:</span><br><strong style="color:#0d1f3c;">Nelder-Mead Simplex</strong></div>
      <div><span style="color:#64748b;">Converged:</span><br><strong style="color:${hmResult.converged ? '#00c4a0' : '#f59e0b'};">${hmResult.converged ? 'Yes ✓' : 'No (max iter)'}</strong></div>
      <div><span style="color:#64748b;">Iterations:</span><br><strong style="color:#0d1f3c;">${hmResult.iterations}</strong></div>
      <div><span style="color:#64748b;">RMSE Misfit:</span><br><strong style="color:${qualityColor};">${rmse.toFixed(4)}</strong></div>
      <div><span style="color:#64748b;">Permeability:</span><br><strong style="color:#0d1f3c;">${hmResult.bestFit.permeability.toFixed(0)} mD</strong></div>
      <div><span style="color:#64748b;">Porosity:</span><br><strong style="color:#0d1f3c;">${(hmResult.bestFit.porosity * 100).toFixed(1)}%</strong></div>
    </div>
    <p style="font-size:7.5pt;color:#64748b;margin-top:6px;border-top:1px solid #bbf7d0;padding-top:6px;">Calibrated against Sleipner Utsira Formation analogue observations (Boait 2012, Furre 2017). Calibrated parameters represent effective reservoir behaviour; raw rock properties may differ from core measurements.</p>
  </div>
  `
}

function buildMCUncertaintyCard(mc: PersistedMCResult): string {
  const spread = mc.p10_Mt > 0 ? mc.p90_Mt / mc.p10_Mt : 0
  const spreadLabel = spread < 2 ? 'Low — well-constrained' : spread < 5 ? 'Moderate — typical for appraisal' : 'High — further characterisation needed'
  const spreadColor = spread < 2 ? '#00c4a0' : spread < 5 ? '#f59e0b' : '#ef4444'
  return `
  <div style="margin:10px 0;padding:12px 14px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;page-break-inside:avoid;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-size:8pt;font-weight:700;color:#92400e;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:0.08em;">&#x1F3B2; Monte Carlo Probabilistic Bounds</span>
      <span style="font-size:7.5pt;color:#64748b;">${mc.realizations} LHS realizations &bull; ${mc.formationName}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-size:8pt;margin-bottom:8px;">
      <div style="text-align:center;background:rgba(239,68,68,0.08);border-radius:6px;padding:6px 4px;">
        <div style="font-size:7pt;color:#64748b;">P10 (Conservative)</div>
        <div style="font-size:11pt;font-weight:700;color:#ef4444;">${mc.p10_Mt.toFixed(2)}</div>
        <div style="font-size:7pt;color:#64748b;">Mt CO₂</div>
      </div>
      <div style="text-align:center;background:rgba(0,196,160,0.08);border-radius:6px;padding:6px 4px;border:1px solid rgba(0,196,160,0.3);">
        <div style="font-size:7pt;color:#64748b;">P50 (Expected)</div>
        <div style="font-size:11pt;font-weight:700;color:#00c4a0;">${mc.p50_Mt.toFixed(2)}</div>
        <div style="font-size:7pt;color:#64748b;">Mt CO₂</div>
      </div>
      <div style="text-align:center;background:rgba(34,197,94,0.08);border-radius:6px;padding:6px 4px;">
        <div style="font-size:7pt;color:#64748b;">P90 (Optimistic)</div>
        <div style="font-size:11pt;font-weight:700;color:#22c55e;">${mc.p90_Mt.toFixed(2)}</div>
        <div style="font-size:7pt;color:#64748b;">Mt CO₂</div>
      </div>
      <div style="text-align:center;background:rgba(59,130,246,0.08);border-radius:6px;padding:6px 4px;">
        <div style="font-size:7pt;color:#64748b;">P90/P10 Spread</div>
        <div style="font-size:11pt;font-weight:700;color:#3b82f6;">${spread.toFixed(1)}×</div>
        <div style="font-size:7pt;color:#64748b;">ratio</div>
      </div>
      <div style="text-align:center;background:rgba(99,102,241,0.08);border-radius:6px;padding:6px 4px;">
        <div style="font-size:7pt;color:#64748b;">Peak ΔP P50</div>
        <div style="font-size:11pt;font-weight:700;color:#6366f1;">${mc.p50_P.toFixed(2)}</div>
        <div style="font-size:7pt;color:#64748b;">MPa</div>
      </div>
    </div>
    <p style="font-size:7.5pt;color:${spreadColor};font-weight:600;margin:0;">Uncertainty assessment: ${spreadLabel}</p>
    <p style="font-size:7.5pt;color:#64748b;margin-top:2px;">Sampled: permeability ±${mc.permUncertPct}%, porosity ±${(mc.poroUncertAbs * 100).toFixed(1)}%, area ±${mc.areaUncertPct}%, thickness ±${mc.thickUncertPct}%. DOE Goodman (2011) volumetric method.</p>
  </div>
  `
}

function buildCoverPage(opts: {
  reportType: 'executive' | 'permit'
  title: string
  subtitle: string
  formationName: string
  formationLocation: string
  organization: string
  preparedBy: string
  dateStr: string
  referenceId: string
  jurisdiction?: string
}): string {
  const typeLabel = opts.reportType === 'executive' ? 'EXECUTIVE SUMMARY' : 'REGULATORY PRE-APPLICATION'
  return `
  <div style="min-height:100vh;background:linear-gradient(160deg,#040f1e 0%,#0b2240 45%,#071a30 100%);display:flex;flex-direction:column;padding:52px 40px 40px;color:white;page-break-after:always;box-sizing:border-box;">
    <!-- Logo -->
    <div style="margin-bottom:auto;">${LOGO_SVG_WHITE}</div>

    <!-- Centre content -->
    <div style="margin:auto 0;padding:40px 0;">
      <div style="display:inline-block;background:rgba(0,196,160,0.12);border:1px solid rgba(0,196,160,0.45);border-radius:4px;padding:4px 14px;margin-bottom:22px;">
        <span style="font-size:8pt;color:#00c4a0;font-family:'IBM Plex Mono',monospace;letter-spacing:0.14em;text-transform:uppercase;">${typeLabel}</span>
      </div>
      <h1 style="color:white;font-size:30pt;font-weight:800;line-height:1.12;margin:0 0 12px;letter-spacing:-0.5px;">${opts.title}</h1>
      <p style="color:#7dd3fc;font-size:13pt;margin:0 0 32px;font-weight:300;">${opts.subtitle}</p>
      <div style="height:3px;background:linear-gradient(90deg,#00c4a0,#3b82f6);border-radius:2px;width:100px;margin-bottom:32px;"></div>
      <div style="display:flex;gap:40px;flex-wrap:wrap;">
        <div>
          <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:5px;">Formation</div>
          <div style="color:white;font-size:12pt;font-weight:600;">${opts.formationName}</div>
        </div>
        <div>
          <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:5px;">Location</div>
          <div style="color:white;font-size:12pt;font-weight:600;">${opts.formationLocation}</div>
        </div>
        ${opts.jurisdiction ? '<div><div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:5px;">Jurisdiction</div><div style="color:#00c4a0;font-size:12pt;font-weight:600;">' + opts.jurisdiction + '</div></div>' : ''}
      </div>
    </div>

    <!-- Bottom meta strip -->
    <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:28px;margin-top:auto;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:20px;">
        <div>
          <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Prepared For</div>
          <div style="font-size:11pt;font-weight:700;color:white;">${opts.organization || 'Not specified'}</div>
          <div style="font-size:8pt;color:#64748b;margin-top:2px;">Applicant / Client</div>
        </div>
        <div>
          <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Prepared By</div>
          <div style="font-size:11pt;font-weight:700;color:white;">${opts.preparedBy}</div>
          <div style="font-size:8pt;color:#64748b;margin-top:2px;">CarbonLens Simulation Studio v3</div>
        </div>
        <div>
          <div style="font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Date Issued</div>
          <div style="font-size:11pt;font-weight:700;color:white;">${opts.dateStr}</div>
          <div style="font-size:8pt;color:#64748b;margin-top:2px;">Ref: ${opts.referenceId}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);padding:3px 12px;border-radius:12px;font-size:7.5pt;font-weight:700;">PRELIMINARY SCREENING</span>
        <span style="font-size:7.5pt;color:#475569;">Not for regulatory submission · Independent review required</span>
      </div>
    </div>
  </div>
  `
}

function buildBackPage(opts: {
  organization: string
  preparedBy: string
  dateStr: string
}): string {
  return `
  <div style="min-height:100vh;background:linear-gradient(160deg,#051931 0%,#0d2a4a 50%,#051931 100%);display:flex;flex-direction:column;padding:52px 40px 40px;page-break-before:always;page:back-cover;color:white;">
    <div style="margin-bottom:40px;">${LOGO_SVG_WHITE}</div>

    <div style="flex:1;display:grid;gap:40px;align-content:start;">
      <div>
        <div style="height:3px;background:linear-gradient(90deg,#00c4a0,#0066cc);border-radius:2px;width:48px;margin-bottom:16px;"></div>
        <h2 style="color:white;font-size:14pt;font-weight:700;margin:0 0 12px;">About CarbonLens</h2>
        <p style="color:#94a3b8;font-size:9.5pt;line-height:1.7;margin:0 0 10px;">
          CarbonLens is a browser-based CO&#x2082; geological storage simulation studio, purpose-built for deep saline aquifer CCS screening. It delivers real-time plume simulation, geomechanical risk assessment, and regulatory permit preparation.
        </p>
        <p style="color:#94a3b8;font-size:9.5pt;line-height:1.7;margin:0 0 10px;">
          Developed as MSc research at Universiti Teknologi PETRONAS (UTP), Malaysia, in partnership with the CarbonLens product team.
        </p>
        <div style="padding:10px 14px;background:rgba(0,196,160,0.08);border-left:3px solid #00c4a0;border-radius:0 6px 6px 0;">
          <div style="font-size:8pt;color:#00c4a0;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Research Team</div>
          <div style="font-size:9pt;color:#cbd5e1;line-height:1.75;">
            <strong style="color:white;">Daniel T. Olagunju</strong> &mdash; Author, MSc Researcher, UTP Malaysia<br>
            <strong style="color:white;">Dr. Okorie Ekwe Agwu</strong> &mdash; Supervisor, UTP Malaysia<br>
            <strong style="color:white;">Dr. Berihun Negash Mamo</strong> &mdash; Advisor, UTP Malaysia
          </div>
        </div>
        <div style="margin-top:20px;padding:14px 16px;background:rgba(0,196,160,0.1);border-left:3px solid #00c4a0;border-radius:0 6px 6px 0;">
          <div style="font-size:8pt;color:#00c4a0;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Simulation Engine</div>
          <div style="font-size:9pt;color:#cbd5e1;">${renderSimEngineAttribution()}</div>
        </div>
      </div>

    </div>

    <div style="margin-top:32px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:16px 20px;">
      <div style="font-size:8.5pt;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Important Disclaimer</div>
      <p style="font-size:8.5pt;color:#fca5a5;line-height:1.6;margin:0;">
        This document is generated by CarbonLens Simulation Studio using scientific correlations and statistical methods. All capacity estimates are preliminary screening values. <strong style="color:white;">This document is NOT a formal regulatory permit application</strong> and has not been reviewed by a competent authority. Independent review by a qualified petroleum or environmental engineer is required before submission to any regulatory body. CarbonLens accepts no liability for decisions made based solely on this screening output.
      </p>
    </div>

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:8pt;color:#475569;">Prepared by ${opts.preparedBy} for ${opts.organization || 'Client'} &middot; ${opts.dateStr}</div>
      <div style="font-size:8pt;color:#475569;">&copy; 2026 CarbonLens &middot; ${window.location.hostname} &middot; All rights reserved</div>
    </div>
  </div>
  `
}

function buildEquationsPage(opts: {
  organization: string
  preparedBy: string
  dateStr: string
}): string {
  return `
  <div style="page-break-before:always; color:#1e293b; box-sizing:border-box;">
    <div class="page-header-bar">
      ${LOGO_SVG}
      <div style="text-align:right;">
        <div style="font-size:8.5pt;font-weight:700;color:#0d1f3c;font-family:'IBM Plex Sans',sans-serif;">Equation &amp; Model Reference</div>
        <div style="font-size:7.5pt;color:#64748b;font-family:'IBM Plex Mono',monospace;">${opts.dateStr}</div>
      </div>
    </div>
    <div class="page-header-rule"></div>
    <h2>Equation &amp; Model Reference</h2>
    <table style="width:100%;border-collapse:collapse;font-size:7.8pt;color:#334155;border-bottom:1px solid #e2e8f0;">
      <thead>
        <tr style="background:#0d1f3c;">
          <th style="padding:6px 10px;text-align:left;color:white;font-weight:700;border-bottom:1px solid #00c4a0;width:18%;">Module / Engine</th>
          <th style="padding:6px 10px;text-align:left;color:white;font-weight:700;border-bottom:1px solid #00c4a0;width:42%;">Equation / Correlation</th>
          <th style="padding:6px 10px;text-align:left;color:white;font-weight:700;border-bottom:1px solid #00c4a0;width:40%;">Reference</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">CO&#x2082; EOS (Primary)</td><td style="padding:5px 10px;font-family:monospace;">Span-Wagner (1996) 56-term Helmholtz EOS: &#x3C1;(P,T) = &#x3C1;<sub>c</sub> &middot; &#x3B4;(&#x3B1;<sub>r</sub>); accuracy &#xB1;0.05%</td><td style="padding:5px 10px;">Span &amp; Wagner (1996), J. Phys. Chem. Ref. Data 25(6):1509&ndash;1596</td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">CO&#x2082; EOS (Impure)</td><td style="padding:5px 10px;font-family:monospace;">Peng-Robinson mixing rules for impure CO&#x2082; streams (CH&#x2084;, N&#x2082;, H&#x2082;S, SO&#x2082;)</td><td style="padding:5px 10px;">Peng &amp; Robinson (1976), Ind. Eng. Chem. Fundam. 15(1):59&ndash;64; Li &amp; Yan (2009) binary k<sub>ij</sub></td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">CO&#x2082; Viscosity</td><td style="padding:5px 10px;font-family:monospace;">&#x3BC;(T,&#x3C1;) = &#x3BC;<sub>0</sub>(T) + &#x394;&#x3BC;(T,&#x3C1;); zero-density + excess; &#x3B5;/k=251.196 K</td><td style="padding:5px 10px;">Fenghour, Wakeham &amp; Vesovic (1998), J. Phys. Chem. Ref. Data 27(1):31&ndash;44. <em>Upgrade target: Laesecke &amp; Muzny (2017), JPCRD 46:013107 (NIST reference, ±0.5% vs ±5% in supercritical region).</em></td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">CO&#x2082; Solubility</td><td style="padding:5px 10px;font-family:monospace;">ln(y&#x2082; &middot; P) = &#x3BC;&#x2070;(T) + 2&#x3BB;(T,P) &middot; m + &#x3BE;(T,P) &middot; m&#xB2;; Pitzer ionic strength</td><td style="padding:5px 10px;">Duan &amp; Sun (2003), Chem. Geology 193:257&ndash;271</td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">CO&#x2082; Multi-Salt Solubility</td><td style="padding:5px 10px;font-family:monospace;">ln(xCO&#x2082;<sub>mix</sub>) = ln(xCO&#x2082;<sub>pure</sub>) + &#x3A3;&#x3BB;(T,P)&middot;m<sub>i</sub>; adds CaCl&#x2082;, MgCl&#x2082;, KCl ions</td><td style="padding:5px 10px;">Duan, Sun, Zhu &amp; Chou (2006), Marine Chemistry 98(2-4):131&ndash;139</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">CO&#x2082;-Brine IFT</td><td style="padding:5px 10px;font-family:monospace;">&#x3C3; = MARS(P, T, S); multivariate adaptive regression splines trained on experimental data</td><td style="padding:5px 10px;">Olagunju (in prep.), MSc UTP Malaysia; Chiquet et al. (2007), Energy Convers. Mgmt. 48:736</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Storage Capacity</td><td style="padding:5px 10px;font-family:monospace;">M = A &middot; h &middot; &#x3D5; &middot; &#x3C1;<sub>CO&#x2082;</sub> &middot; S<sub>g</sub> &middot; E<sub>eff</sub>; volumetric DOE methodology</td><td style="padding:5px 10px;">Goodman et al. (2011), Int. J. GHG Control 5(4):853&ndash;866; DOE (2010) Atlas</td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Residual Trapping</td><td style="padding:5px 10px;font-family:monospace;">S<sub>gr</sub> = S<sub>gi</sub> / (1 + C &middot; S<sub>gi</sub>) (Land, 1968); V<sub>r</sub> = &#x3D5; &middot; (1&#x2212;S<sub>wi</sub>) &middot; S<sub>gr</sub> &middot; A &middot; h &middot; &#x3C1;<sub>CO&#x2082;</sub></td><td style="padding:5px 10px;">Pentland et al. (2011), SPE-133798; Land (1968), Trans. AIME 243:149</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Solubility Trapping</td><td style="padding:5px 10px;font-family:monospace;">m<sub>diss</sub> = &#x3D5; &middot; S<sub>w</sub> &middot; &#x3C1;<sub>brine</sub> &middot; &#x3C7;<sub>CO&#x2082;</sub>(T,P,S) &middot; A &middot; h; aqueous dissolution</td><td style="padding:5px 10px;">Duan &amp; Sun (2003); Ennis-King &amp; Paterson (2005), SPE-88502</td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">VE Plume Migration</td><td style="padding:5px 10px;font-family:monospace;">&#x2202;(h<sub>g</sub>/B)/&#x2202;t + &#x2207;&middot;Q<sub>g</sub> = Q<sub>inj</sub>/B; vertical-equilibrium thin-lens approximation</td><td style="padding:5px 10px;">Nordbotten &amp; Celia (2006), Water Resour. Res. 42:W01207</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Pressure / AoR</td><td style="padding:5px 10px;font-family:monospace;">&#x394;P(r,t) = Q/(4&#x3C0;kh)[&#x3BC;<sub>b</sub>E<sub>1</sub>(r&#xB2;/4&#x3B1;<sub>b</sub>t) + (&#x3BC;<sub>eff</sub>&#x2212;&#x3BC;<sub>b</sub>)E<sub>1</sub>(R<sub>p</sub>&#xB2;/4&#x3B1;<sub>b</sub>t)]; two-phase composite; &#x3BC;<sub>b</sub>=brine, &#x3BC;<sub>eff</sub>=&#x3BC;<sub>CO&#x2082;</sub>/k<sub>r</sub></td><td style="padding:5px 10px;">Nordbotten, Celia &amp; Bachu (2005), Transp. Porous Media 58(3):339&ndash;360; Theis (1935) radial flow with E&#x2081; Pad&#xe9; approximation (stable for u &gt; 50); Hantush-Jacob leaky-aquifer extension not yet implemented</td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Rel. Permeability</td><td style="padding:5px 10px;font-family:monospace;">k<sub>rg</sub> = k&#x2070;<sub>rg</sub>&middot;(1&#x2212;S<sub>e</sub>)<sup>&#xBD;</sup>&middot;(1&#x2212;S<sub>e</sub><sup>1/m</sup>)<sup>2m</sup>; k<sub>rw</sub>=k&#x2070;<sub>rw</sub>&middot;S<sub>e</sub><sup>&#xBD;</sup>&middot;(1&#x2212;(1&#x2212;S<sub>e</sub><sup>1/m</sup>)<sup>m</sup>)&#xB2;; m=1&#x2212;1/n; + Killough&ndash;Land hysteresis</td><td style="padding:5px 10px;">van Genuchten (1980), Soil Sci. Soc. Am. J. 44:892; Mualem (1976), WRR 12:513; Krevor et al. (2012), WRR 48:W02514; Land (1968), Trans. AIME 243:149; Killough (1976), SPE J. 16(1):37</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Fracture Pressure</td><td style="padding:5px 10px;font-family:monospace;">P<sub>f</sub> = [&#x3BD;/(1&#x2212;&#x3BD;)](&#x3C3;<sub>v</sub>&#x2212;P<sub>h</sub>) + P<sub>h</sub> + T<sub>0</sub>; minimum horizontal stress criterion</td><td style="padding:5px 10px;">Hubbert &amp; Willis (1957), Trans. AIME 210:153&ndash;166</td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Mohr-Coulomb</td><td style="padding:5px 10px;font-family:monospace;">&#x3C4; = c + &#x3C3;<sub>n</sub>tan(&#x3D5;); SF = &#x3C4;<sub>strength</sub>/&#x3C4;<sub>drive</sub>; failure when SF &lt; 1</td><td style="padding:5px 10px;">Jaeger, Cook &amp; Zimmerman (2007), Fundamentals of Rock Mechanics, 4th ed.</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">MAIP</td><td style="padding:5px 10px;font-family:monospace;">MAIP = 0.9 &middot; P<sub>f</sub> &#x2212; P<sub>res</sub>; maximum allowable injection pressure</td><td style="padding:5px 10px;">Bachu et al. (2007), Int. J. GHG Control 1(4):374; EPA UIC Class VI §146.88</td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Surface Heave</td><td style="padding:5px 10px;font-family:monospace;">&#x3B4; &#x2248; (&#x394;P &middot; h) / E &middot; (1&#x2212;&#x3BD;&#xB2;) &middot; a; elastic nucleus-of-strain approximation</td><td style="padding:5px 10px;">Teatini et al. (2011), J. Geophys. Res. 116:B08204</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Area of Review</td><td style="padding:5px 10px;font-family:monospace;">r<sub>AoR</sub> = &#x221A;(4Kt/&#x3D5;&#x3BC;c<sub>t</sub>); pressure perturbation front &#x2265; 6.9 kPa threshold</td><td style="padding:5px 10px;">Chabora &amp; Benson (2009), GHGT-9; EPA Class VI UIC Program Guidance</td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Post-Injection Plume</td><td style="padding:5px 10px;font-family:monospace;">Hesse et al. (2008) gravity current: &#x2202;u/&#x2202;t + &#x2202;f(u)/&#x2202;x = 0; f(u) = u(1&#x2212;u)/[u(M&#x2212;1)+1]; two propagating shocks: leading (mobile) and trailing (residual trapping boundary)</td><td style="padding:5px 10px;">Hesse, Orr &amp; Tchelepi (2008), J. Fluid Mech. 611:35&ndash;60</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;background:rgba(0,196,160,0.04)"><td colspan="3" style="padding:7px 10px;color:#0d1f3c;font-weight:700;font-size:8pt;letter-spacing:0.05em;text-transform:uppercase;">Heterogeneous Formation Corrections</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Sweep Efficiency</td><td style="padding:5px 10px;font-family:monospace;">E<sub>s</sub> = 1 &#x2212; exp(&#x2212;3&middot;PVI&middot;FQI); FQI = &#x221A;(1&#x2212;k<sub>Vdp</sub>)/&#x3D5;; accounts for Dykstra-Parsons permeability layering</td><td style="padding:5px 10px;">Shook &amp; Mitchell (2009), SPE-119897</td></tr>
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">Storage Efficiency</td><td style="padding:5px 10px;font-family:monospace;">E<sub>c</sub> = E<sub>geo</sub> &#xD7; E<sub>s</sub> &#xD7; E<sub>d</sub>; E<sub>geo</sub> = NTG/&#x221A;(k<sub>layer_ratio</sub>); E<sub>d</sub> = 1/&#x221A;M (Buckley-Leverett)</td><td style="padding:5px 10px;">Kopp, Class &amp; Helmig (2010), IJGGC 4(5):831&ndash;842</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">AoR Heterogeneity Scaling</td><td style="padding:5px 10px;font-family:monospace;">r<sub>AoR_corrected</sub> = r<sub>AoR</sub> &#xD7; exp(&#x3C3;&#xB2;/4); &#x3C3; = &#x2212;ln(1&#x2212;k<sub>Vdp</sub>); arithmetic/geometric mean ratio correction for high-perm layer channeling</td><td style="padding:5px 10px;">Derived from log-normal distribution theory</td></tr>
      </tbody>
    </table>
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:8pt;color:#64748b;">Prepared by ${opts.preparedBy} for ${opts.organization || 'Client'} &middot; ${opts.dateStr}</div>
      <div style="font-size:8pt;color:#64748b;">&copy; 2026 CarbonLens &middot; ${window.location.hostname}</div>
    </div>
  </div>
  `
}

function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'width=960,height=780')
  if (!w) { alert('Please allow popups for this site'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 1000)
}

function wrapHTML(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${SHARED_CSS}</style></head><body>${body}</body></html>`
}

function today(): string {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

function buildExecutiveSummaryBody(
  params: FormationParams,
  result: SimulationResult,
  geomechanics: GeomechanicsResult | null,
  wells: Well[],
  formationName: string,
  formationLocation: string,
  dateStr: string,
  jurisdiction: string,
  projectYears?: number,
  simulationYear?: number,
  hmResult?: OptimizationResult,
  mcResult?: PersistedMCResult,
  snapshots?: Array<{year: number; dataUrl: string}>,
): string {
  // Safety rating
  let safetyBadge: string
  let safetyLabel: string
  if (geomechanics == null) {
    safetyBadge = '<span class="badge-amber">NOT RUN</span>'
    safetyLabel = 'NOT RUN'
  } else if (geomechanics.safetyFactor >= 1.5) {
    safetyBadge = '<span class="badge-green">LOW RISK</span>'
    safetyLabel = 'LOW RISK'
  } else if (geomechanics.safetyFactor >= 1.0) {
    safetyBadge = '<span class="badge-amber">MODERATE</span>'
    safetyLabel = 'MODERATE'
  } else {
    safetyBadge = '<span class="badge-red">HIGH RISK</span>'
    safetyLabel = 'HIGH RISK'
  }
  void safetyLabel

  const containmentPct = (result.containmentProbability * 100).toFixed(0)

  // Trapping breakdown.
  // The simulation engine guarantees residual + solubility + mobile = storageCapacity when the
  // analytical trapping model is active (i.e. PlumeGrid is not overriding, or PlumeGrid retains
  // ≥ 85% of injected mass — see plumeMassOk in useSimulation.ts).  We therefore always use
  // storageCapacity as the denominator so that absolute values in the table equal
  // (percentage × storageCapacity) — i.e. the breakdown is a true partition of the injected total.
  const residual = result.residualTrapping ?? 0
  const solubility = result.solubilityTrapping ?? 0
  const mineral = result.mineralTrapping ?? 0
  const mobile = result.mobilePlume ?? 0
  const storedTotal = result.storageCapacity ?? 0
  // If for some reason the component sum drifts from storageCapacity, fall back to the component
  // sum as denominator so percentages still add to 100%.
  const componentSum = residual + solubility + mobile
  const trappingRef = storedTotal > 0 ? storedTotal : componentSum
  const pctR = trappingRef > 0 ? ((residual / trappingRef) * 100).toFixed(1) : '0.0'
  const pctS = trappingRef > 0 ? ((solubility / trappingRef) * 100).toFixed(1) : '0.0'
  const pctM = trappingRef > 0 ? ((mineral / trappingRef) * 100).toFixed(1) : '0.0'
  const pctMob = trappingRef > 0 ? ((mobile / trappingRef) * 100).toFixed(1) : '0.0'

  const nWells = Math.max(1, wells.length)
  const drillCost = nWells * (5 + params.depth * 0.006)
  const facilityCost = nWells * 3 + 2
  const pipelineCost = Math.sqrt(params.area) * 0.8 + 1
  const monitoringCost = Math.sqrt(params.area) * 0.15 + 0.5
  const capex = drillCost + facilityCost + pipelineCost + monitoringCost
  const opexPerTonne = 1.5 + nWells * 0.2 + params.depth * 0.0005
  const totalOpex = opexPerTonne * Math.max(storedTotal, (storedTotal > 0 ? storedTotal / Math.max(1, projectYears ?? 20) : wells.reduce((s, w) => s + w.injectionRate, 0)) * (projectYears ?? 20))
  const breakevenCost = storedTotal > 0.001 ? (capex + totalOpex) / storedTotal : (capex + totalOpex) / Math.max(0.001, (storedTotal > 0 ? storedTotal / Math.max(1, projectYears ?? 20) : wells.reduce((s, w) => s + w.injectionRate, 0)) * (projectYears ?? 20))

  const credit45q = jurisdiction === 'US' ? 85
    : jurisdiction === 'EU' ? 60
    : (jurisdiction === 'AU' || jurisdiction === 'Australia') ? 45
    : jurisdiction === 'UK' ? 60
    : jurisdiction === 'Norway' ? 70
    : jurisdiction === 'CA' ? 48
    : (jurisdiction === 'MY' || jurisdiction === 'MY_SAR') ? 25
    : jurisdiction === 'NG' ? 15
    : jurisdiction === 'ID' ? 20
    : jurisdiction === 'EG' ? 10
    : jurisdiction === 'AE' ? 15
    : jurisdiction === 'DZ' ? 5
    : 0
  // Local-currency display label — CA TIER is priced in CAD; all others used as USD equivalents
  const carbonPriceDisplay = jurisdiction === 'US' ? `USD ${credit45q}/t (45Q tax credit)`
    : jurisdiction === 'EU' ? `EUR ${credit45q}/t (EU ETS)`
    : jurisdiction === 'UK' ? `GBP ${credit45q}/t (UK ETS)`
    : (jurisdiction === 'AU' || jurisdiction === 'Australia') ? `AUD ${credit45q}/t`
    : jurisdiction === 'Norway' ? `NOK ${credit45q}/t (CO₂ tax)`
    : jurisdiction === 'CA' ? `CAD 65/t (≈ USD ${credit45q}/t, Alberta TIER 2024)`
    : (jurisdiction === 'MY' || jurisdiction === 'MY_SAR') ? `MYR ${credit45q}/t`
    : `USD ${credit45q}/t`
  const creditRevenue = credit45q * Math.max(storedTotal, (storedTotal > 0 ? storedTotal / Math.max(1, projectYears ?? 20) : wells.reduce((s, w) => s + w.injectionRate, 0)) * (projectYears ?? 20))

  const utilisation = result.capacityUtilPct ?? 0
  const utilisationStr = utilisation.toFixed(1)

  // Recommendations
  const recommendations: string[] = []
  recommendations.push(
    'Advance to detailed site-specific characterisation and full-physics reservoir simulation to confirm screening estimates before regulatory submission.',
  )
  if (utilisation > 80) {
    recommendations.push(
      `Capacity utilisation of ${utilisationStr}% exceeds 80% threshold. Reduce injection rate or increase area of review to manage overpressure risk.`,
    )
  }
  if (geomechanics != null && geomechanics.safetyFactor < 1.5) {
    recommendations.push(
      `Safety factor of ${geomechanics.safetyFactor.toFixed(2)} is below the recommended 1.5 minimum. Reduce injection pressure or improve caprock characterisation.`,
    )
  }
  if (result.containmentProbability > 0.75) {
    recommendations.push(
      `Containment probability of ${containmentPct}% supports advancing to front-end engineering study and regulatory pre-application screening.`,
    )
  }
  if (result.containmentProbability < 0.5) {
    recommendations.push(
      `Containment probability of ${containmentPct}% is below the 50% threshold. Additional seismic characterisation and fault mapping recommended before advancing.`,
    )
  }
  if (result.co2Density < 600) {
    recommendations.push(
      `CO₂ density of ${result.co2Density.toFixed(0)} kg/m³ is below 600 kg/m³. Consider deeper injection or cooler formation conditions to improve storage efficiency.`,
    )
  }
  recommendations.push(
    '<b>For Engineers:</b> Commission core-flooding laboratory tests on reservoir samples to construct field-validated relative permeability (k<sub>rg</sub>, k<sub>rw</sub>) and capillary pressure curves under in-situ conditions.',
  )
  recommendations.push(
    '<b>For Regulators:</b> Define a localized Monitoring, Reporting, and Verification (MRV) program (incorporating active distributed temperature sensing (DTS), microseismic arrays, and deep groundwater sampling) to satisfy Class VI / EU Directive compliance.',
  )
  recommendations.push(
    '<b>For Investors:</b> Mitigate long-term overpressure risk by optimizing the injection well pattern (horizontal well completions or multi-well distribution) to increase active sweep efficiency and maximize capacity utilization.',
  )
  recommendations.push(
    'All capacity estimates are preliminary screening values using DOE Goodman et al. (2011) methodology. Regulatory-grade estimates require site-specific characterisation.',
  )

  const recsHTML = recommendations
    .map((r, i) => `<li>${i + 1 > 0 ? '' : ''}${r}</li>`)
    .join('')

  // Geomechanics section
  let geoSection: string
  if (geomechanics == null) {
    geoSection = `<p class="muted" style="padding:10px 0;">Geomechanical assessment not run. Navigate to the Geomechanics panel to perform risk analysis.</p>`
  } else {
    const sfBadge = geomechanics.safetyFactor >= 1.5
      ? '<span class="badge-green">PASS</span>'
      : geomechanics.safetyFactor >= 1.0
        ? '<span class="badge-amber">MARGINAL</span>'
        : '<span class="badge-red">FAIL</span>'
    const seisClass = geomechanics.inducedSeismicityRisk === 'low'
      ? 'badge-green'
      : geomechanics.inducedSeismicityRisk === 'moderate'
        ? 'badge-amber'
        : 'badge-red'
    const heaveClass = geomechanics.surfaceHeave < 10 ? 'badge-green' : geomechanics.surfaceHeave < 30 ? 'badge-amber' : 'badge-red'
    const maipHeadroom = geomechanics.maip - (result.injectionPressure ?? 0)
    const maipClass = maipHeadroom > 2 ? 'badge-green' : maipHeadroom > 0 ? 'badge-amber' : 'badge-red'

    geoSection = `
    <table>
      <thead><tr><th>Parameter</th><th>Value</th><th>Assessment</th></tr></thead>
      <tbody>
        <tr><td>Safety Factor</td><td>${geomechanics.safetyFactor.toFixed(3)}</td><td>${sfBadge}</td></tr>
        <tr><td>Fracture Pressure (Hubbert-Willis)</td><td>${geomechanics.fracturePressure.toFixed(2)} MPa</td><td><span class="badge-green">REF</span></td></tr>
        <tr><td>Min. Horizontal Stress (σ<sub>h</sub>)</td><td>${geomechanics.minHorizontalStress.toFixed(2)} MPa</td><td><span class="badge-green">REF</span></td></tr>
        <tr><td>Caprock Stress</td><td>${geomechanics.capRockStress.toFixed(2)} MPa</td><td><span class="badge-green">REF</span></td></tr>
        <tr><td>MAIP</td><td>${geomechanics.maip.toFixed(2)} MPa</td><td><span class="${maipClass}">${maipHeadroom > 0 ? `+${maipHeadroom.toFixed(2)} MPa headroom` : 'EXCEEDED'}</span></td></tr>
        <tr><td>Surface Heave</td><td>${geomechanics.surfaceHeave.toFixed(1)} mm</td><td><span class="${heaveClass}">${geomechanics.surfaceHeave < 10 ? 'ACCEPTABLE' : geomechanics.surfaceHeave < 30 ? 'MONITOR' : 'ELEVATED'}</span></td></tr>
        <tr><td>Seismicity Risk</td><td>${geomechanics.inducedSeismicityRisk.toUpperCase()}</td><td><span class="${seisClass}">${geomechanics.inducedSeismicityRisk.toUpperCase()}</span></td></tr>
        <tr><td>Mohr-Coulomb Margin</td><td>${geomechanics.mohrSafetyMargin.toFixed(3)}</td><td>${geomechanics.mohrFailed ? '<span class="badge-red">FAILED</span>' : '<span class="badge-green">PASS</span>'}</td></tr>
      </tbody>
    </table>`
  }

  // Phase state
  const phaseLabel = params.temperature > 31.1 && params.pressure > 7.38 ? 'supercritical' : 'subcritical'

  void creditRevenue
  void carbonPriceDisplay

  return `
  <!-- Page 2+ header -->
  <div style="page-break-before:always;">
  <div class="page-header-bar">
    ${LOGO_SVG}
    <div style="text-align:right;">
      <div style="font-size:8.5pt;font-weight:700;color:#0d1f3c;font-family:'IBM Plex Sans',sans-serif;">Executive Summary &mdash; CO&#x2082; Storage Assessment</div>
      <div style="font-size:7.5pt;color:#64748b;font-family:'IBM Plex Mono',monospace;">${formationName} &middot; ${dateStr}</div>
    </div>
  </div>
  <div class="page-header-rule"></div>

  ${simulationYear != null && projectYears != null && simulationYear < projectYears ? `
  <div style="border:1px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:8px 14px;margin-bottom:12px;">
    <strong style="color:#92400e;">&#x26A0; Snapshot at simulation year ${simulationYear} of ${projectYears}.</strong>
    <span style="color:#92400e;font-size:9pt;"> The simulation had not yet reached the final project year when this document was exported. Stored mass and trapping values reflect an intermediate state. Run the simulation to completion before exporting for final results.</span>
  </div>` : ''}

  ${buildCertificateBadge({
    assetId: 'CL-' + Math.abs((params.depth | 0) ^ ((params.porosity * 1000) | 0) ^ ((params.area * 10) | 0)).toString(16).padStart(6, '0').substring(0,6).toUpperCase() + '-' + ((params.porosity * 100) | 0) + '-' + ((params.area) | 0),
    formationName,
    storedMt: result.storageCapacity ?? 0,
    safetyFactor: geomechanics?.safetyFactor ?? null,
    containmentPct: (result.containmentProbability ?? 0) * 100,
    jurisdiction,
    dateStr,
  })}

  <!-- KPI Cards -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">CO&#x2082; Stored</div>
      <div class="kpi-value">${result.storageCapacity?.toFixed(2) ?? '—'}</div>
      <div class="kpi-sub">Mt &mdash; ${simulationYear != null ? `Year ${simulationYear} of ${projectYears ?? '?'}` : 'Cumulative injection'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">P50 Capacity</div>
      <div class="kpi-value">${result.totalCapacity?.toFixed(1) ?? '—'}</div>
      <div class="kpi-sub">Mt &mdash; P90 ${result.p10?.toFixed(1) ?? '—'} / P10 ${result.p90?.toFixed(1) ?? '—'} Mt</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Safety Rating</div>
      <div class="kpi-value" style="font-size:13pt; padding-top:4px;">${safetyBadge}</div>
      <div class="kpi-sub">SF: ${geomechanics?.safetyFactor?.toFixed(2) ?? '—'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Containment</div>
      <div class="kpi-value">${containmentPct}%</div>
      <div class="kpi-sub">Plume containment probability</div>
    </div>
  </div>

  <!-- Storage Capacity Analysis -->
  <h2>Storage Capacity Analysis</h2>
  <div class="two-col">
    <div>
      <table>
        <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Stored CO&#x2082;</td><td><strong>${result.storageCapacity?.toFixed(2) ?? '—'} Mt</strong></td></tr>
          <tr><td>P50 Capacity</td><td>${result.totalCapacity?.toFixed(2) ?? '—'} Mt</td></tr>
          <tr><td>P10 (optimistic)</td><td>${result.p90?.toFixed(2) ?? '—'} Mt</td></tr>
          <tr><td>P90 (conservative)</td><td>${result.p10?.toFixed(2) ?? '—'} Mt</td></tr>
          <tr><td>Capacity Utilisation</td><td>${utilisationStr}%</td></tr>
          <tr><td>Storage Efficiency (Cc)</td><td>${result.storageEfficiency?.toFixed(2) ?? '2.00'}%</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <p style="font-size:8.5pt; color:#64748b; font-weight:600; margin-bottom:6px;">DOE CAPACITY RANGE (Mt)</p>
      <div style="position:relative; margin:8px 0 16px;">
        <div style="display:flex; justify-content:space-between; font-size:8pt; color:#64748b; margin-bottom:2px;">
          <span>P90 (cons.) ${result.p10?.toFixed(1) ?? '—'}</span>
          <span>P50 ${result.totalCapacity?.toFixed(1) ?? '—'}</span>
          <span>P10 (opt.) ${result.p90?.toFixed(1) ?? '—'}</span>
        </div>
        <div class="bar-track">
          <div style="width:100%; background:linear-gradient(90deg,#10b98133,#10b981,#059669); height:8px; border-radius:4px;"></div>
        </div>
        <div style="width:${Math.min(utilisationStr as unknown as number, 100)}%; background:#0d1f3c33; height:8px; border-radius:4px; margin-top:4px;">
          <div style="width:${Math.min(utilisationStr as unknown as number, 100)}%; background:#0d1f3c; height:8px; border-radius:4px;"></div>
        </div>
        <p style="font-size:7.5pt; color:#64748b; margin-top:4px;">&#9632; Injected vs P50 capacity</p>
      </div>
      <p style="font-size:8.5pt; color:#64748b; font-weight:600; margin-bottom:6px;">TRAPPING MECHANISM DISTRIBUTION</p>
      <table style="font-size:8.5pt;">
        <tbody>
          <tr>
            <td style="padding:3px 6px;">Residual</td>
            <td style="padding:3px 6px; width:120px;">
              <div class="bar-track"><div style="width:${pctR}%; background:#10b981; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:3px 6px;">${residual.toFixed(3)} Mt (${pctR}%)</td>
          </tr>
          <tr>
            <td style="padding:3px 6px;">Dissolved</td>
            <td style="padding:3px 6px;">
              <div class="bar-track"><div style="width:${pctS}%; background:#14b8a6; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:3px 6px;">${solubility.toFixed(3)} Mt (${pctS}%)</td>
          </tr>
          <tr>
            <td style="padding:3px 6px;">Mineral</td>
            <td style="padding:3px 6px;">
              <div class="bar-track"><div style="width:${pctM}%; background:#b45309; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:3px 6px;">${mineral.toFixed(3)} Mt (${pctM}%)</td>
          </tr>
          <tr>
            <td style="padding:3px 6px;">Structural Trapping</td>
            <td style="padding:3px 6px;">
              <div class="bar-track"><div style="width:${pctMob}%; background:#ef4444; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:3px 6px;">${mobile.toFixed(3)} Mt (${pctMob}%)</td>
          </tr>
        </tbody>
      </table>
      ${storedTotal > 0 && (storedTotal - componentSum) > 0.01 * storedTotal ? `<p style="font-size:8pt;color:#92400e;margin-top:6px;border-left:3px solid #f59e0b;padding-left:8px;">Note: ${(storedTotal - componentSum).toFixed(2)} Mt (${((storedTotal - componentSum) / storedTotal * 100).toFixed(1)}%) of CO&#x2082; exited the simulation grid boundary and is not tracked in the above breakdown. Percentages above reflect tracked mass only.</p>` : ''}
    </div>
  </div>

  <!-- Fluid Properties -->
  <h2>Fluid Properties</h2>
  <table>
    <thead><tr><th>Property</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>CO&#x2082; Density</td><td>${result.co2Density?.toFixed(1) ?? '—'} kg/m&#xB3;</td></tr>
      <tr><td>CO&#x2082; Viscosity</td><td>${result.co2Viscosity?.toFixed(4) ?? '—'} mPa&#xB7;s</td></tr>
      <tr><td>Brine Density</td><td>${result.brineDensity?.toFixed(1) ?? '—'} kg/m&#xB3;</td></tr>
      <tr><td>CO&#x2082; Solubility</td><td>${result.solubility?.toFixed(4) ?? '—'} mol/kg</td></tr>
      <tr><td>Diffusion Coefficient</td><td>${result.diffusion?.toExponential(3) ?? '—'} m&#xB2;/s</td></tr>
      <tr><td>Interfacial Tension (IFT)</td><td>${result.ift != null ? result.ift.toFixed(2) + ' mN/m' : '—'}</td></tr>
      <tr><td>Phase State</td><td><span class="${phaseLabel === 'supercritical' ? 'badge-green' : 'badge-amber'}">${phaseLabel.toUpperCase()}</span></td></tr>
      <tr><td>Injection Pressure</td><td>${result.injectionPressure?.toFixed(2) ?? '—'} MPa</td></tr>
    </tbody>
  </table>

  <!-- Geomechanical Assessment -->
  <h2>Geomechanical Assessment</h2>
  ${geoSection}
  ${geomechanics ? generatePressureRateChartSVG(params, wells, geomechanics, projectYears) : ''}
  ${geomechanics ? `
  <div style="margin-top: 10px; font-size: 8.5pt; line-height: 1.4; color: #475569; page-break-inside: avoid;">
    <strong style="color: #0d1f3c;">Fracture Mechanics &amp; Storage Integrity Notice:</strong>
    If injection pressure exceeds the rock fracture limit, tensile fracturing degrades containment by creating vertical leakage pathways and pressure bypass zones. This directly compromises fluid flow assurance (due to bypass paths and loss of sweep efficiency) and restricts active storage capacity by capping the safe operating bottomhole pressure (BHP). Keeping pressures below the Maximum Allowable Injection Pressure (MAIP) is mandatory for storage permit validation.
  </div>
  ` : ''}

  ${hmResult ? buildHMCalibrationCard(hmResult) : ''}
  ${mcResult ? buildMCUncertaintyCard(mcResult) : ''}

  <!-- Injection Well Programme -->
  <h2>Injection Well Programme</h2>
  <table>
    <thead><tr><th>Well ID</th><th>Rate (Mt/yr)</th><th>Ramp-up (yr)</th><th>Ramp-down (yr)</th><th>Project Duration (yr)</th></tr></thead>
    <tbody>
      ${wells.map((w) => `<tr>
        <td><strong>${w.label ?? w.id}</strong></td>
        <td>${w.injectionRate?.toFixed(3) ?? '—'}</td>
        <td>${w.rampUpYears ?? '—'}</td>
        <td>${w.rampDownYears ?? '—'}</td>
        <td>${projectYears ?? '—'}</td>
      </tr>`).join('')}
      <tr style="background:#f1f5f9;">
        <td><strong>TOTAL</strong></td>
        <td><strong>${wells.reduce((s, w) => s + (w.injectionRate ?? 0), 0).toFixed(3)} Mt/yr</strong></td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>
  <!-- Project Economics & Incentives -->
  <h2>Project Economics &amp; Incentives</h2>
  <div class="two-col" style="page-break-inside: avoid;">
    <div>
      <p style="font-size:8.5pt; color:#64748b; font-weight:600; margin-bottom:6px;">FINANCIAL SUMMARY</p>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Jurisdiction Carbon Pricing</td><td><strong>${carbonPriceDisplay}</strong></td></tr>
          <tr><td>Total CAPEX</td><td>$${capex.toFixed(1)}M</td></tr>
          <tr><td>OPEX (per tonne)</td><td>$${opexPerTonne.toFixed(2)}/t</td></tr>
          <tr><td>Total OPEX</td><td>$${totalOpex.toFixed(1)}M</td></tr>
          <tr><td>Levelized Cost (LCO₂S)</td><td><strong>$${breakevenCost.toFixed(2)}/t</strong></td></tr>
          <tr><td>Net Cost after Credits</td><td><span style="font-weight:700; color:${breakevenCost - credit45q < 0 ? '#ef4444' : '#10b981'};">$${(breakevenCost - credit45q).toFixed(2)}/t</span></td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <p style="font-size:8.5pt; color:#64748b; font-weight:600; margin-bottom:6px;">CAPEX BREAKDOWN</p>
      <table style="font-size:8.5pt;">
        <tbody>
          <tr>
            <td style="padding:4px 6px;">Drilling</td>
            <td style="padding:4px 6px; width:100px;">
              <div class="bar-track"><div style="width:${(drillCost / capex * 100).toFixed(1)}%; background:#3b82f6; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:4px 6px;">$${drillCost.toFixed(1)}M (${(drillCost / capex * 100).toFixed(0)}%)</td>
          </tr>
          <tr>
            <td style="padding:4px 6px;">Facilities</td>
            <td style="padding:4px 6px;">
              <div class="bar-track"><div style="width:${(facilityCost / capex * 100).toFixed(1)}%; background:#14b8a6; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:4px 6px;">$${facilityCost.toFixed(1)}M (${(facilityCost / capex * 100).toFixed(0)}%)</td>
          </tr>
          <tr>
            <td style="padding:4px 6px;">Pipeline</td>
            <td style="padding:4px 6px;">
              <div class="bar-track"><div style="width:${(pipelineCost / capex * 100).toFixed(1)}%; background:#f59e0b; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:4px 6px;">$${pipelineCost.toFixed(1)}M (${(pipelineCost / capex * 100).toFixed(0)}%)</td>
          </tr>
          <tr>
            <td style="padding:4px 6px;">Monitoring</td>
            <td style="padding:4px 6px;">
              <div class="bar-track"><div style="width:${(monitoringCost / capex * 100).toFixed(1)}%; background:#8b5cf6; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:4px 6px;">$${monitoringCost.toFixed(1)}M (${(monitoringCost / capex * 100).toFixed(0)}%)</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  ${generateEconomicsNPVChartSVG(params, wells, result, projectYears, jurisdiction)}

  <p class="muted" style="font-size:8pt; margin-top:4px;">Project Duration is the full injection period (from UIStore). Cumulative injection accounts for ramp-up and ramp-down schedules within this period. Simple rate × duration gives a conservative upper bound; actual cumulative injection is lower when ramp periods are present.</p>

  <div style="page-break-inside:avoid; margin: 15px 0 5px 0;">
    <h3 style="font-size:10pt; color:#1e293b; margin:0 0 4px 0; font-weight:700;">Storage Capacity Sensitivity</h3>
    <p class="muted" style="margin:0 0 8px 0; font-size:8pt;">One-at-a-time sensitivity of P50 storage capacity to key reservoir parameters. Bar widths reflect the actual uncertainty ranges used in the Monte Carlo run for this formation.</p>
  </div>
  ${generateSensitivityTornadoSVG(params, result, mcResult)}

  <!-- Reservoir Evolution Snapshots -->
  <h2>Reservoir Evolution</h2>
  ${(() => {
    const frames = selectTenSnapshots(snapshots ?? [], projectYears ?? 20)
    if (frames.length === 0) return '<p class="muted" style="padding:8px 0;">No simulation snapshots available. Run a full simulation to capture reservoir evolution imagery at key years.</p>'
    const dur = frames.length * 2  // 2s per frame, total cycle
    const pct = (1 / frames.length) * 100
    const holdEnd = pct - 2  // hold for most of the slot, then fade out
    const keyframes = frames.map((_, i) => {
      const start = (i / frames.length * 100).toFixed(1)
      const end = ((i + 1) / frames.length * 100).toFixed(1)
      return `.cl-evo-f:nth-child(${i+1}){animation-delay:${(i * dur / frames.length).toFixed(1)}s}`
    }).join('')
    return `
  <style>
  @keyframes cl-evo-cycle {
    0%,${holdEnd.toFixed(1)}%{opacity:1}
    ${pct.toFixed(1)}%,100%{opacity:0}
  }
  @media screen {
    .cl-evo-wrap{position:relative;width:100%;padding-bottom:56.25%;background:#0a1015;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;margin:8px 0;}
    .cl-evo-f{position:absolute;inset:0;opacity:0;animation:cl-evo-cycle ${dur}s linear infinite;}
    .cl-evo-f:nth-child(1){opacity:1;}
    ${keyframes}
    .cl-evo-f img{width:100%;height:100%;object-fit:contain;}
    .cl-evo-label{position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:7.5pt;color:#94a3b8;background:rgba(0,0,0,0.4);padding:2px 0;}
    .cl-evo-grid{display:none;}
    .cl-evo-note{font-size:7pt;color:#64748b;text-align:center;margin-top:4px;}
  }
  @media print {
    .cl-evo-wrap{display:none;}
    .cl-evo-note{display:none;}
    .cl-evo-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:8px 0;}
    .cl-evo-grid img{width:100%;border:1px solid #e2e8f0;border-radius:4px;}
    .cl-evo-grid div{text-align:center;font-size:6.5pt;color:#64748b;margin-top:2px;}
  }
  </style>
  <div class="cl-evo-wrap">
    ${frames.map((s) => `<div class="cl-evo-f"><img src="${s.dataUrl}" alt="Year ${s.year}"><div class="cl-evo-label">Year ${s.year} \u2014 CO\u2082 Plume</div></div>`).join('')}
  </div>
  <p class="cl-evo-note">Auto-advancing animation (${frames.length} frames, ${dur}s loop). Print view shows image grid.</p>
  <div class="cl-evo-grid">
    ${frames.map((s) => `<div><img src="${s.dataUrl}" alt="Year ${s.year}"><div>Yr ${s.year}</div></div>`).join('')}
  </div>`
  })()}

  ${result.overpressureRisk ? `
  <!-- Overpressure Risk -->
  <div style="border:2px solid #ef4444; border-radius:8px; padding:14px 16px; margin:14px 0; background:#fee2e2;">
    <p style="font-size:11pt; font-weight:700; color:#991b1b; margin-bottom:6px;">&#x26A0; RESERVOIR OVERPRESSURE RISK DETECTED</p>
    <p style="font-size:9.5pt; color:#7f1d1d;">The cumulative injected CO&#x2082; volume (${result.storageCapacity?.toFixed(2) ?? '—'} Mt) exceeds the P90 (conservative) storage capacity estimate (${result.p10?.toFixed(2) ?? '—'} Mt). This indicates a significant risk of reservoir overpressure. Reduce the injection rate, extend the injection period, or conduct detailed pressure management analysis before proceeding.</p>
  </div>` : ''}

  <!-- Recommendations -->
  <h2>Recommendations</h2>
  <div class="section-box">
    <ol class="numbered">
      ${recsHTML}
    </ol>
  </div>

  <!-- Footer -->
  <footer>
    <span>CarbonLens &mdash; ${window.location.hostname} &mdash; Generated ${dateStr}</span>
    <span>MSc Research, Universiti Teknologi PETRONAS, Malaysia | Preliminary screening only</span>
  </footer>
  <p style="font-size:7pt; color:#cbd5e1; margin-top:8px; line-height:1.6;">
    Scientific basis: DOE Goodman et al. (2011); Peng &amp; Robinson (1976) PR-EOS with Li &amp; Yan (2009) binary interaction parameters; Fenghour et al. (1998) viscosity; Duan &amp; Sun (2003) solubility (NaCl); Duan et al. (2006) multi-salt solubility (CaCl&#x2082;, MgCl&#x2082;, KCl); Nordbotten et al. (2005) two-phase AoR; Hesse, Orr &amp; Tchelepi (2008) post-injection gravity current; van Genuchten (1980) &amp; Mualem (1976) kr; Krevor et al. (2012); Furre et al. (2017); Boait et al. (2012)
  </p>
  </div>
`
}

export function openExecutiveSummary(
  params: FormationParams,
  result: SimulationResult,
  geomechanics: GeomechanicsResult | null,
  wells: Well[],
  formationName: string,
  formationLocation: string,
  userName?: string | null,
  organization?: string,
  snapshots?: Array<{year: number; dataUrl: string}>,
  projectYears?: number,
  simulationYear?: number,
  jurisdictionOverride?: string,
  hmResult?: OptimizationResult,
  mcResult?: PersistedMCResult,
): void {
  const dateStr = today()
  const jurisdiction = jurisdictionOverride ?? useUIStore.getState().jurisdiction ?? 'US'
  const preparedBy = userName ?? 'CarbonLens Simulation Studio'
  const orgName = organization ?? ''
  const refId = 'CL-EXEC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '')

  const execBody = buildExecutiveSummaryBody(
    params, result, geomechanics, wells,
    formationName, formationLocation, dateStr, jurisdiction,
    projectYears, simulationYear, hmResult, mcResult, snapshots,
  )

  const body = `
  ${buildCoverPage({
    reportType: 'executive',
    title: 'CO\u2082 Storage Assessment',
    subtitle: 'Executive Summary \u2014 Preliminary Screening',
    formationName,
    formationLocation,
    organization: orgName,
    preparedBy,
    dateStr,
    referenceId: refId,
  })}

  ${execBody}

  ${buildEquationsPage({ organization: orgName, preparedBy, dateStr })}
  ${buildBackPage({ organization: orgName, preparedBy, dateStr })}
`

  const html = wrapHTML('CarbonLens \u2014 Executive Summary', body)
  openPrintWindow(html)
}

// ---------------------------------------------------------------------------
// Permit Pre-Application
// ---------------------------------------------------------------------------

export function openPermitApplication(
  params: FormationParams,
  result: SimulationResult | null,
  geomechanics: GeomechanicsResult | null,
  wells: Well[],
  formationName: string,
  formationLocation: string,
  jurisdiction: string,
  organization?: string,
  snapshots?: Array<{year: number; dataUrl: string}>,
  projectYears?: number,
  simulationYear?: number,
  hmResult?: OptimizationResult,
  mcResult?: PersistedMCResult,
  // Optional overrides used when called from openPreScreeningReport
  preamble?: string,
  coverTitle?: string,
  coverSubtitle?: string,
): void {
  const dateStr = today()
  const dateISO = todayISO()

  const JURISDICTION_META: Record<string, {
    reportTitle: string
    authority: string
    legislation: string
    permitType: string
    complianceItems: string[]
  }> = {
    US: {
      reportTitle: 'EPA Class VI Injection Well Permit — Pre-Application',
      authority: 'U.S. Environmental Protection Agency (EPA), Underground Injection Control Program',
      legislation: '40 CFR Parts 124, 144, 146 — Safe Drinking Water Act (SDWA)',
      permitType: 'Class VI UIC Permit',
      complianceItems: [
        'Area of Review (AoR) delineation completed',
        'No-migration petition data compiled',
        'USDW characterisation report prepared',
        'Financial responsibility mechanism identified (trust fund / surety bond)',
        'Post-injection site care (PISC) plan — minimum 50-year monitoring',
        'Emergency and remedial response plan drafted',
        'Mechanical integrity testing (MIT) protocol defined',
        'CO₂ stream composition monitoring plan prepared',
      ],
    },
    EU: {
      reportTitle: 'EU CCS Directive CO₂ Storage Permit — Pre-Application',
      authority: 'Member State Competent Authority (pursuant to Directive 2009/31/EC)',
      legislation: 'Directive 2009/31/EC on the Geological Storage of Carbon Dioxide',
      permitType: 'CO₂ Storage Permit',
      complianceItems: [
        'Storage complex characterisation (formation + caprock + seal)',
        'CO₂ stream composition analysis (purity ≥ 95%)',
        'Comprehensive risk assessment (HAZID / HAZOP)',
        'Monitoring plan — corrective and routine measures',
        'Financial security mechanism before injection commencement',
        'Post-transfer liability plan to Member State after closure',
        'Closure criteria — permanent containment demonstration',
        'Public information and consultation plan',
      ],
    },
    UK: {
      reportTitle: 'UK CO₂ Storage Permit — Pre-Application (NSTA)',
      authority: 'North Sea Transition Authority (NSTA)',
      legislation: 'Energy Act 2008 / CCS Licensing Regulations 2010 (SI 2010/2221)',
      permitType: 'CO₂ Storage Permit',
      complianceItems: [
        'Storage site characterisation report',
        'CO₂ stream composition permit conditions (≥ 95% CO₂)',
        'Risk assessment (HAZID / HAZOP / bow-tie)',
        'Monitoring and remediation plan',
        'Financial security (trust fund or parent company guarantee)',
        'Post-closure obligations (minimum 20 years)',
        'Well examination scheme (design / construction / abandonment)',
      ],
    },
    AU: {
      reportTitle: 'GHG Storage Injection Licence — Pre-Application (NOPSEMA)',
      authority: 'National Offshore Petroleum Safety and Environmental Management Authority (NOPSEMA)',
      legislation: 'Offshore Petroleum and Greenhouse Gas Storage Act 2006 (OPGGS Act); GHG Storage Regulations 2021',
      permitType: 'GHG Storage Injection Licence',
      complianceItems: [
        'Site plan and formation characterisation',
        'Injection and monitoring program',
        'Well integrity management plan',
        'Environmental plan (EPBC Act compliance)',
        'Financial assurance (rehabilitation bond)',
        'Site closure and post-closure monitoring plan',
        'Greenhouse gas storage assessment report',
      ],
    },
    MY: {
      reportTitle: 'Malaysia CCUS Act 2025 — CO₂ Storage Licence Pre-Application',
      authority: 'Petroleum Nasional Berhad (PETRONAS) / Ministry of Natural Resources and Environmental Sustainability',
      legislation: 'Carbon Capture, Utilisation and Storage Act 2025 (Act [pending gazette]); Petroleum Development Act 1974',
      permitType: 'CO₂ Storage Licence',
      complianceItems: [
        'Formation characterisation report (PCR) as per PCPP Phase 2',
        'CO₂ stream specification and purity certification',
        'Environmental Impact Assessment (EIA) — DOE Malaysia',
        'Monitoring, Reporting & Verification (MRV) plan',
        'Financial assurance mechanism',
        'Emergency response and spill contingency plan',
        'Bumiputera contractor participation plan (local content)',
      ],
    },
    NG: {
      reportTitle: 'Nigeria NUPRC CO₂ Storage Permit — Pre-Application',
      authority: 'Nigerian Upstream Petroleum Regulatory Commission (NUPRC)',
      legislation: 'Petroleum Industry Act 2021 (PIA 2021), §§ 102–108; Climate Change Act 2021 (Act No. 42)',
      permitType: 'CO₂ Storage Permit',
      complianceItems: [
        'Site characterisation report per NUPRC Technical Standards',
        'Environmental Impact Assessment (EIA) — Federal Ministry of Environment',
        'Community Development Agreement (CDA) under PIA 2021',
        'CO₂ stream composition and purity certification',
        'MRV framework under the National Climate Change Action Plan (NCCAP)',
        'Financial assurance / abandonment fund commitment',
        'Emergency response and spill prevention plan',
        'Decommissioning and site closure plan',
      ],
    },
    ID: {
      reportTitle: 'Indonesia CCS Storage Permit — Pre-Application (PP 19/2023)',
      authority: 'Ministry of Energy and Mineral Resources (MEMR) / SKK Migas',
      legislation: 'Government Regulation No. 19 of 2023 on CCS (PP 19/2023); MEMR Regulation No. 2 of 2023',
      permitType: 'CCS Business Licence (Izin Usaha CCS)',
      complianceItems: [
        'CCS Business Activity Plan (RKHCCS) — MEMR approval',
        'Working Area designation and geological site characterisation',
        'CO₂ injection monitoring plan (SKK Migas oversight)',
        'Environmental document (AMDAL) per Government Regulation PP 22/2021',
        'Financial guarantee for site closure and post-injection care',
        'Technology transfer and local content requirement (TKDN)',
        'Post-injection monitoring plan — minimum 5 years',
      ],
    },
    EG: {
      reportTitle: 'Egypt CO₂ Storage Permit — Pre-Application (EMRA / EEAA)',
      authority: 'Egyptian Energy Regulatory Authority (EMRA) / Egyptian Environmental Affairs Agency (EEAA)',
      legislation: 'Climate Change Act 2023 (Law No. 11 of 2023); Environmental Law No. 4 of 1994; Natural Gas Activities Law No. 119 of 2004',
      permitType: 'CO₂ Storage Permit',
      complianceItems: [
        'Site characterisation and feasibility study (EMRA approval)',
        'Environmental Impact Statement (EIS) — EEAA Decree',
        'CO₂ stream analysis and purity certification (≥ 95%)',
        'National CO₂ MRV monitoring plan',
        'Financial assurance for long-term stewardship',
        'Community consultation and public disclosure record',
        'Integration with Egypt\'s NDC commitments under the Paris Agreement',
      ],
    },
    AE: {
      reportTitle: 'UAE CCUS Facility Licence — Pre-Application (MOEI)',
      authority: 'Ministry of Energy and Infrastructure (MOEI) / Abu Dhabi Department of Energy',
      legislation: 'Federal Law No. 24 of 1999 on Environment Protection; UAE Net Zero by 2050 Strategic Initiative; UAE CCUS Policy Framework (2023)',
      permitType: 'CCUS Facility Licence',
      complianceItems: [
        'CCUS project registration with Ministry of Energy and Infrastructure (MOEI)',
        'Technical feasibility report (ADNOC / operator standards)',
        'Environmental Impact Assessment — Ministry of Climate Change and Environment',
        'CO₂ monitoring, reporting, and verification (MRV) plan',
        'Financial guarantee for decommissioning and site closure',
        'Compliance with UAE Voluntary Carbon Market framework',
        'Public consultation under Federal Environmental Law No. 24/1999',
      ],
    },
    CA: {
      reportTitle: 'Alberta CCS Sequestration Licence — Pre-Application (AER)',
      authority: 'Alberta Energy Regulator (AER)',
      legislation: 'Mines and Minerals Act, RSA 2000, Chapter M-17; Carbon Capture and Storage Statutes Amendment Act, 2010; AER Directive 083; Canada\'s Net-Zero Emissions Accountability Act 2021',
      permitType: 'CCS Evaluation and Sequestration Licence',
      complianceItems: [
        'Evaluation Licence application to Alberta Energy Regulator (AER Directive 083)',
        'Geological characterisation report (evaluation and sequestration phases)',
        'Province assumes post-closure liability after 10 years (post-closure stewardship scheme)',
        'Closure plan with financial security before injection commencement',
        'CO₂ characterisation and purity report (≥ 95% CO₂)',
        'Area of Review (AoR) mapping and USDW assessment',
        'Consultation with First Nations and Métis communities (UNDRIP obligations)',
        'Integration with Alberta TIER carbon pricing program (CAD 65/t ≈ USD 48/t, 2024)',
      ],
    },
    DZ: {
      reportTitle: 'Algeria CO₂ Storage Permit — Pre-Application (ALNAFT)',
      authority: 'National Agency for the Valorisation of Hydrocarbon Resources (ALNAFT)',
      legislation: 'Law No. 05-07 of 2005 on Hydrocarbons (revised by Law No. 19-13 of 2019); Executive Decree No. 10-143 on Environmental Impact Assessment',
      permitType: 'CO₂ Storage Permit (Titre minier de stockage)',
      complianceItems: [
        'Exploration permit application (titre minier d\'exploration) — ALNAFT oversight',
        'Environmental Impact Assessment under Executive Decree No. 10-143',
        'Sonatrach technical validation as state partner (required under Law 05-07)',
        'CO₂ stream composition analysis and purity certification',
        'Site abandonment and closure plan per Hydrocarbons Law Title V',
        'Financial assurance mechanism',
        'Integration with Algeria\'s National Climate Plan (PNAC 2020)',
      ],
    },
  }

  const JURISDICTION_DISPLAY: Record<string, string> = {
    US: 'United States',
    EU: 'European Union',
    UK: 'United Kingdom',
    AU: 'Australia',
    MY: 'Malaysia (Federal Offshore)',
    MY_SAR: 'Malaysia (Sarawak Offshore)',
    NG: 'Nigeria',
    ID: 'Indonesia',
    EG: 'Egypt',
    AE: 'United Arab Emirates',
    CA: 'Canada (Alberta)',
    DZ: 'Algeria',
  }
  const jurisdictionDisplayName = JURISDICTION_DISPLAY[jurisdiction] ?? jurisdiction

  const jMeta = JURISDICTION_META[jurisdiction] ?? {
    reportTitle: 'CO₂ Geological Storage Permit — Pre-Application',
    authority: 'Relevant National/Regional Competent Authority',
    legislation: 'National Carbon Capture and Storage Legislation',
    permitType: 'CO₂ Storage Permit',
    complianceItems: [
      'Formation characterisation report',
      'CO₂ stream purity certification',
      'Risk assessment (HAZID / HAZOP)',
      'Monitoring, Reporting & Verification (MRV) plan',
      'Financial assurance mechanism',
      'Emergency response plan',
      'Site closure plan',
    ],
  }

  // Computed values
  // area (km²) × thickness (m) / 1000 → km³; multiply by porosity for pore volume
  const grossPoreVolume = params.area * (params.thickness / 1000) * params.porosity  // km³
  const phaseLabel = params.temperature > 31.1 && params.pressure > 7.38 ? 'supercritical' : 'subcritical'
  const estimatedFracPressure = 0.9 * (params.pressure + params.depth * 0.0226)

  const totalWellRate = wells.reduce((s, w) => s + (w.injectionRate ?? 0), 0)
  const minRampUp = wells.length > 0 ? Math.min(...wells.map((w) => w.rampUpYears ?? 0)) : 0
  const maxRampUp = wells.length > 0 ? Math.max(...wells.map((w) => w.rampUpYears ?? 0)) : 0

  const plumeRadius = result?.plumeRadius ?? 0
  const plumeHeight = result?.plumeHeight ?? 0

  // Dynamic AoR — Nordbotten et al. (2005) two-phase composite transmissivity model.
  // Far-field pressure propagates at brine hydraulic diffusivity (physically correct for the
  // pressure front outside the CO₂ plume). Near-well pressure includes a mobility-ratio
  // correction for the lower-mobility CO₂ zone (kr_CO2 ≈ 0.3 for water-wet sandstone).
  //
  // This replaces the single-phase Theis model which overestimates α by using CO₂ viscosity
  // for the pressure diffusivity — brine has μ ≈ 0.3–1 mPa·s vs CO₂ at 0.03–0.08 mPa·s,
  // giving a 5–30× diffusivity error in the far field.
  //
  // muCO2 is stored in mPa·s for display — convert back to Pa·s for pressure calculations.
  const muCO2_Pas   = (result?.co2Viscosity ?? 0.05) / 1000
  const rhoCO2_kgm3 = result?.co2Density   ?? 700
  // Brine viscosity from Vogel/Andrade correlation (valid 0–200°C)
  const T_K_aor     = (params.temperature ?? 80) + 273.15
  const muBrine_Pas = Math.exp(-3.7188 + 578.919 / (T_K_aor - 137.546)) * 1e-3
  const aorYear     = projectYears ?? 50
  const aorRadiusDynamic = (result != null && wells.length > 0)
    ? computeAoRRadiusTwoPhase(
        params, wells, aorYear, aorYear,
        rhoCO2_kgm3, muCO2_Pas,
        muBrine_Pas,  // brine viscosity for far-field diffusivity
        0.3,          // average CO₂ kr in plume (water-wet sandstone default)
        plumeRadius,  // CO₂ plume radius for near-well mobility correction
        0.007,
      )
    : 0
  // Retain the legacy 3× plume radius as a secondary conservative reference
  const aorRadiusLegacy = plumeRadius * 3
  // Regulatory AoR uses the larger of the two to ensure conservatism
  const aorRadius = Math.max(aorRadiusDynamic, aorRadiusLegacy)
  const aorArea   = Math.PI * aorRadius * aorRadius

  // Trapping breakdown — mineralTrapping is a SUBSET of solubilityTrapping (dissolved CO₂
  // that has further precipitated as carbonate minerals). Displaying both raw values would
  // double-count mineralised CO₂.  We split solubilityTrapping into two non-overlapping
  // pools: (a) still-dissolved and (b) mineralised.
  const residual     = result?.residualTrapping ?? 0
  const solubility   = result?.solubilityTrapping ?? 0
  const mineral      = result?.mineralTrapping ?? 0
  const mobile       = result?.mobilePlume ?? 0
  const dissolvedOnly = Math.max(0, solubility - mineral)  // still in aqueous phase
  const storedTotal  = result?.storageCapacity ?? 0
  // Use storageCapacity as the percentage denominator — the simulation engine guarantees
  // residual + solubility + mobile = storageCapacity (analytical model) so each row is a
  // true partition of total injected.  If PlumeGrid boundary outflow causes a gap > 1%,
  // fall back to the component sum so percentages still add to 100% and note the outflow.
  const componentSum = residual + solubility + mobile  // solubility already includes mineral
  const boundaryGap  = storedTotal - componentSum
  const trappingRef  = storedTotal > 0 && boundaryGap / Math.max(storedTotal, 1) < 0.05
    ? storedTotal
    : (componentSum > 0 ? componentSum : storedTotal)
  const pctR    = trappingRef > 0 ? ((residual     / trappingRef) * 100).toFixed(1) : '0.0'
  const pctS    = trappingRef > 0 ? ((dissolvedOnly / trappingRef) * 100).toFixed(1) : '0.0'
  const pctM    = trappingRef > 0 ? ((mineral      / trappingRef) * 100).toFixed(1) : '0.0'
  const pctMob  = trappingRef > 0 ? ((mobile       / trappingRef) * 100).toFixed(1) : '0.0'

  // Economic calculations
  const nWells = Math.max(1, wells.length)
  const drillCost = nWells * (5 + params.depth * 0.006)
  const facilityCost = nWells * 3 + 2
  const pipelineCost = Math.sqrt(params.area) * 0.8 + 1
  const monitoringCost = Math.sqrt(params.area) * 0.15 + 0.5
  const capex = drillCost + facilityCost + pipelineCost + monitoringCost
  const opexPerTonne = 1.5 + nWells * 0.2 + params.depth * 0.0005
  const totalOpex = opexPerTonne * Math.max(storedTotal, (storedTotal > 0 ? storedTotal / Math.max(1, projectYears ?? 20) : wells.reduce((s, w) => s + w.injectionRate, 0)) * (projectYears ?? 20))
  const breakevenCost = storedTotal > 0.001 ? (capex + totalOpex) / storedTotal : (capex + totalOpex) / Math.max(0.001, (storedTotal > 0 ? storedTotal / Math.max(1, projectYears ?? 20) : wells.reduce((s, w) => s + w.injectionRate, 0)) * (projectYears ?? 20))

  const credit45q = jurisdiction === 'US' ? 85
    : (jurisdiction === 'EU' || jurisdiction === 'UK') ? 60
    : (jurisdiction === 'AU' || jurisdiction === 'Australia') ? 45
    : jurisdiction === 'Norway' ? 70
    : jurisdiction === 'CA' ? 48
    : (jurisdiction === 'MY' || jurisdiction === 'MY_SAR') ? 25
    : jurisdiction === 'NG' ? 15
    : jurisdiction === 'ID' ? 20
    : jurisdiction === 'EG' ? 10
    : jurisdiction === 'AE' ? 15
    : jurisdiction === 'DZ' ? 5
    : 0
  // Local-currency display label — CA TIER is priced in CAD; all others used as USD equivalents
  const carbonPriceDisplayPermit = jurisdiction === 'US' ? `USD ${credit45q}/t (45Q tax credit)`
    : jurisdiction === 'EU' ? `EUR ${credit45q}/t (EU ETS)`
    : jurisdiction === 'UK' ? `GBP ${credit45q}/t (UK ETS)`
    : (jurisdiction === 'AU' || jurisdiction === 'Australia') ? `AUD ${credit45q}/t`
    : jurisdiction === 'Norway' ? `NOK ${credit45q}/t (CO₂ tax)`
    : jurisdiction === 'CA' ? `CAD 65/t (≈ USD ${credit45q}/t, Alberta TIER 2024)`
    : (jurisdiction === 'MY' || jurisdiction === 'MY_SAR') ? `MYR ${credit45q}/t`
    : `USD ${credit45q}/t`
  const creditRevenue = credit45q * Math.max(storedTotal, (storedTotal > 0 ? storedTotal / Math.max(1, projectYears ?? 20) : wells.reduce((s, w) => s + w.injectionRate, 0)) * (projectYears ?? 20))

  // Geomechanics section
  let geoSection6: string
  if (geomechanics == null) {
    geoSection6 = `<p class="muted" style="padding:10px 0;">Geomechanical assessment not completed. This section must be completed before regulatory submission.</p>`
  } else {
    const sfBadge = geomechanics.safetyFactor >= 1.5
      ? '<span class="badge-green">PASS</span>'
      : geomechanics.safetyFactor >= 1.0
        ? '<span class="badge-amber">MARGINAL</span>'
        : '<span class="badge-red">FAIL</span>'
    const seisClass = geomechanics.inducedSeismicityRisk === 'low'
      ? 'badge-green'
      : geomechanics.inducedSeismicityRisk === 'moderate'
        ? 'badge-amber'
        : 'badge-red'
    const heaveClass = geomechanics.surfaceHeave < 10 ? 'badge-green' : geomechanics.surfaceHeave < 30 ? 'badge-amber' : 'badge-red'
    const maipHeadroom = geomechanics.maip - (result?.injectionPressure ?? 0)
    const maipClass = maipHeadroom > 2 ? 'badge-green' : maipHeadroom > 0 ? 'badge-amber' : 'badge-red'

    const sfCrit = geomechanics.safetyFactor >= 1.5 ? '&#x2713; Acceptable (&#x2265;1.5)' : geomechanics.safetyFactor >= 1.0 ? '&#x26A0; Marginal (1.0–1.5)' : '&#x2717; Below minimum'
    const seisCrit = geomechanics.inducedSeismicityRisk === 'low' ? '&#x2713; Low risk' : geomechanics.inducedSeismicityRisk === 'moderate' ? '&#x26A0; Moderate — monitoring required' : '&#x2717; High — mitigation required'
    const heaveCrit = geomechanics.surfaceHeave < 10 ? '&#x2713; Within tolerance (<10 mm)' : geomechanics.surfaceHeave < 30 ? '&#x26A0; Monitor (10–30 mm)' : '&#x2717; Excessive (>30 mm)'

    geoSection6 = `
    <table>
      <thead><tr><th>Parameter</th><th>Value</th><th>Criterion</th></tr></thead>
      <tbody>
        <tr><td>Safety Factor (Mohr-Coulomb)</td><td>${geomechanics.safetyFactor.toFixed(3)}</td><td>${sfBadge} ${sfCrit}</td></tr>
        <tr><td>Fracture Pressure (Hubbert-Willis, Mohr-Coulomb adjusted)</td><td>${geomechanics.fracturePressure.toFixed(2)} MPa</td><td><span class="badge-green">REF</span></td></tr>
        <tr><td>Nordbotten (2005) Composite Injection Pressure</td><td>${result?.injectionPressure?.toFixed(2) ?? '—'} MPa</td><td><span class="badge-green">REF</span></td></tr>
        <tr><td>Peaceman BHP (skin S=0, r<sub>w</sub>=0.1 m) <em style="font-size:8pt;color:#94a3b8;">— steady-state near-wellbore</em></td><td>${(() => {
          // BHP must be ≥ reservoir pressure (P_i) to inject — if the stored field is below P_i
          // it is a stale placeholder from a prior formation profile; fall back to injectionPressure.
          const rawBHP = result?.peacemanBHP ?? null
          const pi = params.pressure
          const bhp = rawBHP != null && rawBHP >= pi ? rawBHP : (result?.injectionPressure ?? null)
          return bhp != null ? bhp.toFixed(2) + ' MPa' : '—'
        })()}</td><td><span class="${(() => {
          const rawBHP = result?.peacemanBHP ?? null
          const pi = params.pressure
          const bhp = rawBHP != null && rawBHP >= pi ? rawBHP : (result?.injectionPressure ?? null)
          return bhp != null && bhp < geomechanics.maip ? 'badge-green' : 'badge-amber'
        })()}">${(() => {
          const rawBHP = result?.peacemanBHP ?? null
          const pi = params.pressure
          const bhp = rawBHP != null && rawBHP >= pi ? rawBHP : (result?.injectionPressure ?? null)
          return bhp != null && bhp < geomechanics.maip ? '&#x2713; Below MAIP' : '&#x26A0; Check MAIP'
        })()}</span></td></tr>
        <tr><td>Injectivity Index J (Peaceman, zero skin)</td><td>${result?.injectivityIndex != null && result.injectivityIndex > 0 ? result.injectivityIndex.toFixed(1) + ' m³/(d·MPa)' : '—'}</td><td><span class="badge-green">REF</span></td></tr>
        <tr><td>Min. Horizontal Stress σ<sub>h</sub> (K<sub>0</sub> × S<sub>v</sub>)</td><td>${geomechanics.minHorizontalStress.toFixed(2)} MPa</td><td><span class="badge-green">REF</span></td></tr>
        <tr><td>Caprock Stress</td><td>${geomechanics.capRockStress.toFixed(2)} MPa</td><td><span class="badge-green">REF</span></td></tr>
        <tr><td>Surface Heave</td><td>${geomechanics.surfaceHeave.toFixed(1)} mm</td><td><span class="${heaveClass}">${heaveCrit}</span></td></tr>
        <tr><td>Seismicity Risk</td><td>${geomechanics.inducedSeismicityRisk.toUpperCase()}</td><td><span class="${seisClass}">${seisCrit}</span></td></tr>
        <tr><td>Mohr-Coulomb Margin</td><td>${geomechanics.mohrSafetyMargin.toFixed(3)}</td><td>${geomechanics.mohrFailed ? '<span class="badge-red">&#x2717; FAILED</span>' : '<span class="badge-green">&#x2713; PASS</span>'}</td></tr>
        <tr><td>MAIP Headroom</td><td>${maipHeadroom.toFixed(2)} MPa</td><td><span class="${maipClass}">${maipHeadroom > 2 ? '&#x2713; Adequate' : maipHeadroom > 0 ? '&#x26A0; Monitor' : '&#x2717; Exceeded'}</span></td></tr>
      </tbody>
    </table>
    <p style="font-size:9pt; color:#64748b; margin-top:8px;">
      All geomechanical criteria must be demonstrated to the competent authority prior to injection permit issuance.
    </p>`
  }

  const orgName = organization ?? ''
  const permitRefId = 'CL-' + dateISO.replace(/-/g, '') + '-' + jurisdiction

  const body = `
  ${buildCoverPage({
    reportType: 'permit',
    title: coverTitle ?? jMeta.reportTitle,
    subtitle: coverSubtitle ?? jMeta.authority,
    formationName,
    formationLocation,
    organization: orgName,
    preparedBy: 'CarbonLens Simulation Studio v3',
    dateStr,
    referenceId: permitRefId,
    jurisdiction: jurisdictionDisplayName,
  })}

  ${preamble ?? ''}

  <!-- =====================================================================
       SECTION 1: APPLICATION OVERVIEW
       ===================================================================== -->
  <div class="page-break"></div>
  <div class="page-header-bar">
    ${LOGO_SVG}
    <div style="text-align:right;">
      <div style="font-size:8.5pt;font-weight:700;color:#0d1f3c;font-family:'IBM Plex Sans',sans-serif;">${jMeta.reportTitle}</div>
      <div style="font-size:7.5pt;color:#64748b;font-family:'IBM Plex Mono',monospace;">${dateStr} &mdash; PRELIMINARY SCREENING</div>
    </div>
  </div>
  <div class="page-header-rule"></div>

  ${buildCertificateBadge({
    assetId: 'CL-' + Math.abs((params.depth | 0) ^ ((params.porosity * 1000) | 0) ^ ((params.area * 10) | 0)).toString(16).padStart(6, '0').substring(0,6).toUpperCase() + '-' + ((params.porosity * 100) | 0) + '-' + ((params.area) | 0),
    formationName,
    storedMt: result?.storageCapacity ?? 0,
    safetyFactor: geomechanics?.safetyFactor ?? null,
    containmentPct: ((result?.containmentProbability ?? 0) * 100),
    jurisdiction,
    dateStr,
  })}

  <h2>1. Application Overview</h2>
  ${simulationYear != null && projectYears != null && simulationYear < projectYears ? `
  <div style="border:1px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:8px 14px;margin-bottom:10px;">
    <strong style="color:#92400e;">&#x26A0; Simulation snapshot at year ${simulationYear} of ${projectYears}.</strong>
    <span style="color:#92400e;font-size:9pt;"> Stored mass and trapping values are intermediate — not end-of-project totals. Re-run the simulation to completion and re-export for final figures.</span>
  </div>` : ''}
  <table>
    <thead><tr><th>Field</th><th>Detail</th></tr></thead>
    <tbody>
      <tr><td>Application Type</td><td>${jMeta.permitType}</td></tr>
      <tr><td>Regulatory Authority</td><td>${jMeta.authority}</td></tr>
      <tr><td>Legislation</td><td>${jMeta.legislation}</td></tr>
      <tr><td>Applicant</td><td>${orgName || '<em>[OPERATOR NAME — TO BE COMPLETED]</em>'}</td></tr>
      <tr><td>Project Name</td><td>${formationName} CO&#x2082; Storage Project</td></tr>
      <tr><td>Location</td><td>${formationLocation}</td></tr>
      <tr><td>Simulation State</td><td>Year ${simulationYear ?? '—'} of ${projectYears ?? '—'} — ${simulationYear != null && projectYears != null && simulationYear >= projectYears ? '<span class="badge-green">COMPLETE</span>' : '<span class="badge-amber">INTERMEDIATE</span>'}</td></tr>
      <tr><td>Prepared by</td><td>CarbonLens Simulation Studio v3</td></tr>
      <tr><td>Date</td><td>${dateStr}</td></tr>
      <tr><td>Status</td><td><span class="badge-amber">PRELIMINARY SCREENING — NOT FOR REGULATORY SUBMISSION</span></td></tr>
      ${jurisdiction === 'US' && (formationLocation.toLowerCase().includes('norway') || formationLocation.toLowerCase().includes('north sea') || formationLocation.toLowerCase().includes('barents')) ? `<tr><td>Regulatory Mapping</td><td><span class="badge-amber">HYPOTHETICAL — Formation is in ${formationLocation}; EPA Class VI regulations are mapped for academic exercise only. See back page disclaimer.</span></td></tr>` : ''}
    </tbody>
  </table>

  <!-- =====================================================================
       SECTION 2: STORAGE FORMATION CHARACTERISATION
       ===================================================================== -->
  <h2>2. Storage Formation Characterisation</h2>

  <h3>2.1 Reservoir Properties</h3>
  <table>
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Depth (top of storage interval)</td><td style="vertical-align:top;white-space:nowrap;">${params.depth?.toFixed(0) ?? '—'} m</td></tr>
      <tr><td>Thickness (storage interval)</td><td style="vertical-align:top;white-space:nowrap;">${params.thickness?.toFixed(1) ?? '—'} m</td></tr>
      <tr><td>Porosity</td><td style="vertical-align:top;white-space:nowrap;">${(params.porosity * 100)?.toFixed(1) ?? '—'}%</td></tr>
      <tr><td>Permeability</td><td style="vertical-align:top;white-space:nowrap;">${params.permeability?.toFixed(1) ?? '—'} mD</td></tr>
      <tr><td>Initial Pore Pressure</td><td style="vertical-align:top;white-space:nowrap;">${params.pressure?.toFixed(2) ?? '—'} MPa</td></tr>
      <tr><td>Temperature</td><td style="vertical-align:top;white-space:nowrap;">${params.temperature?.toFixed(1) ?? '—'} °C</td></tr>
      <tr><td>Formation Area</td><td style="vertical-align:top;white-space:nowrap;">${params.area?.toFixed(2) ?? '—'} km²</td></tr>
      <tr><td>Net-to-Gross Ratio</td><td style="vertical-align:top;white-space:nowrap;">${(params.netToGross * 100)?.toFixed(1) ?? '—'}%</td></tr>
      <tr><td>Geometry Type</td><td style="vertical-align:top;white-space:nowrap;">${params.geometryType ?? '—'}</td></tr>
      <tr><td>Salinity (monovalent NaCl-equiv.)</td><td style="vertical-align:top;">${params.monovalentSalinity?.toFixed(3) ?? '—'} mol/kg${params.monovalentSalinity != null && params.monovalentSalinity < 0.1 ? ' <em style="color:#d97706;">(&#x26A0; near zero — Duan-Sun model requires &gt;0.1 mol/kg)</em>' : ''}</td></tr>
      <tr><td>Salinity (bivalent CaCl&#x2082;-equiv.)</td><td style="vertical-align:top;white-space:nowrap;">${params.bivalentSalinity?.toFixed(3) ?? '—'} mol/kg</td></tr>
      <tr><td>Hydrocarbon Content (CH&#x2084;/N&#x2082;)</td><td style="vertical-align:top;white-space:nowrap;">CH&#x2084;: ${(params.methaneFraction * 100).toFixed(1)}% &nbsp;|&nbsp; N&#x2082;: ${(params.nitrogenFraction * 100).toFixed(1)}%</td></tr>
    </tbody>
  </table>

  <h3>2.2 Caprock &amp; Seal Properties</h3>
  <table>
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Caprock Friction Angle</td><td>${params.caprockFriction?.toFixed(1) ?? '—'}°</td></tr>
      <tr><td>Caprock Cohesion</td><td>${params.caprockCohesion?.toFixed(2) ?? '—'} MPa</td></tr>
      <tr><td>Biot Coefficient</td><td>${params.biotCoefficient?.toFixed(3) ?? '—'}</td></tr>
      <tr><td>Fracture Pressure — Simple Overpressure Gradient (0.9 × (Pp + z×0.0226)) <em style="font-size:8pt;color:#94a3b8;">― approximate upper bound; overestimates true fracture pressure</em></td><td>${estimatedFracPressure.toFixed(2)} MPa</td></tr>
      <tr><td>Fracture Pressure — Hubbert-Willis + Mohr-Coulomb (governing value) <em style="font-size:8pt;color:#94a3b8;">― used for MAIP and safety factor in Section 6</em></td><td>${geomechanics != null ? geomechanics.fracturePressure.toFixed(2) + ' MPa' : '<em>Run geomechanics assessment</em>'}</td></tr>
      <tr><td>Minimum Horizontal Stress (σ<sub>h</sub> = K<sub>0</sub> × S<sub>v</sub>)</td><td>${geomechanics != null ? geomechanics.minHorizontalStress.toFixed(2) + ' MPa' : '<em>Run geomechanics assessment</em>'}</td></tr>
      <tr><td>Maximum Allowable Injection Pressure (MAIP = 0.9 × Hubbert-Willis fracture P)</td><td>${geomechanics != null ? geomechanics.maip.toFixed(2) + ' MPa' : '<em>Run geomechanics assessment</em>'}</td></tr>
    </tbody>
  </table>

  <h3>2.3 CO&#x2082; Phase State at Reservoir Conditions</h3>
  <div class="section-box">
    <p>At reservoir conditions of <strong>${params.temperature?.toFixed(1) ?? '—'}°C</strong> and <strong>${params.pressure?.toFixed(2) ?? '—'} MPa</strong>, CO&#x2082; is expected to be in <strong class="${phaseLabel === 'supercritical' ? 'accent' : 'risk-moderate'}">${phaseLabel}</strong> phase. ${phaseLabel === 'supercritical' ? `Supercritical CO&#x2082; at these conditions has a density of approximately <strong>${result?.co2Density?.toFixed(0) ?? params.pressure > 0 ? '~600–850' : '—'} kg/m&#xB3;</strong>, providing efficient storage per unit pore volume.` : `Subcritical conditions reduce storage efficiency. Consider increasing injection depth or targeting a warmer/higher-pressure formation for improved storage efficiency.`}</p>
  </div>

  <!-- =====================================================================
       SECTION 3: INJECTION WELL PROGRAMME
       ===================================================================== -->
  <h2>3. Injection Well Programme</h2>

  <h3>3.1 Well Configuration</h3>
  <table>
    <thead><tr><th>Well ID</th><th>Grid Position</th><th>Rate (Mt/yr)</th><th>Ramp-up (yr)</th><th>Ramp-down (yr)</th><th>Project Duration (yr)</th></tr></thead>
    <tbody>
      ${wells.map((w) => `<tr>
        <td><strong>${w.label ?? w.id}</strong></td>
        <td>(${w.x?.toFixed(0) ?? '—'}, ${w.z?.toFixed(0) ?? '—'})</td>
        <td>${w.injectionRate?.toFixed(3) ?? '—'}</td>
        <td>${w.rampUpYears ?? '—'}</td>
        <td>${w.rampDownYears ?? '—'}</td>
        <td>${projectYears ?? '—'}</td>
      </tr>`).join('')}
      <tr style="background:#f1f5f9; font-weight:600;">
        <td>TOTAL</td><td></td>
        <td>${totalWellRate.toFixed(3)} Mt/yr</td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>
  <p class="muted" style="font-size:8pt; margin-top:4px;">Project Duration is the full injection period. Cumulative CO&#x2082; injection is lower than (Rate × Duration) when ramp periods are present, as the well is not at peak rate for the entire project lifetime.</p>

  <h3>3.2 Injection Schedule</h3>
  <div class="section-box">
    <p>The injection programme consists of <strong>${wells.length}</strong> injection well(s) with a total design injection rate of <strong>${totalWellRate.toFixed(3)} Mt/yr</strong> over a project duration of <strong>${projectYears ?? '—'} years</strong>. Well ramp-up periods of <strong>${minRampUp}–${maxRampUp} years</strong> are specified to manage reservoir pressure build-up and allow geomechanical monitoring before reaching peak injection rate. Cumulative mass injected accounts for the quadratic ramp-up and ramp-down schedules and is therefore less than the simple product of peak rate × project duration. All wells shall be subject to mechanical integrity testing prior to commencement of injection.</p>
  </div>

  <h3>3.3 Near-Wellbore Halite Precipitation Risk</h3>
  ${(() => {
    const hr = result?.haliteRisk
    if (!hr) return '<p class="muted">Run the simulation to compute halite risk.</p>'
    const riskBadge = hr.risk === 'low'
      ? '<span class="badge-green">LOW</span>'
      : hr.risk === 'moderate'
        ? '<span class="badge-amber">MODERATE</span>'
        : '<span class="badge-red">HIGH</span>'
    return `
  <div style="border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin-bottom:10px; background:#fafafa; border-left:4px solid ${hr.risk === 'low' ? '#10b981' : hr.risk === 'moderate' ? '#f59e0b' : '#ef4444'};">
    <p style="margin-bottom:6px;">${riskBadge} <strong>Halite risk assessment</strong> — Zeidouni (2009) dryout-radius model</p>
    <p style="font-size:9.5pt;">${hr.message}</p>
  </div>
  <table>
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Formation Brine TDS</td><td>${hr.salinityGPL.toFixed(0)} g/L</td></tr>
      <tr><td>Effective Dryout Radius (temperature-adjusted)</td><td>${hr.dryoutRadius_m.toFixed(2)} m</td></tr>
      <tr><td>Risk Level</td><td>${riskBadge}</td></tr>
      <tr><td>Recommendation</td><td style="font-size:9pt;">${hr.recommendation}</td></tr>
    </tbody>
  </table>
  <p class="muted" style="font-size:8pt; margin-top:6px;">
    Dryout radius computed from Zeidouni et al. (2009) Int. J. GHG Control 3(5):600–611. A dryout radius above 2 m with TDS &gt; 200 g/L constitutes a high-risk scenario requiring active injectivity management. This is a wellbore-scale screening metric only — pore-scale precipitation dynamics require laboratory core-flood testing for detailed assessment.
  </p>`
  })()}

  <h3>3.4 Wellbore Design Schematic</h3>
  <div style="margin:10px 0;">
    <p style="font-size:9.5pt; margin-bottom:10px;">The following schematic illustrates the reference well design for this storage project. Casing programme is generated from formation depth and thickness following standard CCUS well architecture (surface casing → intermediate casing → CO₂ injection liner). Actual well design must be confirmed during detailed engineering.</p>
    <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start;">
      ${(() => {
        const wellDesign: WellDesign = defaultWellDesign(params.depth, params.thickness)
        const schemSVG = generateWellboreSVGString(wellDesign, 'REFERENCE WELL DESIGN')
        return `<div>${schemSVG}</div>
      <div style="flex:1; min-width:180px;">
        <table style="font-size:9pt;">
          <thead><tr><th>Casing String</th><th>OD (in)</th><th>Top (m)</th><th>Base (m)</th><th>Cement Top (m)</th></tr></thead>
          <tbody>
            ${wellDesign.casingStrings.map(c => `<tr>
              <td>${c.name}${c.isInjectionString ? ' ★' : ''}</td>
              <td>${c.outerDiameter_in}"</td>
              <td>${c.topDepth_m.toFixed(0)}</td>
              <td>${c.bottomDepth_m.toFixed(0)}</td>
              <td>${c.cementTopDepth_m.toFixed(0)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <p class="muted" style="font-size:8pt; margin-top:8px;">★ Injection string. Cement covers full caprock interval as primary barrier. Perforation interval: ${wellDesign.perforationTopDepth_m.toFixed(0)}–${wellDesign.perforationBottomDepth_m.toFixed(0)} m.</p>
        <p class="muted" style="font-size:8pt; margin-top:4px;">All injection string metallurgy must be rated for CO₂/carbonic-acid service (corrosion-resistant alloy or CRA-lined). Cement formulation must be CO₂-resistant (e.g., Class G + silica flour blend).</p>
      </div>`
      })()}
    </div>
  </div>

  <!-- =====================================================================
       SECTION 4: AREA OF REVIEW (AoR)
       ===================================================================== -->
  <h2>4. Area of Review (AoR)</h2>
  <div class="section-box">
    <p>The Area of Review (AoR) is the region surrounding the CO&#x2082; storage complex within which elevated formation pressures could cause CO&#x2082; or displaced brine to migrate into underground sources of drinking water (USDW) or other protected resources. The AoR must be delineated using computational modelling and updated at regular intervals throughout the project lifetime.</p>
  </div>
  ${result?.formationRegime ? (() => {
    const fr = result.formationRegime!
    const regimeBadgeColor: Record<string, string> = {
      BUOYANCY_DOMINATED: '#166534',
      MIXED: '#854d0e',
      PRESSURE_DOMINATED: '#7f1d1d',
      INJECTIVITY_LIMITED: '#581c87',
    }
    const regimeBorderColor: Record<string, string> = {
      BUOYANCY_DOMINATED: '#22c55e',
      MIXED: '#eab308',
      PRESSURE_DOMINATED: '#ef4444',
      INJECTIVITY_LIMITED: '#a855f7',
    }
    const bgColor = regimeBadgeColor[fr.type] ?? '#1e293b'
    const borderColor = regimeBorderColor[fr.type] ?? '#64748b'
    const metricLabel: Record<string, string> = {
      plume_radius: 'VE Plume Radius (Boait 2012)',
      bhp_buildup: 'Wellbore BHP / Pressure Buildup',
      injectivity_index: 'Injectivity Index',
    }
    return `
  <div style="background:${bgColor};border-left:4px solid ${borderColor};padding:12px 16px;border-radius:6px;margin:10px 0 14px 0;font-size:9pt;line-height:1.6;">
    <strong style="color:${borderColor};">Formation Physics Regime: ${fr.type.replace(/_/g,' ')}</strong>
    &nbsp;&middot;&nbsp;
    <span style="color:#94a3b8;">Primary validation metric: <strong style="color:#e2e8f0;">${metricLabel[fr.primaryMetric] ?? fr.primaryMetric}</strong></span>
    &nbsp;&middot;&nbsp;
    <span style="color:#94a3b8;">VE model: <strong style="color:${fr.veIsValid ? '#22c55e' : '#f87171'};">${fr.veIsValid ? 'APPLICABLE' : 'NOT APPLICABLE'}</strong></span>
    &nbsp;&middot;&nbsp;
    <span style="color:#94a3b8;">Screening score: <strong style="color:#e2e8f0;">${fr.screeningScore.toFixed(0)}/100</strong></span>
    ${fr.warningBanner ? `<br/><span style="color:#fca5a5;margin-top:4px;display:block;">${fr.warningBanner}</span>` : ''}
    ${fr.failedCriteria.length > 0 ? `<br/><span style="color:#fca5a5;font-size:8pt;">Failed criteria: ${fr.failedCriteria.join(', ')}</span>` : ''}
    ${fr.amberCriteria.length > 0 ? `<br/><span style="color:#fcd34d;font-size:8pt;">Marginal criteria: ${fr.amberCriteria.join(', ')}</span>` : ''}
  </div>`
  })() : ''}
  <table>
    <thead><tr><th>Parameter</th><th>Value</th><th>Method</th></tr></thead>
    <tbody>
      <tr><td>Estimated Plume Radius${result?.hessePostInjection ? ' — <strong>post-injection</strong>' : wells.length > 1 ? ' (per-well, analytical)' : ''}</td><td>${plumeRadius.toFixed(0)} m</td><td>${result?.hessePostInjection ? 'Hesse et al. (2008) post-injection gravity current — leading shock front position (replaces injection-phase estimate)' : `Gravity-current spreading (Boait 2012 calibration)${wells.length > 1 ? `; ${wells.length}-well programme — individual radii merge into compound multi-well plume over the simulation horizon` : ''}`}${result?.formationRegime && !result.formationRegime.veIsValid ? ' <em style="color:#f87171;">[VE model not applicable for this formation — radius shown for reference only]</em>' : ''}</td></tr>
      <tr><td>Plume Height (vertical extent)</td><td>${plumeHeight.toFixed(0)} m</td><td>Fraction of formation thickness</td></tr>
      <tr><td>AoR Radius — Pressure Threshold (primary)</td><td><strong>${aorRadiusDynamic.toFixed(0)} m</strong></td><td>Nordbotten (2005) two-phase composite ΔP = 1 psi (0.007 MPa) contour at year ${aorYear}${aorRadiusDynamic === 0 ? ' <em style="color:#d97706;">(High permeability — ΔP dissipates below 1 psi at all radii. AoR governed by geometric 3× multiplier.)</em>' : ''}</td></tr>
      <tr><td>AoR Radius — Geometric (3× plume, secondary)</td><td>${aorRadiusLegacy.toFixed(0)} m</td><td>Legacy 3× multiplier — retained as conservative check</td></tr>
      <tr><td><strong>Adopted AoR Search Radius</strong></td><td><strong>${aorRadius.toFixed(0)} m</strong></td><td>Max of pressure-threshold and geometric radii</td></tr>
      <tr><td>AoR Area (circular approximation)</td><td>${(aorArea / 1e6).toFixed(2)} km²</td><td>π × r²</td></tr>
    </tbody>
  </table>
  <p class="muted" style="font-size:8pt; margin-top:6px;">
    The pressure-threshold AoR is derived using the Nordbotten, Celia &amp; Bachu (2005) two-phase composite pressure model. This model partitions the pressure response into an outer single-phase brine zone (governed by brine mobility and the exponential integral E₁) and a near-well CO₂ zone corrected by the effective mobility ratio. The AoR radius is the distance at which the composite pressure perturbation decays to 1 psi (0.007 MPa) — the standard criterion for potential brine displacement into an Underground Source of Drinking Water (USDW). This method is consistent with EPA Class VI guidance (40 CFR 146.84) and supersedes the single-phase Theis (1935) inversion for two-phase CO₂ storage conditions. A full regulatory AoR must also account for abandoned wellbores, faults, and multi-phase pressure fronts via dynamic 3D simulation.
  </p>
  ${result?.hessePostInjection ? `
  <h3 style="margin-top:18px;">4.1 Post-Injection Plume Evolution (Hesse et al. 2008)</h3>
  <div class="section-box">
    <p>All injection wells have shut in. The CO&#x2082; plume is now evolving as a gravity current governed by the Buckley-Leverett scalar conservation law with residual trapping. Two propagating shock fronts are tracked: a <strong>leading front</strong> (mobile CO&#x2082; advancing outward) and a <strong>trailing front</strong> (residual trapping boundary retreating inward, leaving permanently immobilised CO&#x2082; behind). Reference: Hesse, Orr &amp; Tchelepi (2008), J. Fluid Mech. 611:35&#x2013;60.</p>
  </div>
  <table>
    <thead><tr><th>Parameter</th><th>Value</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td>Leading Front Radius (mobile plume outer edge)</td><td><strong>${result.hessePostInjection.r_leading_m.toFixed(0)} m</strong></td><td>Rankine-Hugoniot shock on Buckley-Leverett fractional flow — outer boundary for AoR and monitoring well placement</td></tr>
      <tr><td>Trailing Front Radius (residual trapping boundary)</td><td>${result.hessePostInjection.r_trailing_m.toFixed(0)} m</td><td>CO&#x2082; inside this radius is permanently residually trapped (Land 1968 snap-off)</td></tr>
      <tr><td>Mobile CO&#x2082; Fraction</td><td>${(result.hessePostInjection.mobile_fraction * 100).toFixed(1)}%</td><td>Free-phase CO&#x2082; above S<sub>gr</sub> — buoyancy-driven migration risk applies to this fraction</td></tr>
      <tr><td>Newly Residually Trapped (since shut-in)</td><td>${(result.hessePostInjection.newly_trapped_fraction * 100).toFixed(1)}%</td><td>Incremental trapping accrued since end of injection via imbibition front sweepback</td></tr>
      <tr><td>End-Point Mobility Ratio (M)</td><td>${result.hessePostInjection.mobility_ratio.toFixed(2)}</td><td>M = (k<sub>rg,max</sub> / &#x3BC;<sub>CO&#x2082;</sub>) / (k<sub>rw,max</sub> / &#x3BC;<sub>brine</sub>) — governs shock structure</td></tr>
      <tr><td>Dimensionless Time (&#x3C4;)</td><td>${result.hessePostInjection.tau.toFixed(2)}</td><td>&#x3C4; = t<sub>total</sub> / t<sub>inj</sub>; &#x3C4; = 1.0 at shut-in; plume spreading rate scales as &#x221A;&#x3C4;</td></tr>
      <tr><td>Leading Shock Saturation</td><td>${(result.hessePostInjection.leading_shock_saturation * 100).toFixed(1)}%</td><td>CO&#x2082; saturation immediately behind the leading front (Welge tangent construction)</td></tr>
    </tbody>
  </table>
  <p class="muted" style="font-size:8pt;margin-top:6px;">
    The post-injection AoR is governed by the Hesse (2008) leading front radius reported above. The injection-phase gravity-current estimate is superseded once wells shut in. Monitoring wells should be placed at or beyond the leading front radius. The mobile fraction is the primary risk metric for buoyancy-driven migration during the post-injection monitoring period required under 40 CFR 146.93.
  </p>
  ` : ''}

  ${(result != null && (result.capacityUtilPct ?? 0) > 100) ? `
  <div style="border:2px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:12px 16px;margin-top:10px;">
    <strong style="color:#92400e;">&#x26A0; Capacity Utilisation Exceeds P50 Estimate</strong>
    <p style="font-size:9pt;color:#92400e;margin-top:6px;">Capacity utilisation of ${result.capacityUtilPct?.toFixed(1) ?? '—'}% exceeds P50 capacity. At this utilisation level, the formation is operating in the P10 tail of the storage estimate. A revised injection programme reducing total injection below P50 capacity, or explicit uncertainty quantification demonstrating P10 capacity meets the injection target with adequate confidence, must be submitted with the permit application.</p>
  </div>` : ''}

  <!-- =====================================================================
       SECTION 5: STORAGE CAPACITY ANALYSIS
       ===================================================================== -->
  <h2>5. Storage Capacity Analysis</h2>

  <h3>5.1 DOE Statistical Capacity Estimate (Goodman et al. 2011)</h3>
  <table>
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Gross Pore Volume<br><span style="font-size:8pt;color:#64748b;">${params.area.toFixed(2)} km² &times; ${(params.thickness / 1000).toFixed(4)} km &times; ${(params.porosity * 100).toFixed(1)}% porosity</span></td><td>${grossPoreVolume.toFixed(4)} km³</td></tr>
      <tr><td>CO&#x2082; Density at Reservoir Conditions</td><td>${result?.co2Density?.toFixed(1) ?? '—'} kg/m&#xB3;</td></tr>
      <tr><td>P10 Capacity (optimistic, 10th percentile)</td><td>${result?.p90?.toFixed(2) ?? '—'} Mt</td></tr>
      <tr><td>P50 Capacity (best estimate, 50th percentile)</td><td>${result?.totalCapacity?.toFixed(2) ?? '—'} Mt</td></tr>
      <tr><td>P90 Capacity (conservative, 90th percentile)</td><td>${result?.p10?.toFixed(2) ?? '—'} Mt</td></tr>
      <tr><td>Capacity Utilisation (this project)</td><td>${result?.capacityUtilPct?.toFixed(1) ?? '—'}%</td></tr>
      <tr><td>Storage Efficiency Coefficient (Cc)</td><td>2.0% (DOE P50)</td></tr>
      ${result?.vePlumeArea != null ? `<tr><td>VE Plume Footprint (2D vertical equilibrium)</td><td>${result.vePlumeArea.toFixed(3)} km²</td></tr>` : ''}
      ${result?.vePlumeArea != null || result?.vePlumeRadius != null ? `<tr><td>VE Effective Plume Radius${wells.length > 1 ? ' (composite, derived from footprint)' : ''}</td><td>${(() => {
        // For multi-well runs the per-well analytical vePlumeRadius is physically inconsistent
        // with the total stored mass (it pulls results.wells[0] initial radius).
        // Derive the composite radius from the combined VE plume footprint area instead:
        //   r_eff = sqrt(A_km2 × 1e6 / π)   [km² → m²]
        if (wells.length > 1 && result?.vePlumeArea != null && result.vePlumeArea > 0) {
          const rEff = Math.sqrt(result.vePlumeArea * 1e6 / Math.PI)
          return rEff.toFixed(0) + ' m'
        }
        return result?.vePlumeRadius != null ? result.vePlumeRadius.toFixed(0) + ' m' : '—'
      })()}</td></tr>` : ''}
    </tbody>
  </table>
  <p class="muted">Capacity estimates follow DOE Goodman et al. (2011) methodology applied to gross pore volume. Storage efficiency coefficient Cc = 2.0% represents the P50 statistical estimate for saline aquifer storage.</p>

  <h3>5.2 Trapping Mechanism Distribution (at project end)</h3>
  ${(result != null && storedTotal > 0) ? (() => {
    const trappingSum = residual + solubility + mineral + mobile
    const allZero = trappingSum < 1e-9
    return `
  <table>
    <thead><tr><th>Trapping Mechanism</th><th>Volume (Mt)</th><th>% of Tracked Mass</th></tr></thead>
    <tbody>
      <tr><td>Residual (capillary) trapping</td><td>${residual.toFixed(4)}</td><td>${pctR}%</td></tr>
      <tr><td>Dissolution trapping (still dissolved) <sup>†</sup></td><td>${dissolvedOnly.toFixed(4)}</td><td>${pctS}%</td></tr>
      <tr><td>Mineral trapping (precipitated carbonate) <sup>†</sup></td><td>${mineral.toFixed(4)}</td><td>${pctM}%</td></tr>
      <tr><td>Structural Trapping</td><td>${mobile.toFixed(4)}</td><td>${pctMob}%</td></tr>
      <tr style="background:#e0f2fe;"><td><strong>Tracked Total (model components)</strong></td><td><strong>${trappingRef.toFixed(4)}</strong></td><td><strong>100%</strong></td></tr>
      ${storedTotal > 0 && Math.abs(storedTotal - trappingRef) > storedTotal * 0.05 ? `<tr style="background:#f0f9ff;"><td>Cumulative Injection (total)</td><td>${storedTotal.toFixed(4)}</td><td style="font-size:8.5pt;color:#1e40af;">Re-run simulation to completion for full mass-balance breakdown. (${(trappingRef / storedTotal * 100).toFixed(1)}% of injected mass currently tracked in trapping components.)</td></tr>` : ''}
    </tbody>
  </table>
  ${allZero ? `<div style="border:1px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:10px 14px;margin-top:8px;">
    <strong style="color:#92400e;">&#x26A0; Trapping values are all zero.</strong>
    <span style="color:#92400e;font-size:9pt;"> The simulation may have been exported before completion, or was reset after the last run. Re-run the full simulation (Run button) and wait for it to reach the final project year before exporting this permit. The storageCapacity (${storedTotal.toFixed(2)} Mt) reflects cumulative injection but the trapping breakdown requires the stateful simulation to have run to completion.</span>
  </div>` : ''}
  <p class="muted" style="font-size:8pt;">Percentages computed against the tracked component mass (residual + solubility + mobile), which is internally mass-conserved by the analytical simulation model. Mineral trapping only activates after year 50. <sup>†</sup> Dissolution and mineral rows are non-overlapping subsets: mineral row shows dissolved CO&#x2082; that has further precipitated as carbonate; dissolution row shows the remaining aqueous fraction. Together they equal the total solubility-trapped volume.</p>`
  })() : '<p class="muted">Simulation not completed or still at year 0. Run the full simulation to populate trapping mechanism distribution.</p>'}

  <h3>5.3 Project Economics &amp; Financial Viability</h3>
  <div class="two-col" style="page-break-inside: avoid; margin-bottom: 15px;">
    <div>
      <p style="font-size:8.5pt; color:#64748b; font-weight:600; margin-bottom:6px; text-transform:uppercase;">Financial Summary</p>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Jurisdiction Carbon Credit/Pricing</td><td><strong>${carbonPriceDisplayPermit}</strong></td></tr>
          <tr><td>Total CAPEX</td><td>$${capex.toFixed(1)}M</td></tr>
          <tr><td>OPEX (per tonne)</td><td>$${opexPerTonne.toFixed(2)}/t</td></tr>
          <tr><td>Total OPEX</td><td>$${totalOpex.toFixed(1)}M</td></tr>
          <tr><td>Levelized Cost (LCO₂S)</td><td><strong>$${breakevenCost.toFixed(2)}/t</strong></td></tr>
          <tr><td>Net Cost after Credits</td><td><span style="font-weight:700; color:${breakevenCost - credit45q < 0 ? '#ef4444' : '#10b981'};">$${(breakevenCost - credit45q).toFixed(2)}/t</span></td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <p style="font-size:8.5pt; color:#64748b; font-weight:600; margin-bottom:6px; text-transform:uppercase;">CAPEX Breakdown</p>
      <table style="font-size:8.5pt;">
        <tbody>
          <tr>
            <td style="padding:4px 6px;">Drilling</td>
            <td style="padding:4px 6px; width:100px;">
              <div class="bar-track"><div style="width:${(drillCost / capex * 100).toFixed(1)}%; background:#3b82f6; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:4px 6px;">$${drillCost.toFixed(1)}M (${(drillCost / capex * 100).toFixed(0)}%)</td>
          </tr>
          <tr>
            <td style="padding:4px 6px;">Facilities</td>
            <td style="padding:4px 6px;">
              <div class="bar-track"><div style="width:${(facilityCost / capex * 100).toFixed(1)}%; background:#14b8a6; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:4px 6px;">$${facilityCost.toFixed(1)}M (${(facilityCost / capex * 100).toFixed(0)}%)</td>
          </tr>
          <tr>
            <td style="padding:4px 6px;">Pipeline</td>
            <td style="padding:4px 6px;">
              <div class="bar-track"><div style="width:${(pipelineCost / capex * 100).toFixed(1)}%; background:#f59e0b; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:4px 6px;">$${pipelineCost.toFixed(1)}M (${(pipelineCost / capex * 100).toFixed(0)}%)</td>
          </tr>
          <tr>
            <td style="padding:4px 6px;">Monitoring</td>
            <td style="padding:4px 6px;">
              <div class="bar-track"><div style="width:${(monitoringCost / capex * 100).toFixed(1)}%; background:#8b5cf6; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:4px 6px;">$${monitoringCost.toFixed(1)}M (${(monitoringCost / capex * 100).toFixed(0)}%)</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  ${generateEconomicsNPVChartSVG(params, wells, result, projectYears, jurisdiction)}

  ${hmResult ? buildHMCalibrationCard(hmResult) : ''}
  ${mcResult ? buildMCUncertaintyCard(mcResult) : ''}

  <h3>5.4 Reservoir Parameter Sensitivity Analysis</h3>
  <p class="muted">
    One-at-a-time (OAT) sensitivity of P50 storage capacity. Bar widths reflect the actual uncertainty ranges used in the Monte Carlo run for this formation — axes are rebuilt per simulation, not cached from prior runs.
    Injection pressure overpressure (ΔP = BHP − P<sub>i</sub>) varies inversely with permeability and thickness: a 20% reduction in either parameter increases ΔP by ~25%, elevating the geomechanical fracture risk.
  </p>
  ${generateSensitivityTornadoSVG(params, result, mcResult)}

  <!-- =====================================================================
       SECTION 6: GEOMECHANICAL RISK ASSESSMENT
       ===================================================================== -->
  <h2>6. Geomechanical Risk Assessment</h2>
  ${geoSection6}
  ${geomechanics ? generatePressureRateChartSVG(params, wells, geomechanics, projectYears) : ''}
  ${geomechanics ? `
  <div style="margin-top: 12px; font-size: 9.5pt; line-height: 1.5; color: #334155; page-break-inside: avoid;">
    <strong style="color: #0d1f3c;">Fracture Mechanics &amp; Containment Assurance:</strong>
    Exceeding the caprock fracture pressure or triggering Mohr-Coulomb shear failure along fault planes poses severe risks to storage integrity and flow assurance. 
    Tensile fracturing in the reservoir or caprock creates high-permeability pathways, allowing injected CO₂ to bypass lower-permeability matrix zones, leading to premature plume breakthrough, loss of sweep efficiency, and potential vertical migration into upper aquifers or the atmosphere.
    To ensure long-term containment, the injection pressure must be strictly managed below the Maximum Allowable Injection Pressure (MAIP = ${geomechanics.maip.toFixed(2)} MPa), ensuring a safe geomechanical operating envelope.
  </div>
  ` : ''}

  <!-- =====================================================================
       SECTION 7: MONITORING, REPORTING & VERIFICATION (MRV) PLAN
       ===================================================================== -->
  <div class="page-break"></div>

  <h2>7. Monitoring, Reporting &amp; Verification (MRV) Plan</h2>
  <p style="margin-bottom:10px; font-size:9.5pt;">A comprehensive MRV plan is a mandatory component of all CO&#x2082; storage permits. The following table outlines the proposed monitoring activities. The plan will be refined during detailed engineering and must be approved by the competent authority prior to injection commencement.</p>
  <table>
    <thead><tr><th>Activity</th><th>Frequency</th><th>Method</th><th>Objective</th></tr></thead>
    <tbody>
      <tr><td>Wellhead pressure monitoring</td><td>Continuous</td><td>SCADA/DCS</td><td>Detect injection anomalies</td></tr>
      <tr><td>Formation pressure monitoring</td><td>Monthly</td><td>Downhole gauges</td><td>Track reservoir pressure evolution</td></tr>
      <tr><td>4D seismic survey</td><td>Every 2–3 years</td><td>3D seismic</td><td>Plume migration verification</td></tr>
      <tr><td>Microseismic monitoring</td><td>Continuous (first 5 years)</td><td>Array of geophones</td><td>Induced seismicity detection</td></tr>
      <tr><td>Groundwater quality sampling</td><td>Annual</td><td>Sampling wells</td><td>USDW / aquifer protection</td></tr>
      <tr><td>Surface flux monitoring</td><td>Annual</td><td>LIDAR / eddy covariance</td><td>CO&#x2082; surface leakage detection</td></tr>
      <tr><td>Injection well integrity</td><td>Annual MIT</td><td>Pressure test / logging</td><td>Well barrier integrity</td></tr>
      <tr><td>CO&#x2082; stream composition</td><td>Per injection batch</td><td>GC analysis</td><td>Purity certification</td></tr>
    </tbody>
  </table>
  <p class="muted" style="margin-top:8px;">MRV reporting frequency: annual report to regulatory authority + immediate notification if anomaly detected.</p>

  <!-- =====================================================================
       SECTION 8: SITE CLOSURE & POST-CLOSURE PLAN
       ===================================================================== -->
  <h2>8. Site Closure &amp; Post-Closure Plan</h2>
  <div class="section-box">
    <p>The site closure plan shall be submitted to <strong>${jMeta.authority}</strong> at least <strong>${jurisdiction === 'US' ? '6 months' : '24 months'}</strong> prior to cessation of injection. Post-closure monitoring shall continue for a minimum of <strong>${jurisdiction === 'US' ? '50' : '20'} years</strong> or until the authority issues a Certificate of Completion confirming permanent containment.</p>
  </div>
  <table>
    <thead><tr><th>Criterion</th><th>Target</th><th>Method</th></tr></thead>
    <tbody>
      <tr><td>Plume stabilisation</td><td>No net migration &gt; 1 km/yr</td><td>4D seismic</td></tr>
      <tr><td>Pressure return</td><td>Within 10% of pre-injection pressure</td><td>Downhole gauges</td></tr>
      <tr><td>No detectable leakage</td><td>Zero flux anomalies above background</td><td>Surface monitoring</td></tr>
      <tr><td>Well plug integrity</td><td>Zero annular pressure</td><td>MIT</td></tr>
    </tbody>
  </table>

  <!-- =====================================================================
       SECTION 9: REGULATORY COMPLIANCE CHECKLIST
       ===================================================================== -->
  <h2>9. Regulatory Compliance Checklist</h2>
  <p class="muted" style="margin-bottom:8px;">The following items are required under <strong>${jMeta.legislation}</strong>. Each item must be completed and submitted to the competent authority as part of the formal permit application.</p>
  <div class="section-box">
    ${jMeta.complianceItems.map((item) => `
    <div class="checklist-item">
      <span class="check-no">&#x2610;</span>
      <div>
        <span>${item}</span>
        <span style="font-size:8pt; color:#94a3b8; margin-left:8px;">— Status: <em>To be completed before formal submission</em></span>
      </div>
    </div>`).join('')}
  </div>

  <!-- =====================================================================
       SECTION 10: DISCLAIMER & DATA PROVENANCE
       ===================================================================== -->
  <h2>10. Disclaimer &amp; Data Provenance</h2>
  <div class="section-box" style="border-left: 4px solid #ef4444; background:#fff5f5;">
    <p style="font-size:9.5pt; color:#7f1d1d;"><strong>&#x26A0; IMPORTANT DISCLAIMER:</strong> This pre-application document was generated by CarbonLens Simulation Studio v3 using the scientific models listed below. All capacity estimates are preliminary screening values based on publicly available correlations and statistical methods. <strong>This document is NOT a formal regulatory permit application and has NOT been reviewed by the competent authority.</strong> Independent engineering review by a qualified petroleum or environmental engineer is required before formal submission to any regulatory body.</p>
  </div>

  <table style="margin-top:12px;">
    <thead><tr><th>Component</th><th>Model</th><th>Reference</th></tr></thead>
    <tbody>
      ${renderProvenanceTableRows()}
    </tbody>
  </table>

  <!-- Appendix: Reservoir Evolution Snapshots -->
  <div class="page-break"></div>
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
    ${LOGO_SVG}
    <span style="font-size:8pt; color:#94a3b8;">${jMeta.reportTitle} &mdash; ${dateStr} &mdash; PRELIMINARY</span>
  </div>
  <div style="height:2px; background:#00c4a0; margin-bottom:14px;"></div>
  <h2>Appendix A: Reservoir Simulation Snapshots</h2>
  <p style="font-size:9.5pt; margin-bottom:10px;">The following 10 images were captured from the CarbonLens 3D reservoir viewer at evenly-spaced simulation years. They illustrate CO&#x2082; plume migration, saturation evolution, and spatial distribution throughout the injection period. Screen view: auto-advancing animation. Print view: 2&times;5 image grid.</p>
  ${(() => {
    const frames = selectTenSnapshots(snapshots ?? [], projectYears ?? 20)
    if (frames.length === 0) return '<p class="muted" style="padding:8px 0;">No simulation snapshots available. Run a full simulation to generate reservoir evolution imagery.</p>'
    const dur = frames.length * 2
    const holdEnd = ((1 / frames.length) * 100 - 2).toFixed(1)
    const pct = ((1 / frames.length) * 100).toFixed(1)
    const kf = frames.map((_, i) => `.cl-app-f:nth-child(${i+1}){animation-delay:${(i * dur / frames.length).toFixed(1)}s}`).join('')
    return `
  <style>
  @keyframes cl-app-cycle {
    0%,${holdEnd}%{opacity:1}
    ${pct}%,100%{opacity:0}
  }
  @media screen {
    .cl-app-wrap{position:relative;width:100%;padding-bottom:56.25%;background:#0a1015;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;margin:10px 0;}
    .cl-app-f{position:absolute;inset:0;opacity:0;animation:cl-app-cycle ${dur}s linear infinite;}
    .cl-app-f:nth-child(1){opacity:1;}
    ${kf}
    .cl-app-f img{width:100%;height:100%;object-fit:contain;}
    .cl-app-lbl{position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:7.5pt;color:#94a3b8;background:rgba(0,0,0,0.45);padding:2px 0;}
    .cl-app-grid{display:none;}
  }
  @media print {
    .cl-app-wrap{display:none;}
    .cl-app-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0;}
    .cl-app-grid img{width:100%;border:1px solid #e2e8f0;border-radius:4px;}
    .cl-app-grid div{text-align:center;font-size:6.5pt;color:#64748b;margin-top:2px;}
  }
  </style>
  <div class="cl-app-wrap">
    ${frames.map((s) => `<div class="cl-app-f"><img src="${s.dataUrl}" alt="Year ${s.year}"><div class="cl-app-lbl">Year ${s.year} \u2014 CO\u2082 Plume Distribution</div></div>`).join('')}
  </div>
  <div class="cl-app-grid">
    ${frames.map((s) => `<div><img src="${s.dataUrl}" alt="Year ${s.year}"><div>Yr ${s.year}</div></div>`).join('')}
  </div>`
  })()}

  <!-- Footer -->
  <footer>
    <span>CarbonLens &mdash; ${window.location.hostname}</span>
    <span>${jMeta.reportTitle} &mdash; ${dateStr} &mdash; PRELIMINARY</span>
  </footer>

  ${buildEquationsPage({ organization: orgName, preparedBy: 'CarbonLens Simulation Studio v3', dateStr })}
  ${buildBackPage({ organization: orgName, preparedBy: 'CarbonLens Simulation Studio v3', dateStr })}
`

  const html = wrapHTML(coverTitle ?? jMeta.reportTitle, body)
  openPrintWindow(html)
}

// ---------------------------------------------------------------------------
// Pre-Screening Report (Executive Summary + Permit combined)
// ---------------------------------------------------------------------------

const PRESCREENING_DISCLAIMER = `PROFESSIONAL REVIEW DISCLAIMER: This document was generated by CarbonLens simulation software and has not been reviewed by a licensed attorney, certified professional geologist, or registered professional engineer. It does not constitute a complete permit application, legal advice, or a regulatory submission. All outputs must be reviewed and certified by a qualified professional before submission to any regulatory authority. CarbonLens provides screening-level accuracy appropriate for pre-FEED evaluation; site-specific numerical simulation may be required for final Class VI permit submission under 40 CFR Part 146 or equivalent jurisdiction-specific regulations.`

const PRESCREENING_PRINT_CSS = `
@media print {
  @page { margin-bottom: 25mm; }
  body::after {
    content: "CarbonLens Pre-Screening Report | Professional review required before regulatory submission | carbonlens.io";
    position: fixed;
    bottom: 8mm;
    left: 0; right: 0;
    text-align: center;
    font-size: 7pt;
    color: #666;
    border-top: 1px solid #ccc;
    padding-top: 3mm;
  }
}
`

export function openPreScreeningReport(
  formation: FormationParams,
  result: SimulationResult,
  geo: GeomechanicsResult | null,
  wells: Well[],
  formationName: string,
  location: string,
  jurisdiction: string,
  organization: string,
  snapshots: Array<{year: number; dataUrl: string}>,
  projectYears: number,
  timestep: number,
  hmResult?: OptimizationResult,
  mcResult?: PersistedMCResult,
): void {
  // Open executive summary and permit report as separate documents to avoid data repetition.
  openExecutiveSummary(
    formation, result, geo, wells,
    formationName, location,
    undefined, organization,
    snapshots, projectYears, timestep,
    jurisdiction, hmResult, mcResult,
  )
  openPermitApplication(
    formation, result, geo, wells,
    formationName, location, jurisdiction, organization,
    snapshots, projectYears, timestep,
    hmResult, mcResult,
  )
}
