/**
 * Synthetic SCADA Simulator
 *
 * Generates synthetic "observed" field data by adding physically realistic
 * Gaussian noise to simulation snapshots. Writes results to IndexedDB.
 *
 * Purpose: allows the Monitoring panel to demonstrate observed-vs-predicted
 * deviation tracking before a real SCADA API is available. The noise model
 * is calibrated to reflect:
 *   - Pressure gauge uncertainty: 2-10% (instrument + wellbore friction model error)
 *   - Plume area uncertainty:     10-40% (4D seismic interpretation uncertainty,
 *     consistent with Boait et al. 2012 Sleipner analysis)
 *   - Injection rate uncertainty: 1-5%  (flow meter accuracy class)
 *
 * Reference: Boait et al. (2012) Spatial and temporal evolution of injected CO2
 * at the Sleipner Field, North Sea. JGR Solid Earth 117:B03309.
 */

import { db } from '../../db/projectDb'
import type { SimulationSnapshot, MonitoringObservation } from '../../db/projectDb'

export type NoiseLevel = 'low' | 'medium' | 'high'

/** Gaussian noise using Box-Muller transform. No external dependencies. */
function gaussianNoise(mean: number, stdFraction: number): number {
  // Box-Muller transform (polar form avoids log(0) edge case)
  let u1: number, u2: number, s: number
  do {
    u1 = Math.random() * 2 - 1
    u2 = Math.random() * 2 - 1
    s  = u1 * u1 + u2 * u2
  } while (s >= 1 || s === 0)
  const z = u1 * Math.sqrt(-2 * Math.log(s) / s)
  return mean * (1 + z * stdFraction)
}

const NOISE_PARAMS: Record<NoiseLevel, { pressure: number; plumeArea: number; injRate: number }> = {
  low:    { pressure: 0.02, plumeArea: 0.10, injRate: 0.01 },
  medium: { pressure: 0.05, plumeArea: 0.25, injRate: 0.02 },
  high:   { pressure: 0.10, plumeArea: 0.40, injRate: 0.05 },
}

export interface ScadaGeneratorConfig {
  projectId: string
  snapshots: SimulationSnapshot[]    // simulation baseline from IndexedDB
  reportingYears: number[]           // e.g. [1, 3, 5, 10, 20]
  noiseLevel: NoiseLevel
  p10PlumeArea: number               // Monte Carlo lower bound (km2)
  p90PlumeArea: number               // Monte Carlo upper bound (km2)
}

/**
 * Determine conformance status for a single observed value vs. simulation envelope.
 *
 * Green:  observed within [p10, p90]
 * Amber:  observed outside [p10, p90] but within 2x the envelope width
 * Red:    observed more than 2x the envelope width from the p50 (simulated) value
 */
function conformanceStatus(
  observed: number,
  simulated: number,
  p10: number,
  p90: number,
): 'green' | 'amber' | 'red' {
  if (observed >= p10 && observed <= p90) return 'green'
  const envelopeWidth = Math.abs(p90 - p10)
  const deviation     = Math.abs(observed - simulated)
  if (deviation <= 2 * envelopeWidth) return 'amber'
  return 'red'
}

export async function generateSyntheticScadaData(
  config: ScadaGeneratorConfig,
): Promise<MonitoringObservation[]> {
  const { projectId, snapshots, reportingYears, noiseLevel, p10PlumeArea, p90PlumeArea } = config
  const noise = NOISE_PARAMS[noiseLevel]
  const observations: MonitoringObservation[] = []

  for (const year of reportingYears) {
    // Find the closest simulation snapshot for this year
    const snap = snapshots.reduce<SimulationSnapshot | null>((best, s) => {
      if (best === null) return s
      return Math.abs(s.year - year) < Math.abs(best.year - year) ? s : best
    }, null)

    if (!snap) continue

    // Generate noisy observations
    const obsPressure = gaussianNoise(snap.pressureMPa, noise.pressure)
    const obsPlumeArea = Math.max(0, gaussianNoise(snap.plumeAreaKm2, noise.plumeArea))
    const obsInjRate = Math.max(0, gaussianNoise(
      (snap.injectedMt / Math.max(1, snap.year)),  // Mt/year average rate
      noise.injRate,
    ))

    // Deviation percentages
    const devPressure  = snap.pressureMPa > 0
      ? ((obsPressure - snap.pressureMPa) / snap.pressureMPa) * 100
      : null
    const devPlumeArea = snap.plumeAreaKm2 > 0
      ? ((obsPlumeArea - snap.plumeAreaKm2) / snap.plumeAreaKm2) * 100
      : null

    // Conformance based on plume area (most visible observable in CCS monitoring)
    const status = conformanceStatus(obsPlumeArea, snap.plumeAreaKm2, p10PlumeArea, p90PlumeArea)

    const obs: MonitoringObservation = {
      id: `${projectId}_synthetic_y${year}_${Date.now()}`,
      projectId,
      year,
      source: 'synthetic',
      observedPressureMPa: obsPressure,
      observedPlumeAreaKm2: obsPlumeArea,
      observedInjectionRateMtpa: obsInjRate,
      notes: `Synthetic SCADA observation at Year ${year}. Noise level: ${noiseLevel}. Box-Muller Gaussian noise model.`,
      deviationPressurePct: devPressure,
      deviationPlumeAreaPct: devPlumeArea,
      conformanceStatus: status,
      createdAt: Date.now(),
    }

    observations.push(obs)
  }

  // Write all observations to IndexedDB in a single bulk operation
  if (observations.length > 0) {
    await db.monitoringObservations.bulkPut(observations)
  }

  return observations
}
