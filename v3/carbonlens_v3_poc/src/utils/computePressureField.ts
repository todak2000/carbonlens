import type { FormationParams, Well, PressureFieldPoint } from '../types'
import { wellRateAtTime } from './gridParser'

const EULER_MASCHERONI = 0.5772156649

function expIntegralE1(x: number): number {
  if (x <= 0) return 1e10
  if (x <= 1) {
    return -EULER_MASCHERONI - Math.log(x)
      + x - x * x / 4 + x * x * x / 18
      - x * x * x * x / 96 + x * x * x * x * x / 600
  }
  const a1 = 2.334733, a2 = 0.250621
  const b1 = 3.330657, b2 = 1.681534
  const num = x * x + a1 * x + a2
  const den = x * x + b1 * x + b2
  return Math.exp(-x) * num / den
}

export function computePressureField(
  params: FormationParams,
  wells: Well[],
  year: number,
  projectYears: number,
  rhoCO2: number,
  muCO2: number,
): PressureFieldPoint[] {
  const gridRes = 24
  const points: PressureFieldPoint[] = []
  const halfSpan = 1.5

  const perm_m2 = params.permeability * 9.869e-16
  const h = params.thickness
  const phi = params.porosity
  const ct = 1e-9
  const t_sec = year * 365.25 * 24 * 3600
  const modelScale = Math.sqrt(params.area * 1e6) / 3

  const basePressure = params.pressure

  for (let iz = 0; iz < gridRes; iz++) {
    for (let ix = 0; ix < gridRes; ix++) {
      const mx = -halfSpan + (ix / (gridRes - 1)) * (2 * halfSpan)
      const mz = -halfSpan + (iz / (gridRes - 1)) * (2 * halfSpan)

      let dP_total = 0
      for (const w of wells) {
        const currentRate = wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears)
        if (currentRate <= 0) continue

        const Q_m3s = currentRate * 1e9 / (rhoCO2 * 365.25 * 24 * 3600)
        const dist_m = Math.sqrt((mx - w.x) ** 2 + (mz - w.z) ** 2) * modelScale
        const rw_m = 0.1
        const r_eff = Math.max(dist_m, rw_m)

        const alpha = perm_m2 / (phi * muCO2 * ct)
        const u = r_eff * r_eff / (4 * alpha * Math.max(t_sec, 1))
        const e1 = expIntegralE1(u)

        const dP = (Q_m3s * muCO2) / (4 * Math.PI * perm_m2 * h) * e1
        dP_total += dP
      }

      const minDP = 0
      const maxDP = 20
      const clampedDP = Math.max(minDP, Math.min(maxDP, dP_total))
      points.push({
        x: mx,
        z: mz,
        pressure: basePressure + clampedDP,
      })
    }
  }
  return points
}
