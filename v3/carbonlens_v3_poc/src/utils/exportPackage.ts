import { FormationParams, SimulationResult } from '../types'
import {
  generateDepthProfile, generateTimeSeries,
  profileToCSV, timeSeriesToCSV, buildExportJSON,
  ProfilePoint, TimeSeriesPoint,
} from './profileGenerator'

/**
 * Generate an HTML table that doubles as an Excel-compatible .xls file.
 * Excel opens HTML tables natively — each <table> becomes a worksheet.
 */
export function generateExcelHTML(
  params: FormationParams,
  wells: { id: string; x: number; z: number; injectionRate: number; label: string; rampUpYears: number; rampDownYears: number }[],
  result: SimulationResult | null,
  jurisdiction: string,
  depthProfile: ProfilePoint[],
  timeSeries: TimeSeriesPoint[],
): string {
  const fmt = (n: number, d = 2) => n.toFixed(d)
  const date = new Date().toISOString().slice(0, 10)

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>
  table{ border-collapse:collapse; font-family:monospace; font-size:10pt; }
  th,td{ border:1px solid #999; padding:4px 8px; text-align:left; }
  th{ background:#1a3a5c; color:#fff; font-weight:bold; }
  tr:nth-child(even){ background:#f0f4f8; }
  h2{ font-family:monospace; color:#1a3a5c; }
</style></head><body>

<h2>CarbonLens Export — ${date}</h2>
<p>Jurisdiction: ${jurisdiction}</p>

<h2>1. Formation Parameters</h2>
<table>
<tr><th>Parameter</th><th>Value</th><th>Unit</th></tr>
<tr><td>Depth</td><td>${params.depth}</td><td>m</td></tr>
<tr><td>Thickness</td><td>${params.thickness}</td><td>m</td></tr>
<tr><td>Porosity</td><td>${params.porosity}</td><td>frac</td></tr>
<tr><td>Permeability</td><td>${params.permeability}</td><td>mD</td></tr>
<tr><td>Pressure</td><td>${params.pressure}</td><td>MPa</td></tr>
<tr><td>Temperature</td><td>${params.temperature}</td><td>°C</td></tr>
<tr><td>Area</td><td>${params.area}</td><td>km²</td></tr>
<tr><td>Net-to-Gross</td><td>${params.netToGross}</td><td>frac</td></tr>
<tr><td>Geometry</td><td>${params.geometryType}</td><td></td></tr>
<tr><td>Monovalent Salinity</td><td>${params.monovalentSalinity}</td><td>frac</td></tr>
<tr><td>Bivalent Salinity</td><td>${params.bivalentSalinity}</td><td>frac</td></tr>
<tr><td>CH₄ Fraction</td><td>${params.methaneFraction}</td><td>frac</td></tr>
<tr><td>N₂ Fraction</td><td>${params.nitrogenFraction}</td><td>frac</td></tr>
<tr><td>Friction Angle</td><td>${params.caprockFriction}</td><td>deg</td></tr>
<tr><td>Caprock Cohesion</td><td>${params.caprockCohesion}</td><td>MPa</td></tr>
<tr><td>Biot Coefficient</td><td>${params.biotCoefficient}</td><td></td></tr>
</table>

<h2>2. Wells</h2>
<table>
<tr><th>ID</th><th>Label</th><th>X</th><th>Z</th><th>Injection Rate</th><th>Ramp Up</th><th>Ramp Down</th></tr>
${wells.map(w => `<tr><td>${w.id}</td><td>${w.label}</td><td>${fmt(w.x, 2)}</td><td>${fmt(w.z, 2)}</td><td>${w.injectionRate}</td><td>${w.rampUpYears}</td><td>${w.rampDownYears}</td></tr>`).join('')}
</table>

${result ? `
<h2>3. Simulation Results</h2>
<table>
<tr><th>Metric</th><th>Value</th><th>Unit</th></tr>
<tr><td>Storage Capacity</td><td>${fmt(result.storageCapacity)}</td><td>Mt</td></tr>
<tr><td>Total Capacity (P50)</td><td>${fmt(result.totalCapacity)}</td><td>Mt</td></tr>
<tr><td>P10 Capacity</td><td>${fmt(result.capacityP10)}</td><td>Mt</td></tr>
<tr><td>P90 Capacity</td><td>${fmt(result.capacityP90)}</td><td>Mt</td></tr>
<tr><td>Capacity Utilisation</td><td>${fmt(result.capacityUtilPct)}</td><td>%</td></tr>
<tr><td>Overpressure Risk</td><td>${result.overpressureRisk ? 'YES' : 'No'}</td><td></td></tr>
<tr><td>Plume Radius</td><td>${fmt(result.plumeRadius, 1)}</td><td>m</td></tr>
<tr><td>Plume Height</td><td>${fmt(result.plumeHeight, 1)}</td><td>m</td></tr>
<tr><td>Injection Pressure</td><td>${fmt(result.injectionPressure)}</td><td>MPa</td></tr>
<tr><td>CO₂ Density</td><td>${fmt(result.co2Density, 0)}</td><td>kg/m³</td></tr>
<tr><td>Brine Density</td><td>${fmt(result.brineDensity, 0)}</td><td>kg/m³</td></tr>
<tr><td>CO₂ Viscosity</td><td>${fmt(result.co2Viscosity * 1e6, 2)}</td><td>µPa·s</td></tr>
<tr><td>Solubility</td><td>${fmt(result.solubility)}</td><td>mol/kg</td></tr>
<tr><td>Diffusion Coefficient</td><td>${fmt(result.diffusion, 6)}</td><td>m²/s</td></tr>
<tr><td>IFT</td><td>${result.ift !== null ? fmt(result.ift) : 'N/A'}</td><td>mN/m</td></tr>
<tr><td>Containment Probability</td><td>${fmt(result.containmentProbability)}</td><td>frac</td></tr>
<tr><td>Residual Trapping</td><td>${fmt(result.residualTrapping)}</td><td>Mt</td></tr>
<tr><td>Solubility Trapping</td><td>${fmt(result.solubilityTrapping)}</td><td>Mt</td></tr>
<tr><td>Mobile Plume</td><td>${fmt(result.mobilePlume)}</td><td>Mt</td></tr>
</table>

<h2>4. Depth Profile — Fluid Properties vs Depth</h2>
<table>
<tr><th>Depth (m)</th><th>Pressure (MPa)</th><th>Temp (°C)</th><th>CO₂ Density (kg/m³)</th><th>Brine Density (kg/m³)</th><th>Viscosity (µPa·s)</th><th>Solubility (mol/kg)</th><th>IFT (mN/m)</th></tr>
${depthProfile.map(p => `<tr><td>${p.depth}</td><td>${p.pressure}</td><td>${p.temperature}</td><td>${p.co2Density}</td><td>${p.brineDensity}</td><td>${p.viscosity}</td><td>${p.solubility}</td><td>${p.ift !== null ? p.ift : 'N/A'}</td></tr>`).join('')}
</table>

<h2>5. Time Series — Storage & Plume Evolution</h2>
<table>
<tr><th>Year</th><th>Stored (Mt)</th><th>Plume Radius (m)</th><th>Plume Height (m)</th><th>Inj Pressure (MPa)</th><th>Residual (Mt)</th><th>Solubility (Mt)</th><th>Mobile (Mt)</th><th>Utilisation (%)</th></tr>
${timeSeries.map(p => `<tr><td>${p.year}</td><td>${p.storageMt}</td><td>${p.plumeRadiusM}</td><td>${p.plumeHeightM}</td><td>${p.injectionPressureMPa}</td><td>${p.residualTrappingMt}</td><td>${p.solubilityTrappingMt}</td><td>${p.mobilePlumeMt}</td><td>${p.capacityUtilPct}</td></tr>`).join('')}
</table>` : '<p><em>Run a simulation first to populate results.</em></p>'}

</body></html>`
}

/**
 * Generate and download all export files as a single action.
 * Triggers multiple downloads — the user saves them as a package.
 */
export function downloadExportPackage(
  params: FormationParams,
  wells: { id: string; x: number; z: number; injectionRate: number; label: string; rampUpYears: number; rampDownYears: number }[],
  result: SimulationResult | null,
  jurisdiction: string,
  canvasDataURL?: string | null,
) {
  const ts = Date.now()
  const depthProfile = generateDepthProfile(params)
  const timeSeries = result
    ? generateTimeSeries(params, result, wells, 50)
    : []

  // 1. JSON data
  const json = buildExportJSON(params, wells, result, jurisdiction, depthProfile, timeSeries)
  downloadBlob(JSON.stringify(json, null, 2), `carbonlens_data_${ts}.json`, 'application/json')

  // 2. Depth profile CSV
  downloadBlob(profileToCSV(depthProfile), `carbonlens_depth_profile_${ts}.csv`, 'text/csv')

  // 3. Time series CSV (if simulation run)
  if (timeSeries.length) {
    downloadBlob(timeSeriesToCSV(timeSeries), `carbonlens_timeseries_${ts}.csv`, 'text/csv')
  }

  // 4. Excel-compatible HTML report
  const html = generateExcelHTML(params, wells, result, jurisdiction, depthProfile, timeSeries)
  downloadBlob(html, `carbonlens_report_${ts}.xls`, 'application/vnd.ms-excel')

  // 5. Canvas screenshot as PNG
  if (canvasDataURL) {
    const link = document.createElement('a')
    link.download = `carbonlens_screenshot_${ts}.png`
    link.href = canvasDataURL
    link.click()
  }
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
