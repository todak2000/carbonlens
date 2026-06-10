import { useMemo } from 'react'
import { useGeologicalStore } from '../../store/geologicalStore'
import { LITHOLOGY_DEFAULTS } from '../../data/lithologyDefaults'

const BAR_WIDTH = 180
const ROW_H = 22

export default function PropertyPreviewTab() {
  const { model } = useGeologicalStore()

  const sortedZones = useMemo(() =>
    [...model.zones].sort((a, b) => a.topDepth - b.topDepth),
    [model.zones]
  )

  if (sortedZones.length === 0) {
    return (
      <div className="text-center py-8 text-muted text-[11px] font-mono">
        Add zones in the Stratigraphy tab to see the property preview.
      </div>
    )
  }

  const allDepths = sortedZones.flatMap((z) => [z.topDepth, z.topDepth + z.thickness])
  const minDepth = Math.min(...allDepths)
  const maxDepth = Math.max(...allDepths)

  const maxK = Math.max(...sortedZones.map((z) => z.kHorizontal), 1)
  const maxPhi = Math.max(...sortedZones.map((z) => z.porosityMean), 0.01)

  const svgH = sortedZones.length * ROW_H + 30

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] font-mono text-muted uppercase tracking-wider">Formation Column Preview</p>

      <div className="overflow-x-auto">
        <svg width={BAR_WIDTH * 3 + 80} height={svgH} className="font-mono">
          {/* Headers */}
          <text x="40" y="14" fontSize="8" fill="#9ca3af">Lithology</text>
          <text x={40 + BAR_WIDTH + 10} y="14" fontSize="8" fill="#9ca3af">Porosity</text>
          <text x={40 + BAR_WIDTH * 2 + 20} y="14" fontSize="8" fill="#9ca3af">k_h (mD)</text>

          {sortedZones.map((zone, i) => {
            const y = 20 + i * ROW_H
            const lithDef = LITHOLOGY_DEFAULTS[zone.lithology]
            const phiBarW = (zone.porosityMean / maxPhi) * (BAR_WIDTH - 10)
            const kBarW = (zone.kHorizontal / maxK) * (BAR_WIDTH - 10)
            const depthLabel = `${zone.topDepth}m`

            return (
              <g key={zone.id}>
                {/* Depth label */}
                <text x="0" y={y + 14} fontSize="7" fill="#6b7280">{depthLabel}</text>

                {/* Lithology block */}
                <rect x="38" y={y + 1} width={BAR_WIDTH} height={ROW_H - 3} fill={zone.color} opacity={0.7} rx="2" />
                <text x="44" y={y + 14} fontSize="7.5" fill="#1f2937" fontWeight="600">{zone.name}</text>
                <text x="44" y={y + 20} fontSize="6.5" fill="#374151">{lithDef.label}</text>

                {/* Porosity bar */}
                <rect x={40 + BAR_WIDTH + 8} y={y + 4} width={BAR_WIDTH - 10} height={ROW_H - 10} fill="#1e3a5f" opacity={0.3} rx="2" />
                <rect x={40 + BAR_WIDTH + 8} y={y + 4} width={phiBarW} height={ROW_H - 10} fill="#3b82f6" opacity={0.8} rx="2" />
                <text x={40 + BAR_WIDTH + 8 + phiBarW + 3} y={y + 14} fontSize="7" fill="#9ca3af">
                  {(zone.porosityMean * 100).toFixed(1)}%
                </text>

                {/* Permeability bar */}
                <rect x={40 + BAR_WIDTH * 2 + 18} y={y + 4} width={BAR_WIDTH - 10} height={ROW_H - 10} fill="#1e3a5f" opacity={0.3} rx="2" />
                <rect x={40 + BAR_WIDTH * 2 + 18} y={y + 4} width={kBarW} height={ROW_H - 10} fill="#10b981" opacity={0.8} rx="2" />
                <text x={40 + BAR_WIDTH * 2 + 18 + kBarW + 3} y={y + 14} fontSize="7" fill="#9ca3af">
                  {zone.kHorizontal >= 1 ? zone.kHorizontal.toFixed(0) : zone.kHorizontal.toFixed(3)}
                </text>

                {/* Caprock indicator */}
                {zone.isCaprock && (
                  <text x={40 + BAR_WIDTH - 30} y={y + 14} fontSize="6.5" fill="#60a5fa">SEAL</text>
                )}
              </g>
            )
          })}

          {/* Bottom depth */}
          <text x="0" y={20 + sortedZones.length * ROW_H + 12} fontSize="7" fill="#6b7280">{maxDepth}m</text>
        </svg>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-theme pt-3">
        <p className="text-[10px] font-mono text-muted uppercase tracking-wider">Summary</p>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-card rounded px-2 py-1.5">
            <p className="text-[9px] text-muted font-mono">Total Gross Thickness</p>
            <p className="text-xs font-mono text-primary">
              {sortedZones.reduce((s, z) => s + z.thickness, 0).toFixed(0)} m
            </p>
          </div>
          <div className="bg-card rounded px-2 py-1.5">
            <p className="text-[9px] text-muted font-mono">Reservoir Zones</p>
            <p className="text-xs font-mono text-primary">
              {sortedZones.filter((z) => z.activeForInjection).length} / {sortedZones.length}
            </p>
          </div>
          <div className="bg-card rounded px-2 py-1.5">
            <p className="text-[9px] text-muted font-mono">Faults Defined</p>
            <p className="text-xs font-mono text-primary">{model.faults.length}</p>
          </div>
          <div className="bg-card rounded px-2 py-1.5">
            <p className="text-[9px] text-muted font-mono">Depth Range</p>
            <p className="text-xs font-mono text-primary">{minDepth}–{maxDepth} m</p>
          </div>
        </div>
      </div>
    </div>
  )
}
