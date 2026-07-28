import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { createDefaultProject } from '../../data/defaultProject'
import { FORMATION_PRESETS } from '../../data/formationPresets'
import { db, migrateFromLocalStorage, StoredProject } from '../../db/projectDb'
import { Lock, PlusCircle, Sun, Moon, X, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import Logo from '../Logo'
import ProjectCard from './ProjectCard'
import type { GeometryType } from '../../types'

// ── Countries with established / characterised saline aquifers ────────────────

const SALINE_AQUIFER_COUNTRIES = [
  // Europe
  'Algeria',    'Austria',        'Belgium',        'Croatia',
  'Czech Republic', 'Denmark',    'France',         'Germany',
  'Greece',     'Hungary',        'Ireland',        'Italy',
  'Netherlands','Norway',         'Poland',         'Portugal',
  'Romania',    'Spain',          'Sweden',         'Ukraine',
  'United Kingdom',
  // Americas
  'Argentina',  'Brazil',         'Canada',         'Chile',
  'Colombia',   'Mexico',         'Peru',           'United States',
  // Middle East & Africa
  'Angola',     'Egypt',          'Kenya',          'Libya',
  'Morocco',    'Nigeria',        'Saudi Arabia',   'South Africa',
  'Tanzania',   'Tunisia',        'United Arab Emirates',
  // Asia-Pacific
  'Australia',  'China',          'India',          'Indonesia',
  'Japan',      'Malaysia',       'Myanmar',        'New Zealand',
  'Philippines','South Korea',    'Thailand',       'Vietnam',
].sort()

// ── Geometry options (excludes gridfile — file-upload only) ───────────────────

const GEOMETRY_OPTIONS = [
  {
    id: 'anticline',
    label: 'Anticlinal Trap',
    desc: 'Arched rock layers that trap buoyant CO₂ at the crest',
    icon: (
      <svg viewBox="0 0 40 28" width="40" height="28" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 22 Q20 4 38 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M2 26 Q20 8 38 26" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
      </svg>
    ),
  },
  {
    id: 'dome',
    label: 'Dome Structure',
    desc: 'Circular salt or volcanic dome trapping CO₂ beneath impermeable cap',
    icon: (
      <svg viewBox="0 0 40 28" width="40" height="28" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="20" cy="20" rx="17" ry="10" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M3 20 Q20 4 37 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'fault',
    label: 'Fault Trap',
    desc: 'Offset strata sealed against impermeable fault plane',
    icon: (
      <svg viewBox="0 0 40 28" width="40" height="28" xmlns="http://www.w3.org/2000/svg">
        <line x1="20" y1="2" x2="20" y2="26" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
        <rect x="4"  y="8" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="22" y="6" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    id: 'layered',
    label: 'Layered Sequence',
    desc: 'Stacked sedimentary layers with alternating reservoir & seal intervals',
    icon: (
      <svg viewBox="0 0 40 28" width="40" height="28" xmlns="http://www.w3.org/2000/svg">
        {[6, 12, 18, 24].map((y, i) => (
          <line key={y} x1="4" y1={y} x2="36" y2={y} stroke="currentColor" strokeWidth={i % 2 === 0 ? 2 : 1} opacity={i % 2 === 0 ? 1 : 0.45}/>
        ))}
      </svg>
    ),
  },
  {
    id: 'stratigraphic',
    label: 'Stratigraphic Trap',
    desc: 'Lateral facies change or unconformity creating a stratigraphic seal',
    icon: (
      <svg viewBox="0 0 40 28" width="40" height="28" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 22 L18 10 L24 10 L36 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="4" y1="26" x2="36" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
      </svg>
    ),
  },
  {
    id: 'channel',
    label: 'Channel Deposit',
    desc: 'Elongated high-permeability sandstone body enclosed by shale',
    icon: (
      <svg viewBox="0 0 40 28" width="40" height="28" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 20 Q12 8 20 10 Q28 12 36 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M4 24 Q12 14 20 16 Q28 18 36 14" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" strokeLinecap="round"/>
      </svg>
    ),
  },
]

// ── Wizard state types ─────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3

interface WizardData {
  name: string
  country: string
  geometry: string
  template: typeof FORMATION_PRESETS[0] | null
  isCustom: boolean   // true = user chose "build from scratch", no preset params loaded
}

const EMPTY_WIZARD: WizardData = { name: '', country: '', geometry: '', template: null, isCustom: false }

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const user        = useAuthStore((s) => s.user)
  const loadFormation = useFormationStore((s) => s.load)
  const setPanel    = useUIStore((s) => s.setPanel)
  const theme       = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const [projects, setProjects]   = useState<StoredProject[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [wizard, setWizard]       = useState<WizardData>(EMPTY_WIZARD)
  const [countrySearch, setCountrySearch] = useState('')
  const [errors, setErrors]       = useState<Partial<Record<keyof WizardData, string>>>({})

  const loadProjects = useCallback(async () => {
    const list = await db.projects.orderBy('updatedAt').reverse().toArray()
    setProjects(list)
  }, [])

  useEffect(() => {
    migrateFromLocalStorage().then(() => loadProjects())
  }, [loadProjects])

  // ── Preset Country Mapper ─────────────────────────────────────────────────
  const getCountryFromPreset = useCallback((presetName: string): string => {
    switch (presetName) {
      case 'Sleipner Utsira':
      case 'Snøhvit Tubåen':
      case 'Johansen':
        return 'Norway'
      case 'Mount Simon':
        return 'United States'
      case 'Gorgon':
      case 'Otway':
        return 'Australia'
      case 'In Salah':
        return 'Algeria'
      case 'Kasawari':
      case 'Duyong':
      case 'Malay Basin':
        return 'Malaysia'
      case 'Niger Delta':
        return 'Nigeria'
      case 'North Sumatra Basin':
        return 'Indonesia'
      case 'Nile Delta':
        return 'Egypt'
      case 'Abu Dhabi Basin':
        return 'United Arab Emirates'
      case 'Rotterdam / North Sea':
        return 'Netherlands'
      case 'Alberta Basin':
        return 'Canada'
      default:
        return 'Norway'
    }
  }, [])

  // ── Create from completed wizard ──────────────────────────────────────────
  // New step order: Step 1 = Foundation, Step 2 = Name+Country, Step 3 = Geometry
  const createProject = useCallback(async (wizardData: WizardData) => {
    const base = createDefaultProject()

    // User-provided name always wins — never the preset name
    base.name = wizardData.name.trim()

    if (wizardData.isCustom) {
      // Custom path: start with blank defaults, no preset geometry
      base.formation = { ...base.formation, geometryType: (wizardData.geometry || 'anticline') as GeometryType }
    } else if (wizardData.template) {
      // Preset-based: apply preset params then override with user's chosen geometry
      base.formation = {
        ...wizardData.template.params,
        geometryType: (wizardData.geometry || wizardData.template.params.geometryType) as GeometryType,
      }
    }

    base.id = crypto.randomUUID()
    const project: StoredProject = {
      ...base,
      snapshots: [],
      thumbnail: null,
      country: wizardData.country,
      presetId: wizardData.isCustom ? null : (wizardData.template?.name ?? null),
    }
    await db.projects.put(project)
    await loadProjects()
    // Pass presetId and country so formationStore reflects the preset and country from creation
    loadFormation(project.formation, undefined, project.presetId ?? undefined, project.country ?? undefined)

    useUIStore.getState().setCurrentProjectId(project.id)
    useUIStore.getState().setCurrentProjectName(project.name)
    useUIStore.getState().setView('workspace')
    setPanel('formation')

    if (project.name && project.country && project.formation) {
      useUIStore.getState().setStageComplete('stage1', true)
    }

    closeWizard()
  }, [loadProjects, loadFormation, setPanel])

  // ── Wizard helpers ─────────────────────────────────────────────────────────
  const openWizard = () => {
    setWizard(EMPTY_WIZARD)
    setCountrySearch('')
    setErrors({})
    setWizardStep(1)
    setWizardOpen(true)
  }

  const closeWizard = () => {
    setWizardOpen(false)
    setWizard(EMPTY_WIZARD)
    setCountrySearch('')
    setErrors({})
    setWizardStep(1)
  }

  // Step 1: foundation must be chosen (preset or custom)
  const validateStep1 = () => {
    const e: typeof errors = {}
    if (!wizard.template && !wizard.isCustom) e.template = 'Please select a foundational formation or choose Custom'
    return e
  }

  // Step 2: name + country
  const validateStep2 = () => {
    const e: typeof errors = {}
    if (!wizard.name.trim()) e.name    = 'Project name is required'
    if (!wizard.country)      e.country = 'Please select a country with a saline aquifer'
    return e
  }

  // Step 3: geometry (only required for non-custom, or custom must still pick one)
  const validateStep3 = () => {
    const e: typeof errors = {}
    if (!wizard.geometry) e.geometry = 'Please select a structural geometry'
    return e
  }

  const nextStep = () => {
    if (wizardStep === 1) {
      const e = validateStep1()
      if (Object.keys(e).length) { setErrors(e); return }
      setErrors({})
      setWizardStep(2)
    } else if (wizardStep === 2) {
      const e = validateStep2()
      if (Object.keys(e).length) { setErrors(e); return }
      setErrors({})
      setWizardStep(3)
    }
  }

  const finishWizard = () => {
    const e = validateStep3()
    if (Object.keys(e).length) { setErrors(e); return }
    createProject(wizard)
  }

  // ── Open existing project ─────────────────────────────────────────────────
  const openProject = (project: StoredProject) => {
    // Restore presetId so FormationPanel highlights the active preset on re-open
    if (project.wells?.length) {
      useFormationStore.getState().load(project.formation, project.wells, project.presetId ?? undefined, project.country ?? undefined)
    } else {
      loadFormation(project.formation, undefined, project.presetId ?? undefined, project.country ?? undefined)
    }
    if (project.simulationResult) {
      // Use restoreCompleted so status becomes 'complete' and ResultDisplay renders
      // without requiring the user to re-run the simulation on every open.
      useSimulationStore.getState().restoreCompleted(
        project.simulationResult,
        project.wells ?? [],
        project.formation,
        project.geomechanicsResult ?? null,
      )
    } else if (project.geomechanicsResult) {
      useSimulationStore.getState().setGeomechanics(project.geomechanicsResult)
    }
    useUIStore.getState().setCurrentProjectId(project.id)
    useUIStore.getState().setCurrentProjectName(project.name)
    useUIStore.getState().setView('workspace')
    setPanel('overview')

    // Restore or infer stage completion states
    const hasSim = !!project.simulationResult
    // Stored projects might have stageCompletion field or we infer it
    const storedStages = (project as any).stageCompletion
    const initialStages = storedStages || {
      stage1: !!(project.name && project.country),
      stage2: hasSim,
      stage3: hasSim,
      stage4: hasSim,
      stage5: hasSim,
    }
    useUIStore.getState().setStageCompleteAll(initialStages)
  }

  const deleteProject = async (id: string) => {
    await db.projects.delete(id)
    await loadProjects()
  }

  const filteredCountries = SALINE_AQUIFER_COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-page text-primary">

      {/* ── Header ── */}
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
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base md:text-lg font-semibold text-primary font-mono uppercase tracking-wider">Projects</h2>
          <button onClick={openWizard}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2.5 rounded bg-accent hover:bg-accent-hover text-white text-xs font-medium transition font-mono min-h-[44px]">
            <PlusCircle size={14} />
            New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12 md:py-16 text-muted">
            <FolderOpen size={36} className="mx-auto mb-3 text-muted" />
            <p className="text-xs sm:text-sm font-mono">No projects yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => openProject(p)} onDelete={() => deleteProject(p.id)} />
            ))}
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════════════
          NEW PROJECT WIZARD MODAL
          ════════════════════════════════════════════════════════════════════════ */}
      {wizardOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
          onClick={closeWizard}
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-theme flex flex-col shadow-2xl bg-card max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}>

            {/* ── Wizard header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme">
              <div>
                <div className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase mb-0.5">
                  New Project · Step {wizardStep} of 3
                </div>
                <div className="text-sm font-semibold text-primary">
                  {wizardStep === 1 && 'Select Foundational Formation'}
                  {wizardStep === 2 && 'Project Identity'}
                  {wizardStep === 3 && 'Structural Geometry'}
                </div>
              </div>
              <button onClick={closeWizard} className="p-2 rounded-lg bg-tertiary hover:bg-card text-muted hover:text-primary transition">
                <X size={15} />
              </button>
            </div>

            {/* ── Progress bar ── */}
            <div className="flex h-1 bg-tertiary">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`flex-1 transition-all duration-300 ${s <= wizardStep ? 'bg-emerald-500' : ''}`} />
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* ══ STEP 1: Foundation Selection ══ */}
              {wizardStep === 1 && (
                <div className="p-6 space-y-4">
                  <p className="text-xs text-muted font-mono leading-relaxed">
                    Choose a <strong className="text-primary">foundational formation</strong> to base your project parameters on, or start completely from scratch with a Custom Formation. Presets are validated geological analogues — every parameter can be adjusted after project creation.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[52vh] overflow-y-auto pr-1">
                    {FORMATION_PRESETS.map((p) => {
                      const isSelected = !wizard.isCustom && wizard.template?.name === p.name
                      return (
                        <button key={p.name}
                          onClick={() => setWizard((w) => ({ ...w, template: p, isCustom: false }))}
                          className={`text-left p-3 rounded-xl border transition ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/60 ring-1 ring-emerald-500/40'
                              : 'bg-tertiary border-transparent hover:border-theme/60'
                          }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className={`text-xs font-semibold font-mono ${isSelected ? 'text-emerald-300' : 'text-primary'}`}>{p.name}</div>
                              <div className="text-[10px] text-muted mt-0.5">{p.location}</div>
                            </div>
                            {isSelected && (
                              <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check size={9} className="text-white" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[9px] font-mono text-muted">{p.params.depth} m</span>
                            <span className="text-[9px] font-mono text-muted">φ {(p.params.porosity * 100).toFixed(0)}%</span>
                            <span className="text-[9px] font-mono text-muted">{p.params.permeability} mD</span>
                            <span className="text-[9px] font-mono text-muted capitalize">{p.params.geometryType}</span>
                          </div>
                        </button>
                      )
                    })}
                    {/* Custom Formation tile */}
                    <button
                      onClick={() => setWizard((w) => ({ ...w, template: null, isCustom: true }))}
                      className={`text-left p-3 rounded-xl border transition col-span-1 sm:col-span-2 ${
                        wizard.isCustom
                          ? 'bg-violet-500/15 border-violet-500/60 ring-1 ring-violet-500/40'
                          : 'bg-tertiary border-dashed border-theme/40 hover:border-violet-500/40'
                      }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className={`text-xs font-semibold font-mono flex items-center gap-2 ${wizard.isCustom ? 'text-violet-300' : 'text-primary'}`}>
                            <span className={`text-base ${wizard.isCustom ? 'text-violet-400' : 'text-muted'}`}>✦</span>
                            Custom Formation
                            <span className="text-[9px] font-normal font-mono text-muted">— build from scratch</span>
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">Start with blank default parameters. Define every property yourself in the Formation panel.</div>
                        </div>
                        {wizard.isCustom && (
                          <span className="shrink-0 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                            <Check size={9} className="text-white" />
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                  {errors.template && <p className="text-[10px] text-red-400 font-mono">{errors.template}</p>}
                </div>
              )}

              {/* ══ STEP 2: Project Name + Country ══ */}
              {wizardStep === 2 && (
                <div className="p-6 space-y-5">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono border ${
                    wizard.isCustom ? 'bg-violet-500/10 border-violet-500/30 text-violet-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}>
                    {wizard.isCustom ? '✦ Custom Formation' : `Foundation: ${wizard.template?.name}`}
                  </div>
                  <p className="text-xs text-muted font-mono leading-relaxed">
                    Give your project a meaningful name and select the country where the target saline aquifer is located.
                  </p>
                  <div>
                    <label className="block text-[10px] font-mono text-secondary uppercase tracking-wider mb-1.5">
                      Project Name <span className="text-red-400">*</span>
                    </label>
                    <input type="text" autoFocus placeholder="e.g. Berkshire Deep Saline, Permian Aquifer-7…"
                      className="input-field w-full"
                      value={wizard.name}
                      onChange={(e) => setWizard((w) => ({ ...w, name: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && nextStep()} />
                    {errors.name && <p className="text-[10px] text-red-400 font-mono mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-secondary uppercase tracking-wider mb-1.5">
                      Country <span className="text-red-400">*</span>
                      <span className="ml-2 text-muted normal-case tracking-normal">— must be a country with characterised saline aquifers</span>
                    </label>
                    <input type="text" placeholder="Search countries…" className="input-field w-full mb-2"
                      value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {filteredCountries.length === 0 && (
                        <p className="col-span-3 text-[10px] text-muted font-mono py-3 text-center">No match — only countries with documented saline aquifer potential are listed.</p>
                      )}
                      {filteredCountries.map((c) => (
                        <button key={c} onClick={() => setWizard((w) => ({ ...w, country: c }))}
                          className={`text-left px-3 py-2 rounded-lg text-[11px] font-mono transition border ${
                            wizard.country === c ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' : 'bg-tertiary border-transparent hover:border-theme text-muted hover:text-primary'
                          }`}>
                          {wizard.country === c && <Check size={9} className="inline mr-1 text-emerald-400" />}
                          {c}
                        </button>
                      ))}
                    </div>
                    {errors.country && <p className="text-[10px] text-red-400 font-mono mt-1">{errors.country}</p>}
                  </div>
                </div>
              )}

              {/* ══ STEP 3: Structural Geometry ══ */}
              {wizardStep === 3 && (
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border ${
                      wizard.isCustom ? 'bg-violet-500/10 border-violet-500/30 text-violet-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}>{wizard.isCustom ? '✦ Custom' : wizard.template?.name}</span>
                    {wizard.name && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border bg-tertiary border-theme/30 text-secondary">{wizard.name}</span>}
                    {wizard.country && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border bg-tertiary border-theme/30 text-secondary">{wizard.country}</span>}
                  </div>
                  <p className="text-xs text-muted font-mono leading-relaxed">
                    Choose the structural geometry for <span className="text-primary font-semibold">{wizard.name || 'your project'}</span>. This controls how the plume solver models CO₂ migration.
                    {!wizard.isCustom && wizard.template && <span className="text-muted"> Preset default: <strong className="text-secondary">{wizard.template.params.geometryType}</strong> — override here if needed.</span>}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {GEOMETRY_OPTIONS.map((g) => (
                      <button key={g.id} onClick={() => setWizard((w) => ({ ...w, geometry: g.id }))}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition text-center ${
                          wizard.geometry === g.id ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' : 'bg-tertiary border-transparent hover:border-theme text-muted hover:text-primary'
                        }`}>
                        <div className={wizard.geometry === g.id ? 'text-emerald-400' : 'text-muted'}>{g.icon}</div>
                        <span className="text-[11px] font-semibold font-mono leading-tight">{g.label}</span>
                        <span className="text-[9px] text-muted leading-tight">{g.desc}</span>
                      </button>
                    ))}
                  </div>
                  {errors.geometry && <p className="text-[10px] text-red-400 font-mono">{errors.geometry}</p>}
                </div>
              )}

            </div>{/* end scrollable body */}

            {/* ── Wizard footer ── */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-theme">
              <div>
                {wizardStep > 1 ? (
                  <button onClick={() => setWizardStep((s) => (s - 1) as WizardStep)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-tertiary text-muted hover:text-primary text-xs font-mono transition">
                    <ChevronLeft size={13} /> Back
                  </button>
                ) : (
                  <button onClick={closeWizard} className="px-4 py-2 rounded-lg bg-tertiary text-muted hover:text-primary text-xs font-mono transition">Cancel</button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((s) => (
                  <div key={s} className={`w-1.5 h-1.5 rounded-full transition-all ${s === wizardStep ? 'bg-emerald-400 w-4' : s < wizardStep ? 'bg-emerald-400/50' : 'bg-white/15'}`} />
                ))}
              </div>
              <div>
                {wizardStep < 3 ? (
                  <button onClick={nextStep}
                    disabled={wizardStep === 1 && !wizard.template && !wizard.isCustom}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono transition">
                    Next <ChevronRight size={13} />
                  </button>
                ) : (
                  <button onClick={finishWizard}
                    disabled={!wizard.geometry}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono transition">
                    <Check size={13} /> Create Project
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
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
