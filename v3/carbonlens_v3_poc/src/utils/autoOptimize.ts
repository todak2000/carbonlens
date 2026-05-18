import type { FormationParams, Well } from '../types'
import { validateGeomechanics } from '../hooks/useSimulation'

export interface OptimizeResult {
  wells: Well[]
  totalRate: number
  perWellRate: number
  safe: boolean
  placements: { x: number; z: number; score: number }[]
}

// ── Caprock / leakage hazard fields ─────────────────────────────────────────

interface HazardMap {
  quality: (x: number, z: number) => number  // 0=unsafe, 1=perfect
  label: string
}

function buildHazardMap(params: FormationParams): HazardMap {
  const seed = params.depth + params.porosity * 100 + params.permeability

  const edgeMargin = 0.30
  const halfSpan = 1.5
  const safeInner = halfSpan - edgeMargin

  const faultLines: { ox: number; oz: number; dx: number; dz: number; width: number }[] = []
  const nFaults = 2 + Math.floor(params.geometryType === 'fault' ? 3 : 1)
  for (let i = 0; i < nFaults; i++) {
    const angle = (seed * (i + 1) * 7.3 + i * 113) % (Math.PI * 2)
    const ox = (seed * (i + 1) * 3.1 + i * 71) % (halfSpan * 2) - halfSpan
    const oz = (seed * (i + 1) * 5.7 + i * 47) % (halfSpan * 2) - halfSpan
    const len = 0.4 + ((seed * (i + 1) * 11.3) % 1.0) * 1.2
    const width = 0.06 + ((seed * (i + 1) * 13.7) % 1.0) * 0.08
    faultLines.push({ ox, oz, dx: Math.cos(angle) * len, dz: Math.sin(angle) * len, width })
  }

  const thinSpots: { cx: number; cz: number; radius: number }[] = []
  const nThin = 1 + Math.floor((seed * 17.3) % 3)
  for (let i = 0; i < nThin; i++) {
    thinSpots.push({
      cx: ((seed * (i + 1) * 19.7 + i * 131) % (halfSpan * 1.6)) - halfSpan * 0.8,
      cz: ((seed * (i + 1) * 23.1 + i * 89) % (halfSpan * 1.6)) - halfSpan * 0.8,
      radius: 0.15 + ((seed * (i + 1) * 29.3) % 1.0) * 0.3,
    })
  }

  // Uniform safe-caprock band around the anticline crest
  const crestX = (seed * 2.7) % 0.6 - 0.3
  const crestZ = (seed * 3.1) % 0.6 - 0.3

  const quality = (x: number, z: number): number => {
    let q = 1.0

    // Edge penalty — spill points at structural margins
    const edgeDist = Math.max(0, halfSpan - Math.max(Math.abs(x), Math.abs(z)))
    if (edgeDist < edgeMargin) {
      q *= Math.max(0, edgeDist / edgeMargin)
    }

    // Distance from crest — caprock is thickest near crest, thinner on flanks
    const distCrest = Math.sqrt((x - crestX) ** 2 + (z - crestZ) ** 2)
    const crestRadius = 0.8
    if (distCrest > crestRadius) {
      q *= Math.max(0.3, 1 - (distCrest - crestRadius) * 0.5)
    }

    // Fault proximity penalty
    for (const f of faultLines) {
      const t = Math.max(0, Math.min(1, ((x - f.ox) * f.dx + (z - f.oz) * f.dz) / (f.dx * f.dx + f.dz * f.dz)))
      const px = f.ox + t * f.dx
      const pz = f.oz + t * f.dz
      const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2)
      if (dist < f.width * 3) {
        q *= Math.max(0.1, dist / (f.width * 3))
      }
    }

    // Thin caprock spots
    for (const ts of thinSpots) {
      const dist = Math.sqrt((x - ts.cx) ** 2 + (z - ts.cz) ** 2)
      if (dist < ts.radius) {
        q *= Math.max(0.1, dist / ts.radius)
      }
    }

    return Math.max(0, Math.min(1, q))
  }

  return { quality, label: 'caprock-integrity' }
}

function findSafePositions(hazard: HazardMap, num: number, halfSpan: number): { x: number; z: number; score: number }[] {
  const candidates: { x: number; z: number; score: number }[] = []
  const step = 0.06
  for (let x = -halfSpan + 0.1; x <= halfSpan - 0.1; x += step) {
    for (let z = -halfSpan + 0.1; z <= halfSpan - 0.1; z += step) {
      const score = hazard.quality(x, z)
      if (score > 0.5) {
        candidates.push({ x, z, score })
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  // Greedy farthest-point selection: pick highest-score point, then keep picking
  // points that are far from already-selected points with good scores
  const selected: { x: number; z: number; score: number }[] = []
  const minSep = (halfSpan * 2) / (Math.ceil(Math.sqrt(num)) + 0.5)

  for (const c of candidates) {
    if (selected.length >= num) break
    const tooClose = selected.some((s) => Math.sqrt((s.x - c.x) ** 2 + (s.z - c.z) ** 2) < minSep)
    if (!tooClose) {
      selected.push(c)
    }
  }

  // If we couldn't find enough, relax the separation and retry
  if (selected.length < num) {
    const relaxedMin = minSep * 0.6
    for (const c of candidates) {
      if (selected.length >= num) break
      const tooClose = selected.some((s) => Math.sqrt((s.x - c.x) ** 2 + (s.z - c.z) ** 2) < relaxedMin)
      if (!tooClose && c.score > 0.4) {
        selected.push(c)
      }
    }
  }

  // If still not enough, take the best remaining regardless of separation
  if (selected.length < num) {
    for (const c of candidates) {
      if (selected.length >= num) break
      if (!selected.some((s) => s.x === c.x && s.z === c.z)) {
        selected.push(c)
      }
    }
  }

  return selected.slice(0, num)
}

// ── Main entry point ────────────────────────────────────────────────────────

export function autoOptimizeWells(
  params: FormationParams,
  numWells: number,
  existingWells: Well[],
): OptimizeResult {
  const hazard = buildHazardMap(params)
  const halfSpan = 1.5
  const positions = findSafePositions(hazard, numWells, halfSpan)

  const wells: Well[] = positions.map((p, i) => {
    const prev = existingWells[i]
    return {
      id: prev?.id ?? `well_${i + 1}`,
      x: p.x,
      z: p.z,
      injectionRate: prev?.injectionRate ?? 0.5,
      label: prev?.label ?? `Well ${i + 1}`,
      rampUpYears: prev?.rampUpYears ?? 5,
      rampDownYears: prev?.rampDownYears ?? 10,
    }
  })

  let low = 0.001
  let high = 20
  let bestRate = 0.001

  for (let iter = 0; iter < 30; iter++) {
    const mid = (low + high) / 2
    const testWells = wells.map((w) => ({
      injectionRate: mid,
      rampUpYears: w.rampUpYears,
      rampDownYears: w.rampDownYears,
    }))
    const v = validateGeomechanics(params, testWells)
    if (v.valid) {
      bestRate = mid
      low = mid
    } else {
      high = mid
    }
  }

  return {
    wells: wells.map((w) => ({ ...w, injectionRate: Math.max(0.001, bestRate) })),
    totalRate: bestRate * numWells,
    perWellRate: Math.max(0.001, bestRate),
    safe: bestRate > 0.001,
    placements: positions,
  }
}
