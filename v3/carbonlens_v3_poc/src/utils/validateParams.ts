import { FormationParams, Well } from '../types'

const RANGES: Partial<Record<keyof FormationParams, [number, number]>> = {
  depth: [100, 6000],
  thickness: [1, 1000],
  porosity: [0.001, 0.55],
  permeability: [0.001, 10000],
  pressure: [0.6, 100],
  temperature: [-50, 200],
  monovalentSalinity: [0, 6],
  bivalentSalinity: [0, 6],
  methaneFraction: [0, 1],
  nitrogenFraction: [0, 1],
  area: [0.1, 1000],
  netToGross: [0, 1],
  caprockFriction: [0, 90],
  caprockCohesion: [0, 100],
  biotCoefficient: [0, 1],
}

export function sanitizeFormationParams(p: FormationParams): FormationParams {
  const out = { ...p }
  for (const [key, [min, max]] of Object.entries(RANGES)) {
    const k = key as keyof FormationParams
    const v = out[k]
    if (typeof v === 'number') {
      ;(out as unknown as Record<string, number>)[k] = Math.max(min, Math.min(max, v))
    }
  }
  out.methaneFraction = Math.min(out.methaneFraction, 1 - out.nitrogenFraction)
  out.nitrogenFraction = Math.min(out.nitrogenFraction, 1 - out.methaneFraction)
  return out
}

export function sanitizeWellPosition(x: number, z: number): { x: number; z: number } {
  return { x: Math.max(-1, Math.min(1, x)), z: Math.max(-1, Math.min(1, z)) }
}

export function sanitizeWellRate(rate: number): number {
  return Math.max(0.001, rate)
}

export function sanitizeWellSchedule(rampUp: number, rampDown: number, projectYears: number) {
  const maxRamp = Math.floor(projectYears / 3)
  return {
    rampUp: Math.max(1, Math.min(maxRamp, rampUp)),
    rampDown: Math.max(1, Math.min(maxRamp, rampDown)),
  }
}

export function sanitizePorosity(v: number): number {
  return Math.max(0.001, Math.min(0.55, v))
}

export function sanitizePermeability(v: number): number {
  return Math.max(1e-6, v)
}

const ZONE_NUMERIC_RANGES: Record<string, [number, number]> = {
  topDepth: [0, 10000],
  thickness: [0.1, 5000],
  netToGross: [0, 1],
  porosityMean: [0.001, 0.55],
  porosityStdDev: [0, 0.5],
  kHorizontal: [0.001, 50000],
  kVerticalRatio: [0, 1],
  capillaryEntryPressure: [0, 100],
}

export function sanitizeZoneChanges(changes: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(changes)) {
    const range = ZONE_NUMERIC_RANGES[key]
    if (range && typeof value === 'number') {
      out[key] = Math.max(range[0], Math.min(range[1], value))
    } else {
      out[key] = value
    }
  }
  return out
}

const FAULT_NUMERIC_RANGES: Record<string, [number, number]> = {
  positionX: [-1, 1],
  positionY: [-1, 1],
  strike: [0, 360],
  dip: [0, 90],
  throw: [0, 5000],
  length: [1, 50000],
  sealingFactor: [0, 1],
  claySmearFactor: [0, 1],
  faultZoneThickness: [0.01, 100],
}

export function sanitizeFaultChanges(changes: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(changes)) {
    const range = FAULT_NUMERIC_RANGES[key]
    if (range && typeof value === 'number') {
      out[key] = Math.max(range[0], Math.min(range[1], value))
    } else {
      out[key] = value
    }
  }
  return out
}
