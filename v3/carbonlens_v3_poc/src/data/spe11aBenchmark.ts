/**
 * SPE11 CSP Case A — benchmark data and parser
 * ==============================================
 *
 * Reference: 11th Society of Petroleum Engineers Comparative Solution Project
 *   "CO2 Storage" (SPE11 CSP)
 *   https://ukccsrc.ac.uk/spe-comparative-solution-project/
 *
 * SPE11a is a 2D x-z cross-section (~2.8 m × 1.2 m) with 7 facies,
 * representing a CO2 injection into a heterogeneous saline aquifer
 * under a low-permeability caprock.
 *
 * All values are from the OPM Flow reference simulation (opm1) unless
 * otherwise noted.
 */

export interface Spe11aTimeRow {
  t_s: number
  p1_Pa: number
  p2_Pa: number
  mobA_kg: number
  immA_kg: number
  dissA_kg: number
  sealA_kg: number
  mobB_kg: number
  immB_kg: number
  dissB_kg: number
  sealB_kg: number
  mC_m2: number
  sealTot_kg: number
}

export interface Spe11aTimeSeries {
  rows: Spe11aTimeRow[]
  totalTime_s: number
  totalTime_h: number
  totalMassInjected_kg: number
  finalMobileA_kg: number
  finalImmobileA_kg: number
  finalDissolvedA_kg: number
  finalSealA_kg: number
  finalMobileB_kg: number
  finalImmobileB_kg: number
  finalDissolvedB_kg: number
  finalSealB_kg: number
  finalSealTot_kg: number
}

export function parseSpe11aTimeSeries(csv: string): Spe11aTimeSeries {
  const lines = csv.trim().split('\n')
  const rows: Spe11aTimeRow[] = []
  for (const line of lines) {
    if (line.startsWith('#')) continue
    const cols = line.split(',').map(s => parseFloat(s.trim()))
    if (cols.length < 13) continue
    rows.push({
      t_s: cols[0],
      p1_Pa: cols[1],
      p2_Pa: cols[2],
      mobA_kg: cols[3],
      immA_kg: cols[4],
      dissA_kg: cols[5],
      sealA_kg: cols[6],
      mobB_kg: cols[7],
      immB_kg: cols[8],
      dissB_kg: cols[9],
      sealB_kg: cols[10],
      mC_m2: cols[11],
      sealTot_kg: cols[12],
    })
  }

  const last = rows[rows.length - 1]
  const finalMassA = last.mobA_kg + last.immA_kg + last.dissA_kg + last.sealA_kg
  const finalMassB = last.mobB_kg + last.immB_kg + last.dissB_kg + last.sealB_kg

  return {
    rows,
    totalTime_s: last.t_s,
    totalTime_h: last.t_s / 3600,
    totalMassInjected_kg: last.mobA_kg + last.immA_kg + last.dissA_kg + last.sealA_kg
      + last.mobB_kg + last.immB_kg + last.dissB_kg + last.sealB_kg
      + last.sealTot_kg,
    finalMobileA_kg: last.mobA_kg,
    finalImmobileA_kg: last.immA_kg,
    finalDissolvedA_kg: last.dissA_kg,
    finalSealA_kg: last.sealA_kg,
    finalMobileB_kg: last.mobB_kg,
    finalImmobileB_kg: last.immB_kg,
    finalDissolvedB_kg: last.dissB_kg,
    finalSealB_kg: last.sealB_kg,
    finalSealTot_kg: last.sealTot_kg,
  }
}

export function totalMassA(row: Spe11aTimeRow): number {
  return row.mobA_kg + row.immA_kg + row.dissA_kg + row.sealA_kg
}

export function totalMassB(row: Spe11aTimeRow): number {
  return row.mobB_kg + row.immB_kg + row.dissB_kg + row.sealB_kg
}

export function totalMassSystem(row: Spe11aTimeRow): number {
  return totalMassA(row) + totalMassB(row) + row.sealTot_kg
}

/** Fraction of total injected CO2 that remains mobile (free phase in aquifer) */
export function mobileFraction(row: Spe11aTimeRow): number {
  const total = totalMassSystem(row)
  return total > 0 ? row.mobA_kg / total : 0
}

/** Fraction of total injected CO2 that is dissolved */
export function dissolvedFraction(row: Spe11aTimeRow): number {
  const total = totalMassSystem(row)
  return total > 0 ? (row.dissA_kg + row.dissB_kg) / total : 0
}

/** Fraction of total injected CO2 that has entered the seal */
export function sealFraction(row: Spe11aTimeRow): number {
  const total = totalMassSystem(row)
  return total > 0 ? (row.sealTot_kg) / total : 0
}

// ── Reference values from OPM1 ────────────────────────────────────────────────

export const SPE11A = {
  /** Total simulation time (s) */
  totalTime_s: 432000,
  /** Total simulation time (hours) */
  totalTime_h: 120,
  /** Total CO2 injected (kg) */
  totalInjected_kg: 2.425e-3,
  /** Injection rate (kg/s) — constant over 120h */
  injectionRate_kg_s: 5.61e-9,
  /** Domain width (m) */
  domainWidth_m: 2.8,
  /** Domain height (m) */
  domainHeight_m: 1.2,
  /** Aquifer permeability (mD, typical) */
  permeability_mD: 100,
  /** Porosity (typical) */
  porosity: 0.20,
  /** CO2 density at reservoir conditions (kg/m³) */
  co2Density_kg_m3: 650,
  /** Brine density (kg/m³) */
  brineDensity_kg_m3: 1050,
  /** Temperature (°C) */
  temperature_C: 50,
  /** Initial pressure (MPa) */
  pressure_MPa: 0.117,
  /** Residual gas saturation */
  residualGasSaturation: 0.10,
  /** Number of simulators with published results */
  groupCount: 11,
}

export const SPE11A_SIMULATORS = [
  'opm1',
  'opengosim1',
  'geos1',
  'geos2',
  'ifpen1',
  'calgary1',
  'cau-kiel1',
  'csiro1',
  'ctc-cne1',
] as const
