export interface GridFileData {
  nx: number
  nz: number
  name: string
  deformations: number[][]
  porosities?: number[][]
  permeabilities?: number[][]
}

export function wellRateAtTime(rate: number, t: number, rampUp: number, rampDown: number, totalYears: number): number {
  if (t <= 0) return 0
  if (t < rampUp) return rate * t / rampUp
  if (t < totalYears - rampDown) return rate
  return rate * Math.max(0, (totalYears - t) / rampDown)
}

export function cumulativeInjection(rate: number, t: number, rampUp: number, rampDown: number, totalYears: number): number {
  if (t <= 0) return 0
  if (t <= rampUp) return 0.5 * rate * t * t / rampUp
  let cum = 0.5 * rate * rampUp
  if (t <= totalYears - rampDown) return cum + rate * (t - rampUp)
  cum += rate * (totalYears - rampDown - rampUp)
  const dt = t - (totalYears - rampDown)
  cum += rate * dt * (1 - dt / (2 * rampDown))
  return cum
}

export function parseCarbonGrid(text: string): GridFileData {
  const raw = JSON.parse(text)
  if (!raw.nx || !raw.nz || !raw.deformations) {
    throw new Error('Missing required fields: nx, nz, deformations')
  }
  if (raw.deformations.length !== raw.nz || raw.deformations[0].length !== raw.nx) {
    throw new Error(`Deformation array must be ${raw.nz}×${raw.nx}`)
  }
  return {
    nx: raw.nx,
    nz: raw.nz,
    name: raw.name || 'Custom Grid',
    deformations: raw.deformations,
    porosities: raw.porosities,
    permeabilities: raw.permeabilities,
  }
}

export function generateSampleGrid(): GridFileData {
  const nx = 40, nz = 40
  const deformations: number[][] = []
  for (let iz = 0; iz < nz; iz++) {
    deformations[iz] = []
    for (let ix = 0; ix < nx; ix++) {
      const x = (ix / nx) * 4 - 2
      const z = (iz / nz) * 4 - 2
      const meander = Math.sin(x * 3.2 + Math.sin(z * 2.7) * 0.8) * 0.6
      const ridge = Math.exp(-Math.pow(x + 0.8 + Math.sin(z * 1.5) * 0.5, 2) * 0.8) * 0.7
      const depression = -Math.exp(-Math.pow(x - 1.0 + Math.cos(z * 2.0) * 0.4, 2) * 1.2) * 0.5
      const pinch = Math.atan(z * 2.5) * 0.25 + 0.15
      const noise = Math.sin(x * 9.1 + z * 7.3) * 0.02 + Math.cos(x * 13.7 - z * 11.5) * 0.015 + Math.sin(x * 5.3 + z * 17.9) * 0.01
      const val = Math.max(0, (meander * 0.5 + ridge + depression + pinch + noise) * 0.7)
      deformations[iz][ix] = val
    }
  }
  return { nx, nz, name: 'Complex Winding Channel', deformations }
}
