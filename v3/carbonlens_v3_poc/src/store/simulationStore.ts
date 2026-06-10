import { create } from 'zustand'
import { SimulationResult, SimulationStatus, GeomechanicsResult, FormationParams } from '../types'
import type { GeomechValidation } from '../hooks/useSimulation'

interface SimulationState {
  status: SimulationStatus
  result: SimulationResult | null
  /** Frozen snapshot written once when animation reaches projectYears.
   *  Use this for exports — it never changes between button clicks. */
  completedResult: SimulationResult | null
  completedWells: import('../types').Well[] | null
  completedParams: import('../types').FormationParams | null
  geomechanics: GeomechanicsResult | null
  validation: GeomechValidation | null
  forceRun: boolean
  progress: number
  isAnimating: boolean
  animationSpeed: number
  baselineResult: SimulationResult | null
  baselineParams: FormationParams | null
  snapshots: Array<{year: number; dataUrl: string}>
  runSimulation: () => void
  setResult: (result: SimulationResult) => void
  setCompletedResult: (result: SimulationResult) => void
  setCompletedSnapshot: (result: SimulationResult, wells: import('../types').Well[], params: import('../types').FormationParams) => void
  setGeomechanics: (g: GeomechanicsResult) => void
  setValidation: (v: GeomechValidation | null) => void
  setForceRun: (f: boolean) => void
  startAnimation: () => void
  stopAnimation: () => void
  pauseAnimation: () => void
  resumeAnimation: () => void
  setAnimationSpeed: (speed: number) => void
  setBaseline: (result: SimulationResult, params: FormationParams) => void
  clearBaseline: () => void
  addSnapshot: (year: number, dataUrl: string) => void
  clearSnapshots: () => void
  reset: () => void
}

export const useSimulationStore = create<SimulationState>((set) => ({
  status: 'idle',
  result: null,
  completedResult: null,
  completedWells: null,
  completedParams: null,
  geomechanics: null,
  validation: null,
  forceRun: false,
  progress: 0,
  isAnimating: false,
  animationSpeed: 1,
  baselineResult: null,
  baselineParams: null,
  snapshots: [],

  // Clear completedResult when a new run starts so stale exports are not reused
  runSimulation: () => set({ status: 'running', progress: 0, snapshots: [], completedResult: null, completedWells: null, completedParams: null }),

  setResult: (result) => set({ result }),

  setCompletedResult: (result) => set({ completedResult: result }),

  setCompletedSnapshot: (result, wells, params) => set({ completedResult: result, completedWells: wells, completedParams: params }),

  setGeomechanics: (g) => set({ geomechanics: g }),

  setValidation: (v) => set({ validation: v }),

  setForceRun: (f) => set({ forceRun: f }),

  startAnimation: () => set({ isAnimating: true }),

  stopAnimation: () => set({ isAnimating: false, status: 'complete', progress: 100, forceRun: false }),

  /** Pause mid-run — keeps status 'running' so resume is possible. */
  pauseAnimation: () => set({ isAnimating: false }),

  /** Resume a paused run — restores isAnimating without touching other state. */
  resumeAnimation: () => set({ isAnimating: true }),

  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),

  setBaseline: (result, params) => set({ baselineResult: result, baselineParams: params }),

  clearBaseline: () => set({ baselineResult: null, baselineParams: null }),

  addSnapshot: (year, dataUrl) => set((s) => ({ snapshots: [...s.snapshots, { year, dataUrl }] })),

  clearSnapshots: () => set({ snapshots: [] }),

  reset: () => set({ status: 'idle', result: null, completedResult: null, completedWells: null, completedParams: null, geomechanics: null, validation: null, forceRun: false, progress: 0, isAnimating: false, baselineResult: null, baselineParams: null, snapshots: [] }),
}))
