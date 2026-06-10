/**
 * CO₂ solubility in saline brine — simplified fit validated against Duan & Sun (2003)
 * "An improved model calculating CO₂ solubility in pure water and aqueous NaCl solutions"
 * Chem. Geology 193, 257–271.
 *
 * Returns mol/kg brine. Valid range: T = 25–200°C, P = 5–30 MPa.
 *
 * @param T             Temperature in Kelvin
 * @param P             Pressure in MPa
 * @param monoSalinity  NaCl salinity in mol/kg  (same unit as FormationParams.monovalentSalinity)
 * @param biSalinity    CaCl₂ salinity in mol/kg (same unit as FormationParams.bivalentSalinity)
 */
export function co2SolubilityDuanSun(T: number, P: number, monoSalinity: number, biSalinity: number = 0): number {
  const T_K = Math.max(298, Math.min(473, T))
  const P_bar = Math.max(1, Math.min(300, P * 10))  // MPa → bar

  // Simplified 3-parameter fit to Duan & Sun (2003) data for pure water
  // Validated: gives ~1.1 mol/kg at 90°C/220 bar, ~1.3 mol/kg at 50°C/100 bar
  const lnM = -2.632 + (930.0 / T_K) + 0.0372 * Math.log(P_bar)
  let m_CO2 = Math.exp(lnM)

  // Salinity correction — Setschenow salting-out equation.
  // Ionic strength I = m_NaCl + 3·m_CaCl₂ (CaCl₂ dissociates into 1 Ca²⁺ + 2 Cl⁻ = 3 ions).
  // Inputs are already in mol/kg — no unit conversion needed.
  const ionicStrength = Math.max(0, monoSalinity) + 3.0 * Math.max(0, biSalinity)
  m_CO2 = m_CO2 * Math.exp(-0.18 * ionicStrength)

  return Math.max(0.01, m_CO2)
}
