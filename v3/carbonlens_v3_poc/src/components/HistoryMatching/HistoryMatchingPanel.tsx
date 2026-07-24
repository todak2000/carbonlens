import { useCallback } from 'react';
import { Activity, RefreshCw, TrendingUp, Sliders, BarChart2, Database, CheckCircle2, RotateCcw, ArrowRightCircle } from 'lucide-react';
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
  const setFormationParams = useFormationStore(s => s.setParams);

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
    previousFormationSnapshot,
    isAppliedToFormation,
    applyToFormation,
    revertFormation,
  } = store;

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
      const best = computeMisfit(result.bestFit, formation, observations, 0.9);
      setMisfitResult(best);
    } catch (e) {
      console.error(e);
    } finally {
      setIsOptimizing(false);
    }
  }, [matchableParams, formation, observations, isOptimizing,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme/20 pb-4">
        <div>
          <h2 className="text-xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={18} className="text-accent" /> History Matching &amp; Parameter Calibration
          </h2>
          <p className="text-xs text-muted font-mono mt-0.5">
            Calibrate model parameters against field observations (4D seismic, pressure logs)
          </p>
        </div>
        <button
          onClick={resetToDefaults}
          title="Reset parameters to defaults"
          className="px-2.5 py-1.5 flex items-center justify-center rounded-lg border border-theme/20 hover:bg-tertiary text-muted text-xs gap-1.5"
        >
          <RefreshCw size={12} />
          Reset Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sliders, Import, Optimization (60% width equivalent: col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Tunable Parameters */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2 flex items-center gap-1.5">
              <Sliders size={13} /> 1. Tunable Calibration Parameters
            </h3>
            <div className="space-y-4 bg-tertiary/20 rounded-lg p-3 border border-theme/10">
              {(Object.keys(MATCHABLE_PARAM_LABELS) as Array<keyof MatchableParams>).map(key => {
                const [lo, hi] = MATCHABLE_PARAM_BOUNDS[key];
                const val = matchableParams[key];
                const label = MATCHABLE_PARAM_LABELS[key];
                const isLog = key === 'permeability';
                const step = isLog ? 10 : (hi - lo) / 200;

                return (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs text-muted font-mono flex justify-between">
                      <span>{label}</span>
                      <span className="text-secondary font-bold">
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
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex justify-between text-[9px] text-muted/60 font-mono">
                      <span>{lo}</span>
                      <span>{hi}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Observation Import */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2 flex items-center gap-1.5">
              <Database size={13} /> 2. Field Observation Imports
            </h3>
            <div className="bg-tertiary/20 rounded-lg p-3 border border-theme/10">
              <ObservationImport
                onObservationsChange={handleObservationsChange}
                currentObservations={observations}
              />
            </div>
          </div>

          {/* Section 3: Optimization */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2 flex items-center gap-1.5">
              <TrendingUp size={13} /> 3. Assisted History Matching
            </h3>
            <div className="space-y-3">
              {!hasObservations && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning font-mono">
                  ⚠ Please load or import field observations before running the calibration optimizer.
                </div>
              )}
              <button
                onClick={runOptimizer}
                disabled={isOptimizing || !hasObservations}
                className={`w-full py-2.5 rounded-lg border transition font-mono font-bold text-xs flex items-center justify-center gap-2
                  ${isOptimizing || !hasObservations
                    ? 'border-theme/20 text-muted/50 cursor-not-allowed bg-tertiary/10'
                    : 'border-accent bg-accent text-white hover:bg-accent-hover'
                  }`}
              >
                {isOptimizing ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Executing Calibration (Nelder-Mead)...
                  </>
                ) : (
                  'Run Optimization Engine'
                )}
              </button>

              {optimizationResult && (
                <div className="space-y-3 pt-2">
                  <div className="rounded-lg p-3 border border-theme/30 bg-tertiary/20 text-xs font-mono space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted">Best-fit Misfit:</span>
                      <span className={`font-bold ${optimizationResult.bestMisfit < 0.2 ? 'text-success' : optimizationResult.bestMisfit < 0.5 ? 'text-warning' : 'text-error'}`}>
                        {optimizationResult.bestMisfit.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Iterations:</span>
                      <span className="text-secondary">{optimizationResult.iterations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Convergence achieved:</span>
                      <span className={optimizationResult.converged ? 'text-success font-bold' : 'text-warning font-bold'}>
                        {optimizationResult.converged ? 'Yes' : 'No (limit reached)'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={applyOptimizedParams}
                    className="w-full py-2 rounded-lg border border-success/30 bg-success/15 text-success hover:bg-success/20 font-mono font-bold text-xs transition"
                  >
                    Apply Best Fit Parameters
                  </button>

                  <div className="pt-3 border-t border-theme/20 space-y-2">
                    {!isAppliedToFormation ? (
                      <button
                        onClick={() => {
                          applyToFormation({ permeability: formation.permeability, porosity: formation.porosity, netToGross: formation.netToGross });
                          setFormationParams({
                            permeability: matchableParams.permeability,
                            porosity: matchableParams.porosity,
                            netToGross: matchableParams.netToGross,
                          });
                        }}
                        className="w-full py-2.5 rounded-lg border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 font-mono font-bold text-xs transition flex items-center justify-center gap-2"
                      >
                        <ArrowRightCircle size={14} />
                        Apply to Project Reservoir Model
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 bg-success/10 border border-success/30 rounded-lg p-3 text-xs text-success font-mono">
                          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                          <span>Parameters updated successfully in the global model. Run the Stage 3 simulation to inspect changes.</span>
                        </div>
                        <button
                          onClick={() => {
                            if (previousFormationSnapshot) {
                              setFormationParams({ ...previousFormationSnapshot });
                            }
                            revertFormation();
                          }}
                          className="w-full py-2 rounded-lg border border-warning/40 bg-warning/5 text-warning hover:bg-warning/10 font-mono font-bold text-xs transition flex items-center justify-center gap-2"
                        >
                          <RotateCcw size={14} />
                          Revert to Original Formation Parameters
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Misfit Gauge & Charts, Sensitivity (40% width equivalent: col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Misfit score card */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-theme/10 pb-2">
              <BarChart2 size={13} /> Misfit Analytics
            </h3>
            
            {!hasObservations ? (
              <p className="text-xs text-muted/60 font-mono text-center py-4">
                Load observations to view calibration misfit
              </p>
            ) : (
              <div className="space-y-4">
                {/* Gauge */}
                <div className="flex justify-center py-2">
                  <MisfitGauge misfit={misfitResult?.totalMisfit ?? 0} />
                </div>

                {/* Validity */}
                {misfitResult && !misfitResult.isValid && (
                  <div className="rounded-lg p-3 bg-error/10 border border-error/30 text-error text-xs font-mono space-y-1">
                    {misfitResult.validationMessages.map((msg, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <span>⚠</span>
                        <span>{msg}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Component table */}
                {misfitResult && Object.keys(misfitResult.componentMisfits).length > 0 && (
                  <div className="text-xs font-mono space-y-1.5 border-t border-theme/10 pt-3">
                    <div className="flex justify-between text-muted text-[10px] uppercase font-bold border-b border-theme/10 pb-1">
                      <span>Observable</span>
                      <span>RMSE</span>
                    </div>
                    {Object.entries(misfitResult.componentMisfits).map(([key, comp]) => (
                      <div key={key} className="flex justify-between items-center py-0.5">
                        <span className="text-muted">{comp.name}</span>
                        <span className={`font-bold ${comp.value < 0.2 ? 'text-success' : comp.value < 0.5 ? 'text-warning' : 'text-error'}`}>
                          {comp.value.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chart */}
                {misfitResult && misfitResult.simulatedResults.length > 0 && (
                  <div className="pt-2 border-t border-theme/10">
                    <MisfitChart
                      observationData={observations}
                      simulatedResults={misfitResult.simulatedResults}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sensitivity Sweep */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-theme/10 pb-2">
              <Activity size={13} /> Parameter Sensitivity analysis
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <select
                  value={activeSweepParam ?? ''}
                  onChange={e => setActiveSweepParam((e.target.value as keyof MatchableParams) || null)}
                  className="flex-1 text-xs font-mono bg-tertiary border border-theme/30 rounded-lg px-2 py-1.5 text-secondary"
                >
                  <option value="">Select parameter...</option>
                  {(Object.keys(MATCHABLE_PARAM_LABELS) as Array<keyof MatchableParams>).map(k => (
                    <option key={k} value={k}>{MATCHABLE_PARAM_LABELS[k]}</option>
                  ))}
                </select>
                <button
                  onClick={runSweep}
                  disabled={!activeSweepParam || !hasObservations}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg border font-bold transition
                    ${!activeSweepParam || !hasObservations
                      ? 'border-theme/20 text-muted/50 cursor-not-allowed'
                      : 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
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
      </div>
    </div>
  );
}
