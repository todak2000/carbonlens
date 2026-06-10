const R = 8.314462618
const M_CO2 = 0.04401

/**
 * CO2 density via Peng-Robinson EOS.
 * CO2 critical constants: Tc=304.13 K, Pc=7.377 MPa, ω=0.2239
 * Returns density in kg/m³.
 */
export function co2DensitySpanWagner(T: number, P: number): number {
  const Tc = 304.13
  const Pc = 7.377e6
  const omega = 0.2239

  const Tr = T / Tc

  // Peng-Robinson EOS parameters
  const kappa = 0.37464 + 1.54226 * omega - 0.26992 * omega * omega
  const alpha = Math.pow(1 + kappa * (1 - Math.sqrt(Tr)), 2)
  const a = 0.45724 * R * R * Tc * Tc / Pc * alpha
  const b = 0.07780 * R * Tc / Pc

  const A = a * P / (R * R * T * T)
  const B = b * P / (R * T)

  // Cubic PR EOS: Z³ - (1-B)Z² + (A-3B²-2B)Z - (AB-B²-B³) = 0
  const c2 = -(1 - B)
  const c1 = A - 3 * B * B - 2 * B
  const c0 = -(A * B - B * B - B * B * B)

  // Newton-Raphson from Z=1 to find the largest real root (vapour/supercritical)
  let Z = 1.0
  for (let i = 0; i < 100; i++) {
    const f = Z * Z * Z + c2 * Z * Z + c1 * Z + c0
    const df = 3 * Z * Z + 2 * c2 * Z + c1
    if (Math.abs(df) < 1e-15) break
    const dZ = f / df
    Z -= dZ
    if (Math.abs(dZ) < 1e-10) break
  }

  // Guard against non-physical roots
  if (Z < B + 1e-6) Z = B + 1e-6

  const rho = P * M_CO2 / (Z * R * T)
  return Math.max(0.1, Math.min(1200, rho))
}

export function brineDensityGarcia(T: number, P: number, monoSalinity: number, biSalinity: number = 0): number {
  const T_c = Math.max(0, Math.min(200, T - 273.15))

  // Bigg (1967) polynomial for pure water density at atmospheric pressure (kg/m³), valid 0–40°C
  // Extrapolated carefully to 200°C for reservoir conditions
  const rho_atm = 999.842594 + 6.793952e-2 * T_c - 9.09529e-3 * T_c ** 2
    + 1.001685e-4 * T_c ** 3 - 1.120083e-6 * T_c ** 4 + 6.536332e-9 * T_c ** 5

  // Pressure correction — isothermal compressibility of water (Kell 1975)
  // κ_T(T) ≈ [1 / (2179 + 10.9·T_c)] MPa⁻¹  (valid to ~200°C, 50 MPa)
  // Δρ = ρ_atm · κ_T · (P - P_ref) where P_ref = 0.1 MPa
  const P_MPa = Math.max(0.1, P)  // P is already in MPa
  const kappa_T = 1.0 / (2179 + 10.9 * T_c)  // MPa⁻¹
  const rho_pure = rho_atm * (1 + kappa_T * (P_MPa - 0.1))

  // Garcia (1982) salinity correction (mol/kg → g/kg via molar mass)
  const A = 8.044e-1 - 4.886e-3 * T_c + 5.234e-5 * T_c ** 2 - 3.147e-7 * T_c ** 3 + 7.945e-10 * T_c ** 4
  const B = -5.819e-4 + 1.665e-5 * T_c - 1.156e-6 * T_c ** 2 + 6.659e-9 * T_c ** 3 - 1.403e-11 * T_c ** 4
  const C = 4.929e-6 - 6.529e-8 * T_c + 1.758e-9 * T_c ** 2 - 1.386e-11 * T_c ** 3 + 3.242e-14 * T_c ** 4

  const S = monoSalinity * 58.44 + biSalinity * 110.98
  return Math.max(800, Math.min(1300, rho_pure + A * S + B * S ** 1.5 + C * S ** 2))
}
