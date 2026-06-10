import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { Download, Clipboard, Check, FileJson, FileSpreadsheet, Camera, FileText } from 'lucide-react'
import { downloadExportPackage, generateExcelHTML } from '../../utils/exportPackage'
import { generateDepthProfile, generateTimeSeries, buildExportJSON } from '../../utils/profileGenerator'
import { PERMIT_TEMPLATES, renderPermitReport, DEFAULT_JURISDICTION, PermitTemplate } from '../../utils/permitTemplates'
import { openExecutiveSummary, openPermitApplication } from '../../utils/exportHTMLReports'
import { FORMATION_PRESETS } from '../../data/formationPresets'

export default function ExportPanel() {
  const params = useFormationStore((s) => s.params)
  const wells = useFormationStore((s) => s.wells)
  const result = useSimulationStore((s) => s.result)
  const completedResult = useSimulationStore((s) => s.completedResult)
  const geomechanics = useSimulationStore((s) => s.geomechanics)
  const snapshots = useSimulationStore((s) => s.snapshots)
  const isAnimating = useSimulationStore((s) => s.isAnimating)
  // Always export from the frozen completedResult when available; fall back to live result only
  // when the simulation hasn't finished yet.  This prevents the two export buttons from hitting
  // different animation frames and producing mismatched storageCapacity figures.
  const exportResult = completedResult ?? result
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const projectYears = useUIStore((s) => s.projectYears)
  const simulationYear = useUIStore((s) => s.timestep)
  const user = useAuthStore((s) => s.user)
  const organization = useAuthStore((s) => s.user?.organization ?? '')
  const [exporting, setExporting] = useState<'package' | 'excel' | null>(null)

  // Resolve formation name + location + jurisdiction from presets (match by depth + porosity as fingerprint)
  const { formationName, formationLocation, presetJurisdiction } = useMemo(() => {
    const preset = FORMATION_PRESETS.find(
      (p) => p.params.depth === params.depth && p.params.porosity === params.porosity,
    )
    return {
      formationName: preset?.name ?? 'Custom Formation',
      formationLocation: preset?.location ?? 'User-defined site',
      presetJurisdiction: preset?.jurisdiction ?? null,
    }
  }, [params.depth, params.porosity])
  const [copied, setCopied] = useState(false)
  const [reportTemplate, setReportTemplate] = useState<string>(presetJurisdiction ?? jurisdiction)

  // Auto-update jurisdiction when formation preset changes, but allow user to override
  useEffect(() => {
    if (presetJurisdiction) {
      setReportTemplate(presetJurisdiction)
    }
  }, [presetJurisdiction])

  const template: PermitTemplate = PERMIT_TEMPLATES[reportTemplate] ?? PERMIT_TEMPLATES[DEFAULT_JURISDICTION]

  const summary = useMemo(() => {
    return renderPermitReport(template, params, wells, exportResult)
  }, [params, result, template, wells])

  const captureCanvas = useCallback((): string | null => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }, [])

  const handleExportPackage = useCallback(() => {
    setExporting('package')
    const screenshot = captureCanvas()
    setTimeout(() => {
      downloadExportPackage(params, wells, result, jurisdiction, screenshot)
      setExporting(null)
    }, 100)
  }, [params, wells, result, jurisdiction, captureCanvas])

  const handleExportExcel = useCallback(() => {
    setExporting('excel')
    setTimeout(() => {
      const profile = generateDepthProfile(params)
      const series = result ? generateTimeSeries(params, result, wells, 50) : []
      const html = generateExcelHTML(params, wells, result, jurisdiction, profile, series)
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `carbonlens_report_${Date.now()}.xls`
      a.click()
      URL.revokeObjectURL(url)
      setExporting(null)
    }, 100)
  }, [params, wells, result, jurisdiction])

  const handleExportExecutiveSummary = useCallback(() => {
    // Read ALL dynamic values directly from stores at click time.
    // This guarantees both PDF documents see the identical frozen scenario
    // regardless of any React re-renders between button clicks.
    const simSnap = useSimulationStore.getState()
    const uiSnap = useUIStore.getState()
    const authSnap = useAuthStore.getState()
    const snap = simSnap.completedResult
    if (!snap) return
    // completedParams and completedWells MUST be present — they are frozen atomically with
    // completedResult.  If they are null the snapshot is from a legacy session that pre-dates
    // this fix; block the export and require a fresh run to avoid mixing data across runs.
    if (!simSnap.completedParams || !simSnap.completedWells) {
      alert('Snapshot incomplete — please re-run the simulation to refresh the export state, then try again.')
      return
    }
    const fp = simSnap.completedParams
    const fw = simSnap.completedWells
    const fg = simSnap.completedGeomechanics ?? simSnap.geomechanics
    const preset = FORMATION_PRESETS.find((p) => p.params.depth === fp.depth && p.params.porosity === fp.porosity)
    openExecutiveSummary(fp, snap, fg, fw, preset?.name ?? 'Custom Formation', preset?.location ?? 'User-defined site', authSnap.user?.displayName ?? authSnap.user?.email ?? null, authSnap.user?.organization ?? '', simSnap.snapshots, uiSnap.projectYears, uiSnap.timestep)
  }, [])

  const handleExportPermitPDF = useCallback(() => {
    // Read ALL dynamic values directly from stores at click time.
    const simSnap = useSimulationStore.getState()
    const uiSnap = useUIStore.getState()
    const authSnap = useAuthStore.getState()
    const snap = simSnap.completedResult
    if (!snap) return
    // Require fully populated snapshot — never fall back to live store params/wells
    // which may belong to a different simulation run.
    if (!simSnap.completedParams || !simSnap.completedWells) {
      alert('Snapshot incomplete — please re-run the simulation to refresh the export state, then try again.')
      return
    }
    const fp = simSnap.completedParams
    const fw = simSnap.completedWells
    const fg = simSnap.completedGeomechanics ?? simSnap.geomechanics
    const preset = FORMATION_PRESETS.find((p) => p.params.depth === fp.depth && p.params.porosity === fp.porosity)
    openPermitApplication(fp, snap, fg, fw, preset?.name ?? 'Custom Formation', preset?.location ?? 'User-defined site', reportTemplate, authSnap.user?.organization ?? '', simSnap.snapshots, uiSnap.projectYears, uiSnap.timestep)
  }, [reportTemplate])

  const handleDownloadJSON = useCallback(() => {
    const profile = generateDepthProfile(params)
    const series = result ? generateTimeSeries(params, result, wells, 50) : []
    const data = buildExportJSON(params, wells, result, jurisdiction, profile, series)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `carbonlens_data_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [params, wells, result, jurisdiction])

  // Debug: export the exact frozen snapshot that BOTH PDF handlers read from.
  // Use this to verify Executive Summary and Permit Pre-Application are using
  // identical numbers before generating PDFs.
  const handleExportDebugSnapshot = useCallback(() => {
    const simSnap = useSimulationStore.getState()
    const uiSnap = useUIStore.getState()
    const authSnap = useAuthStore.getState()

    const snap = simSnap.completedResult
    const fp   = simSnap.completedParams
    const fw   = simSnap.completedWells
    const fg   = simSnap.completedGeomechanics ?? simSnap.geomechanics

    // Derived verification block — mirrors the arithmetic both HTML reports perform.
    // NOTE: all mass fields (storageCapacity, residualTrapping, etc.) are already in Mt.
    //       injectionRate on wells is already in Mt/yr.
    const verification = snap && fp ? (() => {
      const residual    = snap.residualTrapping   ?? 0
      const solubility  = snap.solubilityTrapping ?? 0
      const mineral     = snap.mineralTrapping    ?? 0
      const mobile      = snap.mobilePlume        ?? 0
      const total       = snap.storageCapacity    ?? 0
      const componentSum = residual + solubility + mineral + mobile
      const gap          = total - componentSum
      const injectionRateMtyr = fw
        ? fw.reduce((s, w) => s + (w.injectionRate ?? 0), 0)
        : null
      return {
        storageCapacity_Mt:       +total.toFixed(6),
        residualTrapping_Mt:      +residual.toFixed(6),
        solubilityTrapping_Mt:    +solubility.toFixed(6),
        mineralTrapping_Mt:       +mineral.toFixed(6),
        mobilePlume_Mt:           +mobile.toFixed(6),
        componentSum_Mt:          +componentSum.toFixed(6),
        massBalanceGap_Mt:        +gap.toFixed(6),
        massBalanceGapPct:        total > 0 ? +((gap / total) * 100).toFixed(4) : null,
        residualPct_ofTotal:      total > 0 ? +((residual / total) * 100).toFixed(2) : null,
        solubilityPct_ofTotal:    total > 0 ? +((solubility / total) * 100).toFixed(2) : null,
        mineralPct_ofTotal:       total > 0 ? +((mineral / total) * 100).toFixed(2) : null,
        mobilePct_ofTotal:        total > 0 ? +((mobile / total) * 100).toFixed(2) : null,
        injectionRate_Mtyr:       injectionRateMtyr !== null ? +injectionRateMtyr.toFixed(6) : null,
        geomechanicsPresent:      fg !== null,
        // safetyFactor > 1.5 = safe; fracturePressure vs injectionPressure is the key check
        safetyFactor:             fg?.safetyFactor ?? null,
        fracturePressure_MPa:     fg?.fracturePressure ?? null,
        injectionPressure_MPa:    snap.injectionPressure ?? null,
        inducedSeismicityRisk:    fg?.inducedSeismicityRisk ?? null,
        maip_MPa:                 fg?.maip ?? null,
      }
    })() : null

    const debugPayload = {
      _meta: {
        generatedAt:       new Date().toISOString(),
        description:       'Frozen export snapshot — identical object read by Executive Summary and Permit Pre-Application handlers',
        snapshotComplete:  snap !== null && fp !== null && fw !== null,
        jurisdiction:      uiSnap.jurisdiction,
        reportTemplate,
        projectYears:      uiSnap.projectYears,
        simulationYear:    uiSnap.timestep,
        user:              authSnap.user?.displayName ?? authSnap.user?.email ?? null,
        organization:      authSnap.user?.organization ?? null,
      },
      _verification: verification,
      completedResult:      snap,
      completedParams:      fp,
      completedWells:       fw,
      completedGeomechanics: fg,
    }

    const blob = new Blob([JSON.stringify(debugPayload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `carbonlens_debug_snapshot_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [reportTemplate])

  const simulationComplete = !isAnimating && result != null && simulationYear >= projectYears
  const nearZeroSalinity = params.monovalentSalinity < 0.1 && params.bivalentSalinity < 0.05

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider">Export</h2>

      {/* Global warnings */}
      {isAnimating && (
        <p className="text-[9px] text-red-400 font-mono bg-red-500/10 rounded px-2 py-1">
          ✗ PDF exports locked while simulation is running. Both documents must read the same
          end-state snapshot — exporting mid-run would produce inconsistent numbers.
          Wait for the simulation to complete (year {simulationYear}/{projectYears}).
        </p>
      )}
      {!completedResult && result && !isAnimating && (
        <p className="text-[9px] text-red-400 font-mono bg-red-500/10 rounded px-2 py-1">
          ✗ PDF exports locked — simulation has not run to completion (year {simulationYear}/{projectYears}).
          Both documents share a single end-state snapshot; exporting from a paused run produces
          mismatched trapping totals. Run the simulation to year {projectYears} to unlock.
        </p>
      )}
      {nearZeroSalinity && (
        <p className="text-[9px] text-red-400 font-mono bg-red-500/10 rounded px-2 py-1">
          ✗ Salinity is near zero ({params.monovalentSalinity.toFixed(4)} mol/kg). The Duan-Sun
          solubility model requires realistic brine ionic strength. Deep saline aquifers typically
          have 0.5–2.0 mol/kg NaCl. Update Formation → Salinity before exporting.
        </p>
      )}

      {/* Executive Summary — primary action for competition / non-technical audience */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
        <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-wider">Decision-Maker Report</p>
        <p className="text-[10px] text-muted leading-relaxed">
          Single-page executive summary with verdict, capacity estimate, safety rating,
          and recommendations — designed for ministers, investors, and regulators.
        </p>
        {result && !geomechanics && (
          <p className="text-[9px] text-amber-400 font-mono bg-amber-500/10 rounded px-2 py-1">
            ⚠ Geomechanics will show "NOT RUN" — re-run the simulation to populate it.
          </p>
        )}
        <button
          onClick={handleExportExecutiveSummary}
          disabled={!completedResult}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-medium font-mono transition"
        >
          <FileText size={12} />
          {isAnimating ? 'Simulation running…' : !completedResult ? 'Run simulation to completion…' : 'Executive Summary PDF'}
        </button>
        {!completedResult && !isAnimating && (
          <p className="text-[9px] text-muted font-mono text-center">
            {result ? `Complete the simulation (year ${simulationYear}/${projectYears}) to unlock.` : 'Run a simulation first to enable this export.'}
          </p>
        )}
      </div>

      {/* Permit Pre-Application */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-1.5">
        <p className="text-[9px] text-blue-400 font-mono uppercase tracking-wider">Regulatory Pre-Application</p>
        <p className="text-[10px] text-muted leading-relaxed">
          Full permit pre-application with AoR, MRV plan, geomechanics, and compliance checklist.
        </p>

        {/* Jurisdiction selector */}
        <div className="flex items-center gap-2">
          <label className="text-[9px] text-muted font-mono">Jurisdiction:</label>
          <select
            value={reportTemplate}
            onChange={(e) => setReportTemplate(e.target.value)}
            className="text-[10px] font-mono bg-tertiary text-secondary border border-theme rounded px-2 py-1 outline-none focus:border-accent flex-1"
          >
            {Object.entries(PERMIT_TEMPLATES).map(([k, t]) => (
              <option key={k} value={k}>{t.name}</option>
            ))}
          </select>
        </div>

        {!geomechanics && (
          <p className="text-[9px] text-amber-400 font-mono bg-amber-500/10 rounded px-2 py-1">
            ⚠ Section 6 (Geomechanics) will be blank — re-run the simulation to populate it.
          </p>
        )}
        <button
          onClick={handleExportPermitPDF}
          disabled={!completedResult}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-medium font-mono transition"
        >
          <Download size={12} />
          {isAnimating ? 'Simulation running…' : !completedResult ? 'Run simulation to completion…' : 'Permit Pre-Application PDF'}
        </button>
      </div>

      {/* Other export actions */}
      <div className="grid grid-cols-2 gap-2">
        {/* Full data package (JSON + CSV + Excel + PNG) */}
        <button onClick={handleExportPackage} disabled={exporting !== null}
          className="flex items-center justify-center gap-1.5 py-2 rounded bg-tertiary text-secondary hover:text-primary text-[10px] font-mono transition border border-theme">
          <FileJson size={12} /> {exporting === 'package' ? 'Packaging...' : 'Data Package'}
        </button>

        {/* Excel-compatible report */}
        <button onClick={handleExportExcel} disabled={exporting !== null}
          className="flex items-center justify-center gap-1.5 py-2 rounded bg-tertiary text-secondary hover:text-primary text-[10px] font-mono transition border border-theme">
          <FileSpreadsheet size={12} /> {exporting === 'excel' ? 'Exporting...' : 'Excel Report'}
        </button>

        {/* JSON data only */}
        <button onClick={handleDownloadJSON}
          className="flex items-center justify-center gap-1.5 py-2 rounded bg-tertiary text-secondary hover:text-primary text-[10px] font-mono transition border border-theme">
          <FileJson size={12} /> Raw JSON
        </button>

        {/* Copy to clipboard */}
        <button onClick={() => { navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="flex items-center justify-center gap-1.5 py-2 rounded bg-tertiary text-secondary hover:text-primary text-[10px] font-mono transition border border-theme">
          {copied ? <Check size={12} className="text-accent" /> : <Clipboard size={12} />}
          {copied ? 'Copied!' : 'Copy Report'}
        </button>

        {/* Screenshot */}
        <button onClick={() => { const d = captureCanvas(); if (d) { const a = document.createElement('a'); a.href = d; a.download = `carbonlens_screenshot_${Date.now()}.png`; a.click() } }}
          className="col-span-2 flex items-center justify-center gap-1.5 py-2 rounded bg-tertiary text-secondary hover:text-primary text-[10px] font-mono transition border border-theme">
          <Camera size={12} /> Screenshot
        </button>
      </div>

      {/* Debug: verify both PDF exports read from the same frozen snapshot */}
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-1.5">
        <p className="text-[9px] text-yellow-400 font-mono uppercase tracking-wider">State Verification</p>
        <p className="text-[10px] text-muted leading-relaxed">
          Download the exact frozen snapshot both PDF handlers read from. Compare
          <code className="text-yellow-300 mx-1">completedResult</code> fields across runs to confirm the two documents are using identical numbers.
        </p>
        <button
          onClick={handleExportDebugSnapshot}
          disabled={!completedResult}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-yellow-600/80 hover:bg-yellow-500/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-medium font-mono transition"
        >
          <FileJson size={12} />
          {completedResult ? 'Export Debug Snapshot JSON' : 'Run simulation first'}
        </button>
        {completedResult && (
          <p className="text-[9px] text-muted font-mono">
            Includes <code>_verification</code> block with mass-balance cross-checks, component percentages, injection rate, and geomechanics presence flag.
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="p-3 rounded bg-card border border-theme">
        <pre className="text-[10px] text-muted font-mono whitespace-pre-wrap leading-relaxed">{summary}</pre>
      </div>
    </div>
  )
}
