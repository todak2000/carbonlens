export function co2ViscosityFenghour(T: number, rho: number): number {
  const T_c = T - 273.15
  const a0 = -1.59244e-2
  const a1 = 4.97378e-1
  const a2 = -9.15132e-1
  const a3 = 6.18998e-1
  const a4 = -1.07583e-1
  const t = T_c / 100
  const eta0 = a0 + a1 * t + a2 * t ** 2 + a3 * t ** 3 + a4 * t ** 4

  const d1 = 1.02727e-1
  const d2 = 1.49134e-1
  const d3 = 1.78622e-1
  const d4 = -1.38401e-1
  const d5 = 3.23969e-1
  const dr = rho / 467.6
  const eta1 = d1 * dr + d2 * dr ** 2 + d3 * dr ** 3 + d4 * dr ** 4 + d5 * dr ** 5

  return eta0 + eta1
}
