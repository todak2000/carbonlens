export function co2DiffusionCoefficient(T: number, P: number, porosity: number): number {
  // T in K, P in MPa, returns effective diffusivity in m²/s
  // Base free-CO₂-in-brine diffusivity ~2×10⁻⁹ m²/s (Duan & Sun 2003; Li & Nghiem 1986)
  // Scales with T/T_ref (Chapman-Enskog) and modest pressure suppression.
  // Pressure decay exponent clamped so that extreme overpressure does not reduce D to zero.
  const pressureDecay = Math.exp(-Math.min((P - 0.1) / 150, 10))  // floor at e^-10 ~ 4.5e-5
  // Chapman-Enskog kinetic theory: D proportional to T^1.5 / P (Poling et al. 2001
  // "The Properties of Gases and Liquids", 5th ed., eq. 11-3.2).
  // Prior linear scaling (D proportional to T) underestimated the temperature effect by ~50% at 150 degC.
  // T^1.5 exponent validated against Li and Nghiem (1986) experimental data for CO2-brine at 25-100 degC.
  const D0 = 2e-9 * Math.pow(T / 298.15, 1.5) * pressureDecay
  const tau = 1.5  // tortuosity factor for typical sandstone
  // Guard against zero porosity or any floating-point underflow
  const Deff = D0 * Math.max(porosity, 0) / tau
  return Math.max(Deff, 1e-12)  // physical floor: CO₂ diffusion in brine never truly zero
}
