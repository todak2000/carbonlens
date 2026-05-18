import { useCallback } from 'react'
import { useFormationStore } from '../store/formationStore'
import { useSimulationStore } from '../store/simulationStore'
import { useUIStore } from '../store/uiStore'
import { StorageProject } from '../types'
import { createDefaultProject } from '../data/defaultProject'

const PROJECTS_KEY = 'carbonlens_projects'

function loadProjectList(): StorageProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveProjectList(projects: StorageProject[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
}

export function useProjectPersistence() {
  const formationParams = useFormationStore((s) => s.params)
  const wells = useFormationStore((s) => s.wells)
  const simResult = useSimulationStore((s) => s.result)
  const geomechanicsResult = useSimulationStore((s) => s.geomechanics)
  const jurisdiction = useUIStore((s) => s.jurisdiction)

  const saveCurrent = useCallback(() => {
    const projects = loadProjectList()

    // Find or create a temp entry using the first well id as anchor
    let project = projects.find((p) => p.wells[0]?.id === wells[0]?.id)
    if (!project) {
      project = { ...createDefaultProject(), wells: [...wells] }
    }

    project.formation = { ...formationParams }
    project.wells = [...wells]
    project.simulationResult = simResult ? { ...simResult } : null
    project.geomechanicsResult = geomechanicsResult ? { ...geomechanicsResult } : null
    project.jurisdiction = jurisdiction
    project.updatedAt = Date.now()

    // Upsert into the list
    const idx = projects.findIndex((p) => p.id === project!.id)
    if (idx >= 0) projects[idx] = project
    else projects.unshift(project)

    saveProjectList(projects)
  }, [formationParams, wells, simResult, geomechanicsResult, jurisdiction])

  return { saveCurrent, loadProjectList }
}
