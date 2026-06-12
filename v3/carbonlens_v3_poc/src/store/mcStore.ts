import { create } from 'zustand'

export interface PersistedMCResult {
  p10_Mt: number
  p50_Mt: number
  p90_Mt: number
  p10_P: number
  p50_P: number
  p90_P: number
  realizations: number
  runTimeMs: number
  permUncertPct: number
  poroUncertAbs: number
  areaUncertPct: number
  thickUncertPct: number
  formationName: string
  ranAt: string  // ISO date string
}

interface MCStoreState {
  lastResult: PersistedMCResult | null
  setLastResult: (r: PersistedMCResult) => void
  clearResult: () => void
}

export const useMCStore = create<MCStoreState>((set) => ({
  lastResult: null,
  setLastResult: (r) => set({ lastResult: r }),
  clearResult: () => set({ lastResult: null }),
}))
