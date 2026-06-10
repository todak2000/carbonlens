import Dexie, { type Table } from 'dexie'
import type { StorageProject } from '../types'

/** StoredProject extends StorageProject with snapshot/thumbnail fields used by the DB layer */
export interface StoredProject extends StorageProject {
  snapshots: Array<{ year: number; dataUrl: string }>
  thumbnail: string | null
}

class CarbonLensDB extends Dexie {
  projects!: Table<StoredProject>

  constructor() {
    super('carbonlens_db')
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
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
