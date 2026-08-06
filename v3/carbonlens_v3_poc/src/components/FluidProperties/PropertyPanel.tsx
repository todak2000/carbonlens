import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import PropertyRow from './PropertyRow'

export default function PropertyPanel() {
  const params = useFormationStore((s) => s.params)
  const status = useSimulationStore((s) => s.status)
  const result = useSimulationStore((s) => s.result)

  return (
    <div className="w-full space-y-5 bg-card rounded-xl border border-theme/30 shadow-md p-4 md:p-5">
      <div>
        <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider">Fluid &amp; Reservoir Properties</h1>
        <p className="text-xs text-muted font-mono mt-0.5">Thermodynamic states, lithology defaults, and transport parameters</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-2">
        {/* Reservoir State Column */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-1">
            Reservoir State &amp; Geometry
          </h3>
          <div className="space-y-2">
            <PropertyRow label="Depth" value={`${params.depth} m`} />
            <PropertyRow label="Thickness" value={`${params.thickness} m`} />
            <PropertyRow label="Temperature" value={`${params.temperature} °C`} />
            <PropertyRow label="Pore Pressure" value={`${params.pressure} MPa`} />
            <PropertyRow label="Reservoir Area" value={`${params.area} km²`} />
            <PropertyRow label="Geometry Trap Type" value={<span className="capitalize">{params.geometryType}</span>} />
          </div>
        </div>

        {/* Rock & Brine Composition Column */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-1">
            Rock &amp; Brine Composition
          </h3>
          <div className="space-y-2">
            <PropertyRow label="Porosity" value={`${(params.porosity * 100).toFixed(1)} %`} />
            <PropertyRow label="Permeability" value={`${params.permeability} mD`} />
            <PropertyRow label="Net-to-Gross (NTG)" value={`${(params.netToGross * 100).toFixed(0)} %`} />
            <PropertyRow label="Salt Type" value={<span className="uppercase">{params.saltType}</span>} />
            <PropertyRow label="Salinity (Monovalent)" value={`${params.monovalentSalinity} mol/kg`} />
            <PropertyRow label="Salinity (Bivalent)" value={`${params.bivalentSalinity} mol/kg`} />
            <PropertyRow label="Methane (CH₄) Fraction" value={`${(params.methaneFraction * 100).toFixed(1)} %`} />
            <PropertyRow label="Nitrogen (N₂) Fraction" value={`${(params.nitrogenFraction * 100).toFixed(1)} %`} />
          </div>
        </div>
      </div>

      {status === 'complete' && result && (
        <div className="pt-6 border-t border-theme/30 space-y-4">
          <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-1">
            Estimated Simulation Results
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
            <PropertyRow label="Stored CO₂ Plume" value={`${result.storageCapacity.toFixed(2)} Mt`} />
            <PropertyRow label="Interfacial Tension (IFT)" value={result.ift !== null ? `${result.ift.toFixed(2)} mN/m` : 'N/A'} />
            
            {result.adAssessment && (
              <div className="flex items-center justify-between py-1 border-b border-theme/10">
                <span className="text-sm text-secondary font-mono">MARS Applicability Gate</span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        result.adAssessment.status === 'green' ? '#22c55e' :
                        result.adAssessment.status === 'yellow' ? '#eab308' : '#ef4444',
                    }}
                  />
                  <span className="text-sm font-mono text-secondary capitalize font-semibold font-mono">
                    {result.adAssessment.status}
                  </span>
                </span>
              </div>
            )}

            {result.adAssessment && (
              <PropertyRow
                label="IFT PI90 Confidence Boundary"
                value={`± ${result.adAssessment.pi_halfwidth.toFixed(2)} mN/m`}
              />
            )}

            <PropertyRow label="Plume Radius" value={`${result.plumeRadius.toFixed(1)} m`} />
            <PropertyRow label="Containment Confidence" value={`${(result.containmentProbability * 100).toFixed(0)} %`} />
            <PropertyRow label="DOE P50 Capacity Limit" value={`${result.p50.toFixed(1)} Mt`} />
            <PropertyRow label="DOE P90 / P10 Range" value={`${result.p90.toFixed(1)} - ${result.p10.toFixed(1)} Mt`} />
          </div>
        </div>
      )}
    </div>
  )
}
