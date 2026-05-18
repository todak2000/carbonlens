const R = 8.314462618
const M_CO2 = 0.04401

export function co2DensitySpanWagner(T: number, P: number): number {
  const Tc = 304.13
  const Pc = 7.377e6
  const Tr = T / Tc
  const Pr = P / Pc

  if (Tr > 3 || Pr > 8) return Math.max(0.1, P * M_CO2 / (R * T))

  let rho = P * M_CO2 / (R * T)
  let prev = 0
  for (let i = 0; i < 100; i++) {
    const Z = P / (rho * R * T / M_CO2)
    if (Z < 0.01) break
    const rho_new = P * M_CO2 / (Z * R * T)
    const diff = rho_new - rho
    rho += diff * 0.8
    if (Math.abs(diff) < 0.001 || Math.abs(rho - prev) < 0.0001) break
    prev = rho
  }

  return Math.max(0.1, Math.min(1200, rho))
}

export function brineDensityGarcia(T: number, P: number, salinity: number): number {
  const T_c = T - 273.15
  const rho_pure = 999.842594 + 6.793952e-2 * T_c - 9.09529e-3 * T_c ** 2
    + 1.001685e-4 * T_c ** 3 - 1.120083e-6 * T_c ** 4 + 6.536332e-9 * T_c ** 5

  const A = 8.044e-1 - 4.886e-3 * T_c + 5.234e-5 * T_c ** 2 - 3.147e-7 * T_c ** 3 + 7.945e-10 * T_c ** 4
  const B = -5.819e-4 + 1.665e-5 * T_c - 1.156e-6 * T_c ** 2 + 6.659e-9 * T_c ** 3 - 1.403e-11 * T_c ** 4
  const C = 4.929e-6 - 6.529e-8 * T_c + 1.758e-9 * T_c ** 2 - 1.386e-11 * T_c ** 3 + 3.242e-14 * T_c ** 4

  const S = salinity * 58.44
  return rho_pure + A * S + B * S ** 1.5 + C * S ** 2
}
