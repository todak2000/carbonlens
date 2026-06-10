import type { FormationParams, SimulationResult, Well } from '../types'
import type { GeomechanicsResult } from '../types'

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
@page { size: A4; margin: 18mm 14mm 16mm 14mm; }
@page :first { margin: 0; size: A4; }
@page back-cover { margin: 0; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10pt; color: #1e293b; background: white; line-height: 1.5; }
h1 { font-size: 22pt; color: #0d1f3c; font-weight: 700; }
h2 { font-size: 13pt; color: #0d1f3c; font-weight: 700; margin: 16px 0 8px; border-bottom: 2px solid #00c4a0; padding-bottom: 4px; }
h3 { font-size: 11pt; color: #1e40af; font-weight: 600; margin: 12px 0 6px; }
p { margin: 6px 0; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
th { background: #0d1f3c; color: white; padding: 7px 10px; text-align: left; font-weight: 600; font-size: 9pt; }
td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
tr:nth-child(even) td { background: #f8fafc; }
.badge-green { background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 12px; font-size: 8.5pt; font-weight: 600; display: inline-block; }
.badge-amber { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 8.5pt; font-weight: 600; display: inline-block; }
.badge-red { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 12px; font-size: 8.5pt; font-weight: 600; display: inline-block; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
.kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; background: #f8fafc; border-top: 3px solid #00c4a0; }
.kpi-label { font-size: 7.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; margin-bottom: 4px; }
.kpi-value { font-size: 16pt; font-weight: 700; color: #0d1f3c; line-height: 1.2; }
.kpi-sub { font-size: 8pt; color: #64748b; margin-top: 2px; }
.bar-track { background: #e2e8f0; border-radius: 4px; height: 8px; margin: 4px 0; overflow: hidden; }
.section-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 12px 0; background: #fafafa; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
.accent { color: #00c4a0; font-weight: 600; }
.muted { color: #64748b; font-size: 9pt; }
footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between; }
.page-break { page-break-before: always; }
.no-break { page-break-inside: avoid; }
.cover { min-height: 240px; display: flex; flex-direction: column; justify-content: center; }
.cover-bar { background: linear-gradient(135deg, #0d1f3c 0%, #1e3a5f 100%); color: white; padding: 28px 32px; border-radius: 10px; margin-bottom: 20px; }
.risk-low { color: #065f46; font-weight: 600; }
.risk-moderate { color: #92400e; font-weight: 600; }
.risk-high { color: #991b1b; font-weight: 600; }
.checklist-item { padding: 5px 0; border-bottom: 1px solid #f1f5f9; display: flex; align-items: flex-start; gap: 8px; font-size: 9.5pt; }
.check-yes { color: #065f46; font-weight: 700; }
.check-no { color: #64748b; }
ol.numbered { padding-left: 18px; }
ol.numbered li { margin: 6px 0; font-size: 9.5pt; }
`

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

    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-content:start;">
      <div>
        <div style="height:3px;background:linear-gradient(90deg,#00c4a0,#0066cc);border-radius:2px;width:48px;margin-bottom:16px;"></div>
        <h2 style="color:white;font-size:14pt;font-weight:700;margin:0 0 12px;">About CarbonLens</h2>
        <p style="color:#94a3b8;font-size:9.5pt;line-height:1.7;margin:0 0 10px;">
          CarbonLens is a browser-based CO&#x2082; geological storage simulation studio, purpose-built for deep saline aquifer CCS screening. It delivers real-time plume simulation, geomechanical risk assessment, and regulatory permit preparation &mdash; entirely in the browser, with no server or proprietary software required.
        </p>
        <p style="color:#94a3b8;font-size:9.5pt;line-height:1.7;margin:0;">
          Developed as MSc research at Universiti Teknologi PETRONAS, Malaysia, in partnership with the CarbonLens product team.
        </p>
        <div style="margin-top:20px;padding:14px 16px;background:rgba(0,196,160,0.1);border-left:3px solid #00c4a0;border-radius:0 6px 6px 0;">
          <div style="font-size:8pt;color:#00c4a0;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Simulation Engine</div>
          <div style="font-size:9pt;color:#cbd5e1;">Span-Wagner EOS &middot; DOE Goodman (2011) &middot; Duan-Sun Solubility &middot; MARS IFT (Olagunju, in prep.) &middot; Theis Radial Flow &middot; Mohr-Coulomb Geomechanics &middot; Brooks-Corey kr</div>
        </div>
      </div>

      <div>
        <div style="height:3px;background:linear-gradient(90deg,#0066cc,#00c4a0);border-radius:2px;width:48px;margin-bottom:16px;"></div>
        <h2 style="color:white;font-size:14pt;font-weight:700;margin:0 0 12px;">Scientific References</h2>
        <ul style="color:#94a3b8;font-size:8.5pt;line-height:1.8;padding-left:16px;margin:0;">
          <li>Span &amp; Wagner (1996) &mdash; CO&#x2082; EOS, J. Phys. Chem. Ref. Data</li>
          <li>Fenghour et al. (1998) &mdash; CO&#x2082; viscosity, J. Phys. Chem. Ref. Data</li>
          <li>Duan &amp; Sun (2003) &mdash; CO&#x2082; solubility in brine, Chem. Geology</li>
          <li>Goodman et al. (2011) &mdash; Storage capacity, Int. J. GHG Control</li>
          <li>Olagunju (in preparation) &mdash; CO&#x2082;-brine IFT prediction via MARS regression, Universiti Teknologi PETRONAS (MSc research, unpublished)</li>
          <li>Theis (1935) &mdash; Radial flow to a well, Trans. Am. Geophys. Union</li>
          <li>Jaeger et al. (2007) &mdash; Rock mechanics, Cambridge Univ. Press</li>
          <li>Furre et al. (2017) &mdash; Sleipner benchmark, Energy Procedia</li>
          <li>Boait et al. (2012) &mdash; CO&#x2082; saturation monitoring, JGR Solid Earth</li>
        </ul>
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
      <div style="font-size:8pt;color:#475569;">&copy; 2026 CarbonLens &middot; carbonlens.app &middot; All rights reserved</div>
    </div>
  </div>
  `
}

function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) { alert('Please allow popups for this site'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 800)
}

function wrapHTML(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><style>${SHARED_CSS}</style></head><body>${body}</body></html>`
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
): void {
  const dateStr = today()

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

  // Trapping breakdown — use storageCapacity as authoritative reference total
  const residual = result.residualTrapping ?? 0
  const solubility = result.solubilityTrapping ?? 0
  const mineral = result.mineralTrapping ?? 0
  const mobile = result.mobilePlume ?? 0
  const storedTotal = result.storageCapacity ?? 0
  const trappingRef = storedTotal > 0 ? storedTotal : (residual + solubility + mineral + mobile)
  const pctR = trappingRef > 0 ? ((residual / trappingRef) * 100).toFixed(1) : '0.0'
  const pctS = trappingRef > 0 ? ((solubility / trappingRef) * 100).toFixed(1) : '0.0'
  const pctM = trappingRef > 0 ? ((mineral / trappingRef) * 100).toFixed(1) : '0.0'
  const pctMob = trappingRef > 0 ? ((mobile / trappingRef) * 100).toFixed(1) : '0.0'

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

  const preparedBy = userName ?? 'CarbonLens Simulation Studio'
  const orgName = organization ?? ''
  const refId = 'CL-EXEC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '')

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

  <!-- Page 2+ header -->
  <div style="page-break-before:always;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
    ${LOGO_SVG}
    <div style="text-align:right;">
      <div style="font-size:9pt;font-weight:700;color:#0d1f3c;">Executive Summary &mdash; CO&#x2082; Storage Assessment</div>
      <div style="font-size:8pt;color:#64748b;">${formationName} &middot; ${dateStr}</div>
    </div>
  </div>
  <div style="height:2px;background:#00c4a0;border-radius:2px;margin-bottom:14px;"></div>

  ${simulationYear != null && projectYears != null && simulationYear < projectYears ? `
  <div style="border:1px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:8px 14px;margin-bottom:12px;">
    <strong style="color:#92400e;">&#x26A0; Snapshot at simulation year ${simulationYear} of ${projectYears}.</strong>
    <span style="color:#92400e;font-size:9pt;"> The simulation had not yet reached the final project year when this document was exported. Stored mass and trapping values reflect an intermediate state. Run the simulation to completion before exporting for final results.</span>
  </div>` : ''}

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
            <td style="padding:3px 6px;">Mobile</td>
            <td style="padding:3px 6px;">
              <div class="bar-track"><div style="width:${pctMob}%; background:#ef4444; height:8px; border-radius:4px;"></div></div>
            </td>
            <td style="padding:3px 6px;">${mobile.toFixed(3)} Mt (${pctMob}%)</td>
          </tr>
        </tbody>
      </table>
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
  <p class="muted" style="font-size:8pt; margin-top:4px;">Project Duration is the full injection period (from UIStore). Cumulative injection accounts for ramp-up and ramp-down schedules within this period. Simple rate × duration gives a conservative upper bound; actual cumulative injection is lower when ramp periods are present.</p>

  <!-- Reservoir Evolution Snapshots -->
  <h2>Reservoir Evolution</h2>
  ${(snapshots && snapshots.length > 0) ? `
  <style>
  @media screen {
    .cl-slideshow .cl-slide { display:none; }
    .cl-slideshow .cl-slide.active { display:block; }
    .cl-contact { display:none; }
    .cl-slide-btns { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; justify-content:center; }
  }
  @media print {
    .cl-slideshow .cl-slide { display:none; }
    .cl-slideshow .cl-slide:first-child { display:block; }
    .cl-slide-btns { display:none; }
    .cl-contact { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:10px 0; }
    .cl-contact img { width:100%; border:1px solid #e2e8f0; border-radius:4px; }
  }
  </style>
  <div class="cl-slideshow" id="clSlideshow">
    ${snapshots.map((s, i) => '<div class="cl-slide' + (i === 0 ? ' active' : '') + '"><img src="' + s.dataUrl + '" style="width:100%;border-radius:6px;border:1px solid #e2e8f0;max-height:220px;object-fit:contain;"><div style="text-align:center;font-size:8pt;color:#64748b;margin-top:4px;">Year ' + s.year + ' \u2014 Plume State</div></div>').join('')}
  </div>
  <div class="cl-slide-btns" id="clSlideBtns">
    ${snapshots.map((s, i) => '<button onclick="clShowSlide(' + i + ')" id="clBtn' + i + '" style="padding:2px 10px;font-size:8pt;border:1px solid #e2e8f0;border-radius:12px;cursor:pointer;background:' + (i === 0 ? '#0d1f3c' : '#f8fafc') + ';color:' + (i === 0 ? 'white' : '#1e293b') + ';">Yr ' + s.year + '</button>').join('')}
  </div>
  <div class="cl-contact">
    ${snapshots.map((s) => '<div><img src="' + s.dataUrl + '"><div style="text-align:center;font-size:7pt;color:#64748b;margin-top:2px;">Year ' + s.year + '</div></div>').join('')}
  </div>
  <script>
  function clShowSlide(idx){
    document.querySelectorAll('#clSlideshow .cl-slide').forEach(function(el,i){el.className='cl-slide'+(i===idx?' active':'');});
    document.querySelectorAll('#clSlideBtns button').forEach(function(el,i){el.style.background=i===idx?'#0d1f3c':'#f8fafc';el.style.color=i===idx?'white':'#1e293b';});
  }
  </script>` : `<p class="muted" style="padding:8px 0;">No simulation snapshots available. Run a full simulation to capture reservoir evolution imagery at key years.</p>`}

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
    <span>CarbonLens &mdash; carbonlens.app &mdash; Generated ${dateStr}</span>
    <span>MSc Research, Universiti Teknologi PETRONAS, Malaysia | Preliminary screening only</span>
  </footer>
  <p style="font-size:7pt; color:#cbd5e1; margin-top:8px; line-height:1.6;">
    Scientific basis: DOE Goodman et al. (2011) Geol. Stor. of CO&#x2082;; Span-Wagner (1996) J. Phys. Chem. Ref. Data; Duan &amp; Sun (2003); Furre et al. (2017) Energy Procedia; Boait et al. (2012) JGR
  </p>
  </div>

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
  }

  const JURISDICTION_DISPLAY: Record<string, string> = {
    US: 'United States',
    EU: 'European Union',
    UK: 'United Kingdom',
    AU: 'Australia',
    MY: 'Malaysia (Federal Offshore)',
    MY_SAR: 'Malaysia (Sarawak Offshore)',
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
  const aorRadius = plumeRadius * 3
  const aorArea = Math.PI * aorRadius * aorRadius

  // Trapping breakdown — use storageCapacity as the authoritative mass reference.
  // PlumeGrid uses rho=650 kg/m³ approximation which can differ from Span-Wagner density;
  // tying percentages to the injection schedule total (storageCapacity) keeps the mass balance correct.
  const residual = result?.residualTrapping ?? 0
  const solubility = result?.solubilityTrapping ?? 0
  const mineral = result?.mineralTrapping ?? 0
  const mobile = result?.mobilePlume ?? 0
  const storedTotal = result?.storageCapacity ?? 0
  // Use storageCapacity as reference total; fall back to component sum only when storageCapacity is unavailable
  const trappingRef = storedTotal > 0 ? storedTotal : (residual + solubility + mineral + mobile)
  const pctR = trappingRef > 0 ? ((residual / trappingRef) * 100).toFixed(1) : '0.0'
  const pctS = trappingRef > 0 ? ((solubility / trappingRef) * 100).toFixed(1) : '0.0'
  const pctM = trappingRef > 0 ? ((mineral / trappingRef) * 100).toFixed(1) : '0.0'
  const pctMob = trappingRef > 0 ? ((mobile / trappingRef) * 100).toFixed(1) : '0.0'

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
    title: jMeta.reportTitle,
    subtitle: jMeta.authority,
    formationName,
    formationLocation,
    organization: orgName,
    preparedBy: 'CarbonLens Simulation Studio v3',
    dateStr,
    referenceId: permitRefId,
    jurisdiction: jurisdictionDisplayName,
  })}

  <!-- =====================================================================
       SECTION 1: APPLICATION OVERVIEW
       ===================================================================== -->
  <div class="page-break"></div>
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
    ${LOGO_SVG}
    <span style="font-size:8pt; color:#94a3b8;">${jMeta.reportTitle} &mdash; ${dateStr} &mdash; PRELIMINARY</span>
  </div>
  <div style="height:2px; background:#00c4a0; margin-bottom:14px;"></div>

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
      <tr><td>Depth (top of storage interval)</td><td>${params.depth?.toFixed(0) ?? '—'} m</td></tr>
      <tr><td>Thickness (storage interval)</td><td>${params.thickness?.toFixed(1) ?? '—'} m</td></tr>
      <tr><td>Porosity</td><td>${(params.porosity * 100)?.toFixed(1) ?? '—'}%</td></tr>
      <tr><td>Permeability</td><td>${params.permeability?.toFixed(1) ?? '—'} mD</td></tr>
      <tr><td>Initial Pore Pressure</td><td>${params.pressure?.toFixed(2) ?? '—'} MPa</td></tr>
      <tr><td>Temperature</td><td>${params.temperature?.toFixed(1) ?? '—'} °C</td></tr>
      <tr><td>Formation Area</td><td>${params.area?.toFixed(2) ?? '—'} km²</td></tr>
      <tr><td>Net-to-Gross Ratio</td><td>${(params.netToGross * 100)?.toFixed(1) ?? '—'}%</td></tr>
      <tr><td>Geometry Type</td><td>${params.geometryType ?? '—'}</td></tr>
      <tr><td>Salinity (monovalent NaCl-equiv.)</td><td>${params.monovalentSalinity?.toFixed(3) ?? '—'} mol/kg${params.monovalentSalinity != null && params.monovalentSalinity < 0.1 ? ' <em style="color:#d97706;">(⚠ near zero — Duan-Sun model requires &gt;0.1 mol/kg)</em>' : ''}</td></tr>
      <tr><td>Salinity (bivalent CaCl&#x2082;-equiv.)</td><td>${params.bivalentSalinity?.toFixed(3) ?? '—'} mol/kg</td></tr>
      <tr><td>Hydrocarbon Content (CH&#x2084;/N&#x2082;)</td><td>CH&#x2084;: ${(params.methaneFraction * 100).toFixed(1)}% &nbsp;|&nbsp; N&#x2082;: ${(params.nitrogenFraction * 100).toFixed(1)}%</td></tr>
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

  <!-- =====================================================================
       SECTION 4: AREA OF REVIEW (AoR)
       ===================================================================== -->
  <h2>4. Area of Review (AoR)</h2>
  <div class="section-box">
    <p>The Area of Review (AoR) is the region surrounding the CO&#x2082; storage complex within which elevated formation pressures could cause CO&#x2082; or displaced brine to migrate into underground sources of drinking water (USDW) or other protected resources. The AoR must be delineated using computational modelling and updated at regular intervals throughout the project lifetime.</p>
  </div>
  <table>
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Estimated Plume Radius</td><td>${plumeRadius.toFixed(0)} m</td></tr>
      <tr><td>Plume Height (vertical extent)</td><td>${plumeHeight.toFixed(0)} m</td></tr>
      <tr><td>AoR Search Radius (3× plume radius)</td><td>${aorRadius.toFixed(0)} m</td></tr>
      <tr><td>AoR Area (circular approximation)</td><td>${(aorArea / 1e6).toFixed(2)} km²</td></tr>
    </tbody>
  </table>

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
    </tbody>
  </table>
  <p class="muted">Capacity estimates follow DOE Goodman et al. (2011) methodology applied to gross pore volume. Storage efficiency coefficient Cc = 2.0% represents the P50 statistical estimate for saline aquifer storage.</p>

  <h3>5.2 Trapping Mechanism Distribution (at project end)</h3>
  ${(result != null && storedTotal > 0) ? (() => {
    const trappingSum = residual + solubility + mineral + mobile
    const allZero = trappingSum < 1e-9
    return `
  <table>
    <thead><tr><th>Trapping Mechanism</th><th>Volume (Mt)</th><th>Fraction of Total Injected</th></tr></thead>
    <tbody>
      <tr><td>Residual (capillary) trapping</td><td>${residual.toFixed(4)}</td><td>${pctR}%</td></tr>
      <tr><td>Dissolution trapping</td><td>${solubility.toFixed(4)}</td><td>${pctS}%</td></tr>
      <tr><td>Mineral trapping</td><td>${mineral.toFixed(4)}</td><td>${pctM}%</td></tr>
      <tr><td>Mobile plume (structural / free)</td><td>${mobile.toFixed(4)}</td><td>${pctMob}%</td></tr>
      <tr style="background:#f1f5f9;"><td><strong>Total Injected (reference)</strong></td><td><strong>${storedTotal.toFixed(4)}</strong></td><td><strong>100%</strong></td></tr>
    </tbody>
  </table>
  ${allZero ? `<div style="border:1px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:10px 14px;margin-top:8px;">
    <strong style="color:#92400e;">&#x26A0; Trapping values are all zero.</strong>
    <span style="color:#92400e;font-size:9pt;"> The simulation may have been exported before completion, or was reset after the last run. Re-run the full simulation (Run button) and wait for it to reach the final project year before exporting this permit. The storageCapacity (${storedTotal.toFixed(2)} Mt) reflects cumulative injection but the trapping breakdown requires the stateful simulation to have run to completion.</span>
  </div>` : ''}
  <p class="muted" style="font-size:8pt;">Fractions computed against cumulative injection schedule (storageCapacity). Mechanism volumes derived from analytical trapping model (6.5%/yr trapping rate; 60% residual, 40% dissolution). Mineral trapping only activates after year 50.</p>`
  })() : '<p class="muted">Simulation not completed or still at year 0. Run the full simulation to populate trapping mechanism distribution.</p>'}

  <!-- =====================================================================
       SECTION 6: GEOMECHANICAL RISK ASSESSMENT
       ===================================================================== -->
  <h2>6. Geomechanical Risk Assessment</h2>
  ${geoSection6}

  <!-- =====================================================================
       SECTION 7: MONITORING, REPORTING & VERIFICATION (MRV) PLAN
       ===================================================================== -->
  <div class="page-break"></div>
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
    ${LOGO_SVG}
    <span style="font-size:8pt; color:#94a3b8;">${jMeta.reportTitle} &mdash; ${dateStr} &mdash; PRELIMINARY</span>
  </div>
  <div style="height:2px; background:#00c4a0; margin-bottom:14px;"></div>

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
      <tr><td>CO&#x2082; density</td><td>Span-Wagner EOS</td><td>Span &amp; Wagner (1996) J. Phys. Chem. Ref. Data</td></tr>
      <tr><td>CO&#x2082; viscosity</td><td>Fenghour correlation</td><td>Fenghour et al. (1998) J. Phys. Chem. Ref. Data</td></tr>
      <tr><td>CO&#x2082; solubility</td><td>Duan-Sun model</td><td>Duan &amp; Sun (2003) Chem. Geology</td></tr>
      <tr><td>Storage capacity</td><td>DOE Goodman method</td><td>Goodman et al. (2011) Int. J. Greenhouse Gas Control</td></tr>
      <tr><td>CO&#x2082;-brine interfacial tension (IFT)</td><td>MARS regression (sub/supercritical)</td><td>Olagunju (in preparation) — MARS model for CO&#x2082;-brine IFT prediction across sub- and supercritical conditions; MSc research, Universiti Teknologi PETRONAS (unpublished)</td></tr>
      <tr><td>Pressure model</td><td>Theis radial flow</td><td>Theis (1935); superposition for multiple wells</td></tr>
      <tr><td>Geomechanics</td><td>Mohr-Coulomb failure</td><td>Jaeger et al. (2007) Fundamentals of Rock Mechanics</td></tr>
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
  <p style="font-size:9.5pt; margin-bottom:10px;">The following images were captured from the CarbonLens 3D reservoir viewer at key simulation years. They illustrate CO&#x2082; plume migration, saturation evolution, and spatial distribution throughout the injection period.</p>
  ${(snapshots && snapshots.length > 0) ? `
  <style>
  @media screen {
    .cl-app-slideshow .cl-app-slide { display:none; }
    .cl-app-slideshow .cl-app-slide.active { display:block; }
    .cl-app-contact { display:none; }
    .cl-app-btns { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; justify-content:center; }
  }
  @media print {
    .cl-app-slideshow .cl-app-slide { display:none; }
    .cl-app-contact { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin:10px 0; }
    .cl-app-contact img { width:100%; border:1px solid #e2e8f0; border-radius:4px; }
    .cl-app-btns { display:none; }
  }
  </style>
  <div class="cl-app-slideshow" id="clAppSlideshow">
    ${snapshots.map((s, i) => '<div class="cl-app-slide' + (i === 0 ? ' active' : '') + '"><img src="' + s.dataUrl + '" style="width:100%;border-radius:6px;border:1px solid #e2e8f0;max-height:260px;object-fit:contain;"><div style="text-align:center;font-size:8.5pt;color:#64748b;margin-top:6px;">Year ' + s.year + ' \u2014 CO\u2082 Plume Distribution</div></div>').join('')}
  </div>
  <div class="cl-app-btns" id="clAppBtns">
    ${snapshots.map((s, i) => '<button onclick="clAppShow(' + i + ')" id="clAppBtn' + i + '" style="padding:2px 10px;font-size:8pt;border:1px solid #e2e8f0;border-radius:12px;cursor:pointer;background:' + (i === 0 ? '#0d1f3c' : '#f8fafc') + ';color:' + (i === 0 ? 'white' : '#1e293b') + ';">Yr ' + s.year + '</button>').join('')}
  </div>
  <div class="cl-app-contact">
    ${snapshots.map((s) => '<div><img src="' + s.dataUrl + '"><div style="text-align:center;font-size:7.5pt;color:#64748b;margin-top:2px;">Year ' + s.year + '</div></div>').join('')}
  </div>
  <script>
  function clAppShow(idx){
    document.querySelectorAll('#clAppSlideshow .cl-app-slide').forEach(function(el,i){el.className='cl-app-slide'+(i===idx?' active':'');});
    document.querySelectorAll('#clAppBtns button').forEach(function(el,i){el.style.background=i===idx?'#0d1f3c':'#f8fafc';el.style.color=i===idx?'white':'#1e293b';});
  }
  </script>` : `<p class="muted" style="padding:8px 0;">No simulation snapshots available. Run a full simulation to generate reservoir evolution imagery.</p>`}

  <!-- Footer -->
  <footer>
    <span>CarbonLens &mdash; carbonlens.app</span>
    <span>${jMeta.reportTitle} &mdash; ${dateStr} &mdash; PRELIMINARY</span>
  </footer>

  ${buildBackPage({ organization: orgName, preparedBy: 'CarbonLens Simulation Studio v3', dateStr })}
`

  const html = wrapHTML(jMeta.reportTitle, body)
  openPrintWindow(html)
}
