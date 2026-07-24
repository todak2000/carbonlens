import Dexie, { type Table } from 'dexie'
import type { StorageProject } from '../types'

/** StoredProject extends StorageProject with snapshot/thumbnail fields used by the DB layer */
export interface StoredProject extends StorageProject {
  snapshots: Array<{ year: number; dataUrl: string }>
  thumbnail: string | null
  country: string           // ISO country name selected in project wizard
  presetId: string | null   // formation preset template used (separate from project name)
}

/** Per-year trapping and plume state saved during simulation playback */
export interface SimulationSnapshot {
  id: string              // uuid
  projectId: string
  year: number
  freeMt: number          // structural trapping (mobile CO2 under caprock)
  residualMt: number
  dissolvedMt: number
  mineralMt: number
  plumeRadiusM: number    // from Hesse analytical model
  plumeAreaKm2: number
  pressureMPa: number
  injectedMt: number      // cumulative at this year
  createdAt: number
}

/** A single monitoring observation (manual or synthetic SCADA) */
export interface MonitoringObservation {
  id: string              // uuid
  projectId: string
  year: number
  source: 'manual' | 'synthetic'
  observedPressureMPa: number | null
  observedPlumeAreaKm2: number | null
  observedInjectionRateMtpa: number | null
  notes: string
  deviationPressurePct: number | null    // (observed - simulated) / simulated * 100
  deviationPlumeAreaPct: number | null
  conformanceStatus: 'green' | 'amber' | 'red'
  createdAt: number
}

class CarbonLensDB extends Dexie {
  projects!: Table<StoredProject>
  simulationSnapshots!: Table<SimulationSnapshot>
  monitoringObservations!: Table<MonitoringObservation>

  constructor() {
    super('carbonlens_db')
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
    })
    this.version(2).stores({
      projects: 'id, name, createdAt, updatedAt',
      simulationSnapshots: 'id, projectId, year, [projectId+year]',
      monitoringObservations: 'id, projectId, year, source, [projectId+year]',
    })
  }
}

export const db = new CarbonLensDB()

/** Migrate existing localStorage projects to IndexedDB (runs once) */
export async function migrateFromLocalStorage(): Promise<void> {
  const migrated = localStorage.getItem('carbonlens_db_migrated')
  if (migrated) return
  try {
    const raw = localStorage.getItem('carbonlens_projects')
    if (!raw) { localStorage.setItem('carbonlens_db_migrated', '1'); return }
    const projects: StoredProject[] = JSON.parse(raw)
    if (projects.length > 0) {
      await db.projects.bulkPut(projects.map((p) => ({
        ...p,
        snapshots: p.snapshots ?? [],
        thumbnail: p.thumbnail ?? null,
      })))
    }
    localStorage.setItem('carbonlens_db_migrated', '1')
  } catch { /* silent — migration best-effort */ }
}
