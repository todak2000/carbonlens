import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useFormationStore } from '../../store/formationStore'
import { User, ArrowLeft, MonitorPlay, Pencil, Check, X, Menu, SlidersHorizontal } from 'lucide-react'
import Sidebar from './Sidebar'
import DemoModeOverlay from '../DemoMode/DemoModeOverlay'
import ReservoirViewer from '../ThreeViewer/ReservoirViewer'
import PropertyPanel from '../FluidProperties/PropertyPanel'
import FormationPanel from '../FormationInputs/FormationPanel'
import SimulationPanel from '../SimulationPanel/SimulationPanel'
import GeomechanicsPanel from '../GeomechanicsPanel/GeomechanicsPanel'
import EconomicsPanel from '../EconomicsPanel/EconomicsPanel'
import LeakagePanel from '../LeakagePanel/LeakagePanel'
import ScreeningPanel from '../ScreeningPanel/ScreeningPanel'
import JurisdictionPanel from '../JurisdictionToggle/JurisdictionPanel'
import ExportPanel from '../PermitExport/ExportPanel'
import OverviewPanel from '../OverviewPanel/OverviewPanel'
import RegistryPanel from '../RegistryPanel/RegistryPanel'
import GeologyPanel from '../GeologyPanel/GeologyPanel'
import MethodologyPanel from '../MethodologyPanel/MethodologyPanel'
import ValidationDashboard from '../ValidationPanel/ValidationDashboard'
import MonteCarloPanel from '../MonteCarloPanel/MonteCarloPanel'
import MonitoringPanel from '../MonitoringPanel/MonitoringPanel'
import ErrorBoundary from '../ErrorBoundary'
import { db } from '../../db/projectDb'

const STAGE_LABELS = ['Setup', 'Define', 'Simulate', 'Analyse', 'Report']

export default function MainLayout() {
  const activePanel = useUIStore((s) => s.activePanel)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebar = useUIStore((s) => s.setSidebar)
  const show3D = useUIStore((s) => s.show3D)
  const user = useAuthStore((s) => s.user)
  const setView = useUIStore((s) => s.setView)
  const demoActive = useUIStore((s) => s.demoActive)
  const setDemoActive = useUIStore((s) => s.setDemoActive)
  const currentProjectName = useUIStore((s) => s.currentProjectName)
  const currentProjectId = useUIStore((s) => s.currentProjectId)
  const stageCompletion = useUIStore((s) => s.stageCompletion)
  const setStageComplete = useUIStore((s) => s.setStageComplete)
  const geologyExpanded = useUIStore((s) => s.geologyExpanded)
  const formationCountry = useFormationStore((s) => s.formationCountry)

  // Project metadata from DB (country, presetId)
  const [projectCountry, setProjectCountry] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  // On mobile (< 1024px), Geology renders directly as standard main page content.
  // Only Simulation uses the 3D canvas split on mobile devices.
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 1024
  const isPanelAside = activePanel === 'simulation' || (activePanel === 'geology' && !isMobileViewport)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Auto-open sheet when navigating to Simulation on mobile so controls are visible by default
  useEffect(() => {
    if (isPanelAside && isMobileViewport) {
      setSheetOpen(true)
    }
  }, [activePanel, isPanelAside, isMobileViewport])

  useEffect(() => {
    if (!currentProjectId) return
    db.projects.get(currentProjectId).then((p) => {
      if (p) setProjectCountry(p.country ?? '')
    })
  }, [currentProjectId])

  // Sync nameInput when project changes
  useEffect(() => {
    setNameInput(currentProjectName ?? '')
  }, [currentProjectName])

  const saveProjectName = useCallback(async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || !currentProjectId) { setEditingName(false); return }
    await db.projects.update(currentProjectId, { name: trimmed, updatedAt: Date.now() })
    useUIStore.getState().setCurrentProjectName(trimmed)
    if (trimmed && projectCountry) setStageComplete('stage1', true)
    setEditingName(false)
  }, [nameInput, currentProjectId, projectCountry, setStageComplete])

  const currentStageIndex = (() => {
    if (!stageCompletion.stage4) {
      if (!stageCompletion.stage3) {
        if (!stageCompletion.stage2) {
          return stageCompletion.stage1 ? 1 : 0
        }
        return 2
      }
      return 3
    }
    return 4
  })()

  const isOwner = user?.email === 'todak2000@gmail.com'
  const displayName = user?.displayName || 'Engineer'

  const renderPanel = () => {
    const panel = (() => {
      switch (activePanel) {
        case 'overview': return <OverviewPanel />
        case 'properties': return <PropertyPanel />
        case 'formation': return <FormationPanel />
        case 'geology': return <GeologyPanel />
        case 'simulation': return <SimulationPanel />
        case 'geomechanics': return <GeomechanicsPanel />
        case 'economics': return <EconomicsPanel />
        case 'leakage': return <LeakagePanel />
        case 'screening': return <ScreeningPanel />
        case 'jurisdiction': return <JurisdictionPanel />
        case 'export': return <ExportPanel />
        case 'registry': return <RegistryPanel />
        case 'methodology': return <MethodologyPanel />
        case 'validation': return <ValidationDashboard />
        case 'montecarlo': return <MonteCarloPanel />
        case 'monitoring': return <MonitoringPanel />
        default: return <PropertyPanel />
      }
    })()
    return <ErrorBoundary label={activePanel}>{panel}</ErrorBoundary>
  }

  const asidePanelNode = isPanelAside ? renderPanel() : null
  const showDesktopAside = isPanelAside && sidebarOpen

  return (
    <div className="h-dvh flex overflow-hidden bg-page text-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="min-h-14 border-b border-theme flex items-center justify-between gap-2 px-3 md:px-5 py-2 shrink-0 bg-page">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Mobile / tablet: open nav drawer */}
            <button
              onClick={() => setSidebar(true)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md hover:bg-tertiary text-secondary shrink-0"
              title="Open navigation"
            >
              <Menu size={18} />
            </button>
            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
              <User size={16} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary leading-tight truncate">Welcome back, {displayName}</p>
              <p className="text-[10px] text-muted font-mono truncate max-w-[45vw] sm:max-w-none">{user?.email || 'engineer@carbonlens.io'}</p>
            </div>
            {currentProjectName && (
              <div className="hidden md:flex items-center gap-2 ml-2 pl-3 border-l border-theme min-w-0">
                <span className="text-[9px] text-muted font-mono uppercase tracking-wider shrink-0">Project</span>
                {editingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      className="text-xs font-semibold text-primary font-mono bg-card border border-accent rounded px-2 py-0.5 w-40"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveProjectName(); if (e.key === 'Escape') setEditingName(false) }}
                    />
                    <button onClick={saveProjectName} className="text-emerald-400 hover:text-emerald-300"><Check size={12} /></button>
                    <button onClick={() => setEditingName(false)} className="text-muted hover:text-primary"><X size={12} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group min-w-0">
                    <span className="text-xs font-semibold text-primary font-mono truncate max-w-[160px]">{currentProjectName}</span>
                    {(projectCountry || formationCountry) && <span className="text-[9px] text-muted font-mono hidden xl:inline">| {projectCountry || formationCountry}</span>}
                    <button onClick={() => setEditingName(true)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-primary transition-opacity shrink-0"><Pencil size={11} /></button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stage progress indicator */}
          {currentProjectId && (
            <div className="hidden xl:flex items-center gap-1.5 shrink-0">
              {STAGE_LABELS.map((label, i) => {
                const done = i < currentStageIndex
                const active = i === currentStageIndex
                return (
                  <div key={label} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full transition-colors ${done ? 'bg-emerald-400' : active ? 'bg-amber-400' : 'bg-white/15'}`} />
                    <span className={`text-[9px] font-mono ${done ? 'text-emerald-400' : active ? 'text-amber-400' : 'text-muted'}`}>{label}</span>
                    {i < 4 && <div className={`w-4 h-px ${done ? 'bg-emerald-400/50' : 'bg-white/10'}`} />}
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-2 justify-end shrink-0">
            <button onClick={() => setView('dashboard')}
              className="flex items-center gap-1 text-[11px] px-2.5 md:px-3 py-1.5 rounded-md font-mono bg-tertiary text-secondary hover:text-primary transition"
            >
              <ArrowLeft size={12} />
              <span className="hidden sm:inline">Projects</span>
              <span className="sm:hidden">Back</span>
            </button>
            {isOwner && (
              <button
                onClick={() => setDemoActive(!demoActive)}
                className={`hidden sm:flex items-center gap-1.5 text-[11px] px-2.5 md:px-3 py-1.5 rounded-md font-mono transition ${
                  demoActive
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                    : 'bg-tertiary text-secondary hover:text-primary border border-emerald-500/30 hover:border-emerald-500/60'
                }`}
                title="Re-run live demo (owner only)"
              >
                <MonitorPlay size={12} />
                <span>{demoActive ? 'Exit Demo' : 'Re-run Demo'}</span>
              </button>
            )}
            <span className="hidden sm:block px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 font-mono uppercase tracking-wider">
              {user?.tier || 'Pro'}
            </span>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Desktop / tablet: in-flow control aside for simulation & geology */}
          {asidePanelNode && (
            <aside
              className={`hidden lg:flex flex-col border-r border-theme overflow-y-auto shrink-0 bg-card transition-all duration-300 ${
                showDesktopAside
                  ? activePanel === 'geology'
                    ? (geologyExpanded ? 'w-[55%] min-w-[500px]' : 'w-96')
                    : 'w-96'
                  : 'hidden'
              }`}
            >
              {asidePanelNode}
            </aside>
          )}

          <main className="flex-1 relative bg-page overflow-hidden min-w-0">
            {!isPanelAside ? (
              <div className="w-full h-full overflow-y-auto bg-page py-3 md:py-5 px-3 md:px-5">
                <div className="max-w-7xl mx-auto w-full">
                  {renderPanel()}
                </div>
              </div>
            ) : (
              <>
                <div className="w-full h-full relative overflow-hidden">
                  {show3D ? (
                    <ErrorBoundary label="3D Viewer">
                      <ReservoirViewer />
                    </ErrorBoundary>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
                      <p>3D view disabled</p>
                    </div>
                  )}
                  {/* Demo mode overlay — rendered inside <main> so it's positioned over the 3D view */}
                  <DemoModeOverlay />
                </div>

                {/* Mobile / tablet: floating toggle for the controls sheet */}
                <button
                  onClick={() => setSheetOpen(true)}
                  className="lg:hidden absolute bottom-4 right-4 z-30 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-[11px] font-mono shadow-lg"
                  title="Show controls"
                >
                  <SlidersHorizontal size={13} />
                  Controls
                </button>

                {/* Mobile / tablet: controls bottom sheet */}
                {sheetOpen && (
                  <div
                    className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t border-theme shadow-2xl bg-card max-h-[65vh]"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-theme shrink-0">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-secondary">
                        {activePanel === 'simulation' ? 'Simulation Controls' : 'Geology Controls'}
                      </span>
                      <button
                        onClick={() => setSheetOpen(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-tertiary text-muted"
                        title="Hide controls"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto pb-safe">{asidePanelNode}</div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
