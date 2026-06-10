import { BrooksCoreyParams, DEFAULT_BC_PARAMS, krGas } from './relativePermeability'

export interface KilloughParams {
  /** Land trapping coefficient C = 1/Sgr - 1/Sgr_max (typical: 3-20) */
  C: number
  /** Maximum possible trapped gas saturation (0.3-0.5) */
  Sgr_max: number
}

export const DEFAULT_KILLOUGH: KilloughParams = {
  C: 5.0,
  Sgr_max: 0.40,
}

function makeKilloughParams(p: BrooksCoreyParams): KilloughParams {
  return { C: 1 / p.Sgr - 1 / DEFAULT_KILLOUGH.Sgr_max, Sgr_max: DEFAULT_KILLOUGH.Sgr_max }
}

export function krGasHysteretic(
  Sg: number,
  Sg_max_hist: number,
  p: BrooksCoreyParams = DEFAULT_BC_PARAMS,
  kp: KilloughParams = makeKilloughParams(p),
): number {
  if (Sg <= 0) return 0
  if (Sg_max_hist <= p.Sgr) return krGas(Sg, p)

  const Sgr_eff = p.Sgr + (Sg_max_hist - p.Sgr) / (1 + kp.C * (Sg_max_hist - p.Sgr))
  const Se_max = (Sg_max_hist - p.Sgr) / (1 - p.Swi - p.Sgr)

  if (Sg >= Sg_max_hist) {
    return krGas(Sg, p)
  }

  const Se_imb = (Sg - Sgr_eff) / (1 - p.Swi - Sgr_eff)
  if (Se_imb <= 0) return 0
  const kr_at_max = krGas(Sg_max_hist, p)
  return kr_at_max * (Se_imb / Math.max(0.001, Se_max)) ** p.n_gas
}
