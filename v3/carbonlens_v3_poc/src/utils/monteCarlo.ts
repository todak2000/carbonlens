/**
 * Shared Monte Carlo engine — used by MonteCarloPanel (interactive) and
 * ExportPanel (auto-run at report generation time with 500 samples).
 */
import type { FormationParams } from '../types'
import { computeYearly } from '../hooks/useSimulation'
import { useFormationStore } from '../store/formationStore'

// ── Latin Hypercube Sampling ─────────────────────────────────────────────────
export function latinHypercube(n: number, d: number): number[][] {
  const result: number[][] = Array.from({ length: n }, () => new Array(d).fill(0))
  for (let j = 0; j < d; j++) {
    const perm = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[k]] = [perm[k], perm[i]]
    }
    for (let i = 0; i < n; i++) {
      result[i][j] = (perm[i] + Math.random()) / n
    }
  }
  return result
}

export function percentile(sorted: number[], p: number): number {
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * sorted.length)))
  return sorted[idx]
}

export interface MCRealization {
  id: number
  permMultiplier: number
  porosityDelta: number
  areaMultiplier: number
  thicknessMultiplier: number
  storageCapacity_Mt: number
  peakPressure_MPa: number
}

export interface MCResult {
  realizations: MCRealization[]
  p10_Mt: number; p50_Mt: number; p90_Mt: number
  p10_P: number;  p50_P: number;  p90_P: number
  runTimeMs: number
}

export interface MCConfig {
  permUncertPct: number      // ± % of base permeability (log-normal)
  poroUncertAbs: number      // ± absolute porosity
  areaUncertPct: number      // ± % of base area
  thickUncertPct: number     // ± % of base thickness
  nRealizations: number
}

export const DEFAULT_MC_CONFIG: MCConfig = {
  permUncertPct: 30,
  poroUncertAbs: 0.03,
  areaUncertPct: 20,
  thickUncertPct: 15,
  nRealizations: 100,
}

/** Config used when auto-generating MC at report export time. */
export const REPORT_MC_CONFIG: MCConfig = {
  permUncertPct: 30,
  poroUncertAbs: 0.03,
  areaUncertPct: 20,
  thickUncertPct: 15,
  nRealizations: 500,
}

export function runMonteCarlo(
  config: MCConfig,
  baseParams: FormationParams,
  projectYears: number,
): MCResult {
  const { permUncertPct, poroUncertAbs, areaUncertPct, thickUncertPct, nRealizations: N } = config
  const t0 = performance.now()

  const samples = latinHypercube(N, 4)
  const realizations: MCRealization[] = []

  // Determine the peak injection rate year — pressure must be evaluated here, not at
  // project end where the ramp-down has reduced rate to zero (which produced ΔP = 0).
  const storeWells = useFormationStore.getState().wells
  const maxRampDown = storeWells.length > 0
    ? Math.max(0, ...storeWells.map(w => w.rampDownYears ?? 0))
    : 0
  // Last year of sustained peak injection (just before ramp-down begins)
  const peakYear = Math.max(1, projectYears - maxRampDown - 1)

  for (let i = 0; i < N; i++) {
    const logMin = Math.log(1 - permUncertPct / 100)
    const logMax = Math.log(1 + permUncertPct / 100)
    const permMult = Math.exp(logMin + samples[i][0] * (logMax - logMin))

    const poroDelta = (samples[i][1] - 0.5) * 2 * poroUncertAbs

    const areaLogMin = Math.log(1 - areaUncertPct / 100)
    const areaLogMax = Math.log(1 + areaUncertPct / 100)
    const areaMult = Math.exp(areaLogMin + samples[i][2] * (areaLogMax - areaLogMin))

    const thickLogMin = Math.log(1 - thickUncertPct / 100)
    const thickLogMax = Math.log(1 + thickUncertPct / 100)
    const thickMult = Math.exp(thickLogMin + samples[i][3] * (thickLogMax - thickLogMin))

    const sampledParams: FormationParams = {
      ...baseParams,
      permeability: Math.max(1, baseParams.permeability * permMult),
      porosity: Math.max(0.01, Math.min(0.45, baseParams.porosity + poroDelta)),
      area: Math.max(0.1, (baseParams.area ?? 100) * areaMult),
      thickness: Math.max(1, (baseParams.thickness ?? 50) * thickMult),
    }

    // Evaluate at peakYear for pressure (injection is active) and capacity (volumetric,
    // year-independent). evaluating at projectYears gives rate=0 after ramp-down, so
    // injectionPressure = initial pressure and ΔP = 0 — a known bug now fixed.
    const result = computeYearly(sampledParams, peakYear, projectYears, null)

    realizations.push({
      id: i,
      permMultiplier: permMult,
      porosityDelta: poroDelta,
      areaMultiplier: areaMult,
      thicknessMultiplier: thickMult,
      storageCapacity_Mt: result.totalCapacity,
      peakPressure_MPa: Math.max(0, result.injectionPressure - sampledParams.pressure),
    })
  }

  const caps = [...realizations.map(r => r.storageCapacity_Mt)].sort((a, b) => a - b)
  const press = [...realizations.map(r => r.peakPressure_MPa)].sort((a, b) => a - b)

  return {
    realizations,
    p90_Mt: percentile(caps, 0.1), // P90 capacity: 90% exceedance (conservative/low estimate)
    p50_Mt: percentile(caps, 0.5), // P50 capacity: 50% exceedance (expected estimate)
    p10_Mt: percentile(caps, 0.9), // P10 capacity: 10% exceedance (optimistic/high estimate)
    p10_P: percentile(press, 0.1),  // P10 peak pressure (low pressure)
    p50_P: percentile(press, 0.5),  // P50 peak pressure (expected pressure)
    p90_P: percentile(press, 0.9),  // P90 peak pressure (high/conservative pressure bound)
    runTimeMs: performance.now() - t0,
  }
}
