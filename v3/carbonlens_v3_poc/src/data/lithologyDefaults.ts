import { LithologyType, LithologyDefaults } from '../types/geological'

export const LITHOLOGY_DEFAULTS: Record<LithologyType, LithologyDefaults> = {
  sandstone: {
    porosityMin: 0.15, porosityMax: 0.35, porosityDefault: 0.22,
    kMin: 10, kMax: 3000, kDefault: 300,
    kvkhDefault: 0.15,
    capillaryEntryPressureDefault: 0.05,
    color: '#d4a96a',
    label: 'Sandstone',
    description: 'Clastic reservoir rock. Good injectivity and structural trapping.',
    mineralTrapPotential: 'low',
  },
  arkosic_sandstone: {
    porosityMin: 0.12, porosityMax: 0.25, porosityDefault: 0.18,
    kMin: 5, kMax: 500, kDefault: 100,
    kvkhDefault: 0.10,
    capillaryEntryPressureDefault: 0.10,
    color: '#c4936a',
    label: 'Arkosic Sandstone',
    description: 'Feldspar-rich sandstone. High mineral trapping via feldspar → calcite.',
    mineralTrapPotential: 'high',
  },
  limestone: {
    porosityMin: 0.05, porosityMax: 0.25, porosityDefault: 0.15,
    kMin: 1, kMax: 500, kDefault: 80,
    kvkhDefault: 0.05,
    capillaryEntryPressureDefault: 0.50,
    color: '#e8e0c8',
    label: 'Limestone',
    description: 'Carbonate reservoir. Strong mineral trapping via calcite precipitation.',
    mineralTrapPotential: 'high',
  },
  dolomite: {
    porosityMin: 0.05, porosityMax: 0.20, porosityDefault: 0.12,
    kMin: 0.1, kMax: 100, kDefault: 20,
    kvkhDefault: 0.03,
    capillaryEntryPressureDefault: 1.00,
    color: '#c8b89a',
    label: 'Dolomite',
    description: 'Tight carbonate. Moderate mineral trapping, low injectivity.',
    mineralTrapPotential: 'moderate',
  },
  chalk: {
    porosityMin: 0.20, porosityMax: 0.45, porosityDefault: 0.32,
    kMin: 0.1, kMax: 10, kDefault: 2,
    kvkhDefault: 0.01,
    capillaryEntryPressureDefault: 2.00,
    color: '#f0ece0',
    label: 'Chalk',
    description: 'High porosity but very low permeability. Poor injectivity.',
    mineralTrapPotential: 'low',
  },
  siltstone: {
    porosityMin: 0.10, porosityMax: 0.20, porosityDefault: 0.14,
    kMin: 0.01, kMax: 5, kDefault: 0.5,
    kvkhDefault: 0.005,
    capillaryEntryPressureDefault: 3.00,
    color: '#a89880',
    label: 'Siltstone',
    description: 'Fine-grained clastic. Acts as vertical baffle to CO2 migration.',
    mineralTrapPotential: 'low',
  },
  shale: {
    porosityMin: 0.30, porosityMax: 0.70, porosityDefault: 0.45,
    kMin: 0.00001, kMax: 0.001, kDefault: 0.0001,
    kvkhDefault: 0.001,
    capillaryEntryPressureDefault: 10.00,
    color: '#5a5a6e',
    label: 'Shale / Clay',
    description: 'Impermeable caprock or seal. Zero effective transmissibility.',
    mineralTrapPotential: 'none',
  },
  anhydrite: {
    porosityMin: 0.00, porosityMax: 0.02, porosityDefault: 0.01,
    kMin: 0.00001, kMax: 0.0001, kDefault: 0.00005,
    kvkhDefault: 0.001,
    capillaryEntryPressureDefault: 25.00,
    color: '#d4c8e8',
    label: 'Anhydrite',
    description: 'Perfect caprock seal. Extremely high capillary entry pressure.',
    mineralTrapPotential: 'none',
  },
}

export const LITHOLOGY_ORDER: LithologyType[] = [
  'sandstone', 'arkosic_sandstone', 'limestone', 'dolomite',
  'chalk', 'siltstone', 'shale', 'anhydrite',
]

export function getDefaultZoneColor(lithology: LithologyType): string {
  return LITHOLOGY_DEFAULTS[lithology].color
}
