export interface HeterogeneityCorrectionResult {
  sweepEfficiency: number
  storageEfficiency: number
  aorHeterogeneityFactor: number
  kArithmeticGeometricRatio: number
}

export function computeSweepEfficiency(
  k_Vdp: number,
  mobilityRatio: number,
  pvi: number,
  porosity: number,
): number {
  const V = Math.max(0, Math.min(0.85, k_Vdp))
  if (V < 1e-10) return 1.0
  const phi = Math.max(0.01, Math.min(0.5, porosity))
  const k_mean = 1.0
  const k_ref = k_mean * (1 - V)
  const FQI = Math.sqrt(k_mean / Math.max(1e-10, k_ref)) * (1 - V) / phi
  const PVI = Math.max(0, pvi)
  return Math.max(0, Math.min(1, 1 - Math.exp(-3 * PVI * FQI)))
}

export function computeStorageEfficiency(
  k_Vdp: number,
  k_layer_ratio: number,
  n_layers: number,
  mobilityRatio: number,
  pvi: number,
  porosity: number,
  netToGross: number,
): number {
  const layerRatio = n_layers <= 1 ? 1 : Math.max(1, k_layer_ratio)
  const E_geo = Math.max(0.01, Math.min(1, netToGross)) * (1 / Math.sqrt(layerRatio))
  const E_s = computeSweepEfficiency(k_Vdp, mobilityRatio, pvi, porosity)
  const M = Math.max(1, mobilityRatio)
  const E_d = 1 / Math.sqrt(M)
  return Math.max(0.01, Math.min(1, E_geo * E_s * E_d))
}

/**
 * Compute the AoR heterogeneity factor — the multiplier that converts a
 * homogeneous Theis AoR radius to a heterogeneity-corrected radius.
 *
 * For a log-normal permeability distribution with Dykstra-Parsons V:
 *
 *   σ             = -ln(1 - V)
 *   k_arth/k_geo  = exp(σ² / 2)
 *   f_AoR         = √(k_arth / k_geo) = exp(σ² / 4)
 *
 * The pressure front propagates through the arithmetic mean transmissivity,
 * while the homogeneous model uses the geometric mean. When layers are
 * present, high-perm layers channel pressure farther.
 *
 * Returns 1.0 for n_layers ≤ 1 (no layering → no correction).
 */
export function computeAoRHeterogeneityFactor(
  k_Vdp: number,
  n_layers: number,
): number {
  if (n_layers <= 1 || k_Vdp < 1e-10) return 1.0
  const V = Math.max(0, Math.min(0.85, k_Vdp))
  const sigma = -Math.log(1 - V)
  const kRatio = Math.exp(sigma * sigma / 2)
  return Math.sqrt(kRatio)
}

/**
 * Compute all heterogeneity corrections in a single call.
 *
 * This is the primary entry point for the simulation pipeline. Returns a
 * HeterogeneityCorrectionResult with all three corrections computed.
 */
export function computeHeterogeneityCorrections(
  k_Vdp: number,
  mobilityRatio: number,
  netToGross: number,
  n_layers: number,
  k_layer_ratio: number = 1,
  pvi: number = 1.0,
  porosity: number = 0.2,
): HeterogeneityCorrectionResult {
  const V = Math.max(0, Math.min(0.85, k_Vdp))
  const M = Math.max(1, mobilityRatio)

  const sweepEfficiency = computeSweepEfficiency(V, M, pvi, porosity)
  const storageEfficiency = computeStorageEfficiency(V, k_layer_ratio, n_layers, M, pvi, porosity, netToGross)
  const aorHeterogeneityFactor = computeAoRHeterogeneityFactor(V, n_layers)

  let kArithmeticGeometricRatio = 1
  if (V >= 1e-10) {
    const sigma = -Math.log(1 - V)
    kArithmeticGeometricRatio = Math.exp(sigma * sigma / 2)
  }

  return {
    sweepEfficiency,
    storageEfficiency,
    aorHeterogeneityFactor,
    kArithmeticGeometricRatio,
  }
}
