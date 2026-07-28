export interface GridFileData {
  nx: number
  nz: number
  name: string
  deformations: number[][]
  porosities?: number[][]
  permeabilities?: number[][]
  /** Optional boundary polygon in normalised [-1, 1] XZ coords.
   *  When present, the formation smooth mesh is extruded from this polygon
   *  instead of the default rectangular box. Minimum 3 vertices.
   *  Example: [[-0.9, -0.7], [0.8, -0.8], [1.0, 0.3], [0.2, 0.9], [-0.8, 0.5]]
   */
  boundary_polygon?: [number, number][]
}

export function wellRateAtTime(rate: number, t: number, rampUp: number, rampDown: number, totalYears: number): number {
  if (t <= 0) return 0
  if (t < rampUp) return rate * t / rampUp
  if (t < totalYears - rampDown) return rate
  return rate * Math.max(0, (totalYears - t) / rampDown)
}

export function cumulativeInjection(rate: number, t: number, rampUp: number, rampDown: number, totalYears: number): number {
  // Clamp t to [0, totalYears] to prevent negative dt in ramp-down and post-injection drift.
  const t_eff = Math.min(Math.max(0, t), totalYears)
  if (t_eff <= 0) return 0
  if (t_eff <= rampUp) return 0.5 * rate * t_eff * t_eff / rampUp
  let cum = 0.5 * rate * rampUp
  const plateauEnd = totalYears - rampDown
  if (t_eff <= plateauEnd) return cum + rate * (t_eff - rampUp)
  // Guard against no-plateau case (rampUp + rampDown >= totalYears): plateau duration >= 0.
  cum += rate * Math.max(0, plateauEnd - rampUp)
  const dt = t_eff - plateauEnd
  cum += rate * dt * (1 - dt / (2 * rampDown))
  return Math.max(0, cum)
}

export function parseCarbonGrid(text: string): GridFileData {
  const raw = JSON.parse(text)
  if (!raw.nx || !raw.nz || !raw.deformations) {
    throw new Error('Missing required fields: nx, nz, deformations')
  }
  if (raw.deformations.length !== raw.nz || raw.deformations[0].length !== raw.nx) {
    throw new Error(`Deformation array must be ${raw.nz}×${raw.nx}`)
  }
  // Validate boundary_polygon if present
  let boundary_polygon: [number, number][] | undefined
  if (raw.boundary_polygon != null) {
    if (
      !Array.isArray(raw.boundary_polygon) ||
      raw.boundary_polygon.length < 3 ||
      !raw.boundary_polygon.every(
        (pt: unknown) => Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number'
      )
    ) {
      throw new Error('boundary_polygon must be an array of at least 3 [x, z] pairs')
    }
    boundary_polygon = raw.boundary_polygon.map((pt: [number, number]) => [
      Math.max(-1, Math.min(1, pt[0])),
      Math.max(-1, Math.min(1, pt[1])),
    ] as [number, number])
  }

  return {
    nx: raw.nx,
    nz: raw.nz,
    name: raw.name || 'Custom Grid',
    deformations: raw.deformations,
    porosities: raw.porosities,
    permeabilities: raw.permeabilities,
    boundary_polygon,
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
  // Non-rectangular boundary: kidney / elongated anticline shape (7 vertices, normalised -1..1)
  const boundary_polygon: [number, number][] = [
    [-0.85, -0.60],
    [ 0.10, -0.90],
    [ 0.90, -0.50],
    [ 0.95,  0.25],
    [ 0.40,  0.88],
    [-0.40,  0.85],
    [-0.90,  0.20],
  ]
  return { nx, nz, name: 'Complex Winding Channel', deformations, boundary_polygon }
}
