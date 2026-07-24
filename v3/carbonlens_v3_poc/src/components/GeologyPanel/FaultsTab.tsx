import { useState, useRef } from 'react'
import { Plus, Trash2, ChevronRight, AlertTriangle, CheckCircle, Upload } from 'lucide-react'
import { useGeologicalStore } from '../../store/geologicalStore'
import { FaultDefinition } from '../../types/geological'

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span className="text-xs text-muted font-mono">{label}</span>
        <span className="text-xs text-secondary font-mono font-bold">{value} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-accent cursor-pointer"
      />
    </div>
  )
}

function FaultMapView() {
  const { model, selectedFaultId, selectFault } = useGeologicalStore()

  return (
    <div className="relative w-full h-40 bg-page rounded-lg border border-theme overflow-hidden mb-4">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect width="100" height="100" fill="transparent" />
        {model.faults.map((f) => {
          const cx = f.positionX * 100
          const cy = f.positionY * 100
          const angleRad = ((f.strike - 90) * Math.PI) / 180
          const halfLen = Math.min(f.length / (model.modelWidthM / 100), 40)
          const x1 = cx - Math.cos(angleRad) * halfLen
          const y1 = cy - Math.sin(angleRad) * halfLen
          const x2 = cx + Math.cos(angleRad) * halfLen
          const y2 = cy + Math.sin(angleRad) * halfLen
          const isSealing = f.sealingFactor < 0.3
          const isOpen = f.sealingFactor > 0.7
          const color = isSealing ? '#ef4444' : isOpen ? '#10b981' : '#f59e0b'
          const isSelected = selectedFaultId === f.id
          return (
            <g key={f.id} onClick={() => selectFault(f.id)} className="cursor-pointer">
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeWidth={isSelected ? 2.5 : 1.8}
                strokeOpacity={isSelected ? 1 : 0.7}
              />
              <circle cx={cx} cy={cy} r="2.5" fill={color} opacity={0.9} />
              <text x={cx + 3} y={cy - 2} fontSize="5" fontWeight="bold" fill={color} opacity={0.9}>{f.name}</text>
            </g>
          )
        })}
      </svg>
      <div className="absolute bottom-1.5 right-2.5 text-[10px] font-mono text-muted uppercase font-bold tracking-wider">Map View (N↑)</div>
    </div>
  )
}

function FaultEditor({ fault }: { fault: FaultDefinition }) {
  const updateFault = useGeologicalStore((s) => s.updateFault)
  const u = (changes: Partial<FaultDefinition>) => updateFault(fault.id, changes)
  const isSealing = fault.sealingFactor < 0.3
  const isOpen = fault.sealingFactor > 0.7

  return (
    <div className="flex flex-col gap-4 px-4 py-4 bg-page rounded-b-md border-x border-b border-theme">
      <div>
        <label className="block text-xs text-muted font-mono mb-1.5 font-bold">Fault Name</label>
        <input type="text" value={fault.name}
          onChange={(e) => u({ name: e.target.value })}
          className="w-full bg-card border border-theme rounded-lg px-3 py-1.5 text-xs text-primary font-mono focus:outline-none focus:border-accent"
        />
      </div>

      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold border
        ${isSealing 
          ? 'bg-red-500/10 border-red-500/30 text-red-500' 
          : isOpen 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-500'}`}>
        {isSealing ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
        {isSealing ? 'Sealing fault — CO₂ will accumulate against this fault' :
         isOpen ? 'Open fault — potential CO₂ leakage pathway' :
         'Partially sealing fault — retarded cross-fault flow'}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted font-mono uppercase tracking-wider font-bold">Geometry</p>
        <SliderRow label="Position X" value={parseFloat(fault.positionX.toFixed(2))} min={0} max={1} step={0.01} unit=""
          onChange={(v) => u({ positionX: v })} />
        <SliderRow label="Position Y" value={parseFloat(fault.positionY.toFixed(2))} min={0} max={1} step={0.01} unit=""
          onChange={(v) => u({ positionY: v })} />
        <SliderRow label="Strike" value={fault.strike} min={0} max={360} step={1} unit="°"
          onChange={(v) => u({ strike: v })} />
        <SliderRow label="Dip" value={fault.dip} min={15} max={90} step={1} unit="°"
          onChange={(v) => u({ dip: v })} />
        <SliderRow label="Throw" value={fault.throw} min={1} max={500} step={1} unit="m"
          onChange={(v) => u({ throw: v })} />
        <SliderRow label="Length" value={fault.length} min={100} max={20000} step={100} unit="m"
          onChange={(v) => u({ length: v })} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted font-mono uppercase tracking-wider font-bold">Sealing Properties</p>
        <SliderRow label="Sealing Factor" value={parseFloat(fault.sealingFactor.toFixed(2))} min={0} max={1} step={0.01} unit=""
          onChange={(v) => u({ sealingFactor: v })} />
        <div className="flex justify-between text-[10px] font-mono text-muted px-0.5 italic">
          <span>0 = fully sealing</span><span>1 = fully open</span>
        </div>
        <SliderRow label="Clay Smear" value={parseFloat(fault.claySmearFactor.toFixed(2))} min={0} max={1} step={0.01} unit=""
          onChange={(v) => u({ claySmearFactor: v })} />
        <SliderRow label="Fault Zone Thickness" value={fault.faultZoneThickness} min={0.1} max={20} step={0.1} unit="m"
          onChange={(v) => u({ faultZoneThickness: v })} />
      </div>
    </div>
  )
}

export default function FaultsTab() {
  const { model, selectedFaultId, addFault, removeFault, selectFault, setModel } = useGeologicalStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const handleFaultImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const raw: unknown[] = JSON.parse(text)
      if (!Array.isArray(raw)) throw new Error('Expected a JSON array of fault objects')
      const newFaults: import('../../types/geological').FaultDefinition[] = raw.map((f: any, idx) => ({
        id: `imported_fault_${Date.now()}_${idx}`,
        name: typeof f.name === 'string' ? f.name : `Fault ${idx + 1}`,
        positionX: typeof f.positionX === 'number' ? Math.max(0, Math.min(1, f.positionX)) : 0.5,
        positionY: typeof f.positionY === 'number' ? Math.max(0, Math.min(1, f.positionY)) : 0.5,
        strike: typeof f.strike === 'number' ? Math.max(0, Math.min(360, f.strike)) : 45,
        dip: typeof f.dip === 'number' ? Math.max(15, Math.min(90, f.dip)) : 70,
        throw: typeof f.throw === 'number' ? Math.max(1, f.throw) : 50,
        length: typeof f.length === 'number' ? Math.max(100, f.length) : 2000,
        sealingFactor: typeof f.sealingFactor === 'number' ? Math.max(0, Math.min(1, f.sealingFactor)) : 0.5,
        claySmearFactor: typeof f.claySmearFactor === 'number' ? Math.max(0, Math.min(1, f.claySmearFactor)) : 0.3,
        faultZoneThickness: typeof f.faultZoneThickness === 'number' ? Math.max(0.1, f.faultZoneThickness) : 2,
      }))
      setModel({ ...model, faults: [...model.faults, ...newFaults] })
      if (importRef.current) importRef.current.value = ''
      alert(`Imported ${newFaults.length} fault(s).`)
    } catch (err) {
      alert(`Fault import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="space-y-3">
      <FaultMapView />

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono text-muted uppercase tracking-wider font-bold">
          {model.faults.length} Fault{model.faults.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { addFault(); setExpandedId(null) }}
            className="flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition font-bold"
          >
            <Plus size={13} /> Add Fault
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleFaultImport} className="hidden" />
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded-lg bg-tertiary text-muted hover:text-secondary border border-theme/40 transition font-bold"
            title="Import faults from JSON array"
          >
            <Upload size={13} /> Import JSON
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-xs font-mono text-muted font-semibold">
        <span className="flex items-center gap-1.5"><span className="w-4 h-1 bg-red-500 rounded-sm inline-block" />Sealing</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-1 bg-amber-500 rounded-sm inline-block" />Partial</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-1 bg-emerald-500 rounded-sm inline-block" />Open</span>
      </div>

      <div className="space-y-2.5">
        {model.faults.map((fault) => {
          const isExpanded = expandedId === fault.id
          const isSealing = fault.sealingFactor < 0.3
          const isOpen = fault.sealingFactor > 0.7
          const color = isSealing ? 'text-red-500' : isOpen ? 'text-emerald-500' : 'text-amber-500'
          return (
            <div key={fault.id} className="rounded-lg border border-theme overflow-hidden">
              <div
                className={`flex items-center gap-2.5 px-3.5 py-3 cursor-pointer bg-card hover:bg-tertiary transition
                  ${selectedFaultId === fault.id ? 'border-l-4 border-accent' : ''}`}
                onClick={() => {
                  selectFault(fault.id)
                  setExpandedId(isExpanded ? null : fault.id)
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-mono font-bold ${color}`}>{fault.name}</p>
                  <p className="text-xs text-muted font-mono mt-0.5">
                    Strike {fault.strike}° · Dip {fault.dip}° · Throw {fault.throw}m · Seal {(fault.sealingFactor * 100).toFixed(0)}%
                  </p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeFault(fault.id) }}
                  className="p-1.5 text-muted hover:text-error rounded-md">
                  <Trash2 size={13} />
                </button>
                <ChevronRight size={13} className={`text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </div>
              {isExpanded && <FaultEditor fault={fault} />}
            </div>
          )
        })}
      </div>

      {model.faults.length === 0 && (
        <div className="text-center py-8 text-muted text-xs font-mono italic">
          No faults defined. Formation is unfaulted.
        </div>
      )}
    </div>
  )
}
