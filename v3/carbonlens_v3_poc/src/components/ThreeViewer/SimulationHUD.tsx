/**
 * SimulationHUD — overlay on the 3D canvas showing live simulation state.
 *
 * Displays:
 *  - Year counter (current / total)
 *  - CO2 trapping breakdown bar (free / residual / dissolved / mineral)
 *  - Color legend for grid cell phases
 *  - Total injected CO2 estimate
 */

import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'

interface TrapBar {
  label: string
  color: string
  pct: number
}

export default function SimulationHUD() {
  const result      = useSimulationStore((s) => s.result)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  const timestep    = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const showGridView = useUIStore((s) => s.showGridView)

  if (!result || !showGridView) return null

  const total = Math.max(0.001, result.storageCapacity)
  const mobile    = Math.max(0, result.mobilePlume)
  const residual  = Math.max(0, result.residualTrapping)
  const dissolved = Math.max(0, result.solubilityTrapping)
  const mineral   = Math.max(0, result.mineralTrapping)   // from PlumeGrid kinetic model (year 50+)
  const sum = mobile + residual + dissolved + mineral || 1

  const bars: TrapBar[] = [
    { label: 'Free CO₂',  color: '#ef4444', pct: (mobile    / sum) * 100 },
    { label: 'Residual',  color: '#10b981', pct: (residual  / sum) * 100 },
    { label: 'Dissolved', color: '#14b8a6', pct: (dissolved / sum) * 100 },
    { label: 'Mineral',   color: '#b45309', pct: (mineral   / sum) * 100 },
  ]

  const yearPct = Math.min(100, (timestep / Math.max(1, projectYears)) * 100)

  return (
    <div
      className="absolute bottom-10 left-3 z-10 pointer-events-none select-none"
      style={{ width: 220 }}
    >
      {/* Year counter */}
      <div
        className="mb-2 px-3 py-1.5 rounded-md"
        style={{ background: 'rgba(6,12,20,0.80)', backdropFilter: 'blur(4px)', border: '1px solid rgba(0,196,160,0.25)' }}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-mono text-teal-400">SIMULATION YEAR</span>
          <span className="text-[11px] font-mono font-bold text-white">{timestep} / {projectYears}</span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${yearPct}%`, background: 'linear-gradient(90deg, #00c4a0, #3b82f6)' }}
          />
        </div>
      </div>

      {/* Trapping breakdown */}
      <div
        className="px-3 py-2 rounded-md"
        style={{ background: 'rgba(6,12,20,0.80)', backdropFilter: 'blur(4px)', border: '1px solid rgba(21,37,53,0.8)' }}
      >
        <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1.5">CO₂ Phase Distribution</p>

        {/* Stacked bar */}
        <div className="flex h-3 rounded overflow-hidden mb-2 w-full">
          {bars.filter(b => b.pct > 0.5).map((b) => (
            <div key={b.label} style={{ width: `${b.pct}%`, background: b.color }} title={`${b.label}: ${b.pct.toFixed(1)}%`} />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-0.5">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: b.color }} />
                <span className="text-[9px] font-mono" style={{ color: b.color }}>{b.label}</span>
              </div>
              <span className="text-[9px] font-mono text-secondary">{b.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>

        {/* Total injected */}
        <div className="mt-2 pt-1.5 border-t border-white/10">
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted">Injected</span>
            <span className="text-[9px] font-mono text-white">{result.storageCapacity.toFixed(3)} Mt</span>
          </div>
        </div>
      </div>

      {/* Grid legend */}
      <div
        className="mt-2 px-3 py-2 rounded-md"
        style={{ background: 'rgba(6,12,20,0.80)', backdropFilter: 'blur(4px)', border: '1px solid rgba(21,37,53,0.8)' }}
      >
        <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1.5">Cell Legend</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {[
            { color: '#0d2137', label: 'Brine' },
            { color: '#ef4444', label: 'Free CO₂' },
            { color: '#10b981', label: 'Residual' },
            { color: '#14b8a6', label: 'Dissolved' },
            { color: '#b45309', label: 'Mineral' },
            { color: '#64748b', label: 'Caprock' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
              <span className="text-[8px] font-mono text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
