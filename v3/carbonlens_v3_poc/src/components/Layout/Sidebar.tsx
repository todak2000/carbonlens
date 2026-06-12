import { useUIStore } from '../../store/uiStore'
import {
  BarChart3, Mountain, Play, Hammer, Globe, Download, DollarSign, Crosshair, Target,
  PanelLeftOpen, PanelLeftClose, Sun, Moon, LayoutDashboard, Database, FlaskConical, BookOpen,
  ShieldCheck, Shuffle, Activity,
} from 'lucide-react'
import Logo from '../Logo'
import type { LucideIcon } from 'lucide-react'

type Panel = 'properties' | 'formation' | 'geology' | 'simulation' | 'geomechanics' | 'economics' | 'leakage' | 'screening' | 'jurisdiction' | 'export' | 'overview' | 'registry' | 'methodology' | 'validation' | 'montecarlo' | 'historymatching'

type NavGroup = {
  label: string
  items: { panel: Panel; label: string; icon: LucideIcon }[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Input',
    items: [
      { panel: 'overview' as const,    label: 'Overview',    icon: LayoutDashboard },
      { panel: 'formation' as const,   label: 'Formation',   icon: Mountain },
      { panel: 'geology' as const,     label: 'Geology',     icon: FlaskConical },
      { panel: 'properties' as const,  label: 'Properties',  icon: BarChart3 },
      { panel: 'screening' as const,   label: 'Screening',   icon: Target },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { panel: 'simulation' as const,      label: 'Simulation',    icon: Play },
      { panel: 'geomechanics' as const,    label: 'Geomechanics',  icon: Hammer },
      { panel: 'leakage' as const,         label: 'Leakage',       icon: Crosshair },
      { panel: 'montecarlo' as const,      label: 'Monte Carlo',   icon: Shuffle },
    ],
  },
  {
    label: 'Outputs',
    items: [
      { panel: 'economics' as const,   label: 'Economics',  icon: DollarSign },
      { panel: 'registry' as const,    label: 'Registry',   icon: Database },
      { panel: 'jurisdiction' as const, label: 'Jurisdiction', icon: Globe },
      { panel: 'export' as const,      label: 'Export',     icon: Download },
    ],
  },
  {
    label: 'Tools',
    items: [
      { panel: 'historymatching' as const, label: 'Hist. Match',  icon: Activity },
      { panel: 'validation' as const,      label: 'Validation',   icon: ShieldCheck },
      { panel: 'methodology' as const,     label: 'Methodology',  icon: BookOpen },
    ],
  },
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
      <div 
        className="mb-4 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => useUIStore.getState().setView('landing')}
        title="Go to landing page"
      >
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

      <div className="flex flex-col w-full px-1.5 mt-2 gap-3 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            {sidebarOpen && (
              <div className="px-2.5 mb-1 text-[7px] font-mono uppercase tracking-widest text-muted/50 select-none">
                {group.label}
              </div>
            )}
            {!sidebarOpen && <div className="border-t border-theme/30 mx-1.5 mb-1" />}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
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
          </div>
        ))}
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
