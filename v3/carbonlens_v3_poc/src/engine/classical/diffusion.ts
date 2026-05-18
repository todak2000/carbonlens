export function co2DiffusionCoefficient(T: number, P: number, porosity: number): number {
  const D0 = 1e-9 * (T / 298.15) * Math.exp(-(P - 0.1) / 100)
  const tau = 1.5
  const De = D0 * porosity / tau
  return De * 1e9
}
