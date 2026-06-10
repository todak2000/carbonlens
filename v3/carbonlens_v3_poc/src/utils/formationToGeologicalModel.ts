/**
 * Converts flat FormationParams into a GeologicalModel for the 3D grid solver.
 *
 * General conversion: creates a 2-zone model (caprock + reservoir).
 * Named presets get specific multi-zone overrides that match the real geology.
 */

import { GeologicalModel, StratigraphicZone } from '../types/geological'
import { FormationParams } from '../types'
import { LITHOLOGY_DEFAULTS } from '../data/lithologyDefaults'

function zoneId(suffix: string): string {
  return `auto_${suffix}_${Math.random().toString(36).slice(2, 7)}`
}

function makeZone(overrides: Partial<StratigraphicZone> & Pick<StratigraphicZone, 'name' | 'lithology' | 'topDepth' | 'thickness'>): StratigraphicZone {
  const d = LITHOLOGY_DEFAULTS[overrides.lithology]
  return {
    id: zoneId(overrides.name.toLowerCase().replace(/\s+/g, '_')),
    netToGross: 0.85,
    porosityMean: d.porosityDefault,
    porosityStdDev: 0.03,
    kHorizontal: d.kDefault,
    kVerticalRatio: d.kvkhDefault,
    capillaryEntryPressure: d.capillaryEntryPressureDefault,
    wettability: 'water_wet' as const,
    horizonShape: 'flat' as const,
    horizonParams: {},
    xMin: -1, xMax: 1,
    yMin: -1, yMax: 1,
    activeForInjection: !overrides.isCaprock,
    isCaprock: false,
    color: d.color,
    ...overrides,
  }
}

/** Generic 2-zone model: caprock + reservoir */
function genericModel(params: FormationParams): GeologicalModel {
  const reservoirTop = params.depth
  const capThickness = Math.max(20, params.thickness * 0.25)
  const capTopDepth = reservoirTop - capThickness

  return {
    zones: [
      makeZone({
        name: 'Caprock',
        lithology: 'shale',
        topDepth: capTopDepth,
        thickness: capThickness,
        isCaprock: true,
        activeForInjection: false,
        porosityMean: 0.05,
        kHorizontal: 0.001,
        capillaryEntryPressure: 5.0,
        netToGross: 1.0,
      }),
      makeZone({
        name: 'Reservoir',
        lithology: 'sandstone',
        topDepth: reservoirTop,
        thickness: params.thickness,
        netToGross: params.netToGross,
        porosityMean: params.porosity,
        kHorizontal: params.permeability,
        kVerticalRatio: 0.1,
      }),
    ],
    faults: [],
    modelWidthM: Math.sqrt(params.area * 1e6),
    modelLengthM: Math.sqrt(params.area * 1e6),
  }
}

/** Sleipner Utsira Formation — 9 sand layers separated by thin mudstones */
function sleipnerModel(): GeologicalModel {
  const zones: StratigraphicZone[] = []

  // Top caprock (Nordland shale)
  zones.push(makeZone({
    name: 'Nordland Shale (Caprock)',
    lithology: 'shale',
    topDepth: 800,
    thickness: 200,
    isCaprock: true,
    activeForInjection: false,
    porosityMean: 0.05,
    kHorizontal: 4e-7,
    kVerticalRatio: 0.1,
    capillaryEntryPressure: 8.0,
    netToGross: 1.0,
  }))

  // 9 Utsira sand layers with thin mudstone baffles
  const sandPorosity = 0.32
  const sandK = 2000
  const mudK = 1.15e-4
  const layerThicknessM = 20

  for (let i = 9; i >= 1; i--) {
    const layerDepth = 1000 + (9 - i) * 22
    if (i < 9) {
      zones.push(makeZone({
        name: `Mudstone Baffle ${i}/${i + 1}`,
        lithology: 'siltstone',
        topDepth: layerDepth - 2,
        thickness: 2,
        isCaprock: false,
        activeForInjection: false,
        porosityMean: 0.12,
        kHorizontal: mudK,
        kVerticalRatio: 0.01,
        capillaryEntryPressure: 1.5,
        netToGross: 1.0,
      }))
    }
    zones.push(makeZone({
      name: `Utsira Sand Layer ${i}`,
      lithology: 'sandstone',
      topDepth: layerDepth,
      thickness: layerThicknessM,
      porosityMean: sandPorosity,
      kHorizontal: sandK,
      kVerticalRatio: 0.3,
      netToGross: 0.90,
      capillaryEntryPressure: 0.03,
    }))
  }

  return {
    zones,
    faults: [],
    modelWidthM: 10000,
    modelLengthM: 10000,
  }
}

/** Otway Basin (Australia) — continental saline aquifer */
function otwayModel(params: FormationParams): GeologicalModel {
  return {
    zones: [
      makeZone({ name: 'Flaxman Fm (Caprock)', lithology: 'shale',      topDepth: params.depth - 50, thickness: 50, isCaprock: true, activeForInjection: false, kHorizontal: 0.002, capillaryEntryPressure: 4.0, netToGross: 1.0 }),
      makeZone({ name: 'Waarre Fm C (Reservoir)', lithology: 'sandstone', topDepth: params.depth, thickness: params.thickness, porosityMean: params.porosity, kHorizontal: params.permeability }),
    ],
    faults: [],
    modelWidthM: 3000,
    modelLengthM: 3000,
  }
}

/** In Salah (Algeria) — tight fluvial sandstone, 3 horizontal wells */
function inSalahModel(params: FormationParams): GeologicalModel {
  return {
    zones: [
      makeZone({ name: 'Mudstone Caprock',    lithology: 'shale',            topDepth: params.depth - 80, thickness: 80, isCaprock: true, activeForInjection: false, kHorizontal: 0.0001, capillaryEntryPressure: 6.0, netToGross: 1.0 }),
      makeZone({ name: 'Krechba Fm (Reservoir)', lithology: 'arkosic_sandstone', topDepth: params.depth, thickness: params.thickness, porosityMean: params.porosity, kHorizontal: params.permeability }),
    ],
    faults: [],
    modelWidthM: 20000,
    modelLengthM: 8000,
  }
}

/** Map preset IDs to their specific geological model builders */
const PRESET_MODEL_BUILDERS: Record<string, (params: FormationParams) => GeologicalModel> = {
  sleipner: () => sleipnerModel(),
  otway:    (p) => otwayModel(p),
  in_salah: (p) => inSalahModel(p),
  'in-salah': (p) => inSalahModel(p),
}

/**
 * Convert FormationParams to GeologicalModel.
 * @param params  Flat formation parameters
 * @param presetId  Optional preset ID for named formations (e.g. 'sleipner')
 */
export function formationParamsToGeologicalModel(
  params: FormationParams,
  presetId?: string,
): GeologicalModel {
  const id = presetId?.toLowerCase()
  const builder = id ? PRESET_MODEL_BUILDERS[id] : undefined
  return builder ? builder(params) : genericModel(params)
}
