import { create } from 'zustand'
import { FormationParams, GeometryType, SaltType, Well, LasState } from '../types'
import { GridFileData } from '../utils/gridParser'

function getWellPosition(idx: number): [number, number] {
  const angle = (idx / 5) * Math.PI * 2 - Math.PI / 2
  return [1.0 * Math.cos(angle), 1.0 * Math.sin(angle)]
}

interface FormationState {
  params: FormationParams
  wells: Well[]
  las: LasState | null
  gridData: GridFileData | null
  wellCounter: number
  setParams: (partial: Partial<FormationParams>) => void
  setGeometry: (type: GeometryType) => void
  setSaltType: (type: SaltType) => void
  setMonovalent: (val: number) => void
  setBivalent: (val: number) => void
  reset: () => void
  load: (params: FormationParams, wells?: Well[]) => void
  addWell: () => void
  removeWell: (id: string) => void
  setWells: (wells: Well[]) => void
  updateWellRate: (id: string, rate: number) => void
  updateWellPosition: (id: string, x: number, z: number) => void
  updateWellLabel: (id: string, label: string) => void
  updateWellSchedule: (id: string, rampUp: number, rampDown: number) => void
  setLas: (las: LasState | null) => void
  setGridData: (data: GridFileData | null) => void
}

const DEFAULTS: FormationParams = {
  depth: 2000,
  thickness: 100,
  porosity: 0.2,
  permeability: 500,
  pressure: 20,
  temperature: 60,
  salinity: 0.15,
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
}

const DEFAULT_WELLS: Well[] = [{
  id: 'w1', x: getWellPosition(0)[0], z: getWellPosition(0)[1],
  injectionRate: 0.05, label: 'Well 1', rampUpYears: 5, rampDownYears: 10,
}]

export const useFormationStore = create<FormationState>((set) => ({
  params: { ...DEFAULTS },
  wells: [...DEFAULT_WELLS],
  las: null,
  gridData: null,
  wellCounter: 1,

  setParams: (partial) => set((s) => ({
    params: { ...s.params, ...partial },
  })),

  setGeometry: (type) => set((s) => ({
    params: { ...s.params, geometryType: type },
  })),

  setSaltType: (type) => {
    const defaults: Record<SaltType, { mono: number; bi: number }> = {
      NaCl: { mono: 0.15, bi: 0 },
      CaCl2: { mono: 0, bi: 0.15 },
      Mixed: { mono: 0.12, bi: 0.03 },
    }
    const d = defaults[type]
    set((s) => ({
      params: { ...s.params, saltType: type, monovalentSalinity: d.mono, bivalentSalinity: d.bi },
    }))
  },

  setMonovalent: (val) => set((s) => ({
    params: { ...s.params, monovalentSalinity: val, saltType: val > 0 && s.params.bivalentSalinity > 0 ? 'Mixed' : val > 0 ? 'NaCl' : s.params.bivalentSalinity > 0 ? 'CaCl2' : 'Mixed' },
  })),

  setBivalent: (val) => set((s) => ({
    params: { ...s.params, bivalentSalinity: val, saltType: val > 0 && s.params.monovalentSalinity > 0 ? 'Mixed' : val > 0 ? 'CaCl2' : s.params.monovalentSalinity > 0 ? 'NaCl' : 'Mixed' },
  })),

  reset: () => set({ params: { ...DEFAULTS }, wells: [...DEFAULT_WELLS], las: null, wellCounter: 1 }),

  load: (params, wells) => set({
    params: { ...params },
    wells: wells ? [...wells] : [...DEFAULT_WELLS],
    wellCounter: wells ? wells.length : 1,
  }),

  addWell: () => set((s) => {
    if (s.wells.length >= 5) return s
    const idx = s.wells.length
    const pos = getWellPosition(idx)
    const counter = s.wellCounter + 1
    const newWell: Well = {
      id: `w${Date.now()}`,
      x: pos[0],
      z: pos[1],
      injectionRate: 0.05,
      label: `Well ${counter}`,
      rampUpYears: 5,
      rampDownYears: 10,
    }
    return { wells: [...s.wells, newWell], wellCounter: counter }
  }),

  removeWell: (id) => set((s) => ({
    wells: s.wells.filter((w) => w.id !== id),
  })),

  setWells: (wells) => set({ wells }),

  updateWellRate: (id, rate) => set((s) => ({
    wells: s.wells.map((w) => w.id === id ? { ...w, injectionRate: rate } : w),
  })),

  updateWellPosition: (id, x, z) => set((s) => ({
    wells: s.wells.map((w) => w.id === id ? { ...w, x, z } : w),
  })),

  updateWellLabel: (id, label) => set((s) => ({
    wells: s.wells.map((w) => w.id === id ? { ...w, label } : w),
  })),

  updateWellSchedule: (id, rampUp, rampDown) => set((s) => ({
    wells: s.wells.map((w) => w.id === id ? { ...w, rampUpYears: rampUp, rampDownYears: rampDown } : w),
  })),

  setLas: (las) => set({ las }),
  setGridData: (data) => set({ gridData: data }),
}))
