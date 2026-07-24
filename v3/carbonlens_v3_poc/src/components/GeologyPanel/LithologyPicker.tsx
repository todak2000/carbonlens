import { LithologyType } from '../../types/geological'
import { LITHOLOGY_DEFAULTS, LITHOLOGY_ORDER } from '../../data/lithologyDefaults'

interface Props {
  value: LithologyType
  onChange: (l: LithologyType) => void
}

export default function LithologyPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {LITHOLOGY_ORDER.map((lith) => {
        const d = LITHOLOGY_DEFAULTS[lith]
        const active = value === lith
        return (
          <button
            key={lith}
            onClick={() => onChange(lith)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition
              ${active
                ? 'border-accent bg-accent/10 text-primary'
                : 'border-theme bg-card text-muted hover:border-accent/40 hover:text-secondary'
              }`}
          >
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-xs font-mono truncate">{d.label}</span>
          </button>
        )
      })}
    </div>
  )
}
