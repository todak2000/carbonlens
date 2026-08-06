/**
 * MonitoringPanel
 *
 * Two-tab panel:
 *   Tab 1 - Model Calibration: wraps HistoryMatchingPanel with relabelled header
 *   Tab 2 - Field Surveillance: conformance alerts, time-series SVG chart,
 *            manual observation entry, synthetic SCADA generator, observation log
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Activity,
  AlignLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Download,
} from 'lucide-react'
import { HistoryMatchingPanel } from '../HistoryMatching'
import { db } from '../../db/projectDb'
import type { SimulationSnapshot, MonitoringObservation } from '../../db/projectDb'
import { generateSyntheticScadaData } from '../../engine/monitoring/syntheticScada'
import type { NoiseLevel } from '../../engine/monitoring/syntheticScada'
import { useUIStore } from '../../store/uiStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'calibration' | 'surveillance'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return 'N/A'
  return n.toFixed(decimals)
}

function statusColor(status: MonitoringObservation['conformanceStatus']): string {
  switch (status) {
    case 'green': return 'text-emerald-400'
    case 'amber': return 'text-amber-400'
    case 'red': return 'text-red-400'
  }
}

function statusBg(status: MonitoringObservation['conformanceStatus']): string {
  switch (status) {
    case 'green': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'amber': return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'red': return 'bg-red-500/15 text-red-400 border-red-500/30'
  }
}

// ---------------------------------------------------------------------------
// Conformance Alert Banner
// ---------------------------------------------------------------------------

interface ConformanceBannerProps {
  observations: MonitoringObservation[]
}

function ConformanceBanner({ observations }: ConformanceBannerProps) {
  if (observations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-theme/30 bg-tertiary/20 text-xs font-mono text-muted">
        <AlignLeft size={14} />
        No observations recorded yet. Add manual observations or generate synthetic data below.
      </div>
    )
  }

  const hasRed = observations.some(o => o.conformanceStatus === 'red')
  const hasAmber = observations.some(o => o.conformanceStatus === 'amber')

  if (hasRed) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs font-mono text-red-400">
        <XCircle size={14} />
        CONFORMANCE ALERT: One or more observations exceed acceptable deviation thresholds (red status).
      </div>
    )
  }
  if (hasAmber) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-mono text-amber-400">
        <AlertTriangle size={14} />
        CONFORMANCE WARNING: Some observations show elevated deviation from predicted values (amber status).
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-mono text-emerald-400">
      <CheckCircle size={14} />
      All observations within conformance envelope. No alerts.
    </div>
  )
}

// ---------------------------------------------------------------------------
// Time-Series SVG Chart
// ---------------------------------------------------------------------------

interface TimeSeriesChartProps {
  snapshots: SimulationSnapshot[]
  observations: MonitoringObservation[]
  projectYears: number
}

function TimeSeriesChart({ snapshots, observations, projectYears }: TimeSeriesChartProps) {
  const W = 750
  const H = 360
  const PAD = { top: 25, right: 35, bottom: 55, left: 70 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  if (snapshots.length === 0) {
    return (
      <div className="flex items-center justify-center h-52 text-sm font-mono text-muted/60">
        Run simulation to populate chart
      </div>
    )
  }

  const maxYear = Math.max(projectYears, ...snapshots.map(s => s.year))
  const pressures = snapshots.map(s => s.pressureMPa)
  const obsPressures = observations
    .filter(o => o.observedPressureMPa !== null)
    .map(o => o.observedPressureMPa as number)

  const allP = [...pressures, ...obsPressures]
  const minP = Math.max(0, Math.min(...allP) * 0.9)
  const maxP = Math.max(...allP) * 1.1

  const xScale = (year: number) => (year / maxYear) * chartW
  const yScale = (p: number) => chartH - ((p - minP) / (maxP - minP)) * chartH

  // Build simulation polyline
  const simPoints = snapshots
    .slice()
    .sort((a, b) => a.year - b.year)
    .map(s => `${xScale(s.year).toFixed(1)},${yScale(s.pressureMPa).toFixed(1)}`)
    .join(' ')

  // Y-axis ticks (3)
  const yTicks = [minP, (minP + maxP) / 2, maxP]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full font-mono text-secondary"
      style={{ height: H }}
      aria-label="Pressure time-series chart"
    >
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={0} y1={yScale(t).toFixed(1)}
            x2={chartW} y2={yScale(t).toFixed(1)}
            stroke="currentColor" strokeOpacity={0.12} strokeWidth={1.5}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((t, i) => (
          <text
            key={i}
            x={-10} y={Number(yScale(t).toFixed(1)) + 4}
            textAnchor="end"
            fontSize={11}
            fontWeight="bold"
            fill="currentColor"
            opacity={0.75}
          >
            {t.toFixed(1)}
          </text>
        ))}

        {/* X-axis labels */}
        {[0, Math.round(maxYear / 2), maxYear].map((yr, i) => (
          <text
            key={i}
            x={xScale(yr).toFixed(1)}
            y={chartH + 20}
            textAnchor="middle"
            fontSize={11}
            fontWeight="bold"
            fill="currentColor"
            opacity={0.75}
          >
            {yr} yr
          </text>
        ))}

        {/* Axis lines */}
        <line x1={0} y1={0} x2={0} y2={chartH} stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />

        {/* Simulation pressure line */}
        {simPoints && (
          <polyline
            points={simPoints}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={3}
            strokeLinejoin="round"
          />
        )}

        {/* Observation dots */}
        {observations
          .filter(o => o.observedPressureMPa !== null)
          .map(o => {
            const cx = xScale(o.year)
            const cy = yScale(o.observedPressureMPa as number)
            const fill = o.conformanceStatus === 'green'
              ? '#34d399'
              : o.conformanceStatus === 'amber'
              ? '#fbbf24'
              : '#f87171'
            return (
              <circle
                key={o.id}
                cx={cx.toFixed(1)}
                cy={cy.toFixed(1)}
                r={6}
                fill={fill}
                stroke="currentColor"
                strokeWidth={1}
                strokeOpacity={0.5}
              >
                <title>Year {o.year}: {fmtNum(o.observedPressureMPa)} MPa ({o.conformanceStatus})</title>
              </circle>
            )
          })}

        {/* Y-axis label */}
        <text
          x={-46}
          y={chartH / 2}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill="currentColor"
          opacity={0.7}
          transform={`rotate(-90, -46, ${chartH / 2})`}
        >
          Pressure (MPa)
        </text>
      </g>

      {/* Legend */}
      <g transform={`translate(${PAD.left + 10}, ${H - 12})`}>
        <line x1={0} y1={-3} x2={20} y2={-3} stroke="#3b82f6" strokeWidth={3} />
        <text x={26} y={1} fontSize={11} fontWeight="bold" fill="currentColor" opacity={0.8}>Simulated</text>
        
        <circle cx={140} cy={-3} r={5} fill="#34d399" />
        <text x={150} y={1} fontSize={11} fontWeight="bold" fill="currentColor" opacity={0.8}>Green (Conforming)</text>
        
        <circle cx={310} cy={-3} r={5} fill="#fbbf24" />
        <text x={320} y={1} fontSize={11} fontWeight="bold" fill="currentColor" opacity={0.8}>Amber (Warning)</text>
        
        <circle cx={470} cy={-3} r={5} fill="#f87171" />
        <text x={480} y={1} fontSize={11} fontWeight="bold" fill="currentColor" opacity={0.8}>Red (Alert)</text>
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Manual Observation Form
// ---------------------------------------------------------------------------

interface ManualObsFormProps {
  projectId: string
  projectYears: number
  snapshots: SimulationSnapshot[]
  onSaved: () => void
}

interface FormState {
  year: string
  pressure: string
  plumeArea: string
  injRate: string
  notes: string
}

const EMPTY_FORM: FormState = { year: '', pressure: '', plumeArea: '', injRate: '', notes: '' }

function computeDeviation(observed: number, simulated: number): number | null {
  if (!simulated) return null
  return ((observed - simulated) / simulated) * 100
}

function deriveStatus(devPressure: number | null, devPlume: number | null): MonitoringObservation['conformanceStatus'] {
  const maxDev = Math.max(
    Math.abs(devPressure ?? 0),
    Math.abs(devPlume ?? 0),
  )
  if (maxDev <= 10) return 'green'
  if (maxDev <= 25) return 'amber'
  return 'red'
}

function ManualObsForm({ projectId, projectYears, snapshots, onSaved }: ManualObsFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const year = parseInt(form.year)
    if (!year || year < 1 || year > projectYears) {
      setError(`Year must be between 1 and ${projectYears}`)
      return
    }

    const obsPressure = form.pressure ? parseFloat(form.pressure) : null
    const obsPlumeArea = form.plumeArea ? parseFloat(form.plumeArea) : null
    const obsInjRate = form.injRate ? parseFloat(form.injRate) : null

    // Find closest snapshot for deviation calculation
    const snap = snapshots.length
      ? snapshots.reduce<SimulationSnapshot | null>((best, s) => {
          if (!best) return s
          return Math.abs(s.year - year) < Math.abs(best.year - year) ? s : best
        }, null)
      : null

    const devPressure = obsPressure !== null && snap
      ? computeDeviation(obsPressure, snap.pressureMPa)
      : null
    const devPlume = obsPlumeArea !== null && snap
      ? computeDeviation(obsPlumeArea, snap.plumeAreaKm2)
      : null

    const status = deriveStatus(devPressure, devPlume)

    const obs: MonitoringObservation = {
      id: `${projectId}_manual_y${year}_${Date.now()}`,
      projectId,
      year,
      source: 'manual',
      observedPressureMPa: obsPressure,
      observedPlumeAreaKm2: obsPlumeArea,
      observedInjectionRateMtpa: obsInjRate,
      notes: form.notes,
      deviationPressurePct: devPressure,
      deviationPlumeAreaPct: devPlume,
      conformanceStatus: status,
      createdAt: Date.now(),
    }

    try {
      setSaving(true)
      await db.monitoringObservations.put(obs)
      setForm(EMPTY_FORM)
      onSaved()
    } catch {
      setError('Failed to save observation. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted font-mono block mb-1">
            Year (1 to {projectYears}) *
          </label>
          <input
            type="number"
            min={1}
            max={projectYears}
            value={form.year}
            onChange={setField('year')}
            required
            className="w-full text-xs font-mono bg-tertiary/50 border border-theme/30 rounded-lg px-3 py-1.5 text-secondary focus:border-accent/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-muted font-mono block mb-1">
            Pressure (MPa)
          </label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.pressure}
            onChange={setField('pressure')}
            placeholder="optional"
            className="w-full text-xs font-mono bg-tertiary/50 border border-theme/30 rounded-lg px-3 py-1.5 text-secondary focus:border-accent/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-muted font-mono block mb-1">
            Plume Area (km²)
          </label>
          <input
            type="number"
            step="0.001"
            min={0}
            value={form.plumeArea}
            onChange={setField('plumeArea')}
            placeholder="optional"
            className="w-full text-xs font-mono bg-tertiary/50 border border-theme/30 rounded-lg px-3 py-1.5 text-secondary focus:border-accent/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-muted font-mono block mb-1">
            Inj. Rate (Mt/yr)
          </label>
          <input
            type="number"
            step="0.001"
            min={0}
            value={form.injRate}
            onChange={setField('injRate')}
            placeholder="optional"
            className="w-full text-xs font-mono bg-tertiary/50 border border-theme/30 rounded-lg px-3 py-1.5 text-secondary focus:border-accent/50 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted font-mono block mb-1">Notes</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={setField('notes')}
          placeholder="optional"
          className="w-full text-xs font-mono bg-tertiary/50 border border-theme/30 rounded-lg px-3 py-1.5 text-secondary focus:border-accent/50 focus:outline-none resize-none"
        />
      </div>
      {error && (
        <p className="text-xs text-red-400 font-mono">{error}</p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold rounded-lg border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition disabled:opacity-50"
      >
        <Plus size={12} />
        {saving ? 'Saving...' : 'Save Observation'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Synthetic SCADA Generator
// ---------------------------------------------------------------------------

interface ScadaGeneratorProps {
  projectId: string
  snapshots: SimulationSnapshot[]
  projectYears: number
  onGenerated: () => void
}

type IntervalOption = 1 | 3 | 5

function ScadaGenerator({ projectId, snapshots, projectYears, onGenerated }: ScadaGeneratorProps) {
  const [interval, setInterval] = useState<IntervalOption>(1)
  const [noiseLevel, setNoiseLevel] = useState<NoiseLevel>('medium')
  const [generating, setGenerating] = useState(false)
  const [generatedCount, setGeneratedCount] = useState<number | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!snapshots.length) return
    setGenerating(true)
    setGeneratedCount(null)
    try {
      const years: number[] = []
      for (let y = interval; y <= projectYears; y += interval) {
        years.push(y)
      }

      // P10/P90 envelope from snapshot data
      const areas = snapshots.map(s => s.plumeAreaKm2).filter(v => v > 0)
      const p10 = areas.length ? Math.min(...areas) * 0.7 : 0
      const p90 = areas.length ? Math.max(...areas) * 1.3 : 100

      const results = await generateSyntheticScadaData({
        projectId,
        snapshots,
        reportingYears: years,
        noiseLevel,
        p10PlumeArea: p10,
        p90PlumeArea: p90,
      })
      setGeneratedCount(results.length)
      onGenerated()
    } finally {
      setGenerating(false)
    }
  }, [projectId, snapshots, projectYears, interval, noiseLevel, onGenerated])

  return (
    <div className="space-y-3.5">
      <p className="text-[10px] text-amber-400 font-mono border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-1.5 leading-relaxed font-bold uppercase">
        [SYNTHETIC DATA - For demonstration only]
      </p>

      <div>
        <span className="text-xs text-muted font-mono block mb-1.5 font-bold uppercase">Reporting interval</span>
        <div className="flex gap-4">
          {([1, 3, 5] as IntervalOption[]).map(opt => (
            <label key={opt} className="flex items-center gap-1.5 text-xs font-mono text-secondary cursor-pointer">
              <input
                type="radio"
                name="scada-interval"
                value={opt}
                checked={interval === opt}
                onChange={() => setInterval(opt)}
                className="accent-blue-500"
              />
              Every {opt} yr
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs text-muted font-mono block mb-1.5 font-bold uppercase">Noise level</span>
        <div className="flex gap-4">
          {(['low', 'medium', 'high'] as NoiseLevel[]).map(opt => (
            <label key={opt} className="flex items-center gap-1.5 text-xs font-mono text-secondary cursor-pointer capitalize">
              <input
                type="radio"
                name="scada-noise"
                value={opt}
                checked={noiseLevel === opt}
                onChange={() => setNoiseLevel(opt)}
                className="accent-blue-500"
              />
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating || snapshots.length === 0}
        className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold rounded-lg border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Activity size={12} />
        {generating ? 'Generating...' : 'Generate Synthetic SCADA Data'}
      </button>

      {snapshots.length === 0 && (
        <p className="text-xs text-muted/60 font-mono italic">Run a simulation first to enable generation.</p>
      )}

      {generatedCount !== null && (
        <p className="text-xs text-emerald-400 font-mono font-bold">
          ✓ Generated {generatedCount} synthetic records successfully.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Observation Log Table
// ---------------------------------------------------------------------------

interface ObsLogTableProps {
  observations: MonitoringObservation[]
  snapshots: SimulationSnapshot[]
  onDelete: (id: string) => void
}

function getSnapForYear(snapshots: SimulationSnapshot[], year: number): SimulationSnapshot | null {
  if (!snapshots.length) return null
  return snapshots.reduce<SimulationSnapshot | null>((best, s) => {
    if (!best) return s
    return Math.abs(s.year - year) < Math.abs(best.year - year) ? s : best
  }, null)
}

function ObsLogTable({ observations, snapshots, onDelete }: ObsLogTableProps) {
  const exportCsv = useCallback(() => {
    const header = 'Year,Source,P obs (MPa),P pred (MPa),P dev%,Plume obs (km2),Plume pred (km2),Status,Notes\n'
    const rows = observations.map(o => {
      const snap = getSnapForYear(snapshots, o.year)
      return [
        o.year,
        o.source === 'synthetic' ? 'Synthetic [DEMO]' : 'Manual',
        fmtNum(o.observedPressureMPa),
        snap ? fmtNum(snap.pressureMPa) : 'N/A',
        fmtNum(o.deviationPressurePct, 1),
        fmtNum(o.observedPlumeAreaKm2),
        snap ? fmtNum(snap.plumeAreaKm2) : 'N/A',
        o.conformanceStatus,
        `"${o.notes.replace(/"/g, "'")}"`,
      ].join(',')
    }).join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monitoring_observations_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [observations, snapshots])

  if (observations.length === 0) {
    return (
      <div className="text-[9px] font-mono text-muted/60 text-center py-4 border border-theme/20 rounded">
        No observations recorded. Add manual data or generate synthetic SCADA records above.
      </div>
    )
  }

  const sorted = [...observations].sort((a, b) => a.year - b.year)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-theme/20 bg-card">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-theme/20 bg-tertiary/30">
              <th className="text-left px-3 py-2 text-muted font-bold uppercase tracking-wider">Yr</th>
              <th className="text-left px-3 py-2 text-muted font-bold uppercase tracking-wider">Source</th>
              <th className="text-right px-3 py-2 text-muted font-bold uppercase tracking-wider">P obs</th>
              <th className="text-right px-3 py-2 text-muted font-bold uppercase tracking-wider">P pred</th>
              <th className="text-right px-3 py-2 text-muted font-bold uppercase tracking-wider">P dev%</th>
              <th className="text-right px-3 py-2 text-muted font-bold uppercase tracking-wider">Plume obs</th>
              <th className="text-right px-3 py-2 text-muted font-bold uppercase tracking-wider">Plume pred</th>
              <th className="text-center px-3 py-2 text-muted font-bold uppercase tracking-wider">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(o => {
              const snap = getSnapForYear(snapshots, o.year)
              const isSynthetic = o.source === 'synthetic'
              return (
                <tr
                  key={o.id}
                  className="border-b border-theme/10 hover:bg-tertiary/20 transition-colors"
                >
                  <td className="px-3 py-2 text-secondary font-bold">{o.year}</td>
                  <td className="px-3 py-2">
                    {isSynthetic ? (
                      <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 text-[9px] font-bold">
                        Synthetic [DEMO]
                      </span>
                    ) : (
                      <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-0.5 text-[9px] font-bold">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-secondary font-semibold">{fmtNum(o.observedPressureMPa)}</td>
                  <td className="px-3 py-2 text-right text-muted">{snap ? fmtNum(snap.pressureMPa) : 'N/A'}</td>
                  <td className={`px-3 py-2 text-right font-bold ${statusColor(o.conformanceStatus)}`}>
                    {fmtNum(o.deviationPressurePct, 1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-secondary font-semibold">{fmtNum(o.observedPlumeAreaKm2)}</td>
                  <td className="px-3 py-2 text-right text-muted">{snap ? fmtNum(snap.plumeAreaKm2) : 'N/A'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${statusBg(o.conformanceStatus)}`}>
                      {o.conformanceStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onDelete(o.id)}
                      className="text-muted hover:text-red-400 transition-colors"
                      title="Delete observation"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 text-xs font-mono text-secondary hover:text-primary transition px-3 py-1.5 rounded-lg border border-theme/20 hover:border-theme/40 bg-slate-800"
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Surveillance Tab (main composition)
// ---------------------------------------------------------------------------

interface SurveillanceTabProps {
  projectId: string
  projectYears: number
}

function SurveillanceTab({ projectId, projectYears }: SurveillanceTabProps) {
  const [snapshots, setSnapshots] = useState<SimulationSnapshot[]>([])
  const [observations, setObservations] = useState<MonitoringObservation[]>([])
  const refreshRef = useRef(0)

  const loadData = useCallback(async () => {
    if (!projectId) return
    const [snaps, obs] = await Promise.all([
      db.simulationSnapshots.where('projectId').equals(projectId).toArray(),
      db.monitoringObservations.where('projectId').equals(projectId).toArray(),
    ])
    setSnapshots(snaps.sort((a, b) => a.year - b.year))
    setObservations(obs)
  }, [projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = useCallback(async (id: string) => {
    await db.monitoringObservations.delete(id)
    loadData()
  }, [loadData])

  const refresh = useCallback(() => {
    refreshRef.current += 1
    loadData()
  }, [loadData])

  return (
    <div className="space-y-6">
      {/* 1. Conformance Alert Banner */}
      <ConformanceBanner observations={observations} />

      {/* Row 1: Generators Paired Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual Observation Entry */}
        <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
          <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2 flex items-center gap-1.5">
            <Plus size={13} /> Manual Observation Entry
          </h3>
          <ManualObsForm
            projectId={projectId}
            projectYears={projectYears}
            snapshots={snapshots}
            onSaved={refresh}
          />
        </div>

        {/* Synthetic SCADA Generator */}
        <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
          <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2 flex items-center gap-1.5">
            <Activity size={13} className="text-accent" /> Synthetic SCADA Generator
          </h3>
          <ScadaGenerator
            projectId={projectId}
            snapshots={snapshots}
            projectYears={projectYears}
            onGenerated={refresh}
          />
        </div>
      </div>

      {/* Row 2: Full-width Pressure vs Time Chart */}
      <div className="rounded-xl border border-theme/30 bg-card p-6 space-y-3 shadow-md">
        <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-theme/10 pb-2">
          <Activity size={14} className="text-accent" /> Pressure vs Time Performance Chart
        </h3>
        <div className="bg-page/50 rounded-lg border border-theme/20 p-4">
          <TimeSeriesChart
            snapshots={snapshots}
            observations={observations}
            projectYears={projectYears}
          />
        </div>
      </div>

      {/* Row 3: Full-width Observation Log Table */}
      <div className="rounded-xl border border-theme/30 bg-card p-6 space-y-3 shadow-md">
        <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-theme/10 pb-2 flex items-center gap-1.5">
          <AlignLeft size={14} className="text-accent" /> Observation Log
        </h3>
        <ObsLogTable
          observations={observations}
          snapshots={snapshots}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Model Calibration Tab (relabelled wrapper around HistoryMatchingPanel)
// ---------------------------------------------------------------------------

function CalibrationTab() {
  return (
    <div className="p-1">
      <HistoryMatchingPanel />
    </div>
  )
}

// ---------------------------------------------------------------------------
// MonitoringPanel - top-level component with tab bar
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'calibration', label: 'Model Calibration' },
  { id: 'surveillance', label: 'Field Surveillance' },
]

export default function MonitoringPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('calibration')
  const projectYears = useUIStore(s => s.projectYears)
  const currentProjectId = useUIStore(s => s.currentProjectId)

  return (
    <div className="w-full space-y-5">
      {/* Panel header */}
      <div className="p-5 pb-0 shrink-0">
        <h2 className="font-semibold text-primary text-lg font-mono uppercase tracking-wider flex items-center gap-1.5 mb-3">
          <Activity size={18} className="text-accent" />
          Field Monitoring &amp; SCADA Surveillance
        </h2>

        {/* Tab bar */}
        <div className="flex border-b border-theme/30 bg-tertiary/10 rounded-t-lg">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-4 py-2.5 text-xs font-mono font-bold transition-colors border-b-2 -mb-px flex-1',
                activeTab === tab.id
                  ? 'border-accent text-accent bg-card'
                  : 'border-transparent text-muted hover:text-secondary',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'calibration' ? (
          <CalibrationTab />
        ) : (
          <div className="space-y-3">
            {currentProjectId ? (
              <SurveillanceTab
                projectId={currentProjectId}
                projectYears={projectYears}
              />
            ) : (
              <div className="text-sm font-mono text-muted/60 text-center py-10 bg-page/30 border border-theme/20 rounded-lg">
                Open or create a project to view field surveillance data.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
