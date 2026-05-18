import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useMemo, useState, useCallback } from 'react'
import { Download, Clipboard, Check, FileJson, FileSpreadsheet, Camera } from 'lucide-react'
import { downloadExportPackage, generateExcelHTML } from '../../utils/exportPackage'
import { generateDepthProfile, generateTimeSeries, buildExportJSON } from '../../utils/profileGenerator'
import { PERMIT_TEMPLATES, renderPermitReport, DEFAULT_JURISDICTION, PermitTemplate } from '../../utils/permitTemplates'

export default function ExportPanel() {
  const params = useFormationStore((s) => s.params)
  const wells = useFormationStore((s) => s.wells)
  const result = useSimulationStore((s) => s.result)
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const [exporting, setExporting] = useState<'report' | 'package' | 'excel' | null>(null)
  const [copied, setCopied] = useState(false)
  const [reportTemplate, setReportTemplate] = useState<string>(jurisdiction)

  const template: PermitTemplate = PERMIT_TEMPLATES[reportTemplate] ?? PERMIT_TEMPLATES[DEFAULT_JURISDICTION]

  const summary = useMemo(() => {
    return renderPermitReport(template, params, wells, result)
  }, [params, result, template, wells])

  const captureCanvas = useCallback((): string | null => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }, [])

  const handleExportPackage = useCallback(() => {
    setExporting('package')
    const screenshot = captureCanvas()
    // Use setTimeout to allow the UI to update before triggering downloads
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

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider">Export</h2>

      {/* Template selector */}
      <div className="flex items-center gap-2">
        <label className="text-[9px] text-muted font-mono">Permit Template:</label>
        <select value={reportTemplate} onChange={(e) => setReportTemplate(e.target.value)}
          className="text-[10px] font-mono bg-tertiary text-secondary border border-theme rounded px-2 py-1 outline-none focus:border-accent">
          {Object.entries(PERMIT_TEMPLATES).map(([k, t]) => (
            <option key={k} value={k}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        {/* Text report */}
        <button onClick={() => { setExporting('report'); const blob = new Blob([summary], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `carbonlens-permit-${template.id.toLowerCase()}-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url); setTimeout(() => setExporting(null), 1500) }}
          disabled={exporting !== null}
          className="btn-primary flex items-center justify-center gap-1.5 text-[10px]">
          <Download size={12} /> {exporting === 'report' ? 'Exported!' : 'Permit Report'}
        </button>

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
          className="flex items-center justify-center gap-1.5 py-2 rounded bg-tertiary text-secondary hover:text-primary text-[10px] font-mono transition border border-theme">
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
