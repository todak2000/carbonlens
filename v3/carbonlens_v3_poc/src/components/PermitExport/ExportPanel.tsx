import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useMemo, useState, useCallback } from 'react'
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

  // Resolve formation name + location from presets (match by depth + porosity as fingerprint)
  const { formationName, formationLocation } = useMemo(() => {
    const preset = FORMATION_PRESETS.find(
      (p) => p.params.depth === params.depth && p.params.porosity === params.porosity,
    )
    return {
      formationName: preset?.name ?? 'Custom Formation',
      formationLocation: preset?.location ?? 'User-defined site',
    }
  }, [params.depth, params.porosity])
  const [copied, setCopied] = useState(false)
  const [reportTemplate, setReportTemplate] = useState<string>(jurisdiction)

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
    const formSnap = useFormationStore.getState()
    const uiSnap = useUIStore.getState()
    const authSnap = useAuthStore.getState()
    const snap = simSnap.completedResult
    if (!snap) return
    // Use frozen params/wells captured at simulation completion to guarantee
    // the injection programme and capacity figures describe the same run.
    const fp = simSnap.completedParams ?? formSnap.params
    const fw = simSnap.completedWells ?? formSnap.wells
    const preset = FORMATION_PRESETS.find((p) => p.params.depth === fp.depth && p.params.porosity === fp.porosity)
    openExecutiveSummary(fp, snap, simSnap.geomechanics, fw, preset?.name ?? 'Custom Formation', preset?.location ?? 'User-defined site', authSnap.user?.displayName ?? authSnap.user?.email ?? null, authSnap.user?.organization ?? '', simSnap.snapshots, uiSnap.projectYears, uiSnap.timestep)
  }, [])

  const handleExportPermitPDF = useCallback(() => {
    // Read ALL dynamic values directly from stores at click time.
    const simSnap = useSimulationStore.getState()
    const formSnap = useFormationStore.getState()
    const uiSnap = useUIStore.getState()
    const authSnap = useAuthStore.getState()
    const snap = simSnap.completedResult
    if (!snap) return
    // Use frozen params/wells from simulation completion — prevents rate/capacity mismatch
    // when formation store is edited after simulation completes.
    const fp = simSnap.completedParams ?? formSnap.params
    const fw = simSnap.completedWells ?? formSnap.wells
    const preset = FORMATION_PRESETS.find((p) => p.params.depth === fp.depth && p.params.porosity === fp.porosity)
    openPermitApplication(fp, snap, simSnap.geomechanics, fw, preset?.name ?? 'Custom Formation', preset?.location ?? 'User-defined site', reportTemplate, authSnap.user?.organization ?? '', simSnap.snapshots, uiSnap.projectYears, uiSnap.timestep)
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

      {/* Preview */}
      <div className="p-3 rounded bg-card border border-theme">
        <pre className="text-[10px] text-muted font-mono whitespace-pre-wrap leading-relaxed">{summary}</pre>
      </div>
    </div>
  )
}
