export function co2SolubilityDuanSun(T: number, P: number, salinity: number): number {
  const T_c = T - 273.15
  const lambda = 0.1 + 0.02 * salinity
  const lnK = -8.55445 + 2.18525e-2 * T_c - 4.87431e-4 * T_c ** 2
    + 5.72831e-6 * T_c ** 3 - 2.24521e-8 * T_c ** 4
    + Math.log(P) * (0.54171 - 2.76553e-3 * T_c + 6.16886e-6 * T_c ** 2)
  const xCO2 = Math.exp(lnK) * (1 - lambda)
  return Math.max(xCO2, 0)
}
