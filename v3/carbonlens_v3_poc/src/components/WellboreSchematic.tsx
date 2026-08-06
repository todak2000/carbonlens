/**
 * WellboreSchematic — SVG-based well cross-section diagram.
 *
 * Renders a scaled vertical profile showing:
 *   • Formation zones (overburden / caprock / reservoir)
 *   • Casing strings (nested, diameter-to-scale)
 *   • Cement fill (diagonal hatching)
 *   • Perforation / injection interval (chevron pattern)
 *   • Depth labels and a legend
 *
 * Used in two ways:
 *   1. As a React component in the Wells panel (interactive, browser)
 *   2. As `generateWellboreSVGString()` embedded inline in HTML reports
 */

import React from 'react'
import type { WellDesign, CasingString } from '../types/wellDesign'

// ── Layout constants (SVG coordinate space) ──────────────────────────────────
const SVG_W   = 320   // total SVG width  (px)
const SVG_H   = 520   // total SVG height (px)
const MARGIN_TOP    = 32
const MARGIN_BOTTOM = 20
const MARGIN_LEFT   = 72   // depth labels sit here
const TRACK_W = 100  // width of the wellbore track (centred)
const TRACK_CX = MARGIN_LEFT + TRACK_W / 2 + 14  // x centre of well

// Colour palette
const CLR = {
  overburden:  '#c8d8e8',  // light blue-grey
  caprock:     '#8e9baa',  // medium grey-blue (seal)
  reservoir:   '#d6c89a',  // warm tan
  casing:      '#b0c0d0',  // steel blue
  casingEdge:  '#6a7f95',
  cement:      '#d4c5a9',  // light tan/cream
  cementEdge:  '#8a7a60',
  perf:        '#ef4444',  // injection interval (red)
  perfEdge:    '#991b1b',
  tubingFill:  '#f0f8ff',  // inside tubing (fluid)
  label:       '#1e293b',
  muted:       '#64748b',
  white:       '#ffffff',
}

// ── Scale helper ──────────────────────────────────────────────────────────────
function makeDepthScale(totalDepth: number) {
  const trackH = SVG_H - MARGIN_TOP - MARGIN_BOTTOM
  return (depth_m: number) => MARGIN_TOP + (depth_m / totalDepth) * trackH
}

// ── Cement hatch pattern def ──────────────────────────────────────────────────
const HATCH_DEF = `
<defs>
  <pattern id="cementHatch" patternUnits="userSpaceOnUse" width="8" height="8">
    <rect width="8" height="8" fill="${CLR.cement}"/>
    <line x1="0" y1="8" x2="8" y2="0" stroke="${CLR.cementEdge}" stroke-width="0.8" opacity="0.6"/>
  </pattern>
  <pattern id="perfPattern" patternUnits="userSpaceOnUse" width="6" height="6">
    <rect width="6" height="6" fill="${CLR.perf}" opacity="0.15"/>
    <line x1="0" y1="3" x2="6" y2="3" stroke="${CLR.perfEdge}" stroke-width="0.7" stroke-dasharray="2 2"/>
  </pattern>
</defs>`

/**
 * Generate the full SVG markup string for the wellbore schematic.
 * Can be embedded directly in an HTML <div> or <object>.
 */
export function generateWellboreSVGString(design: WellDesign, label?: string): string {
  const td  = design.totalDepth_m
  const yOf = makeDepthScale(td)

  const cx  = TRACK_CX
  // Max outer diameter (inches) drives the pixel width scaling
  const maxOD = Math.max(...design.casingStrings.map(c => c.outerDiameter_in), 9)
  const pxPerIn = (TRACK_W * 0.45) / maxOD  // pixels per inch OD

  const parts: string[] = []

  // ── Background ──────────────────────────────────────────────────────────────
  parts.push(`<rect width="${SVG_W}" height="${SVG_H}" fill="${CLR.white}" rx="6"/>`)

  // ── Formation zones ─────────────────────────────────────────────────────────
  const zoneRight = cx + maxOD * pxPerIn + 28

  // Overburden (surface → caprock top)
  const yOBtop = MARGIN_TOP
  const yOBbot = yOf(design.caprockTopDepth_m)
  parts.push(`<rect x="${cx - zoneRight * 0.5 + 10}" y="${yOBtop}" width="${zoneRight - 14}" height="${yOBbot - yOBtop}" fill="${CLR.overburden}" opacity="0.35"/>`)
  parts.push(`<text x="${MARGIN_LEFT + TRACK_W + 26}" y="${(yOBtop + yOBbot) / 2 + 4}" font-size="8" fill="${CLR.muted}" font-family="monospace">OVERBURDEN</text>`)

  // Caprock
  const yCRtop = yOf(design.caprockTopDepth_m)
  const yCRbot = yOf(design.caprockBottomDepth_m)
  parts.push(`<rect x="${cx - zoneRight * 0.5 + 10}" y="${yCRtop}" width="${zoneRight - 14}" height="${Math.max(3, yCRbot - yCRtop)}" fill="${CLR.caprock}" opacity="0.55"/>`)
  parts.push(`<text x="${MARGIN_LEFT + TRACK_W + 26}" y="${(yCRtop + yCRbot) / 2 + 4}" font-size="8" fill="${CLR.white}" font-weight="600" font-family="monospace">CAPROCK</text>`)

  // Reservoir
  const yRStop = yOf(design.reservoirTopDepth_m)
  const yRSbot = yOf(design.reservoirBottomDepth_m)
  parts.push(`<rect x="${cx - zoneRight * 0.5 + 10}" y="${yRStop}" width="${zoneRight - 14}" height="${yRSbot - yRStop}" fill="${CLR.reservoir}" opacity="0.45"/>`)
  parts.push(`<text x="${MARGIN_LEFT + TRACK_W + 26}" y="${(yRStop + yRSbot) / 2 + 4}" font-size="8" fill="${CLR.label}" font-weight="600" font-family="monospace">RESERVOIR</text>`)

  // ── Casing strings (draw from largest to smallest so inner strings are on top) ──
  design.casingStrings.forEach((c, casingIdx) => {
    const halfOD = c.outerDiameter_in * pxPerIn
    const halfID = c.innerDiameter_in * pxPerIn
    const yTop   = yOf(c.topDepth_m)
    const yBot   = yOf(c.bottomDepth_m)
    const yCemTop = yOf(c.cementTopDepth_m)
    const yCemBot = yBot

    // Cement annulus (outside casing body)
    if (yCemTop < yCemBot) {
      parts.push(
        `<rect x="${cx - halfOD - 4}" y="${yCemTop}" ` +
        `width="${(halfOD + 4) * 2}" height="${yCemBot - yCemTop}" ` +
        `fill="url(#cementHatch)" stroke="${CLR.cementEdge}" stroke-width="0.4" opacity="0.9"/>`
      )
    }

    // Casing wall (left)
    parts.push(
      `<rect x="${cx - halfOD}" y="${yTop}" width="${halfOD - halfID}" height="${yBot - yTop}" ` +
      `fill="${CLR.casing}" stroke="${CLR.casingEdge}" stroke-width="0.8"/>`
    )
    // Casing wall (right)
    parts.push(
      `<rect x="${cx + halfID}" y="${yTop}" width="${halfOD - halfID}" height="${yBot - yTop}" ` +
      `fill="${CLR.casing}" stroke="${CLR.casingEdge}" stroke-width="0.8"/>`
    )
    // Shoe (bottom cap)
    parts.push(
      `<rect x="${cx - halfOD}" y="${yBot - 4}" width="${halfOD * 2}" height="4" ` +
      `fill="${CLR.casingEdge}" rx="1"/>`
    )
    // Casing label (right side, staggered by index to prevent overlap at shallow tops)
    const labelY = yTop + 10 + casingIdx * 14
    parts.push(
      `<text x="${cx + halfOD + 6}" y="${labelY}" font-size="7.5" fill="${CLR.muted}" font-family="monospace">` +
      `${c.name} ${c.outerDiameter_in}"` +
      `</text>`
    )
  })

  // ── Perforation / injection interval ─────────────────────────────────────
  const yPtop = yOf(design.perforationTopDepth_m)
  const yPbot = yOf(design.perforationBottomDepth_m)
  const perfHalfW = design.casingStrings.length > 0
    ? design.casingStrings[design.casingStrings.length - 1].innerDiameter_in * pxPerIn * 0.8
    : 10

  // Red perforation band
  parts.push(
    `<rect x="${cx - perfHalfW}" y="${yPtop}" width="${perfHalfW * 2}" height="${yPbot - yPtop}" ` +
    `fill="${CLR.perf}" opacity="0.25" stroke="${CLR.perfEdge}" stroke-width="0.8" stroke-dasharray="3 2"/>`
  )
  // Chevron shots (simulated perforations)
  const nPerfs = Math.max(4, Math.round((yPbot - yPtop) / 8))
  for (let k = 0; k < nPerfs; k++) {
    const yp = yPtop + (k + 0.5) * (yPbot - yPtop) / nPerfs
    parts.push(`<line x1="${cx - perfHalfW - 6}" y1="${yp}" x2="${cx - perfHalfW}" y2="${yp}" stroke="${CLR.perfEdge}" stroke-width="1.5" stroke-linecap="round"/>`)
    parts.push(`<line x1="${cx + perfHalfW}" y1="${yp}" x2="${cx + perfHalfW + 6}" y2="${yp}" stroke="${CLR.perfEdge}" stroke-width="1.5" stroke-linecap="round"/>`)
  }
  // Label
  parts.push(
    `<text x="${cx - perfHalfW - 8}" y="${(yPtop + yPbot) / 2 + 3}" text-anchor="end" font-size="7.5" ` +
    `fill="${CLR.perfEdge}" font-weight="600" font-family="monospace">PERFS</text>`
  )

  // ── Depth ticks and labels ────────────────────────────────────────────────
  const depthTicks = [
    design.caprockTopDepth_m,
    design.reservoirTopDepth_m,
    design.perforationTopDepth_m,
    design.perforationBottomDepth_m,
    design.totalDepth_m,
  ]
  const seenY: number[] = []
  for (const d of depthTicks) {
    const y = Math.round(yOf(d))
    if (seenY.some(sy => Math.abs(sy - y) < 16)) continue
    seenY.push(y)
    parts.push(`<line x1="${MARGIN_LEFT + 2}" y1="${y}" x2="${MARGIN_LEFT + TRACK_W + 20}" y2="${y}" stroke="${CLR.muted}" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.5"/>`)
    parts.push(`<text x="${MARGIN_LEFT - 2}" y="${y + 4}" text-anchor="end" font-size="8" fill="${CLR.label}" font-family="monospace">${d.toFixed(0)}m</text>`)
  }

  // ── Header ────────────────────────────────────────────────────────────────
  parts.push(
    `<text x="${SVG_W / 2}" y="18" text-anchor="middle" font-size="9.5" font-weight="700" ` +
    `fill="${CLR.label}" font-family="monospace">${label ?? 'WELLBORE DESIGN SCHEMATIC'}</text>`
  )

  // ── Horizontal legend at bottom ───────────────────────────────────────────
  const legItems = [
    { fill: `url(#cementHatch)`, stroke: CLR.cementEdge, opacity: '1', label: 'Cement' },
    { fill: CLR.casing, stroke: CLR.casingEdge, opacity: '1', label: 'Casing' },
    { fill: CLR.perf, stroke: CLR.perfEdge, opacity: '0.4', label: 'Perforations' },
  ]
  const legY = SVG_H - 8
  const legItemW = Math.floor((SVG_W - 16) / legItems.length)
  parts.push(`<line x1="6" y1="${SVG_H - 20}" x2="${SVG_W - 6}" y2="${SVG_H - 20}" stroke="${CLR.muted}" stroke-width="0.5" opacity="0.35"/>`)
  legItems.forEach((item, i) => {
    const lx = 8 + i * legItemW
    parts.push(`<rect x="${lx}" y="${legY - 10}" width="11" height="9" fill="${item.fill}" stroke="${item.stroke ?? 'none'}" stroke-width="0.5" opacity="${item.opacity}" rx="1"/>`)
    parts.push(`<text x="${lx + 15}" y="${legY - 1}" font-size="7.5" fill="${CLR.muted}" font-family="monospace">${item.label}</text>`)
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">${HATCH_DEF}${parts.join('')}</svg>`
}

// ── React component wrapper ───────────────────────────────────────────────────

interface WellboreSchematicProps {
  design: WellDesign
  label?: string
  className?: string
  style?: React.CSSProperties
}

export const WellboreSchematic: React.FC<WellboreSchematicProps> = ({
  design,
  label,
  className,
  style,
}) => {
  const svgString = generateWellboreSVGString(design, label)
  return (
    <div
      className={className ? `wellbore-responsive ${className}` : 'wellbore-responsive'}
      style={{ display: 'inline-block', lineHeight: 0, maxWidth: '100%', ...style }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled SVG generation
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  )
}

export default WellboreSchematic
