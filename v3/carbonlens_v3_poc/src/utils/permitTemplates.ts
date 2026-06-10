import type { FormationParams, SimulationResult, Well } from '../types'

export interface PermitSection {
  title: string
  lines: string[]
}

export interface PermitTemplate {
  id: string
  name: string
  jurisdiction: string
  regulator: string
  legislation: string
  sections: (params: FormationParams, wells: Well[], result: SimulationResult | null) => PermitSection[]
}

const l = (key: string, val: string) => `  ${key.padEnd(28)} ${val}`
const sep = '  ' + '-'.repeat(52)

function formationSection(params: FormationParams): PermitSection {
  return {
    title: 'FORMATION CHARACTERIZATION',
    lines: [
      sep,
      l('Depth', `${params.depth} m`),
      l('Thickness', `${params.thickness} m`),
      l('Porosity', `${(params.porosity * 100).toFixed(1)} %`),
      l('Permeability', `${params.permeability} mD`),
      l('Initial Pressure', `${params.pressure} MPa`),
      l('Temperature', `${params.temperature} °C`),
      l('Geometry Type', params.geometryType),
      l('Area', `${params.area} km²`),
      l('Net-to-Gross', `${params.netToGross}`),
      l('Salinity', `${params.monovalentSalinity} mono / ${params.bivalentSalinity} bi mol/kg`),
      l('CH₄ / N₂', `${(params.methaneFraction * 100).toFixed(1)}% / ${(params.nitrogenFraction * 100).toFixed(1)}%`),
      sep,
    ],
  }
}

function caprockSection(params: FormationParams): PermitSection {
  return {
    title: 'CAPROCK & GEOMECHANICAL PROPERTIES',
    lines: [
      sep,
      l('Friction Angle', `${params.caprockFriction}°`),
      l('Cohesion', `${params.caprockCohesion} MPa`),
      l('Biot Coefficient', `${params.biotCoefficient}`),
      sep,
    ],
  }
}

function wellsSection(wells: Well[]): PermitSection {
  return {
    title: 'WELL CONFIGURATION',
    lines: [
      sep,
      ...wells.flatMap(w => [
        l(`Well: ${w.label}`, `(${w.x.toFixed(2)}, ${w.z.toFixed(2)})`),
        l('  Rate', `${w.injectionRate} Mt/yr`),
        l('  Ramp Up / Down', `${w.rampUpYears} / ${w.rampDownYears} yr`),
      ]),
      sep,
    ],
  }
}

function resultsSection(result: SimulationResult): PermitSection {
  return {
    title: 'SIMULATION RESULTS',
    lines: [
      sep,
      l('Storage Capacity', `${result.storageCapacity.toFixed(2)} Mt`),
      l('Total Capacity (P50)', `${result.totalCapacity.toFixed(2)} Mt`),
      l('P10 / P90', `${result.capacityP10.toFixed(2)} / ${result.capacityP90.toFixed(2)} Mt`),
      l('Capacity Utilisation', `${result.capacityUtilPct.toFixed(1)} %`),
      l('Injection Pressure', `${result.injectionPressure.toFixed(1)} MPa`),
      l('CO₂ Density', `${result.co2Density.toFixed(0)} kg/m³`),
      l('Brine Density', `${result.brineDensity.toFixed(0)} kg/m³`),
      l('IFT', `${result.ift?.toFixed(2) ?? 'N/A'} mN/m`),
      l('Plume Radius', `${result.plumeRadius.toFixed(0)} m`),
      l('Plume Height', `${result.plumeHeight.toFixed(0)} m`),
      l('Containment Probability', `${(result.containmentProbability * 100).toFixed(0)} %`),
      l('Overpressure Risk', result.overpressureRisk ? '⚠ YES' : 'No'),
      sep,
      'TRAPPING MECHANISMS',
      sep,
      l('Mobile Plume', `${result.mobilePlume.toFixed(4)} Mt`),
      l('Residual (Ganglia)', `${result.residualTrapping.toFixed(4)} Mt`),
      l('Dissolved (Solubility)', `${result.solubilityTrapping.toFixed(4)} Mt`),
      l('Mineral (Geochemical)', `${(result.mineralTrapping ?? 0).toFixed(4)} Mt`),
      sep,
    ],
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

export const PERMIT_TEMPLATES: Record<string, PermitTemplate> = {

  US: {
    id: 'US',
    name: 'EPA Class VI UIC Permit',
    jurisdiction: 'United States',
    regulator: 'U.S. Environmental Protection Agency (EPA)',
    legislation: '40 CFR Parts 124, 144, 146 — Underground Injection Control Program',
    sections(params, wells, result) {
      const s: PermitSection[] = [
        {
          title: 'REGULATORY FRAMEWORK',
          lines: [
            sep,
            '  PROGRAM:             EPA Class VI — Underground Injection Control (UIC)',
            '  AUTHORITY:           Safe Drinking Water Act (SDWA)',
            '  REGULATIONS:         40 CFR §124, §144, §146',
            '  PERMIT TYPE:         Class VI Injection Well Permit',
            '',
            '  KEY REQUIREMENTS:',
            '    1. Area of Review (AoR) — delineation of USDW endangerment area',
            '    2. No-migration petition — demonstration of permanent containment',
            '    3. Injection zone — confining zone — USDW characterization',
            '    4. Financial responsibility — trust fund or surety bond',
            '    5. Post-injection site care (PISC) — 50-year minimum monitoring',
            '    6. Emergency and remedial response plan',
            '    7. Mechanical integrity testing (MIT) — periodic',
            '    8. CO₂ stream composition monitoring',
            sep,
          ],
        },
        formationSection(params),
        caprockSection(params),
        wellsSection(wells),
      ]
      if (result) s.push(resultsSection(result))
      return s
    },
  },

  EU: {
    id: 'EU',
    name: 'EU CCS Directive Storage Permit',
    jurisdiction: 'European Union',
    regulator: 'Member State Competent Authority',
    legislation: 'Directive 2009/31/EC on the Geological Storage of Carbon Dioxide',
    sections(params, wells, result) {
      const s: PermitSection[] = [
        {
          title: 'REGULATORY FRAMEWORK',
          lines: [
            sep,
            '  PROGRAM:             EU CCS Directive — Storage Permit',
            '  AUTHORITY:           Member State Competent Authority',
            '  LEGISLATION:         Directive 2009/31/EC, Annex I-II',
            '  PERMIT TYPE:         CO₂ Storage Permit',
            '',
            '  KEY REQUIREMENTS:',
            '    1. Storage complex characterisation (formation + caprock + seal)',
            '    2. CO₂ stream composition analysis (purity ≥ 95%)',
            '    3. Comprehensive risk assessment (HAZID / HAZOP)',
            '    4. Monitoring plan — corrective & routine measures',
            '    5. Financial security mechanism (before injection starts)',
            '    6. Post-transfer liability to Member State (after closure)',
            '    7. Closure criteria — demonstrate permanent containment',
            '    8. Public information and consultation',
            sep,
          ],
        },
        formationSection(params),
        caprockSection(params),
        wellsSection(wells),
      ]
      if (result) s.push(resultsSection(result))
      return s
    },
  },

  UK: {
    id: 'UK',
    name: 'UK CCS Storage Permit',
    jurisdiction: 'United Kingdom',
    regulator: 'North Sea Transition Authority (NSTA)',
    legislation: 'Energy Act 2008 / CCS Regulations 2010 (SI 2221)',
    sections(params, wells, result) {
      const s: PermitSection[] = [
        {
          title: 'REGULATORY FRAMEWORK',
          lines: [
            sep,
            '  PROGRAM:             UK CCS Regulatory Framework',
            '  AUTHORITY:           North Sea Transition Authority (NSTA)',
            '  LEGISLATION:         Energy Act 2008, CCS Regs 2010 SI 2221',
            '  PERMIT TYPE:         CO₂ Storage Permit',
            '',
            '  KEY REQUIREMENTS:',
            '    1. Storage site characterisation report',
            '    2. CO₂ stream composition permit conditions (≥ 95% CO₂)',
            '    3. Risk assessment (HAZID / HAZOP / bow-tie)',
            '    4. Monitoring and remediation plan',
            '    5. Financial security (trust fund or parent company guarantee)',
            '    6. Post-closure obligations (20-year minimum)',
            '    7. Well examination scheme (design / construction / abandonment)',
            sep,
          ],
        },
        formationSection(params),
        caprockSection(params),
        wellsSection(wells),
      ]
      if (result) s.push(resultsSection(result))
      return s
    },
  },

  AU: {
    id: 'AU',
    name: 'GHG Storage Injection Licence',
    jurisdiction: 'Australia',
    regulator: 'NOPSEMA (National Offshore Petroleum Safety and Environmental Management Authority)',
    legislation: 'Offshore Petroleum and Greenhouse Gas Storage Act 2006 (OPGGS Act)',
    sections(params, wells, result) {
      const s: PermitSection[] = [
        {
          title: 'REGULATORY FRAMEWORK',
          lines: [
            sep,
            '  PROGRAM:             Australian GHG Storage Regulatory Framework',
            '  AUTHORITY:           NOPSEMA',
            '  LEGISLATION:         OPGGS Act 2006, GHG Storage Regs 2021',
            '  PERMIT TYPE:         GHG Storage Injection Licence',
            '',
            '  KEY REQUIREMENTS:',
            '    1. Site plan and formation characterisation',
            '    2. Injection and monitoring program',
            '    3. Well integrity management plan',
            '    4. Environmental plan (EPBC Act compliance)',
            '    5. Financial assurance (rehabilitation bond)',
            '    6. Site closure and post-closure monitoring',
            '    7. Greenhouse gas storage assessment',
            sep,
          ],
        },
        formationSection(params),
        caprockSection(params),
        wellsSection(wells),
      ]
      if (result) s.push(resultsSection(result))
      return s
    },
  },

  MY: {
    id: 'MY',
    name: 'Malaysia CCUS Act 2025 — Storage Licence',
    jurisdiction: 'Malaysia (Federal Offshore)',
    regulator: 'MyCCUS Agency',
    legislation: 'CCUS Act 2025 (gazetted 1 October 2025)',
    sections(params, wells, result) {
      const s: PermitSection[] = [
        {
          title: 'REGULATORY FRAMEWORK',
          lines: [
            sep,
            '  PROGRAMME:           Malaysia CCUS Regulatory Framework',
            '  AUTHORITY:           MyCCUS Agency (Carbon Capture, Utilisation and Storage Agency)',
            '  LEGISLATION:         CCUS Act 2025 (gazetted 1 October 2025)',
            '  JURISDICTION:        Federal Offshore — Peninsular Malaysia & Sabah Federal Waters',
            '',
            '  NOTE: This template applies to FEDERAL OFFSHORE projects only.',
            '  Sarawak offshore projects (e.g. Kasawari) fall under the Sarawak Land Code',
            '  (Amendment) 2022 and Sarawak CCUS Ordinance 2023. Select MY-SAR for those.',
            '',
            '  PERMIT TYPES UNDER THE CCUS ACT 2025:',
            '    1. Offshore Assessment Permit  — 3-year site assessment authorisation',
            '    2. Storage Licence             — commercial injection and long-term storage',
            '',
            '  KEY REQUIREMENTS:',
            '    1. MyCCUS Agency as named licensing authority (not PETRONAS Tech Standards)',
            '    2. Storage complex characterisation (formation + caprock + seal integrity)',
            '    3. Monitoring plan commitment with corrective measures protocol',
            '    4. Three-year geological assessment timeline (Assessment Permit phase)',
            '    5. Financial assurance mechanism before injection commences',
            '    6. Post-injection site care — minimum 20 years',
            '    7. CO\u2082 stream composition documentation (\u226595% purity)',
            '    8. Public disclosure and consultation record',
            sep,
          ],
        },
        {
          title: 'OFFSHORE ASSESSMENT PERMIT — REQUIRED FIELDS (CCUS ACT 2025)',
          lines: [
            sep,
            l('Permit Authority', 'MyCCUS Agency'),
            l('Permit Type', 'Offshore Assessment Permit'),
            l('Assessment Duration', '3 years'),
            l('Permit Area Coordinates', '[Specify bounding polygon — lat/lon WGS84]'),
            l('Geological Assessment Methods', 'Seismic survey + well log + core analysis'),
            l('Target Formation', `${params.geometryType} @ ${params.depth} m TVD`),
            l('Intended Storage Complex', `${params.area} km\u00b2 \u00d7 ${params.thickness} m`),
            l('Intended Assessment Timeline', 'Year 1: seismic; Year 2: well; Year 3: report'),
            sep,
          ],
        },
        {
          title: 'STORAGE LICENCE — REQUIRED FIELDS (CCUS ACT 2025)',
          lines: [
            sep,
            l('Permit Authority', 'MyCCUS Agency'),
            l('Permit Type', 'Storage Licence'),
            l('Storage Complex', `${params.geometryType} — ${params.depth} m depth, ${params.area} km\u00b2`),
            l('Characterisation Report', 'Attached — formation + caprock + seal'),
            l('Monitoring Plan', 'Committed — 4D seismic + wellhead pressure + InSAR'),
            l('Corrective Measures Protocol', 'Committed — well intervention + pressure bleed-off'),
            l('Post-Injection Monitoring', 'Minimum 20 years after injection cessation'),
            sep,
          ],
        },
        {
          title: 'FEE SCHEDULE (CCUS ACT 2025)',
          lines: [
            sep,
            l('Assessment Permit Fee', 'RM 80,000'),
            l('Storage Licence Fee', 'RM 120,000'),
            l('Annual Renewal', 'To be confirmed by MyCCUS Agency'),
            sep,
          ],
        },
        formationSection(params),
        caprockSection(params),
        wellsSection(wells),
      ]
      if (result) s.push(resultsSection(result))
      return s
    },
  },

  MY_SAR: {
    id: 'MY_SAR',
    name: 'Sarawak CCUS Ordinance 2023 — Storage Permit',
    jurisdiction: 'Malaysia (Sarawak Offshore)',
    regulator: 'Sarawak Energy & Natural Resources Ministry / PETROS',
    legislation: 'Sarawak Land Code (Amendment) 2022 & Sarawak CCUS Ordinance 2023',
    sections(params, wells, result) {
      const s: PermitSection[] = [
        {
          title: 'REGULATORY FRAMEWORK',
          lines: [
            sep,
            '  PROGRAMME:           Sarawak CCUS Regulatory Framework',
            '  AUTHORITY:           Sarawak Ministry of Energy & Natural Resources',
            '                       (Operational licensing administered by PETROS)',
            '  LEGISLATION:         Sarawak Land Code (Amendment) 2022',
            '                       Sarawak CCUS Ordinance 2023',
            '  JURISDICTION:        Sarawak Offshore — Kasawari, Duyong, Penyu Basin',
            '',
            '  NOTE: The Malaysian CCUS Act 2025 (Federal) does NOT apply to Sarawak',
            '  offshore projects under this framework. This template reflects the',
            '  Sarawak-specific regulatory regime only.',
            '',
            '  KEY REQUIREMENTS:',
            '    1. PETROS as operator-of-record for Sarawak offshore CCS blocks',
            '    2. Sarawak-specific site characterisation report (NREB-compliant EIA)',
            '    3. Storage complex monitoring plan — 4D seismic + wellhead + marine survey',
            '    4. Environmental Impact Assessment under Sarawak NREB',
            '    5. Financial bond or parent company guarantee before injection start',
            '    6. Post-closure obligations per Sarawak CCUS Ordinance 2023',
            '    7. Coordinated monitoring with Sarawak National Parks if near MPAs',
            sep,
          ],
        },
        formationSection(params),
        caprockSection(params),
        wellsSection(wells),
      ]
      if (result) s.push(resultsSection(result))
      return s
    },
  },
}

export const DEFAULT_JURISDICTION = 'US'

export function renderPermitReport(
  template: PermitTemplate,
  params: FormationParams,
  wells: Well[],
  result: SimulationResult | null,
): string {
  const now = new Date()
  const header = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║              CarbonLens — Permit Application Report          ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `  Template:        ${template.name}`,
    `  Jurisdiction:    ${template.jurisdiction}`,
    `  Regulator:       ${template.regulator}`,
    `  Legislation:     ${template.legislation}`,
    `  Report Date:     ${now.toISOString().slice(0, 10)}`,
    `  Report Time:     ${now.toISOString().slice(11, 19)} UTC`,
    '',
  ]

  const body = template.sections(params, wells, result).flatMap(s => [
    '',
    `  ┌─ ${s.title}`,
    ...s.lines,
  ])

  const footer = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    '║  This report is generated by CarbonLens for informational   ║',
    '║  purposes only. It does not constitute a legal permit       ║',
    '║  application. Consult the relevant regulatory authority     ║',
    '║  for official permit requirements.                          ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
  ]

  return [...header, ...body, ...footer].join('\n')
}
