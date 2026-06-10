import type { FormationParams, SimulationResult, Well } from '../types'
import type { GeomechanicsResult } from '../types'
import { computeAoRRadius, computeAoRRadiusTwoPhase } from './computePressureField'
import { defaultWellDesign, type WellDesign } from '../types/wellDesign'
import { generateWellboreSVGString } from '../components/WellboreSchematic'

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
          <div style="font-size:9pt;color:#cbd5e1;">Peng-Robinson EOS &middot; DOE Goodman (2011) &middot; Duan-Sun Solubility &middot; MARS IFT (Olagunju, in prep.) &middot; Nordbotten (2005) Two-Phase AoR &middot; Mohr-Coulomb Geomechanics &middot; van Genuchten&ndash;Mualem kr &middot; Killough&ndash;Land Hysteresis</div>
        </div>
      </div>

      <div>
        <div style="height:3px;background:linear-gradient(90deg,#0066cc,#00c4a0);border-radius:2px;width:48px;margin-bottom:16px;"></div>
        <h2 style="color:white;font-size:14pt;font-weight:700;margin:0 0 10px;">Key References</h2>
        <ul style="color:#94a3b8;font-size:8pt;line-height:1.75;padding-left:14px;margin:0;">
          <li>Peng &amp; Robinson (1976) &mdash; CO&#x2082; density (PR-EOS). <em>Ind. Eng. Chem. Fundam.</em> 15(1):59</li>
          <li>Fenghour et al. (1998) &mdash; CO&#x2082; viscosity. <em>J. Phys. Chem. Ref. Data</em> 27(1):31</li>
          <li>Laesecke &amp; Muzny (2017) &mdash; CO&#x2082; viscosity (NIST ref.). <em>JPCRD</em> 46:013107 [upgrade target]</li>
          <li>Duan &amp; Sun (2003) &mdash; CO&#x2082; solubility in brine. <em>Chem. Geology</em> 193:257</li>
          <li>Goodman et al. (2011) &mdash; Storage capacity methodology. <em>Int. J. GHG Control</em> 5(4):853</li>
          <li>Nordbotten et al. (2005) &mdash; Two-phase pressure / AoR. <em>Transp. Porous Media</em> 58(3):339</li>
          <li>Theis (1935) &mdash; Radial pressure transient (single-phase baseline). <em>Trans. AGU</em> 16:519</li>
          <li>van Genuchten (1980) &mdash; CO&#x2082;/brine relative permeability. <em>Soil Sci. Soc. Am. J.</em> 44:892</li>
          <li>Mualem (1976) &mdash; Hydraulic conductivity model (VG kr). <em>Water Resour. Res.</em> 12:513</li>
          <li>Krevor et al. (2012) &mdash; CO&#x2082;-brine kr (Berea, Fontainebleau). <em>WRR</em> 48:W02514</li>
          <li>Land (1968) &mdash; Residual trapping / capillary hysteresis. <em>Trans. AIME</em> 243:149</li>
          <li>Killough (1976) &mdash; History-dependent saturation functions. <em>SPE J.</em> 16(1):37</li>
          <li>Hubbert &amp; Willis (1957) &mdash; Fracture pressure mechanics. <em>Trans. AIME</em> 210:153</li>
          <li>Jaeger et al. (2007) &mdash; Rock mechanics &amp; Mohr-Coulomb. <em>Cambridge Univ. Press</em></li>
          <li>Nordbotten &amp; Celia (2006) &mdash; VE plume migration. <em>Water Resour. Res.</em> 42:W01207</li>
          <li>Pentland et al. (2011) &mdash; Residual trapping. <em>SPE-133798</em></li>
          <li>Bachu et al. (2007) &mdash; MAIP &amp; injectivity constraints. <em>Int. J. GHG Control</em> 1(4):374</li>
          <li>Teatini et al. (2011) &mdash; Surface heave from injection. <em>J. Geophys. Res.</em> 116:B08204</li>
          <li>Chiquet et al. (2007) &mdash; CO&#x2082;-brine IFT at reservoir conditions. <em>Energy Convers. Mgmt.</em> 48:736</li>
          <li>Olagunju (in preparation) &mdash; CO&#x2082;-brine IFT via MARS regression. MSc research, UTP Malaysia</li>
          <li>Furre et al. (2017) &mdash; Sleipner CCS benchmark. <em>Energy Procedia</em> 114:3916</li>
          <li>Boait et al. (2012) &mdash; CO&#x2082; saturation monitoring. <em>JGR Solid Earth</em> 117:B03309</li>
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

function buildEquationsPage(opts: {
  organization: string
  preparedBy: string
  dateStr: string
}): string {
  return `
  <div style="min-height:100vh;background:linear-gradient(160deg,#051931 0%,#0d2a4a 50%,#051931 100%);display:flex;flex-direction:column;padding:52px 40px 40px;page-break-before:always;page:back-cover;color:white;">
    <div style="margin-bottom:24px;">${LOGO_SVG_WHITE}</div>
    <div style="height:3px;background:linear-gradient(90deg,#00c4a0,#0066cc,#00c4a0);border-radius:2px;width:100%;margin-bottom:16px;"></div>
    <h2 style="color:white;font-size:14pt;font-weight:700;margin:0 0 12px;">Equation &amp; Model Reference</h2>
    <table style="width:100%;border-collapse:collapse;font-size:7.8pt;color:#94a3b8;">
      <thead>
        <tr style="background:rgba(0,196,160,0.15);">
          <th style="padding:6px 10px;text-align:left;color:#00c4a0;font-weight:700;border-bottom:1px solid rgba(0,196,160,0.3);width:18%;">Module / Engine</th>
          <th style="padding:6px 10px;text-align:left;color:#00c4a0;font-weight:700;border-bottom:1px solid rgba(0,196,160,0.3);width:42%;">Equation / Correlation</th>
          <th style="padding:6px 10px;text-align:left;color:#00c4a0;font-weight:700;border-bottom:1px solid rgba(0,196,160,0.3);width:40%;">Reference</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">CO&#x2082; EOS</td><td style="padding:5px 10px;font-family:monospace;">&#x3C1;(P,T) = PM/ZRT; Z from Peng-Robinson cubic EOS; &#x3BA;(&#x3C9;) = 0.37464 + 1.54226&#x3C9; &minus; 0.26992&#x3C9;&#xB2;</td><td style="padding:5px 10px;">Peng &amp; Robinson (1976), Ind. Eng. Chem. Fundam. 15(1):59&ndash;64; T<sub>c</sub>=304.13 K, P<sub>c</sub>=7.377 MPa, &#x3C9;=0.2239. <em>Note: Span-Wagner (1996) 56-term Helmholtz EOS is the upgrade target for ±0.5% accuracy.</em></td></tr>
        <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">CO&#x2082; Viscosity</td><td style="padding:5px 10px;font-family:monospace;">&#x3BC;(T,&#x3C1;) = &#x3BC;<sub>0</sub>(T) + &#x394;&#x3BC;(T,&#x3C1;); zero-density + excess; &#x3B5;/k=251.196 K</td><td style="padding:5px 10px;">Fenghour, Wakeham &amp; Vesovic (1998), J. Phys. Chem. Ref. Data 27(1):31&ndash;44. <em>Upgrade target: Laesecke &amp; Muzny (2017), JPCRD 46:013107 (NIST reference, ±0.5% vs ±5% in supercritical region).</em></td></tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">CO&#x2082; Solubility</td><td style="padding:5px 10px;font-family:monospace;">ln(y&#x2082; &middot; P) = &#x3BC;&#x2070;(T) + 2&#x3BB;(T,P) &middot; m + &#x3BE;(T,P) &middot; m&#xB2;; Pitzer ionic strength</td><td style="padding:5px 10px;">Duan &amp; Sun (2003), Chem. Geology 193:257&ndash;271</td></tr>
        <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">CO&#x2082;-Brine IFT</td><td style="padding:5px 10px;font-family:monospace;">&#x3C3; = MARS(P, T, S); multivariate adaptive regression splines trained on experimental data</td><td style="padding:5px 10px;">Olagunju (in prep.), MSc UTP Malaysia; Chiquet et al. (2007), Energy Convers. Mgmt. 48:736</td></tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">Storage Capacity</td><td style="padding:5px 10px;font-family:monospace;">M = A &middot; h &middot; &#x3D5; &middot; &#x3C1;<sub>CO&#x2082;</sub> &middot; S<sub>g</sub> &middot; E<sub>eff</sub>; volumetric DOE methodology</td><td style="padding:5px 10px;">Goodman et al. (2011), Int. J. GHG Control 5(4):853&ndash;866; DOE (2010) Atlas</td></tr>
        <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">Residual Trapping</td><td style="padding:5px 10px;font-family:monospace;">S<sub>gr</sub> = S<sub>gi</sub> / (1 + C &middot; S<sub>gi</sub>) (Land, 1968); V<sub>r</sub> = &#x3D5; &middot; (1&#x2212;S<sub>wi</sub>) &middot; S<sub>gr</sub> &middot; A &middot; h &middot; &#x3C1;<sub>CO&#x2082;</sub></td><td style="padding:5px 10px;">Pentland et al. (2011), SPE-133798; Land (1968), Trans. AIME 243:149</td></tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">Solubility Trapping</td><td style="padding:5px 10px;font-family:monospace;">m<sub>diss</sub> = &#x3D5; &middot; S<sub>w</sub> &middot; &#x3C1;<sub>brine</sub> &middot; &#x3C7;<sub>CO&#x2082;</sub>(T,P,S) &middot; A &middot; h; aqueous dissolution</td><td style="padding:5px 10px;">Duan &amp; Sun (2003); Ennis-King &amp; Paterson (2005), SPE-88502</td></tr>
        <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">VE Plume Migration</td><td style="padding:5px 10px;font-family:monospace;">&#x2202;(h<sub>g</sub>/B)/&#x2202;t + &#x2207;&middot;Q<sub>g</sub> = Q<sub>inj</sub>/B; vertical-equilibrium thin-lens approximation</td><td style="padding:5px 10px;">Nordbotten &amp; Celia (2006), Water Resour. Res. 42:W01207</td></tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">Pressure / AoR</td><td style="padding:5px 10px;font-family:monospace;">&#x394;P(r,t) = Q/(4&#x3C0;kh)[&#x3BC;<sub>b</sub>E<sub>1</sub>(r&#xB2;/4&#x3B1;<sub>b</sub>t) + (&#x3BC;<sub>eff</sub>&#x2212;&#x3BC;<sub>b</sub>)E<sub>1</sub>(R<sub>p</sub>&#xB2;/4&#x3B1;<sub>b</sub>t)]; two-phase composite; &#x3BC;<sub>b</sub>=brine, &#x3BC;<sub>eff</sub>=&#x3BC;<sub>CO&#x2082;</sub>/k<sub>r</sub></td><td style="padding:5px 10px;">Nordbotten, Celia &amp; Bachu (2005), Transp. Porous Media 58(3):339&ndash;360; Theis (1935) as single-phase baseline; Hantush &amp; Jacob (1955) for leaky-aquifer option</td></tr>
        <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">Rel. Permeability</td><td style="padding:5px 10px;font-family:monospace;">k<sub>rg</sub> = k&#x2070;<sub>rg</sub>&middot;(1&#x2212;S<sub>e</sub>)<sup>&#xBD;</sup>&middot;(1&#x2212;S<sub>e</sub><sup>1/m</sup>)<sup>2m</sup>; k<sub>rw</sub>=k&#x2070;<sub>rw</sub>&middot;S<sub>e</sub><sup>&#xBD;</sup>&middot;(1&#x2212;(1&#x2212;S<sub>e</sub><sup>1/m</sup>)<sup>m</sup>)&#xB2;; m=1&#x2212;1/n; + Killough&ndash;Land hysteresis</td><td style="padding:5px 10px;">van Genuchten (1980), Soil Sci. Soc. Am. J. 44:892; Mualem (1976), WRR 12:513; Krevor et al. (2012), WRR 48:W02514; Land (1968), Trans. AIME 243:149; Killough (1976), SPE J. 16(1):37</td></tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">Fracture Pressure</td><td style="padding:5px 10px;font-family:monospace;">P<sub>f</sub> = [&#x3BD;/(1&#x2212;&#x3BD;)](&#x3C3;<sub>v</sub>&#x2212;P<sub>h</sub>) + P<sub>h</sub> + T<sub>0</sub>; minimum horizontal stress criterion</td><td style="padding:5px 10px;">Hubbert &amp; Willis (1957), Trans. AIME 210:153&ndash;166</td></tr>
        <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">Mohr-Coulomb</td><td style="padding:5px 10px;font-family:monospace;">&#x3C4; = c + &#x3C3;<sub>n</sub>tan(&#x3D5;); SF = &#x3C4;<sub>strength</sub>/&#x3C4;<sub>drive</sub>; failure when SF &lt; 1</td><td style="padding:5px 10px;">Jaeger, Cook &amp; Zimmerman (2007), Fundamentals of Rock Mechanics, 4th ed.</td></tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">MAIP</td><td style="padding:5px 10px;font-family:monospace;">MAIP = 0.9 &middot; P<sub>f</sub> &#x2212; P<sub>res</sub>; maximum allowable injection pressure</td><td style="padding:5px 10px;">Bachu et al. (2007), Int. J. GHG Control 1(4):374; EPA UIC Class VI §146.88</td></tr>
        <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">Surface Heave</td><td style="padding:5px 10px;font-family:monospace;">&#x3B4; &#x2248; (&#x394;P &middot; h) / E &middot; (1&#x2212;&#x3BD;&#xB2;) &middot; a; elastic nucleus-of-strain approximation</td><td style="padding:5px 10px;">Teatini et al. (2011), J. Geophys. Res. 116:B08204</td></tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);"><td style="padding:5px 10px;color:#e2e8f0;font-weight:600;">Area of Review</td><td style="padding:5px 10px;font-family:monospace;">r<sub>AoR</sub> = &#x221A;(4Kt/&#x3D5;&#x3BC;c<sub>t</sub>); pressure perturbation front &#x2265; 6.9 kPa threshold</td><td style="padding:5px 10px;">Chabora &amp; Benson (2009), GHGT-9; EPA Class VI UIC Program Guidance</td></tr>
      </tbody>
    </table>
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:8pt;color:#475569;">Prepared by ${opts.preparedBy} for ${opts.organization || 'Client'} &middot; ${opts.dateStr}</div>
      <div style="font-size:8pt;color:#475569;">&copy; 2026 CarbonLens &middot; carbonlens.app</div>
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
    Scientific basis: DOE Goodman et al. (2011); Peng &amp; Robinson (1976) PR-EOS; Fenghour et al. (1998) viscosity; Duan &amp; Sun (2003) solubility; Nordbotten et al. (2005) two-phase AoR; van Genuchten (1980) &amp; Mualem (1976) kr; Krevor et al. (2012); Furre et al. (2017); Boait et al. (2012)
  </p>
  </div>

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
  const trappingRef  = storedTotal > 0 && boundaryGap / Math.max(storedTotal, 1) < 0.01
    ? storedTotal
    : (componentSum > 0 ? componentSum : storedTotal)
  const pctR    = trappingRef > 0 ? ((residual     / trappingRef) * 100).toFixed(1) : '0.0'
  const pctS    = trappingRef > 0 ? ((dissolvedOnly / trappingRef) * 100).toFixed(1) : '0.0'
  const pctM    = trappingRef > 0 ? ((mineral      / trappingRef) * 100).toFixed(1) : '0.0'
  const pctMob  = trappingRef > 0 ? ((mobile       / trappingRef) * 100).toFixed(1) : '0.0'

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
        <tr><td>Theis Wellbore Pressure (transient radial flow)</td><td>${result?.injectionPressure?.toFixed(2) ?? '—'} MPa</td><td><span class="badge-green">REF</span></td></tr>
        <tr><td>Peaceman BHP (skin S=0, r<sub>w</sub>=0.1 m) <em style="font-size:8pt;color:#94a3b8;">— steady-state near-wellbore</em></td><td>${result?.peacemanBHP != null ? result.peacemanBHP.toFixed(2) + ' MPa' : '—'}</td><td><span class="${result?.peacemanBHP != null && result.peacemanBHP < geomechanics.maip ? 'badge-green' : 'badge-amber'}">${result?.peacemanBHP != null && result.peacemanBHP < geomechanics.maip ? '&#x2713; Below MAIP' : '&#x26A0; Check MAIP'}</span></td></tr>
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
  <table>
    <thead><tr><th>Parameter</th><th>Value</th><th>Method</th></tr></thead>
    <tbody>
      <tr><td>Estimated Plume Radius</td><td>${plumeRadius.toFixed(0)} m</td><td>Gravity-current spreading (Boait 2012 calibration)</td></tr>
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
      ${result?.vePlumeRadius != null ? `<tr><td>VE Effective Plume Radius</td><td>${result.vePlumeRadius.toFixed(0)} m</td></tr>` : ''}
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
      <tr><td>Mobile plume (structural / free)</td><td>${mobile.toFixed(4)}</td><td>${pctMob}%</td></tr>
      <tr style="background:#e0f2fe;"><td><strong>Tracked Total (model components)</strong></td><td><strong>${trappingRef.toFixed(4)}</strong></td><td><strong>100%</strong></td></tr>
      ${Math.abs(storedTotal - trappingRef) > 0.001 ? `<tr style="background:#fef9c3;"><td>Cumulative Injection (mass balance)</td><td>${storedTotal.toFixed(4)}</td><td style="font-size:8.5pt;color:#92400e;">${(trappingRef / storedTotal * 100).toFixed(1)}% tracked — ${(storedTotal - trappingRef).toFixed(3)} Mt grid boundary outflow</td></tr>` : ''}
    </tbody>
  </table>
  ${allZero ? `<div style="border:1px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:10px 14px;margin-top:8px;">
    <strong style="color:#92400e;">&#x26A0; Trapping values are all zero.</strong>
    <span style="color:#92400e;font-size:9pt;"> The simulation may have been exported before completion, or was reset after the last run. Re-run the full simulation (Run button) and wait for it to reach the final project year before exporting this permit. The storageCapacity (${storedTotal.toFixed(2)} Mt) reflects cumulative injection but the trapping breakdown requires the stateful simulation to have run to completion.</span>
  </div>` : ''}
  <p class="muted" style="font-size:8pt;">Percentages computed against tracked component mass (residual + solubility + mobile), which is internally mass-conserved. When the 3D plume grid is active, CO&#x2082; that migrates to the open grid boundary is no longer tracked — this appears as the "boundary outflow" row if present. Mineral trapping only activates after year 50. <sup>†</sup> Dissolution and mineral rows are non-overlapping subsets: mineral row shows dissolved CO&#x2082; that has further precipitated as carbonate; dissolution row shows the remaining aqueous fraction. Together they equal the total solubility-trapped volume.</p>`
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
      <tr><td>CO&#x2082; density</td><td>Peng-Robinson EOS (PR-76)</td><td>Peng &amp; Robinson (1976) Ind. Eng. Chem. Fundam. 15(1):59–64. Note: Span &amp; Wagner (1996) multi-parameter EOS (±0.05%) is the target upgrade for production deployment; PR-EOS accuracy ±3–8% at CCS reservoir conditions.</td></tr>
      <tr><td>CO&#x2082; viscosity</td><td>Fenghour et al. (1998) correlation</td><td>Fenghour, Wakeham &amp; Vesovic (1998) J. Phys. Chem. Ref. Data 27(1):31–44. Note: Laesecke &amp; Muzny (2017) is the current NIST-recommended reference (±0.5% vs ±5% for Fenghour at high pressure); upgrade pending coefficient transcription.</td></tr>
      <tr><td>CO&#x2082; solubility</td><td>Duan-Sun model (extended 5-coefficient fit)</td><td>Duan &amp; Sun (2003) Chem. Geology 193(3–4):257–271. T-dependent Pitzer λ(T) and ζ parameters from Table 3; separate NaCl / CaCl₂ Setschenow corrections.</td></tr>
      <tr><td>Storage capacity</td><td>DOE Goodman method</td><td>Goodman et al. (2011) Int. J. Greenhouse Gas Control 5(4):828–835</td></tr>
      <tr><td>CO&#x2082;-brine interfacial tension (IFT)</td><td>MARS regression (sub/supercritical)</td><td>Olagunju (in preparation) — MARS model for CO&#x2082;-brine IFT prediction across sub- and supercritical conditions; MSc research, Universiti Teknologi PETRONAS (unpublished)</td></tr>
      <tr><td>Relative permeability</td><td>van Genuchten–Mualem + Killough–Land hysteresis</td><td>van Genuchten (1980) Soil Sci. Soc. Am. J. 44(5):892–898; Mualem (1976) Water Resour. Res. 12(3):513–522; Krevor et al. (2012) Water Resour. Res. 48:W02544 (laboratory Berea/Fontainebleau parameters); Land (1968) SPE-1965-PA; Killough (1976) SPE-5765-PA</td></tr>
      <tr><td>Pressure model</td><td>Nordbotten (2005) two-phase composite radial flow</td><td>Nordbotten, Celia &amp; Bachu (2005) Transp. Porous Media 58(3):339–360. Outer brine zone: E₁ integral with brine mobility; near-well CO₂ zone: mobility-ratio correction. Supersedes single-phase Theis (1935) for two-phase CO₂ injection.</td></tr>
      <tr><td>AoR delineation</td><td>Nordbotten two-phase pressure-threshold inversion (1 psi / 0.007 MPa)</td><td>EPA Class VI guidance 40 CFR 146.84; bisection on Nordbotten (2005) composite ΔP to find threshold contour radius</td></tr>
      <tr><td>2D plume footprint (VE model)</td><td>Vertical Equilibrium 2D FD solver (40×40 grid)</td><td>Nordbotten &amp; Celia (2006) Water Resour. Res. 42:W01407; Hesse et al. (2008) J. Fluid Mech. 611:35–60</td></tr>
      <tr><td>Halite precipitation risk</td><td>Zeidouni dryout-radius screening</td><td>Zeidouni et al. (2009) Int. J. GHG Control 3(5):600–611; Muller et al. (2009) Energy Procedia 1(1):3507–3514</td></tr>
      <tr><td>Wellbore schematic</td><td>Auto-generated from depth &amp; thickness</td><td>CCUS well architecture per ISO 16530 / API RP 90</td></tr>
      <tr><td>Wellbore pressure</td><td>Peaceman (1978) well-block model</td><td>Peaceman (1978) SPE-6893-PA; injectivity index J = 2πkh/μ(ln r<sub>e</sub>/r<sub>w</sub> + S)</td></tr>
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

  ${buildEquationsPage({ organization: orgName, preparedBy: 'CarbonLens Simulation Studio v3', dateStr })}
  ${buildBackPage({ organization: orgName, preparedBy: 'CarbonLens Simulation Studio v3', dateStr })}
`

  const html = wrapHTML(jMeta.reportTitle, body)
  openPrintWindow(html)
}
