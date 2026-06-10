import type { FormationParams, Well, PressureFieldPoint } from '../types'
import { wellRateAtTime } from './gridParser'

const EULER_MASCHERONI = 0.5772156649

export function expIntegralE1(x: number): number {
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

/**
 * Hantush (1955) leaky-aquifer well function W(u, β).
 * β = r / B  where  B = √(T · b' / K') is the leakance length (m).
 *   T   = k · h  (transmissivity, m²/s)
 *   b'  = aquitard thickness (m)
 *   K'  = aquitard hydraulic conductivity (m/s)
 *
 * When β = 0 (or B → ∞, no leakage), W(u, β) reduces to E1(u) (Theis).
 * W(u, β) ≤ E1(u): leakage always reduces the pressure buildup.
 *
 * Numerical evaluation via exponential-substitution quadrature:
 *   W = ∫_u^∞ (1/y) exp(−y − β²/4y) dy
 *   Substitution y = u·eˣ → W = ∫_0^∞ exp(−u·eˣ − β²·e^(−x)/4u) dx
 *
 * Reference: Hantush & Jacob (1955) Trans. AGU 36:95–100.
 */
export function hantushWellFunction(u: number, beta: number): number {
  if (u <= 0) return 1e10
  if (beta < 1e-6) return expIntegralE1(u)

  const beta2over4u = (beta * beta) / (4 * u)
  const dx = 0.05
  // Upper limit: integrand is negligible when u·eˣ >> 1 AND β²·e^(−x)/4u >> 0
  // Practical ceiling: x = max(30, ln(20/u)) to capture the full tail
  const xMax = Math.max(30, Math.log(20 / Math.max(u, 1e-12)) + 5)
  let sum = 0
  for (let x = dx * 0.5; x < xMax; x += dx) {
    const ex  = Math.exp(x)
    const emx = 1 / ex
    const arg = -u * ex - beta2over4u * emx
    if (arg < -700) break  // exp underflow — integrand effectively zero
    sum += Math.exp(arg) * dx
  }
  return sum
}

/**
 * Compute the dynamic Area of Review (AoR) radius (metres) via Theis or Hantush
 * pressure-threshold inversion.
 *
 * Finds the radius r at which the formation pressure buildup ΔP equals dPcrit_MPa
 * at the specified year (end of injection). Uses bisection on the well function.
 *
 * Regulatory basis: EPA Class VI and EU CCS Directive define the AoR as the
 * region where ΔP is high enough to displace brine upward into a USDW.
 * A standard threshold is ΔP = 1 psi ≈ 0.007 MPa (IEAGHG / UIC practice).
 *
 * @param params         Formation parameters (permeability, thickness, porosity, area)
 * @param wells          Array of injection wells with rates and ramp schedules
 * @param year           Simulation year at which to evaluate the pressure front
 * @param projectYears   Total project duration (for ramp schedule evaluation)
 * @param rhoCO2         CO₂ density at reservoir conditions (kg/m³)
 * @param muCO2          CO₂ viscosity at reservoir conditions (Pa·s)
 * @param dPcrit_MPa     Pressure threshold for AoR boundary (MPa); default 0.007 (1 psi)
 * @param leakanceRadius B = leakance length (m); 0 = confined Theis, > 0 = Hantush leaky
 * @returns              AoR radius in metres
 */
export function computeAoRRadius(
  params: FormationParams,
  wells: Well[],
  year: number,
  projectYears: number,
  rhoCO2: number,
  muCO2: number,
  dPcrit_MPa: number = 0.007,
  leakanceRadius: number = 0,
): number {
  const perm_m2 = params.permeability * 9.869e-16
  const h       = params.thickness
  const phi     = params.porosity
  const ct      = 1e-9  // total compressibility (Pa⁻¹) — standard saline aquifer value
  const t_sec   = Math.max(year, 1) * 365.25 * 24 * 3600
  const alpha   = perm_m2 / (phi * muCO2 * ct)   // hydraulic diffusivity (m²/s)

  // Sum volumetric rates (m³/s) from all active wells
  let totalQ_m3s = 0
  for (const w of wells) {
    const rate = wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears)
    if (rate > 0) {
      totalQ_m3s += rate * 1e9 / (rhoCO2 * 365.25 * 24 * 3600)
    }
  }
  if (totalQ_m3s <= 0) return 0

  // Pressure rise (MPa) at distance r_m from a single equivalent lumped well
  const dP_at_r = (r_m: number): number => {
    const r_eff = Math.max(r_m, 0.1)
    const u     = (r_eff * r_eff) / (4 * alpha * t_sec)
    const W     = leakanceRadius > 0
      ? hantushWellFunction(u, r_eff / leakanceRadius)
      : expIntegralE1(u)
    return (totalQ_m3s * muCO2) / (4 * Math.PI * perm_m2 * h) * W / 1e6
  }

  // If threshold is not exceeded even at the wellbore, return 0
  if (dP_at_r(0.1) < dPcrit_MPa) return 0

  // If pressure front has not decayed to threshold even at 300 km, cap at 300 km
  const CAP_M = 300_000
  if (dP_at_r(CAP_M) > dPcrit_MPa) return CAP_M

  // Bisection (ΔP is monotonically decreasing with r)
  let rLo = 0.1
  let rHi = CAP_M
  for (let iter = 0; iter < 64 && (rHi - rLo) > 5; iter++) {
    const rMid = (rLo + rHi) * 0.5
    if (dP_at_r(rMid) > dPcrit_MPa) {
      rLo = rMid
    } else {
      rHi = rMid
    }
  }
  return (rLo + rHi) * 0.5
}

/**
 * Two-phase CO₂/brine Area of Review radius using the Nordbotten et al. (2005)
 * composite transmissivity approach.
 *
 * References:
 *   Nordbotten, J.M., Celia, M.A., Bachu, S. (2005). "Injection and storage of CO₂
 *   in deep saline aquifers: analytical solution for CO₂ plume evolution during injection."
 *   Transport in Porous Media 58(3):339–360. DOI: 10.1007/s11242-004-0670-9
 *
 *   Nordbotten, J.M., Celia, M.A., Bachu, S., Dahle, H.K. (2005). "Semianalytical
 *   solution for CO₂ leakage through an abandoned well."
 *   Environ. Sci. Technol. 39(2):602–611.
 *
 * Physical improvement over single-phase Theis:
 * ─────────────────────────────────────────────
 *  1. Far field (r >> R_plume): the pressure signal propagates through undisturbed
 *     brine at brine hydraulic diffusivity α_b = k/(φ μ_b c_t). Using CO₂ viscosity
 *     here (as the single-phase Theis does) overestimates the diffusivity by ~10–30×
 *     and underestimates the AoR radius.
 *
 *  2. Near field (r ≤ R_plume): the CO₂ plume has lower mobility than brine
 *     (M = kr_CO2 × μ_brine / μ_CO2 ≈ 0.05–0.3 for typical CCS conditions), creating
 *     a higher-resistance inner zone that increases the injection-well pressure buildup.
 *     This is captured by the Nordbotten composite transmissivity correction:
 *
 *       ΔP(r) = Q/(4πkh) × {μ_brine × E1(r²/4α_b·t)            for r > R_plume
 *                           + (μ_eff − μ_brine) × E1(R_plume²/4α_b·t)}  for r ≤ R_plume
 *
 *     where μ_eff = μ_CO2 / kr_CO2_avg is the effective CO₂-zone viscosity.
 *
 * For AoR purposes (threshold crossing in the brine far field), this reduces to
 * the Theis formula with brine viscosity — which is more physically correct than
 * the CO₂-viscosity Theis used in computeAoRRadius.
 *
 * @param params          Formation parameters
 * @param wells           Injection wells with rates
 * @param year            Simulation year
 * @param projectYears    Total project duration
 * @param rhoCO2          CO₂ density at reservoir conditions (kg/m³)
 * @param muCO2           CO₂ dynamic viscosity at reservoir conditions (Pa·s)
 * @param muBrine         Brine dynamic viscosity (Pa·s). Default 6e-4 (80°C NaCl brine).
 * @param kr_CO2_avg      Average CO₂ relative permeability in plume (0–1). Default 0.3.
 * @param rPlume_m        CO₂ plume radius (m). Set to 0 to skip near-field correction.
 * @param dPcrit_MPa      AoR pressure threshold (MPa). Default 0.007 (1 psi).
 * @param leakanceRadius  Hantush leakance length B (m). 0 = confined Theis.
 * @returns               AoR radius in metres
 */
export function computeAoRRadiusTwoPhase(
  params: FormationParams,
  wells: Well[],
  year: number,
  projectYears: number,
  rhoCO2: number,
  muCO2: number,
  muBrine: number = 6e-4,
  kr_CO2_avg: number = 0.3,
  rPlume_m: number = 0,
  dPcrit_MPa: number = 0.007,
  leakanceRadius: number = 0,
): number {
  const perm_m2 = params.permeability * 9.869e-16
  const h       = params.thickness
  const phi     = params.porosity
  const ct      = 1e-9
  const t_sec   = Math.max(year, 1) * 365.25 * 24 * 3600

  // Far-field pressure propagates at brine hydraulic diffusivity (physically correct)
  const alpha_b = perm_m2 / (phi * muBrine * ct)

  let totalQ_m3s = 0
  for (const w of wells) {
    const rate = wellRateAtTime(w.injectionRate, year, w.rampUpYears, w.rampDownYears, projectYears)
    if (rate > 0) totalQ_m3s += rate * 1e9 / (rhoCO2 * 365.25 * 24 * 3600)
  }
  if (totalQ_m3s <= 0) return 0

  // Effective viscosity in the CO₂ plume zone (Nordbotten mobility ratio)
  const mu_eff = muCO2 / Math.max(0.01, kr_CO2_avg)

  // Nordbotten composite pressure at radius r_m
  const dP_at_r = (r_m: number): number => {
    const r_eff = Math.max(r_m, 0.1)
    const u_b   = (r_eff * r_eff) / (4 * alpha_b * t_sec)
    const W_b   = leakanceRadius > 0
      ? hantushWellFunction(u_b, r_eff / leakanceRadius)
      : expIntegralE1(u_b)

    // Outer-zone pressure (brine Theis — valid for all r)
    let dP = (totalQ_m3s * muBrine) / (4 * Math.PI * perm_m2 * h) * W_b / 1e6

    // Inner-zone correction: add mobility contrast term when inside CO₂ plume
    if (rPlume_m > 0 && r_eff <= rPlume_m) {
      const u_front  = (rPlume_m * rPlume_m) / (4 * alpha_b * t_sec)
      const W_front  = expIntegralE1(u_front)
      dP += (totalQ_m3s * (mu_eff - muBrine)) / (4 * Math.PI * perm_m2 * h) * W_front / 1e6
    }

    return dP
  }

  if (dP_at_r(0.1) < dPcrit_MPa) return 0
  const CAP_M = 300_000
  if (dP_at_r(CAP_M) > dPcrit_MPa) return CAP_M

  let rLo = 0.1, rHi = CAP_M
  for (let iter = 0; iter < 64 && (rHi - rLo) > 5; iter++) {
    const rMid = (rLo + rHi) * 0.5
    if (dP_at_r(rMid) > dPcrit_MPa) rLo = rMid
    else rHi = rMid
  }
  return (rLo + rHi) * 0.5
}

export function computePressureField(
  params: FormationParams,
  wells: Well[],
  year: number,
  projectYears: number,
  rhoCO2: number,
  muCO2: number,
  kvKhRatio: number = 1.0,
): PressureFieldPoint[] {
  const gridRes = 24
  const points: PressureFieldPoint[] = []
  const halfSpan = 1.5

  const perm_m2 = params.permeability * 9.869e-16
  // Scale vertical pressure diffusivity by kvKhRatio (kv = kh * kvKhRatio).
  // For the horizontal pressure field model, kvKhRatio < 1 reduces vertical
  // communication, effectively tightening the pressure buildup.
  // Default kvKhRatio = 1.0 preserves existing isotropic behavior.
  const perm_v_m2 = perm_m2 * kvKhRatio
  const perm_eff_m2 = Math.sqrt(perm_m2 * perm_v_m2)  // geometric mean for radial flow
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

        // Use effective permeability (geometric mean of kh and kv) for diffusivity
        const alpha = perm_eff_m2 / (phi * muCO2 * ct)
        const u = r_eff * r_eff / (4 * alpha * Math.max(t_sec, 1))
        const e1 = expIntegralE1(u)

        // Theis gives Pa → convert to MPa (basePressure is in MPa)
        const dP = (Q_m3s * muCO2) / (4 * Math.PI * perm_eff_m2 * h) * e1 / 1e6
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
