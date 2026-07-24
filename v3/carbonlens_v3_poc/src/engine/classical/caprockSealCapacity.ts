/**
 * Caprock Seal Capacity Engine
 *
 * Computes the maximum CO2 column height that the caprock can contain before
 * capillary entry, using the MARS IFT model output. This connects the ML IFT
 * prediction directly to operational caprock safety.
 *
 * Theory:
 *   Capillary entry pressure:  Pe = (2 * gamma * cos(theta)) / r
 *   Max containable column:    h_max = Pe / (deltaRho * g)
 *
 * References:
 *   Schowalter (1979) Mechanics of secondary hydrocarbon migration and entrapment.
 *   AAPG Bulletin 63(5), 723-760.
 *   Berg (1975) Capillary pressure in stratigraphic traps. AAPG Bulletin 59(6), 939-956.
 *   Hildenbrand et al. (2002) Gas breakthrough experiments on pelitic rocks.
 *   Geofluids 2(1), 3-23.
 */

export interface CaprockSealInput {
  iftMNm: number                   // CO2-brine IFT from MARS model (mN/m)
  caprockPoreThroatNm: number      // caprock pore throat radius (nm) — user input
  contactAngleDeg: number          // advancing contact angle (degrees); default 0 (water-wet)
  co2DensityKgm3: number           // from Span-Wagner EOS (kg/m3)
  brineDensityKgm3: number         // from Garcia (2001) correlation (kg/m3)
  formationAreaKm2: number         // used to estimate column mass
  caprockPorosityFraction: number  // caprock matrix porosity; default 0.05 for shale
  currentColumnHeightM?: number    // current simulated CO2 column height (m); for utilisation
}

export interface CaprockSealResult {
  maxColumnHeightM: number        // h_max = Pe / (deltaRho * g) in metres
  maxColumnMassMt: number         // approximate containable CO2 mass (Mt)
  buoyancyPressureMPa: number     // deltaRho * g * currentColumn (MPa)
  entryPressureMPa: number        // Pe = 2*gamma*cos(theta) / r_m  (MPa)
  sealUtilizationPct: number      // currentColumn / maxColumn * 100 (0 if no currentColumn)
  status: 'adequate' | 'marginal' | 'insufficient'
  statusNote: string
}

export function computeCaprockSealCapacity(input: CaprockSealInput): CaprockSealResult {
  const {
    iftMNm,
    caprockPoreThroatNm,
    contactAngleDeg,
    co2DensityKgm3,
    brineDensityKgm3,
    formationAreaKm2,
    caprockPorosityFraction,
    currentColumnHeightM = 0,
  } = input

  // Unit conversions
  const r_m         = caprockPoreThroatNm * 1e-9           // nm to m
  const gamma_Nm    = iftMNm * 1e-3                        // mN/m to N/m
  const theta_rad   = (contactAngleDeg * Math.PI) / 180    // degrees to radians
  const area_m2     = formationAreaKm2 * 1e6               // km2 to m2
  const g           = 9.81                                  // m/s2

  // Entry pressure (Laplace equation)
  const Pe_Pa   = (2 * gamma_Nm * Math.cos(theta_rad)) / Math.max(r_m, 1e-12)
  const Pe_MPa  = Pe_Pa / 1e6

  // Density contrast
  const deltaRho = Math.max(0, brineDensityKgm3 - co2DensityKgm3)

  // Maximum CO2 column height
  const h_max = deltaRho > 0 ? Pe_Pa / (deltaRho * g) : 0

  // Approximate containable mass (thin-layer caprock pore volume * CO2 density)
  // Uses caprock porosity as the fraction of the seal that could hold CO2 before leakage
  const V_col_m3       = area_m2 * h_max * caprockPorosityFraction
  const maxColumnMassMt = (V_col_m3 * co2DensityKgm3) / 1e9   // kg to Mt

  // Buoyancy pressure from current column
  const buoyancyPressureMPa = (deltaRho * g * currentColumnHeightM) / 1e6

  // Seal utilisation
  const sealUtilizationPct = h_max > 0 ? (currentColumnHeightM / h_max) * 100 : 100

  // Status thresholds
  let status: 'adequate' | 'marginal' | 'insufficient'
  let statusNote: string

  if (h_max < 10 || sealUtilizationPct > 90) {
    status = 'insufficient'
    statusNote = h_max < 10
      ? `Maximum containable column is only ${h_max.toFixed(1)} m. The caprock cannot contain a meaningful CO2 column at this pore-throat size and IFT. Investigate alternative seal intervals.`
      : `Seal utilisation is ${sealUtilizationPct.toFixed(0)}% — the current CO2 column is approaching the caprock capillary entry pressure. Risk of CO2 migration into the caprock.`
  } else if (h_max < 50 || sealUtilizationPct > 70) {
    status = 'marginal'
    statusNote = h_max < 50
      ? `Maximum containable column is ${h_max.toFixed(0)} m — limited margin for CO2 column development. Detailed caprock characterisation is recommended before proceeding.`
      : `Seal utilisation is ${sealUtilizationPct.toFixed(0)}%. The caprock can contain the current column but there is limited safety margin. Additional pressure transient analysis is recommended.`
  } else {
    status = 'adequate'
    statusNote = `Caprock can contain up to ${h_max.toFixed(0)} m of CO2 column. Current utilisation is ${sealUtilizationPct.toFixed(0)}% — seal capacity is adequate.`
  }

  return {
    maxColumnHeightM: h_max,
    maxColumnMassMt,
    buoyancyPressureMPa,
    entryPressureMPa: Pe_MPa,
    sealUtilizationPct,
    status,
    statusNote,
  }
}
