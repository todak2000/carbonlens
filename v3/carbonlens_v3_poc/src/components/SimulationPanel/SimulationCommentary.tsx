/**
 * SimulationCommentary — live narrative that updates every simulation year.
 *
 * The "headline" row always shows the current year + a key metric that
 * changes every step, making it visually obvious the commentary is live.
 * Contextual lines beneath describe the active reservoir process.
 */
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import { useFormationStore } from '../../store/formationStore'
import { wellRateAtTime } from '../../utils/gridParser'

interface Line {
  text: string
  type: 'info' | 'warn' | 'ok'
}

export default function SimulationCommentary() {
  const result       = useSimulationStore((s) => s.result)
  const isAnimating  = useSimulationStore((s) => s.isAnimating)
  const status       = useSimulationStore((s) => s.status)
  const timestep     = useUIStore((s) => s.timestep)
  const projectYears = useUIStore((s) => s.projectYears)
  const params       = useFormationStore((s) => s.params)
  const wells        = useFormationStore((s) => s.wells)

  if (!result && status === 'idle') return null

  const lines: Line[] = []

  const isSupercritical = (result?.co2Density ?? 0) > 400
  const totalRate = wells.reduce(
    (s, w) => s + wellRateAtTime(w.injectionRate, timestep, w.rampUpYears, w.rampDownYears, projectYears),
    0,
  )
  const stored    = result?.storageCapacity ?? 0
  const plumeR    = result?.plumeRadius ?? 0
  const pressure  = result?.injectionPressure ?? params.pressure
  const utilPct   = result?.capacityUtilPct ?? 0
  const mobile    = result?.mobilePlume ?? 0
  const residual  = result?.residualTrapping ?? 0
  const dissolved = result?.solubilityTrapping ?? 0
  const mineral   = result?.mineralTrapping ?? 0
  const totalTrapped = residual + dissolved + mineral
  const trapPct   = stored > 0.001 ? (totalTrapped / stored * 100) : 0

  // ── Always-changing headline — makes it obvious the panel is live ──────────
  if (isAnimating || status === 'running') {
    if (totalRate > 0) {
      lines.push({
        text: `Year ${timestep} — injecting ${totalRate.toFixed(2)} Mt/yr · ${stored.toFixed(3)} Mt stored · ${pressure.toFixed(1)} MPa`,
        type: 'info',
      })
    } else {
      lines.push({
        text: `Year ${timestep} — injection ended · ${stored.toFixed(3)} Mt stored · monitoring phase`,
        type: 'info',
      })
    }
  }

  // ── Phase-specific process description ───────────────────────────────────
  if (timestep === 0) {
    lines.push({ text: 'Wellbore pressurisation initiated. CO₂ entering injection string.', type: 'info' })

  } else if (timestep <= 2) {
    const phaseLabel = isSupercritical ? 'supercritical' : 'subcritical (gaseous)'
    lines.push({
      text: `CO₂ phase: ${phaseLabel} at ${result?.co2Density.toFixed(0)} kg/m³. Brine displacement underway at perforations.`,
      type: 'info',
    })
    lines.push({
      text: 'Near-wellbore buoyancy forces driving upward migration through pore network.',
      type: 'info',
    })

  } else if (timestep <= 5) {
    lines.push({
      text: `Plume rising through ${params.geometryType} structure — buoyancy dominant. Capillary barriers slowing lateral spread.`,
      type: 'info',
    })
    if (plumeR > 30) {
      lines.push({
        text: `Radial invasion front now ~${plumeR.toFixed(0)} m from injection well.`,
        type: 'info',
      })
    }

  } else if (timestep <= 15) {
    lines.push({
      text: `Residual trapping active — snap-off immobilising CO₂ in bypassed pore throats (${residual.toFixed(3)} Mt secured).`,
      type: 'ok',
    })
    if (plumeR > 100) {
      lines.push({
        text: `Plume front at ${plumeR.toFixed(0)} m. Structural trap geometry constraining migration path.`,
        type: 'info',
      })
    }

  } else if (timestep <= 30) {
    lines.push({
      text: `CO₂ accumulating beneath caprock seal. Lateral spreading under ${params.geometryType} structure.`,
      type: 'info',
    })
    if (dissolved > 0.001) {
      lines.push({
        text: `Solubility trapping increasing — ${dissolved.toFixed(3)} Mt dissolved into formation brine. CO₂-enriched brine sinking.`,
        type: 'ok',
      })
    }

  } else if (timestep <= 50) {
    lines.push({
      text: `Structural + residual trapping dominant. Convective dissolution accelerating (${dissolved.toFixed(3)} Mt dissolved).`,
      type: 'ok',
    })
    if (mineral > 0.0001) {
      lines.push({
        text: `Geochemical reactions beginning — ${mineral.toFixed(4)} Mt CO₂ entering mineral trapping phase.`,
        type: 'ok',
      })
    }

  } else {
    lines.push({
      text: `Long-term storage phase. Mineralisation progressing (${mineral.toFixed(3)} Mt). Pressure dissipating.`,
      type: 'ok',
    })
  }

  // ── Trapping progress ─────────────────────────────────────────────────────
  if (trapPct > 2) {
    lines.push({
      text: `${trapPct.toFixed(1)}% of stored CO₂ now permanently trapped (residual + dissolved + mineral).`,
      type: 'ok',
    })
  }

  // ── Pressure / risk ───────────────────────────────────────────────────────
  if (result?.overpressureRisk) {
    lines.push({
      text: `⚠ Injection pressure ${pressure.toFixed(1)} MPa exceeds P90 capacity. Caprock integrity at risk — consider reducing injection rate.`,
      type: 'warn',
    })
  } else if (utilPct > 70) {
    lines.push({
      text: `Storage utilisation ${utilPct.toFixed(1)}% — approaching capacity. Monitor wellhead pressure closely.`,
      type: 'warn',
    })
  }

  // ── Density contrast ─────────────────────────────────────────────────────
  if (result && timestep > 0 && timestep <= 10) {
    const denseDiff = result.brineDensity - result.co2Density
    if (denseDiff > 150) {
      lines.push({
        text: `Density contrast: ${denseDiff.toFixed(0)} kg/m³ — strong gravitational segregation driving upward CO₂ migration.`,
        type: 'info',
      })
    }
  }

  // ── Multi-well interference ───────────────────────────────────────────────
  if (wells.filter((w) => w.injectionRate > 0).length > 1 && timestep <= 5) {
    lines.push({
      text: `${wells.filter((w) => w.injectionRate > 0).length} active wells — inter-well pressure superposition increasing near-wellbore pressure.`,
      type: 'info',
    })
  }

  // ── Completion summary ────────────────────────────────────────────────────
  if (!isAnimating && status === 'complete' && result) {
    lines.push({
      text: `Simulation complete — ${stored.toFixed(3)} Mt stored · ${trapPct.toFixed(1)}% permanently trapped · containment ${(result.containmentProbability * 100).toFixed(0)}%.`,
      type: 'ok',
    })
  }

  if (lines.length === 0) return null

  const colorMap = {
    info: { text: 'var(--text-muted)', border: 'var(--border)', bg: 'var(--bg-tertiary)' },
    warn: { text: 'var(--color-warning)', border: 'var(--color-warning-border)', bg: 'var(--color-warning-bg)' },
    ok:   { text: 'var(--color-success)', border: 'var(--color-success-border)', bg: 'var(--color-success-bg)' },
  }

  return (
    <div className="pt-1 border-t border-theme/50 space-y-1">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] text-muted font-mono uppercase tracking-wider">Reservoir Commentary</span>
        {(isAnimating || status === 'running') && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" title="Live" />
        )}
      </div>
      {lines.slice(0, 5).map((line, i) => {
        const c = colorMap[line.type]
        return (
          <div
            key={i}
            className="px-2 py-1 rounded text-[9px] font-mono leading-snug"
            style={{ color: c.text, border: `1px solid ${c.border}`, background: c.bg }}
          >
            {line.text}
          </div>
        )
      })}
    </div>
  )
}
