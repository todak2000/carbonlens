import { create } from 'zustand'
import { Jurisdiction, ColorProperty } from '../types'
import { db } from '../db/projectDb'

type Panel = 'properties' | 'formation' | 'geology' | 'simulation' | 'geomechanics' | 'economics' | 'leakage' | 'screening' | 'jurisdiction' | 'export' | 'overview' | 'registry' | 'methodology' | 'validation' | 'montecarlo' | 'monitoring'
type Theme = 'dark' | 'light'
type View = 'landing' | 'auth' | 'dashboard' | 'workspace' | 'analytics'
export type { Panel, Theme, View }

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('carbonlens_theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {}
  return 'dark'
}

interface StageCompletion {
  stage1: boolean   // project has name + country + formation type
  stage2: boolean   // formation screening confirmed by user
  stage3: boolean   // simulation complete
  stage4: boolean   // at least one analysis panel visited
  stage5: boolean   // always true after stage4 (report access)
}

const DEFAULT_STAGE_COMPLETION: StageCompletion = {
  stage1: false,
  stage2: false,
  stage3: false,
  stage4: false,
  stage5: false,
}

export type { StageCompletion }

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
  showGridView: boolean
  demoActive: boolean
  currentProjectId: string | null
  currentProjectName: string | null
  stageCompletion: StageCompletion
  setStageComplete: (stage: keyof StageCompletion, value: boolean) => void
  setStageCompleteAll: (stages: StageCompletion) => void
  saveCurrentProject: () => Promise<void>
  toggleGridView: () => void
  setDemoActive: (v: boolean) => void
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
  setCurrentProjectId: (id: string | null) => void
  setCurrentProjectName: (name: string | null) => void
  geologyExpanded: boolean
  toggleGeologyExpanded: () => void
}

const ANALYSIS_PANELS: Panel[] = ['monitoring', 'leakage', 'montecarlo']

export const useUIStore = create<UIState>((set, get) => ({
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
  showGridView: false,
  demoActive: false,
  currentProjectId: null,
  currentProjectName: null,
  geologyExpanded: true,
  stageCompletion: { ...DEFAULT_STAGE_COMPLETION },
  setStageComplete: (stage, value) => {
    set((s) => {
      const nextStageCompletion = { ...s.stageCompletion, [stage]: value }
      
      // If we are marking a stage as INCOMPLETE (value = false), cascade the lock to downstream stages
      if (!value) {
        if (stage === 'stage1') {
          nextStageCompletion.stage2 = false
          nextStageCompletion.stage3 = false
          nextStageCompletion.stage4 = false
          nextStageCompletion.stage5 = false
        } else if (stage === 'stage2') {
          nextStageCompletion.stage3 = false
          nextStageCompletion.stage4 = false
          nextStageCompletion.stage5 = false
        } else if (stage === 'stage3') {
          nextStageCompletion.stage4 = false
          nextStageCompletion.stage5 = false
        } else if (stage === 'stage4') {
          nextStageCompletion.stage5 = false
        }

        // Reset simulation store dynamically if simulation is invalidated
        if (stage === 'stage1' || stage === 'stage2' || stage === 'stage3') {
          import('./simulationStore')
            .then((m) => {
              m.useSimulationStore.getState().reset()
            })
            .catch((err) => console.error('Failed to reset simulation store:', err))
        }
      }
      
      return { stageCompletion: nextStageCompletion }
    })
    // Auto-save project stage changes
    get().saveCurrentProject()
  },
  setStageCompleteAll: (stages) => {
    set({ stageCompletion: { ...stages } })
  },
  saveCurrentProject: async () => {
    const { currentProjectId, jurisdiction, stageCompletion } = get()
    if (!currentProjectId) return
    try {
      const { useFormationStore } = await import('./formationStore')
      const { useSimulationStore } = await import('./simulationStore')
      const existing = await db.projects.get(currentProjectId)
      if (!existing) return

      const now = Date.now()
      const project = {
        ...existing,
        formation: { ...useFormationStore.getState().params },
        wells: [...useFormationStore.getState().wells],
        simulationResult: useSimulationStore.getState().result ? { ...useSimulationStore.getState().result } : null,
        geomechanicsResult: useSimulationStore.getState().geomechanics ? { ...useSimulationStore.getState().geomechanics } : null,
        jurisdiction,
        stageCompletion: { ...stageCompletion },
        updatedAt: now,
      }
      await db.projects.put(project as any)
    } catch (err) {
      console.error('Failed to save project:', err)
    }
  },
  toggleGridView: () => set((s) => ({ showGridView: !s.showGridView })),
  setDemoActive: (v) => set({ demoActive: v }),
  setProjectYears: (y) => set({ projectYears: y }),
  setView: (v) => set({ view: v }),
  setSidebar: (open) => set({ sidebarOpen: open }),
  setPanel: (panel) => {
    set({ activePanel: panel })
    const { stageCompletion } = get()
    if (ANALYSIS_PANELS.includes(panel) && stageCompletion.stage3) {
      set((s) => ({
        stageCompletion: { ...s.stageCompletion, stage4: true, stage5: true },
      }))
    }
  },
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
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  setCurrentProjectName: (name) => set({ currentProjectName: name }),
  toggleGeologyExpanded: () => set((s) => ({ geologyExpanded: !s.geologyExpanded })),
}))
