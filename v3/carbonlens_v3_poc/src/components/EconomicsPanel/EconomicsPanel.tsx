import { useMemo } from 'react'
import { DollarSign, PiggyBank, Factory, GanttChartSquare, ArrowUpRight } from 'lucide-react'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'

export default function EconomicsPanel() {
  const params = useFormationStore((s) => s.params)
  const wells = useFormationStore((s) => s.wells)
  const simResult = useSimulationStore((s) => s.result)
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const projectYears = useUIStore((s) => s.projectYears)

  const econ = useMemo(() => {
    const nWells = Math.max(1, wells.length)

    const totalStored = simResult?.storageCapacity ?? 0
    const yearlyRate = totalStored > 0 ? totalStored / Math.max(1, projectYears) : wells.reduce((s, w) => s + w.injectionRate, 0)

    const depth = params.depth
    const area = params.area

    const drillCost = nWells * (5 + depth * 0.006)
    const facilityCost = nWells * 3 + 2
    const pipelineCost = Math.sqrt(area) * 0.8 + 1
    const monitoringCost = Math.sqrt(area) * 0.15 + 0.5
    const capex = drillCost + facilityCost + pipelineCost + monitoringCost

    const opexPerTonne = 1.5 + nWells * 0.2 + depth * 0.0005
    const totalOpex = opexPerTonne * Math.max(totalStored, yearlyRate * projectYears)

    const discountRate = 0.08
    const credit45q = jurisdiction === 'US' ? 85 : jurisdiction === 'EU' ? 60 : jurisdiction === 'Australia' ? 45 : jurisdiction === 'Norway' ? 70 : 0
    const carbonPrice = Math.max(credit45q, 10)
    let npv = -capex
    for (let y = 1; y <= projectYears; y++) {
      const rev = carbonPrice * yearlyRate
      const op = opexPerTonne * yearlyRate
      npv += (rev - op) / Math.pow(1 + discountRate, y)
    }

    const breakevenCost = totalStored > 0.001
      ? (capex + totalOpex) / totalStored
      : (capex + totalOpex) / Math.max(0.001, yearlyRate * projectYears)


    const netAfterCredit = breakevenCost - credit45q
    const creditRevenue = credit45q * Math.max(totalStored, yearlyRate * projectYears)

    let npvWithCredit = -capex
    for (let y = 1; y <= projectYears; y++) {
      const rev = credit45q * yearlyRate
      const op = opexPerTonne * yearlyRate
      npvWithCredit += (rev - op) / Math.pow(1 + discountRate, y)
    }

    return {
      drillCost, facilityCost, pipelineCost, monitoringCost, capex,
      opexPerTonne, totalOpex, npv, breakevenCost,
      credit45q, netAfterCredit, creditRevenue, npvWithCredit, yearlyRate, totalStored, nWells, depth, area,
    }
  }, [params, wells, simResult, jurisdiction, projectYears])

  return (
    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
        <DollarSign size={13} /> Economics & 45Q
      </h2>

      <div className="text-[8px] text-muted/50 font-mono">
        {econ.nWells} well(s), {params.depth}m depth, {params.area}km² area
      </div>

      {/* CAPEX Breakdown */}
      <div>
        <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1"><Factory size={11} /> CAPEX Breakdown</h3>
        <div className="space-y-1">
          <CapexRow label="Drilling" value={econ.drillCost} pct={econ.drillCost / econ.capex * 100} color="bg-blue-500" />
          <CapexRow label="Surface Facilities" value={econ.facilityCost} pct={econ.facilityCost / econ.capex * 100} color="bg-teal-500" />
          <CapexRow label="Pipeline" value={econ.pipelineCost} pct={econ.pipelineCost / econ.capex * 100} color="bg-amber-500" />
          <CapexRow label="Monitoring" value={econ.monitoringCost} pct={econ.monitoringCost / econ.capex * 100} color="bg-purple-500" />
          <div className="flex justify-between text-[11px] font-mono pt-1 border-t border-theme/20">
            <span className="text-primary font-semibold">Total CAPEX</span>
            <span className="text-secondary font-bold">${econ.capex.toFixed(1)}M</span>
          </div>
        </div>
      </div>

      {/* OPEX */}
      <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
        <h3 className="text-[10px] text-muted font-mono mb-1">OPEX</h3>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <div><span className="text-muted">Per tonne</span><br /><span className="text-primary font-bold">${econ.opexPerTonne.toFixed(2)}/t</span></div>
          <div><span className="text-muted">Total</span><br /><span className="text-primary font-bold">${econ.totalOpex.toFixed(1)}M</span></div>
        </div>
      </div>

      {/* Levelized Cost */}
      <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
        <h3 className="text-[10px] text-muted font-mono mb-1">Levelized Cost</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-mono font-bold text-accent">${econ.breakevenCost.toFixed(2)}</span>
          <span className="text-[9px] text-muted font-mono">/ tonne</span>
        </div>
        {econ.totalStored < 0.001 && (
          <p className="text-[8px] text-warning mt-1 italic">Estimated from formation params — run simulation for actual total</p>
        )}
      </div>

      {/* 45Q Credits */}
      {jurisdiction === 'US' && (
        <div className="rounded px-2 py-1.5 border border-amber-500/30 bg-amber-900/10">
          <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1"><PiggyBank size={11} className="text-warning" /> 45Q Tax Credit</h3>
          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
            <div><span className="text-muted">Credit rate</span><br /><span className="text-warning font-bold">${econ.credit45q}/t</span></div>
            <div><span className="text-muted">Revenue</span><br /><span className="text-warning font-bold">${econ.creditRevenue.toFixed(1)}M</span></div>
            <div className="col-span-2">
              <span className="text-muted">Net cost after credit</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold font-mono ${econ.netAfterCredit < 0 ? 'text-success' : 'text-warning'}`}>
                  ${econ.netAfterCredit.toFixed(2)}
                </span>
                <span className="text-[9px] text-muted font-mono">/ tonne</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {jurisdiction !== 'US' && (
        <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
          <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1"><GanttChartSquare size={11} /> Incentive</h3>
          <div className="text-[10px] font-mono">
            <span className="text-muted">Equivalent credit</span><br />
            <span className="text-primary font-bold">${econ.credit45q}/t</span>
            <p className="text-[8px] text-muted/60 mt-1">Based on jurisdiction ({jurisdiction}) carbon pricing mechanism</p>
          </div>
        </div>
      )}

      {/* Tokenize action */}
      {jurisdiction === 'US' && simResult && (
        <button onClick={() => useUIStore.getState().setPanel('registry')}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded border border-amber-500/30 bg-amber-900/10 text-[10px] font-mono text-warning hover:bg-amber-900/20 transition">
          <ArrowUpRight size={12} /> Tokenize Credits
        </button>
      )}

      {/* NPV */}
      <div className="space-y-1.5">
        <Row label="Discount Rate" value="8.0%" />
        <Row label="NPV (no credits)" value={`${econ.npv < 0 ? '' : '+'}$${econ.npv.toFixed(1)}M`} negative={econ.npv < 0} />
        <Row label="NPV (with credits)" value={`${econ.npvWithCredit < 0 ? '' : '+'}$${econ.npvWithCredit.toFixed(1)}M`} negative={econ.npvWithCredit < 0} />
      </div>

      {/* Cost drivers */}
      <div className="text-[8px] text-muted/50 font-mono space-y-0.5 pt-1 border-t border-theme/20">
        <div>Drill: ${econ.drillCost.toFixed(1)}M ({econ.depth.toFixed(0)}m × {econ.nWells} wells)</div>
        <div>Pipeline: ${econ.pipelineCost.toFixed(1)}M (√{econ.area.toFixed(0)}km² × 0.8)</div>
        <div>OPEX: ${econ.opexPerTonne.toFixed(2)}/t (1.5 base + {econ.nWells} wells × 0.2 + {econ.depth.toFixed(0)}m × 0.0005)</div>
      </div>
    </div>
  )
}

function CapexRow({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-muted">{label}</span>
        <span className="text-secondary">${value.toFixed(1)}M</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-tertiary overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return <div className="flex justify-between"><span className="text-[11px] text-muted font-mono">{label}</span><span className={`text-[11px] font-mono ${negative ? 'text-error' : 'text-secondary'}`}>{value}</span></div>
}
