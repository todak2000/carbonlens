import { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '../../store/uiStore'
import { Sun, Moon } from 'lucide-react'
import Logo from '../Logo'
import HeroScene from './HeroScene'
import WorldMap from './WorldMap'

// ── Icons as simple SVG components (no extra deps needed) ─────────────────────

function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

const FEATURES = [
  {
    title: 'Geological Screening',
    desc: 'Rapidly screen potential storage formations using site-specific parameters — depth, porosity, permeability, and caprock integrity.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
        <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
        <path d="M12 3v6" />
      </svg>
    ),
  },
  {
    title: 'Plume Simulation',
    desc: 'Multi-physics CO₂ plume modeling with real-time 3D visualization. Track migration, trapping evolution, and pressure response.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 1 0 20 14.5 14.5 0 0 1 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    title: 'Geomechanical Risk',
    desc: 'Mohr-Coulomb failure analysis, fracture pressure limits, MAIP constraints, and caprock integrity assessment with real-time safety factors.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: 'Well Optimization',
    desc: 'Automated well placement optimizing against caprock gaps, faults, thin zones and spill points. Binary-search for maximum safe injection rate.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    title: 'Economics & MRV',
    desc: 'Full-cycle cost analysis with NPV, IRR, and LCO₂S. Built-in monitoring, reporting, and verification framework for carbon credit issuance.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: 'Permit & Export',
    desc: 'Jurisdiction-aware permit report generation (EPA Class VI, EU CCS, UK NSTA, AU NOPSEMA). Export to JSON, CSV, Excel, PNG, GIF.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Configure Formation',
    desc: 'Define your storage site parameters — depth, geometry, petrophysics, and fluid composition. Choose from built-in presets or upload field data.',
  },
  {
    step: '02',
    title: 'Run Simulation',
    desc: 'Execute multi-physics simulation with real-time 3D visualization. Monitor CO₂ plume migration, pressure evolution, and trapping mechanisms.',
  },
  {
    step: '03',
    title: 'Export & Report',
    desc: 'Generate jurisdiction-ready permit reports, download data packages, and capture GIF recordings of your simulation for stakeholder review.',
  },
]

const PRICING_TIERS = [
  {
    name: 'Free',
    price: '$0',
    desc: 'Evaluate CarbonLens with basic storage screening.',
    features: ['Single formation project', 'Basic plume simulation', 'CSV/JSON export', 'Community support'],
    cta: 'Get Started',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    desc: 'Full-featured CCS screening for professionals.',
    features: ['Unlimited projects', 'Multi-well optimization', 'All permit templates', 'GIF recording & export', '3D visualization', 'Priority support'],
    cta: 'Start Free Trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'Tailored deployment for large-scale CCS programs.',
    features: ['On-premise deployment', 'API access & integrations', 'Custom report templates', 'Dedicated support team', 'SLA guarantees', 'White-label options'],
    cta: 'Contact Sales',
    featured: false,
  },
]

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
]

// All 16 formation presets organised by world region for the coverage map
// Coords are [x%, y%] within the 100×50 SVG viewBox (rough geographic placement)
const FORMATION_MARKERS = [
  // Europe / North Sea
  { name: 'Sleipner Utsira',     region: 'Europe',        x: 48.5, y: 17 },
  { name: 'Snøhvit Tubåen',      region: 'Europe',        x: 49.5, y: 13 },
  { name: 'Johansen',            region: 'Europe',        x: 48,   y: 18 },
  { name: 'Rotterdam / North Sea', region: 'Europe',      x: 47.5, y: 20 },
  // Africa / Middle East
  { name: 'In Salah',            region: 'Africa',        x: 47,   y: 30 },
  { name: 'Niger Delta',         region: 'Africa',        x: 46,   y: 35 },
  { name: 'Nile Delta',          region: 'Africa',        x: 52,   y: 29 },
  { name: 'Abu Dhabi Basin',     region: 'Middle East',   x: 56,   y: 31 },
  // Americas
  { name: 'Mount Simon',         region: 'Americas',      x: 22,   y: 24 },
  { name: 'Alberta Basin',       region: 'Americas',      x: 18,   y: 19 },
  // Asia-Pacific
  { name: 'Kasawari',            region: 'Asia-Pacific',  x: 72,   y: 37 },
  { name: 'Duyong',              region: 'Asia-Pacific',  x: 72,   y: 36 },
  { name: 'Malay Basin',         region: 'Asia-Pacific',  x: 71,   y: 37.5 },
  { name: 'North Sumatra Basin', region: 'Asia-Pacific',  x: 68,   y: 39 },
  // Australia
  { name: 'Gorgon',              region: 'Australia',     x: 70,   y: 46 },
  { name: 'Otway',               region: 'Australia',     x: 74,   y: 48 },
]

const REGION_COLORS: Record<string, string> = {
  'Europe':      '#34d399',
  'Africa':      '#fb923c',
  'Middle East': '#fbbf24',
  'Americas':    '#60a5fa',
  'Asia-Pacific':'#a78bfa',
  'Australia':   '#f472b6',
}

const REGIONS = Object.keys(REGION_COLORS)

export default function LandingPage() {
  const setView = useUIStore((s) => s.setView)
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = useCallback((id: string) => {
    setMobileMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className="min-h-screen bg-page text-primary font-sans overflow-x-hidden">
      {/* ═══ NAVBAR ════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-page/90 backdrop-blur-md border-b border-theme' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo width={140} />
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <button key={l.href} onClick={() => scrollTo(l.href.slice(1))}
                className="text-xs text-secondary hover:text-primary transition font-mono tracking-wider uppercase"
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={toggleTheme} className="flex items-center gap-1 text-secondary hover:text-primary transition" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={() => setView('auth')}
              className="text-xs text-secondary hover:text-primary transition font-mono px-3 py-1.5"
            >
              Sign In
            </button>
            <button onClick={() => setView('auth')}
              className="text-xs font-mono px-4 py-1.5 md:py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition min-h-[36px]"
            >
              Get Started
            </button>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden ml-1 p-1.5 text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-page/95 backdrop-blur-md border-b border-theme px-4 py-3 space-y-3">
            {NAV_LINKS.map((l) => (
              <button key={l.href} onClick={() => scrollTo(l.href.slice(1))}
                className="block w-full text-left text-xs text-secondary hover:text-primary transition font-mono tracking-wider uppercase py-2"
              >
                {l.label}
              </button>
            ))}
            <hr className="border-theme" />
            <button onClick={() => { setMobileMenuOpen(false); setView('auth') }}
              className="w-full text-xs font-mono py-2.5 rounded-lg dark:bg-white/10 bg-gray-200 text-secondary hover:text-primary transition"
            >
              Sign In
            </button>
          </div>
        )}
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[85vh] md:min-h-screen flex items-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent dark:to-[#03050a] to-gray-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/3 via-transparent to-cyan-500/3" />

        {/* 3D Scene */}
        <HeroScene />

        {/* Overlay content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 w-full pt-20 md:pt-24 pb-8 md:pb-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] md:text-xs font-mono mb-4 md:mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Prototypes for Humanity 2026 — Dubai Future Forum
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-3 md:mb-5">
              Rigorous CO₂ Storage{' '}
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Screening
              </span>
              {' '}— At Zero Cost
            </h1>
            <p className="text-sm md:text-base text-muted max-w-lg leading-relaxed mb-4">
              Enterprise CCS simulation tools cost{' '}
              <span className="text-primary font-semibold">$160,000–$230,000 per year</span>.
              CarbonLens delivers equivalent accuracy in your browser, free, with no installation
              and no specialist hardware.
            </p>
            {/* Cost comparison pill */}
            <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl dark:bg-white/5 bg-white border dark:border-white/10 border-gray-200 mb-6 md:mb-8">
              <div className="text-center">
                <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-0.5">Enterprise Simulators</div>
                <div className="text-lg font-bold text-rose-400 font-mono">$200K<span className="text-xs font-normal">/yr</span></div>
              </div>
              <div className="text-muted font-mono text-sm">→</div>
              <div className="text-center">
                <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-0.5">CarbonLens</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">$0</div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setView('auth')}
                className="px-6 py-3 md:py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm transition min-h-[48px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                Screen a Formation
                <IconChevronRight />
              </button>
              <button onClick={() => scrollTo('global-access')}
                className="px-6 py-3 md:py-3.5 rounded-xl dark:bg-white/5 bg-gray-100 hover:dark:bg-white/10 hover:bg-gray-200 text-secondary text-sm transition min-h-[48px] font-mono"
              >
                See Global Coverage
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRUST/STATS BAR ═════════════════════════════════════════════ */}
      <section className="border-y border-theme py-8 md:py-12 dark:bg-white/[0.01] bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
            {[
              { value: '16', label: 'Formation Presets' },
              { value: '50 yr', label: 'Simulation Horizon' },
              { value: '5', label: 'Regulatory Jurisdictions' },
              { value: '6', label: 'Physics Engines' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl md:text-3xl font-bold text-primary mb-1">{s.value}</div>
                <div className="text-[10px] md:text-xs text-muted font-mono tracking-wider uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ GLOBAL COVERAGE MAP ════════════════════════════════════════ */}
      <section id="global-access" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-10 md:mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              16 Formations · 6 Regions · 12 Countries
            </div>
            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-3">
              The $200K barrier — removed everywhere
            </h2>
            <p className="text-sm md:text-base text-muted max-w-2xl mx-auto">
              CCS simulation should be accessible to every geologist, regulator, and researcher
              — not only those at institutions that can afford enterprise licenses.
              CarbonLens ships pre-loaded with validated geological parameters for formations
              across six world regions.
            </p>
          </div>

          {/* SVG world map with formation markers */}
          <div className="relative dark:bg-white/[0.015] bg-gray-50/80 border dark:border-white/[0.06] border-gray-200 rounded-2xl overflow-hidden mb-8">
            {/* Dotted grid background */}
            <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.8" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>

            <WorldMap />

            {/* Region legend */}
            <div className="px-4 md:px-6 py-3 border-t dark:border-white/[0.06] border-gray-200 flex flex-wrap gap-x-5 gap-y-2">
              {REGIONS.map((r) => (
                <div key={r} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: REGION_COLORS[r] }} />
                  <span className="text-[10px] text-muted font-mono">{r} ({FORMATION_MARKERS.filter((f) => f.region === r).length})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Formation grid by region */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REGIONS.map((region) => {
              const fms = FORMATION_MARKERS.filter((f) => f.region === region)
              const color = REGION_COLORS[region]
              return (
                <div key={region} className="p-4 rounded-xl dark:bg-white/[0.02] bg-white border dark:border-white/[0.06] border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold text-primary">{region}</span>
                  </div>
                  <ul className="space-y-1">
                    {fms.map((f) => (
                      <li key={f.name} className="text-[11px] text-muted font-mono flex items-center gap-1.5">
                        <span className="opacity-40">·</span>{f.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ════════════════════════════════════════════════════ */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-3">Everything you need for CCS screening</h2>
            <p className="text-sm md:text-base text-muted max-w-xl mx-auto">
              From geological input to regulatory output — a complete toolkit for carbon storage site evaluation.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="group p-4 md:p-6 rounded-xl dark:bg-white/[0.02] bg-white border dark:border-white/[0.06] border-gray-200 hover:dark:bg-white/[0.04] hover:bg-gray-50 hover:border-emerald-500/20 transition">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3 md:mb-4 group-hover:bg-emerald-500/20 transition">
                  {f.icon}
                </div>
                <h3 className="text-sm md:text-base font-semibold text-primary mb-1.5 md:mb-2">{f.title}</h3>
                <p className="text-xs md:text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-16 md:py-24 dark:bg-white/[0.01] bg-gray-50/50 border-y border-theme">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-3">From formation to permit in three steps</h2>
            <p className="text-sm md:text-base text-muted max-w-xl mx-auto">
              Streamlined workflow designed for geoscientists and storage engineers.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-10">
            {HOW_IT_WORKS.map((h, i) => (
              <div key={h.step} className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <span className="text-2xl md:text-3xl font-bold text-emerald-500/30 font-mono">{h.step}</span>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block flex-1 h-px bg-gradient-to-r from-emerald-500/20 to-transparent" />
                  )}
                </div>
                <h3 className="text-base md:text-lg font-semibold text-primary mb-2">{h.title}</h3>
                <p className="text-xs md:text-sm text-muted leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-3">Simple, transparent pricing</h2>
            <p className="text-sm md:text-base text-muted max-w-xl mx-auto">
              Start free, upgrade when you need more. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
            {PRICING_TIERS.map((t) => (
              <div key={t.name} className={`relative p-5 md:p-6 rounded-xl border ${t.featured ? 'bg-gradient-to-b from-emerald-500/10 to-transparent border-emerald-500/30' : 'dark:bg-white/[0.02] bg-white border dark:border-white/[0.06] border-gray-200'}`}>
                {t.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-[10px] font-mono font-medium text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="text-sm md:text-base font-semibold text-primary mb-1">{t.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl md:text-3xl font-bold text-primary">{t.price}</span>
                  {t.period && <span className="text-xs text-muted font-mono">{t.period}</span>}
                </div>
                <p className="text-xs text-muted mb-4 md:mb-5">{t.desc}</p>
                <ul className="space-y-2 mb-5 md:mb-6">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted">
                      <span className={`${t.featured ? 'text-emerald-400' : 'text-muted'}`}><IconCheck /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setView('auth')}
                  className={`w-full py-2.5 rounded-lg text-xs font-medium transition min-h-[40px] font-mono ${t.featured ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'dark:bg-white/10 bg-gray-200 hover:dark:bg-white/20 hover:bg-gray-300 text-primary'}`}
                >
                  {t.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ══════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-emerald-500/5 to-transparent border-t border-theme">
        <div className="max-w-3xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-4">
            Ready to evaluate your storage site?
          </h2>
          <p className="text-sm md:text-base text-muted max-w-lg mx-auto mb-6 md:mb-8">
            Start with a free simulation. No credit card required.
          </p>
          <button onClick={() => setView('auth')}
            className="px-8 py-3.5 md:py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm transition min-h-[48px] inline-flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            Start Free Simulation
            <IconChevronRight />
          </button>
        </div>
      </section>

      {/* ═══ FOOTER ═════════════════════════════════════════════════════ */}
      <footer className="border-t border-theme py-8 md:py-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-secondary">
              <Logo width={180} />
            </div>
            <div className="flex items-center gap-4 md:gap-6">
              <button onClick={() => scrollTo('features')} className="text-[10px] md:text-xs text-muted hover:text-secondary transition font-mono">Features</button>
              <button onClick={() => scrollTo('pricing')} className="text-[10px] md:text-xs text-muted hover:text-secondary transition font-mono">Pricing</button>
              <a href="mailto:hello@carbonlens.io" className="text-[10px] md:text-xs text-muted hover:text-secondary transition font-mono">Contact</a>
            </div>
          </div>
          <div className="mt-5 text-center text-[9px] md:text-[10px] text-muted font-mono">
            &copy; {new Date().getFullYear()} CarbonLens. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
