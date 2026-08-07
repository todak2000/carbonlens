import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, FlaskConical, ShieldCheck, AlertCircle } from 'lucide-react'
import { METHODOLOGY, MARS_ATTRIBUTION, PROTOTYPE_SCOPE } from '../../data/methodology'

// ── Small sub-components ───────────────────────────────────────────────────────

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'green' | 'amber' | 'default' }) {
  const cls = variant === 'green'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : variant === 'amber'
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-white/5 text-muted border-white/10'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border ${cls}`}>
      {children}
    </span>
  )
}

// ── ML Attribution card ────────────────────────────────────────────────────────

function MarsAttributionCard() {
  const [open, setOpen] = useState(true)
  const a = MARS_ATTRIBUTION
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-emerald-500/10 transition"
      >
        <div className="flex items-center gap-2">
          <FlaskConical size={12} className="text-emerald-400 shrink-0" />
          <div className="text-left">
            <div className="text-[11px] font-mono font-semibold text-emerald-300">{a.title}</div>
            <div className="text-[9px] text-emerald-400/70 font-mono">{a.subtitle}</div>
          </div>
        </div>
        {open ? <ChevronDown size={11} className="text-emerald-400/60 shrink-0" /> : <ChevronRight size={11} className="text-emerald-400/60 shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-emerald-500/20">
          {/* Author / institution */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2.5">
            <div>
              <div className="text-[8px] text-emerald-400/60 font-mono uppercase tracking-wider">Author</div>
              <div className="text-[10px] text-primary font-mono">{a.author}</div>
            </div>
            <div>
              <div className="text-[8px] text-emerald-400/60 font-mono uppercase tracking-wider">Institution</div>
              <div className="text-[10px] text-primary font-mono">{a.institution}</div>
            </div>
            <div>
              <div className="text-[8px] text-emerald-400/60 font-mono uppercase tracking-wider">Status</div>
              <Badge variant="amber">{a.status}</Badge>
            </div>
          </div>

          {/* Dataset */}
          <div>
            <div className="text-[8px] text-emerald-400/60 font-mono uppercase tracking-wider mb-0.5">Dataset</div>
            <div className="text-[9px] text-muted font-mono leading-relaxed">{a.dataset}</div>
          </div>

          {/* Framework */}
          <div>
            <div className="text-[8px] text-emerald-400/60 font-mono uppercase tracking-wider mb-0.5">Validation Framework</div>
            <div className="text-[9px] text-muted font-mono leading-relaxed">{a.framework}</div>
          </div>

          {/* Key finding — rank inversion */}
          <div className="rounded bg-card border border-theme p-2">
            <div className="text-[8px] text-emerald-400/60 font-mono uppercase tracking-wider mb-1">Key Finding — Rank Inversion</div>
            {a.finding.split('\n').map((line, i) => (
              <div key={i} className="text-[10px] font-mono leading-relaxed text-secondary">{line}</div>
            ))}
          </div>

          {/* Model specs */}
          <div>
            <div className="text-[8px] text-emerald-400/60 font-mono uppercase tracking-wider mb-1">Deployed Models</div>
            <div className="space-y-1">
              {a.models.map((m) => (
                <div key={m.regime} className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-muted">{m.regime}</span>
                  <span className="text-primary">{m.terms} terms · intercept {m.intercept}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Uncertainty */}
          <div>
            <div className="text-[8px] text-emerald-400/60 font-mono uppercase tracking-wider mb-0.5">Uncertainty Quantification</div>
            <div className="text-[9px] text-muted font-mono leading-relaxed">{a.uncertainty}</div>
          </div>

          {/* Scope note */}
          <div className="flex items-start gap-1.5 rounded bg-amber-500/5 border border-amber-500/20 px-2 py-1.5">
            <AlertCircle size={10} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[9px] text-amber-300/80 font-mono leading-relaxed">{a.scopeNote}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Prototype scope / research boundary card ───────────────────────────────────

function PrototypeScopeCard() {
  const [open, setOpen] = useState(false)
  const s = PROTOTYPE_SCOPE
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={12} className="text-muted shrink-0" />
          <span className="text-[11px] font-mono font-semibold text-secondary">{s.title}</span>
        </div>
        {open ? <ChevronDown size={11} className="text-muted shrink-0" /> : <ChevronRight size={11} className="text-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-theme">
          {/* ML components */}
          <div className="pt-2.5">
            <div className="text-[8px] text-muted font-mono uppercase tracking-wider mb-1.5">ML Components (Olagunju et al., 2026)</div>
            <div className="space-y-1">
              {s.mlComponents.map((c) => (
                <div key={c.property} className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono text-secondary">{c.property}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-muted">{c.model}</span>
                    <Badge variant="green">deployed</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Classical components */}
          <div>
            <div className="text-[8px] text-muted font-mono uppercase tracking-wider mb-1.5">Classical Correlations (Peer-Reviewed Literature)</div>
            <div className="space-y-1">
              {s.classicalComponents.map((c) => (
                <div key={c.property} className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono text-secondary">{c.property}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-muted">{c.model}</span>
                    {c.phd && <Badge variant="amber">PhD ★</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PhD note */}
          <div className="text-[9px] text-muted/70 font-mono leading-relaxed border-t border-theme pt-2">
            {s.phdNote}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Benchmark validation summary (always-visible strip) ────────────────────────

function ValidationStrip() {
  return (
    <div className="rounded-lg border border-theme bg-card/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <ShieldCheck size={11} className="text-emerald-400" />
        <span className="text-[9px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">Benchmark Validation</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { site: 'Sleipner (Norway)', stat: 'Plume radius ±8%', sub: 'Dissolution ≤ 2.7%/yr ✓' },
          { site: 'SPE11A benchmark', stat: 'Cc within spec.', sub: 'Immiscible fraction 0.15–0.22 ✓' },
        ].map((v) => (
          <div key={v.site} className="rounded bg-card border border-theme/50 px-2 py-1.5">
            <div className="text-[9px] font-mono font-semibold text-primary">{v.site}</div>
            <div className="text-[9px] font-mono text-emerald-400">{v.stat}</div>
            <div className="text-[8px] font-mono text-muted">{v.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function MethodologyPanel() {
  const [expanded, setExpanded] = useState<string | null>('CO\u2082 Density')

  return (
    <div className="w-full space-y-5">
      <h2 className="font-semibold text-primary text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
        <BookOpen size={13} /> Methodology &amp; Academic Attribution
      </h2>

      {/* ML model attribution — top-of-panel, expanded by default */}
      <MarsAttributionCard />

      {/* Benchmark validation summary */}
      <ValidationStrip />

      {/* Physics equations accordion */}
      <div>
        <p className="text-[9px] text-muted font-mono mb-2 uppercase tracking-wider">Physics Equations</p>
        {METHODOLOGY.map((section) => (
          <div key={section.domain} className="rounded border border-theme/30 overflow-hidden mb-1.5">
            <button
              onClick={() => setExpanded(expanded === section.domain ? null : section.domain)}
              className="w-full flex items-center justify-between px-3 py-2 bg-tertiary/30 hover:bg-tertiary/60 transition"
            >
              <span className="text-[11px] font-mono font-semibold text-primary">{section.domain}</span>
              {expanded === section.domain
                ? <ChevronDown size={12} className="text-muted" />
                : <ChevronRight size={12} className="text-muted" />}
            </button>
            {expanded === section.domain && (
              <div className="divide-y divide-theme/20">
                {section.equations.map((eq) => (
                  <div key={eq.name} className="px-3 py-2.5 space-y-1.5">
                    <div className="text-[11px] font-mono font-semibold text-accent">{eq.name}</div>
                    <div className="text-[10px] font-mono text-secondary bg-card/50 rounded px-2 py-1 leading-relaxed">
                      {eq.formula}
                    </div>
                    <div className="text-[9px] text-muted font-mono leading-relaxed">
                      <span className="text-primary/70">Params:</span> {eq.params}
                    </div>
                    <div className="text-[9px] text-muted/70 font-mono leading-relaxed flex items-start gap-1">
                      <ExternalLink size={9} className="shrink-0 mt-0.5 text-muted/50" />
                      {eq.reference}
                    </div>
                    {eq.notes && (
                      <div className="text-[9px] text-warning font-mono leading-relaxed italic">
                        Note: {eq.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prototype scope / research boundary */}
      <PrototypeScopeCard />

      {/* Full reference list */}
      <div className="rounded border border-theme/30 px-3 py-2.5">
        <p className="text-[9px] font-mono font-semibold text-muted uppercase tracking-wider mb-2">Full Reference List</p>
        <ul className="space-y-1">
          {[
            'Olagunju et al. (2026) — MARS CO₂-brine IFT model · CarbonLens™ R&D',
            'Span & Wagner (1996) J. Phys. Chem. Ref. Data 25(6), 1509–1596 — CO₂ EOS',
            'Fenghour et al. (1998) J. Phys. Chem. Ref. Data 27(1), 31–44 — CO₂ viscosity',
            'Duan & Sun (2003) Chem. Geol. 193, 257–271 — CO₂ solubility',
            'Garcia (2001) LBNL-49023 — brine density with dissolved CO₂',
            'Nordbotten, Celia & Bachu (2005) Transp. Porous Media 58(3):339–360 — two-phase composite radial flow (primary pressure model)',
            'Theis (1935) Trans. Am. Geophys. Union 16, 519–524 — single-phase radial flow (wellbore peak-rate validation)',
            'Brooks & Corey (1964) USDA Hydrology Papers 3 — relative permeability',
            'Land (1968) SPE J. 8(2), 149–156 — residual trapping',
            'Biot (1941) J. Appl. Phys. 12, 155–164 — poroelastic coupling',
            'Hubbert & Willis (1957) Trans. AIME 210, 153–163 — fracture pressure',
            'Goodman et al. (2011) Int. J. Greenhouse Gas Control 5(4), 828–833 — DOE capacity',
            'Chadwick et al. (2004) Energy 29(9–10) — Sleipner monitoring',
            'Furre et al. (2017) Energy Procedia 114, 3916–3926 — Sleipner 4D gravimetry',
            'Nordbotten et al. (2024) — SPE11A benchmark specification',
            'IEA (2023) — CO₂ Capture and Storage technology report',
            'IPCC AR6 (2022) WG3 — CCS role in net-zero pathways (Chapter 11)',
            'Bachu (2003) Environ. Geol. 44, 277–289 — CO₂ storage capacity assessment',
          ].map((ref) => (
            <li key={ref} className="text-[8.5px] font-mono text-muted leading-relaxed flex items-start gap-1">
              <span className="text-muted/40 shrink-0 mt-0.5">·</span>
              {ref}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
