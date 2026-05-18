import { create } from 'zustand'
import { Jurisdiction, ColorProperty } from '../types'

type Panel = 'properties' | 'formation' | 'simulation' | 'geomechanics' | 'economics' | 'leakage' | 'screening' | 'jurisdiction' | 'export' | 'overview' | 'registry'
type Theme = 'dark' | 'light'
type View = 'landing' | 'auth' | 'dashboard' | 'workspace'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('carbonlens_theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {}
  return 'dark'
}

interface UIState {
  view: View
  sidebarOpen: boolean
  activePanel: Panel
  jurisdiction: Jurisdiction
  unitSystem: 'metric' | 'imperial'
  show3D: boolean
  showStressField: boolean
  theme: Theme
  colorProperty: ColorProperty
  customBlendPrimary: ColorProperty
  customBlendSecondary: ColorProperty
  customBlendWeight: number
  timestep: number
  projectYears: number
  showPressureField: boolean
  warningCount: number
  blowoutActive: boolean
  setProjectYears: (y: number) => void
  setView: (v: View) => void
  setSidebar: (open: boolean) => void
  setPanel: (panel: Panel) => void
  setJurisdiction: (j: Jurisdiction) => void
  toggleUnits: () => void
  toggle3D: () => void
  toggleTheme: () => void
  setColorProperty: (p: ColorProperty) => void
  setCustomBlend: (primary: ColorProperty, secondary: ColorProperty, weight: number) => void
  setTimestep: (t: number) => void
  toggleStressField: () => void
  togglePressureField: () => void
  incrementWarning: () => void
  setBlowout: (active: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  view: 'landing',
  sidebarOpen: true,
  activePanel: 'overview',
  jurisdiction: 'US',
  unitSystem: 'metric',
  show3D: true,
  showStressField: false,
  theme: getInitialTheme(),
  colorProperty: 'porosity',
  customBlendPrimary: 'porosity',
  customBlendSecondary: 'permeability',
  customBlendWeight: 0.5,
  timestep: 1,
  projectYears: 50,
  showPressureField: true,
  warningCount: 0,
  blowoutActive: false,
  setProjectYears: (y) => set({ projectYears: y }),
  setView: (v) => set({ view: v }),
  setSidebar: (open) => set({ sidebarOpen: open }),
  setPanel: (panel) => set({ activePanel: panel }),
  setJurisdiction: (j) => set({ jurisdiction: j }),
  toggleUnits: () => set((s) => ({ unitSystem: s.unitSystem === 'metric' ? 'imperial' : 'metric' })),
  toggle3D: () => set((s) => ({ show3D: !s.show3D })),
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('carbonlens_theme', next)
    return { theme: next }
  }),
  setColorProperty: (p) => set({ colorProperty: p }),
  setCustomBlend: (primary, secondary, weight) => set({ customBlendPrimary: primary, customBlendSecondary: secondary, customBlendWeight: weight }),
  setTimestep: (t) => set({ timestep: t }),
  toggleStressField: () => set((s) => ({ showStressField: !s.showStressField })),
  togglePressureField: () => set((s) => ({ showPressureField: !s.showPressureField })),
  incrementWarning: () => set((s) => ({ warningCount: s.warningCount + 1 })),
  setBlowout: (active) => set({ blowoutActive: active, warningCount: active ? 0 : 0 }),
}))
