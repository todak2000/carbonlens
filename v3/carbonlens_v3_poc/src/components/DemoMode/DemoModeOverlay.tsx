/**
 * DemoModeOverlay — cinematic self-guided ~90-second demo.
 *
 * Each stage has two sub-phases:
 *   intro  (3 s) — fullscreen "coming up next" card
 *   active (varies) — panel visible with narration HUD
 *
 * Special behaviour:
 *   Stage 5 (Permit)  → 2 s into active, shows Sleipner validation PDF embedded
 *   Stage 6 (Cert)    → after auto-save, renders certificate inline
 *
 * Recording:
 *   "Record Full Session" button (first intro card) uses getDisplayMedia()
 *   so the entire browser tab — panels, text, PDF, certificate — is captured.
 *   Fallback: canvas-only WebM if screen capture is declined.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { X, Play, ChevronRight } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useSimulation, validateGeomechanics } from '../../hooks/useSimulation'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import CertificatePage from '../Certificate/CertificatePage'
import type { CertificateRecord } from '../RegistryPanel/RegistryPanel'
import type { Panel } from '../../store/uiStore'

// ── Constants ──────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const SLEIPNER_PDF = `${BASE}/sleipner-validation-report.pdf`

const DEMO_PRESET_NAME  = 'Malay Basin'
const DEMO_SPEED        = 5
const DEMO_YEARS        = 50
const INTRO_DURATION_MS = 3_000

// ── Stage config ───────────────────────────────────────────────────────────────

interface Stage {
  id: number
  label: string
  introTitle: string
  introText: string
  activeHeadline: string
  activeSub: string
  panel: Panel
  sidebarOpen: boolean
  activeDurationMs: number
  showPDF?: true        // show Sleipner PDF 2 s into active
  autoAction?: 'certificate'
}

const STAGES: Stage[] = [
  // ── Stage 0: Custom formation wizard walkthrough ──────────────────────────
  {
    id: 0, label: 'Project Setup',
    introTitle: 'Create Your Own Storage Formation',
    introText: 'CarbonLens guides you through naming your formation, picking its country from validated saline aquifer regions, choosing a structural geometry, then selecting a peer-reviewed analogue as your parameter template.',
    activeHeadline: 'Custom formation\ncreated from template\nin 3 steps.',
    activeSub: 'Formation name · Country (Malaysia) · Dome geometry · Template: Malay Basin — every parameter is then fully editable',
    panel: 'formation', sidebarOpen: false, activeDurationMs: 9_000,
  },
  // ── Stage 1–7: the original stages ───────────────────────────────────────
  {
    id: 1, label: '3D Plume',
    introTitle: 'Real-Time CO₂ Plume Simulation',
    introText: 'Watch CO₂ injected into a Tertiary saline aquifer in the South China Sea — full multi-physics simulation computed live in your browser at 5× speed.',
    activeHeadline: 'Real geological data.\nReal physics.\nRunning in your browser.',
    activeSub: 'Malay Basin · South China Sea, Malaysia · CO₂ plume migrating through Tertiary saline aquifer at 5× speed',
    panel: 'simulation', sidebarOpen: false, activeDurationMs: 12_000,
  },
  {
    id: 2, label: 'Formation',
    introTitle: 'Formation Configuration',
    introText: 'Site-specific parameters — depth, porosity, permeability, area — are loaded for the Malay Basin. Any of the 16 global presets or a custom formation can be configured here.',
    activeHeadline: '50-year injection\nscenario loaded.\nAll parameters set.',
    activeSub: 'Depth: 2,800 m · Porosity: 25% · Permeability: 400 mD · 120 km² · Injection: 0.4 Mt/yr × 50 yr = 20 Mt total',
    panel: 'formation', sidebarOpen: true, activeDurationMs: 8_000,
  },
  {
    id: 3, label: 'Geomechanics',
    introTitle: 'Caprock Integrity Analysis',
    introText: 'Will the injection pressure fracture the caprock? CarbonLens checks this automatically — Mohr-Coulomb failure criterion, Biot coupling, and MAIP safety threshold.',
    activeHeadline: 'Caprock integrity\nanalysis — automated.',
    activeSub: 'Mohr-Coulomb failure criterion · Biot poroelastic coupling · MAIP constraint · Real-time safety factor',
    panel: 'geomechanics', sidebarOpen: true, activeDurationMs: 8_000,
  },
  {
    id: 4, label: 'Results',
    introTitle: 'Storage Capacity & Trapping Breakdown',
    introText: 'P10 / P50 / P90 capacity estimates, trapping mechanism split (structural, residual, solubility), and a regulatory compliance check — all computed in seconds.',
    activeHeadline: 'Storage capacity,\ntrapping breakdown,\nregulatory readiness.',
    activeSub: 'P10 / P50 / P90 capacity bounds · Residual + solubility trapping · 5-jurisdiction compliance check',
    panel: 'overview', sidebarOpen: true, activeDurationMs: 8_000,
  },
  {
    id: 5, label: 'Monte Carlo',
    introTitle: 'Uncertainty Quantification',
    introText: 'A Monte Carlo sweep propagates parameter uncertainty into storage capacity risk bounds — giving operators defensible P10/P50/P90 estimates for permit applications.',
    activeHeadline: 'Uncertainty\nquantified. Risk\nbounds computed.',
    activeSub: 'Monte Carlo sampling · Tornado sensitivity chart · P10 / P50 / P90 storage capacity range',
    panel: 'montecarlo', sidebarOpen: true, activeDurationMs: 8_000,
  },
  {
    id: 6, label: 'Permit Report',
    introTitle: 'Jurisdiction-Ready Permit Export',
    introText: 'CarbonLens generates a full permit application PDF in seconds — pre-filled with simulation outputs, benchmark-validated data, and formatted to EPA Class VI, EU CCS, UK NSTA, or AU NOPSEMA standards.',
    activeHeadline: 'Generating regulatory\npermit application\nPDF export.',
    activeSub: 'EPA Class VI / EU CCS / UK NSTA / AU NOPSEMA · Benchmark-validated · Full geology + geomechanics + economics',
    panel: 'export', sidebarOpen: true, activeDurationMs: 11_000, showPDF: true,
  },
  {
    id: 7, label: 'Certificate',
    introTitle: 'Digital Storage Certificate',
    introText: 'Each verified assessment is issued a tamper-evident digital certificate with a unique URL — anchoring the result to the CarbonLens Digital Twin Registry for carbon credit issuance.',
    activeHeadline: 'Digital storage\ncertificate issued\n& verified.',
    activeSub: 'Carbon credit issuance · Digital Twin Registry · Shareable /registry/verify/CL-XXXX verification URL',
    panel: 'registry', sidebarOpen: true, activeDurationMs: 10_000, autoAction: 'certificate',
  },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function DemoModeOverlay() {
  const demoActive    = useUIStore((s) => s.demoActive)
  const setDemoActive = useUIStore((s) => s.setDemoActive)
  const setView       = useUIStore((s) => s.setView)
  const setPanel      = useUIStore((s) => s.setPanel)
  const setSidebar    = useUIStore((s) => s.setSidebar)
  const jurisdiction  = useUIStore((s) => s.jurisdiction)
  const setSpeed      = useSimulationStore((s) => s.setAnimationSpeed)
  const isAnimating   = useSimulationStore((s) => s.isAnimating)
  const result        = useSimulationStore((s) => s.result)

  type SubPhase = 'waiting' | 'intro' | 'active' | 'complete'
  const [subPhase, setSubPhase]         = useState<SubPhase>('waiting')
  const [stageIdx, setStageIdx]         = useState(0)
  const [introProgress, setIntroProg]   = useState(0)
  const [activeProgress, setActProg]    = useState(0)
  const [certSaved, setCertSaved]       = useState(false)
  const [demoCertId, setDemoCertId]     = useState<string | null>(null)
  const [showPDFPanel, setShowPDFPanel] = useState(false)
  const [showCertPanel, setShowCertPanel] = useState(false)
  const [isRecording, setIsRecording]   = useState(false)
  const [videoUrl, setVideoUrl]         = useState<string | null>(null)
  const [showVideo, setShowVideo]       = useState(false)
  const [recMode, setRecMode]           = useState<'none' | 'tab' | 'canvas'>('none')

  const introTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pdfTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const introRafRef    = useRef<number>(0)
  const activeRafRef   = useRef<number>(0)
  const phaseStartRef  = useRef<number>(0)
  const mediaRecRef    = useRef<MediaRecorder | null>(null)
  const videoChunksRef = useRef<Blob[]>([])
  const recStreamRef   = useRef<MediaStream | null>(null)
  const hasRecordingRef = useRef<boolean>(false)

  const { runAnimation } = useSimulation()

  // ── Recording helpers ─────────────────────────────────────────────────────────
  const startMediaRecorder = useCallback((stream: MediaStream, mode: 'tab' | 'canvas') => {
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
    if (!mimeType) return
    const rec = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: mode === 'tab' ? 1_500_000 : 600_000,
    })
    videoChunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data) }
    rec.start(200)
    mediaRecRef.current = rec
    recStreamRef.current = stream
    hasRecordingRef.current = true
    setIsRecording(true)
    setRecMode(mode)
  }, [])

  // Full-tab recording via screen share
  const startFullTabRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 8 } as MediaTrackConstraints,
        audio: false,
        // @ts-ignore — preferCurrentTab is a Chrome hint
        preferCurrentTab: true,
      })
      startMediaRecorder(stream, 'tab')
    } catch {
      // User declined or not supported — fallback silently
    }
  }, [startMediaRecorder])

  // Canvas-only fallback
  const startCanvasRecording = useCallback(() => {
    try {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas || typeof canvas.captureStream !== 'function') return
      startMediaRecorder(canvas.captureStream(8), 'canvas')
    } catch { /* ignore */ }
  }, [startMediaRecorder])

  const stopRecording = useCallback(() => {
    const rec = mediaRecRef.current
    if (!rec || rec.state === 'inactive') return
    rec.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      setVideoUrl(url)
      // Auto-download failsafe — fires regardless of whether modal is shown
      const a = document.createElement('a')
      a.href = url
      a.download = 'carbonlens-demo.webm'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
    rec.stop()
    recStreamRef.current?.getTracks().forEach((t) => t.stop())
    setIsRecording(false)
  }, [])

  // ── Certificate auto-save ─────────────────────────────────────────────────────
  const saveDemoCertificate = useCallback(() => {
    const r = useSimulationStore.getState().result
    const g = useSimulationStore.getState().geomechanics
    const p = useFormationStore.getState().params
    if (!r || !g) return
    const h   = p.depth.toString(16).padStart(4, '0')
    const pct = (p.porosity * 100).toFixed(0).padStart(2, '0')
    const a   = p.area.toFixed(0).padStart(3, '0')
    const assetId = `CL-${h}-${pct}-${a}`
    const rate = jurisdiction === 'US' ? 85 : jurisdiction === 'EU' ? 60 : jurisdiction === 'Australia' ? 45 : 70
    const isOk = r.containmentProbability >= 0.85 && !g.mohrFailed && g.safetyFactor >= 1.2
    const record: CertificateRecord = {
      assetId, savedAt: new Date().toISOString(), formationName: DEMO_PRESET_NAME,
      jurisdiction, depth: p.depth, area: p.area, porosity: p.porosity,
      status: isOk ? 'Verified' : 'Review Required',
      containmentProbability: r.containmentProbability, safetyFactor: g.safetyFactor,
      storageCapacity: r.storageCapacity, totalCapacity: r.totalCapacity,
      plumeRadius: r.plumeRadius, injectionPressure: r.injectionPressure,
      maip: g.maip, maipMargin: g.maipMargin, mobilePlume: r.mobilePlume,
      residualTrapping: r.residualTrapping, solubilityTrapping: r.solubilityTrapping,
      overpressureRisk: r.overpressureRisk, totalCredits: r.storageCapacity * rate,
      projectYears: DEMO_YEARS,
    }
    try {
      const stored = JSON.parse(localStorage.getItem('carbonlens_certificates') ?? '{}')
      stored[assetId] = record
      localStorage.setItem('carbonlens_certificates', JSON.stringify(stored))
      setDemoCertId(assetId)
      setCertSaved(true)
      // Show certificate inline after a brief pause
      setTimeout(() => setShowCertPanel(true), 600)
    } catch { /* ignore */ }
  }, [jurisdiction])

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    [introTimerRef, activeTimerRef, actionTimerRef, pdfTimerRef].forEach((r) => {
      if (r.current) clearTimeout(r.current)
    })
    cancelAnimationFrame(introRafRef.current)
    cancelAnimationFrame(activeRafRef.current)
  }, [])

  // ── RAF progress ──────────────────────────────────────────────────────────────
  const startIntroRAF = useCallback(() => {
    phaseStartRef.current = performance.now()
    const tick = () => {
      const pct = Math.min(100, ((performance.now() - phaseStartRef.current) / INTRO_DURATION_MS) * 100)
      setIntroProg(pct)
      if (pct < 100) introRafRef.current = requestAnimationFrame(tick)
    }
    introRafRef.current = requestAnimationFrame(tick)
  }, [])

  const startActiveRAF = useCallback((dur: number) => {
    phaseStartRef.current = performance.now()
    const tick = () => {
      const pct = Math.min(100, ((performance.now() - phaseStartRef.current) / dur) * 100)
      setActProg(pct)
      if (pct < 100) activeRafRef.current = requestAnimationFrame(tick)
    }
    activeRafRef.current = requestAnimationFrame(tick)
  }, [])

  // ── Stage machine ─────────────────────────────────────────────────────────────
  const goToStage = useCallback((idx: number) => {
    cleanup()
    setShowPDFPanel(false)
    setShowCertPanel(false)

    if (idx >= STAGES.length) {
      setSubPhase('complete')
      stopRecording()
      activeTimerRef.current = setTimeout(() => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        setDemoActive(false)
        setSidebar(true)
        setPanel('overview')
        setSpeed(1)
        // If a recording was started, stay in the workspace so the video modal renders.
        // The auto-download in stopRecording() already saved the file; the modal is a bonus.
        if (!hasRecordingRef.current) {
          setView('landing')
        } else {
          setShowVideo(true)
        }
      }, 5_000)
      return
    }

    const s = STAGES[idx]
    setStageIdx(idx)
    setSubPhase('intro')
    setIntroProg(0)
    setActProg(0)
    setSidebar(false)
    startIntroRAF()

    introTimerRef.current = setTimeout(() => {
      cancelAnimationFrame(introRafRef.current)
      setSubPhase('active')
      setPanel(s.panel)
      setSidebar(s.sidebarOpen)
      startActiveRAF(s.activeDurationMs)

      // Permit stage: show PDF after 2 s
      if (s.showPDF) {
        pdfTimerRef.current = setTimeout(() => setShowPDFPanel(true), 2_000)
      }

      // Certificate stage: auto-save after 1.5 s
      if (s.autoAction === 'certificate') {
        actionTimerRef.current = setTimeout(saveDemoCertificate, 1_500)
      }

      activeTimerRef.current = setTimeout(() => goToStage(idx + 1), s.activeDurationMs)
    }, INTRO_DURATION_MS)
  }, [cleanup, stopRecording, setDemoActive, setSidebar, setPanel, setSpeed, setView,
      startIntroRAF, startActiveRAF, saveDemoCertificate])

  // ── Init ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!demoActive) {
      setSubPhase('waiting')
      setStageIdx(0)
      setIntroProg(0)
      setActProg(0)
      setCertSaved(false)
      setDemoCertId(null)
      setShowPDFPanel(false)
      setShowCertPanel(false)
      setIsRecording(false)
      setRecMode('none')
      hasRecordingRef.current = false
      cleanup()
      return
    }

    // Pre-load formation data — but do NOT start the stage machine yet.
    // The user must click "Start Fullscreen Demo" first.
    const preset = FORMATION_PRESETS.find((p) => p.name === DEMO_PRESET_NAME)
    if (preset) useFormationStore.getState().load(preset.params)
    const wells = useFormationStore.getState().wells.map((w) => ({ ...w, injectionRate: 0.4 }))
    useFormationStore.getState().setWells(wells)
    useUIStore.getState().setProjectYears(DEMO_YEARS)
    useSimulationStore.getState().reset()
    setSpeed(DEMO_SPEED)
    setSubPhase('waiting')

    return () => { cleanup() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoActive])

  // ── Start demo (called after user clicks fullscreen button) ───────────────
  const startDemo = useCallback(async () => {
    // Kick off simulation
    const p = useFormationStore.getState().params
    const w = useFormationStore.getState().wells
    useSimulationStore.getState().setValidation(validateGeomechanics(p, w))
    useSimulationStore.getState().setForceRun(true)
    runAnimation()
    // Request fullscreen — stage machine starts after browser settles
    try {
      await document.documentElement.requestFullscreen()
    } catch { /* not supported or denied — start anyway */ }
    setTimeout(() => goToStage(0), 400)
  }, [runAnimation, goToStage])

  // ── Exit ──────────────────────────────────────────────────────────────────────
  const exit = useCallback(() => {
    cleanup()
    stopRecording()
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    setDemoActive(false)
    setSidebar(true)
    setPanel('overview')
    setSpeed(1)
    setView('landing')
  }, [cleanup, stopRecording, setDemoActive, setSidebar, setPanel, setSpeed, setView])

  // ── Video modal ───────────────────────────────────────────────────────────────
  if (!demoActive && showVideo && videoUrl) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6 backdrop-blur-sm">
        <div className="bg-[#0a1015] border border-emerald-500/20 rounded-2xl overflow-hidden max-w-4xl w-full shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <div className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase mb-0.5">
                Demo Recording · {recMode === 'tab' ? 'Full Tab Capture' : '3D Canvas Only'}
              </div>
              <div className="text-sm font-semibold text-white">
                {DEMO_PRESET_NAME} · {DEMO_YEARS}-Year CO₂ Storage Scenario
              </div>
            </div>
            <button onClick={() => { setShowVideo(false); setView('landing') }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition">
              <X size={16} />
            </button>
          </div>
          <video src={videoUrl} controls autoPlay loop className="w-full bg-black" style={{ maxHeight: '55vh' }} />
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
            <p className="text-[10px] text-white/30 font-mono">
              CarbonLens Simulation Studio v3 · WebM
            </p>
            <div className="flex gap-3">
              <a href={videoUrl} download="carbonlens-demo.webm"
                className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono hover:bg-emerald-500/25 transition">
                ↓ Download WebM
              </a>
              <button onClick={() => { setShowVideo(false); setView('landing') }}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-mono hover:bg-white/10 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!demoActive) return null

  const stage = STAGES[Math.min(stageIdx, STAGES.length - 1)]

  // Wizard demo step: computed from activeProgress during stage 0
  const wizardDemoStep = stageIdx === 0
    ? (activeProgress < 28 ? 1 : activeProgress < 62 ? 2 : 3)
    : 0

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══ WAITING / FULLSCREEN GATE ════════════════════════════════════════ */}
      {subPhase === 'waiting' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #040f1e 0%, #0b2240 50%, #040f1e 100%)' }}>

          <button onClick={exit}
            className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/60 hover:text-white text-[10px] font-mono transition">
            <X size={11} /> Cancel
          </button>

          {/* Recording options — top left */}
          <div className="absolute top-5 left-5 flex gap-2">
            {!isRecording ? (
              <>
                <button onClick={startFullTabRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 text-[10px] font-mono transition">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Record Full Session
                </button>
                <button onClick={startCanvasRecording}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/15 text-white/40 hover:text-white/60 text-[9px] font-mono transition">
                  3D Only
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-red-500/30">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-mono text-red-400 tracking-widest">RECORDING — press Start to begin demo</span>
              </div>
            )}
          </div>

          {/* Badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 mb-8">
            <span className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">
              {STAGES.length} Stages · {DEMO_YEARS}-Year CO₂ Storage Scenario
            </span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-white text-center px-8 mb-4 leading-tight max-w-2xl"
            style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            CarbonLens End-to-End Demo
          </h2>
          <p className="text-sm text-white/50 text-center px-8 max-w-xl leading-relaxed font-mono mb-3">
            {DEMO_PRESET_NAME} · South China Sea, Malaysia · 5× speed · ~90 seconds
          </p>
          <p className="text-[10px] text-white/30 text-center font-mono mb-10">
            The demo will go fullscreen. Use <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/40">Esc</kbd> at any time to exit.
          </p>

          {/* Stage preview pills */}
          <div className="flex items-center gap-1.5 mb-10 flex-wrap justify-center px-8">
            {STAGES.map((s) => (
              <span key={s.id} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-white/35">
                {s.label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <button onClick={startDemo}
            className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm font-mono transition shadow-lg shadow-emerald-500/30 active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Start Fullscreen Demo
          </button>
          <p className="text-[9px] text-white/20 font-mono mt-4">
            Click record buttons above first if you want to capture the session
          </p>
        </div>
      )}

      {/* ══ INTRO card ══════════════════════════════════════════════════════ */}
      {subPhase === 'intro' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #040f1e 0%, #0b2240 50%, #040f1e 100%)' }}>

          <button onClick={exit}
            className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/60 hover:text-white text-[10px] font-mono transition">
            <X size={11} /> Exit
          </button>

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-5 left-5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-red-500/30">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-mono text-red-400 tracking-widest">
                {recMode === 'tab' ? 'RECORDING FULL SESSION' : 'RECORDING 3D CANVAS'}
              </span>
            </div>
          )}

          {/* Stage pill */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 mb-8">
            <span className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">
              Stage {stage.id + 1} of {STAGES.length} · {stage.label}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center px-8 mb-5 leading-tight max-w-2xl"
            style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
            {stage.introTitle}
          </h2>

          {/* Description */}
          <p className="text-sm text-white/50 text-center px-8 max-w-xl leading-relaxed font-mono mb-12">
            {stage.introText}
          </p>

          {/* Stage track */}
          <div className="flex items-center gap-1.5 mb-6">
            {STAGES.map((s, i) => (
              <div key={s.id} className={`h-1 rounded-full transition-all duration-300 ${
                i === stageIdx ? 'w-8 bg-emerald-400' : i < stageIdx ? 'w-3 bg-emerald-400/40' : 'w-3 bg-white/10'
              }`} />
            ))}
          </div>

          {/* Countdown bar */}
          <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400/60 rounded-full" style={{ width: `${introProgress}%`, transition: 'none' }} />
          </div>
          <p className="text-[9px] font-mono text-white/25 mt-2 tracking-widest">STARTING…</p>
        </div>
      )}

      {/* ══ ACTIVE overlay ══════════════════════════════════════════════════ */}
      {subPhase === 'active' && (
        <>
          {/* Bottom gradient */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40"
            style={{ height: '55%', background: 'linear-gradient(to top, rgba(3,8,20,0.95) 0%, rgba(3,8,20,0.55) 55%, transparent 100%)' }} />

          {/* Stage badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono font-semibold text-emerald-300 tracking-wider uppercase">
                Stage {stage.id + 1} / {STAGES.length} · {stage.label}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>

          {/* Sim speed */}
          {isAnimating && (
            <div className="absolute top-4 right-4 z-50 pointer-events-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-white/10 backdrop-blur-sm">
                <Play size={10} className="text-emerald-400 animate-pulse" />
                <span className="text-[9px] font-mono text-emerald-300">SIMULATING · {DEMO_SPEED}× SPEED</span>
              </div>
            </div>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-4 left-4 z-50 pointer-events-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/50 border border-red-500/40 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-mono text-red-400 tracking-widest">
                  {recMode === 'tab' ? 'REC · FULL TAB' : 'REC · 3D'}
                </span>
              </div>
            </div>
          )}

          {/* ── Wizard demo overlay (stage 0) ── */}
          {stageIdx === 0 && (
            <div className="fixed inset-x-0 top-16 bottom-20 z-60 flex items-center justify-center px-4"
              style={{ background: 'rgba(3,8,20,0.92)' }}>
              <div className="w-full max-w-lg">

                {/* Step indicators */}
                <div className="flex items-center gap-2 mb-6 justify-center">
                  {[
                    { n: 1, label: 'Identity' },
                    { n: 2, label: 'Geometry' },
                    { n: 3, label: 'Template' },
                  ].map(({ n, label }, i) => (
                    <div key={n} className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-mono transition-all duration-500 ${
                        wizardDemoStep === n
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : wizardDemoStep > n
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/50'
                          : 'bg-white/5 border-white/10 text-white/25'
                      }`}>
                        {wizardDemoStep > n
                          ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          : <span>{n}</span>
                        }
                        {label}
                      </div>
                      {i < 2 && <div className="w-6 h-px bg-white/10" />}
                    </div>
                  ))}
                </div>

                {/* Step 1: Formation Identity */}
                {wizardDemoStep === 1 && (
                  <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0a1628' }}>
                    <div className="px-5 py-4 border-b border-white/8">
                      <div className="text-[9px] font-mono text-emerald-400 tracking-widest uppercase mb-0.5">Step 1 of 3 · Formation Identity</div>
                      <div className="text-sm font-semibold text-white">Name your formation & choose its country</div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-1.5">Formation Name</div>
                        <div className="px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-sm text-emerald-200 font-mono">
                          Malay Basin Saline Aquifer
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-1.5">Country — must have characterised saline aquifers</div>
                        <div className="px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-sm text-emerald-200 font-mono flex items-center gap-2">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          Malaysia
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Geometry */}
                {wizardDemoStep === 2 && (
                  <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0a1628' }}>
                    <div className="px-5 py-4 border-b border-white/8">
                      <div className="text-[9px] font-mono text-emerald-400 tracking-widest uppercase mb-0.5">Step 2 of 3 · Structural Geometry</div>
                      <div className="text-sm font-semibold text-white">Choose the trapping structure for Malay Basin Saline Aquifer</div>
                    </div>
                    <div className="p-5 grid grid-cols-3 gap-2.5">
                      {['Anticline','Dome','Fault','Layered','Strat.','Channel'].map((g, i) => (
                        <div key={g} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center text-[10px] font-mono transition ${
                          i === 1
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                            : 'bg-white/3 border-white/8 text-white/30'
                        }`}>
                          <div className="w-6 h-4 border border-current rounded opacity-60" />
                          {g}
                          {i === 1 && <span className="text-[8px] text-emerald-400">✓ Selected</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3: Template */}
                {wizardDemoStep === 3 && (
                  <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0a1628' }}>
                    <div className="px-5 py-4 border-b border-white/8">
                      <div className="text-[9px] font-mono text-emerald-400 tracking-widest uppercase mb-0.5">Step 3 of 3 · Select Template Formation</div>
                      <div className="text-sm font-semibold text-white">Pick the geologically closest validated analogue</div>
                    </div>
                    <div className="p-5 space-y-2">
                      {['Sleipner Utsira — Norway','Mount Simon — USA','Malay Basin — Malaysia','Gorgon — Australia'].map((p, i) => (
                        <div key={p} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-mono ${
                          i === 2
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                            : 'bg-white/3 border-white/8 text-white/30'
                        }`}>
                          {p}
                          {i === 2 && (
                            <span className="text-[8px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">Template ✓</span>
                          )}
                        </div>
                      ))}
                      <div className="text-[9px] text-white/25 font-mono text-center pt-1">+ 12 more presets available</div>
                    </div>
                    <div className="px-5 pb-5">
                      <div className="mt-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <span className="text-xs font-mono text-emerald-300">Project created → Formation panel</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PDF overlay (stage 6 — Permit) ── */}
          {showPDFPanel && (
            <div className="fixed inset-x-0 top-16 bottom-20 z-60 flex flex-col"
              style={{ background: 'rgba(4,15,30,0.97)', backdropFilter: 'blur(4px)' }}>
              <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 shrink-0">
                <div>
                  <div className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase mb-0.5">Sample Report Export</div>
                  <div className="text-sm font-semibold text-white">
                    Sleipner Utsira Benchmark Validation Report — CarbonLens
                  </div>
                  <div className="text-[10px] text-white/40 font-mono mt-0.5">
                    Demonstrates CarbonLens permit-quality output · Validated vs. Arts (2004), Boait (2012), Furre (2017)
                  </div>
                </div>
                <a href={SLEIPNER_PDF} target="_blank" rel="noopener noreferrer"
                  className="ml-4 text-[10px] font-mono text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition shrink-0">
                  Open Full PDF ↗
                </a>
              </div>
              <div className="flex-1 min-h-0">
                <object
                  data={SLEIPNER_PDF}
                  type="application/pdf"
                  className="w-full h-full"
                  style={{ border: 'none' }}
                >
                  {/* Fallback if browser can't render PDF inline */}
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                    <div className="text-4xl">📄</div>
                    <div className="text-sm text-white/60 font-mono">PDF preview unavailable in this browser</div>
                    <a href={SLEIPNER_PDF} target="_blank" rel="noopener noreferrer"
                      className="px-6 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-sm hover:bg-emerald-500/25 transition">
                      Open Validation Report →
                    </a>
                  </div>
                </object>
              </div>
            </div>
          )}

          {/* ── Certificate overlay (stage 6) ── */}
          {showCertPanel && demoCertId && (
            <div className="fixed inset-x-0 top-16 bottom-20 z-60 overflow-auto"
              style={{ background: '#f0f4f8' }}>
              <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
                <div>
                  <div className="text-[10px] font-mono text-emerald-600 tracking-widest uppercase mb-0.5">Digital Twin Registry</div>
                  <div className="text-sm font-semibold text-gray-800">Certificate of Storage Verification — {demoCertId}</div>
                </div>
                <a href={`/registry/verify/${demoCertId}`} target="_blank" rel="noopener noreferrer"
                  className="ml-4 text-[10px] font-mono text-emerald-600 border border-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition shrink-0">
                  Open Full Page ↗
                </a>
              </div>
              <div className="p-4">
                <CertificatePage assetId={demoCertId} embedded />
              </div>
            </div>
          )}

          {/* ── Main HUD ── */}
          <div className="absolute bottom-0 inset-x-0 z-50 px-6 pb-6 pt-2 pointer-events-none">
            {/* Stage track */}
            <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
              {STAGES.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1.5 shrink-0">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === stageIdx ? 'w-8 bg-emerald-400' : i < stageIdx ? 'w-3 bg-emerald-400/40' : 'w-3 bg-white/10'
                  }`} />
                  <span className={`text-[8px] font-mono ${
                    i === stageIdx ? 'text-emerald-300' : i < stageIdx ? 'text-white/35' : 'text-white/15'
                  }`}>{s.label}</span>
                  {i < STAGES.length - 1 && <ChevronRight size={7} className="text-white/15" />}
                </div>
              ))}
            </div>

            {/* Headline */}
            <div className="mb-2">
              {stage.activeHeadline.split('\n').map((line, i) => (
                <div key={i} className="font-bold text-white leading-tight"
                  style={{ fontSize: i === 0 ? '1.85rem' : '1.55rem', lineHeight: 1.1 }}>
                  {line}
                </div>
              ))}
            </div>

            <p className="text-sm text-white/55 font-mono mb-4 max-w-2xl">{stage.activeSub}</p>

            {/* Live stats */}
            {result && (
              <div className="flex items-center gap-5 mb-4 flex-wrap">
                {[
                  { label: 'P50 Capacity',    value: `${result.p50.toFixed(0)} Mt CO₂` },
                  { label: 'Containment',     value: `${(result.containmentProbability * 100).toFixed(0)}%` },
                  { label: 'Residual Trapped',value: `${result.residualTrapping.toFixed(2)} Mt` },
                  { label: 'CO₂ Density',     value: `${result.co2Density.toFixed(0)} kg/m³` },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-base font-bold text-emerald-300 font-mono">{stat.value}</div>
                    <div className="text-[8px] text-white/35 font-mono uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Cert saving animation */}
            {stage.autoAction === 'certificate' && !certSaved && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-300">Issuing certificate to Digital Twin Registry…</span>
              </div>
            )}
            {certSaved && demoCertId && !showCertPanel && (
              <div className="flex items-center gap-2 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="text-[10px] font-mono text-emerald-300">Certificate issued · {demoCertId} · Loading preview…</span>
              </div>
            )}

            {/* Progress + exit */}
            <div className="flex items-center gap-4 pointer-events-auto">
              <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${activeProgress}%`, transition: 'none' }} />
              </div>
              <button onClick={exit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 hover:text-white text-[10px] font-mono transition backdrop-blur-sm">
                <X size={11} /> Exit Demo
              </button>
            </div>

            <p className="text-[8px] text-white/20 font-mono mt-2">
              CarbonLens · Span-Wagner EOS · Duan-Sun Solubility · Nordbotten Two-Phase · Mohr-Coulomb · MARS ML IFT · UTP Malaysia · Sleipner-validated
            </p>
          </div>
        </>
      )}

      {/* ══ COMPLETE card ═══════════════════════════════════════════════════ */}
      {subPhase === 'complete' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #040f1e 0%, #0b2240 50%, #040f1e 100%)' }}>
          <div className="flex flex-col items-center text-center px-8 max-w-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase mb-3">Demo Complete</div>
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
              End-to-End CCS Workflow
            </h2>
            <p className="text-sm text-white/50 font-mono mb-8 leading-relaxed">
              Simulation · Geomechanics · Uncertainty · Permit Report · Digital Certificate — all in under 90 seconds.
              {videoUrl && ' Your session has been recorded.'}
            </p>

            {result && (
              <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-md">
                {[
                  { label: 'P50 Storage',  value: `${result.p50.toFixed(0)} Mt` },
                  { label: 'Containment', value: `${(result.containmentProbability * 100).toFixed(0)}%` },
                  { label: 'Duration',    value: `${DEMO_YEARS} yrs` },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                    <div className="text-xl font-bold text-emerald-400 font-mono">{s.value}</div>
                    <div className="text-[9px] text-white/35 font-mono uppercase tracking-wider mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 flex-wrap justify-center">
              {videoUrl && (
                <button onClick={() => { setDemoActive(false); setView('landing'); setShowVideo(true) }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-mono hover:bg-emerald-500/25 transition">
                  ▶ Watch Recording
                </button>
              )}
              {demoCertId && (
                <a href={`/registry/verify/${demoCertId}`} target="_blank" rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white/60 text-sm font-mono hover:bg-white/10 transition">
                  View Certificate →
                </a>
              )}
              <button onClick={() => { exit(); setView('auth') }}
                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white/50 text-sm font-mono hover:bg-white/10 transition">
                Try It Yourself →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
