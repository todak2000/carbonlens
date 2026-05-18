import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import PropertyRow from './PropertyRow'

export default function PropertyPanel() {
  const params = useFormationStore((s) => s.params)
  const status = useSimulationStore((s) => s.status)
  const result = useSimulationStore((s) => s.result)

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider">Fluid Properties</h2>
      <div className="space-y-1.5">
        <PropertyRow label="Temperature" value={`${params.temperature} °C`} />
        <PropertyRow label="Pressure" value={`${params.pressure} MPa`} />
        <PropertyRow label="Depth" value={`${params.depth} m`} />
        <PropertyRow label="Thickness" value={`${params.thickness} m`} />
        <PropertyRow label="Porosity" value={`${(params.porosity * 100).toFixed(1)} %`} />
        <PropertyRow label="Permeability" value={`${params.permeability} mD`} />
        <PropertyRow label="Area" value={`${params.area} km²`} />
        <PropertyRow label="Net-to-Gross" value={`${(params.netToGross * 100).toFixed(0)} %`} />
        <PropertyRow label="Geometry" value={params.geometryType} />
        <PropertyRow label="Salinity (Mono)" value={`${params.monovalentSalinity} mol/kg`} />
        <PropertyRow label="Salinity (Bi)" value={`${params.bivalentSalinity} mol/kg`} />
        <PropertyRow label="Salt Type" value={params.saltType} />
        <PropertyRow label="CH4 Fraction" value={`${(params.methaneFraction * 100).toFixed(1)} %`} />
        <PropertyRow label="N2 Fraction" value={`${(params.nitrogenFraction * 100).toFixed(1)} %`} />
      </div>
      {status === 'complete' && result && (
        <div className="pt-3 border-t border-theme space-y-1.5">
          <h3 className="text-[10px] text-muted font-mono uppercase tracking-wider">Simulation Results</h3>
          <PropertyRow label="Storage Capacity" value={`${result.storageCapacity.toFixed(1)} Mt`} />
          <PropertyRow label="IFT" value={result.ift !== null ? `${result.ift.toFixed(2)} mN/m` : 'N/A'} />
          <PropertyRow label="Plume Radius" value={`${result.plumeRadius.toFixed(1)} m`} />
          <PropertyRow label="Containment" value={`${(result.containmentProbability * 100).toFixed(0)} %`} />
          <PropertyRow label="P50 Capacity" value={`${result.p50.toFixed(1)} Mt`} />
          <PropertyRow label="P10 / P90" value={`${result.p10.toFixed(1)} / ${result.p90.toFixed(1)} Mt`} />
        </div>
      )}
    </div>
  )
}
