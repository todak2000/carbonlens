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
  const activePresetName = useFormationStore((s) => s.activePresetName)
  const formationCountry = useFormationStore((s) => s.formationCountry)
  const result = useSimulationStore((s) => s.result)
  const completedResult = useSimulationStore((s) => s.completedResult)
  const geomechanics = useSimulationStore((s) => s.geomechanics)
  const snapshots = useSimulationStore((s) => s.snapshots)
  const isAnimating = useSimulationStore((s) => s.isAnimating)

  const exportResult = completedResult ?? result
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const projectYears = useUIStore((s) => s.projectYears)
  const simulationYear = useUIStore((s) => s.timestep)
  const currentProjectName = useUIStore((s) => s.currentProjectName)
  const user = useAuthStore((s) => s.user)
  const organization = useAuthStore((s) => s.user?.organization ?? '')
  const [exporting, setExporting] = useState<'package' | 'excel' | null>(null)
  const hmOptResult = useHistoryMatchingStore(s => s.optimizationResult)
  const setLastMCResult = useMCStore(s => s.setLastResult)

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

  const { formationName, formationLocation, presetJurisdiction } = useMemo(() => {
    // Use store-tracked preset name as primary source — no fragile depth+porosity matching
    const preset = activePresetName
      ? FORMATION_PRESETS.find((p) => p.name === activePresetName)
      : null
    return {
      formationName: activePresetName ?? currentProjectName ?? 'Custom Formation',
      formationLocation: preset?.location ?? (formationCountry ? formationCountry : 'User-defined site'),
      presetJurisdiction: preset?.jurisdiction ?? null,
    }
  }, [activePresetName, currentProjectName, formationCountry])

  const [copied, setCopied] = useState(false)
  const [reportTemplate, setReportTemplate] = useState<string>(presetJurisdiction ?? jurisdiction)

  useEffect(() => {
    // When jurisdiction is auto-set from a preset load, sync the report template
    setReportTemplate(jurisdiction)
  }, [jurisdiction])

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
    const resolvedPresetName = useFormationStore.getState().activePresetName
    const resolvedCountry = useFormationStore.getState().formationCountry
    const preset = resolvedPresetName ? FORMATION_PRESETS.find((p) => p.name === resolvedPresetName) : null
    const presetName = resolvedPresetName ?? uiSnap.currentProjectName ?? 'Custom Formation'
    const mcResult = runMCForReport(fp, presetName, uiSnap.projectYears)
    openPreScreeningReport(
      fp, snap, fg, fw,
      presetName,
      preset?.location ?? (resolvedCountry ?? 'User-defined site'),
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

  const nearZeroSalinity = params.monovalentSalinity < 0.1 && params.bivalentSalinity < 0.05

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme/20 pb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <Download size={20} className="text-accent" /> Data &amp; Reporting Export Center
          </h1>
          <p className="text-xs text-muted font-mono mt-0.5">
            Compile permit application filings, raw datasets, Excel models, and screenshots
          </p>
        </div>
      </div>

      {/* Global warnings */}
      <div className="space-y-2">
        {isAnimating && (
          <div className="text-xs text-error font-mono bg-error/15 border border-error/30 rounded-xl px-4 py-3 leading-relaxed">
            ✗ PDF exports locked while simulation is running. Both documents must read the same
            end-state snapshot — exporting mid-run would produce inconsistent numbers.
            Wait for the simulation to complete (year {simulationYear}/{projectYears}).
          </div>
        )}
        {!completedResult && result && !isAnimating && (
          <div className="text-xs text-error font-mono bg-error/15 border border-error/30 rounded-xl px-4 py-3 leading-relaxed">
            ✗ PDF exports locked — simulation has not run to completion (year {simulationYear}/{projectYears}).
            Both documents share a single end-state snapshot; exporting from a paused run produces
            mismatched trapping totals. Run the simulation to year {projectYears} to unlock.
          </div>
        )}
        {nearZeroSalinity && (
          <div className="text-xs text-error font-mono bg-error/15 border border-error/30 rounded-xl px-4 py-3 leading-relaxed">
            ✗ Salinity is near zero ({params.monovalentSalinity.toFixed(4)} mol/kg). The Duan-Sun
            solubility model requires realistic brine ionic strength. Deep saline aquifers typically
            have 0.5–2.0 mol/kg NaCl. Update Formation → Salinity before exporting.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Pre-screening report and details (60% width equivalent: col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Formation identity — shown in all reports */}
          <div className="rounded-lg border border-theme/20 bg-tertiary/20 px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono">
            <span className="text-muted uppercase tracking-wider">Formation</span>
            <span className="text-accent font-bold truncate">{formationName}</span>
            {formationLocation && formationLocation !== 'User-defined site' && (
              <>
                <span className="text-muted opacity-40">|</span>
                <span className="text-muted truncate">{formationLocation}</span>
              </>
            )}
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4 shadow-md">
            <h3 className="text-sm font-mono font-bold text-emerald-400 uppercase tracking-wider border-b border-emerald-500/20 pb-2 flex items-center gap-2">
              <FileText size={16} /> CO₂ Pre-Screening Report
            </h3>

            <p className="text-xs text-secondary leading-relaxed font-mono">
              Unified permit pre-screening report including Executive Overview, Area of Review (AoR),
              storage capacity volumetric assessment, caprock geomechanics envelope, MRV strategy plan,
              and regulatory checklists. Ready for regulatory pre-application submission.
            </p>
            
            {/* Jurisdiction selector */}
            <div className="flex flex-col gap-1.5 w-full min-w-0">
              <label className="text-xs text-muted font-mono font-bold uppercase">Select Template:</label>
              <select
                value={reportTemplate}
                onChange={(e) => setReportTemplate(e.target.value)}
                className="w-full min-w-0 text-xs font-mono bg-tertiary text-primary border border-theme/30 rounded-lg px-3 py-2 outline-none focus:border-accent font-bold"
              >
                {Object.entries(PERMIT_TEMPLATES).map(([k, t]) => (
                  <option key={k} value={k}>{t.name}</option>
                ))}
              </select>
            </div>
            
            {!geomechanics && (
              <div className="text-xs text-warning font-mono bg-warning/15 border border-warning/30 rounded-lg px-3 py-2 leading-relaxed">
                ⚠ Geomechanics parameters are not loaded. Run a model simulation first to populate the shear margins.
              </div>
            )}
            
            <button
              onClick={handleExportPreScreeningReport}
              disabled={!completedResult}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono font-bold text-xs transition shadow-md"
            >
              <FileText size={14} />
              {isAnimating ? 'Simulation running…' : !completedResult ? 'Run simulation to completion…' : 'Generate Pre-Screening Report'}
            </button>
            
            {!completedResult && !isAnimating && (
              <p className="text-xs text-muted font-mono text-center pt-1 leading-normal">
                {result ? `Complete the simulation (year ${simulationYear}/${projectYears}) to unlock report.` : 'Run a simulation first to enable this export.'}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Other export actions & Sleipner validation (40% width: col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Other export actions grid */}
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-theme/10 pb-2">
              Data &amp; Packages Export
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Full data package */}
              <button onClick={handleExportPackage} disabled={exporting !== null}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tertiary text-primary hover:opacity-80 text-xs font-mono font-bold transition border border-theme/35">
                <FileJson size={14} /> {exporting === 'package' ? 'Packaging...' : 'Data Zip'}
              </button>

              {/* Excel-compatible report */}
              <button onClick={handleExportExcel} disabled={exporting !== null}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tertiary text-primary hover:opacity-80 text-xs font-mono font-bold transition border border-theme/35">
                <FileSpreadsheet size={14} /> {exporting === 'excel' ? 'Exporting...' : 'Excel Sheet'}
              </button>

              {/* JSON data only */}
              <button onClick={handleDownloadJSON}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tertiary text-primary hover:opacity-80 text-xs font-mono font-bold transition border border-theme/35">
                <FileJson size={14} /> Raw JSON
              </button>

              {/* Copy to clipboard */}
              <button onClick={() => { navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tertiary text-primary hover:opacity-80 text-xs font-mono font-bold transition border border-theme/35">
                {copied ? <Check size={14} className="text-accent" /> : <Clipboard size={14} />}
                {copied ? 'Copied!' : 'Copy Summary'}
              </button>

              {/* Screenshot */}
              <button onClick={() => { const d = captureCanvas(); if (d) { const a = document.createElement('a'); a.href = d; a.download = `carbonlens_screenshot_${Date.now()}.png`; a.click() } }}
                className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tertiary text-primary hover:opacity-80 text-xs font-mono font-bold transition border border-theme/35">
                <Camera size={14} /> Capture 3D Snapshot
              </button>
            </div>
          </div>

          {/* Sleipner Benchmark Report */}
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-violet-400 uppercase tracking-wider border-b border-violet-500/20 pb-2 flex items-center gap-2">
              <BarChart2 size={16} /> Benchmark Validation
            </h3>
            <p className="text-xs text-secondary leading-relaxed font-mono">
              Compare CarbonLens simulation models against 20+ years of published Sleipner Utsira monitoring records 
              (Boait 2012, Furre 2017). Inspect matching coefficients and physical logs.
            </p>
            <button
              onClick={openSleipnerReport}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-mono font-bold text-xs transition shadow-md"
            >
              <BarChart2 size={14} /> Open Sleipner Report
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
