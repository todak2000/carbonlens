import { FormationParams, SimulationResult } from '../types'
import {
  co2DensitySpanWagner, co2ViscosityFenghour,
  co2SolubilityDuanSun, brineDensityGarcia,
} from '../engine'
import { computePr, computeTr, evaluateMars, scaleInput, subEquation, subScaler, supEquation, supScaler } from '../engine'
import type { MarsInput } from '../engine/mars/types'

export interface ProfilePoint {
  depth: number     // meters
  pressure: number  // MPa
  temperature: number // °C
  co2Density: number  // kg/m³
  brineDensity: number // kg/m³
  viscosity: number   // Pa·s
  solubility: number  // mol/kg
  ift: number | null  // mN/m
}

export interface TimeSeriesPoint {
  year: number
  storageMt: number
  plumeRadiusM: number
  plumeHeightM: number
  injectionPressureMPa: number
  residualTrappingMt: number
  solubilityTrappingMt: number
  mobilePlumeMt: number
  capacityUtilPct: number
}

/**
 * Generate a vertical profile from seabed to base of formation.
 * Sweeps pressure/temperature across the depth column and computes
 * IFT, solubility, density, viscosity at each level.
 */
export function generateDepthProfile(
  params: FormationParams,
  surfaceTemp: number = 10,
  geoGradient: number = 0.025, // °C/m
  steps: number = 20,
): ProfilePoint[] {
  const profile: ProfilePoint[] = []
  const h_m = params.thickness
  const topDepth = params.depth - h_m / 2
  const baseDepth = params.depth + h_m / 2

  for (let i = 0; i <= steps; i++) {
    const frac = i / steps
    const d = topDepth + frac * h_m
    // Hydrostatic pressure gradient ~0.0105 MPa/m for brine
    const P = params.pressure * (1 + (d - params.depth) / params.depth * 0.3)
    const T = surfaceTemp + d * geoGradient

    const T_K = T + 273.15
    const P_Pa = P * 1e6
    const totalSalt = params.monovalentSalinity + params.bivalentSalinity

    const rhoCO2 = co2DensitySpanWagner(T_K, P_Pa)
    const rhoBrine = brineDensityGarcia(T_K, P, totalSalt)
    const visc = co2ViscosityFenghour(T_K, rhoCO2)
    const solubility = co2SolubilityDuanSun(T_K, P, totalSalt)
    const drho = rhoBrine - rhoCO2

    // IFT via MARS model
    const phase = T_K > 304.13 && P > 7.38 ? 'supercritical' : 'subcritical'
    const Pr = computePr(P, params.methaneFraction, params.nitrogenFraction)
    const Tr = computeTr(T_K, params.methaneFraction, params.nitrogenFraction)
    const input: MarsInput = {
      Pr, Tr,
      MCM: params.monovalentSalinity,
      BCM: params.bivalentSalinity,
      x_CH4: params.methaneFraction * 100,
      x_N2: params.nitrogenFraction * 100,
      drho_sq: drho * drho / 1e6,
      BCM_bin: params.bivalentSalinity > 0 ? 1 : 0,
      CH4_bin: params.methaneFraction > 0 ? 1 : 0,
      N2_bin: params.nitrogenFraction > 0 ? 1 : 0,
    }
    let ift: number | null = null
    try {
      ift = evaluateMars(scaleInput(input, phase === 'subcritical' ? subScaler : supScaler),
        phase === 'subcritical' ? subEquation : supEquation)
    } catch { /* IFT unavailable for some P/T */ }

    profile.push({
      depth: Math.round(d * 10) / 10,
      pressure: Math.round(P * 100) / 100,
      temperature: Math.round(T * 10) / 10,
      co2Density: Math.round(rhoCO2),
      brineDensity: Math.round(rhoBrine),
      viscosity: Math.round(visc * 1e6 * 100) / 100, // µPa·s
      solubility: Math.round(solubility * 1000) / 1000,
      ift: ift !== null ? Math.round(ift * 100) / 100 : null,
    })
  }
  return profile
}

/**
 * Generate a time series from simulation snapshots across projectYears.
 */
export function generateTimeSeries(
  params: FormationParams,
  result: SimulationResult,
  wells: { injectionRate: number; rampUpYears: number; rampDownYears: number }[],
  projectYears: number,
  steps: number = 50,
): TimeSeriesPoint[] {
  const series: TimeSeriesPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const year = Math.round((i / steps) * projectYears)
    if (year === 0) continue
    // Approximate interpolation using the final result's ratios
    const frac = Math.min(1, year / projectYears)
    const sqrtFrac = Math.sqrt(frac)
    const cumFrac = Math.min(1, frac * 1.0)
    series.push({
      year,
      storageMt: Math.round(result.storageCapacity * cumFrac * 100) / 100,
      plumeRadiusM: Math.round(result.plumeRadius * sqrtFrac),
      plumeHeightM: Math.round(result.plumeHeight * sqrtFrac),
      injectionPressureMPa: Math.round((params.pressure + (result.injectionPressure - params.pressure) * sqrtFrac) * 100) / 100,
      residualTrappingMt: Math.round(result.residualTrapping * cumFrac * 100) / 100,
      solubilityTrappingMt: Math.round(result.solubilityTrapping * cumFrac * 100) / 100,
      mobilePlumeMt: Math.round(result.mobilePlume * cumFrac * 100) / 100,
      capacityUtilPct: Math.round(result.capacityUtilPct * cumFrac * 100) / 100,
    })
  }
  return series
}

/**
 * Convert profile array to CSV string.
 */
export function profileToCSV(profile: ProfilePoint[]): string {
  const header = 'Depth(m),Pressure(MPa),Temperature(°C),CO2Density(kg/m³),BrineDensity(kg/m³),Viscosity(µPa·s),Solubility(mol/kg),IFT(mN/m)'
  const rows = profile.map(p =>
    `${p.depth},${p.pressure},${p.temperature},${p.co2Density},${p.brineDensity},${p.viscosity},${p.solubility},${p.ift ?? 'N/A'}`
  )
  return [header, ...rows].join('\n')
}

/**
 * Convert time series to CSV string.
 */
export function timeSeriesToCSV(series: TimeSeriesPoint[]): string {
  const header = 'Year,Stored(Mt),PlumeRadius(m),PlumeHeight(m),InjPressure(MPa),ResidualTrapping(Mt),SolubilityTrapping(Mt),MobilePlume(Mt),CapacityUtil(%)'
  const rows = series.map(p =>
    `${p.year},${p.storageMt},${p.plumeRadiusM},${p.plumeHeightM},${p.injectionPressureMPa},${p.residualTrappingMt},${p.solubilityTrappingMt},${p.mobilePlumeMt},${p.capacityUtilPct}`
  )
  return [header, ...rows].join('\n')
}

/**
 * Build a comprehensive JSON object with all formation + simulation data.
 */
export function buildExportJSON(
  params: FormationParams,
  wells: { id: string; x: number; z: number; injectionRate: number; label: string; rampUpYears: number; rampDownYears: number }[],
  result: SimulationResult | null,
  jurisdiction: string,
  depthProfile: ProfilePoint[],
  timeSeries: TimeSeriesPoint[],
): object {
  return {
    exportDate: new Date().toISOString(),
    jurisdiction,
    formation: params,
    wells,
    simulation: result ? {
      storageCapacityMt: result.storageCapacity,
      totalCapacityMt: result.totalCapacity,
      capacityP10: result.capacityP10,
      capacityP50: result.totalCapacity,
      capacityP90: result.capacityP90,
      capacityUtilPct: result.capacityUtilPct,
      overpressureRisk: result.overpressureRisk,
      plumeRadiusM: result.plumeRadius,
      plumeHeightM: result.plumeHeight,
      injectionPressureMPa: result.injectionPressure,
      co2Density_kgm3: result.co2Density,
      brineDensity_kgm3: result.brineDensity,
      densityDiff_kgm3: result.densityDiff,
      co2Viscosity_Pas: result.co2Viscosity,
      solubility_molkg: result.solubility,
      diffusion_m2s: result.diffusion,
      ift_mNm: result.ift,
      containmentProbability: result.containmentProbability,
      residualTrappingMt: result.residualTrapping,
      solubilityTrappingMt: result.solubilityTrapping,
      mobilePlumeMt: result.mobilePlume,
      pressureField: result.pressureField,
    } : null,
    depthProfile,
    timeSeries,
  }
}
