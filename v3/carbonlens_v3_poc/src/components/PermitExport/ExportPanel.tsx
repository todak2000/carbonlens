import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { Download, Clipboard, Check, FileJson, FileSpreadsheet, Camera, FileText, BarChart2 } from 'lucide-react'
import { downloadExportPackage, generateExcelHTML } from '../../utils/exportPackage'
import { generateDepthProfile, generateTimeSeries, buildExportJSON } from '../../utils/profileGenerator'
import { PERMIT_TEMPLATES, renderPermitReport, DEFAULT_JURISDICTION, PermitTemplate } from '../../utils/permitTemplates'
import { openExecutiveSummary, openPermitApplication, openPreScreeningReport } from '../../utils/exportHTMLReports'
import { openSleipnerReport } from '../../utils/exportSleipnerReport'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import { useHistoryMatchingStore } from '../../store/historyMatchingStore'
import { useMCStore, type PersistedMCResult } from '../../store/mcStore'
import { runMonteCarlo, REPORT_MC_CONFIG } from '../../utils/monteCarlo'

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
  const hmOptResult = useHistoryMatchingStore(s => s.optimizationResult)
  const setLastMCResult = useMCStore(s => s.setLastResult)

  // Always run fresh 500-sample MC on the frozen formation params at export time.
  // This guarantees the report always has probabilistic bounds regardless of whether
  // the user has visited the Monte Carlo panel.
  const runMCForReport = useCallback((
    fp: typeof params,
    fName: string,
    pYears: number,
  ): PersistedMCResult => {
    const res = runMonteCarlo(REPORT_MC_CONFIG, fp, pYears)
    const persisted: PersistedMCResult = {
      p10_Mt: res.p10_Mt, p50_Mt: res.p50_Mt, p90_Mt: res.p90_Mt,
      p10_P: res.p10_P, p50_P: res.p50_P, p90_P: res.p90_P,
      realizations: res.realizations.length,
      runTimeMs: res.runTimeMs,
      permUncertPct: REPORT_MC_CONFIG.permUncertPct,
      poroUncertAbs: REPORT_MC_CONFIG.poroUncertAbs,
      areaUncertPct: REPORT_MC_CONFIG.areaUncertPct,
      thickUncertPct: REPORT_MC_CONFIG.thickUncertPct,
      formationName: fName,
      ranAt: new Date().toISOString(),
    }
    setLastMCResult(persisted)
    return persisted
  }, [setLastMCResult])

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
    const presetName = preset?.name ?? 'Custom Formation'
    // Always compute fresh 500-sample MC on the frozen params so every report has probabilistic bounds
    const mcResult = runMCForReport(fp, presetName, uiSnap.projectYears)
    openExecutiveSummary(fp, snap, fg, fw, presetName, preset?.location ?? 'User-defined site', authSnap.user?.displayName ?? authSnap.user?.email ?? null, authSnap.user?.organization ?? '', simSnap.snapshots, uiSnap.projectYears, uiSnap.timestep, reportTemplate, hmOptResult ?? undefined, mcResult)
  }, [reportTemplate, hmOptResult, runMCForReport])

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
    const presetName = preset?.name ?? 'Custom Formation'
    // Always compute fresh 500-sample MC on the frozen params so every report has probabilistic bounds
    const mcResult = runMCForReport(fp, presetName, uiSnap.projectYears)
    openPermitApplication(fp, snap, fg, fw, presetName, preset?.location ?? 'User-defined site', reportTemplate, authSnap.user?.organization ?? '', simSnap.snapshots, uiSnap.projectYears, uiSnap.timestep, hmOptResult ?? undefined, mcResult)
  }, [reportTemplate, hmOptResult, runMCForReport])

  const handleExportPreScreeningReport = useCallback(() => {
    const simSnap = useSimulationStore.getState()
    const uiSnap = useUIStore.getState()
    const authSnap = useAuthStore.getState()
    const snap = simSnap.completedResult
    if (!snap) return
    if (!simSnap.completedParams || !simSnap.completedWells) {
      alert('Snapshot incomplete — please re-run the simulation to refresh the export state, then try again.')
      return
    }
    const fp = simSnap.completedParams
    const fw = simSnap.completedWells
    const fg = simSnap.completedGeomechanics ?? simSnap.geomechanics
    const preset = FORMATION_PRESETS.find((p) => p.params.depth === fp.depth && p.params.porosity === fp.porosity)
    const presetName = preset?.name ?? 'Custom Formation'
    const mcResult = runMCForReport(fp, presetName, uiSnap.projectYears)
    openPreScreeningReport(
      fp, snap, fg, fw,
      presetName,
      preset?.location ?? 'User-defined site',
      reportTemplate,
      authSnap.user?.organization ?? '',
      simSnap.snapshots,
      uiSnap.projectYears,
      uiSnap.timestep,
      hmOptResult ?? undefined,
      mcResult,
    )
  }, [reportTemplate, hmOptResult, runMCForReport])

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

      {/* CO2 Pre-Screening Report (unified executive + permit) */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
        <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-wider">CO&#x2082; Pre-Screening Report</p>
        <p className="text-[10px] text-muted leading-relaxed">
          Unified permit pre-screening report: executive overview, AoR, storage capacity, geomechanics,
          MRV plan, and compliance checklist. Ready to support regulatory pre-application submissions.
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
            ⚠ Geomechanics section will be incomplete — re-run the simulation to populate it.
          </p>
        )}
        <button
          onClick={handleExportPreScreeningReport}
          disabled={!completedResult}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-medium font-mono transition"
        >
          <FileText size={12} />
          {isAnimating ? 'Simulation running…' : !completedResult ? 'Run simulation to completion…' : 'Generate Pre-Screening Report'}
        </button>
        {!completedResult && !isAnimating && (
          <p className="text-[9px] text-muted font-mono text-center">
            {result ? `Complete the simulation (year ${simulationYear}/${projectYears}) to unlock.` : 'Run a simulation first to enable this export.'}
          </p>
        )}
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

      {/* Sleipner Benchmark Report */}
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-1.5">
        <p className="text-[9px] text-violet-400 font-mono uppercase tracking-wider">Benchmark Validation</p>
        <p className="text-[10px] text-muted leading-relaxed">
          Compare CarbonLens simulation against 20+ years of published Sleipner monitoring data
          (Boait 2012, Furre 2017). Includes physics validation, injection timeline, and future projections.
        </p>
        <button
          onClick={openSleipnerReport}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-violet-700 hover:bg-violet-600 text-white text-[10px] font-medium font-mono transition"
        >
          <BarChart2 size={12} /> Sleipner Benchmark Report
        </button>
      </div>

    </div>
  )
}
