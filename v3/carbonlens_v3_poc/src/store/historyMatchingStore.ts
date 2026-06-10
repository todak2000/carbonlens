import { create } from 'zustand';
import type {
  MatchableParams,
  ObservationData,
  MisfitResult,
  OptimizationResult,
  SensitivityResult,
} from '../engine/historyMatching/types';
import {
  DEFAULT_MATCHABLE_PARAMS,
} from '../engine/historyMatching/types';

interface HistoryMatchingState {
  matchableParams: MatchableParams;
  observations: ObservationData;
  misfitResult: MisfitResult | null;
  optimizationResult: OptimizationResult | null;
  sensitivityResults: SensitivityResult[];
  isOptimizing: boolean;
  activeSweepParam: keyof MatchableParams | null;

  setMatchableParam: (key: keyof MatchableParams, value: number) => void;
  setObservations: (obs: ObservationData) => void;
  setMisfitResult: (result: MisfitResult) => void;
  setOptimizationResult: (result: OptimizationResult) => void;
  setSensitivityResults: (results: SensitivityResult[]) => void;
  setIsOptimizing: (v: boolean) => void;
  setActiveSweepParam: (param: keyof MatchableParams | null) => void;
  resetToDefaults: () => void;
  applyOptimizedParams: () => void;
}

export const useHistoryMatchingStore = create<HistoryMatchingState>((set, get) => ({
  matchableParams: { ...DEFAULT_MATCHABLE_PARAMS },
  observations: {},
  misfitResult: null,
  optimizationResult: null,
  sensitivityResults: [],
  isOptimizing: false,
  activeSweepParam: null,

  setMatchableParam: (key, value) =>
    set(s => ({ matchableParams: { ...s.matchableParams, [key]: value } })),
  setObservations: obs => set({ observations: obs }),
  setMisfitResult: result => set({ misfitResult: result }),
  setOptimizationResult: result => set({ optimizationResult: result }),
  setSensitivityResults: results => set({ sensitivityResults: results }),
  setIsOptimizing: v => set({ isOptimizing: v }),
  setActiveSweepParam: param => set({ activeSweepParam: param }),
  resetToDefaults: () => set({ matchableParams: { ...DEFAULT_MATCHABLE_PARAMS }, misfitResult: null }),
  applyOptimizedParams: () => {
    const { optimizationResult } = get();
    if (optimizationResult) {
      set({ matchableParams: { ...optimizationResult.bestFit } });
    }
  },
}));
