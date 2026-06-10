import { StorageProject, Well } from '../types'

export function defaultWell(index: number): Well {
  return {
    id: `well-${index}`,
    x: 0.5 + index * 0.15,
    z: 0.5,
    injectionRate: 1.0,
    label: `Well ${index + 1}`,
    rampUpYears: 5,
    rampDownYears: 10,
  }
}

export function createDefaultProject(): StorageProject {
  return {
    id: crypto.randomUUID(),
    name: 'New Storage Project',
    description: '',
    formation: {
      depth: 2000,
      thickness: 100,
      porosity: 0.2,
      permeability: 500,
      pressure: 20,
      temperature: 60,
      monovalentSalinity: 0.12,
      bivalentSalinity: 0.03,
      saltType: 'Mixed',
      methaneFraction: 0,
      nitrogenFraction: 0,
      area: 10,
      geometryType: 'anticline',
      netToGross: 0.75,
      caprockFriction: 30,
      caprockCohesion: 7.5,
      biotCoefficient: 0.74,
    },
    wells: [defaultWell(0)],
    jurisdiction: 'US',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    simulationResult: null,
    geomechanicsResult: {
      capRockStress: 0, fracturePressure: 0, safetyFactor: 0,
      inducedSeismicityRisk: 'low', faultSlipPotential: 0, surfaceHeave: 0,
      mohrSafetyMargin: 0, dcff: 0, frictionAngle: 30, cohesion: 7.5,
      biotCoefficient: 0.74, overburdenStress: 0, minHorizontalStress: 0,
      mohrFailed: false, maip: 0, maipMargin: 0, pressureFrontRadius: 0,
    },
    visibility: 'private',
    tags: [],
  }
}
