/**
 * DemoModeOverlay — full end-to-end automated demo.
 *
 * Stages (< 2 minutes total):
 *   0  3D Plume       10 s  Full-screen 3D plume animation
 *   1  Formation       7 s  Formation configuration panel
 *   2  Geomechanics    7 s  Caprock integrity analysis
 *   3  Results         7 s  Storage capacity + trapping stats
 *   4  Monte Carlo     7 s  Uncertainty analysis
 *   5  Permit Report   9 s  Export panel — auto-saves permit PDF
 *   6  Certificate     8 s  Registry — auto-saves digital certificate
 *
 * Total: ~55 seconds (loops back to stage 0 for exhibition use)
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { X, Play, ChevronRight } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useSimulation, validateGeomechanics } from '../../hooks/useSimulation'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import type { CertificateRecord } from '../RegistryPanel/RegistryPanel'
import type { Panel } from '../../store/uiStore'

// ── Demo configuration ─────────────────────────────────────────────────────────

const DEMO_PRESET_NAME = 'Malay Basin'
const DEMO_SPEED = 5
const DEMO_PROJECT_YEARS = 50

interface Stage {
  id: number
  label: string
  headline: string
  sub: string
  panel: Panel
  sidebarOpen: boolean
  durationMs: number
  autoAction?: 'certificate'
}

const STAGES: Stage[] = [
  {
    id: 0,
    label: '3D Plume',
    headline: 'Real geological data.\nReal physics.\nRunning in your browser.',
    sub: 'Malay Basin · South China Sea, Malaysia · CO₂ plume migrating through Tertiary saline aquifer',
    panel: 'simulation',
    sidebarOpen: false,
    durationMs: 10_000,
  },
  {
    id: 1,
    label: 'Formation',
    headline: 'Formation configured.\n50-year injection\nscenario loaded.',
    sub: 'Depth: 2,800 m · Porosity: 25% · Permeability: 400 mD · 120 km² · Injection: 0.4 Mt/yr',
    panel: 'formation',
    sidebarOpen: true,
    durationMs: 7_000,
  },
  {
    id: 2,
    label: 'Geomechanics',
    headline: 'Caprock integrity\nanalysis — automated.',
    sub: 'Mohr-Coulomb failure analysis · Biot poroelastic coupling · Real-time safety factors',
    panel: 'geomechanics',
    sidebarOpen: true,
    durationMs: 7_000,
  },
  {
    id: 3,
    label: 'Results',
    headline: 'Storage capacity,\ntrapping breakdown,\nregulatory readiness.',
    sub: 'P10 / P50 / P90 capacity estimate · Residual + solubility trapping · 5-jurisdiction compliance',
    panel: 'overview',
    sidebarOpen: true,
    durationMs: 7_000,
  },
  {
    id: 4,
    label: 'Monte Carlo',
    headline: 'Uncertainty\nquantified. Risk\nbounds computed.',
    sub: 'Monte Carlo sampling · Tornado sensitivity chart · P10 / P50 / P90 capacity range',
    panel: 'montecarlo',
    sidebarOpen: true,
    durationMs: 7_000,
  },
  {
    id: 5,
    label: 'Permit Report',
    headline: 'Generating\nregulatory permit\napplication.',
    sub: 'EPA Class VI / EU CCS / UK NSTA · Jurisdiction-ready PDF · Benchmark-validated outputs',
    panel: 'export',
    sidebarOpen: true,
    durationMs: 9_000,
  },
  {
    id: 6,
    label: 'Certificate',
    headline: 'Digital storage\ncertificate issued\n& verified.',
    sub: 'Carbon credit issuance · Digital Twin Registry · Shareable verification URL',
    panel: 'registry',
    sidebarOpen: true,
    durationMs: 8_000,
    autoAction: 'certificate',
  },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function DemoModeOverlay() {
  const demoActive    = useUIStore((s) => s.demoActive)
  const setDemoActive = useUIStore((s) => s.setDemoActive)
  const setPanel      = useUIStore((s) => s.setPanel)
  const setSidebar    = useUIStore((s) => s.setSidebar)
  const jurisdiction  = useUIStore((s) => s.jurisdiction)
  const setSpeed      = useSimulationStore((s) => s.setAnimationSpeed)
  const isAnimating   = useSimulationStore((s) => s.isAnimating)
  const status        = useSimulationStore((s) => s.status)
  const result        = useSimulationStore((s) => s.result)

  const [stageIdx, setStageIdx]       = useState(0)
  const [progress, setProgress]       = useState(0)
  const [started, setStarted]         = useState(false)
  const [certSaved, setCertSaved]     = useState(false)
  const [demoCertId, setDemoCertId]   = useState<string | null>(null)

  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef         = useRef<number>(0)
  const stageStart     = useRef<number>(0)

  const { runAnimation } = useSimulation()

  // ── Save demo certificate to localStorage ────────────────────────────────────
  const saveDemoCertificate = useCallback(() => {
    const simResult = useSimulationStore.getState().result
    const geomech   = useSimulationStore.getState().geomechanics
    const params    = useFormationStore.getState().params
    if (!simResult || !geomech) return

    const h = params.depth.toString(16).padStart(4, '0')
    const p = (params.porosity * 100).toFixed(0).padStart(2, '0')
    const a = params.area.toFixed(0).padStart(3, '0')
    const assetId = `CL-${h}-${p}-${a}`

    const rate = jurisdiction === 'US' ? 85 : jurisdiction === 'EU' ? 60 : jurisdiction === 'Australia' ? 45 : 70
    const isVerified = simResult.containmentProbability >= 0.85 && !geomech.mohrFailed && geomech.safetyFactor >= 1.2
    const certStatus: CertificateRecord['status'] = isVerified ? 'Verified' : 'Review Required'

    const record: CertificateRecord = {
      assetId,
      savedAt: new Date().toISOString(),
      formationName: DEMO_PRESET_NAME,
      jurisdiction,
      depth: params.depth,
      area: params.area,
      porosity: params.porosity,
      status: certStatus,
      containmentProbability: simResult.containmentProbability,
      safetyFactor: geomech.safetyFactor,
      storageCapacity: simResult.storageCapacity,
      totalCapacity: simResult.totalCapacity,
      plumeRadius: simResult.plumeRadius,
      injectionPressure: simResult.injectionPressure,
      maip: geomech.maip,
      maipMargin: geomech.maipMargin,
      mobilePlume: simResult.mobilePlume,
      residualTrapping: simResult.residualTrapping,
      solubilityTrapping: simResult.solubilityTrapping,
      overpressureRisk: simResult.overpressureRisk,
      totalCredits: simResult.storageCapacity * rate,
      projectYears: DEMO_PROJECT_YEARS,
    }

    try {
      const stored = JSON.parse(localStorage.getItem('carbonlens_certificates') ?? '{}')
      stored[assetId] = record
      localStorage.setItem('carbonlens_certificates', JSON.stringify(stored))
      setDemoCertId(assetId)
      setCertSaved(true)
    } catch {
      // silent — demo continues regardless
    }
  }, [jurisdiction])

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current)
    cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Advance to next stage ─────────────────────────────────────────────────────
  const goToStage = useCallback((idx: number) => {
    const s = STAGES[idx % STAGES.length]
    setStageIdx(idx % STAGES.length)
    setProgress(0)
    stageStart.current = performance.now()
    setPanel(s.panel)
    setSidebar(s.sidebarOpen)

    // Auto-actions
    if (s.autoAction === 'certificate') {
      actionTimerRef.current = setTimeout(saveDemoCertificate, 1_500)
    }

    timerRef.current = setTimeout(() => goToStage(idx + 1), s.durationMs)
  }, [setPanel, setSidebar, saveDemoCertificate])

  // ── Progress bar rAF ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!demoActive) return
    const tick = () => {
      const elapsed = performance.now() - stageStart.current
      const dur = STAGES[stageIdx]?.durationMs ?? 10_000
      setProgress(Math.min(100, (elapsed / dur) * 100))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [demoActive, stageIdx])

  // ── Initialise demo on activation ────────────────────────────────────────────
  useEffect(() => {
    if (!demoActive) {
      setStarted(false)
      setStageIdx(0)
      setProgress(0)
      setCertSaved(false)
      setDemoCertId(null)
      cleanup()
      return
    }

    // Load preset
    const preset = FORMATION_PRESETS.find((p) => p.name === DEMO_PRESET_NAME)
    if (preset) useFormationStore.getState().load(preset.params)

    // Safe injection rate: 0.4 Mt/yr × 50 yr = 20 Mt (well within P90 ~34 Mt for Malay Basin)
    const demoWells = useFormationStore.getState().wells.map((w) => ({ ...w, injectionRate: 0.4 }))
    useFormationStore.getState().setWells(demoWells)

    // Set project years
    useUIStore.getState().setProjectYears(DEMO_PROJECT_YEARS)

    // Reset + set speed
    useSimulationStore.getState().reset()
    setSpeed(DEMO_SPEED)

    const initTimer = setTimeout(() => {
      const params     = useFormationStore.getState().params
      const wells      = useFormationStore.getState().wells
      const validation = validateGeomechanics(params, wells)
      useSimulationStore.getState().setValidation(validation)
      useSimulationStore.getState().setForceRun(true)
      runAnimation()
      setStarted(true)
      stageStart.current = performance.now()
      goToStage(0)
    }, 400)

    return () => {
      clearTimeout(initTimer)
      cleanup()
    }
  }, [demoActive, runAnimation, goToStage, cleanup, setSpeed])

  // ── Exit ──────────────────────────────────────────────────────────────────────
  const exit = useCallback(() => {
    cleanup()
    setDemoActive(false)
    setSidebar(true)
    setPanel('overview')
    setSpeed(1)
  }, [cleanup, setDemoActive, setSidebar, setPanel, setSpeed])

  if (!demoActive) return null

  const stage = STAGES[stageIdx]
  const isCertStage = stage.id === 6

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Bottom gradient (legibility behind HUD) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-40"
        style={{ height: '52%', background: 'linear-gradient(to top, rgba(3,8,20,0.92) 0%, rgba(3,8,20,0.6) 55%, transparent 100%)' }}
      />

      {/* DEMO badge (top-centre) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono font-semibold text-emerald-300 tracking-widest uppercase">
            Demo Mode · {DEMO_PRESET_NAME} · {DEMO_PROJECT_YEARS}-Year Scenario
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      {/* Simulation speed indicator (top-right) */}
      {isAnimating && (
        <div className="absolute top-4 right-4 z-50 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-white/10 backdrop-blur-sm">
            <Play size={10} className="text-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-emerald-300">SIMULATING · {DEMO_SPEED}× SPEED</span>
          </div>
        </div>
      )}
      {status === 'complete' && !isAnimating && started && (
        <div className="absolute top-4 right-4 z-50 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-emerald-500/20 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-mono text-emerald-300">SIMULATION COMPLETE · {DEMO_PROJECT_YEARS} YRS</span>
          </div>
        </div>
      )}

      {/* Certificate saved badge (top-left, appears at registry stage) */}
      {certSaved && demoCertId && (
        <div className="absolute top-4 left-4 z-50 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-900/70 border border-emerald-500/40 backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span className="text-[9px] font-mono text-emerald-300">CERT ISSUED · {demoCertId}</span>
            <a
              href={`/registry/verify/${demoCertId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono text-emerald-400 hover:text-white underline transition"
            >
              View →
            </a>
          </div>
        </div>
      )}

      {/* Main HUD (bottom) */}
      <div className="absolute bottom-0 inset-x-0 z-50 px-6 pb-6 pt-2 pointer-events-none">

        {/* Stage progress track */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          {STAGES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5 shrink-0">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${
                i === stageIdx ? 'w-8 bg-emerald-400' : i < stageIdx ? 'w-3 bg-emerald-400/40' : 'w-3 bg-white/10'
              }`} />
              <span className={`text-[8px] font-mono transition-colors duration-300 ${
                i === stageIdx ? 'text-emerald-300' : i < stageIdx ? 'text-white/40' : 'text-white/20'
              }`}>{s.label}</span>
              {i < STAGES.length - 1 && <ChevronRight size={7} className="text-white/15" />}
            </div>
          ))}
        </div>

        {/* Headline */}
        <div className="mb-3">
          {stage.headline.split('\n').map((line, i) => (
            <div
              key={i}
              className="font-bold text-white leading-tight"
              style={{ fontSize: i === 0 ? '1.9rem' : '1.6rem', lineHeight: 1.1 }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Sub text */}
        <p className="text-sm text-white/60 font-mono mb-4 max-w-2xl">{stage.sub}</p>

        {/* Stats strip (visible when result available) */}
        {result && (
          <div className="flex items-center gap-6 mb-4 flex-wrap">
            {[
              { label: 'P50 Capacity', value: `${result.p50.toFixed(0)} Mt CO₂` },
              { label: 'Containment', value: `${(result.containmentProbability * 100).toFixed(0)}%` },
              { label: 'Residual Trapped', value: `${result.residualTrapping.toFixed(2)} Mt` },
              { label: 'CO₂ Density', value: `${result.co2Density.toFixed(0)} kg/m³` },
              ...(isCertStage && certSaved ? [{ label: 'Carbon Credits', value: `${(result.storageCapacity * 85).toFixed(0)}` }] : []),
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-lg font-bold text-emerald-300 font-mono">{stat.value}</div>
                <div className="text-[9px] text-white/40 font-mono uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Certificate auto-saving animation */}
        {isCertStage && !certSaved && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-300">Issuing digital certificate to registry...</span>
          </div>
        )}

        {/* Progress bar + exit */}
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 transition-none rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <button
            onClick={exit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 hover:text-white text-[10px] font-mono transition backdrop-blur-sm"
          >
            <X size={11} />
            Exit Demo
          </button>
        </div>

        {/* Attribution */}
        <p className="text-[9px] text-white/25 font-mono mt-3">
          CarbonLens · Physics: Span-Wagner (1996), Duan-Sun (2003), Nordbotten (2005), Mohr-Coulomb ·
          ML: MARS IFT model, Universiti Teknologi PETRONAS, Malaysia ·
          Validated: Sleipner Utsira field data · SPE11A benchmark
        </p>
      </div>
    </>
  )
}
