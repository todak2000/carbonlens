import { useUIStore } from '../../store/uiStore'
import {
  BarChart3, Mountain, Play, Hammer, Globe, Download, DollarSign, Crosshair, Target,
  PanelLeftOpen, PanelLeftClose, Sun, Moon, LayoutDashboard, Database,
} from 'lucide-react'
import Logo from '../Logo'

const navItems = [
  { panel: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { panel: 'properties' as const, label: 'Properties', icon: BarChart3 },
  { panel: 'formation' as const, label: 'Formation', icon: Mountain },
  { panel: 'geomechanics' as const, label: 'Geomechanics', icon: Hammer },
  { panel: 'simulation' as const, label: 'Simulation', icon: Play },
  { panel: 'economics' as const, label: 'Economics', icon: DollarSign },
  { panel: 'leakage' as const, label: 'Leakage', icon: Crosshair },
  { panel: 'screening' as const, label: 'Screening', icon: Target },
  { panel: 'registry' as const, label: 'Registry', icon: Database },
  { panel: 'jurisdiction' as const, label: 'Jurisdiction', icon: Globe },
  { panel: 'export' as const, label: 'Export', icon: Download },
]

export default function Sidebar() {
  const activePanel = useUIStore((s) => s.activePanel)
  const setPanel = useUIStore((s) => s.setPanel)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebar = useUIStore((s) => s.setSidebar)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const theme = useUIStore((s) => s.theme)

  const w = sidebarOpen ? 'w-44' : 'w-12'

  return (
    <nav className={`${w} border-r border-theme flex flex-col items-center py-3 shrink-0 bg-page transition-all duration-200`}>
      <div className="mb-4">
        {sidebarOpen ? (
          <Logo width={130} />
        ) : (
          <Logo iconOnly />
        )}
      </div>

      <button onClick={() => setSidebar(!sidebarOpen)}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-tertiary text-muted mb-1"
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
      </button>

      <div className="flex flex-col gap-0.5 w-full px-1.5 mt-2">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.panel} onClick={() => setPanel(item.panel)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition text-xs font-mono
                ${activePanel === item.panel
                  ? 'bg-accent text-white'
                  : 'text-muted hover:bg-tertiary hover:text-secondary'
                }`}
              title={item.label}
            >
              <Icon size={15} className="shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </div>

      <div className="mt-auto">
        <button onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-tertiary text-muted"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </nav>
  )
}
