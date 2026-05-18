import { FormationParams } from '../types'

export interface FormationPreset {
  name: string
  location: string
  description: string
  params: FormationParams
}

export const FORMATION_PRESETS: FormationPreset[] = [
  {
    name: 'Sleipner Utsira',
    location: 'North Sea, Norway',
    description: 'Saline aquifer, ~200 Bt storage potential. World\'s longest-running CCS project.',
    params: {
      depth: 1012, thickness: 200, porosity: 0.37, permeability: 3000,
      pressure: 10.3, temperature: 37, salinity: 0.05, monovalentSalinity: 0.05,
      bivalentSalinity: 0, saltType: 'NaCl', methaneFraction: 0, nitrogenFraction: 0,
      area: 27, geometryType: 'dome', netToGross: 0.9,
      caprockFriction: 26, caprockCohesion: 6, biotCoefficient: 0.7,
    },
  },
  {
    name: 'Mount Simon',
    location: 'Illinois Basin, USA',
    description: 'Deep saline formation, ~150 Bt capacity. Extensive characterization from DOE projects.',
    params: {
      depth: 2134, thickness: 152, porosity: 0.15, permeability: 500,
      pressure: 21.3, temperature: 52, salinity: 0.25, monovalentSalinity: 0.22,
      bivalentSalinity: 0.03, saltType: 'Mixed', methaneFraction: 0.02, nitrogenFraction: 0.01,
      area: 35, geometryType: 'layered', netToGross: 0.75,
      caprockFriction: 28, caprockCohesion: 7, biotCoefficient: 0.72,
    },
  },
  {
    name: 'Snøhvit Tubåen',
    location: 'Barents Sea, Norway',
    description: 'Saline aquifer, Equinor-operated. Low permeability compared to Sleipner.',
    params: {
      depth: 2600, thickness: 75, porosity: 0.13, permeability: 150,
      pressure: 28, temperature: 90, salinity: 0.08, monovalentSalinity: 0.08,
      bivalentSalinity: 0, saltType: 'NaCl', methaneFraction: 0, nitrogenFraction: 0,
      area: 12, geometryType: 'anticline', netToGross: 0.7,
      caprockFriction: 30, caprockCohesion: 8, biotCoefficient: 0.75,
    },
  },
  {
    name: 'Gorgon',
    location: 'Barrow Island, Australia',
    description: 'Silty-sandstone formation, Chevron-operated. High residual trapping potential.',
    params: {
      depth: 2300, thickness: 100, porosity: 0.18, permeability: 200,
      pressure: 23, temperature: 65, salinity: 0.15, monovalentSalinity: 0.12,
      bivalentSalinity: 0.03, saltType: 'Mixed', methaneFraction: 0.01, nitrogenFraction: 0,
      area: 20, geometryType: 'anticline', netToGross: 0.65,
      caprockFriction: 32, caprockCohesion: 9, biotCoefficient: 0.76,
    },
  },
  {
    name: 'In Salah',
    location: 'Central Algeria',
    description: 'Gas field CO₂ storage. Low-permeability fractured carbonate reservoir.',
    params: {
      depth: 1800, thickness: 50, porosity: 0.12, permeability: 50,
      pressure: 18, temperature: 85, salinity: 0.35, monovalentSalinity: 0.3,
      bivalentSalinity: 0.05, saltType: 'CaCl2', methaneFraction: 0.03, nitrogenFraction: 0,
      area: 5, geometryType: 'fault', netToGross: 0.6,
      caprockFriction: 25, caprockCohesion: 5, biotCoefficient: 0.68,
    },
  },
  {
    name: 'Kasawari',
    location: 'Sarawak, Malaysia',
    description: 'Carbonate gas field, PETRONAS. Target injection ~2027. High CO₂ content gas.',
    params: {
      depth: 1300, thickness: 90, porosity: 0.2, permeability: 800,
      pressure: 13.5, temperature: 45, salinity: 0.12, monovalentSalinity: 0.1,
      bivalentSalinity: 0.02, saltType: 'Mixed', methaneFraction: 0.05, nitrogenFraction: 0.02,
      area: 15, geometryType: 'anticline', netToGross: 0.8,
      caprockFriction: 28, caprockCohesion: 6.5, biotCoefficient: 0.72,
    },
  },
  {
    name: 'Duyong',
    location: 'Terengganu, Malaysia',
    description: 'Depleted gas field, first Malaysian CCS permit (Nov 2025).',
    params: {
      depth: 1500, thickness: 70, porosity: 0.22, permeability: 600,
      pressure: 15, temperature: 50, salinity: 0.1, monovalentSalinity: 0.09,
      bivalentSalinity: 0.01, saltType: 'Mixed', methaneFraction: 0.04, nitrogenFraction: 0.01,
      area: 8, geometryType: 'anticline', netToGross: 0.78,
      caprockFriction: 29, caprockCohesion: 7, biotCoefficient: 0.73,
    },
  },
  {
    name: 'Otway',
    location: 'Victoria, Australia',
    description: 'CO2CRC research site. Well-characterized saline aquifer with extensive monitoring.',
    params: {
      depth: 2000, thickness: 40, porosity: 0.17, permeability: 350,
      pressure: 20, temperature: 75, salinity: 0.28, monovalentSalinity: 0.25,
      bivalentSalinity: 0.03, saltType: 'Mixed', methaneFraction: 0.01, nitrogenFraction: 0,
      area: 3, geometryType: 'layered', netToGross: 0.72,
      caprockFriction: 31, caprockCohesion: 7.5, biotCoefficient: 0.74,
    },
  },
]
