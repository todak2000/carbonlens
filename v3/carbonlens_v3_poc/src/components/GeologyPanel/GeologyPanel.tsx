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
  const { model } = useGeologicalStore()

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
    </div>
  )
}
