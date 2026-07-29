import { useState } from 'react'
import { Layers, GitBranch, BarChart2, Maximize2, Minimize2, ChevronRight } from 'lucide-react'
import StratigraphyTab from './StratigraphyTab'
import FaultsTab from './FaultsTab'
import PropertyPreviewTab from './PropertyPreviewTab'
import { useGeologicalStore } from '../../store/geologicalStore'
import { useUIStore } from '../../store/uiStore'

type Tab = 'stratigraphy' | 'faults' | 'preview'

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'stratigraphy', label: 'Stratigraphy & Lithology', Icon: Layers },
  { id: 'faults', label: 'Fault Networks', Icon: GitBranch },
  { id: 'preview', label: 'Grid Properties', Icon: BarChart2 },
]

export default function GeologyPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('stratigraphy')
  const { model, gridNx, gridNy, gridNz, setGridDimensions } = useGeologicalStore()
  const geologyExpanded = useUIStore((s) => s.geologyExpanded)
  const toggleGeologyExpanded = useUIStore((s) => s.toggleGeologyExpanded)
  const setPanel = useUIStore((s) => s.setPanel)

  return (
    <div className="max-w-4xl mx-auto bg-card rounded-xl border border-theme/30 shadow-md flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-theme/20 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider">3D Geological Structural Model</h1>
          <p className="text-xs text-muted font-mono mt-1">
            {model.zones.length} zone{model.zones.length !== 1 ? 's' : ''} · {model.faults.length} fault{model.faults.length !== 1 ? 's' : ''}
            · {(model.modelWidthM / 1000).toFixed(0)} × {(model.modelLengthM / 1000).toFixed(0)} km domain
          </p>
        </div>
        <button
          onClick={toggleGeologyExpanded}
          className="px-3 py-1.5 rounded-lg border border-theme/30 bg-tertiary/20 text-muted hover:text-secondary font-mono text-[10px] font-bold flex items-center gap-1.5 transition uppercase tracking-wider"
          title={geologyExpanded ? "Collapse to Sidebar" : "Expand to wide view"}
        >
          {geologyExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          {geologyExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-theme/20 shrink-0 bg-tertiary/10">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono font-bold transition border-b-2
              ${activeTab === id
                ? 'border-accent text-accent bg-card'
                : 'border-transparent text-muted hover:text-secondary'
              }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-[350px] p-5">
        {activeTab === 'stratigraphy' && <StratigraphyTab />}
        {activeTab === 'faults' && <FaultsTab />}
        {activeTab === 'preview' && <PropertyPreviewTab />}
      </div>

      {/* Grid Resolution Controls */}
      <div className="border-t border-theme/20 p-5 bg-tertiary/5 rounded-b-xl">
        <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider mb-3">Grid Resolution &amp; Discretization</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {([
            { label: 'NX (Columns)', key: 'nx' as const, value: gridNx, min: 5, max: 100 },
            { label: 'NY (Rows)',    key: 'ny' as const, value: gridNy, min: 5, max: 100 },
            { label: 'NZ (Layers)',  key: 'nz' as const, value: gridNz, min: 4, max: 30  },
          ] as const).map(({ label, key, value, min, max }) => (
            <div key={key} className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-secondary">
                <span>{label}</span>
                <span className="font-bold text-accent">{value}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={key === 'nz' ? 2 : 5}
                value={value}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  setGridDimensions(
                    key === 'nx' ? v : gridNx,
                    key === 'ny' ? v : gridNy,
                    key === 'nz' ? v : gridNz,
                  )
                }}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs font-mono text-muted/60 mt-3 pt-3 border-t border-theme/10">
          <span>Total Computational Grid Cells:</span>
          <span className="font-bold text-secondary">
            {(gridNx * gridNy * gridNz).toLocaleString()} cells (Max recommended: 300,000 for web execution)
          </span>
        </div>
      </div>

      {/* Proceed gate */}
      <div className="border-t border-theme mt-4 pt-3 px-5 pb-5">
        <button
          onClick={() => setPanel('geomechanics')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold font-mono transition bg-blue-600 hover:bg-blue-500 text-white"
        >
          <ChevronRight size={13} />
          Geology Reviewed — Continue to Geomechanics →
        </button>
      </div>
    </div>
  )
}
