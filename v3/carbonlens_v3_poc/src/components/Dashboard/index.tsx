import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { createDefaultProject } from '../../data/defaultProject'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import { db, migrateFromLocalStorage, StoredProject } from '../../db/projectDb'
import { Lock, LogOut, PlusCircle, ChevronDown, Sun, Moon } from 'lucide-react'
import Logo from '../Logo'
import ProjectCard from './ProjectCard'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const loadFormation = useFormationStore((s) => s.load)
  const setPanel = useUIStore((s) => s.setPanel)
  const setView = useUIStore((s) => s.setView)
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const [projects, setProjects] = useState<StoredProject[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  const loadProjects = useCallback(async () => {
    const list = await db.projects.orderBy('updatedAt').reverse().toArray()
    setProjects(list)
  }, [])

  useEffect(() => {
    migrateFromLocalStorage().then(() => loadProjects())
  }, [loadProjects])

  const createProject = async (preset?: typeof FORMATION_PRESETS[0]) => {
    const base = createDefaultProject()
    base.name = newName || (preset?.name ?? 'New Project')
    if (preset) { base.formation = { ...preset.params }; base.name = preset.name }
    base.id = crypto.randomUUID()
    const project: StoredProject = {
      ...base,
      snapshots: [],
      thumbnail: null,
    }
    await db.projects.put(project)
    await loadProjects()
    loadFormation(project.formation)
    setShowNew(false); setNewName(''); setShowPresets(false)
    useUIStore.getState().setCurrentProjectId(project.id)
    useUIStore.getState().setView('workspace')
    setPanel('overview')
  }

  const openProject = (project: StoredProject) => {
    loadFormation(project.formation)
    if (project.wells?.length) {
      useFormationStore.getState().load(project.formation, project.wells)
    }
    if (project.simulationResult) {
      useSimulationStore.getState().setResult(project.simulationResult)
    }
    if (project.geomechanicsResult) {
      useSimulationStore.getState().setGeomechanics(project.geomechanicsResult)
    }
    useUIStore.getState().setCurrentProjectId(project.id)
    useUIStore.getState().setView('workspace')
    setPanel('overview')
  }

  const deleteProject = async (id: string) => {
    await db.projects.delete(id)
    await loadProjects()
  }

  return (
    <div className="min-h-screen bg-page text-primary">
      <header className="border-b border-theme px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <Logo width={140} />
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <button onClick={toggleTheme} className="flex items-center gap-1 text-xs text-muted hover:text-secondary font-mono" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <span className="hidden sm:inline text-xs text-muted font-mono">{user?.email}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-accent text-white font-mono uppercase tracking-wider">
            <Lock size={10} />
            {user?.tier}
          </span>
          <button onClick={() => { logout(); setView('landing') }} className="flex items-center gap-1 text-xs text-muted hover:text-secondary font-mono">
            <LogOut size={12} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base md:text-lg font-semibold text-primary font-mono uppercase tracking-wider">Projects</h2>
          <button onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2.5 md:py-2 rounded bg-accent hover:bg-accent-hover text-white text-xs font-medium transition font-mono min-h-[44px]"
          >
            <PlusCircle size={14} />
            New Project
          </button>
        </div>
        {showNew && (
          <div className="mb-6 p-3 md:p-4 rounded bg-card border border-theme space-y-3">
            <input type="text" placeholder="Project name" autoFocus className="input-field" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createProject()} />
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => createProject()} className="btn-primary min-h-[44px]" disabled={!newName}>Create Blank</button>
              <button onClick={() => setShowPresets(!showPresets)} className="flex items-center justify-center gap-1 px-4 py-2.5 min-h-[44px] rounded bg-tertiary text-secondary hover:text-primary text-xs font-mono">
                From Preset <ChevronDown size={12} />
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2.5 min-h-[44px] rounded bg-tertiary text-secondary hover:text-primary text-xs font-mono">Cancel</button>
            </div>
            {showPresets && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-h-60 overflow-y-auto">
                {FORMATION_PRESETS.map((p) => (
                    <button key={p.name} onClick={() => createProject(p)} className="text-left p-3 rounded bg-tertiary hover:bg-card border border-theme text-xs min-h-[44px]">
                    <div className="font-medium text-primary font-mono">{p.name}</div>
                    <div className="text-[10px] text-muted">{p.location}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {projects.length === 0 ? (
          <div className="text-center py-12 md:py-16 text-muted">
            <FolderOpen size={36} className="mx-auto mb-3 text-muted" />
            <p className="text-xs sm:text-sm font-mono">No projects yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {projects.map((p) => <ProjectCard key={p.id} project={p} onOpen={() => openProject(p)} onDelete={() => deleteProject(p.id)} />)}
          </div>
        )}
      </main>
    </div>
  )
}

function FolderOpen({ size, className }: { size: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
