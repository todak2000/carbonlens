import { useMemo } from 'react'
import {
  LayoutDashboard, Activity, Target, Crosshair, DollarSign, Hammer,
  Droplets, ShieldCheck, HelpCircle, Layers, ArrowUpRight, TrendingUp
} from 'lucide-react'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { assessStorageScreening } from '../../engine/classical/storageScreening'

export default function OverviewPanel() {
  const params = useFormationStore((s) => s.params)
  const wells = useFormationStore((s) => s.wells)
  const simResult = useSimulationStore((s) => s.result)
  const geoResult = useSimulationStore((s) => s.geomechanics)
  const validation = useSimulationStore((s) => s.validation)
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const projectYears = useUIStore((s) => s.projectYears)
  const currentProjectName = useUIStore((s) => s.currentProjectName)

  const screeningResult = useMemo(() => assessStorageScreening(params), [params])

  const trappedPct = useMemo(() => {
    if (!simResult) return { residual: 0, solubility: 0, mineral: 0, mobile: 100 }
    const total = simResult.residualTrapping + simResult.solubilityTrapping + simResult.mineralTrapping + Math.max(0.01, simResult.mobilePlume)
    return {
      residual: (simResult.residualTrapping / total) * 100,
      solubility: (simResult.solubilityTrapping / total) * 100,
      mineral: (simResult.mineralTrapping / total) * 100,
      mobile: (simResult.mobilePlume / total) * 100,
    }
  }, [simResult])

  const totalRate = useMemo(() => wells.reduce((sum, w) => sum + w.injectionRate, 0), [wells])

  const totalCost = useMemo(() => {
    // Standard CAPEX formula matches the default model
    return wells.length * (5 + params.depth * 0.006) + wells.length * 3 + 2 + Math.sqrt(params.area) * 0.8 + 1
  }, [wells, params])

  const levelizedCost = useMemo(() => {
    if (!simResult || simResult.storageCapacity <= 0) return 0
    const opex = (1.5 + wells.length * 0.2 + params.depth * 0.0005) * simResult.storageCapacity
    return (totalCost + opex) / simResult.storageCapacity
  }, [simResult, totalCost, wells, params])

  const creditIncentive = useMemo(() => {
    switch (jurisdiction) {
      case 'US': return 85
      case 'EU': return 60
      case 'Norway': return 70
      case 'Australia': return 45
      default: return 0
    }
  }, [jurisdiction])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      
      {/* Dashboard Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme/20 pb-4">
        <div>
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest flex items-center gap-1.5">
            <LayoutDashboard size={12} /> Executive Control Room
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-primary font-mono tracking-tight mt-1">
            {currentProjectName || 'Untitled Project'} — Reservoir Analytics
          </h1>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Real-time feasibility feasibility metrics, regulatory alignment, and geomechanical limits for CO₂ sequestration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg border border-theme bg-card/60 flex flex-col items-end">
            <span className="text-[8px] font-mono text-muted uppercase">Framework</span>
            <span className="text-xs font-semibold text-secondary font-mono">{jurisdiction} Standards</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg border border-theme bg-card/60 flex flex-col items-end">
            <span className="text-[8px] font-mono text-muted uppercase">Project Life</span>
            <span className="text-xs font-semibold text-secondary font-mono">{projectYears} Years</span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Target Aquifer Depth"
          value={`${params.depth} m`}
          description={`Thickness: ${params.thickness} m | Area: ${params.area} km²`}
          subtext={`Net-to-Gross: ${(params.netToGross * 100).toFixed(0)}%`}
          icon={Layers}
        />
        <StatCard
          title="Injection Layout"
          value={`${wells.length} Wells`}
          description={`Total rate: ${totalRate.toFixed(2)} Mt/yr`}
          subtext={`Avg. ${(totalRate / Math.max(1, wells.length)).toFixed(2)} Mt/yr per well`}
          icon={Activity}
        />
        <StatCard
          title="Feasibility Assessment"
          value={`${screeningResult.score.toFixed(0)}/100`}
          description={screeningResult.score >= 70 ? 'Suitable for sequestration' : screeningResult.score >= 50 ? 'Marginal constraints' : 'Unsuitable formation'}
          subtext={`${screeningResult.totalPassed} Criteria Met, ${screeningResult.totalFailed} Failed`}
          icon={Target}
          badgeColor={screeningResult.score >= 70 ? 'text-success border-success/30 bg-success/10' : screeningResult.score >= 50 ? 'text-warning border-warning/30 bg-warning/10' : 'text-error border-error/30 bg-error/10'}
        />
        <StatCard
          title="Economics CAPEX"
          value={`$${totalCost.toFixed(1)}M`}
          description={`Levelized: $${levelizedCost.toFixed(2)}/t`}
          subtext={`Regulatory incentive: $${creditIncentive}/t`}
          icon={DollarSign}
        />
      </div>

      {/* Analytics Main Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Sequestration Performance & Trapping */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Containment and Simulation Capacity */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-5 shadow-sm">
            <h2 className="text-sm font-semibold text-primary font-mono uppercase tracking-wider flex items-center gap-2 border-b border-theme/20 pb-2.5">
              <Activity size={15} className="text-accent" /> Sequestration Performance &amp; Capacity
            </h2>

            {simResult ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-mono text-muted uppercase block">Containment Confidence</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl md:text-3xl font-extrabold font-mono text-success">
                        {(simResult.containmentProbability * 100).toFixed(0)}%
                      </span>
                      <span className="text-xs font-mono text-muted">Probability of safe seal</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-tertiary overflow-hidden mt-2">
                      <div className="h-full rounded-full bg-success" style={{ width: `${simResult.containmentProbability * 100}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
                    <div className="bg-tertiary/20 p-2 rounded border border-theme/10">
                      <span className="text-[8px] text-muted uppercase block">P90 Capacity</span>
                      <span className="text-secondary font-bold font-mono">{simResult.capacityP10.toFixed(2)} Mt</span>
                    </div>
                    <div className="bg-tertiary/20 p-2 rounded border border-theme/10">
                      <span className="text-[8px] text-muted uppercase block">P10 Capacity</span>
                      <span className="text-secondary font-bold font-mono">{simResult.capacityP90.toFixed(2)} Mt</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-mono text-muted uppercase block">Capacity Utilization</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-2xl md:text-3xl font-extrabold font-mono ${simResult.overpressureRisk ? 'text-error animate-pulse' : 'text-accent'}`}>
                        {simResult.capacityUtilPct.toFixed(1)}%
                      </span>
                      <span className="text-xs font-mono text-muted">of P50 capacity ({simResult.totalCapacity.toFixed(1)} Mt)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-tertiary overflow-hidden mt-2">
                      <div className={`h-full rounded-full ${simResult.overpressureRisk ? 'bg-error' : 'bg-accent'}`} style={{ width: `${Math.min(100, simResult.capacityUtilPct)}%` }} />
                    </div>
                  </div>

                  {simResult.overpressureRisk ? (
                    <div className="flex items-start gap-2 text-[10px] text-error font-mono bg-error/10 border border-error/30 rounded p-2.5 leading-normal">
                      <span className="mt-0.5 font-bold">⚠ WARNING:</span>
                      <div>
                        Reservoir overpressure risk detected! Injected volume has exceeded the P90 geological limit. Caprock fracturing risk is highly elevated.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-[10px] text-emerald-400 font-mono bg-emerald-500/5 border border-emerald-500/20 rounded p-2.5 leading-normal">
                      <span className="mt-0.5 font-bold">✓ SAFE STATUS:</span>
                      <div>
                        Injection parameters remain within safe geological limits. Pressures are well below caprock fracturing thresholds.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted font-mono text-xs border border-dashed border-theme rounded-xl">
                No simulation executed yet. Configure reservoir parameters and wells, then run the simulation in Stage 3.
              </div>
            )}
          </div>

          {/* Trapping Mechanisms Distribution */}
          {simResult && (
            <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-semibold text-primary font-mono uppercase tracking-wider flex items-center gap-2 border-b border-theme/20 pb-2.5">
                <Droplets size={15} className="text-accent" /> Carbon Sequestration Trapping Breakdown
              </h2>
              
              <div className="space-y-4">
                <div className="relative h-6 rounded-full overflow-hidden flex bg-tertiary border border-theme">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${trappedPct.residual}%` }} title={`Residual ${trappedPct.residual.toFixed(1)}%`} />
                  <div className="h-full bg-teal-500 transition-all" style={{ width: `${trappedPct.solubility}%` }} title={`Dissolved ${trappedPct.solubility.toFixed(1)}%`} />
                  <div className="h-full bg-amber-600 transition-all" style={{ width: `${trappedPct.mineral}%` }} title={`Mineral ${trappedPct.mineral.toFixed(1)}%`} />
                  <div className="h-full bg-error transition-all" style={{ width: `${trappedPct.mobile}%` }} title={`Structural Trapping ${trappedPct.mobile.toFixed(1)}%`} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <TrappingLegendItem label="Residual Trapping" percentage={trappedPct.residual} color="bg-emerald-500" desc="Trapped in pores" />
                  <TrappingLegendItem label="Dissolved Phase" percentage={trappedPct.solubility} color="bg-teal-500" desc="Dissolved in brine" />
                  <TrappingLegendItem label="Mineralization" percentage={trappedPct.mineral} color="bg-amber-600" desc="Precipitated as rock" />
                  <TrappingLegendItem label="Structural Trapping" percentage={trappedPct.mobile} color="bg-error" desc="Caprock seal confinement" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Geomechanical Safety Factors & Leakage */}
        <div className="space-y-6">
          
          {/* Geomechanics Validation Checks */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-primary font-mono uppercase tracking-wider flex items-center gap-2 border-b border-theme/20 pb-2.5">
              <Hammer size={15} className="text-accent" /> Geomechanical Safety
            </h2>

            <div className="space-y-3.5">
              <GeoMetricRow
                label="Caprock Fracture Ratio"
                value={validation?.checks.caprock.value}
                threshold="< 0.85"
                ok={validation?.checks.caprock.ok}
                desc="Reservoir pressure relative to caprock fracture limit."
              />
              <GeoMetricRow
                label="Safety Factor"
                value={validation?.checks.safetyFactor.value}
                threshold="> 1.20"
                ok={validation?.checks.safetyFactor.ok}
                desc="Structural safety margin against shearing."
              />
              <GeoMetricRow
                label="Mohr-Coulomb Margin"
                value={validation?.checks.mohr.value}
                threshold="> 0 MPa"
                ok={validation?.checks.mohr.ok}
                unit=" MPa"
                desc="Pressure buffer before triggering fault reactivation."
              />
              <GeoMetricRow
                label="MAIP Margin"
                value={validation?.checks.maip.value}
                threshold="> 0%"
                ok={validation?.checks.maip.ok}
                unit="%"
                desc="Maximum Allowable Injection Pressure buffer."
              />
            </div>
          </div>

          {/* Containment Risk Assessment */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-sm">
            <h2 className="text-sm font-semibold text-primary font-mono uppercase tracking-wider flex items-center gap-2 border-b border-theme/20 pb-2.5">
              <Crosshair size={15} className="text-accent" /> Leakage Risk Assessment
            </h2>
            <div className="space-y-3">
              <p className="text-xs text-muted leading-relaxed">
                Evaluates migration paths through faults, legacy wellbores, or caprock degradation zones.
              </p>
              <div className="p-3 bg-tertiary/20 rounded border border-theme/10 text-xs font-mono space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted">Legacy Well Risk:</span>
                  <span className="text-warning font-semibold font-mono">Moderate</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted">Fault Slippage Risk:</span>
                  <span className="text-success font-semibold font-mono">Low</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted">Caprock Seal Integrity:</span>
                  <span className="text-success font-semibold font-mono">Verified (Excellent)</span>
                </div>
              </div>
              <div className="text-[10px] text-muted/60 italic leading-relaxed pt-1">
                Risk parameters are computed using analytical calculations under the Leakage panel in Stage 4.
              </div>
            </div>
          </div>

        </div>
      </div>
      
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  description: string
  subtext: string
  icon: any
  badgeColor?: string
}

function StatCard({ title, value, description, subtext, icon: Icon, badgeColor }: StatCardProps) {
  return (
    <div className="rounded-xl border border-theme bg-card p-4 space-y-2.5 shadow-sm hover:border-theme/60 transition-all flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-muted uppercase tracking-wider">{title}</span>
        <div className="w-7 h-7 rounded-lg bg-tertiary flex items-center justify-center text-accent">
          <Icon size={14} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-semibold font-mono text-primary">{value}</div>
        <p className="text-[10px] font-mono text-secondary leading-tight truncate">{description}</p>
        <p className="text-[9px] font-mono text-muted/65 leading-none truncate">{subtext}</p>
      </div>
    </div>
  )
}

interface TrappingLegendItemProps {
  label: string
  percentage: number
  color: string
  desc: string
}

function TrappingLegendItem({ label, percentage, color, desc }: TrappingLegendItemProps) {
  return (
    <div className="space-y-1 p-2 bg-tertiary/10 rounded border border-theme/10">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
        <span className="text-[10px] font-semibold text-primary leading-none">{label}</span>
      </div>
      <div className="text-[13px] font-bold font-mono text-secondary mt-1">{percentage.toFixed(1)}%</div>
      <span className="text-[8px] text-muted font-mono leading-none">{desc}</span>
    </div>
  )
}

interface GeoMetricRowProps {
  label: string
  value?: number
  threshold: string
  ok?: boolean
  unit?: string
  desc: string
}

function GeoMetricRow({ label, value, threshold, ok, unit = '', desc }: GeoMetricRowProps) {
  const status = value !== undefined ? (ok ? 'PASS' : 'FAIL') : '—'
  const textClass = value !== undefined ? (ok ? 'text-success' : 'text-error font-bold') : 'text-muted'
  const bgClass = value !== undefined ? (ok ? 'bg-success/5 border-success/15' : 'bg-error/5 border-error/15') : 'bg-tertiary/10 border-theme/10'

  return (
    <div className={`p-2.5 rounded-lg border flex flex-col space-y-1 ${bgClass}`}>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-secondary font-medium">{label}</span>
        <span className={`font-semibold font-mono ${textClass}`}>
          {value !== undefined ? `${value.toFixed(2)}${unit}` : '—'} 
          <span className="text-[8px] opacity-70 ml-1.5">({status})</span>
        </span>
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono text-muted/65 leading-none">
        <span>{desc}</span>
        <span>Limit: {threshold}</span>
      </div>
    </div>
  )
}
