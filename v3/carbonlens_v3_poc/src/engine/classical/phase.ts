const TC_CO2 = 304.13
const PC_CO2 = 7.377
const TC_CH4 = 190.56
const PC_CH4 = 4.599
const TC_N2 = 126.19
const PC_N2 = 3.390

export function determinePhase(
  temperatureK: number,
  pressureMpa: number,
  methaneMoleFrac: number,
  nitrogenMoleFrac: number
): 'subcritical' | 'supercritical' {
  const co2Frac = 1 - methaneMoleFrac - nitrogenMoleFrac
  const tcEff = co2Frac * TC_CO2 + methaneMoleFrac * TC_CH4 + nitrogenMoleFrac * TC_N2
  const pcEff = co2Frac * PC_CO2 + methaneMoleFrac * PC_CH4 + nitrogenMoleFrac * PC_N2
  if (temperatureK > tcEff && pressureMpa > pcEff) return 'supercritical'
  return 'subcritical'
}

export function computeTr(temperatureK: number, methaneMoleFrac: number, nitrogenMoleFrac: number): number {
  const co2Frac = 1 - methaneMoleFrac - nitrogenMoleFrac
  const tcEff = co2Frac * TC_CO2 + methaneMoleFrac * TC_CH4 + nitrogenMoleFrac * TC_N2
  return temperatureK / tcEff
}

export function computePr(pressureMpa: number, methaneMoleFrac: number, nitrogenMoleFrac: number): number {
  const co2Frac = 1 - methaneMoleFrac - nitrogenMoleFrac
  const pcEff = co2Frac * PC_CO2 + methaneMoleFrac * PC_CH4 + nitrogenMoleFrac * PC_N2
  return pressureMpa / pcEff
}
