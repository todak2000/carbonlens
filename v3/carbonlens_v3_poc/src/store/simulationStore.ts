import { create } from 'zustand'
import { SimulationResult, SimulationStatus, GeomechanicsResult } from '../types'
import type { GeomechValidation } from '../hooks/useSimulation'

interface SimulationState {
  status: SimulationStatus
  result: SimulationResult | null
  geomechanics: GeomechanicsResult | null
  validation: GeomechValidation | null
  forceRun: boolean
  progress: number
  isAnimating: boolean
  animationSpeed: number
  runSimulation: () => void
  setResult: (result: SimulationResult) => void
  setGeomechanics: (g: GeomechanicsResult) => void
  setValidation: (v: GeomechValidation | null) => void
  setForceRun: (f: boolean) => void
  startAnimation: () => void
  stopAnimation: () => void
  setAnimationSpeed: (speed: number) => void
  reset: () => void
}

export const useSimulationStore = create<SimulationState>((set) => ({
  status: 'idle',
  result: null,
  geomechanics: null,
  validation: null,
  forceRun: false,
  progress: 0,
  isAnimating: false,
  animationSpeed: 1,

  runSimulation: () => set({ status: 'running', progress: 0 }),

  setResult: (result) => set({ result }),

  setGeomechanics: (g) => set({ geomechanics: g }),

  setValidation: (v) => set({ validation: v }),

  setForceRun: (f) => set({ forceRun: f }),

  startAnimation: () => set({ isAnimating: true }),

  stopAnimation: () => set({ isAnimating: false, status: 'complete', progress: 100, forceRun: false }),

  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),

  reset: () => set({ status: 'idle', result: null, geomechanics: null, validation: null, forceRun: false, progress: 0, isAnimating: false }),
}))
