/**
 * DemoModeOverlay — exhibition stand auto-play mode.
 *
 * When activated:
 *  1. Loads the Malay Basin preset (familiar locale for Dubai audience + UTP Malaysia context)
 *  2. Forces the simulation to run at 5× speed
 *  3. Cycles through three stages on a timer, switching sidebar panels:
 *       Stage 0 → 3D plume animation   (12 s, sidebar hidden — full-screen 3D)
 *       Stage 1 → Geomechanics panel   (8 s)
 *       Stage 2 → Simulation results   (8 s)
 *  4. Displays a bottom HUD with: DEMO MODE badge, stage headline, progress bar, Exit button
 *
 * The 3D plume view is the strongest visual asset — it is front-and-centre for stages 0.
 * All stage transitions are non-destructive: exiting restores sidebar state.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { X, Play, ChevronRight } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useSimulation, validateGeomechanics } from '../../hooks/useSimulation'
import { FORMATION_PRESETS } from '../../data/formationPresets'

// ── Demo configuration ─────────────────────────────────────────────────────────

const DEMO_PRESET_NAME = 'Malay Basin'
const DEMO_SPEED = 5

interface Stage {
  id: number
  label: string          // short stage name shown in progress dots
  headline: string       // large overlay text
  sub: string            // smaller descriptor
  panel: 'simulation' | 'geomechanics' | 'economics' | 'overview'
  sidebarOpen: boolean
  durationMs: number
}

const STAGES: Stage[] = [
  {
    id: 0,
    label: '3D Plume',
    headline: 'Real geological data.\nReal physics.\nRunning in your browser.',
    sub: 'Malay Basin · South China Sea, Malaysia · CO₂ plume migrating through Tertiary saline aquifer',
    panel: 'simulation',
    sidebarOpen: false,
    durationMs: 12_000,
  },
  {
    id: 1,
    label: 'Geomechanics',
    headline: 'Caprock integrity\nanalysis — automated.',
    sub: 'Mohr-Coulomb failure analysis · Biot poroelastic coupling · Real-time safety factors',
    panel: 'geomechanics',
    sidebarOpen: true,
    durationMs: 8_000,
  },
  {
    id: 2,
    label: 'Results',
    headline: 'Storage capacity,\ntrapping breakdown,\nregulatory readiness.',
    sub: 'P10 / P50 / P90 capacity estimate · 5-jurisdiction permit export · ML-powered IFT prediction',
    panel: 'overview',
    sidebarOpen: true,
    durationMs: 8_000,
  },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function DemoModeOverlay() {
  const demoActive   = useUIStore((s) => s.demoActive)
  const setDemoActive = useUIStore((s) => s.setDemoActive)
  const setPanel     = useUIStore((s) => s.setPanel)
  const setSidebar   = useUIStore((s) => s.setSidebar)
  const setSpeed     = useSimulationStore((s) => s.setAnimationSpeed)
  const isAnimating  = useSimulationStore((s) => s.isAnimating)
  const status       = useSimulationStore((s) => s.status)
  const result       = useSimulationStore((s) => s.result)

  const [stageIdx, setStageIdx]   = useState(0)
  const [progress, setProgress]   = useState(0)   // 0–100 within current stage
  const [started, setStarted]     = useState(false)

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef      = useRef<number>(0)
  const stageStart  = useRef<number>(0)

  const { runAnimation } = useSimulation()

  // ── Cleanup on unmount / deactivate ─────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Advance to next stage ────────────────────────────────────────────────────
  const goToStage = useCallback((idx: number) => {
    const s = STAGES[idx % STAGES.length]
    setStageIdx(idx % STAGES.length)
    setProgress(0)
    stageStart.current = performance.now()
    setPanel(s.panel)
    setSidebar(s.sidebarOpen)

    timerRef.current = setTimeout(() => {
      goToStage(idx + 1)
    }, s.durationMs)
  }, [setPanel, setSidebar])

  // ── Progress bar animation (rAF) ─────────────────────────────────────────────
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
      cleanup()
      return
    }

    // Load preset
    const preset = FORMATION_PRESETS.find((p) => p.name === DEMO_PRESET_NAME)
    if (preset) {
      useFormationStore.getState().load(preset.params)
    }

    // Set a safe injection rate for the demo.
    // Malay Basin: area=120km², thickness=50m, φ=0.25, NTG=0.65 → P90≈34 Mt
    // 0.4 Mt/yr × 50 yr = 20 Mt, well within P90 — no caprock failure event.
    const demoWells = useFormationStore.getState().wells.map((w) => ({ ...w, injectionRate: 0.4 }))
    useFormationStore.getState().setWells(demoWells)

    // Reset sim + set speed
    useSimulationStore.getState().reset()
    setSpeed(DEMO_SPEED)

    // Small delay to let stores settle, then run
    const initTimer = setTimeout(() => {
      const params = useFormationStore.getState().params
      const wells  = useFormationStore.getState().wells
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

  // ── Exit ─────────────────────────────────────────────────────────────────────
  const exit = useCallback(() => {
    cleanup()
    setDemoActive(false)
    // Restore defaults
    setSidebar(true)
    setPanel('overview')
    setSpeed(1)
  }, [cleanup, setDemoActive, setSidebar, setPanel, setSpeed])

  if (!demoActive) return null

  const stage = STAGES[stageIdx]

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Full-screen semi-transparent gradient overlay (bottom portion only) ── */}
      {/* Leaves the 3D view visible — only darkens the bottom 40% for text legibility */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-40"
        style={{ height: '52%', background: 'linear-gradient(to top, rgba(3,8,20,0.92) 0%, rgba(3,8,20,0.6) 55%, transparent 100%)' }}
      />

      {/* ── DEMO MODE badge (top-left) ─────────────────────────────────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono font-semibold text-emerald-300 tracking-widest uppercase">Demo Mode — Exhibition Auto-Play</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      {/* ── Simulation live indicator (top-right) ─────────────────────────────── */}
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
            <span className="text-[9px] font-mono text-emerald-300">SIMULATION COMPLETE</span>
          </div>
        </div>
      )}

      {/* ── Main HUD (bottom overlay) ─────────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 z-50 px-6 pb-6 pt-2 pointer-events-none">
        {/* Stage progress dots */}
        <div className="flex items-center gap-2 mb-4">
          {STAGES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${
                i === stageIdx ? 'w-8 bg-emerald-400' : i < stageIdx ? 'w-4 bg-emerald-400/40' : 'w-4 bg-white/10'
              }`} />
              <span className={`text-[9px] font-mono transition-colors duration-300 ${
                i === stageIdx ? 'text-emerald-300' : 'text-white/30'
              }`}>{s.label}</span>
              {i < STAGES.length - 1 && <ChevronRight size={8} className="text-white/20" />}
            </div>
          ))}
        </div>

        {/* Headline text */}
        <div className="mb-3">
          {stage.headline.split('\n').map((line, i) => (
            <div
              key={i}
              className="font-bold text-white leading-tight"
              style={{ fontSize: i === 0 ? '2rem' : '1.7rem', lineHeight: 1.1 }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Sub-text */}
        <p className="text-sm text-white/60 font-mono mb-4 max-w-2xl">{stage.sub}</p>

        {/* Stats strip (only when result is available) */}
        {result && (
          <div className="flex items-center gap-6 mb-4">
            {[
              { label: 'P50 Capacity', value: `${result.p50.toFixed(0)} Mt CO₂` },
              { label: 'Containment', value: `${(result.containmentProbability * 100).toFixed(0)}%` },
              { label: 'Residual Trapped', value: `${result.residualTrapping.toFixed(2)} Mt` },
              { label: 'CO₂ Density', value: `${result.co2Density.toFixed(0)} kg/m³` },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-lg font-bold text-emerald-300 font-mono">{stat.value}</div>
                <div className="text-[9px] text-white/40 font-mono uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar + Exit button row */}
        <div className="flex items-center gap-4 pointer-events-auto">
          {/* Stage progress bar */}
          <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-none rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Exit button */}
          <button
            onClick={exit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 hover:text-white text-[10px] font-mono transition backdrop-blur-sm"
          >
            <X size={11} />
            Exit Demo
          </button>
        </div>

        {/* Attribution strip */}
        <p className="text-[9px] text-white/25 font-mono mt-3">
          CarbonLens · Physics: Span-Wagner (1996), Duan-Sun (2003), Theis (1935), Mohr-Coulomb ·
          ML: MARS IFT model, Universiti Teknologi PETRONAS, Malaysia ·
          Validated: Sleipner field data · SPE11A benchmark
        </p>
      </div>
    </>
  )
}
