import { co2DensitySpanWagner } from './density'

// Peng & Robinson (1976). Ind. Eng. Chem. Fundam. 15(1):59-64.
// Binary interaction parameters: Li & Yan (2009). J. Supercrit. Fluids 50(2):74-89.

const R_UNIV = 8.314462618

// ── Component critical constants ──────────────────────────────────────────────
interface PRComponent {
  Tc: number
  Pc: number
  omega: number
  M: number
}

const COMPONENTS: Record<string, PRComponent> = {
  CO2: { Tc: 304.13, Pc: 7.377e6, omega: 0.224, M: 0.04401 },
  CH4: { Tc: 190.56, Pc: 4.599e6, omega: 0.011, M: 0.01604 },
  N2:  { Tc: 126.19, Pc: 3.390e6, omega: 0.037, M: 0.02801 },
  H2S: { Tc: 373.53, Pc: 8.963e6, omega: 0.100, M: 0.03408 },
  SO2: { Tc: 430.75, Pc: 7.884e6, omega: 0.245, M: 0.06406 },
}

const COMPONENT_KEYS = Object.keys(COMPONENTS)

// ── Binary interaction parameters (k_ij = k_ji) ───────────────────────────────
function kBinary(a: string, b: string): number {
  if (a === b) return 0
  const key = [a, b].sort().join('-')
  const table: Record<string, number> = {
    'CH4-CO2': 0.092,
    'CO2-N2': -0.017,
    'CH4-N2': 0.031,
    'CO2-H2S': 0.098,
    'CO2-SO2': 0.030,
  }
  return table[key] ?? 0
}

// ── Gas composition interface ─────────────────────────────────────────────────
export interface GasComposition {
  xCO2: number
  xCH4?: number
  xN2?: number
  xH2S?: number
  xSO2?: number
}

function normalize(c: GasComposition): { keys: string[]; xs: number[] } {
  const raw: Record<string, number> = {
    CO2: Math.max(0, c.xCO2),
    CH4: Math.max(0, c.xCH4 ?? 0),
    N2: Math.max(0, c.xN2 ?? 0),
    H2S: Math.max(0, c.xH2S ?? 0),
    SO2: Math.max(0, c.xSO2 ?? 0),
  }
  const total = raw.CO2 + raw.CH4 + raw.N2 + raw.H2S + raw.SO2
  if (total <= 0) return { keys: ['CO2'], xs: [1] }
  const keys = COMPONENT_KEYS.filter(k => raw[k] > 0)
  return { keys, xs: keys.map(k => raw[k] / total) }
}

// ── PR EOS: a(T), b ──────────────────────────────────────────────────────────
function kappaPR(omega: number): number {
  return 0.37464 + 1.54226 * omega - 0.26992 * omega * omega
}

function pureA(T: number, comp: PRComponent): number {
  const k = kappaPR(comp.omega)
  const alpha = 1 + k * (1 - Math.sqrt(T / comp.Tc))
  return 0.4572355289 * R_UNIV * R_UNIV * comp.Tc * comp.Tc / comp.Pc * alpha * alpha
}

function pureB(comp: PRComponent): number {
  return 0.0777960739 * R_UNIV * comp.Tc / comp.Pc
}

// ── van der Waals mixing rules ────────────────────────────────────────────────
function mixA(T: number, keys: string[], xs: number[]): number {
  const n = keys.length
  let a = 0
  for (let i = 0; i < n; i++) {
    const ai = pureA(T, COMPONENTS[keys[i]])
    for (let j = 0; j < n; j++) {
      const aj = pureA(T, COMPONENTS[keys[j]])
      a += xs[i] * xs[j] * Math.sqrt(ai * aj) * (1 - kBinary(keys[i], keys[j]))
    }
  }
  return a
}

function mixB(keys: string[], xs: number[]): number {
  return keys.reduce((s, k, i) => s + xs[i] * pureB(COMPONENTS[k]), 0)
}

function mixM(keys: string[], xs: number[]): number {
  return keys.reduce((s, k, i) => s + xs[i] * COMPONENTS[k].M, 0)
}

// ── Analytical cubic Z-solver (Cardano) ───────────────────────────────────────
function cubicZ(A: number, B: number): number {
  const C2 = -(1 - B)
  const C1 = A - 2 * B - 3 * B * B
  const C0 = -(A * B - B * B - B * B * B)

  const p = C1 - C2 * C2 / 3
  const q = 2 * C2 * C2 * C2 / 27 - C2 * C1 / 3 + C0
  const disc = (q / 2) * (q / 2) + (p / 3) * (p / 3) * (p / 3)

  if (disc > 0) {
    const sd = Math.sqrt(disc)
    return Math.cbrt(-q / 2 + sd) + Math.cbrt(-q / 2 - sd) - C2 / 3
  }

  const r = Math.sqrt(-p / 3)
  const theta = Math.acos(-q / (2 * r * r * r))
  const o = -C2 / 3
  const z0 = 2 * r * Math.cos(theta / 3) + o
  const z1 = 2 * r * Math.cos((theta + 2 * Math.PI) / 3) + o
  const z2 = 2 * r * Math.cos((theta + 4 * Math.PI) / 3) + o
  return Math.max(z0, z1, z2)
}

// ── Public density function ───────────────────────────────────────────────────
export function co2DensityPengRobinson(
  T_K: number,
  P_Pa: number,
  composition: GasComposition,
): number {
  const T = Math.max(1, T_K)
  const P = Math.max(1, P_Pa)
  const { keys, xs } = normalize(composition)

  const aMix = mixA(T, keys, xs)
  const bMix = mixB(keys, xs)
  const mMix = mixM(keys, xs)

  const A = aMix * P / (R_UNIV * R_UNIV * T * T)
  const B = bMix * P / (R_UNIV * T)

  let Z: number
  try {
    Z = cubicZ(A, B)
  } catch {
    Z = 1
  }
  if (!Number.isFinite(Z) || Z <= 0) Z = 1

  const rho = P * mMix / (Z * R_UNIV * T)
  return Math.max(0.1, Math.min(1200, rho))
}

// ── Convenience wrapper for FormationParams-style inputs ──────────────────────
export function co2DensityWithImpurities(
  T_K: number,
  P_Pa: number,
  methaneFrac: number = 0,
  nitrogenFrac: number = 0,
): number {
  if (methaneFrac <= 0 && nitrogenFrac <= 0) {
    return co2DensitySpanWagner(T_K, P_Pa)
  }
  const xCH4 = Math.max(0, Math.min(1, methaneFrac))
  const xN2 = Math.max(0, Math.min(1, nitrogenFrac))
  const xCO2 = 1 - xCH4 - xN2
  if (xCO2 <= 0.01) {
    return co2DensitySpanWagner(T_K, P_Pa)
  }
  return co2DensityPengRobinson(T_K, P_Pa, { xCO2, xCH4, xN2 })
}
