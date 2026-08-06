import { useMemo, useState, useEffect } from 'react'
import { Shield, Database, BadgeCheck, ArrowUpRight, Activity, PiggyBank, FileCheck, ExternalLink, Pencil } from 'lucide-react'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'

export interface CertificateRecord {
  assetId: string
  savedAt: string
  formationName: string
  jurisdiction: string
  depth: number
  area: number
  porosity: number
  status: 'Verified' | 'Review Required' | 'Non-Compliant'
  containmentProbability: number
  safetyFactor: number
  storageCapacity: number
  totalCapacity: number
  plumeRadius: number
  injectionPressure: number
  maip: number
  maipMargin: number
  mobilePlume: number
  residualTrapping: number
  solubilityTrapping: number
  overpressureRisk: boolean
  totalCredits: number
  projectYears: number
}

function mockTxId(i: number): string {
  const chars = '0123456789abcdef'
  let h = ''
  for (let j = 0; j < 16; j++) h += chars[Math.floor(Math.random() * chars.length)]
  return `0x${h}...${String(i).padStart(4, '0')}`
}

export default function RegistryPanel() {
  const params = useFormationStore((s) => s.params)
  const activePresetName = useFormationStore((s) => s.activePresetName)
  const result = useSimulationStore((s) => s.result)
  const geomech = useSimulationStore((s) => s.geomechanics)
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const projectYears = useUIStore((s) => s.projectYears)
  const setPanel = useUIStore((s) => s.setPanel)
  const [certSaved, setCertSaved] = useState(false)
  const [certSavedId, setCertSavedId] = useState<string | null>(null)
  const [formationLabel, setFormationLabel] = useState<string>('')
  const [editingLabel, setEditingLabel] = useState(false)

  useEffect(() => {
    setFormationLabel(activePresetName ?? 'Custom Formation')
    setCertSaved(false)
    setCertSavedId(null)
  }, [activePresetName])

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
        label: `Year ${y} Verification`,
        credits: Math.round(credits),
        status: y <= 3 ? 'confirmed' as const : 'pending' as const,
      })
    }
    return txns
  }, [result, jurisdiction, projectYears])

  const statusBadge = verified
    ? { label: 'Verified', color: 'bg-success/20 border-success text-success' }
    : warning
    ? { label: 'Review Required', color: 'bg-warning/20 border-warning text-warning' }
    : failed
    ? { label: 'Non-Compliant', color: 'bg-error/20 border-error text-error font-bold' }
    : { label: 'Not Assessed', color: 'bg-tertiary border-theme/20 text-secondary font-semibold' }

  const certStatus: CertificateRecord['status'] = verified
    ? 'Verified'
    : warning
    ? 'Review Required'
    : 'Non-Compliant'

  const handleSaveCertificate = () => {
    if (!result || !geomech) return
    const name = formationLabel.trim() || activePresetName || 'Custom Formation'
    const record: CertificateRecord = {
      assetId,
      savedAt: new Date().toISOString(),
      formationName: name,
      jurisdiction,
      depth: params.depth,
      area: params.area,
      porosity: params.porosity,
      status: certStatus,
      containmentProbability: result.containmentProbability,
      safetyFactor: geomech.safetyFactor,
      storageCapacity: result.storageCapacity,
      totalCapacity: result.totalCapacity,
      plumeRadius: result.plumeRadius,
      injectionPressure: result.injectionPressure,
      maip: geomech.maip,
      maipMargin: geomech.maipMargin,
      mobilePlume: result.mobilePlume,
      residualTrapping: result.residualTrapping,
      solubilityTrapping: result.solubilityTrapping,
      overpressureRisk: result.overpressureRisk,
      totalCredits: totalCredits,
      projectYears,
    }
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem('carbonlens_certificates') ?? '{}') } catch { return {} }
    })()
    existing[assetId] = record
    localStorage.setItem('carbonlens_certificates', JSON.stringify(existing))
    setCertSaved(true)
    setCertSavedId(assetId)
  }

  const certUrl = certSavedId
    ? `${window.location.origin}/registry/verify/${certSavedId}`
    : null

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme/20 pb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <Database size={20} className="text-accent" /> Digital Twin Asset Registry
          </h1>
          <p className="text-xs text-muted font-mono mt-0.5">
            Cryptographic storage certification ledger and immutable verification records
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Asset info, name editor, certificate actions (60% width equivalent: col-span-7) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Asset Info Card */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-theme/10 pb-2">
              <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">Asset Information</span>
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
            
            <div className="flex items-center gap-2.5">
              <Shield size={20} className={verified ? 'text-success' : warning ? 'text-warning' : 'text-muted'} />
              <span className="text-base font-mono font-bold text-primary tracking-wider">{assetId}</span>
            </div>
            
            <div className="text-xs text-muted leading-relaxed font-mono space-y-1 bg-page/40 p-3 rounded-lg border border-theme/20">
              <div>· Jurisdiction: <span className="text-secondary font-semibold">{jurisdiction} Compliance Framework</span></div>
              <div>· Formation Depth: <span className="text-secondary font-semibold">{params.depth} m (Appraisal Boundary)</span></div>
              <div>· Reservoir Footprint: <span className="text-secondary font-semibold">{params.area} km²</span></div>
            </div>
          </div>

          {/* Formation name for certificate */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">Formation Label Details</span>
              <button
                onClick={() => setEditingLabel((v) => !v)}
                className="text-xs font-mono text-accent hover:text-accent-hover flex items-center gap-1 transition"
              >
                <Pencil size={11} /> {editingLabel ? 'Finish' : 'Edit'}
              </button>
            </div>
            
            {editingLabel ? (
              <input
                type="text"
                value={formationLabel}
                onChange={(e) => setFormationLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingLabel(false)}
                placeholder="Enter formation name…"
                autoFocus
                className="w-full bg-slate-800 border border-theme/30 rounded px-3 py-2 text-xs font-mono text-primary outline-none focus:border-accent"
              />
            ) : (
              <div className="text-sm font-mono font-bold text-primary bg-page/40 px-3 py-2 rounded-lg border border-theme/20 truncate">
                {formationLabel || 'Custom Formation'}
              </div>
            )}
            <p className="text-[10px] text-muted/65 font-mono">This label will be printed on the cryptographic storage verification certificate.</p>
          </div>

          {/* Containment proof breakdown */}
          {result && (
            <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3 shadow-md">
              <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-theme/10 pb-2">
                Containment Proof &amp; Trapping States
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-tertiary/20 p-3 rounded-lg border border-theme/10 flex justify-between">
                  <span className="text-muted font-semibold">Structural Trapping</span>
                  <span className="text-secondary font-bold">{result.mobilePlume.toFixed(2)} Mt</span>
                </div>
                <div className="bg-tertiary/20 p-3 rounded-lg border border-theme/10 flex justify-between">
                  <span className="text-muted font-semibold">Residual Trapping</span>
                  <span className="text-secondary font-bold">{result.residualTrapping.toFixed(2)} Mt</span>
                </div>
                <div className="bg-tertiary/20 p-3 rounded-lg border border-theme/10 flex justify-between">
                  <span className="text-muted font-semibold">Solubility Trapping</span>
                  <span className="text-secondary font-bold">{result.solubilityTrapping.toFixed(2)} Mt</span>
                </div>
                <div className="bg-tertiary/20 p-3 rounded-lg border border-theme/10 flex justify-between">
                  <span className="text-muted font-semibold">Overpressure Risk</span>
                  <span className={`font-bold ${result.overpressureRisk ? 'text-error' : 'text-success'}`}>
                    {result.overpressureRisk ? 'Critical Warning' : 'No Threat'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Certificate Actions */}
          {result && geomech && (
            <div className="flex gap-4">
              <button
                onClick={handleSaveCertificate}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-400 hover:bg-emerald-500/20 transition shadow"
              >
                <FileCheck size={14} /> Cryptographic Seal Asset
              </button>
              <button
                disabled={!certSaved}
                onClick={() => certUrl && window.open(certUrl, '_blank')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs font-mono font-bold text-blue-400 hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
              >
                <ExternalLink size={14} /> Download Certificate (PDF)
              </button>
            </div>
          )}
          {certSaved && certUrl && (
            <div className="rounded-xl px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 text-xs font-mono text-emerald-400 break-all leading-normal">
              Certificate recorded on ledger. Public verification link: <br />
              <span className="text-muted underline cursor-pointer">{certUrl}</span>
            </div>
          )}
        </div>

        {/* Right Column: Storage Accounts, verification and Credit Ledger (40% width: col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Verification summary scores */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-3 border text-xs font-mono flex flex-col justify-between ${
              containmentOk ? 'bg-success/15 border-success text-success' : result ? 'bg-warning/15 border-warning text-warning' : 'bg-tertiary border-theme/20 text-secondary'
            }`}>
              <span className="uppercase tracking-wider text-[10px] opacity-75 font-bold">Containment Probability</span>
              <div className="mt-1 font-bold text-lg flex items-center gap-1.5 justify-between">
                <span>{result ? `${(result.containmentProbability * 100).toFixed(0)}%` : '—'}</span>
                {containmentOk && <BadgeCheck size={16} />}
              </div>
            </div>
            <div className={`rounded-xl p-3 border text-xs font-mono flex flex-col justify-between ${
              geomechOk ? 'bg-success/15 border-success text-success' : geomech ? 'bg-warning/15 border-warning text-warning' : 'bg-tertiary border-theme/20 text-secondary'
            }`}>
              <span className="uppercase tracking-wider text-[10px] opacity-75 font-bold">Geomechanical SF</span>
              <div className="mt-1 font-bold text-lg flex items-center gap-1.5 justify-between">
                <span>{geomech ? `${geomech.safetyFactor.toFixed(2)} SF` : '—'}</span>
                {geomechOk && <BadgeCheck size={16} />}
              </div>
            </div>
          </div>

          {/* Storage Capacity Account */}
          {result && (
            <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3.5 shadow-md">
              <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-theme/10 pb-2">
                <Database size={14} className="text-accent" /> Storage Capacity Account
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-theme/10 pb-1">
                  <span className="text-muted">Total Reservoir Capacity</span>
                  <span className="text-secondary font-bold">{result.totalCapacity.toFixed(2)} Mt</span>
                </div>
                <div className="flex justify-between border-b border-theme/10 pb-1">
                  <span className="text-muted">Injected Carbon Target</span>
                  <span className="text-secondary font-bold">{result.storageCapacity.toFixed(2)} Mt</span>
                </div>
                <div className="flex justify-between border-b border-theme/10 pb-1">
                  <span className="text-muted">Pore Volume Utilization</span>
                  <span className="text-secondary font-bold">{result.capacityUtilPct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Simulation Plume Radius</span>
                  <span className="text-secondary font-bold">{result.plumeRadius.toFixed(1)} m</span>
                </div>
              </div>
            </div>
          )}

          {/* Pressure Integrity & MAIP */}
          {geomech && (
            <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-3.5 shadow-md">
              <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-theme/10 pb-2">
                <Activity size={14} className="text-accent" /> Pressure Safety Envelope
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-theme/10 pb-1">
                  <span className="text-muted">Injection BHP</span>
                  <span className="text-secondary font-bold">{result?.injectionPressure.toFixed(2) ?? '—'} MPa</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">MAIP Limit</span>
                  <span className="text-secondary font-bold">{geomech.maip.toFixed(2)} MPa</span>
                </div>
                
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden border border-theme/10">
                      <div className={`h-full rounded-full transition-all ${geomech.maipMargin > 20 ? 'bg-success' : geomech.maipMargin > 0 ? 'bg-warning' : 'bg-red-500'}`}
                        style={{ width: `${Math.max(0, Math.min(100, geomech.maipMargin))}%` }} />
                    </div>
                    <span className={`font-mono font-bold ${geomech.maipMargin > 20 ? 'text-success' : geomech.maipMargin > 0 ? 'text-warning' : 'text-error'}`}>
                      {geomech.maipMargin.toFixed(1)}% margin
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Credit Ledger */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b border-theme/10 pb-2">
              <PiggyBank size={14} className="text-accent" /> Carbon Credit Registry Ledger
            </h3>
            {result ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between border-b border-theme/15 pb-2">
                  <span className="text-xs text-muted font-mono uppercase font-bold">Total Verified Yield</span>
                  <span className="text-xl font-mono font-bold text-accent">{totalCredits.toFixed(0)} Credits</span>
                </div>
                <div className="space-y-2">
                  {mockTxns.map((tx) => (
                    <div key={tx.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] font-mono border-b border-theme/10 pb-1.5 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${tx.status === 'confirmed' ? 'bg-success' : 'bg-warning'}`} />
                        <span className="text-secondary font-semibold">{tx.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-primary font-bold">{tx.credits.toLocaleString()} t</span>
                        <span className="text-[10px] text-muted/60">{tx.id}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setPanel('economics')}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-accent/40 bg-accent/15 text-xs font-mono text-accent hover:bg-accent/25 transition font-bold"
                >
                  <ArrowUpRight size={14} /> Inspect Financial Model
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted/60 font-mono italic text-center py-6">Run simulation to generate compliance credit records.</p>
            )}
          </div>

          {/* Not Assessed Hint */}
          {!result && (
            <div className="rounded-xl px-4 py-4 border border-dashed border-theme/30 text-xs text-muted/50 font-mono text-center bg-slate-800/30">
              Run Stage 3 dynamic model simulation to initialize registry asset certificates.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
