import { useMemo } from 'react'
import { Shield, Database, BadgeCheck, ArrowUpRight, Activity, PiggyBank, FileCheck } from 'lucide-react'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'

function mockTxId(i: number): string {
  const chars = '0123456789abcdef'
  let h = ''
  for (let j = 0; j < 16; j++) h += chars[Math.floor(Math.random() * chars.length)]
  return `0x${h}...${String(i).padStart(4, '0')}`
}

export default function RegistryPanel() {
  const params = useFormationStore((s) => s.params)
  const result = useSimulationStore((s) => s.result)
  const geomech = useSimulationStore((s) => s.geomechanics)
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const projectYears = useUIStore((s) => s.projectYears)
  const setPanel = useUIStore((s) => s.setPanel)

  const assetId = useMemo(() => {
    const h = params.depth.toString(16).padStart(4, '0')
    const p = (params.porosity * 100).toFixed(0).padStart(2, '0')
    const a = params.area.toFixed(0).padStart(3, '0')
    return `CL-${h}-${p}-${a}`
  }, [params])

  const containmentOk = result ? result.containmentProbability >= 0.85 : false
  const geomechOk = geomech ? !geomech.mohrFailed && geomech.safetyFactor >= 1.2 : false
  const verified = result && geomech && containmentOk && geomechOk
  const warning = result && geomech && (result.containmentProbability >= 0.6 && result.containmentProbability < 0.85)
  const failed = result && geomech && (result.containmentProbability < 0.6 || geomech.mohrFailed)

  const totalCredits = useMemo(() => {
    if (!result) return 0
    const rate = jurisdiction === 'US' ? 85 : jurisdiction === 'EU' ? 60 : jurisdiction === 'Australia' ? 45 : 70
    return result.storageCapacity * rate
  }, [result, jurisdiction])

  const yearlyRate = useMemo(() => {
    if (!result) return 0
    return result.storageCapacity / Math.max(1, projectYears)
  }, [result, projectYears])

  const mockTxns = useMemo(() => {
    if (!result) return []
    const rate = jurisdiction === 'US' ? 85 : jurisdiction === 'EU' ? 60 : jurisdiction === 'Australia' ? 45 : 70
    const yrs = Math.min(5, projectYears)
    const perYear = result.storageCapacity / Math.max(1, projectYears)
    const txns = []
    for (let y = 1; y <= yrs; y++) {
      const credits = perYear * rate
      txns.push({
        id: mockTxId(y),
        year: 2026 + y - 1,
        label: `Year ${y} verification`,
        credits: Math.round(credits),
        status: y <= 3 ? 'confirmed' as const : 'pending' as const,
      })
    }
    return txns
  }, [result, jurisdiction, projectYears])

  const statusBadge = verified
    ? { label: 'Verified', color: 'bg-teal-900/20 border-teal-500/40 text-teal-300' }
    : warning
    ? { label: 'Review Required', color: 'bg-amber-900/20 border-amber-500/40 text-amber-300' }
    : failed
    ? { label: 'Non-Compliant', color: 'bg-red-900/30 border-red-500/40 text-red-300' }
    : { label: 'Not Assessed', color: 'bg-tertiary/30 border-theme/30 text-muted' }

  return (
    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
        <Database size={13} /> Digital Twin Registry
      </h2>

      {/* Asset ID & Status */}
      <div className="rounded px-3 py-2 border border-theme/30 bg-tertiary/20 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted font-mono uppercase tracking-wider">Asset ID</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield size={14} className={verified ? 'text-teal' : warning ? 'text-amber' : 'text-muted'} />
          <span className="text-[13px] font-mono font-bold text-primary tracking-wider">{assetId}</span>
        </div>
        <div className="text-[8px] text-muted/50 font-mono flex items-center gap-2">
          <span>Jurisdiction: {jurisdiction}</span>
          <span>·</span>
          <span>Depth: {params.depth}m</span>
          <span>·</span>
          <span>Area: {params.area}km²</span>
        </div>
      </div>

      {/* Verification Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded px-2 py-1.5 border text-[10px] font-mono ${containmentOk ? 'bg-teal-900/20 border-teal-500/40 text-teal-300' : result ? 'bg-amber-900/20 border-amber-500/40 text-amber-300' : 'bg-tertiary/30 border-theme/30 text-muted'}`}>
          <span className="uppercase tracking-wider text-[8px] opacity-70">Containment</span>
          <div className="mt-0.5 font-bold flex items-center gap-1">
            {result ? `${(result.containmentProbability * 100).toFixed(0)}%` : '—'}
            {containmentOk && <BadgeCheck size={11} />}
          </div>
        </div>
        <div className={`rounded px-2 py-1.5 border text-[10px] font-mono ${geomechOk ? 'bg-teal-900/20 border-teal-500/40 text-teal-300' : geomech ? 'bg-amber-900/20 border-amber-500/40 text-amber-300' : 'bg-tertiary/30 border-theme/30 text-muted'}`}>
          <span className="uppercase tracking-wider text-[8px] opacity-70">Geomechanics</span>
          <div className="mt-0.5 font-bold flex items-center gap-1">
            {geomech ? `${geomech.safetyFactor.toFixed(2)} SF` : '—'}
            {geomechOk && <BadgeCheck size={11} />}
          </div>
        </div>
      </div>

      {/* Storage Summary */}
      {result && (
        <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
          <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1"><Database size={11} /> Storage Account</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono">
            <span className="text-muted">Injected CO₂</span>
            <span className="text-secondary text-right font-bold">{result.storageCapacity.toFixed(2)} Mt</span>
            <span className="text-muted">Total Capacity</span>
            <span className="text-secondary text-right font-bold">{result.totalCapacity.toFixed(2)} Mt</span>
            <span className="text-muted">Utilization</span>
            <span className="text-secondary text-right font-bold">{result.capacityUtilPct.toFixed(1)}%</span>
            <span className="text-muted">Plume Radius</span>
            <span className="text-secondary text-right font-bold">{result.plumeRadius.toFixed(0)} m</span>
          </div>
        </div>
      )}

      {/* Pressure Integrity */}
      {geomech && (
        <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
          <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1"><Activity size={11} /> Pressure Integrity</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono">
            <span className="text-muted">Injection Pressure</span>
            <span className="text-secondary text-right font-bold">{result?.injectionPressure.toFixed(1) ?? '—'} MPa</span>
            <span className="text-muted">MAIP Limit</span>
            <span className="text-secondary text-right font-bold">{geomech.maip.toFixed(1)} MPa</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-tertiary overflow-hidden">
              <div className={`h-full rounded-full transition-all ${geomech.maipMargin > 20 ? 'bg-teal' : geomech.maipMargin > 0 ? 'bg-amber' : 'bg-red-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, geomech.maipMargin))}%` }} />
            </div>
            <span className={`text-[10px] font-mono font-bold ${geomech.maipMargin > 20 ? 'text-teal' : geomech.maipMargin > 0 ? 'text-amber' : 'text-red-400'}`}>
              {geomech.maipMargin.toFixed(1)}% margin
            </span>
          </div>
        </div>
      )}

      {/* Leakage Proof */}
      {result && (
        <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
          <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1"><FileCheck size={11} /> Containment Proof</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono">
            <span className="text-muted">Mobile Plume</span>
            <span className="text-secondary text-right font-bold">{result.mobilePlume.toFixed(2)} Mt</span>
            <span className="text-muted">Residual Trapping</span>
            <span className="text-secondary text-right font-bold">{result.residualTrapping.toFixed(2)} Mt</span>
            <span className="text-muted">Solubility Trapping</span>
            <span className="text-secondary text-right font-bold">{result.solubilityTrapping.toFixed(2)} Mt</span>
            <span className="text-muted">Overpressure Risk</span>
            <span className={`text-right font-bold ${result.overpressureRisk ? 'text-red-400' : 'text-teal'}`}>
              {result.overpressureRisk ? '⚠ Yes' : 'None'}
            </span>
          </div>
        </div>
      )}

      {/* Verified Credit Ledger */}
      <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
        <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1"><PiggyBank size={11} className="text-amber-400" /> Credit Ledger</h3>
        {result ? (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[9px] text-muted font-mono">Total Verified Credits</span>
              <span className="text-[16px] font-mono font-bold text-amber-300">{totalCredits.toFixed(0)}</span>
            </div>
            <div className="space-y-1">
              {mockTxns.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-[9px] font-mono border-b border-theme/10 pb-1 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'confirmed' ? 'bg-teal' : 'bg-amber'}`} />
                    <span className="text-muted">{tx.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-secondary">{tx.credits.toLocaleString()} credits</span>
                    <span className="text-[7px] text-muted/50 font-mono">{tx.id}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setPanel('economics')}
              className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded bg-amber-900/20 border border-amber-500/30 text-[10px] font-mono text-amber-300 hover:bg-amber-900/30 transition">
              <ArrowUpRight size={11} /> View Economics
            </button>
          </>
        ) : (
          <p className="text-[10px] text-muted/60 font-mono italic">Run simulation to generate credit ledger</p>
        )}
      </div>

      {/* Not Assessed hint */}
      {!result && (
        <div className="rounded px-2 py-2 border border-dashed border-theme/20 text-[9px] text-muted/50 font-mono text-center">
          Run a simulation to assess storage integrity and generate the digital twin registry.
        </div>
      )}
    </div>
  )
}
