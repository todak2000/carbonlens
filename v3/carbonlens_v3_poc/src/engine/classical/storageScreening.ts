/**
 * CO2 Storage Screening Criteria Engine
 *
 * Implements the 10-criterion checklist from:
 *   - Bachu, S. (2003). Screening and ranking of sedimentary basins for sequestration
 *     of CO2 in geological media. Environmental Geology, 44(3), 277-289.
 *   - NETL (2015). Best Practices: Site Screening, Site Selection, and Site
 *     Characterization for Geologic Storage Projects. DOE/NETL-2015/1632.
 *   - Chadwick et al. (2008). Best Practice for the Storage of CO2 in Saline Aquifers.
 *     British Geological Survey Occasional Publication No. 14.
 *   - Bradshaw et al. (2007). CO2 storage capacity estimation: Issues and development
 *     of standards. International Journal of Greenhouse Gas Control, 1(1), 62-68.
 *
 * NOTE: These are CO2 geological storage screening criteria. Do NOT confuse with
 * Taber (1983) EOR screening criteria, which apply to CO2-EOR and are out of scope.
 */

import type { FormationParams } from '../../types'

export interface ScreeningCriterion {
  id: string
  name: string
  description: string
  reference: string
  yourValue: number
  unit: string
  threshold: number
  thresholdLabel: string
  status: 'green' | 'amber' | 'red'
  note: string
}

export interface StorageScreeningResult {
  criteria: ScreeningCriterion[]   // exactly 10 items
  totalPassed: number              // green count
  totalAmber: number
  totalFailed: number              // red count
  score: number                    // 0-100, weighted (green=10, amber=5, red=0)
  canProceed: boolean              // false if any red
  requiresAcknowledgment: boolean  // true if any amber
  recommendation: string
}

/** Classify a value against red/amber/green thresholds (all ascending: higher is better) */
function classify(
  value: number,
  redBelow: number,
  amberBelow: number,
): 'green' | 'amber' | 'red' {
  if (value < redBelow) return 'red'
  if (value < amberBelow) return 'amber'
  return 'green'
}

/**
 * Injectivity Index approximation per NETL (2015) Appendix A.
 * II = (k [m2] * h [m]) / (mu_CO2 [Pa.s] * ln(re/rw))
 * Units: m3/(s.Pa) -> convert to kg/(s.MPa) via density
 *
 * re = sqrt(area_m2 / pi)  [drainage radius]
 * rw = 0.1 m               [wellbore radius]
 *
 * Returns value in kg/(s.MPa) using supercritical CO2 density 700 kg/m3 as reference.
 */
function computeInjectivityIndex(
  permeability_mD: number,
  thickness_m: number,
  area_km2: number,
): number {
  const k_m2 = permeability_mD * 9.869e-16
  const area_m2 = area_km2 * 1e6
  const re = Math.sqrt(area_m2 / Math.PI)
  const rw = 0.1
  const mu_co2_Pas = 6e-5          // supercritical CO2 viscosity at ~50C, 15MPa (Fenghour 1998)
  const rho_co2 = 700              // kg/m3 reference for unit conversion
  const II_m3_s_Pa = (k_m2 * thickness_m) / (mu_co2_Pas * Math.log(re / rw))
  const II_kg_s_MPa = II_m3_s_Pa * rho_co2 * 1e6
  return Math.max(0, II_kg_s_MPa)
}

/**
 * Check whether the formation is supercritical (T > 31.1C and P > 7.38 MPa).
 * Returns: 'supercritical' | 'near-critical' | 'subcritical'
 */
function co2PhaseRegime(
  temperature_C: number,
  pressure_MPa: number,
): 'supercritical' | 'near-critical' | 'subcritical' {
  const T_crit = 31.04  // C
  const P_crit = 7.38   // MPa
  if (temperature_C >= T_crit && pressure_MPa >= P_crit) {
    // Fully supercritical — comfortable margin above critical point
    if (temperature_C >= 35 && pressure_MPa >= 10) return 'supercritical'
    return 'near-critical'
  }
  return 'subcritical'
}

export function assessStorageScreening(params: FormationParams): StorageScreeningResult {
  const {
    depth,
    temperature,
    pressure,
    porosity,
    permeability,
    thickness,
    netToGross,
    area,
  } = params

  const phase = co2PhaseRegime(temperature, pressure)
  const II = computeInjectivityIndex(permeability, thickness, area)

  const criteria: ScreeningCriterion[] = [
    // 1. Supercritical Depth
    {
      id: 'depth',
      name: 'Supercritical Depth',
      description: 'Formation must be deep enough for CO2 to remain in dense-phase (supercritical or liquid). Below 800m CO2 is gaseous — storage density collapses ~50x.',
      reference: 'Bachu (2003) Environ. Geol. 44:277',
      yourValue: depth,
      unit: 'm',
      threshold: 800,
      thresholdLabel: '≥1000 m optimal, ≥800 m minimum',
      status: classify(depth, 800, 1000),
      note: depth < 800
        ? 'CO2 will be gaseous at this depth — storage is not viable.'
        : depth < 1000
          ? 'CO2 is near-critical: density is adequate but buoyancy risk is elevated. Confirm caprock integrity.'
          : 'Depth supports dense-phase CO2. Buoyancy forces are moderate and manageable.',
    },

    // 2. Critical Temperature
    // Note: 1000m threshold (not 1200m) aligns with practical industry cutoff.
    // At a 30°C/km geothermal gradient + 10°C surface, T(1000m) = 40°C — clearly
    // supercritical. Bachu (2003) cites 800m minimum; 1000m is the practical optimum.
    {
      id: 'temperature',
      name: 'Critical Temperature',
      description: 'Reservoir temperature must exceed CO2 critical temperature (31.1°C) to keep CO2 in supercritical phase. Subcritical CO2 is gaseous and has very low storage density.',
      reference: 'Bachu (2003); CO2 critical point 31.04°C, 7.38 MPa',
      yourValue: temperature,
      unit: '°C',
      threshold: 31.1,
      thresholdLabel: '≥35°C optimal, ≥31.1°C minimum',
      status: classify(temperature, 31.1, 35),
      note: temperature < 31.1
        ? 'Temperature below CO2 critical point. CO2 will be gaseous — not suitable for geological storage.'
        : temperature < 35
          ? 'Near-critical temperature. Storage is feasible but CO2 density is sensitive to small pressure changes.'
          : 'Temperature supports stable supercritical CO2.',
    },

    // 3. Critical Pressure
    {
      id: 'pressure',
      name: 'Critical Pressure',
      description: 'Reservoir pressure must exceed CO2 critical pressure (7.38 MPa) to maintain dense-phase CO2. Typically equivalent to a hydrostatic gradient of ~10 MPa/km.',
      reference: 'Bachu (2003); CO2 Pc = 7.38 MPa',
      yourValue: pressure,
      unit: 'MPa',
      threshold: 7.38,
      thresholdLabel: '≥10 MPa optimal, ≥7.38 MPa minimum',
      status: classify(pressure, 7.38, 10),
      note: pressure < 7.38
        ? 'Pressure below CO2 critical point. CO2 will be gaseous — storage is not viable.'
        : pressure < 10
          ? 'Near-critical pressure. Dense-phase CO2 is achievable but pressure management is critical.'
          : 'Pressure supports stable supercritical CO2 storage.',
    },

    // 4. Minimum Porosity
    {
      id: 'porosity',
      name: 'Minimum Porosity',
      description: 'Effective porosity controls pore volume available for CO2 storage. Formations with porosity below 10% offer insufficient storage capacity for commercial-scale injection.',
      reference: 'Bachu (2003); Chadwick et al. (2008)',
      yourValue: porosity,
      unit: 'fraction',
      threshold: 0.10,
      thresholdLabel: '≥0.15 optimal, ≥0.10 minimum',
      status: classify(porosity, 0.10, 0.15),
      note: porosity < 0.10
        ? 'Porosity too low for commercial CO2 storage. Consider alternative formations.'
        : porosity < 0.15
          ? 'Marginal porosity. Storage capacity will be limited — evaluate net-to-gross carefully.'
          : 'Porosity is adequate for CO2 storage.',
    },

    // 5. Minimum Permeability
    {
      id: 'permeability',
      name: 'Minimum Permeability',
      description: 'Permeability controls injectivity. Below 10 mD, injection pressure may exceed fracture gradient and the required well count becomes impractical.',
      reference: 'Chadwick et al. (2008) BGS OPN14',
      yourValue: permeability,
      unit: 'mD',
      threshold: 10,
      thresholdLabel: '≥50 mD optimal, ≥10 mD minimum',
      status: classify(permeability, 10, 50),
      note: permeability < 10
        ? 'Permeability critically low — injection at commercial rates will likely fracture the formation.'
        : permeability < 50
          ? 'Marginal permeability. Acceptable with multiple injection wells or horizontal completions.'
          : 'Permeability supports adequate CO2 injectivity.',
    },

    // 6. Formation Thickness
    {
      id: 'thickness',
      name: 'Formation Thickness',
      description: 'Reservoir thickness sets the available vertical drainage height. Thin formations constrain plume geometry and reduce gravity-driven residual trapping efficiency.',
      reference: 'NETL (2015) DOE/NETL-2015/1632',
      yourValue: thickness,
      unit: 'm',
      threshold: 20,
      thresholdLabel: '≥50 m optimal, ≥20 m minimum',
      status: classify(thickness, 20, 50),
      note: thickness < 20
        ? 'Formation too thin for effective CO2 storage. Gravity-driven spreading will be negligible.'
        : thickness < 50
          ? 'Marginal thickness. Plume will spread laterally with limited vertical containment.'
          : 'Thickness supports effective CO2 plume development and residual trapping.',
    },

    // 7. Net-to-Gross
    {
      id: 'netToGross',
      name: 'Net-to-Gross Ratio',
      description: 'Net-to-gross (NTG) is the fraction of the formation that is permeable reservoir quality. Low NTG means interbedded shale baffles that fragment the storage volume and impede sweep.',
      reference: 'NETL (2015)',
      yourValue: netToGross,
      unit: 'fraction',
      threshold: 0.40,
      thresholdLabel: '≥0.60 optimal, ≥0.40 minimum',
      status: classify(netToGross, 0.40, 0.60),
      note: netToGross < 0.40
        ? 'Net-to-gross too low — intra-formational baffles will severely restrict sweep and injectivity.'
        : netToGross < 0.60
          ? 'Marginal NTG. Heterogeneity corrections (Dykstra-Parsons) should be applied to capacity estimates.'
          : 'Net-to-gross is adequate for effective CO2 sweep.',
    },

    // 8. Formation Area
    {
      id: 'area',
      name: 'Formation Area',
      description: 'The areal extent of the storage formation determines the maximum plume footprint and the total injectable volume. Small formations limit CO2 volumes and increase boundary-effect risks.',
      reference: 'Bradshaw et al. (2007) IJGGC 1:62',
      yourValue: area,
      unit: 'km²',
      threshold: 1,
      thresholdLabel: '≥5 km² optimal, ≥1 km² minimum',
      status: classify(area, 1, 5),
      note: area < 1
        ? 'Formation area critically small. Pressure buildup will rapidly reach boundaries — not suitable for storage.'
        : area < 5
          ? 'Small formation. Detailed pressure modelling required to confirm boundary effects are acceptable.'
          : 'Formation area is adequate for CO2 storage operations.',
    },

    // 9. Supercritical CO2 Phase
    {
      id: 'co2Phase',
      name: 'Supercritical CO2 Phase',
      description: 'CO2 must be in the dense (supercritical or liquid) phase at reservoir conditions to achieve the density needed for efficient storage. This combines the temperature and pressure criteria into an integrated phase check.',
      reference: 'Span & Wagner (1996); Bachu (2003)',
      yourValue: temperature,          // representative scalar (temperature drives phase at depth)
      unit: '°C (T+P combined)',
      threshold: 31.04,
      thresholdLabel: 'Fully supercritical (T>35°C, P>10 MPa)',
      status: phase === 'supercritical' ? 'green' : phase === 'near-critical' ? 'amber' : 'red',
      note: phase === 'supercritical'
        ? 'CO2 is fully supercritical at reservoir conditions. Density is 600-800 kg/m³.'
        : phase === 'near-critical'
          ? 'CO2 is near-critical. Storage is feasible but density is sensitive to small T/P fluctuations.'
          : 'CO2 is subcritical (gaseous) at reservoir conditions. Geological storage is not viable.',
    },

    // 10. Injectivity Index
    {
      id: 'injectivity',
      name: 'Injectivity Index',
      description: 'Injectivity index (II) estimates how readily CO2 can be injected at commercial rates without exceeding fracture gradient. Computed from permeability, thickness, and formation area.',
      reference: 'NETL (2015); Peaceman (1978)',
      yourValue: II,
      unit: 'kg/(s·MPa)',
      threshold: 0.1,
      thresholdLabel: '≥1 kg/(s·MPa) optimal, ≥0.1 minimum',
      status: classify(II, 0.1, 1),
      note: II < 0.1
        ? 'Injectivity critically low. Commercial injection rates will require pressures above fracture gradient.'
        : II < 1
          ? 'Marginal injectivity. Multiple injection wells or horizontal completions will likely be required.'
          : 'Injectivity supports commercial-scale CO2 injection.',
    },
  ]

  const totalPassed = criteria.filter((c) => c.status === 'green').length
  const totalAmber  = criteria.filter((c) => c.status === 'amber').length
  const totalFailed = criteria.filter((c) => c.status === 'red').length

  // Weighted score: green=10, amber=5, red=0. Max=100 (10 criteria).
  const score = totalPassed * 10 + totalAmber * 5

  const canProceed = totalFailed === 0
  const requiresAcknowledgment = totalAmber > 0

  let recommendation: string
  if (!canProceed) {
    recommendation = `${totalFailed} criterion${totalFailed > 1 ? 'a' : 'ion'} failed. This formation does not meet minimum CO2 storage requirements. Address the red items before proceeding.`
  } else if (requiresAcknowledgment) {
    recommendation = `Formation meets minimum requirements but ${totalAmber} criterion${totalAmber > 1 ? 'a' : 'ion'} require${totalAmber === 1 ? 's' : ''} attention. Review amber items and confirm before running the simulation.`
  } else {
    recommendation = 'All 10 storage screening criteria are satisfied. This formation is a viable CO2 storage candidate.'
  }

  return {
    criteria,
    totalPassed,
    totalAmber,
    totalFailed,
    score,
    canProceed,
    requiresAcknowledgment,
    recommendation,
  }
}
