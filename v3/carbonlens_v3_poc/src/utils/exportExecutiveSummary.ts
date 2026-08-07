/**
 * exportExecutiveSummary — generates a single-page A4 executive summary PDF
 * designed for government officials, investors, and ministers (non-technical audience).
 *
 * Distinct from the permit report (multi-page, engineering audience).
 * Uses only jsPDF primitives — no chart library, no images required.
 *
 * Verdict logic per design spec:
 *   VIABLE           → containmentProbability > 0.75 AND safetyFactor > 1.5
 *   NEEDS FURTHER STUDY → containmentProbability 0.50–0.75 OR safetyFactor 1.0–1.5
 *   NOT RECOMMENDED  → containmentProbability < 0.50 OR safetyFactor < 1.0
 */

import { jsPDF } from 'jspdf'
import { FormationParams, SimulationResult, GeomechanicsResult } from '../types'


// ── Brand colours — light-theme, print-safe ────────────────────────────────
const CLR = {
  // Page background is white — all text must be dark enough to read on white
  navy:        [10,  20,  45]  as const,  // section headings, header/footer bands
  navyLight:   [18,  32,  65]  as const,  // header band (slightly lighter)
  emerald:     [16, 185, 129]  as const,  // logo, accents, badges
  amber:       [245, 158,  11] as const,  // warning colour
  rose:        [239,  68,  68] as const,  // danger colour
  white:       [255, 255, 255] as const,  // text on dark bands
  silver:      [200, 210, 225] as const,  // subtitle text on dark bands
  // CONTRAST-FIXED colours — readable on white paper
  bodyText:    [30,  40,  60]  as const,  // was [220,230,245] — now dark navy
  muted:       [80, 100, 130]  as const,  // was [120,140,165] — now mid-blue-grey
  // Metric card — light fill so text remains dark
  cardBg:      [240, 245, 252] as const,  // was dark [18,28,55] — now light grey-blue
  cardBorder:  [190, 205, 225] as const,  // was dark [40,55,90]  — now light border
}

type RGB = readonly [number, number, number]

/** jsPDF setFillColor / setTextColor / setDrawColor all accept (r,g,b) — helper avoids spread type errors */
function setFill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]) }
function setDraw(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]) }
function setTxt(doc: jsPDF, c: RGB)  { doc.setTextColor(c[0], c[1], c[2]) }

/** Draw a regular hexagon centred at (cx, cy) with circumradius r (mm). */
function drawHexagon(doc: jsPDF, cx: number, cy: number, r: number, style: 'F' | 'S' | 'FD') {
  const pts: [number, number][] = []
  for (let k = 0; k < 6; k++) {
    const angle = (Math.PI / 180) * (60 * k - 30)
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  doc.lines(
    pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]) as [number, number][],
    pts[0][0],
    pts[0][1],
    [1, 1],
    style,
    true,
  )
}

export function verdict(containmentProbability: number, safetyFactor: number): {
  label: string; sub: string; color: RGB
} {
  if (containmentProbability > 0.75 && safetyFactor > 1.5) {
    return { label: 'VIABLE FOR CO\u2082 STORAGE', sub: 'Recommended for detailed feasibility study', color: CLR.emerald }
  }
  if (containmentProbability < 0.5 || safetyFactor < 1.0) {
    return { label: 'NOT RECOMMENDED', sub: 'Significant geomechanical or containment concerns identified', color: CLR.rose }
  }
  return { label: 'NEEDS FURTHER STUDY', sub: 'Moderate risk — additional site characterisation required', color: CLR.amber }
}

export function generateRecommendations(
  params: FormationParams,
  result: SimulationResult,
  geomech: GeomechanicsResult | null,
): string[] {
  const recs: string[] = []
  const cp = result.containmentProbability
  const sf = geomech?.safetyFactor ?? 0

  if (cp > 0.75 && sf > 1.5) {
    recs.push(
      `Storage capacity of ${result.p50.toFixed(0)} Mt CO\u2082 (P50) is commercially significant. ` +
      `Advance to front-end engineering and site-specific seismic acquisition.`,
    )
  } else if (cp < 0.5) {
    recs.push(
      `Containment probability of ${(cp * 100).toFixed(0)}% is below acceptable threshold. ` +
      `Re-evaluate caprock integrity and consider alternative formations.`,
    )
  } else {
    recs.push(
      `Formation shows moderate storage potential. Conduct 3D seismic survey to confirm ` +
      `caprock lateral extent and thickness before committing to an injection programme.`,
    )
  }

  if (sf > 0 && sf < 1.5) {
    recs.push(
      `Geomechanical safety factor of ${sf.toFixed(2)} is below the recommended 1.5 threshold. ` +
      `Commission detailed in-situ stress measurement (mini-frac or XLOT) to refine MAIP.`,
    )
  } else if (sf >= 1.5) {
    recs.push(
      `Geomechanical safety factor of ${sf.toFixed(2)} exceeds the 1.5 threshold — ` +
      `caprock integrity is adequate. Proceed with injection rate optimisation.`,
    )
  } else {
    recs.push(
      `Formation brine salinity requires laboratory sampling to refine interfacial tension ` +
      `and CO\u2082 solubility model inputs before regulatory submission.`,
    )
  }

  // Use storageCapacity as denominator (mass-conservative injection total).
  // The non-overlapping trapping components are: residual + dissolvedOnly + mineral + mobile.
  // dissolvedOnly = solubility - mineral (avoids double-counting mineralised CO₂).
  const dissolvedOnlyRec = Math.max(0, result.solubilityTrapping - result.mineralTrapping)
  const allTotal = Math.max(0.001, result.storageCapacity || (
    result.residualTrapping + result.solubilityTrapping + result.mobilePlume
  ))
  const permanentPct = ((result.residualTrapping + dissolvedOnlyRec + result.mineralTrapping) / allTotal) * 100
  const mobilePct = (result.mobilePlume / allTotal) * 100
  if (permanentPct > 50) {
    recs.push(
      `${permanentPct.toFixed(0)}% of stored CO\u2082 is in permanent trapping phases (residual + dissolution). ` +
      `Strong trapping performance supports long-term permanence claims for carbon credit issuance.`,
    )
  } else {
    recs.push(
      `Structural trapping fraction is ${mobilePct.toFixed(0)}% of total stored volume. ` +
      `Enhanced monitoring and injection rate controls are recommended to manage plume migration.`,
    )
  }

  return recs.slice(0, 3)
}

// ── Main export function ───────────────────────────────────────────────────────

export function exportExecutiveSummary(
  params: FormationParams,
  result: SimulationResult,
  geomechanics: GeomechanicsResult | null,
  user: { displayName?: string } | null,
  formationName: string,
  formationLocation: string,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()   // 210
  const H = doc.internal.pageSize.getHeight()  // 297
  const M = 14 // margin

  const sf = geomechanics?.safetyFactor ?? 0
  const cp = result.containmentProbability
  const v = verdict(cp, sf)
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const assessedBy = user?.displayName || 'CarbonLens Demo'

  // ── WHITE PAGE BACKGROUND (explicit, belt-and-braces) ──────────────────────
  setFill(doc, CLR.white)
  doc.rect(0, 0, W, H, 'F')

  // ── HEADER BAND ────────────────────────────────────────────────────────────
  const hdr = 28
  setFill(doc, CLR.navy)
  doc.rect(0, 0, W, hdr, 'F')
  // Accent bar at bottom of header
  setFill(doc, CLR.emerald)
  doc.rect(0, hdr - 1.2, W, 1.2, 'F')

  // ── LOGO: teal hexagon + "CarbonLens" ──────────────────────────────────────
  // Hexagon centred at (M + 5, hdr/2) with circumradius 4.5 mm
  const logoX = M + 5
  const logoY = hdr / 2
  const logoR = 4.5
  setFill(doc, CLR.emerald)
  setDraw(doc, CLR.emerald)
  doc.setLineWidth(0.1)
  drawHexagon(doc, logoX, logoY, logoR, 'F')

  // Inner "C" letterform: white circle outline inside hexagon
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.9)
  doc.circle(logoX, logoY, 2.1, 'S')
  // Small white dot to give it a lens/aperture feel
  doc.setFillColor(255, 255, 255)
  doc.circle(logoX, logoY, 0.55, 'F')

  // "CarbonLens" wordmark
  doc.setFontSize(13.5)
  doc.setFont('helvetica', 'bold')
  setTxt(doc, CLR.white)
  doc.text('CarbonLens', M + 12, logoY + 2)

  // Header right — document type
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  setTxt(doc, CLR.silver)
  doc.text('CO\u2082 Geological Storage \u2014 Executive Screening Report', W - M, 11, { align: 'right' })
  doc.setFontSize(6.5)
  setTxt(doc, [160, 175, 200] as const)
  doc.text('PRELIMINARY ASSESSMENT  |  ' + date, W - M, 18, { align: 'right' })

  // ── FORMATION IDENTITY BLOCK ────────────────────────────────────────────────
  let y = hdr + 9

  // Light card — readable on white page
  setFill(doc, [245, 248, 255] as const)
  setDraw(doc, CLR.cardBorder)
  doc.setLineWidth(0.3)
  doc.roundedRect(M, y - 3, W - M * 2, 26, 2, 2, 'FD')

  // Left column
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  setTxt(doc, CLR.muted)
  doc.text('FORMATION NAME', M + 4, y + 2)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  setTxt(doc, CLR.navy)
  doc.text(formationName, M + 4, y + 8)

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  setTxt(doc, CLR.muted)
  doc.text('LOCATION', M + 4, y + 14)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  setTxt(doc, CLR.bodyText)
  doc.text(formationLocation, M + 4, y + 19.5)

  // Right column
  const rcx = W - M - 4
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  setTxt(doc, CLR.muted)
  doc.text('ASSESSED BY', rcx, y + 2, { align: 'right' })

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  setTxt(doc, CLR.bodyText)
  doc.text(assessedBy, rcx, y + 8, { align: 'right' })

  doc.setFontSize(6.5)
  setTxt(doc, CLR.muted)
  doc.text('ASSESSMENT DATE', rcx, y + 14, { align: 'right' })

  doc.setFontSize(8.5)
  setTxt(doc, CLR.bodyText)
  doc.text(date, rcx, y + 19.5, { align: 'right' })

  y += 30

  // ── VERDICT BLOCK ───────────────────────────────────────────────────────────
  const vH = 22
  // Very light tint derived from verdict colour (readable on white)
  const tintR = Math.round(255 - (255 - v.color[0]) * 0.08)
  const tintG = Math.round(255 - (255 - v.color[1]) * 0.08)
  const tintB = Math.round(255 - (255 - v.color[2]) * 0.08)
  doc.setFillColor(tintR, tintG, tintB)
  setDraw(doc, v.color)
  doc.setLineWidth(1.0)
  doc.roundedRect(M, y, W - M * 2, vH, 2.5, 2.5, 'FD')

  // Left colour accent strip
  setFill(doc, v.color)
  doc.roundedRect(M, y, 3.5, vH, 1.5, 1.5, 'F')
  doc.rect(M + 2, y, 1.5, vH, 'F') // flush right edge of strip

  // Verdict label
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  setTxt(doc, v.color)
  doc.text(v.label, M + 7, y + 10)

  // Verdict sub-text — dark for readability
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  setTxt(doc, CLR.bodyText)
  doc.text(v.sub, M + 7, y + 17)

  y += vH + 7

  // ── KEY METRICS — 3-column ─────────────────────────────────────────────────
  const colW = (W - M * 2 - 6) / 3
  const metricsH = 28
  const metrics = [
    {
      label: 'STORAGE CAPACITY',
      main: `${result.p50.toFixed(0)} Mt CO\u2082`,
      sub1: `P10: ${result.p10.toFixed(0)} Mt`,   // P10 = optimistic/high (DOE 10% exceedance)
      sub2: `P90: ${result.p90.toFixed(0)} Mt`,   // P90 = conservative/low (DOE 90% exceedance)
      note: `P50 best estimate \u2014 Cc=${result.storageEfficiency.toFixed(1)}% (DOE Goodman 2011)`,
    },
    {
      label: 'SAFETY RATING',
      main: sf > 0
        ? (sf >= 1.5 ? 'LOW RISK' : sf >= 1.0 ? 'MODERATE RISK' : 'HIGH RISK')
        : 'NOT COMPUTED',
      main_color: sf >= 1.5 ? CLR.emerald : sf >= 1.0 ? CLR.amber : CLR.rose,
      sub1: `Safety Factor: ${sf > 0 ? sf.toFixed(2) : '\u2014'}`,
      sub2: `Containment: ${(cp * 100).toFixed(0)}%`,
      note: 'Mohr-Coulomb analysis',
    },
    {
      label: 'INJECTION PRESSURE',
      main: `${result.injectionPressure.toFixed(1)} MPa`,
      sub1: `Reservoir P: ${params.pressure.toFixed(1)} MPa`,
      sub2: `Depth: ${params.depth} m`,
      note: 'Nordbotten (2005) two-phase radial flow',
    },
  ]

  metrics.forEach((m, i) => {
    const cx = M + i * (colW + 3)

    // Light grey-blue card — text stays dark and readable
    setFill(doc, CLR.cardBg)
    setDraw(doc, CLR.cardBorder)
    doc.setLineWidth(0.25)
    doc.roundedRect(cx, y, colW, metricsH, 2, 2, 'FD')

    // Top accent line in metric colour
    const accentColor: RGB = (m as any).main_color ?? CLR.navy
    setFill(doc, accentColor)
    doc.roundedRect(cx, y, colW, 1.2, 0.8, 0.8, 'F')
    doc.rect(cx, y + 0.6, colW, 0.6, 'F') // flush bottom of accent

    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    setTxt(doc, CLR.muted)
    doc.text(m.label, cx + 4, y + 7)

    const mc: RGB = (m as any).main_color ?? CLR.navy
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    setTxt(doc, mc)
    doc.text(m.main, cx + 4, y + 14)

    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    setTxt(doc, CLR.bodyText)
    doc.text(m.sub1, cx + 4, y + 19.5)
    doc.text(m.sub2, cx + 4, y + 23.5)

    doc.setFontSize(5.5)
    setTxt(doc, CLR.muted)
    doc.text(m.note, cx + colW - 3, y + metricsH - 2.5, { align: 'right' })
  })

  y += metricsH + 8

  // ── SECTION TITLE HELPER ─────────────────────────────────────────────────
  const sectionTitle = (title: string, yPos: number) => {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    setTxt(doc, CLR.navy)                   // navy — visible on white page
    doc.text(title, M, yPos)
    setDraw(doc, CLR.cardBorder)
    doc.setLineWidth(0.2)
    doc.line(M + doc.getTextWidth(title) + 3, yPos - 0.5, W - M, yPos - 0.5)
  }

  // ── TRAPPING BREAKDOWN — HOW CO₂ IS STORED ─────────────────────────────────
  sectionTitle('HOW CO\u2082 IS STORED', y)
  y += 5

  // mineralTrapping is a SUBSET of solubilityTrapping that has precipitated.
  // Split into non-overlapping pools so the four bars sum to 100% of storageCapacity:
  //   residual + dissolvedOnly + mineral + mobile = residual + solubility + mobile ≈ storageCapacity
  const dissolvedOnly = Math.max(0, result.solubilityTrapping - result.mineralTrapping)
  const stored = result.storageCapacity || 1
  const bars: Array<{ label: string; value: number; color: RGB }> = [
    { label: 'Residual trapping',          value: result.residualTrapping, color: CLR.emerald },
    { label: 'Dissolution (aqueous phase)', value: dissolvedOnly,           color: [56, 189, 248]  as const },
    { label: 'Mineral trapping',           value: result.mineralTrapping,  color: [167, 139, 250] as const },
    { label: 'Structural Trapping',        value: result.mobilePlume,      color: CLR.amber },
  ]
  const barMaxW = W - M * 2 - 52
  const barH = 4.5
  const barGap = 2.8

  bars.forEach((bar) => {
    const pct = Math.min(1, Math.max(0, bar.value / stored))
    const barW = Math.max(0.5, pct * barMaxW)
    const pctLabel = `${(pct * 100).toFixed(0)}%`

    // Bar label — dark for contrast on white
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    setTxt(doc, CLR.bodyText)
    doc.text(bar.label, M, y + barH - 0.8)

    // Track (background)
    setFill(doc, [225, 232, 245] as const)
    doc.roundedRect(M + 45, y, barMaxW, barH, 1, 1, 'F')

    // Filled portion
    setFill(doc, bar.color)
    if (barW > 1) {
      doc.roundedRect(M + 45, y, barW, barH, 1, 1, 'F')
    }

    // Percentage label — mid-tone, readable on white
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    setTxt(doc, CLR.muted)
    doc.text(pctLabel, M + 45 + barMaxW + 4, y + barH - 0.8)

    y += barH + barGap
  })

  y += 4

  // ── RECOMMENDATIONS ────────────────────────────────────────────────────────
  sectionTitle('RECOMMENDATIONS', y)
  y += 5

  const recs = generateRecommendations(params, result, geomechanics)
  recs.forEach((rec, i) => {
    // Number badge (emerald circle)
    setFill(doc, CLR.emerald)
    doc.circle(M + 3, y + 2.5, 2.6, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    setTxt(doc, CLR.white)
    doc.text(String(i + 1), M + 3, y + 3.9, { align: 'center' })

    // Rec text — dark for readability on white
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    setTxt(doc, CLR.bodyText)
    const wrapped = doc.splitTextToSize(rec, W - M * 2 - 11)
    doc.text(wrapped, M + 9, y + 3.5)
    y += wrapped.length * 4.2 + 4.5
  })

  // ── FORMATION PARAMETERS STRIP ─────────────────────────────────────────────
  y += 2
  const paramItems = [
    `Depth: ${params.depth} m`,
    `Thickness: ${params.thickness} m`,
    `Porosity: ${(params.porosity * 100).toFixed(0)}%`,
    `Permeability: ${params.permeability} mD`,
    `Temperature: ${params.temperature}\u00B0C${params.geothermalGradient != null && params.surfaceTemperatureC != null ? ' (gradient-derived)' : ''}`,
    `Area: ${params.area} km\u00B2`,
  ]

  // Light strip — dark text guaranteed readable
  setFill(doc, [232, 238, 250] as const)
  setDraw(doc, CLR.cardBorder)
  doc.setLineWidth(0.2)
  doc.roundedRect(M, y, W - M * 2, 10, 1.5, 1.5, 'FD')

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  setTxt(doc, CLR.bodyText)
  const colStep = (W - M * 2 - 8) / paramItems.length
  paramItems.forEach((item, i) => {
    // Label portion (bold, muted)
    const parts = item.split(': ')
    doc.setFont('helvetica', 'bold')
    setTxt(doc, CLR.muted)
    doc.text(parts[0] + ': ', M + 4 + i * colStep, y + 6.5)
    const labelW = doc.getTextWidth(parts[0] + ': ')
    doc.setFont('helvetica', 'normal')
    setTxt(doc, CLR.navy)
    doc.text(parts[1] ?? '', M + 4 + i * colStep + labelW, y + 6.5)
  })

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  // Footer is a dark navy band at the bottom — two items on one row, no overlap
  const footerH = 14
  const fy = H - footerH
  setFill(doc, CLR.navy)
  doc.rect(0, fy, W, footerH, 'F')
  // Thin emerald accent at top of footer
  setFill(doc, CLR.emerald)
  doc.rect(0, fy, W, 0.8, 'F')

  // Single text row vertically centred in the footer band
  const ftY = fy + footerH / 2 + 1.5  // baseline ~mid-band

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')

  // Left: brand + URL + date
  setTxt(doc, CLR.silver)
  doc.setFont('helvetica', 'bold')
  doc.text('CarbonLens', M, ftY)
  const brandW = doc.getTextWidth('CarbonLens')
  doc.setFont('helvetica', 'normal')
  setTxt(doc, [150, 170, 200] as const)
  doc.text(
    ' \u2014 ' + window.location.hostname + ' \u2014 Generated ' + date + '  |  37 models across 11 domains \u2014 see validation report \u00a77',
    M + brandW,
    ftY,
  )

  // Right: institution disclaimer (single line, no MARS/ML/Sleipner reference)
  setTxt(doc, [150, 170, 200] as const)
  doc.text(
    'CarbonLens™  |  Screening-level accuracy — not a regulatory submission',
    W - M,
    ftY,
    { align: 'right' },
  )

  // ── SAVE ───────────────────────────────────────────────────────────────────
  const slug = formationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  doc.save(`carbonlens-executive-summary-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
