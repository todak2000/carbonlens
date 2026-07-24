/**
 * Certificate PDF export utility
 * Opens a print-ready HTML page in a new tab/window for saving as PDF.
 * Follows the same pattern as exportHTMLReports.ts.
 */

import type { CertificateRecord } from '../components/RegistryPanel/RegistryPanel'

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
  <text x="48" y="23" font-family="'IBM Plex Mono', monospace" font-size="19" font-weight="700" fill="white" letter-spacing="0.5">CARBON</text>
  <text x="48" y="40" font-family="'IBM Plex Mono', monospace" font-size="19" font-weight="300" fill="#00b89a" letter-spacing="4.5">LENS</text>
</svg>`

const CERT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=IBM+Plex+Sans:wght@300;400;600;700;800&display=swap');

@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'IBM Plex Sans', -apple-system, sans-serif;
  font-size: 9.5pt; color: #1e293b; background: white;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

@media print {
  button { display: none !important; }
}

.cert-outer {
  border: 3px solid #00c4a0;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}
.cert-header {
  background: linear-gradient(135deg, #0d1f3c, #1e3a5f);
  color: white;
  padding: 24px 28px;
}
.cert-body { padding: 24px 28px; }

.top-bar { height: 5px; background: linear-gradient(90deg, #00c4a0, #d4af37, #00c4a0); }
.bot-bar { height: 4px; background: linear-gradient(90deg, #00c4a0, #d4af37, #00c4a0); }

h2 {
  font-size: 10pt; color: #0d1f3c; font-weight: 700;
  margin: 12px 0 6px; padding-bottom: 5px;
  border-bottom: 2px solid #00c4a0;
  text-transform: uppercase; letter-spacing: 0.06em;
}
table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 8px 0; }
td { padding: 6px 0; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
td:first-child { color: #64748b; font-weight: 500; }
td:last-child { text-align: right; font-weight: 700; color: #0d1f3c; font-family: 'IBM Plex Mono', monospace; }

.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
.kpi-card {
  border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 8px 10px; background: #f8fafc;
  border-top: 3px solid #00c4a0;
}
.kpi-label { font-size: 6.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 3px; }
.kpi-value { font-size: 14pt; font-weight: 800; color: #0d1f3c; font-family: 'IBM Plex Mono', monospace; }
.kpi-sub { font-size: 7pt; color: #64748b; margin-top: 2px; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.status-badge {
  display: inline-block; padding: 3px 14px; border-radius: 16px;
  font-size: 8pt; font-weight: 700; font-family: 'IBM Plex Mono', monospace;
  margin-top: 10px;
}
.credits-box {
  background: linear-gradient(135deg, #fefce8, #fffbeb);
  border: 1px solid #fde68a; border-radius: 10px;
  padding: 14px 18px; margin: 14px 0;
  display: flex; justify-content: space-between; align-items: center;
}

footer {
  margin-top: 16px; padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  font-size: 7.5pt; color: #94a3b8;
  display: flex; justify-content: space-between;
  font-family: 'IBM Plex Sans', sans-serif;
}
`

export function openCertificatePDF(cert: CertificateRecord): void {
  const issueDate = new Date(cert.savedAt).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const statusColors = cert.status === 'Verified'
    ? 'background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;'
    : cert.status === 'Review Required'
    ? 'background:#fef3c7;color:#92400e;border:1px solid #fde68a;'
    : 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Certificate ${cert.assetId} — CarbonLens</title>
  <style>${CERT_CSS}</style>
</head>
<body>
<div class="cert-outer">
  <div class="top-bar"></div>

  <div class="cert-header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      ${LOGO_SVG}
      <div style="text-align:right;">
        <div style="font-size:7.5pt;color:#a0c4d8;text-transform:uppercase;letter-spacing:0.15em;font-family:'IBM Plex Mono',monospace;margin-bottom:3px;">Storage Certificate</div>
        <div style="font-size:12pt;font-weight:700;font-family:'IBM Plex Mono',monospace;color:#00c4a0;letter-spacing:1px;">${cert.assetId}</div>
      </div>
    </div>
    <div style="margin-top:18px;">
      <div style="font-size:20pt;font-weight:800;letter-spacing:-0.3px;line-height:1.15;">CO₂ STORAGE CERTIFICATE</div>
      <div style="font-size:10pt;color:#a0c4d8;margin-top:4px;">${cert.formationName} · ${cert.jurisdiction}</div>
    </div>
    <div class="status-badge" style="${statusColors}">${cert.status.toUpperCase()}</div>
  </div>

  <div class="cert-body">

    <div class="two-col" style="margin-bottom:16px;">
      <div>
        <h2>Formation Details</h2>
        <table>
          <tbody>
            <tr><td>Formation</td><td>${cert.formationName}</td></tr>
            <tr><td>Jurisdiction</td><td>${cert.jurisdiction}</td></tr>
            <tr><td>Depth</td><td>${cert.depth} m</td></tr>
            <tr><td>Area</td><td>${cert.area} km²</td></tr>
            <tr><td>Porosity</td><td>${(cert.porosity * 100).toFixed(1)}%</td></tr>
            <tr><td>Project Duration</td><td>${cert.projectYears} years</td></tr>
            <tr><td>Issued Date</td><td>${issueDate}</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <h2>Containment Assessment</h2>
        <table>
          <tbody>
            <tr><td>Containment Probability</td><td>${(cert.containmentProbability * 100).toFixed(1)}%</td></tr>
            <tr><td>Safety Factor</td><td>${cert.safetyFactor.toFixed(2)}</td></tr>
            <tr><td>MAIP Margin</td><td>${cert.maipMargin.toFixed(1)}%</td></tr>
            <tr><td>Injection Pressure</td><td>${cert.injectionPressure.toFixed(2)} MPa</td></tr>
            <tr><td>MAIP Limit</td><td>${cert.maip.toFixed(2)} MPa</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <h2>Storage Metrics</h2>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Injected CO₂</div>
        <div class="kpi-value">${cert.storageCapacity.toFixed(2)} Mt</div>
        <div class="kpi-sub">Cumulative stored</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Capacity</div>
        <div class="kpi-value">${cert.totalCapacity.toFixed(2)} Mt</div>
        <div class="kpi-sub">Formation P50</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Plume Radius</div>
        <div class="kpi-value">${cert.plumeRadius.toFixed(0)} m</div>
        <div class="kpi-sub">Gravity current radius</div>
      </div>
    </div>

    <h2>Trapping Breakdown</h2>
    <div class="two-col">
      <table>
        <tbody>
          <tr><td>Structural Trapping</td><td>${cert.mobilePlume.toFixed(2)} Mt</td></tr>
          <tr><td>Residual Trapping</td><td>${cert.residualTrapping.toFixed(2)} Mt</td></tr>
          <tr><td>Solubility Trapping</td><td>${cert.solubilityTrapping.toFixed(2)} Mt</td></tr>
          <tr><td>Overpressure Risk</td><td style="color:${cert.overpressureRisk ? '#dc2626' : '#065f46'}">${cert.overpressureRisk ? 'YES' : 'None'}</td></tr>
        </tbody>
      </table>
      <div class="credits-box">
        <div>
          <div style="font-size:7pt;color:#92400e;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:4px;">Total Carbon Credits</div>
          <div style="font-size:26pt;font-weight:800;color:#78350f;font-family:'IBM Plex Mono',monospace;">${cert.totalCredits.toFixed(0)}</div>
          <div style="font-size:7.5pt;color:#92400e;margin-top:4px;">Jurisdiction: ${cert.jurisdiction}</div>
        </div>
      </div>
    </div>

    <footer>
      <div>
        <div style="font-weight:700;color:#0d1f3c;font-size:8.5pt;">Issued by CarbonLens Digital Twin Registry</div>
        <div>${window.location.hostname} · ${issueDate}</div>
        <div style="font-size:7pt;color:#94a3b8;margin-top:4px;">Screening-level accuracy — not a regulatory submission</div>
      </div>
      <div style="text-align:right;font-family:'IBM Plex Mono',monospace;">
        <div>${window.location.origin}/registry/verify/${cert.assetId}</div>
        <div>CarbonLens v3 Simulation Engine</div>
      </div>
    </footer>
  </div>

  <div class="bot-bar"></div>
</div>

<div style="margin:24px;padding:12px;background:#fff8e1;border:1px solid #f59e0b;border-radius:6px;font-size:9px;color:#78350f;line-height:1.5;">
  <strong>Professional Review Required:</strong> This certificate was generated by CarbonLens simulation software.
  It does not constitute a regulatory approval, legal permit, or substitute for site-specific numerical simulation.
  All outputs must be reviewed by a qualified professional (licensed geologist, petroleum engineer, or attorney)
  before use in any regulatory or commercial context.
</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
