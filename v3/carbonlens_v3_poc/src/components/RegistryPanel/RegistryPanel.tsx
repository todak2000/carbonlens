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

  // Sync label whenever the active preset changes (or on first mount)
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
    ? { label: 'Verified', color: 'bg-success border-success text-success' }
    : warning
    ? { label: 'Review Required', color: 'bg-warning border-warning text-warning' }
    : failed
    ? { label: 'Non-Compliant', color: 'bg-error border-error text-error' }
    : { label: 'Not Assessed', color: 'bg-tertiary/30 border-theme/30 text-muted' }

  const certStatus: CertificateRecord['status'] = verified
    ? 'Verified'
    : warning
    ? 'Review Required'
    : 'Non-Compliant'

  const handleSaveCertificate = () => {
    if (!result || !geomech) return
    const formationName = formationLabel.trim() || activePresetName || 'Custom Formation'
    const record: CertificateRecord = {
      assetId,
      savedAt: new Date().toISOString(),
      formationName,
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
          <Shield size={14} className={verified ? 'text-success' : warning ? 'text-warning' : 'text-muted'} />
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

      {/* Formation name for certificate */}
      <div className="rounded px-2 py-2 border border-theme/30 bg-tertiary/20 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted font-mono uppercase tracking-wider">Formation Name</span>
          <button
            onClick={() => setEditingLabel((v) => !v)}
            className="text-[9px] font-mono text-muted/60 hover:text-primary flex items-center gap-0.5 transition"
          >
            <Pencil size={9} /> {editingLabel ? 'done' : 'edit'}
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
            className="w-full bg-transparent border-b border-primary/40 text-[11px] font-mono text-primary outline-none pb-0.5 placeholder:text-muted/40"
          />
        ) : (
          <div className="text-[11px] font-mono font-semibold text-primary truncate">{formationLabel || 'Custom Formation'}</div>
        )}
        <div className="text-[8px] text-muted/40 font-mono">Used on the certificate. Keep preset name or enter your own.</div>
      </div>

      {/* Certificate Actions */}
      {result && geomech && (
        <div className="flex gap-2">
          <button
            onClick={handleSaveCertificate}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 hover:bg-emerald-500/20 transition"
          >
            <FileCheck size={11} /> Save Certificate
          </button>
          <button
            disabled={!certSaved}
            onClick={() => certUrl && window.open(certUrl, '_blank')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-[10px] font-mono text-blue-400 hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ExternalLink size={11} /> View Certificate
          </button>
        </div>
      )}
      {certSaved && certUrl && (
        <div className="rounded px-2 py-1.5 bg-emerald-500/5 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 break-all">
          Certificate saved. Share link: <span className="text-muted">{certUrl}</span>
        </div>
      )}

      {/* Verification Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded px-2 py-1.5 border text-[10px] font-mono ${containmentOk ? 'bg-success border-success text-success' : result ? 'bg-warning border-warning text-warning' : 'bg-tertiary/30 border-theme/30 text-muted'}`}>
          <span className="uppercase tracking-wider text-[8px] opacity-70">Containment</span>
          <div className="mt-0.5 font-bold flex items-center gap-1">
            {result ? `${(result.containmentProbability * 100).toFixed(0)}%` : '—'}
            {containmentOk && <BadgeCheck size={11} />}
          </div>
        </div>
        <div className={`rounded px-2 py-1.5 border text-[10px] font-mono ${geomechOk ? 'bg-success border-success text-success' : geomech ? 'bg-warning border-warning text-warning' : 'bg-tertiary/30 border-theme/30 text-muted'}`}>
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
              <div className={`h-full rounded-full transition-all ${geomech.maipMargin > 20 ? 'bg-success' : geomech.maipMargin > 0 ? 'bg-warning' : 'bg-red-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, geomech.maipMargin))}%` }} />
            </div>
            <span className={`text-[10px] font-mono font-bold ${geomech.maipMargin > 20 ? 'text-success' : geomech.maipMargin > 0 ? 'text-warning' : 'text-error'}`}>
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
            <span className={`text-right font-bold ${result.overpressureRisk ? 'text-error' : 'text-success'}`}>
              {result.overpressureRisk ? '⚠ Yes' : 'None'}
            </span>
          </div>
        </div>
      )}

      {/* Verified Credit Ledger */}
      <div className="rounded px-2 py-1.5 border border-theme/30 bg-tertiary/20">
        <h3 className="text-[10px] text-muted font-mono mb-1.5 flex items-center gap-1"><PiggyBank size={11} className="text-warning" /> Credit Ledger</h3>
        {result ? (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[9px] text-muted font-mono">Total Verified Credits</span>
              <span className="text-[16px] font-mono font-bold text-warning">{totalCredits.toFixed(0)}</span>
            </div>
            <div className="space-y-1">
              {mockTxns.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-[9px] font-mono border-b border-theme/10 pb-1 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'confirmed' ? 'bg-success' : 'bg-warning'}`} />
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
              className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded bg-warning border border-warning text-[10px] font-mono text-warning hover:bg-warning transition">
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
