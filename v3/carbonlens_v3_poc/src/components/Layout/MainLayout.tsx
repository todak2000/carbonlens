import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { LogOut, Download, User, ArrowLeft, MonitorPlay } from 'lucide-react'
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
import { HistoryMatchingPanel } from '../HistoryMatching'
import ErrorBoundary from '../ErrorBoundary'

export default function MainLayout() {
  const activePanel = useUIStore((s) => s.activePanel)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const show3D = useUIStore((s) => s.show3D)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const theme = useUIStore((s) => s.theme)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setView = useUIStore((s) => s.setView)
  const demoActive = useUIStore((s) => s.demoActive)
  const setDemoActive = useUIStore((s) => s.setDemoActive)

  const displayName = user?.displayName || 'Engineer'
  const initials = displayName.slice(0, 2).toUpperCase()

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
        case 'historymatching': return <HistoryMatchingPanel />
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
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setView('dashboard')}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-mono bg-tertiary text-secondary hover:text-primary transition"
            >
              <ArrowLeft size={12} />
              Projects
            </button>
            <button
              onClick={() => setDemoActive(!demoActive)}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-mono transition ${
                demoActive
                  ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                  : 'bg-tertiary text-secondary hover:text-primary border border-emerald-500/30 hover:border-emerald-500/60'
              }`}
              title="Toggle exhibition demo mode"
            >
              <MonitorPlay size={12} />
              {demoActive ? 'Exit Demo' : 'Demo'}
            </button>
            <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 font-mono uppercase tracking-wider hidden sm:block">
              {user?.tier || 'Pro'}
            </span>
            <button onClick={() => useUIStore.getState().setPanel('export')}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-mono bg-tertiary text-secondary hover:text-primary transition"
            >
              <Download size={12} />
              Export
            </button>
            <button onClick={() => { logout(); setView('landing') }}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-mono text-muted hover:text-secondary hover:bg-tertiary transition"
            >
              <LogOut size={12} />
              Sign Out
            </button>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">
          {sidebarOpen && (
            <aside className="w-80 border-r border-theme overflow-y-auto shrink-0 bg-card">
              {renderPanel()}
            </aside>
          )}
          <main className="flex-1 relative bg-page overflow-hidden">
            {show3D ? <ErrorBoundary label="3D Viewer"><ReservoirViewer /></ErrorBoundary> : (
              <div className="flex items-center justify-center h-full text-muted font-mono text-xs">
                <p>3D view disabled</p>
              </div>
            )}
            {/* Demo mode overlay — rendered inside <main> so it's positioned over the 3D view */}
            <DemoModeOverlay />
          </main>
        </div>
      </div>
    </div>
  )
}
