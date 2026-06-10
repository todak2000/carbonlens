import { FormationParams } from '../types'

export interface FormationPreset {
  name: string
  location: string
  description: string
  jurisdiction: string
  params: FormationParams
}

export const FORMATION_PRESETS: FormationPreset[] = [
  {
    name: 'Sleipner Utsira',
    location: 'North Sea, Norway',
    description: 'Saline aquifer, ~200 Bt storage potential. World\'s longest-running CCS project.',
    jurisdiction: 'EU',
    params: {
      depth: 1012, thickness: 200, porosity: 0.37, permeability: 3000,
      pressure: 10.3, temperature: 37, monovalentSalinity: 0.05,
      bivalentSalinity: 0, saltType: 'NaCl', methaneFraction: 0, nitrogenFraction: 0,
      area: 27, geometryType: 'dome', netToGross: 0.9,
      caprockFriction: 26, caprockCohesion: 6, biotCoefficient: 0.7,
    },
  },
  {
    name: 'Mount Simon',
    location: 'Illinois Basin, USA',
    description: 'Deep saline formation, ~150 Bt capacity. Extensive characterization from DOE projects.',
    jurisdiction: 'US',
    params: {
      depth: 2134, thickness: 152, porosity: 0.15, permeability: 500,
      pressure: 21.3, temperature: 52, monovalentSalinity: 0.22,
      bivalentSalinity: 0.03, saltType: 'Mixed', methaneFraction: 0.02, nitrogenFraction: 0.01,
      area: 35, geometryType: 'layered', netToGross: 0.75,
      caprockFriction: 28, caprockCohesion: 7, biotCoefficient: 0.72,
    },
  },
  {
    name: 'Snøhvit Tubåen',
    location: 'Barents Sea, Norway',
    description: 'Saline aquifer, Equinor-operated. Low permeability compared to Sleipner.',
    jurisdiction: 'EU',
    params: {
      depth: 2600, thickness: 75, porosity: 0.13, permeability: 150,
      pressure: 28, temperature: 90, monovalentSalinity: 0.08,
      bivalentSalinity: 0, saltType: 'NaCl', methaneFraction: 0, nitrogenFraction: 0,
      area: 12, geometryType: 'anticline', netToGross: 0.7,
      caprockFriction: 30, caprockCohesion: 8, biotCoefficient: 0.75,
    },
  },
  {
    name: 'Gorgon',
    location: 'Barrow Island, Australia',
    description: 'Silty-sandstone formation, Chevron-operated. High residual trapping potential.',
    jurisdiction: 'AU',
    params: {
      depth: 2300, thickness: 100, porosity: 0.18, permeability: 200,
      pressure: 23, temperature: 65, monovalentSalinity: 0.12,
      bivalentSalinity: 0.03, saltType: 'Mixed', methaneFraction: 0.01, nitrogenFraction: 0,
      area: 20, geometryType: 'anticline', netToGross: 0.65,
      caprockFriction: 32, caprockCohesion: 9, biotCoefficient: 0.76,
    },
  },
  {
    // Johansen CO2 Storage Project — IEA GHG (2009); Eigestad et al. (2009)
    // DOI: 10.1016/j.ijggc.2009.02.009
    name: 'Johansen',
    location: 'Norwegian North Sea, offshore Bergen, Norway',
    description: 'Lower Jurassic saline aquifer. EU benchmark storage site. ~1 Gt capacity. Dunlin shale caprock (excellent seal).',
    jurisdiction: 'EU',
    params: {
      depth: 2700, thickness: 150, porosity: 0.25, permeability: 300,
      pressure: 28.5, temperature: 98, monovalentSalinity: 0.60,
      bivalentSalinity: 0, saltType: 'NaCl', methaneFraction: 0, nitrogenFraction: 0,
      area: 100, geometryType: 'anticline', netToGross: 0.85,
      caprockFriction: 27, caprockCohesion: 8, biotCoefficient: 0.75,
    },
  },
  {
    name: 'In Salah',
    location: 'Central Algeria',
    description: 'Gas field CO₂ storage. Low-permeability fractured carbonate reservoir.',
    jurisdiction: 'EU',
    params: {
      depth: 1800, thickness: 50, porosity: 0.12, permeability: 50,
      pressure: 18, temperature: 85, monovalentSalinity: 0.3,
      bivalentSalinity: 0.05, saltType: 'CaCl2', methaneFraction: 0.03, nitrogenFraction: 0,
      area: 5, geometryType: 'fault', netToGross: 0.6,
      caprockFriction: 25, caprockCohesion: 5, biotCoefficient: 0.68,
    },
  },
  {
    name: 'Kasawari',
    location: 'Sarawak, Malaysia',
    description: 'Carbonate gas field, PETRONAS. Target injection ~2027. High CO₂ content gas.',
    jurisdiction: 'MY',
    params: {
      depth: 1300, thickness: 90, porosity: 0.2, permeability: 800,
      pressure: 13.5, temperature: 45, monovalentSalinity: 0.1,
      bivalentSalinity: 0.02, saltType: 'Mixed', methaneFraction: 0.05, nitrogenFraction: 0.02,
      area: 15, geometryType: 'anticline', netToGross: 0.8,
      caprockFriction: 28, caprockCohesion: 6.5, biotCoefficient: 0.72,
    },
  },
  {
    name: 'Duyong',
    location: 'Terengganu, Malaysia',
    description: 'Depleted gas field, first Malaysian CCS permit (Nov 2025).',
    jurisdiction: 'MY',
    params: {
      depth: 1500, thickness: 70, porosity: 0.22, permeability: 600,
      pressure: 15, temperature: 50, monovalentSalinity: 0.09,
      bivalentSalinity: 0.01, saltType: 'Mixed', methaneFraction: 0.04, nitrogenFraction: 0.01,
      area: 8, geometryType: 'anticline', netToGross: 0.78,
      caprockFriction: 29, caprockCohesion: 7, biotCoefficient: 0.73,
    },
  },
  {
    name: 'Otway',
    location: 'Victoria, Australia',
    description: 'CO2CRC research site. Well-characterized saline aquifer with extensive monitoring.',
    jurisdiction: 'AU',
    params: {
      depth: 2000, thickness: 40, porosity: 0.17, permeability: 350,
      pressure: 20, temperature: 75, monovalentSalinity: 0.25,
      bivalentSalinity: 0.03, saltType: 'Mixed', methaneFraction: 0.01, nitrogenFraction: 0,
      area: 3, geometryType: 'layered', netToGross: 0.72,
      caprockFriction: 31, caprockCohesion: 7.5, biotCoefficient: 0.74,
    },
  },
  // ── Global South formations — democratisation narrative ─────────────────────
  {
    // Malay Basin saline aquifer — South China Sea, offshore Peninsular Malaysia
    // Refs: PETRONAS Annual Report (2023); Ramli et al. (2020) IJGGC; PCPP Phase 2 screening study
    name: 'Malay Basin',
    location: 'South China Sea, Malaysia',
    description: 'Tertiary saline aquifer, South China Sea. Underpins Malaysia\'s CCUS roadmap. ~8 Gt regional storage potential.',
    jurisdiction: 'MY',
    params: {
      depth: 1500, thickness: 50, porosity: 0.25, permeability: 250,
      pressure: 15.0, temperature: 75, monovalentSalinity: 0.20,
      bivalentSalinity: 0.02, saltType: 'NaCl', methaneFraction: 0.03, nitrogenFraction: 0.01,
      area: 120, geometryType: 'anticline', netToGross: 0.65,
      caprockFriction: 28, caprockCohesion: 6.5, biotCoefficient: 0.73,
    },
  },
  {
    // Niger Delta — Agbada Formation saline sandstone, onshore/shallow offshore Nigeria
    // Refs: Imasuen et al. (2011) J. Appl. Sci.; NUPRC CCS assessment (2022); IEA Africa CCS roadmap
    name: 'Niger Delta',
    location: 'Niger Delta, Nigeria',
    description: 'High-permeability Agbada sandstone saline aquifer. Nigeria\'s primary CCS target. Addresses gas flaring (~15 Mt CO₂-eq/yr).',
    jurisdiction: 'EU',
    params: {
      depth: 1800, thickness: 60, porosity: 0.30, permeability: 800,
      pressure: 18.0, temperature: 80, monovalentSalinity: 0.35,
      bivalentSalinity: 0.02, saltType: 'NaCl', methaneFraction: 0.04, nitrogenFraction: 0.01,
      area: 250, geometryType: 'layered', netToGross: 0.70,
      caprockFriction: 26, caprockCohesion: 5.5, biotCoefficient: 0.71,
    },
  },
  {
    // North Sumatra Basin — Baong/Peutu Formation saline sandstone, Indonesia
    // Refs: Dahlan et al. (2019) IPA; SKK Migas CCS Framework (2021); MEMR CCS Roadmap Indonesia
    name: 'North Sumatra Basin',
    location: 'Northern Sumatra, Indonesia',
    description: 'Miocene sandstone saline aquifer. Largest SE Asian developing-world CO₂ storage potential. ~50 Gt estimated capacity.',
    jurisdiction: 'EU',
    params: {
      depth: 1600, thickness: 45, porosity: 0.22, permeability: 200,
      pressure: 16.0, temperature: 78, monovalentSalinity: 0.45,
      bivalentSalinity: 0.03, saltType: 'NaCl', methaneFraction: 0.02, nitrogenFraction: 0.01,
      area: 180, geometryType: 'layered', netToGross: 0.55,
      caprockFriction: 27, caprockCohesion: 6.0, biotCoefficient: 0.72,
    },
  },
  {
    // Nile Delta — Miocene-Pliocene sandstone saline aquifer, Northern Egypt
    // Refs: El-Gohary et al. (2015) EAGE; Arab Organization for Mineral Resources CCS scoping study
    // Messinian evaporite caprock (anhydrite/salt) — exceptional seal quality
    name: 'Nile Delta',
    location: 'Northern Egypt',
    description: 'Miocene sandstone saline aquifer beneath Messinian evaporite caprock (anhydrite/salt). High seal integrity. Gulf-adjacent geopolitical relevance.',
    jurisdiction: 'EU',
    params: {
      depth: 2200, thickness: 70, porosity: 0.24, permeability: 300,
      pressure: 22.0, temperature: 90, monovalentSalinity: 0.70,
      bivalentSalinity: 0.05, saltType: 'Mixed', methaneFraction: 0.01, nitrogenFraction: 0,
      area: 350, geometryType: 'dome', netToGross: 0.62,
      caprockFriction: 35, caprockCohesion: 12.0, biotCoefficient: 0.65,
    },
  },
  // ── Middle East, Europe, Americas — deep-pocket markets ─────────────────────
  {
    // Abu Dhabi Basin — deep saline sandstone / Jurassic Arab Formation, UAE
    // Refs: Al Reyadah CCS project (ADNOC/Masdar 2016); Abubakar et al. (2018) SPE-192717;
    //       IEA CCS Progress Report (2021); ADNOC CCS Masterplan 2030
    name: 'Abu Dhabi Basin',
    location: 'Abu Dhabi, UAE',
    description: 'Deep saline sandstone / Arab Formation carbonate. Home of Al Reyadah CCS — first CCS facility in MENA. ADNOC 2030 CCS target: 10 Mt/yr.',
    jurisdiction: 'EU',
    params: {
      depth: 2800, thickness: 80, porosity: 0.16, permeability: 120,
      pressure: 28.0, temperature: 110, monovalentSalinity: 1.80,
      bivalentSalinity: 0.12, saltType: 'Mixed', methaneFraction: 0.02, nitrogenFraction: 0.01,
      area: 500, geometryType: 'anticline', netToGross: 0.58,
      caprockFriction: 33, caprockCohesion: 10.0, biotCoefficient: 0.67,
    },
  },
  {
    // Rotterdam / North Sea — Bunter Sandstone (P18 block), Porthos CCS project, Netherlands
    // Refs: Van der Meer et al. (2000) IJGGC; Porthos CCS FID (2023); TNO CO2 Atlas North Sea
    // Europe's flagship live CCS project; FID 2023; pipeline operational 2026
    name: 'Rotterdam / North Sea',
    location: 'North Sea, Netherlands',
    description: 'Permian Bunter Sandstone saline aquifer (P18 block). Porthos CCS project — EU\'s flagship live CCS project (FID 2023). 37 Mt total storage target.',
    jurisdiction: 'EU',
    params: {
      depth: 3100, thickness: 65, porosity: 0.22, permeability: 120,
      pressure: 31.0, temperature: 108, monovalentSalinity: 2.20,
      bivalentSalinity: 0.10, saltType: 'Mixed', methaneFraction: 0, nitrogenFraction: 0,
      area: 300, geometryType: 'layered', netToGross: 0.68,
      caprockFriction: 30, caprockCohesion: 9.0, biotCoefficient: 0.74,
    },
  },
  {
    // Alberta Basin — Basal Cambrian Sandstone (BCS), Quest CCS project, Canada
    // Refs: Shell Quest CCS Project (2015–); Gunter et al. (2004) IJGGC; AER CCS Regulatory Framework
    // ADNOC co-owns Quest — direct link to Abu Dhabi preset (narrative thread)
    name: 'Alberta Basin',
    location: 'Alberta, Canada',
    description: 'Basal Cambrian Sandstone saline aquifer. Quest CCS project (Shell / ADNOC co-owned) — most-published MVA dataset in the Americas. >8 Mt injected.',
    jurisdiction: 'EU',
    params: {
      depth: 2200, thickness: 50, porosity: 0.14, permeability: 50,
      pressure: 22.0, temperature: 75, monovalentSalinity: 2.80,
      bivalentSalinity: 0.15, saltType: 'Mixed', methaneFraction: 0.01, nitrogenFraction: 0,
      area: 2000, geometryType: 'layered', netToGross: 0.65,
      caprockFriction: 29, caprockCohesion: 8.0, biotCoefficient: 0.73,
    },
  },
]
