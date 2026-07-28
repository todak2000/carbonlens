import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useFormationStore } from '../../store/formationStore'
import { User, ArrowLeft, MonitorPlay, Pencil, Check, X } from 'lucide-react'
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

  return (
    <div className="h-screen flex overflow-hidden bg-page text-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-theme flex items-center justify-between px-5 shrink-0 bg-page">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
              <User size={16} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary leading-tight">Welcome back, {displayName}</p>
              <p className="text-[10px] text-muted font-mono">{user?.email || 'engineer@carbonlens.io'}</p>
            </div>
            {currentProjectName && (
              <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-theme">
                <span className="text-[9px] text-muted font-mono uppercase tracking-wider">Project</span>
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
                  <div className="flex items-center gap-1 group">
                    <span className="text-xs font-semibold text-primary font-mono truncate max-w-[160px]">{currentProjectName}</span>
                    {(projectCountry || formationCountry) && <span className="text-[9px] text-muted font-mono">| {projectCountry || formationCountry}</span>}
                    <button onClick={() => setEditingName(true)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-primary transition-opacity"><Pencil size={11} /></button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stage progress indicator */}
          {currentProjectId && (
            <div className="hidden md:flex items-center gap-1.5">
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

          <div className="flex items-center gap-2">
            <button onClick={() => setView('dashboard')}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-mono bg-tertiary text-secondary hover:text-primary transition"
            >
              <ArrowLeft size={12} />
              Projects
            </button>
            {isOwner && (
              <button
                onClick={() => setDemoActive(!demoActive)}
                className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-mono transition ${
                  demoActive
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                    : 'bg-tertiary text-secondary hover:text-primary border border-emerald-500/30 hover:border-emerald-500/60'
                }`}
                title="Re-run live exhibition demo (owner only)"
              >
                <MonitorPlay size={12} />
                {demoActive ? 'Exit Demo' : 'Re-run Demo'}
              </button>
            )}
            <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 font-mono uppercase tracking-wider hidden sm:block">
              {user?.tier || 'Pro'}
            </span>

          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">
          {(activePanel === 'simulation' || activePanel === 'geology') && sidebarOpen && (
            <aside className={`border-r border-theme overflow-y-auto shrink-0 bg-card transition-all duration-300 ${
              activePanel === 'geology'
                ? (geologyExpanded ? 'w-[55%] min-w-[500px]' : 'w-96')
                : 'w-96'
            }`}>
              {renderPanel()}
            </aside>
          )}
          <main className="flex-1 relative bg-page overflow-hidden">
            {(activePanel !== 'simulation' && activePanel !== 'geology') ? (
              <div className="w-full h-full overflow-y-auto bg-page py-6 px-6">
                <div className="max-w-7xl mx-auto w-full">
                  {renderPanel()}
                </div>
              </div>
            ) : (
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
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
