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
import { safetyFactorToColor } from '../../utils/colorMapping'

interface TrapBar {
  label: string
  color: string
  pct: number
}

export default function SimulationHUD() {
  const result       = useSimulationStore((s) => s.result)
  const geomechanics = useSimulationStore((s) => s.geomechanics)
  const isAnimating  = useSimulationStore((s) => s.isAnimating)
  const timestep     = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const showGridView = useUIStore((s) => s.showGridView)

  if (!result || !showGridView) return null

  // ── PVT derived values ────────────────────────────────────────────────────
  const pvt = result.pvtStats
  const densityMin  = pvt?.densityMin_kgm3.toFixed(0) ?? '—'
  const densityMax  = pvt?.densityMax_kgm3.toFixed(0) ?? '—'
  const densityMean = pvt?.densityMean_kgm3.toFixed(0) ?? result.co2Density.toFixed(0)
  const phaseWarning = pvt?.phaseWarning ?? false
  const capacityFactor = pvt ? ((pvt.densityWeightedCapacityFactor - 1) * 100).toFixed(1) : '0.0'

  // ── BHP values ────────────────────────────────────────────────────────────
  const peacemanBHP   = result.peacemanBHP?.toFixed(1) ?? '—'
  const hydroBHP      = result.hydrostaticBHP_MPa?.toFixed(1) ?? '—'
  const bhpMargin     = result.bhpMargin_MPa
  const bhpSafe       = bhpMargin !== undefined ? bhpMargin > 0 : true
  const bhpMarginStr  = bhpMargin !== undefined ? `${bhpMargin > 0 ? '+' : ''}${bhpMargin.toFixed(1)}` : '—'

  // ── Geomechanics values ───────────────────────────────────────────────────
  const sf        = geomechanics?.safetyFactor ?? null
  const maipMargin = geomechanics?.maipMargin ?? null
  const sfColor   = sf !== null ? safetyFactorToColor(sf) : [0.4, 0.4, 0.4]
  const sfHex     = `rgb(${Math.round(sfColor[0]*255)},${Math.round(sfColor[1]*255)},${Math.round(sfColor[2]*255)})`

  const total = Math.max(0.001, result.storageCapacity)
  const mobile    = Math.max(0, result.mobilePlume)
  const residual  = Math.max(0, result.residualTrapping)
  const dissolved = Math.max(0, result.solubilityTrapping)
  const mineral   = Math.max(0, result.mineralTrapping)   // from PlumeGrid kinetic model (year 50+)
  const sum = mobile + residual + dissolved + mineral || 1

  const bars: TrapBar[] = [
    { label: 'Structural Trapping (caprock)', color: '#ef4444', pct: (mobile    / sum) * 100 },
    { label: 'Residual',                      color: '#10b981', pct: (residual  / sum) * 100 },
    { label: 'Dissolved',                     color: '#14b8a6', pct: (dissolved / sum) * 100 },
    { label: 'Mineral',                       color: '#b45309', pct: (mineral   / sum) * 100 },
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
        <div className="flex flex-col gap-0.5">
          {[
            { color: '#0d2137', label: 'Brine' },
            { color: '#ef4444', label: 'Structural Trapping (caprock)' },
            { color: '#10b981', label: 'Residual' },
            { color: '#14b8a6', label: 'Dissolved' },
            { color: '#b45309', label: 'Mineral' },
            { color: '#64748b', label: 'Caprock' },
            { color: '#8c33bf', label: 'Imbibition front' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
              <span className="text-[8px] font-mono text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── In-situ PVT panel ───────────────────────────────────────────── */}
      <div
        className="mt-2 px-3 py-2 rounded-md"
        style={{ background: 'rgba(6,12,20,0.80)', backdropFilter: 'blur(4px)', border: `1px solid ${phaseWarning ? 'rgba(234,179,8,0.5)' : 'rgba(21,37,53,0.8)'}` }}
      >
        <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1.5">
          In-situ CO&#8322; Density (PVT)
        </p>
        <div className="flex flex-col gap-0.5">
          {result.temperatureAtTopC !== undefined && result.temperatureAtBaseC !== undefined && (
            <div className="flex justify-between">
              <span className="text-[9px] font-mono text-muted">T gradient</span>
              <span className="text-[9px] font-mono text-orange-200">{result.temperatureAtTopC.toFixed(1)} &rarr; {result.temperatureAtBaseC.toFixed(1)}&deg;C</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted">Min (plume edge)</span>
            <span className="text-[9px] font-mono text-blue-300">{densityMin} kg/m&#179;</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted">Mean (field avg)</span>
            <span className="text-[9px] font-mono text-teal-300">{densityMean} kg/m&#179;</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted">Max (near-well)</span>
            <span className="text-[9px] font-mono text-white">{densityMax} kg/m&#179;</span>
          </div>
          <div className="flex justify-between mt-0.5 pt-0.5 border-t border-white/10">
            <span className="text-[9px] font-mono text-muted">Capacity adj.</span>
            <span className="text-[9px] font-mono" style={{ color: Number(capacityFactor) >= 0 ? '#34d399' : '#f87171' }}>
              {Number(capacityFactor) >= 0 ? '+' : ''}{capacityFactor}%
            </span>
          </div>
        </div>
        {phaseWarning && (
          <div className="mt-1.5 px-2 py-1 rounded text-[8px] font-mono text-yellow-300 bg-yellow-500/10 border border-yellow-500/30">
            Subcritical zone detected. Gas-phase CO&#8322; present — storage efficiency reduced.
          </div>
        )}
      </div>

      {/* ── Wellbore BHP panel ──────────────────────────────────────────── */}
      <div
        className="mt-2 px-3 py-2 rounded-md"
        style={{ background: 'rgba(6,12,20,0.80)', backdropFilter: 'blur(4px)', border: `1px solid ${bhpSafe ? 'rgba(21,37,53,0.8)' : 'rgba(239,68,68,0.5)'}` }}
      >
        <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1.5">
          Wellbore BHP
        </p>
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted">Peaceman (Darcy)</span>
            <span className="text-[9px] font-mono text-orange-300">{peacemanBHP} MPa</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted">Hydrostatic (WHP+10)</span>
            <span className="text-[9px] font-mono text-cyan-300">{hydroBHP} MPa</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted">Tubing friction</span>
            <span className="text-[9px] font-mono text-yellow-300">
              {result.tubingFrictionDrop_MPa !== undefined ? `+${result.tubingFrictionDrop_MPa.toFixed(2)} MPa` : '\u2014'}
            </span>
          </div>
          <div className="flex justify-between mt-0.5 pt-0.5 border-t border-white/10">
            <span className="text-[9px] font-mono text-muted">Fracture margin</span>
            <span className="text-[9px] font-mono" style={{ color: bhpSafe ? '#34d399' : '#f87171' }}>
              {bhpMarginStr} MPa
            </span>
          </div>
          {result.tubingFrictionDrop_MPa !== undefined && (
            <div className="flex justify-between">
              <span className="text-[9px] font-mono text-muted">Total arrival BHP</span>
              <span className="text-[9px] font-mono text-orange-200">
                {(peacemanBHP !== '\u2014' ? parseFloat(peacemanBHP) + result.tubingFrictionDrop_MPa : 0).toFixed(1)} MPa
              </span>
            </div>
          )}
        </div>
        {!bhpSafe && (
          <div className="mt-1.5 px-2 py-1 rounded text-[8px] font-mono text-red-300 bg-red-500/10 border border-red-500/30">
            BHP exceeds fracture pressure. Reduce injection rate or WHP.
          </div>
        )}
      </div>

      {/* ── Geomechanical safety panel ──────────────────────────────────── */}
      {geomechanics && (
        <div
          className="mt-2 px-3 py-2 rounded-md"
          style={{ background: 'rgba(6,12,20,0.80)', backdropFilter: 'blur(4px)', border: '1px solid rgba(21,37,53,0.8)' }}
        >
          <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1.5">
            Geomech Safety
          </p>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono text-muted">Mohr-Coulomb SF</span>
              <span className="text-[9px] font-mono font-bold" style={{ color: sfHex }}>
                {sf !== null ? sf.toFixed(2) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] font-mono text-muted">MAIP margin</span>
              <span className="text-[9px] font-mono" style={{ color: (maipMargin ?? 1) > 0 ? '#34d399' : '#f87171' }}>
                {maipMargin !== null ? `${maipMargin > 0 ? '+' : ''}${maipMargin.toFixed(1)} MPa` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] font-mono text-muted">Seismicity risk</span>
              <span className="text-[9px] font-mono" style={{
                color: geomechanics.inducedSeismicityRisk === 'low' ? '#34d399'
                     : geomechanics.inducedSeismicityRisk === 'moderate' ? '#fbbf24'
                     : '#f87171'
              }}>
                {geomechanics.inducedSeismicityRisk.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
