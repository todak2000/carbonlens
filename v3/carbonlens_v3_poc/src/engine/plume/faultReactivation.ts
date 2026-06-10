/**
 * Fault Reactivation Risk — Mohr-Coulomb Slip Tendency Analysis
 *
 * Evaluates whether pore pressure increase from CO2 injection can reactivate
 * pre-existing faults. Based on Morris et al. (1996) slip tendency concept and
 * Wiprut & Zoback (2000) "Fault reactivation and fluid flow along a previously
 * dormant normal fault in the northern North Sea".
 *
 * References:
 *  - Morris et al. (1996) "Variation of mechanical and fluid-flow properties of
 *    faults in shale-sand sequences: examples from the Rio Grande rift"
 *  - Mildren et al. (2002) FAST method for fault seal analysis
 *  - Streit & Hillis (2004) "Estimating fault stability and sustainable fluid
 *    pressures for underground storage of CO2 in porous rock"
 *    DOI: 10.1016/j.energy.2003.10.003
 */

export interface FaultGeometry {
  strike_deg: number   // fault strike (°N, 0–360)
  dip_deg: number      // fault dip from horizontal (°, 0–90)
  dipDirection_deg: number  // dip azimuth (°, 0–360)
}

export interface StressState {
  depth_m: number           // depth to fault (m)
  rockDensity_kgm3: number  // overburden rock density (kg/m³), typ 2300–2600
  Sh_SvRatio: number        // min horizontal / vertical stress ratio (K0), typ 0.5–0.8
  SH_ShRatio: number        // max / min horizontal stress ratio, 1.0 (isotropic) – 1.5
  SH_azimuth_deg: number    // maximum horizontal stress orientation (°N)
  initialPorePressure_MPa: number  // initial Pp before injection
  biotCoefficient: number   // Biot-Willis coefficient (0.6–1.0)
}

export interface FaultRockProperties {
  frictionCoeff: number     // μ = tan(φ), typical 0.5–0.85 (Byerlee's law)
  cohesion_MPa: number      // c, residual cohesion (0–5 MPa, usually 0 for reactivation)
}

export interface FaultReactivationResult {
  normalStress_MPa: number      // effective normal stress on fault plane (MPa)
  shearStress_MPa: number       // shear stress on fault plane (MPa)
  slipTendency: number          // Ts = τ/σn (0=stable, 1=at failure)
  criticalPressureIncrease_MPa: number  // ΔP before reactivation (MPa)
  reactivationRisk: 'low' | 'moderate' | 'high' | 'critical'
  failureMode: 'slip' | 'dilation' | 'stable'
  mohrCoulombRatio: number      // (τ - τ_failure) / τ_failure — negative = stable
}

const G_ACCEL = 9.81  // m/s²

/**
 * Compute principal stresses from depth and stress ratios.
 * Assumes normal faulting regime (Sv > SH > Sh) as default for sedimentary basins.
 */
function principalStresses(state: StressState): { Sv: number; SH: number; Sh: number } {
  const Sv = state.rockDensity_kgm3 * G_ACCEL * state.depth_m * 1e-6  // MPa
  const Sh = state.Sh_SvRatio * Sv
  const SH = state.SH_ShRatio * Sh
  return { Sv, SH, Sh }
}

/**
 * Rotate the in-situ stress tensor to find normal and shear stresses on a fault plane.
 *
 * Uses 3D rotation: given fault normal vector n̂, the traction vector T = S·n̂,
 * then σn = T·n̂ and τ = |T - σn·n̂|.
 *
 * Coordinate system: x=East, y=North, z=Up (positive upward)
 * Fault normal points in the up-dip direction.
 */
function stressOnFaultPlane(
  fault: FaultGeometry,
  Sv_MPa: number,
  SH_MPa: number,
  Sh_MPa: number,
  SH_azimuth_deg: number,
): { sigma_n: number; tau: number } {
  // Convert angles to radians
  const dip = (fault.dip_deg * Math.PI) / 180
  const dipDir = (fault.dipDirection_deg * Math.PI) / 180
  const SH_az = (SH_azimuth_deg * Math.PI) / 180

  // Fault normal vector (in geographic coords x=E, y=N, z=Up)
  // For a fault with dip δ and dip direction θ:
  // Fault normal is perpendicular to fault plane, pointing upward:
  // n = (-cos(δ)·sin(θ), -cos(δ)·cos(θ), sin(δ))
  const nx = -Math.cos(dip) * Math.sin(dipDir)
  const ny = -Math.cos(dip) * Math.cos(dipDir)
  const nz =  Math.sin(dip)

  // Stress tensor in geographic coords (SH along azimuth, Sh perpendicular, Sv vertical)
  // Stress tensor S in matrix form (compression positive):
  // Diagonal in principal axes: [SH, Sh, Sv] rotated to geographic frame
  const SH_angle = SH_az  // SH orientation (azimuth of SH direction)
  const cos_a = Math.cos(SH_angle)
  const sin_a = Math.sin(SH_angle)

  // In geographic frame (E=x, N=y, z=Up), Sv acts on z, SH/Sh in horizontal plane
  // Sxx = SH·cos²α + Sh·sin²α
  // Syy = SH·sin²α + Sh·cos²α
  // Szz = Sv
  // Sxy = (SH-Sh)·sinα·cosα
  // Sxz = Syz = 0
  const Sxx = SH_MPa * cos_a * cos_a + Sh_MPa * sin_a * sin_a
  const Syy = SH_MPa * sin_a * sin_a + Sh_MPa * cos_a * cos_a
  const Szz = Sv_MPa
  const Sxy = (SH_MPa - Sh_MPa) * sin_a * cos_a
  // Sxz = Syz = 0 (no shear coupling to vertical in the assumed principal-stress frame)

  // Traction vector T = S · n
  const Tx = Sxx * nx + Sxy * ny  // + Sxz*nz = 0
  const Ty = Sxy * nx + Syy * ny  // + Syz*nz = 0
  const Tz = Szz * nz             // only vertical on z component

  // Normal stress σn = T · n
  const sigma_n = Tx * nx + Ty * ny + Tz * nz

  // Shear stress τ = |T - σn·n|
  const Tsx = Tx - sigma_n * nx
  const Tsy = Ty - sigma_n * ny
  const Tsz = Tz - sigma_n * nz
  const tau = Math.sqrt(Tsx * Tsx + Tsy * Tsy + Tsz * Tsz)

  return { sigma_n: Math.max(0, sigma_n), tau: Math.max(0, tau) }
}

/**
 * Assess fault reactivation risk for a CO2 storage project.
 *
 * @param fault   fault geometry (strike, dip, dip direction)
 * @param stress  in-situ stress state at fault depth
 * @param rock    fault rock friction properties
 * @param currentPorePressure_MPa  current Pp including injection pressure increase
 */
export function assessFaultReactivation(
  fault: FaultGeometry,
  stress: StressState,
  rock: FaultRockProperties,
  currentPorePressure_MPa: number,
): FaultReactivationResult {
  const { Sv, SH, Sh } = principalStresses(stress)
  const { sigma_n: sigma_n_total, tau } = stressOnFaultPlane(fault, Sv, SH, Sh, stress.SH_azimuth_deg)

  // Effective normal stress (Terzaghi/Biot effective stress)
  const alpha = stress.biotCoefficient
  const Pp = currentPorePressure_MPa
  const sigma_n_eff = sigma_n_total - alpha * Pp
  const sigma_n_eff_clamped = Math.max(0.01, sigma_n_eff)

  // Mohr-Coulomb failure stress
  const tau_failure = rock.cohesion_MPa + rock.frictionCoeff * sigma_n_eff_clamped

  // Slip tendency (normalized): 1.0 = at failure
  const slipTendency = tau / tau_failure

  // Critical pore pressure increase before reactivation
  // At failure: τ = c + μ(σn_total - α·Pp_crit)
  // Pp_crit = (σn_total - (τ - c)/μ) / α
  // ΔP_crit = Pp_crit - Pp_current
  const numerator = (sigma_n_total - (tau - rock.cohesion_MPa) / rock.frictionCoeff)
  const Pp_crit = rock.frictionCoeff > 0 ? numerator / alpha : Infinity
  const deltaP_crit = Math.max(0, Pp_crit - Pp)

  // Mohr-Coulomb ratio: negative = stable, 0 = at failure, positive = failed
  const mcRatio = (tau - tau_failure) / Math.max(0.01, tau_failure)

  // Risk classification
  let risk: FaultReactivationResult['reactivationRisk']
  if (deltaP_crit > 10) risk = 'low'
  else if (deltaP_crit > 5) risk = 'moderate'
  else if (deltaP_crit > 1) risk = 'high'
  else risk = 'critical'

  // Failure mode
  let failureMode: FaultReactivationResult['failureMode']
  if (slipTendency >= 1) failureMode = 'slip'
  else if (slipTendency > 0.8) failureMode = 'dilation'
  else failureMode = 'stable'

  return {
    normalStress_MPa: sigma_n_eff_clamped,
    shearStress_MPa: tau,
    slipTendency,
    criticalPressureIncrease_MPa: deltaP_crit,
    reactivationRisk: risk,
    failureMode,
    mohrCoulombRatio: mcRatio,
  }
}

/**
 * Byerlee's law friction coefficients for common fault rock types.
 * Byerlee (1978): μ = 0.85 for σn < 200 MPa, μ = 0.6 for σn > 200 MPa.
 */
export function byerleeFriction(sigma_n_MPa: number): number {
  return sigma_n_MPa < 200 ? 0.85 : 0.6
}

/**
 * Assess multiple fault orientations and return the most critical.
 */
export function mostCriticalFault(
  faults: FaultGeometry[],
  stress: StressState,
  rock: FaultRockProperties,
  currentPorePressure_MPa: number,
): { fault: FaultGeometry; result: FaultReactivationResult } | null {
  if (faults.length === 0) return null
  let worst: { fault: FaultGeometry; result: FaultReactivationResult } | null = null
  for (const fault of faults) {
    const result = assessFaultReactivation(fault, stress, rock, currentPorePressure_MPa)
    if (!worst || result.criticalPressureIncrease_MPa < worst.result.criticalPressureIncrease_MPa) {
      worst = { fault, result }
    }
  }
  return worst
}
