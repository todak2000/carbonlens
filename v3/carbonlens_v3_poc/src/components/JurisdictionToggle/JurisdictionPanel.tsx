import { useUIStore } from '../../store/uiStore'
import { Jurisdiction } from '../../types'
import { Scale, CheckCircle2 } from 'lucide-react'

const jurisdictions: { value: Jurisdiction; label: string; flag: string; description: string }[] = [
  { value: 'US', label: 'EPA UIC Class VI', flag: '\u{1F1FA}\u{1F1F8}', description: 'United States Environmental Protection Agency framework' },
  { value: 'EU', label: 'EU CCS Directive', flag: '\u{1F1EA}\u{1F1FA}', description: 'European Union Geological Storage of Carbon Dioxide framework Directive 2009/31/EC' },
  { value: 'Norway', label: 'Norwegian CO₂ Storage', flag: '\u{1F1F3}\u{1F1F4}', description: 'Norwegian Petroleum Directorate rules for continental shelf storage' },
  { value: 'Australia', label: 'Offshore GHG Storage Act', flag: '\u{1F1E6}\u{1F1FA}', description: 'Commonwealth Offshore Greenhouse Gas Storage regulatory framework' },
  { value: 'Malaysia', label: 'PETRONAS CCS Guidelines', flag: '\u{1F1F2}\u{1F1FE}', description: 'PETRONAS rules for offshore carbon storage and asset lifecycle management' },
]

const requirements: Record<Jurisdiction, string[]> = {
  US: [
    'UIC Class VI Permit Application & Well Construction Approval',
    'Area of Review (AoR) computational delineation and dynamic modeling',
    'Post-Injection Site Care (PISC) & site closure plans (minimum 50 years)',
    'Financial Responsibility & Assurance demonstration (well plugging/monitoring)',
    'Testing and Monitoring Program (well integrity, seismic, pressure tomography)',
  ],
  EU: [
    'Storage Permit per Directive 2009/31/EC',
    'Detailed Site Characterization & complex geological model description',
    'Corrective Action Plan for leakage risk management',
    'Post-Closure Monitoring and transfer of liability (minimum 20 years)',
    'CO₂ stream purity verification (no waste streams or toxic solvents)',
  ],
  Norway: [
    'Norwegian CO₂ Storage Regulations compliance license',
    'Exploration License & Storage Permit (NPD/MPE approval)',
    'Annual injection rates and migration plume validation reporting',
    'Long-term post-injection monitoring program (4D seismic, seafloor bathymetry)',
    'Financial security provision for monitoring and eventual decommissioning',
  ],
  Australia: [
    'Offshore GHG Storage Act (NOPSEMA approval)',
    'GHG Injection License & dynamic site plan validation',
    'Risk assessment of wellbore corrosion and thermal stress fractures',
    'Post-Injection Monitoring program (AEM/microseismic arrays)',
    'Site closing certificate and long-term security plan',
  ],
  Malaysia: [
    'PETRONAS CCS Guideline compliance certificate',
    'Safety Case regime & offshore risk identification report (ALARP)',
    'Well Integrity Management System (WIMS) audit report',
    'Carbon credit registry mapping & emission avoidance certification',
    'Offshore decommissioning fund contribution agreement',
  ],
}

export default function JurisdictionPanel() {
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const setJurisdiction = useUIStore((s) => s.setJurisdiction)
  const reqs = requirements[jurisdiction] ?? []

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme/20 pb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <Scale size={20} className="text-accent" /> Regulatory Jurisdiction Framework
          </h1>
          <p className="text-xs text-muted font-mono mt-0.5">
            Select standard regulatory frameworks to auto-configure compliance checklists
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Select framework (60% width equivalent: col-span-7) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-accent uppercase tracking-wider border-b border-theme/10 pb-2">
              Select Jurisdiction
            </h3>
            <div className="space-y-2">
              {jurisdictions.map((j) => (
                <button
                  key={j.value}
                  onClick={() => setJurisdiction(j.value)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg border text-sm font-mono transition ${
                    jurisdiction === j.value
                      ? 'border-accent bg-accent/15 text-accent font-bold'
                      : 'border-theme/30 bg-tertiary/20 text-muted hover:text-secondary'
                  }`}
                >
                  <span className="text-2xl">{j.flag}</span>
                  <div className="text-left">
                    <div className="font-bold text-primary">{j.label}</div>
                    <div className="text-[10px] text-muted leading-tight mt-0.5">{j.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Requirements checklist (40% width: col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-theme/30 bg-card p-5 space-y-4 shadow-md">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-theme/10 pb-2">
              Regulatory Compliance Checklist
            </h3>
            <ul className="space-y-3">
              {reqs.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-secondary leading-relaxed font-mono">
                  <CheckCircle2 size={15} className="text-accent shrink-0 mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
