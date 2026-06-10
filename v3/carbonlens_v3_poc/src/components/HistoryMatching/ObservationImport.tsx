/**
 * ObservationImport — UI for importing observation data.
 * Three tabs: Sleipner Analogue, Paste JSON, Manual Entry.
 */

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
    { key: 'sleipner', label: 'Sleipner' },
    { key: 'json',     label: 'Paste JSON' },
    { key: 'manual',   label: 'Manual' },
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
    <div className="space-y-2">
      {/* Tabs */}
      <div className="flex gap-0.5 bg-tertiary/30 rounded p-0.5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-1 text-[9px] font-mono rounded transition ${
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
        <div className="space-y-1.5">
          <p className="text-[9px] text-muted font-mono leading-relaxed">
            Loads Sleipner Utsira Formation observations: Layer-9 plume area (Boait 2012),
            injection pressure estimates, gravity-current radii, and dissolution rate
            constraint (Furre 2017).
          </p>
          <button
            onClick={loadSleipner}
            className="w-full py-1.5 text-[10px] font-mono rounded bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30 transition"
          >
            Load Sleipner Observations
          </button>
          {currentObservations.plumeAreaVsTime && currentObservations.plumeAreaVsTime.length > 0 && (
            <p className="text-[8px] text-success font-mono">
              Loaded {currentObservations.plumeAreaVsTime.length} plume area points
            </p>
          )}
        </div>
      )}

      {/* Tab: JSON paste */}
      {activeTab === 'json' && (
        <div className="space-y-1.5">
          <p className="text-[9px] text-muted font-mono">Paste ObservationData JSON:</p>
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            rows={5}
            placeholder={`{\n  "plumeAreaVsTime": [\n    { "year": 5, "value": 0.82 }\n  ]\n}`}
            className="w-full text-[9px] font-mono bg-tertiary/50 border border-theme/30 rounded p-1.5 text-secondary resize-none"
          />
          {jsonError && (
            <p className="text-[8px] text-error font-mono">{jsonError}</p>
          )}
          <button
            onClick={parseJson}
            className="w-full py-1.5 text-[10px] font-mono rounded bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30 transition"
          >
            Parse & Apply
          </button>
        </div>
      )}

      {/* Tab: Manual entry */}
      {activeTab === 'manual' && (
        <div className="space-y-1.5">
          <p className="text-[9px] text-muted font-mono">Enter plume area (km²) vs year:</p>
          <div className="space-y-0.5">
            <div className="flex gap-1 text-[8px] text-muted font-mono">
              <span className="w-14">Year</span>
              <span className="flex-1">Area (km²)</span>
            </div>
            {manualRows.map((row, i) => (
              <div key={i} className="flex gap-1">
                <input
                  type="number"
                  value={row.year}
                  onChange={e => updateManualRow(i, 'year', e.target.value)}
                  placeholder="year"
                  className="w-14 text-[9px] font-mono bg-tertiary/50 border border-theme/30 rounded px-1 py-0.5 text-secondary"
                />
                <input
                  type="number"
                  value={row.value}
                  onChange={e => updateManualRow(i, 'value', e.target.value)}
                  placeholder="km²"
                  className="flex-1 text-[9px] font-mono bg-tertiary/50 border border-theme/30 rounded px-1 py-0.5 text-secondary"
                />
              </div>
            ))}
          </div>
          <button
            onClick={applyManualRows}
            className="w-full py-1.5 text-[10px] font-mono rounded bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30 transition"
          >
            Apply Entries
          </button>
        </div>
      )}
    </div>
  );
}
