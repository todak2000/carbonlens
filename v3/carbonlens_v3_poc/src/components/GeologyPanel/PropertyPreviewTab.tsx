import { useMemo } from 'react'
import { useGeologicalStore } from '../../store/geologicalStore'
import { LITHOLOGY_DEFAULTS } from '../../data/lithologyDefaults'

const BAR_WIDTH = 240
const ROW_H = 36

export default function PropertyPreviewTab() {
  const { model } = useGeologicalStore()

  const sortedZones = useMemo(() =>
    [...model.zones].sort((a, b) => a.topDepth - b.topDepth),
    [model.zones]
  )

  if (sortedZones.length === 0) {
    return (
      <div className="text-center py-8 text-muted text-sm font-mono">
        Add zones in the Stratigraphy tab to see the property preview.
      </div>
    )
  }

  const allDepths = sortedZones.flatMap((z) => [z.topDepth, z.topDepth + z.thickness])
  const minDepth = Math.min(...allDepths)
  const maxDepth = Math.max(...allDepths)

  const maxK = Math.max(...sortedZones.map((z) => z.kHorizontal), 1)
  const maxPhi = Math.max(...sortedZones.map((z) => z.porosityMean), 0.01)

  const svgH = sortedZones.length * ROW_H + 40

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2">
        Formation Column Preview
      </h3>

      <div className="overflow-x-auto bg-page/40 p-3 rounded-lg border border-theme/20">
        <svg width={BAR_WIDTH * 3 + 120} height={svgH} className="font-mono">
          {/* Headers */}
          <text x="50" y="16" fontSize="11" fill="#9ca3af" fontWeight="600">Lithology / Layer</text>
          <text x={50 + BAR_WIDTH + 15} y="16" fontSize="11" fill="#9ca3af" fontWeight="600">Porosity Mean</text>
          <text x={50 + BAR_WIDTH * 2 + 30} y="16" fontSize="11" fill="#9ca3af" fontWeight="600">k_h (mD)</text>

          {sortedZones.map((zone, i) => {
            const y = 28 + i * ROW_H
            const lithDef = LITHOLOGY_DEFAULTS[zone.lithology]
            const phiBarW = (zone.porosityMean / maxPhi) * (BAR_WIDTH - 20)
            const kBarW = (zone.kHorizontal / maxK) * (BAR_WIDTH - 20)
            const depthLabel = `${zone.topDepth}m`

            return (
              <g key={zone.id}>
                {/* Depth label */}
                <text x="0" y={y + 20} fontSize="10" fill="#9ca3af" fontWeight="bold">{depthLabel}</text>

                {/* Lithology block */}
                <rect x="48" y={y + 2} width={BAR_WIDTH} height={ROW_H - 4} fill={zone.color} opacity={0.7} rx="3" />
                <text x="56" y={y + 16} fontSize="11" fill="#1f2937" fontWeight="bold">{zone.name}</text>
                <text x="56" y={y + 26} fontSize="9" fill="#374151" fontWeight="600">{lithDef.label}</text>

                {/* Porosity bar */}
                <rect x={48 + BAR_WIDTH + 12} y={y + 6} width={BAR_WIDTH - 20} height={ROW_H - 12} fill="#1e3a5f" opacity={0.3} rx="3" />
                <rect x={48 + BAR_WIDTH + 12} y={y + 6} width={phiBarW} height={ROW_H - 12} fill="#3b82f6" opacity={0.8} rx="3" />
                <text x={48 + BAR_WIDTH + 12 + phiBarW + 5} y={y + 20} fontSize="10" fill="#e5e7eb" fontWeight="bold">
                  {(zone.porosityMean * 100).toFixed(1)}%
                </text>

                {/* Permeability bar */}
                <rect x={48 + BAR_WIDTH * 2 + 24} y={y + 6} width={BAR_WIDTH - 20} height={ROW_H - 12} fill="#1e3a5f" opacity={0.3} rx="3" />
                <rect x={48 + BAR_WIDTH * 2 + 24} y={y + 6} width={kBarW} height={ROW_H - 12} fill="#10b981" opacity={0.8} rx="3" />
                <text x={48 + BAR_WIDTH * 2 + 24 + kBarW + 5} y={y + 20} fontSize="10" fill="#e5e7eb" fontWeight="bold">
                  {zone.kHorizontal >= 1 ? zone.kHorizontal.toFixed(0) : zone.kHorizontal.toFixed(3)}
                </text>

                {/* Caprock indicator */}
                {zone.isCaprock && (
                  <text x={48 + BAR_WIDTH - 45} y={y + 20} fontSize="9.5" fill="#f87171" fontWeight="bold">SEAL</text>
                )}
              </g>
            )
          })}

          {/* Bottom depth */}
          <text x="0" y={28 + sortedZones.length * ROW_H + 12} fontSize="10" fill="#9ca3af" fontWeight="bold">{maxDepth}m</text>
        </svg>
      </div>

      <div className="flex flex-col gap-3 border-t border-theme/20 pt-4">
        <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider">
          Stratigraphic Summary
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-lg p-3 border border-theme/20">
            <p className="text-xs text-muted font-mono uppercase tracking-wider mb-0.5">Total Gross Thickness</p>
            <p className="text-base font-mono text-primary font-bold">
              {sortedZones.reduce((s, z) => s + z.thickness, 0).toFixed(0)} m
            </p>
          </div>
          <div className="bg-card rounded-lg p-3 border border-theme/20">
            <p className="text-xs text-muted font-mono uppercase tracking-wider mb-0.5">Reservoir Zones</p>
            <p className="text-base font-mono text-primary font-bold">
              {sortedZones.filter((z) => z.activeForInjection).length} / {sortedZones.length}
            </p>
          </div>
          <div className="bg-card rounded-lg p-3 border border-theme/20">
            <p className="text-xs text-muted font-mono uppercase tracking-wider mb-0.5">Faults Defined</p>
            <p className="text-base font-mono text-primary font-bold">{model.faults.length}</p>
          </div>
          <div className="bg-card rounded-lg p-3 border border-theme/20">
            <p className="text-xs text-muted font-mono uppercase tracking-wider mb-0.5">Depth Range</p>
            <p className="text-base font-mono text-primary font-bold">{minDepth}–{maxDepth} m</p>
          </div>
        </div>
      </div>
    </div>
  )
}
