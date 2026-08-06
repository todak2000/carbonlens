import { useState, useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useFormationStore } from '../../store/formationStore'
import { useAuthStore } from '../../store/authStore'
import { db } from '../../db/projectDb'
import {
  Lock, LayoutDashboard, Mountain, FlaskConical, Target, Play, Hammer,
  Radio, Crosshair, Shuffle, DollarSign, Globe, Database, Download,
  CheckCircle, AlertCircle, HelpCircle, X, LogOut,
  ChevronLeft, ChevronRight, Sun, Moon,
} from 'lucide-react'
import Logo from '../Logo'
import type { LucideIcon } from 'lucide-react'
import { assessStorageScreening } from '../../engine/classical/storageScreening'
import MethodologyPanel from '../MethodologyPanel/MethodologyPanel'
import ValidationDashboard from '../ValidationPanel/ValidationDashboard'

import type { Panel } from '../../store/uiStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type StageKey = 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5'

type NavItem = {
  panel: Panel
  label: string
  icon: LucideIcon
}

type StageGroup = {
  label: string
  stageKey: StageKey
  /** which stage must be complete for THIS stage to be unlocked */
  prerequisite: StageKey | null
  items: NavItem[]
}

// ── Stage-gate nav structure ───────────────────────────────────────────────────

const STAGE_GROUPS: StageGroup[] = [
  {
    label: 'Stage 1: Setup',
    stageKey: 'stage1',
    prerequisite: null,
    items: [
      { panel: 'overview', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Stage 2: Define',
    stageKey: 'stage2',
    prerequisite: 'stage1',
    items: [
      { panel: 'formation', label: 'Formation', icon: Mountain },
      { panel: 'geology',   label: 'Geology',   icon: FlaskConical },
      { panel: 'geomechanics', label: 'Geomechanics', icon: Hammer },
      { panel: 'screening', label: 'Screening', icon: Target },
    ],
  },
  {
    label: 'Stage 3: Simulate',
    stageKey: 'stage3',
    prerequisite: 'stage2',
    items: [
      { panel: 'simulation',   label: 'Simulation',   icon: Play },
    ],
  },
  {
    label: 'Stage 4: Analyse',
    stageKey: 'stage4',
    prerequisite: 'stage3',
    items: [
      { panel: 'monitoring',  label: 'Monitoring',   icon: Radio },
      { panel: 'leakage',     label: 'Leakage Risk', icon: Crosshair },
      { panel: 'montecarlo',  label: 'Monte Carlo',  icon: Shuffle },
    ],
  },
  {
    label: 'Stage 5: Report',
    stageKey: 'stage5',
    prerequisite: 'stage4',
    items: [
      { panel: 'economics',    label: 'Economics',   icon: DollarSign },
      { panel: 'jurisdiction', label: 'Jurisdiction', icon: Globe },
      { panel: 'registry',     label: 'Registry',    icon: Database },
      { panel: 'export',       label: 'Export',      icon: Download },
    ],
  },
]

// ── Benchmark Guide static content ────────────────────────────────────────────

const BENCHMARK_GUIDE_TEXT = `Sleipner Utsira Benchmark Setup

The Sleipner CO2 storage site (North Sea, Norway) is the standard benchmark
for CO2 plume simulation validation. The Utsira Sand formation has been
monitored by 4D seismic since 1994 and serves as a key reference dataset.

tNavigator Setup:
  - Import Utsira grid (ECLIPSE format, ~4.5 M cells)
  - CO2STORE keyword enabled, EOS PVT from Span-Wagner (1996)
  - Injection rate: 1 Mt/yr at well 15/9-A16
  - Observation: plume area at each seismic survey year (1994, 1999, 2001,
    2004, 2006, 2008, 2010)
  - Key output: CO2 saturation maps at top Utsira, compare vs 4D amplitude

OPM Flow Setup:
  - Use opm-tests/norne or sleipner_a dataset (BSG format)
  - Run: flow SLEIPNER.DATA --output-dir=results/
  - Compare summary vectors RGIP (gas in place) and WBHP (wellhead pressure)
  - Post-process with ResInsight for plume cross-section plots

MRST (MATLAB Reservoir Simulation Toolbox) Setup:
  - Use co2lab module: addpath(genpath(fullfile(MRST_DIR, 'co2lab')))
  - Load: G = readGRDECL('utsira.grdecl'); G = processGRDECL(G);
  - Run vertical-equilibrium (VE) model for fast plume-spread approximation
  - Calibrate against CarbonLens analytical output using matchSleipner script

Key comparison metrics:
  - Plume area (km2) at each survey year
  - Maximum CO2 column height (m) at apex
  - Dissolved fraction vs total injected at year 17 (2011)`

// ── Reference Drawer ──────────────────────────────────────────────────────────

type RefTab = 'methodology' | 'validation' | 'benchmark'

function ReferenceDrawer({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<RefTab>('methodology')

  const tabs: { key: RefTab; label: string }[] = [
    { key: 'methodology', label: 'Methodology' },
    { key: 'validation',  label: 'Validation'  },
    { key: 'benchmark',   label: 'Benchmark Guide' },
  ]

  return (
    <div className="fixed inset-y-0 right-0 w-[640px] max-w-full z-50 flex flex-col bg-page border-l border-theme shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition
                ${activeTab === t.key
                  ? 'bg-accent text-white'
                  : 'text-muted hover:bg-tertiary hover:text-secondary'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-tertiary text-muted"
          title="Close reference drawer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'methodology' && <MethodologyPanel />}
        {activeTab === 'validation'  && <ValidationDashboard />}
        {activeTab === 'benchmark' && (
          <div className="p-5">
            <h3 className="text-sm font-mono font-semibold text-secondary mb-3">
              tNavigator / OPM / MRST Benchmark Guide
            </h3>
            <pre className="text-[11px] font-mono text-muted whitespace-pre-wrap leading-relaxed">
              {BENCHMARK_GUIDE_TEXT}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Screening badge helper ─────────────────────────────────────────────────────

type ScreeningBadge = 'red' | 'amber' | 'green' | 'none'

function useScreeningBadge(stage2Complete: boolean, stage2Started: boolean): ScreeningBadge {
  const params = useFormationStore((s) => s.params)

  if (!stage2Started) return 'none'

  const result = assessStorageScreening(params)

  if (result.totalFailed > 0) return 'red'
  if (stage2Complete) return 'green'
  return 'amber'
}

// ── Monitoring badge helper ────────────────────────────────────────────────────

type MonitoringBadge = 'green' | 'amber' | 'red' | 'none'

function useMonitoringBadge(projectId: string | null): MonitoringBadge {
  const [badge, setBadge] = useState<MonitoringBadge>('none')

  useEffect(() => {
    if (!projectId) { setBadge('none'); return }

    let cancelled = false
    db.monitoringObservations
      .where('projectId')
      .equals(projectId)
      .toArray()
      .then((obs) => {
        if (cancelled) return
        if (obs.length === 0) { setBadge('none'); return }
        if (obs.some((o) => o.conformanceStatus === 'red')) { setBadge('red'); return }
        if (obs.some((o) => o.conformanceStatus === 'amber')) { setBadge('amber'); return }
        setBadge('green')
      })
      .catch(() => { if (!cancelled) setBadge('none') })

    return () => { cancelled = true }
  }, [projectId])

  return badge
}

// ── Stage group header indicator ──────────────────────────────────────────────

function StageHeaderIndicator({
  isLocked,
  isComplete,
  isCurrent,
}: {
  isLocked: boolean
  isComplete: boolean
  isCurrent: boolean
}) {
  if (isLocked) return <Lock size={11} className="text-muted/40 shrink-0" />
  if (isComplete) return <CheckCircle size={11} className="text-emerald-400 shrink-0" />
  if (isCurrent) return <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 inline-block" />
  return null
}

// ── Item badge overlay ─────────────────────────────────────────────────────────

function ScreeningItemBadge({ badge }: { badge: ScreeningBadge }) {
  if (badge === 'none') return null
  if (badge === 'green') return <CheckCircle size={10} className="text-emerald-400 shrink-0" />
  if (badge === 'red')   return <AlertCircle size={10} className="text-red-400 shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 inline-block" />
}

function MonitoringItemBadge({ badge }: { badge: MonitoringBadge }) {
  if (badge === 'none') return null
  if (badge === 'green') return <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 inline-block" />
  if (badge === 'red')   return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0 inline-block" />
  return <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 inline-block" />
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export default function Sidebar() {
  const activePanel      = useUIStore((s) => s.activePanel)
  const setPanel         = useUIStore((s) => s.setPanel)
  const setView          = useUIStore((s) => s.setView)
  const sidebarOpen      = useUIStore((s) => s.sidebarOpen)
  const setSidebar       = useUIStore((s) => s.setSidebar)
  const toggleTheme      = useUIStore((s) => s.toggleTheme)
  const theme            = useUIStore((s) => s.theme)
  const stageCompletion  = useUIStore((s) => s.stageCompletion)
  const currentProjectId = useUIStore((s) => s.currentProjectId)
  const logout           = useAuthStore((s) => s.logout)

  const [refDrawerOpen, setRefDrawerOpen] = useState(false)
  const [expertMode, setExpertMode] = useState<boolean>(
    () => localStorage.getItem('cl_expert_mode') === '1'
  )

  // On small screens the sidebar is an off-canvas drawer: collapsed by default
  // below `lg`, expanded on desktop. Only reacts on breakpoint crossing so
  // continuous resizing stays stable.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = (e: MediaQueryListEvent) => setSidebar(e.matches)
    setSidebar(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [setSidebar])

  // Sync expert mode from localStorage on mount and when toggled
  const toggleExpertMode = () => {
    const next = !expertMode
    localStorage.setItem('cl_expert_mode', next ? '1' : '0')
    setExpertMode(next)
  }

  // Determine stage unlock state
  const stageUnlocked = (stageKey: StageKey, prerequisite: StageKey | null): boolean => {
    if (expertMode) return true
    if (prerequisite === null) return true              // Stage 1 always unlocked
    return stageCompletion[prerequisite] === true
  }

  // Stage started heuristic: stage2 "started" means any formation panel was visited
  const stage2Started = stageCompletion.stage1

  const screeningBadge   = useScreeningBadge(stageCompletion.stage2, stage2Started)
  const monitoringBadge  = useMonitoringBadge(currentProjectId)

  const w = sidebarOpen ? 'w-48' : 'w-12'

  return (
    <>
      <nav className={`${w} border-r border-theme flex flex-col items-center py-3 shrink-0 bg-page transition-all duration-200
        lg:relative lg:static lg:z-auto lg:shadow-none
        ${sidebarOpen ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'hidden lg:flex'}`}>
        {/* Logo */}
        <div
          className="mb-2 cursor-pointer hover:opacity-80 transition-opacity relative"
          onClick={() => useUIStore.getState().setView('landing')}
          title="Go to landing page"
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <Logo width={120} />
              {expertMode && (
                <span className="text-[8px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1 py-0.5 rounded">
                  EXPERT
                </span>
              )}
            </div>
          ) : (
            <div className="relative">
              <Logo iconOnly />
              {expertMode && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border border-page" />
              )}
            </div>
          )}
        </div>

        {/* Collapse toggle (floating border button) */}
        <button
          onClick={() => setSidebar(!sidebarOpen)}
          className="absolute top-4 -right-3 w-6 h-6 flex items-center justify-center rounded-full border border-theme bg-card hover:bg-tertiary text-muted hover:text-secondary shadow-md z-50 cursor-pointer"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
        </button>

        {/* Nav groups */}
        <div className="flex flex-col w-full px-1 mt-1 gap-2 overflow-y-auto flex-1 min-h-0">
          {STAGE_GROUPS.map((group) => {
            const unlocked = stageUnlocked(group.stageKey, group.prerequisite)
            const isComplete = stageCompletion[group.stageKey]
            const isCurrent = !isComplete && unlocked

            const isStage4 = group.stageKey === 'stage4'

            return (
              <div key={group.stageKey} className={isStage4 ? 'hidden lg:block' : ''}>
                {/* Group header */}
                {sidebarOpen ? (
                  <div className="px-2 mb-0.5 flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold font-mono uppercase tracking-wider select-none
                      ${unlocked ? 'text-secondary' : 'text-muted/40'}`}
                    >
                      {group.stageKey === 'stage5' ? (
                        <>
                          <span className="lg:hidden">Stage 4: Report</span>
                          <span className="hidden lg:inline">{group.label}</span>
                        </>
                      ) : (
                        group.label
                      )}
                    </span>
                    <StageHeaderIndicator
                      isLocked={!unlocked}
                      isComplete={isComplete}
                      isCurrent={isCurrent}
                    />
                  </div>
                ) : (
                  <div className="border-t border-theme/30 mx-1 mb-1 pt-0.5" />
                )}

                {/* Items */}
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = activePanel === item.panel
                    const isLocked = !unlocked
                    const hideOnMobile = item.panel === 'jurisdiction' || item.panel === 'registry'

                    const handleClick = () => {
                      setPanel(item.panel)
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setSidebar(false)
                      }
                    }

                    return (
                      <button
                        key={item.panel}
                        onClick={handleClick}
                        className={`w-full items-center py-1.5 rounded-md transition text-xs font-mono
                          ${hideOnMobile ? 'hidden lg:flex' : 'flex'}
                          ${sidebarOpen ? 'gap-2 px-2' : 'justify-center px-0'}
                          ${isActive
                            ? 'bg-accent text-white'
                            : isLocked
                              ? 'text-muted/50 hover:bg-tertiary hover:text-secondary'
                              : 'text-muted hover:bg-tertiary hover:text-secondary'
                          }`}
                        title={isLocked ? `${item.label} (Read-Only Mode)` : item.label}
                      >
                        {isLocked
                          ? <Lock size={13} className="shrink-0 text-amber-500/80" />
                          : <Icon size={13} className="shrink-0" />
                        }

                        {sidebarOpen && (
                          <span className="truncate flex-1 text-left">{item.label}</span>
                        )}

                        {/* Screening badge */}
                        {sidebarOpen && item.panel === 'screening' && (
                          <ScreeningItemBadge badge={screeningBadge} />
                        )}

                        {/* Monitoring badge */}
                        {sidebarOpen && item.panel === 'monitoring' && (
                          <MonitoringItemBadge badge={monitoringBadge} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom controls */}
        <div className={`mt-auto pt-4 border-t border-theme/20 flex shrink-0 ${sidebarOpen ? 'flex-row justify-around w-full px-2 py-1' : 'flex-col items-center gap-2 pb-2'}`}>
          {/* Reference drawer trigger */}
          <button
            onClick={() => setRefDrawerOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-tertiary text-muted"
            title="Open reference drawer (Methodology, Validation, Benchmark Guide)"
          >
            <HelpCircle size={15} />
          </button>

          {/* Expert mode toggle */}
          <button
            onClick={toggleExpertMode}
            className={`w-8 h-8 flex items-center justify-center rounded text-xs font-mono font-bold transition
              ${expertMode
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'text-muted/40 hover:bg-tertiary hover:text-muted'
              }`}
            title={expertMode ? 'Expert mode ON (click to disable locking)' : 'Expert mode OFF (click to bypass stage locks)'}
          >
            {sidebarOpen ? (expertMode ? 'EXP' : 'exp') : 'E'}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-tertiary text-muted"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* User Guide link */}
          <a
            href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/user-guide.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-tertiary text-muted"
            title="Open User Guide"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </a>

          {/* Sign Out */}
          <button
            onClick={() => { logout(); setView('landing') }}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/20 text-red-400 hover:text-red-300"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </nav>

      {/* Mobile / tablet: drawer scrim */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebar(false)}
        />
      )}

      {/* Reference drawer overlay */}
      {refDrawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setRefDrawerOpen(false)}
          />
          <ReferenceDrawer onClose={() => setRefDrawerOpen(false)} />
        </>
      )}
    </>
  )
}
