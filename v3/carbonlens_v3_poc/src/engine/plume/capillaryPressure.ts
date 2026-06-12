import { LithologyType } from '../../types/geological'

export interface CapillaryParams {
  entryPressure: number  // MPa — Pc at Sw=1 (capillary entry pressure)
  lambda: number         // — pore size distribution index (Brooks-Corey, 0.5–5)
  residualWater: number  // — irreducible water saturation (0–0.4)
}

const LAMBDA_BY_LITHOLOGY: Partial<Record<LithologyType, number>> = {
  sandstone: 2.5,
  arkosic_sandstone: 2.0,
  limestone: 1.5,
  dolomite: 1.2,
  chalk: 0.8,
  siltstone: 1.0,
  shale: 3.0,
  anhydrite: 4.0,
}

const DEFAULT_LAMBDA = 2.0
const DEFAULT_SWR = 0.20
const PC_MAX_MULTIPLIER = 10

export function getCapillaryLambda(lithology: LithologyType): number {
  return LAMBDA_BY_LITHOLOGY[lithology] ?? DEFAULT_LAMBDA
}

export function makeCapillaryParams(
  entryPressure: number,
  lithology: LithologyType,
): CapillaryParams {
  return {
    entryPressure: Math.max(0.001, entryPressure),
    lambda: getCapillaryLambda(lithology),
    residualWater: DEFAULT_SWR,
  }
}

export function pcDrainage(Sw: number, params: CapillaryParams): number {
  if (Sw >= 1) return params.entryPressure
  if (Sw <= params.residualWater) return params.entryPressure * PC_MAX_MULTIPLIER
  const Sw_e = (Sw - params.residualWater) / (1 - params.residualWater)
  return Math.min(
    params.entryPressure * PC_MAX_MULTIPLIER,
    params.entryPressure * Math.pow(Sw_e, -1 / params.lambda),
  )
}

export function pcImbibition(
  Sw: number,
  params: CapillaryParams,
  Sg_max: number,
): number {
  const Sw_eff = Math.min(1, Sw + Sg_max * 0.15)
  return pcDrainage(Sw_eff, params)
}

export function capillaryFlux(
  k_m2: number,
  kr: number,
  mu: number,
  Pc_here: number,
  Pc_there: number,
  dx: number,
): number {
  const dPc_Pa = (Pc_there - Pc_here) * 1e6
  const v = (k_m2 * kr) / mu * dPc_Pa / dx
  if (!isFinite(v) || isNaN(v)) return 0
  return v
}
