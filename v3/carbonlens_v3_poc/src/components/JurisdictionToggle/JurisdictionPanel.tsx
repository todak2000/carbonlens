import { useUIStore } from '../../store/uiStore'
import { Jurisdiction } from '../../types'

const jurisdictions: { value: Jurisdiction; label: string; flag: string }[] = [
  { value: 'US', label: 'EPA UIC Class VI', flag: '\u{1F1FA}\u{1F1F8}' },
  { value: 'EU', label: 'EU CCS Directive', flag: '\u{1F1EA}\u{1F1FA}' },
  { value: 'Malaysia', label: 'PETRONAS CCS', flag: '\u{1F1F2}\u{1F1FE}' },
  { value: 'Australia', label: 'Offshore GHG Storage', flag: '\u{1F1E6}\u{1F1FA}' },
  { value: 'Norway', label: 'Norwegian CO2 Storage', flag: '\u{1F1F3}\u{1F1F4}' },
]

const requirements: Record<Jurisdiction, string[]> = {
  US: ['UIC Class VI permit required', 'AOI delineation', 'PLUM evaluation', '36-month monitoring plan', 'Financial assurance'],
  EU: ['Storage permit per Directive 2009/31/EC', 'Characterization report', 'Risk assessment', 'Monitoring plan', 'CO2 stream composition'],
  Malaysia: ['PETRONAS CCS Guideline', 'Safety case', 'Hazard identification', 'Containment assurance', 'Decommissioning plan'],
  Australia: ['Offshore GHG Storage Act', 'Site plan', 'Well integrity', 'Monitoring program', 'Closure plan'],
  Norway: ['CO2 Storage Regulations', 'Exploration license', 'Storage permit', 'Annual reporting', 'Long-term liability transfer'],
}

export default function JurisdictionPanel() {
  const jurisdiction = useUIStore((s) => s.jurisdiction)
  const setJurisdiction = useUIStore((s) => s.setJurisdiction)
  const reqs = requirements[jurisdiction] ?? []

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider">Jurisdiction</h2>
      <div className="space-y-1">
        {jurisdictions.map((j) => (
          <button key={j.value} onClick={() => setJurisdiction(j.value)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-mono transition ${jurisdiction === j.value ? 'bg-accent text-white' : 'bg-tertiary text-muted hover:text-secondary'}`}
          >
            <span className="text-base">{j.flag}</span>
            <div className="text-left"><div className="font-medium">{j.label}</div></div>
          </button>
        ))}
      </div>
      <div className="pt-2">
        <h3 className="text-[10px] text-muted font-mono mb-2 uppercase tracking-wider">Requirements</h3>
        <ul className="space-y-1">
          {reqs.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-muted font-mono">
              <span className="text-accent mt-0.5">&#x2022;</span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
