import { useState } from 'react'
import { Layers, GitBranch, BarChart2 } from 'lucide-react'
import StratigraphyTab from './StratigraphyTab'
import FaultsTab from './FaultsTab'
import PropertyPreviewTab from './PropertyPreviewTab'
import { useGeologicalStore } from '../../store/geologicalStore'

type Tab = 'stratigraphy' | 'faults' | 'preview'

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'stratigraphy', label: 'Stratigraphy', Icon: Layers },
  { id: 'faults', label: 'Faults', Icon: GitBranch },
  { id: 'preview', label: 'Properties', Icon: BarChart2 },
]

export default function GeologyPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('stratigraphy')
  const { model, gridNx, gridNy, gridNz, setGridDimensions } = useGeologicalStore()

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-theme shrink-0">
        <h2 className="text-sm font-semibold text-primary font-mono">Geological Model</h2>
        <p className="text-[10px] text-muted mt-0.5">
          {model.zones.length} zone{model.zones.length !== 1 ? 's' : ''} · {model.faults.length} fault{model.faults.length !== 1 ? 's' : ''}
          · {(model.modelWidthM / 1000).toFixed(0)}×{(model.modelLengthM / 1000).toFixed(0)} km
        </p>
      </div>

      <div className="flex border-b border-theme shrink-0">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-mono transition border-b-2
              ${activeTab === id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-secondary'
              }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {activeTab === 'stratigraphy' && <StratigraphyTab />}
        {activeTab === 'faults' && <FaultsTab />}
        {activeTab === 'preview' && <PropertyPreviewTab />}
      </div>

      {/* Grid Resolution */}
      <div className="border-t border-theme/20 pt-2 mt-2 px-3 pb-2">
        <p className="text-[9px] font-mono text-muted uppercase tracking-wider mb-1.5">Grid Resolution</p>
        <div className="space-y-1.5">
          {([
            { label: 'NX (columns)', key: 'nx' as const, value: gridNx, min: 5, max: 100 },
            { label: 'NY (rows)',    key: 'ny' as const, value: gridNy, min: 5, max: 100 },
            { label: 'NZ (layers)', key: 'nz' as const, value: gridNz, min: 4, max: 30  },
          ] as const).map(({ label, key, value, min, max }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-muted w-24 shrink-0">{label}</span>
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
                className="flex-1 h-1 accent-accent"
              />
              <span className="text-[9px] font-mono text-secondary w-6 text-right">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-[8px] font-mono text-muted/50 mt-1">
          {(gridNx * gridNy * gridNz).toLocaleString()} cells · max 300,000
        </p>
      </div>
    </div>
  )
}
