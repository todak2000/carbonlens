import { useMemo } from 'react'
import { LayoutDashboard, Activity, Target, Crosshair, DollarSign, Hammer, Droplets } from 'lucide-react'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'

export default function OverviewPanel() {
  const params = useFormationStore((s) => s.params)
  const wells = useFormationStore((s) => s.wells)
  const simResult = useSimulationStore((s) => s.result)
  const geoResult = useSimulationStore((s) => s.geomechanics)
  const validation = useSimulationStore((s) => s.validation)
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const projectYears = useUIStore((s) => s.projectYears)

  const trappedPct = useMemo(() => {
    if (!simResult) return { residual: 0, solubility: 0, mobile: 100 }
    const total = simResult.residualTrapping + simResult.solubilityTrapping + Math.max(0.01, simResult.mobilePlume)
    return {
      residual: (simResult.residualTrapping / total) * 100,
      solubility: (simResult.solubilityTrapping / total) * 100,
      mobile: (simResult.mobilePlume / total) * 100,
    }
  }, [simResult])

  return (
    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
        <LayoutDashboard size={13} /> Executive Overview
      </h2>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-1.5">
        <QuickStat label="Formation" value={`${params.depth}m`} sub={`${params.thickness}m × ${params.area}km²`} />
        <QuickStat label="Wells" value={`${wells.length}`} sub={`${wells.reduce((s, w) => s + w.injectionRate, 0).toFixed(3)} Mt/yr total`} />
        <QuickStat label="Jurisdiction" value={jurisdiction} sub={`${projectYears} yr project`} />
        <QuickStat label="Geometry" value={params.geometryType} sub={`φ=${(params.porosity * 100).toFixed(0)}% k=${params.permeability}mD`} />
      </div>

      {/* Screening + Containment Row */}
      <div className="grid grid-cols-2 gap-2">
        <ScreeningMini params={params} jurisdiction={jurisdiction} />
        {simResult ? (
          <div className="rounded px-2 py-2 border border-theme/30 bg-tertiary/20">
            <h3 className="text-[9px] text-muted font-mono mb-1 flex items-center gap-1"><Activity size={10} /> Containment</h3>
            <div className="text-lg font-bold font-mono text-accent">{(simResult.containmentProbability * 100).toFixed(0)}%</div>
            <div className="w-full h-1 rounded-full bg-tertiary overflow-hidden mt-1">
              <div className="h-full rounded-full bg-teal" style={{ width: `${simResult.containmentProbability * 100}%` }} />
            </div>
            <div className="text-[8px] text-muted/60 font-mono mt-1">
              P10: {simResult.p10.toFixed(2)} · P50: {simResult.p50.toFixed(2)} · P90: {simResult.p90.toFixed(2)} Mt
            </div>
          </div>
        ) : (
          <div className="rounded px-2 py-2 border border-theme/30 bg-tertiary/20 flex items-center justify-center text-[10px] text-muted font-mono">
            No simulation data
          </div>
        )}
      </div>

      {/* Simulation Summary */}
      {simResult && (
        <div className="space-y-1.5">
          <h3 className="text-[9px] text-muted font-mono flex items-center gap-1"><Activity size={10} /> Storage</h3>
          <div className="grid grid-cols-3 gap-1.5">
            <Metric label="Stored" value={`${simResult.storageCapacity.toFixed(2)} Mt`} />
            <Metric label="Capacity" value={`${simResult.totalCapacity.toFixed(2)} Mt`} />
            <Metric label="Utilization" value={`${simResult.capacityUtilPct.toFixed(1)}%`} />
            <Metric label="Plume Radius" value={`${simResult.plumeRadius.toFixed(0)} m`} />
            <Metric label="Inj. Pressure" value={`${simResult.injectionPressure.toFixed(1)} MPa`} />
            <Metric label="CO₂ Density" value={`${simResult.co2Density.toFixed(0)} kg/m³`} />
          </div>
          {simResult.overpressureRisk && (
            <div className="flex items-center gap-1 text-[9px] text-red-400 font-mono bg-red-900/20 rounded px-1.5 py-1">
              ⚠ Overpressure risk — stored CO₂ exceeds P90 capacity
            </div>
          )}
        </div>
      )}

      {/* Trapping Distribution */}
      {simResult && (
        <div>
          <h3 className="text-[9px] text-muted font-mono mb-1 flex items-center gap-1"><Droplets size={10} /> Trapping</h3>
          <div className="w-full h-3 rounded-full bg-tertiary overflow-hidden flex">
            <div className="h-full bg-teal transition-all" style={{ width: `${trappedPct.mobile}%` }} title={`Mobile ${trappedPct.mobile.toFixed(0)}%`} />
            <div className="h-full bg-amber transition-all" style={{ width: `${trappedPct.residual}%` }} title={`Residual ${trappedPct.residual.toFixed(0)}%`} />
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${trappedPct.solubility}%` }} title={`Dissolved ${trappedPct.solubility.toFixed(0)}%`} />
          </div>
          <div className="flex gap-3 text-[8px] font-mono text-muted/70 mt-0.5">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-teal" /> Mobile {trappedPct.mobile.toFixed(0)}%</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-amber" /> Residual {trappedPct.residual.toFixed(0)}%</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-500" /> Dissolved {trappedPct.solubility.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Geomechanics */}
      <div>
        <h3 className="text-[9px] text-muted font-mono mb-1 flex items-center gap-1"><Hammer size={10} /> Geomechanics</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <GeoCheck label="Fracture Ratio" value={validation?.checks.caprock.value} threshold={0.85} ok={validation?.checks.caprock.ok} unit="" />
          <GeoCheck label="Safety Factor" value={validation?.checks.safetyFactor.value} threshold={1.2} ok={validation?.checks.safetyFactor.ok} unit="" />
          <GeoCheck label="Mohr Margin" value={validation?.checks.mohr.value} threshold={0} ok={validation?.checks.mohr.ok} unit="MPa" />
          <GeoCheck label="MAIP Margin" value={validation?.checks.maip.value} threshold={0} ok={validation?.checks.maip.ok} unit="%" />
        </div>
      </div>

      {/* Economics */}
      <div>
        <h3 className="text-[9px] text-muted font-mono mb-1 flex items-center gap-1"><DollarSign size={10} /> Economics</h3>
        <div className="grid grid-cols-3 gap-1.5">
          <Metric label="CAPEX" value={`$${(wells.length * (5 + params.depth * 0.006) + wells.length * 3 + 2 + Math.sqrt(params.area) * 0.8 + 1).toFixed(0)}M`} />
          <Metric label="Levelized Cost" value={`$${(simResult ? (wells.length * (5 + params.depth * 0.006) + wells.length * 3 + 2 + Math.sqrt(params.area) * 0.8 + 1 + (1.5 + wells.length * 0.2 + params.depth * 0.0005) * simResult.storageCapacity) / Math.max(0.001, simResult.storageCapacity) : 0).toFixed(1)}/t`} />
          <Metric label="45Q/Incentive" value={`$${jurisdiction === 'US' ? 85 : jurisdiction === 'EU' ? 60 : jurisdiction === 'Norway' ? 70 : jurisdiction === 'Australia' ? 45 : 0}/t`} />
        </div>
      </div>

      {/* Leakage Risk */}
      <div>
        <h3 className="text-[9px] text-muted font-mono mb-1 flex items-center gap-1"><Crosshair size={10} /> Leakage</h3>
        <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
          <div className="text-[10px] font-mono text-muted">
            Legacy well risk · Corrective action estimate available in Leakage panel
          </div>
        </div>
      </div>

      <div className="text-[7px] text-muted/30 font-mono text-center pt-1 border-t border-theme/10">
        All values update in real-time as you adjust parameters
      </div>
    </div>
  )
}

function QuickStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded px-2 py-1.5 border border-theme/20 bg-tertiary/10">
      <div className="text-[8px] text-muted font-mono uppercase tracking-wider">{label}</div>
      <div className="text-xs font-bold font-mono text-primary">{value}</div>
      <div className="text-[8px] text-muted/60 font-mono truncate">{sub}</div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded px-1.5 py-1 bg-tertiary/20 border border-theme/10">
      <div className="text-[7px] text-muted font-mono">{label}</div>
      <div className="text-[10px] font-bold font-mono text-secondary">{value}</div>
    </div>
  )
}

function GeoCheck({ label, value, threshold, ok, unit }: { label: string; value?: number; threshold: number; ok?: boolean; unit: string }) {
  const status = value !== undefined
    ? ok
      ? 'Pass'
      : 'Fail'
    : '—'
  const cls = value !== undefined
    ? ok
      ? 'text-teal'
      : 'text-red-400'
    : 'text-muted'
  return (
    <div className="flex items-center justify-between rounded px-1.5 py-1 bg-tertiary/20 border border-theme/10">
      <span className="text-[8px] font-mono text-muted">{label}</span>
      <span className={`text-[9px] font-mono font-bold ${cls}`}>
        {value !== undefined ? `${value.toFixed(2)}${unit}` : '—'}
        <span className="ml-1 text-[7px] opacity-70">({status})</span>
      </span>
    </div>
  )
}

function ScreeningMini({ params, jurisdiction }: { params: { depth: number; temperature: number; pressure: number; porosity: number; permeability: number; thickness: number; netToGross: number; area: number; caprockFriction: number }; jurisdiction: string }) {
  const depth = Math.min(1, Math.max(0, (params.depth - 800) / 2200))
  const isSC = params.temperature > 31 && params.pressure > 7.38
  const phase = isSC ? 1 : 0.5
  const porosityScore = Math.min(1, params.porosity / 0.3)
  const permScore = Math.min(1, params.permeability / 1500)
  const thickScore = Math.min(1, params.thickness / 200)
  const ntgScore = Math.min(1, params.netToGross)
  const reservoir = porosityScore * 0.3 + permScore * 0.3 + thickScore * 0.25 + ntgScore * 0.15
  const frictionScore = Math.min(1, params.caprockFriction / 40)
  const caprock = 0.5 + frictionScore * 0.5
  const storageScore = Math.min(1, Math.log(1 + params.area * params.thickness * params.porosity) / 12)
  const regScores: Record<string, number> = { US: 0.8, EU: 0.85, Norway: 0.9, Australia: 0.75, Malaysia: 0.65 }
  const regulatory = regScores[jurisdiction] ?? 0.7
  const overall = (depth * 0.15 + phase * 0.15 + reservoir * 0.25 + caprock * 0.15 + storageScore * 0.2 + regulatory * 0.1) * 100

  const cls = overall < 30 ? 'text-red-400' : overall < 60 ? 'text-amber' : 'text-teal'
  const bg = overall < 30 ? 'bg-red-500' : overall < 60 ? 'bg-amber' : 'bg-teal'

  return (
    <div className="rounded px-2 py-2 border border-theme/30 bg-tertiary/20">
      <h3 className="text-[9px] text-muted font-mono mb-1 flex items-center gap-1"><Target size={10} /> Screening</h3>
      <div className={`text-lg font-bold font-mono ${cls}`}>{overall.toFixed(0)}</div>
      <div className="w-full h-1 rounded-full bg-tertiary overflow-hidden mt-1">
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${overall}%` }} />
      </div>
      <div className="text-[8px] text-muted/60 font-mono mt-1">
        {overall >= 70 ? 'Suitable' : overall >= 50 ? 'Marginal' : 'Poor'}
      </div>
    </div>
  )
}
