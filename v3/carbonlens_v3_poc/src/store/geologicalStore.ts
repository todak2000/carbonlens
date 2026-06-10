import { create } from 'zustand'
import { GeologicalModel, StratigraphicZone, FaultDefinition, LithologyType } from '../types/geological'
import { LITHOLOGY_DEFAULTS } from '../data/lithologyDefaults'
import { sanitizeZoneChanges, sanitizeFaultChanges } from '../utils/validateParams'

function makeDefaultZone(overrides: Partial<StratigraphicZone> = {}): StratigraphicZone {
  return {
    id: `zone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: 'Reservoir Zone',
    lithology: 'sandstone',
    topDepth: 2000,
    thickness: 100,
    netToGross: 0.75,
    porosityMean: 0.22,
    porosityStdDev: 0.04,
    kHorizontal: 300,
    kVerticalRatio: 0.15,
    capillaryEntryPressure: 0.05,
    wettability: 'water_wet',
    horizonShape: 'flat',
    horizonParams: {},
    xMin: -1, xMax: 1,
    yMin: -1, yMax: 1,
    activeForInjection: true,
    isCaprock: false,
    color: '#d4a96a',
    ...overrides,
  }
}

function makeDefaultCaprock(topDepth: number): StratigraphicZone {
  const d = LITHOLOGY_DEFAULTS['shale']
  return {
    id: `zone_caprock_${Date.now()}`,
    name: 'Caprock',
    lithology: 'shale',
    topDepth: topDepth - 50,
    thickness: 50,
    netToGross: 1.0,
    porosityMean: d.porosityDefault,
    porosityStdDev: 0.02,
    kHorizontal: d.kDefault,
    kVerticalRatio: d.kvkhDefault,
    capillaryEntryPressure: d.capillaryEntryPressureDefault,
    wettability: 'water_wet',
    horizonShape: 'flat',
    horizonParams: {},
    xMin: -1, xMax: 1,
    yMin: -1, yMax: 1,
    activeForInjection: false,
    isCaprock: true,
    color: d.color,
  }
}

const DEFAULT_MODEL: GeologicalModel = {
  zones: [
    makeDefaultCaprock(2000),
    makeDefaultZone({ name: 'Primary Reservoir', topDepth: 2000, thickness: 100 }),
  ],
  faults: [],
  modelWidthM: 10000,
  modelLengthM: 10000,
}

interface GeologicalState {
  model: GeologicalModel
  selectedZoneId: string | null
  selectedFaultId: string | null

  setModel: (model: GeologicalModel) => void
  addZone: (lithology?: LithologyType) => void
  updateZone: (id: string, changes: Partial<StratigraphicZone>) => void
  removeZone: (id: string) => void
  reorderZones: (fromIndex: number, toIndex: number) => void
  applyLithologyDefaults: (id: string, lithology: LithologyType) => void

  addFault: () => void
  updateFault: (id: string, changes: Partial<FaultDefinition>) => void
  removeFault: (id: string) => void

  selectZone: (id: string | null) => void
  selectFault: (id: string | null) => void

  setModelDimensions: (widthM: number, lengthM: number) => void
  reset: () => void
}

export const useGeologicalStore = create<GeologicalState>((set) => ({
  model: { ...DEFAULT_MODEL, zones: [...DEFAULT_MODEL.zones], faults: [] },
  selectedZoneId: null,
  selectedFaultId: null,

  setModel: (model) => set({ model }),

  addZone: (lithology = 'sandstone') => set((s) => {
    const d = LITHOLOGY_DEFAULTS[lithology]
    const lastZone = s.model.zones[s.model.zones.length - 1]
    const newTopDepth = lastZone ? lastZone.topDepth + lastZone.thickness + 10 : 2000
    const newZone = makeDefaultZone({
      name: `${d.label} Zone`,
      lithology,
      topDepth: newTopDepth,
      porosityMean: d.porosityDefault,
      kHorizontal: d.kDefault,
      kVerticalRatio: d.kvkhDefault,
      capillaryEntryPressure: d.capillaryEntryPressureDefault,
      color: d.color,
      isCaprock: lithology === 'shale' || lithology === 'anhydrite',
      activeForInjection: lithology !== 'shale' && lithology !== 'anhydrite',
    })
    return {
      model: { ...s.model, zones: [...s.model.zones, newZone] },
      selectedZoneId: newZone.id,
    }
  }),

  updateZone: (id, changes) => set((s) => ({
    model: {
      ...s.model,
      zones: s.model.zones.map((z) => z.id === id ? { ...z, ...sanitizeZoneChanges(changes as Record<string, unknown>) } : z),
    },
  })),

  removeZone: (id) => set((s) => ({
    model: { ...s.model, zones: s.model.zones.filter((z) => z.id !== id) },
    selectedZoneId: s.selectedZoneId === id ? null : s.selectedZoneId,
  })),

  reorderZones: (fromIndex, toIndex) => set((s) => {
    const zones = [...s.model.zones]
    const [moved] = zones.splice(fromIndex, 1)
    zones.splice(toIndex, 0, moved)
    return { model: { ...s.model, zones } }
  }),

  applyLithologyDefaults: (id, lithology) => set((s) => {
    const d = LITHOLOGY_DEFAULTS[lithology]
    return {
      model: {
        ...s.model,
        zones: s.model.zones.map((z) => z.id === id ? {
          ...z,
          lithology,
          porosityMean: d.porosityDefault,
          porosityStdDev: 0.03,
          kHorizontal: d.kDefault,
          kVerticalRatio: d.kvkhDefault,
          capillaryEntryPressure: d.capillaryEntryPressureDefault,
          color: d.color,
          isCaprock: lithology === 'shale' || lithology === 'anhydrite',
          activeForInjection: lithology !== 'shale' && lithology !== 'anhydrite',
        } : z),
      },
    }
  }),

  addFault: () => set((s) => {
    const fault: FaultDefinition = {
      id: `fault_${Date.now()}`,
      name: `Fault ${s.model.faults.length + 1}`,
      positionX: 0.5,
      positionY: 0.5,
      strike: 45,
      dip: 70,
      throw: 50,
      length: 2000,
      sealingFactor: 0.8,
      claySmearFactor: 0.5,
      faultZoneThickness: 2,
    }
    return {
      model: { ...s.model, faults: [...s.model.faults, fault] },
      selectedFaultId: fault.id,
    }
  }),

  updateFault: (id, changes) => set((s) => ({
    model: {
      ...s.model,
      faults: s.model.faults.map((f) => f.id === id ? { ...f, ...sanitizeFaultChanges(changes as Record<string, unknown>) } : f),
    },
  })),

  removeFault: (id) => set((s) => ({
    model: { ...s.model, faults: s.model.faults.filter((f) => f.id !== id) },
    selectedFaultId: s.selectedFaultId === id ? null : s.selectedFaultId,
  })),

  selectZone: (id) => set({ selectedZoneId: id }),
  selectFault: (id) => set({ selectedFaultId: id }),

  setModelDimensions: (widthM, lengthM) => set((s) => ({
    model: { ...s.model, modelWidthM: widthM, modelLengthM: lengthM },
  })),

  reset: () => set({
    model: { ...DEFAULT_MODEL, zones: [...DEFAULT_MODEL.zones], faults: [] },
    selectedZoneId: null,
    selectedFaultId: null,
  }),
}))
