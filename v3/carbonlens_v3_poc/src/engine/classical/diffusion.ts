export function co2DiffusionCoefficient(T: number, P: number, porosity: number): number {
  // T in K, P in MPa, returns effective diffusivity in m²/s
  // Base free-CO₂-in-brine diffusivity ~2×10⁻⁹ m²/s (Duan & Sun 2003; Li & Nghiem 1986)
  // Scales with T/T_ref (Chapman-Enskog) and modest pressure suppression.
  // Pressure decay exponent clamped so that extreme overpressure does not reduce D to zero.
  const pressureDecay = Math.exp(-Math.min((P - 0.1) / 150, 10))  // floor at e⁻¹⁰ ≈ 4.5e-5
  const D0 = 2e-9 * (T / 298.15) * pressureDecay
  const tau = 1.5  // tortuosity factor for typical sandstone
  // Guard against zero porosity or any floating-point underflow
  const Deff = D0 * Math.max(porosity, 0) / tau
  return Math.max(Deff, 1e-12)  // physical floor: CO₂ diffusion in brine never truly zero
}
