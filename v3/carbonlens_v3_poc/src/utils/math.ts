export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function degToK(degC: number): number {
  return degC + 273.15
}

export function kToDeg(k: number): number {
  return k - 273.15
}

export function mpaToPsi(mpa: number): number {
  return mpa * 145.038
}

export function psiToMpa(psi: number): number {
  return psi / 145.038
}

export function mToFt(m: number): number {
  return m * 3.28084
}

export function ftToM(ft: number): number {
  return ft / 3.28084
}

export function km2ToM2(km2: number): number {
  return km2 * 1e6
}

export function kgToTonne(kg: number): number {
  return kg / 1000
}

export function tonnesToGt(tonnes: number): number {
  return tonnes / 1e9
}

export function linearInterp(x: number, x0: number, y0: number, x1: number, y1: number): number {
  return y0 + (x - x0) * (y1 - y0) / (x1 - x0)
}
