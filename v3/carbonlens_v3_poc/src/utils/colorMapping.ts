import { GridCell } from './geologicalModelToGrid'

// ── CO2 phase color palette ──────────────────────────────────────────────────
// Each color is [r, g, b] in 0–1 range for Three.js

const BRINE_DEEP:      [number, number, number] = [0.051, 0.129, 0.216]  // #0d2137 pure brine
const BRINE_LIGHT:     [number, number, number] = [0.180, 0.435, 0.639]  // #2e6fa3 CO2 arriving
const CO2_AMBER:       [number, number, number] = [0.961, 0.620, 0.043]  // #f59e0b partial fill
const CO2_ORANGE:      [number, number, number] = [0.937, 0.267, 0.267]  // #ef4444 heavy fill
const CO2_RED:         [number, number, number] = [0.863, 0.149, 0.149]  // #dc2626 full CO2
const RESIDUAL_GREEN:  [number, number, number] = [0.063, 0.722, 0.506]  // #10b981 capillary trapped
const DISSOLVED_TEAL:  [number, number, number] = [0.078, 0.722, 0.639]  // #14b8a6 dissolved in brine
const MINERAL_GOLD:    [number, number, number] = [0.706, 0.298, 0.035]  // #b45309 mineralised
const CAPROCK_GREY:    [number, number, number] = [0.392, 0.361, 0.431]  // #64748b seal
const IMBIBITION_PURPLE: [number, number, number] = [0.55, 0.2, 0.75]   // imbibition front
const FAULT_SEAL_RED:  [number, number, number] = [0.600, 0.100, 0.100]  // sealing fault cell
const FAULT_OPEN_GRN:  [number, number, number] = [0.050, 0.450, 0.200]  // open fault cell

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/**
 * Map CO2 saturation + phase state → RGB colour for InstancedMesh.
 * Used during and after simulation.
 */
export function saturationToColor(
  sat: number,
  phase: GridCell['co2Phase'],
  isCaprock: boolean,
): [number, number, number] {
  if (isCaprock) return CAPROCK_GREY

  switch (phase) {
    case 'residual':   return RESIDUAL_GREEN
    case 'dissolved':  return DISSOLVED_TEAL
    case 'mineral':    return MINERAL_GOLD
    case 'none':       return BRINE_DEEP
    case 'imbibition': return IMBIBITION_PURPLE
    case 'free': {
      const s = Math.max(0, Math.min(1, sat))
      if (s < 0.20) return lerp3(BRINE_LIGHT, CO2_AMBER,  s / 0.20)
      if (s < 0.60) return lerp3(CO2_AMBER,   CO2_ORANGE, (s - 0.20) / 0.40)
      return              lerp3(CO2_ORANGE,   CO2_RED,    (s - 0.60) / 0.40)
    }
    default: return BRINE_DEEP
  }
}

/**
 * Map cell geology properties → RGB colour for the pre-simulation property view.
 * Blends lithology base colour with porosity brightness.
 */
export function lithologyToColor(
  cell: Pick<GridCell, 'porosity' | 'kHorizontal' | 'isCaprock' | 'faultTransmX' | 'faultTransmY'>,
  isCaprock: boolean,
): [number, number, number] {
  if (isCaprock) return CAPROCK_GREY

  // Porosity drives brightness: low-phi → dark, high-phi → bright
  const phiNorm = Math.max(0, Math.min(1, (cell.porosity - 0.05) / 0.35))
  // Permeability drives colour temperature: low-k → cool grey-blue, high-k → warm sand
  const logK = Math.log10(Math.max(0.001, cell.kHorizontal))
  const kNorm = Math.max(0, Math.min(1, (logK - (-2)) / (4 - (-2))))  // log10(0.01) to log10(10000)

  const sandBase:  [number, number, number] = [0.714, 0.569, 0.337]  // warm tan (high k)
  const shaleBase: [number, number, number] = [0.271, 0.259, 0.310]  // cool grey (low k)
  const base = lerp3(shaleBase, sandBase, kNorm)

  const brightness = 0.55 + phiNorm * 0.45
  const result: [number, number, number] = [base[0] * brightness, base[1] * brightness, base[2] * brightness]

  // Fault cells: tint red (sealing) or green (open) based on transmissibility
  const minTransm = Math.min(cell.faultTransmX, cell.faultTransmY)
  if (minTransm < 0.3) {
    const t = (0.3 - minTransm) / 0.3
    return lerp3(result, FAULT_SEAL_RED, t * 0.5)
  }
  if (minTransm < 0.7 && minTransm > 0.3) {
    // partial — no tint
  }

  return result
}

