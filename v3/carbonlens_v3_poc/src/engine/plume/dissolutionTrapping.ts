import { LithologyType } from '../../types/geological'

export interface DissolutionParams {
  /** Mass transfer coefficient (m/s) — 1e-8 typical for CO2/brine */
  kLa: number
  /** Solubility limit in normalised saturation units */
  solubilityNorm: number
  /** Molecular diffusivity of CO2 in brine (m²/s) */
  D_m: number
  /** Brine density increase from CO2 dissolution (kg/m³) */
  deltaRho_diss: number
}

const DEFAULT_DISSOLUTION: DissolutionParams = {
  kLa: 1e-8,
  solubilityNorm: 0.05,
  D_m: 2e-9,
  deltaRho_diss: 2.0,
}

export function makeDissolutionParams(solubilityNorm: number): DissolutionParams {
  return { ...DEFAULT_DISSOLUTION, solubilityNorm }
}

function specificInterfacialArea(
  Sg: number,
  phi: number,
  k_mD: number,
): number {
  if (Sg <= 0.001 || phi <= 0.001) return 0
  const k_m2 = k_mD * 9.869e-16
  const sqrtPhiOverK = Math.sqrt(phi / Math.max(1e-15, k_m2))
  return Sg * phi * sqrtPhiOverK
}

export function convectiveEnhancement(
  k_mD: number,
  phi: number,
  H_dissolved: number,
  g: number,
  mu_brine: number,
  params: DissolutionParams = DEFAULT_DISSOLUTION,
): number {
  if (H_dissolved <= 0.01) return 1
  const k_m2 = k_mD * 9.869e-16
  const Ra = (params.deltaRho_diss * k_m2 * g * H_dissolved) / (phi * params.D_m * mu_brine)
  const Ra_crit = 4 * Math.PI * Math.PI
  return Math.max(1, Ra / Ra_crit)
}

export function calculateDissolution(
  Sg: number,
  Sg_dissolved: number,
  phi: number,
  k_mD: number,
  H: number,
  g: number,
  mu_brine: number,
  DT: number,
  params: DissolutionParams = DEFAULT_DISSOLUTION,
  kLaMultiplier: number = 1.0,
): number {
  if (Sg <= 0.001) return 0

  const deficit = Math.max(0, 1 - Sg_dissolved / Math.max(0.001, params.solubilityNorm))
  if (deficit <= 0) return 0

  const a_s = specificInterfacialArea(Sg, phi, k_mD)
  if (a_s <= 0) return 0

  // kLaMultiplier scales the mass transfer coefficient kLa.
  // Default 1.0 preserves existing behavior; history matching can vary this.
  const effectiveKLa = params.kLa * kLaMultiplier
  const baseRate = effectiveKLa * a_s * deficit * DT

  const enhancement = convectiveEnhancement(k_mD, phi, H, g, mu_brine, params)

  const rate = baseRate * enhancement
  if (!isFinite(rate) || isNaN(rate)) return 0

  return Math.min(rate, Sg * 0.5, params.solubilityNorm - Sg_dissolved)
}
