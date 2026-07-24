import { useState } from 'react';
import type { ObservationData } from '../../engine/historyMatching/types';
import { sleipnerObservations } from '../../engine/historyMatching/misfit';

interface ObservationImportProps {
  onObservationsChange: (obs: ObservationData) => void;
  currentObservations: ObservationData;
}

type TabKey = 'sleipner' | 'json' | 'manual';

export default function ObservationImport({ onObservationsChange, currentObservations }: ObservationImportProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('sleipner');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [manualRows, setManualRows] = useState<Array<{ year: string; value: string }>>([
    { year: '', value: '' },
  ]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'sleipner', label: 'Sleipner Analogue' },
    { key: 'json',     label: 'Paste JSON' },
    { key: 'manual',   label: 'Manual Entry' },
  ];

  function loadSleipner() {
    onObservationsChange(sleipnerObservations());
  }

  function parseJson() {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonText) as ObservationData;
      onObservationsChange(parsed);
    } catch (e) {
      setJsonError(`JSON parse error: ${String(e)}`);
    }
  }

  function updateManualRow(idx: number, field: 'year' | 'value', val: string) {
    const next = [...manualRows];
    next[idx] = { ...next[idx], [field]: val };
    // Auto-add new row when last row has content
    if (idx === manualRows.length - 1 && val.trim() !== '') {
      next.push({ year: '', value: '' });
    }
    setManualRows(next);
  }

  function applyManualRows() {
    const pts = manualRows
      .filter(r => r.year.trim() !== '' && r.value.trim() !== '')
      .map(r => ({ year: Number(r.year), value: Number(r.value), weight: 1.0 }))
      .filter(r => !isNaN(r.year) && !isNaN(r.value));
    if (pts.length > 0) {
      onObservationsChange({ ...currentObservations, plumeAreaVsTime: pts });
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-tertiary/30 rounded-lg p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-1.5 text-xs font-mono rounded-md transition font-bold ${
              activeTab === t.key
                ? 'bg-accent text-white'
                : 'text-muted hover:bg-tertiary hover:text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Sleipner */}
      {activeTab === 'sleipner' && (
        <div className="space-y-3">
          <p className="text-xs text-muted font-mono leading-relaxed bg-page/40 p-2.5 rounded-lg border border-theme/10">
            Loads Sleipner Utsira Formation observations: Layer-9 plume area (Boait 2012),
            injection pressure estimates, gravity-current radii, and dissolution rate
            constraint (Furre 2017).
          </p>
          <button
            onClick={loadSleipner}
            className="w-full py-2.5 text-xs font-mono font-bold rounded-lg bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30 transition shadow-sm"
          >
            Load Sleipner Observations
          </button>
          {currentObservations.plumeAreaVsTime && currentObservations.plumeAreaVsTime.length > 0 && (
            <p className="text-xs text-success font-mono font-semibold">
              ✓ Loaded {currentObservations.plumeAreaVsTime.length} plume area points.
            </p>
          )}
        </div>
      )}

      {/* Tab: JSON paste */}
      {activeTab === 'json' && (
        <div className="space-y-3">
          <p className="text-xs text-muted font-mono uppercase font-bold">Paste ObservationData JSON:</p>
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            rows={6}
            placeholder={`{\n  "plumeAreaVsTime": [\n    { "year": 5, "value": 0.82 }\n  ]\n}`}
            className="w-full text-xs font-mono bg-slate-800 border border-theme/30 rounded-lg p-2.5 text-secondary resize-none focus:border-accent outline-none"
          />
          {jsonError && (
            <p className="text-xs text-error font-mono font-bold">{jsonError}</p>
          )}
          <button
            onClick={parseJson}
            className="w-full py-2.5 text-xs font-mono font-bold rounded-lg bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30 transition shadow-sm"
          >
            Parse &amp; Apply
          </button>
        </div>
      )}

      {/* Tab: Manual entry */}
      {activeTab === 'manual' && (
        <div className="space-y-3">
          <p className="text-xs text-muted font-mono uppercase font-bold">Enter plume area (km²) vs year:</p>
          <div className="space-y-1.5">
            <div className="flex gap-2 text-xs text-muted font-mono font-bold">
              <span className="w-16">Year</span>
              <span className="flex-1">Area (km²)</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {manualRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="number"
                    value={row.year}
                    onChange={e => updateManualRow(i, 'year', e.target.value)}
                    placeholder="Year"
                    className="w-16 text-xs font-mono bg-slate-800 border border-theme/30 rounded-lg px-2 py-1 text-primary focus:border-accent outline-none"
                  />
                  <input
                    type="number"
                    value={row.value}
                    onChange={e => updateManualRow(i, 'value', e.target.value)}
                    placeholder="Area (km²)"
                    className="flex-1 text-xs font-mono bg-slate-800 border border-theme/30 rounded-lg px-2 py-1 text-primary focus:border-accent outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={applyManualRows}
            className="w-full py-2.5 text-xs font-mono font-bold rounded-lg bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30 transition shadow-sm"
          >
            Apply Manual Rows
          </button>
        </div>
      )}
    </div>
  );
}
