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
      // Warm pale-gold start: even trace CO2 (sat ~ 0.05) is clearly non-brine.
      // Previous start (BRINE_LIGHT, cold blue) blended into the dark-navy brine
      // background, making the spreading plume fringe invisible in the grid view.
      const FAINT_CO2: [number, number, number] = [0.96, 0.86, 0.28]
      if (s < 0.25) return lerp3(FAINT_CO2,  CO2_AMBER,  s / 0.25)
      if (s < 0.60) return lerp3(CO2_AMBER,  CO2_ORANGE, (s - 0.25) / 0.35)
      return              lerp3(CO2_ORANGE,  CO2_RED,    (s - 0.60) / 0.40)
    }
    default: return BRINE_DEEP
  }
}

/**
 * Map CO2 density (kg/m3) from in-situ PVT field → RGB colour.
 * Used when colorProperty === 'co2Density' during an active simulation.
 * Purple = subcritical / low density gas phase (< 300 kg/m3)
 * Teal   = intermediate supercritical (~500 kg/m3)
 * Navy   = dense supercritical near injection zone (> 750 kg/m3)
 */
export function pvtDensityToColor(density_kgm3: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (density_kgm3 - 150) / 750))
  const PURPLE: [number, number, number] = [0.55, 0.12, 0.75]  // gas-phase / subcritical
  const TEAL:   [number, number, number] = [0.08, 0.68, 0.65]  // mid supercritical
  const NAVY:   [number, number, number] = [0.05, 0.18, 0.55]  // dense near-well
  if (t < 0.45) return lerp3(PURPLE, TEAL, t / 0.45)
  return lerp3(TEAL, NAVY, (t - 0.45) / 0.55)
}

/**
 * Map injection pressure above initial reservoir pressure → RGB colour.
 * Blue = ambient / no pressure perturbation
 * Yellow-red = high overpressure zone near injection well
 */
export function pressureFieldToColor(P_MPa: number, P_init_MPa: number): [number, number, number] {
  const dP = Math.max(0, P_MPa - P_init_MPa)
  const t  = Math.max(0, Math.min(1, dP / Math.max(1, P_init_MPa * 0.4)))
  const COOL:   [number, number, number] = [0.08, 0.35, 0.75]  // ambient pressure
  const WARM:   [number, number, number] = [0.90, 0.80, 0.10]  // moderate overpressure
  const HOT:    [number, number, number] = [0.88, 0.12, 0.12]  // high overpressure
  if (t < 0.5) return lerp3(COOL, WARM, t / 0.5)
  return lerp3(WARM, HOT, (t - 0.5) / 0.5)
}

/**
 * Map Mohr-Coulomb safety factor → RGB colour for geomechanical overlay.
 * Green (> 2.0) = safe; Yellow-orange (1.0-2.0) = marginal; Red (< 1.0) = failed.
 */
export function safetyFactorToColor(sf: number): [number, number, number] {
  if (sf >= 2.0) return [0.06, 0.72, 0.50]   // safe green
  if (sf >= 1.5) return [0.35, 0.75, 0.20]   // good
  if (sf >= 1.2) return [0.85, 0.78, 0.08]   // caution yellow
  if (sf >= 1.0) return [0.90, 0.42, 0.05]   // warning orange
  return [0.86, 0.10, 0.10]                   // failed red
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

