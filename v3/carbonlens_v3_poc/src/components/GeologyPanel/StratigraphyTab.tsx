import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { useGeologicalStore } from '../../store/geologicalStore'
import { StratigraphicZone, HorizonShape } from '../../types/geological'
import { LITHOLOGY_DEFAULTS } from '../../data/lithologyDefaults'
import LithologyPicker from './LithologyPicker'

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span className="text-xs text-muted font-mono">{label}</span>
        <span className="text-xs text-secondary font-mono font-bold">{value.toPrecision(3)} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-accent cursor-pointer"
      />
    </div>
  )
}

const HORIZON_SHAPES: { value: HorizonShape; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'tilted', label: 'Tilted' },
  { value: 'anticline', label: 'Anticline' },
  { value: 'dome', label: 'Dome' },
  { value: 'wedge', label: 'Wedge-out' },
  { value: 'onlap', label: 'Onlap' },
  { value: 'thin_rim', label: 'Thin Rim' },
  { value: 'unconformity', label: 'Unconformity' },
]

function ZoneEditor({ zone }: { zone: StratigraphicZone }) {
  const updateZone = useGeologicalStore((s) => s.updateZone)
  const applyLithologyDefaults = useGeologicalStore((s) => s.applyLithologyDefaults)
  const u = (changes: Partial<StratigraphicZone>) => updateZone(zone.id, changes)

  return (
    <div className="flex flex-col gap-4 px-4 py-4 bg-page rounded-b-md border-x border-b border-theme">
      <div>
        <p className="text-xs text-muted font-mono mb-2 uppercase tracking-wider font-bold">Lithology</p>
        <LithologyPicker
          value={zone.lithology}
          onChange={(l) => applyLithologyDefaults(zone.id, l)}
        />
        <p className="text-xs text-muted mt-2 italic leading-relaxed">
          {LITHOLOGY_DEFAULTS[zone.lithology].description}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted font-mono uppercase tracking-wider font-bold">Depth &amp; Thickness</p>
        <SliderRow label="Top Depth" value={zone.topDepth} min={500} max={5000} step={10} unit="m"
          onChange={(v) => u({ topDepth: v })} />
        <SliderRow label="Gross Thickness" value={zone.thickness} min={1} max={500} step={1} unit="m"
          onChange={(v) => u({ thickness: v })} />
        <SliderRow label="Net-to-Gross" value={zone.netToGross} min={0.05} max={1.0} step={0.01} unit=""
          onChange={(v) => u({ netToGross: v })} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted font-mono uppercase tracking-wider font-bold">Porosity</p>
        <SliderRow label="Mean Porosity" value={zone.porosityMean} min={0.01} max={0.50} step={0.005} unit="frac"
          onChange={(v) => u({ porosityMean: v })} />
        <SliderRow label="Std Dev" value={zone.porosityStdDev} min={0.005} max={0.10} step={0.005} unit="frac"
          onChange={(v) => u({ porosityStdDev: v })} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted font-mono uppercase tracking-wider font-bold">Permeability</p>
        <SliderRow label="k_horizontal" value={zone.kHorizontal} min={0.01} max={5000} step={0.1} unit="mD"
          onChange={(v) => u({ kHorizontal: v })} />
        <SliderRow label="k_v / k_h" value={zone.kVerticalRatio} min={0.001} max={1.0} step={0.001} unit=""
          onChange={(v) => u({ kVerticalRatio: v })} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted font-mono uppercase tracking-wider font-bold">Capillary &amp; Wettability</p>
        <SliderRow label="Entry Pressure" value={zone.capillaryEntryPressure} min={0.001} max={30} step={0.01} unit="MPa"
          onChange={(v) => u({ capillaryEntryPressure: v })} />
        <div className="flex gap-2">
          {(['water_wet', 'mixed_wet'] as const).map((w) => (
            <button key={w} onClick={() => u({ wettability: w })}
              className={`flex-1 py-1.5 rounded text-xs font-mono border transition font-bold
                ${zone.wettability === w ? 'border-accent bg-accent/10 text-primary' : 'border-theme text-muted hover:text-secondary'}`}>
              {w === 'water_wet' ? 'Water-wet' : 'Mixed-wet'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted font-mono uppercase tracking-wider font-bold">Horizon Shape</p>
        <div className="grid grid-cols-2 gap-1.5">
          {HORIZON_SHAPES.map((s) => (
            <button key={s.value} onClick={() => u({ horizonShape: s.value })}
              className={`py-1.5 px-2 rounded text-xs font-mono border transition font-semibold
                ${zone.horizonShape === s.value ? 'border-accent bg-accent/10 text-primary' : 'border-theme text-muted hover:text-secondary'}`}>
              {s.label}
            </button>
          ))}
        </div>
        {zone.horizonShape === 'tilted' && (
          <SliderRow label="Dip Angle" value={zone.horizonParams.dipAngle ?? 5} min={0} max={45} step={0.5} unit="°"
            onChange={(v) => u({ horizonParams: { ...zone.horizonParams, dipAngle: v } })} />
        )}
        {(zone.horizonShape === 'anticline') && (
          <>
            <SliderRow label="Fold Amplitude" value={zone.horizonParams.foldAmplitude ?? 50} min={5} max={500} step={5} unit="m"
              onChange={(v) => u({ horizonParams: { ...zone.horizonParams, foldAmplitude: v } })} />
            <SliderRow label="Fold Wavelength" value={zone.horizonParams.foldWavelength ?? 5000} min={500} max={20000} step={100} unit="m"
              onChange={(v) => u({ horizonParams: { ...zone.horizonParams, foldWavelength: v } })} />
          </>
        )}
        {zone.horizonShape === 'dome' && (
          <>
            <SliderRow label="Dome Radius" value={zone.horizonParams.domeRadius ?? 3000} min={500} max={10000} step={100} unit="m"
              onChange={(v) => u({ horizonParams: { ...zone.horizonParams, domeRadius: v } })} />
            <SliderRow label="Dome Amplitude" value={zone.horizonParams.domeAmplitude ?? 80} min={10} max={500} step={5} unit="m"
              onChange={(v) => u({ horizonParams: { ...zone.horizonParams, domeAmplitude: v } })} />
          </>
        )}
        {zone.horizonShape === 'thin_rim' && (
          <SliderRow label="Rim Width" value={zone.horizonParams.rimWidth ?? 500} min={50} max={2000} step={50} unit="m"
            onChange={(v) => u({ horizonParams: { ...zone.horizonParams, rimWidth: v } })} />
        )}
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={zone.activeForInjection}
            onChange={(e) => u({ activeForInjection: e.target.checked })}
            className="accent-accent w-4 h-4 cursor-pointer" />
          <span className="text-xs font-mono text-muted font-medium">Active for injection</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={zone.isCaprock}
            onChange={(e) => u({ isCaprock: e.target.checked })}
            className="accent-accent w-4 h-4 cursor-pointer" />
          <span className="text-xs font-mono text-muted font-medium">Caprock / Seal</span>
        </label>
      </div>

      <div>
        <label className="block text-xs text-muted font-mono mb-1.5 font-bold">Zone Name</label>
        <input
          type="text"
          value={zone.name}
          onChange={(e) => u({ name: e.target.value })}
          className="w-full bg-card border border-theme rounded-lg px-3 py-1.5 text-xs text-primary font-mono focus:outline-none focus:border-accent"
        />
      </div>
    </div>
  )
}

export default function StratigraphyTab() {
  const { model, selectedZoneId, addZone, removeZone, reorderZones, selectZone } = useGeologicalStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-muted uppercase tracking-wider flex items-center gap-1.5 font-bold">
          <Layers size={13} /> {model.zones.length} Zone{model.zones.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => addZone('sandstone')}
          className="flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition font-bold"
        >
          <Plus size={13} /> Add Zone
        </button>
      </div>

      {model.zones.map((zone, idx) => {
        const isExpanded = expandedId === zone.id
        const lithDef = LITHOLOGY_DEFAULTS[zone.lithology]
        return (
          <div key={zone.id} className="rounded-lg border border-theme overflow-hidden">
            <div
              className={`flex items-center gap-2.5 px-3.5 py-3 cursor-pointer bg-card hover:bg-tertiary transition
                ${selectedZoneId === zone.id ? 'border-l-4 border-accent' : ''}`}
              onClick={() => {
                selectZone(zone.id)
                setExpandedId(isExpanded ? null : zone.id)
              }}
            >
              <span className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: zone.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-primary truncate">{zone.name}</span>
                  {zone.isCaprock && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 font-mono font-bold">SEAL</span>
                  )}
                  {zone.activeForInjection && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/20 text-green-400 font-mono font-bold">INJ</span>
                  )}
                </div>
                <p className="text-xs text-muted font-mono mt-0.5">
                  {zone.topDepth}m — {(zone.topDepth + zone.thickness).toFixed(0)}m · {lithDef.label}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); if (idx > 0) reorderZones(idx, idx - 1) }}
                  className="p-1.5 text-muted hover:text-secondary rounded-md" title="Move up">
                  <ChevronUp size={13} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); if (idx < model.zones.length - 1) reorderZones(idx, idx + 1) }}
                  className="p-1.5 text-muted hover:text-secondary rounded-md" title="Move down">
                  <ChevronDown size={13} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeZone(zone.id) }}
                  className="p-1.5 text-muted hover:text-error rounded-md" title="Remove zone">
                  <Trash2 size={13} />
                </button>
                <ChevronRight size={13} className={`text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </div>
            </div>
            {isExpanded && <ZoneEditor zone={zone} />}
          </div>
        )
      })}

      {model.zones.length === 0 && (
        <div className="text-center py-8 text-muted text-xs font-mono italic">
          No zones defined. Click Add Zone to start.
        </div>
      )}
    </div>
  )
}
