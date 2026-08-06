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
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme/20 pb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={20} className="text-accent" /> Carbon Storage Economics &amp; Incentives
          </h1>
          <p className="text-xs text-muted font-mono mt-0.5">
            {econ.nWells} injector well(s) · {params.depth} m depth · {params.area} km² footprint area
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Cost breakdowns (60% width equivalent: col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* CAPEX Breakdown */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2 flex items-center gap-1.5">
              <Factory size={13} /> Capital Expenditures (CAPEX)
            </h3>
            <div className="space-y-3.5">
              <CapexRow label="Drilling &amp; Well Development" value={econ.drillCost} pct={econ.drillCost / econ.capex * 100} color="bg-blue-500" />
              <CapexRow label="Surface Facilities &amp; Subsea Trees" value={econ.facilityCost} pct={econ.facilityCost / econ.capex * 100} color="bg-teal-500" />
              <CapexRow label="CO₂ Transport Pipeline" value={econ.pipelineCost} pct={econ.pipelineCost / econ.capex * 100} color="bg-amber-500" />
              <CapexRow label="4D Monitoring Systems" value={econ.monitoringCost} pct={econ.monitoringCost / econ.capex * 100} color="bg-purple-500" />
              
              <div className="flex justify-between text-xs font-mono pt-3 border-t border-theme/20">
                <span className="text-primary font-bold">Total Estimated CAPEX</span>
                <span className="text-secondary font-bold text-sm">${econ.capex.toFixed(2)}M</span>
              </div>
            </div>
          </div>

          {/* OPEX */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2">
              Operational Expenditures (OPEX)
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-tertiary/20 p-3 rounded-lg border border-theme/10">
                <span className="text-muted block uppercase text-[10px]">Levelized OPEX / tonne</span>
                <span className="font-bold text-primary text-sm">${econ.opexPerTonne.toFixed(2)} / t</span>
              </div>
              <div className="bg-tertiary/20 p-3 rounded-lg border border-theme/10">
                <span className="text-muted block uppercase text-[10px]">Total Lifecycle OPEX</span>
                <span className="font-bold text-primary text-sm">${econ.totalOpex.toFixed(2)}M</span>
              </div>
            </div>
          </div>

          {/* Cost drivers details */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-2.5 shadow-md text-xs font-mono">
            <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider block border-b border-theme/10 pb-2">
              Lifecycle Cost Drivers Details
            </span>
            <div className="space-y-1.5 text-muted leading-relaxed">
              <div>· Drilling Cost: ${econ.drillCost.toFixed(2)}M based on {econ.depth.toFixed(0)}m target depth &amp; {econ.nWells} wells.</div>
              <div>· Pipeline infrastructure: ${econ.pipelineCost.toFixed(2)}M based on average grid size of {econ.area.toFixed(1)} km².</div>
              <div>· Operational rate: ${econ.opexPerTonne.toFixed(2)}/t ($1.50 base + $0.20 per injector well + $0.0005 per meter depth factor).</div>
            </div>
          </div>

        </div>

        {/* Right Column: Economics NPV & incentives (40% width equivalent: col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Levelized Cost */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-2 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-theme/10 pb-2">
              Levelized Carbon Storage Cost
            </h3>
            <div className="flex items-baseline gap-1 py-1">
              <span className="text-2xl font-mono font-bold text-accent">${econ.breakevenCost.toFixed(2)}</span>
              <span className="text-xs text-muted font-mono ml-2">/ tonne CO₂ breakeven</span>
            </div>
            {econ.totalStored < 0.001 && (
              <p className="text-[10px] text-warning italic font-mono">Estimated from formation parameters. Run simulation for dynamic lifecycle values.</p>
            )}
          </div>

          {/* Credits Incentive */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-theme/10 pb-2">
              <PiggyBank size={14} className="text-accent" /> 45Q &amp; Jurisdictional Incentives
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-tertiary/20 p-3 rounded-lg border border-theme/10">
                <span className="text-muted block uppercase text-[10px]">Credit rate ({jurisdiction})</span>
                <span className="font-bold text-primary text-sm">${econ.credit45q} / t</span>
              </div>
              <div className="bg-tertiary/20 p-3 rounded-lg border border-theme/10">
                <span className="text-muted block uppercase text-[10px]">Lifecycle Credits</span>
                <span className="font-bold text-primary text-sm">${econ.creditRevenue.toFixed(2)}M</span>
              </div>
              <div className="col-span-2 bg-tertiary/20 p-3 rounded-lg border border-theme/10 flex justify-between items-center">
                <div>
                  <span className="text-muted block uppercase text-[10px]">Net cost after credit</span>
                  <span className={`text-base font-bold font-mono ${econ.netAfterCredit < 0 ? 'text-success' : 'text-warning'}`}>
                    ${econ.netAfterCredit.toFixed(2)} / t
                  </span>
                </div>
                {econ.netAfterCredit < 0 && (
                  <span className="text-[10px] text-success border border-success/30 bg-success/10 px-2 py-0.5 rounded uppercase font-bold">NPV+ Profitable</span>
                )}
              </div>
            </div>

            {/* Tokenize credit button if US */}
            {jurisdiction === 'US' && simResult && (
              <button onClick={() => useUIStore.getState().setPanel('registry')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-accent/40 bg-accent/15 text-xs font-mono text-accent hover:bg-accent/25 transition font-bold"
              >
                <ArrowUpRight size={14} /> Tokenize &amp; Register Credits
              </button>
            )}
          </div>

          {/* NPV summary */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3.5 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-theme/10 pb-2">
              Discounted NPV Analysis
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <Row label="Discount Rate (WACC)" value="8.0%" />
              <Row label="NPV (without credits)" value={`${econ.npv < 0 ? '' : '+'}$${econ.npv.toFixed(2)}M`} negative={econ.npv < 0} />
              <Row label="NPV (with tax credits)" value={`${econ.npvWithCredit < 0 ? '' : '+'}$${econ.npvWithCredit.toFixed(2)}M`} negative={econ.npvWithCredit < 0} />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function CapexRow({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-muted">{label}</span>
        <span className="text-secondary font-bold">${value.toFixed(2)}M</span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-theme/10">
      <span className="text-secondary font-mono">{label}</span>
      <span className={`font-bold font-mono ${negative ? 'text-error' : 'text-success'}`}>{value}</span>
    </div>
  )
}
