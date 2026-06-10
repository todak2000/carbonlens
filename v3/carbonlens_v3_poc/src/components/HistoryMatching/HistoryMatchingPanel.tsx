/**
 * HistoryMatchingPanel — Main UI for the History Matching feature.
 *
 * Sections:
 *  1. Tunable Parameters — sliders for each MatchableParam
 *  2. Observation Data — Sleipner analogue or custom import
 *  3. Misfit Score — gauge + component table
 *  4. Assisted Matching — optimizer button
 *  5. Sensitivity — one-at-a-time sweep
 */

import { useCallback } from 'react';
import { Activity, RefreshCw, TrendingUp, Sliders, BarChart2, Database } from 'lucide-react';
import { useHistoryMatchingStore } from '../../store/historyMatchingStore';
import { useFormationStore } from '../../store/formationStore';
import {
  MATCHABLE_PARAM_BOUNDS,
  MATCHABLE_PARAM_LABELS,
} from '../../engine/historyMatching/types';
import type { MatchableParams } from '../../engine/historyMatching/types';
import { computeMisfit } from '../../engine/historyMatching/misfit';
import { nelderMead } from '../../engine/historyMatching/optimizer';
import { oneAtATimeSweep } from '../../engine/historyMatching/sensitivity';
import MisfitGauge from './MisfitGauge';
import MisfitChart from './MisfitChart';
import ParameterSweep from './ParameterSweep';
import ObservationImport from './ObservationImport';

export default function HistoryMatchingPanel() {
  const store = useHistoryMatchingStore();
  const formation = useFormationStore(s => s.params);

  const {
    matchableParams,
    observations,
    misfitResult,
    optimizationResult,
    sensitivityResults,
    isOptimizing,
    activeSweepParam,
    setMatchableParam,
    setObservations,
    setMisfitResult,
    setOptimizationResult,
    setSensitivityResults,
    setIsOptimizing,
    setActiveSweepParam,
    resetToDefaults,
    applyOptimizedParams,
  } = store;

  // Recompute misfit whenever a param changes
  const recomputeMisfit = useCallback((params: MatchableParams) => {
    if (!observations.plumeAreaVsTime && !observations.plumeRadiusTargets &&
        !observations.injectionPressureVsTime && !observations.co2DensityTarget) {
      return;
    }
    const result = computeMisfit(params, formation, observations, 0.9);
    setMisfitResult(result);
  }, [observations, formation, setMisfitResult]);

  const handleParamChange = useCallback((key: keyof MatchableParams, value: number) => {
    setMatchableParam(key, value);
    const updated = { ...matchableParams, [key]: value };
    recomputeMisfit(updated);
  }, [matchableParams, setMatchableParam, recomputeMisfit]);

  const handleObservationsChange = useCallback((obs: typeof observations) => {
    setObservations(obs);
    // Recompute immediately with new observations
    const hasObs = obs.plumeAreaVsTime || obs.plumeRadiusTargets ||
      obs.injectionPressureVsTime || obs.co2DensityTarget;
    if (hasObs) {
      const result = computeMisfit(matchableParams, formation, obs, 0.9);
      setMisfitResult(result);
    }
  }, [matchableParams, formation, setObservations, setMisfitResult]);

  const runOptimizer = useCallback(async () => {
    if (isOptimizing) return;
    setIsOptimizing(true);
    // Run in a microtask to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10));
    try {
      const result = nelderMead(
        matchableParams,
        MATCHABLE_PARAM_BOUNDS,
        formation,
        observations,
        { maxIterations: 80, tolerance: 1e-4, method: 'nelderMead' },
      );
      setOptimizationResult(result);
      // Update misfit with best fit
      const best = computeMisfit(result.bestFit, formation, observations, 0.9);
      setMisfitResult(best);
    } finally {
      setIsOptimizing(false);
    }
  }, [isOptimizing, matchableParams, formation, observations,
      setIsOptimizing, setOptimizationResult, setMisfitResult]);

  const runSweep = useCallback(async () => {
    if (!activeSweepParam) return;
    const bounds = MATCHABLE_PARAM_BOUNDS[activeSweepParam];
    const result = oneAtATimeSweep(
      matchableParams, activeSweepParam, bounds, 20, formation, observations,
    );
    setSensitivityResults([result]);
  }, [activeSweepParam, matchableParams, formation, observations, setSensitivityResults]);

  const activeSweepResult = sensitivityResults.find(r => r.param === activeSweepParam) ?? null;

  const hasObservations = !!(
    observations.plumeAreaVsTime?.length ||
    observations.plumeRadiusTargets?.length ||
    observations.injectionPressureVsTime?.length ||
    observations.co2DensityTarget
  );

  return (
    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={13} className="text-accent" />
            History Matching
          </h2>
          <p className="text-[9px] text-muted font-mono mt-0.5">
            Calibrate reservoir parameters against field observations
          </p>
        </div>
        <button
          onClick={resetToDefaults}
          title="Reset parameters to defaults"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-tertiary text-muted"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {/* ── Section 1: Tunable Parameters ─────────────────────────────────── */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1">
          <Sliders size={11} /> Tunable Parameters
        </h3>
        <div className="space-y-2 bg-tertiary/30 rounded p-2 border border-theme/20">
          {(Object.keys(MATCHABLE_PARAM_LABELS) as Array<keyof MatchableParams>).map(key => {
            const [lo, hi] = MATCHABLE_PARAM_BOUNDS[key];
            const val = matchableParams[key];
            const label = MATCHABLE_PARAM_LABELS[key];
            const isLog = key === 'permeability';
            const step = isLog ? 10 : (hi - lo) / 200;

            return (
              <div key={key}>
                <label className="text-[9px] text-muted font-mono flex justify-between">
                  <span>{label}</span>
                  <span className="text-secondary">
                    {val > 10 ? val.toFixed(0) : val.toFixed(3)}
                  </span>
                </label>
                <input
                  type="range"
                  min={lo}
                  max={hi}
                  step={step}
                  value={val}
                  onChange={e => handleParamChange(key, parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full accent-blue-500 bg-tertiary appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[7px] text-muted/60 font-mono">
                  <span>{lo}</span>
                  <span>{hi}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Observation Data ────────────────────────────────────── */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1">
          <Database size={11} /> Observation Data
        </h3>
        <div className="bg-tertiary/30 rounded p-2 border border-theme/20">
          <ObservationImport
            onObservationsChange={handleObservationsChange}
            currentObservations={observations}
          />
        </div>
      </div>

      {/* ── Section 3: Misfit Score ────────────────────────────────────────── */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1">
          <BarChart2 size={11} /> Misfit Score
        </h3>
        <div className="bg-tertiary/30 rounded p-2 border border-theme/20 space-y-2">
          {!hasObservations ? (
            <p className="text-[9px] text-muted/60 font-mono text-center py-2">
              Load observations to compute misfit
            </p>
          ) : (
            <>
              {/* Gauge */}
              <div className="flex justify-center">
                <MisfitGauge misfit={misfitResult?.totalMisfit ?? 0} />
              </div>

              {/* Validity */}
              {misfitResult && !misfitResult.isValid && (
                <div className="rounded px-2 py-1 bg-error border border-error text-error text-[8px] font-mono space-y-0.5">
                  {misfitResult.validationMessages.map((msg, i) => (
                    <div key={i}>⚠ {msg}</div>
                  ))}
                </div>
              )}

              {/* Component table */}
              {misfitResult && Object.keys(misfitResult.componentMisfits).length > 0 && (
                <div className="text-[9px] font-mono space-y-0.5">
                  <div className="flex justify-between text-muted text-[8px] border-b border-theme/20 pb-0.5">
                    <span>Observable</span>
                    <span>RMSE</span>
                  </div>
                  {Object.entries(misfitResult.componentMisfits).map(([key, comp]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-muted">{comp.name}</span>
                      <span className={`font-bold ${comp.value < 0.2 ? 'text-success' : comp.value < 0.5 ? 'text-warning' : 'text-error'}`}>
                        {comp.value.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Chart */}
              {misfitResult && misfitResult.simulatedResults.length > 0 && (
                <MisfitChart
                  observationData={observations}
                  simulatedResults={misfitResult.simulatedResults}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Section 4: Assisted Matching ──────────────────────────────────── */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1">
          <TrendingUp size={11} /> Assisted Matching
        </h3>
        <div className="bg-tertiary/30 rounded p-2 border border-theme/20 space-y-2">
          {!hasObservations && (
            <p className="text-[8px] text-warning font-mono">Load observations before optimizing</p>
          )}
          <button
            onClick={runOptimizer}
            disabled={isOptimizing || !hasObservations}
            className={`w-full py-1.5 text-[10px] font-mono rounded border transition flex items-center justify-center gap-1.5
              ${isOptimizing || !hasObservations
                ? 'border-theme/20 text-muted/50 cursor-not-allowed bg-tertiary/20'
                : 'border-accent/30 bg-accent/20 text-accent hover:bg-accent/30'
              }`}
          >
            {isOptimizing ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Optimizing...
              </>
            ) : (
              'Run Optimizer (Nelder-Mead)'
            )}
          </button>

          {optimizationResult && (
            <div className="space-y-1.5">
              <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20 text-[9px] font-mono space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted">Best Misfit</span>
                  <span className={`font-bold ${optimizationResult.bestMisfit < 0.2 ? 'text-success' : optimizationResult.bestMisfit < 0.5 ? 'text-warning' : 'text-error'}`}>
                    {optimizationResult.bestMisfit.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Iterations</span>
                  <span className="text-secondary">{optimizationResult.iterations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Converged</span>
                  <span className={optimizationResult.converged ? 'text-success' : 'text-warning'}>
                    {optimizationResult.converged ? 'Yes' : 'No (max iter)'}
                  </span>
                </div>
              </div>
              <button
                onClick={applyOptimizedParams}
                className="w-full py-1.5 text-[10px] font-mono rounded border border-success/30 bg-success/10 text-success hover:bg-success/20 transition"
              >
                Apply Best Fit Parameters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 5: Sensitivity ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1">
          <Activity size={11} /> Sensitivity Analysis
        </h3>
        <div className="bg-tertiary/30 rounded p-2 border border-theme/20 space-y-2">
          <div className="flex gap-1.5 items-center">
            <select
              value={activeSweepParam ?? ''}
              onChange={e => setActiveSweepParam((e.target.value as keyof MatchableParams) || null)}
              className="flex-1 text-[9px] font-mono bg-tertiary/50 border border-theme/30 rounded px-1 py-1 text-secondary"
            >
              <option value="">Select parameter…</option>
              {(Object.keys(MATCHABLE_PARAM_LABELS) as Array<keyof MatchableParams>).map(k => (
                <option key={k} value={k}>{MATCHABLE_PARAM_LABELS[k]}</option>
              ))}
            </select>
            <button
              onClick={runSweep}
              disabled={!activeSweepParam || !hasObservations}
              className={`px-2 py-1 text-[9px] font-mono rounded border transition
                ${!activeSweepParam || !hasObservations
                  ? 'border-theme/20 text-muted/50 cursor-not-allowed'
                  : 'border-accent/30 text-accent hover:bg-accent/20'
                }`}
            >
              Run Sweep
            </button>
          </div>

          <ParameterSweep
            result={activeSweepResult}
            currentValue={activeSweepParam ? matchableParams[activeSweepParam] : 0}
            paramLabel={activeSweepParam ? MATCHABLE_PARAM_LABELS[activeSweepParam] : ''}
          />
        </div>
      </div>
    </div>
  );
}
