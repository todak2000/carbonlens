import { StorageProject } from '../../types'
import { Mountain, Trash2 } from 'lucide-react'

interface Props {
  project: StorageProject
  onOpen: () => void
  onDelete: () => void
}

export default function ProjectCard({ project, onOpen, onDelete }: Props) {
  const age = Math.floor((Date.now() - project.createdAt) / 86400000)
  return (
    <div className="rounded bg-card border border-theme p-3 md:p-4 hover:border-accent/30 transition cursor-pointer active:bg-tertiary" onClick={onOpen}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <h3 className="font-medium text-primary font-mono text-sm truncate">{project.name}</h3>
          <p className="text-[10px] text-muted font-mono">{age === 0 ? 'Today' : `${age}d ago`}</p>
        </div>
        <Mountain size={16} className="text-muted shrink-0 ml-2" />
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] text-muted font-mono mt-3">
        <span>{project.formation.depth}m depth</span>
        <span>{project.formation.porosity * 100}% porosity</span>
        <span className="truncate">{project.formation.geometryType}</span>
      </div>
      <div className="flex items-center justify-between mt-3">
        {project.simulationResult ? (
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${project.simulationResult.containmentProbability > 0.7 ? 'bg-accent-subtle text-accent' : 'bg-amber/20 text-amber'}`}>
            {Math.round(project.simulationResult.containmentProbability * 100)}% containment
          </span>
        ) : (
          <span className="text-[10px] text-muted font-mono">Not simulated</span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="flex items-center gap-1 text-[10px] text-muted hover:text-red-400 font-mono p-1.5 -m-1.5">
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </div>
  )
}
