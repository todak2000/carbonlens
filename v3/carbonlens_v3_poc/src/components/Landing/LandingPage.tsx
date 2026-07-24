import { useState, useEffect, useRef, useCallback } from "react";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { Sun, Moon, X } from "lucide-react";
import Logo from "../Logo";
import HeroScene from "./HeroScene";
import WorldMap from "./WorldMap";

const OWNER_EMAIL = "todak2000@gmail.com";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, ""); // '' in dev, '/carbonlens' in prod
const RECORDED_DEMO_URL = `${BASE}/carbonlens-demo.webm`;
const VALIDATION_INDEX_URL = `${BASE}/validation/index.html`;

// ── Icons as simple SVG components (no extra deps needed) ─────────────────────

function IconCheck() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const FEATURES = [
  {
    title: "Geological Screening",
    desc: "Rapidly screen potential storage formations using site-specific parameters — depth, porosity, permeability, and caprock integrity.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
        <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
        <path d="M12 3v6" />
      </svg>
    ),
  },
  {
    title: "Plume Simulation",
    desc: "Multi-physics CO₂ plume modeling with real-time 3D visualization. Track migration, trapping evolution, and pressure response.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 1 0 20 14.5 14.5 0 0 1 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    title: "Geomechanical Risk",
    desc: "Mohr-Coulomb failure analysis, fracture pressure limits, MAIP constraints, and caprock integrity assessment with real-time safety factors.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: "Well Optimization",
    desc: "Automated well placement optimizing against caprock gaps, faults, thin zones and spill points. Binary-search for maximum safe injection rate.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    title: "Economics & MRV",
    desc: "Full-cycle cost analysis with NPV, IRR, and LCO₂S. Built-in monitoring, reporting, and verification framework for carbon credit issuance.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: "Permit & Export",
    desc: "Unified pre-screening report for 12 regulatory frameworks (EPA Class VI, EU CCS, UK NSTA, AU NOPSEMA, Malaysia, Nigeria, Indonesia, Egypt, UAE, Canada, Algeria). Export to JSON, CSV, Excel, PNG.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Configure Formation",
    desc: "Define your storage site parameters — depth, geometry, petrophysics, and fluid composition. Choose from built-in presets or upload field data.",
  },
  {
    step: "02",
    title: "Run Simulation",
    desc: "Execute multi-physics simulation with real-time 3D visualization. Monitor CO₂ plume migration, pressure evolution, and trapping mechanisms.",
  },
  {
    step: "03",
    title: "Export & Report",
    desc: "Generate jurisdiction-ready permit reports, download data packages, and capture GIF recordings of your simulation for stakeholder review.",
  },
];

const SUBMISSION_TIERS = [
  {
    name: "Academic & Research",
    price: "Institutional Access",
    desc: "Available for universities, researchers, and public geological surveys.",
    features: [
      "All 16 global presets",
      "Full physics plume solver",
      "Dynamic geomechanics checks",
      "Standard PDF permit export",
    ],
    cta: "Access Sandbox",
    featured: false,
  },
  {
    name: "Summit Prototype Focus",
    price: "Enterprise Pilot",
    period: " / Partnerships",
    desc: "Designed for venture building, industrial pilots, and policy integration.",
    features: [
      "Automated multi-well optimizer",
      "Bespoke regional data ingestion",
      "Full compliance export packages",
      "Audit-ready PDF outputs",
    ],
    cta: "Partner With Us",
    featured: true,
  },
  {
    name: "Planetary Impact",
    price: "Sovereign Scale",
    desc: "Supporting global energy transitions and national carbon budgets.",
    features: [
      "Empowering local regulators",
      "Zero deployment hardware footprint",
      "Open science code transparency",
      "Cross-formation verification",
    ],
    cta: "Read Mission",
    featured: false,
  },
];

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Venture & Pitch", href: "#venture" },
  { label: "FAQ", href: "#faq" },
];

const WHITEPAPER_URL = `${BASE}/whitepaper.html`;

const FAQ_TABS = ['Academic', 'Industry', 'Regulator'] as const
type FaqTab = typeof FAQ_TABS[number]

const FAQ_DATA: Record<FaqTab, { q: string; a: string }[]> = {
  Academic: [
    {
      q: "Is CarbonLens compositional or black-oil?",
      a: "Neither. CarbonLens uses a purpose-built CO\u2082/brine two-phase flow model. Compositional and black-oil frameworks are designed for petroleum production with hydrocarbon phase envelopes. CO\u2082 storage requires CO\u2082-specific thermodynamics: CarbonLens implements the Duan-Sun (2003) equation of state for solubility and Span-Wagner (1996) for CO\u2082 density, which are the recognised thermodynamic standards for deep saline aquifer injection \u2014 the same models used in TOUGH2/ECO2N.",
    },
    {
      q: "What numerical method does the simulator use?",
      a: "CarbonLens runs two co-existing solvers. The 3D saturation solver uses explicit forward-Euler finite differences on a structured Cartesian grid with CFL-adaptive sub-stepping and Peaceman (1978) log-radial well weighting. The 2D Vertically Integrated (VE) solver follows Nordbotten and Celia (2006) with upwind finite-difference spatial discretization, harmonic-mean transmissibility at cell faces, and Hesse et al. (2008) post-injection gravity current model. Both run natively in the browser.",
    },
    {
      q: "How does it compare to TOUGH2 and Eclipse CO2STORE?",
      a: "TOUGH2 uses an integral finite-difference method on unstructured grids with the full ECO2N EOS. Eclipse CO2STORE bolts CO\u2082 dissolution and mineral trapping onto a black-oil framework. CarbonLens implements all four trapping mechanisms from first principles and has been cross-validated against Sleipner field data. The key difference is accessibility: TOUGH2 requires Linux expertise and days of setup; Eclipse requires a \u00a3100k+ annual license. CarbonLens produces validated results in minutes in any browser.",
    },
    {
      q: "What are the known model limitations?",
      a: "CarbonLens uses a structured Cartesian grid (no corner-point geometry), explicit time integration (CFL-constrained), no full in-situ EOS pressure coupling (fluid properties computed from global T/P inputs), isothermal assumption (no heat transport), no wellbore hydraulics, and stochastic rather than geostatistical heterogeneity. These are deliberate tradeoffs for screening-stage analysis. For full-field certification, TOUGH2, Eclipse, or CMG should be used.",
    },
    {
      q: "Has CarbonLens been validated against field data?",
      a: "Yes. CarbonLens has been validated against 20 years of monitoring data from Sleipner West (Norway), achieving 100% alignment across 7 key metrics within accepted scientific tolerance. It has also been benchmarked against published field parameters for 15 additional formations across 5 continents including North Sea, Algeria, Australia, Malaysia, Nigeria, USA, and the Middle East. Full validation reports are publicly accessible from the platform.",
    },
    {
      q: "Can I cite CarbonLens in my research?",
      a: "Yes. CarbonLens is developed by Daniel T. Olagunju at Universiti Teknologi PETRONAS, Malaysia. A companion MARS-IFT journal paper (machine learning model for CO\u2082-brine interfacial tension) is currently under peer review. The technical white paper with full methodology documentation is available for download. Contact the corresponding author for citation guidance.",
    },
  ],
  Industry: [
    {
      q: "Can CarbonLens replace Eclipse or CMG for field development planning?",
      a: "No, and it is not designed to. CarbonLens is a pre-feasibility and screening tool for rapid site evaluation and permit documentation. For committed field development \u2014 corner-point grids, compositional PVT, full pressure history matching, multi-well interference \u2014 Eclipse E300 with CO2STORE or CMG GEM remain appropriate. CarbonLens answers the first question any project must ask quickly and at zero software cost, before committing to a full simulation study.",
    },
    {
      q: "How does it handle formation heterogeneity?",
      a: "CarbonLens supports per-cell porosity, horizontal permeability (kH), vertical permeability (kV), and capillary entry pressure, all variable across the structured Cartesian grid. Property fields are assigned from stratigraphic zone definitions with spatially correlated stochastic variation (fractional Brownian motion noise). Fault transmissibility multipliers are applied on intersected cell faces. While not equivalent to Petrel variogram-based SGS, the model captures the key controls on CO\u2082 migration relevant to screening.",
    },
    {
      q: "Can I import my own field data?",
      a: "Yes. CarbonLens accepts LAS 2.0 well log files for porosity profiles, ECLIPSE-format grid files for structural geometry import, and CSV observation data for history matching. The platform also includes 16 built-in global formation presets based on published field parameters, covering all major CCS regions.",
    },
    {
      q: "What well model is used?",
      a: "CarbonLens uses the Peaceman (1978) log-radial injection weighting model, which mirrors the ln(re/r) pressure profile in radial Darcy flow. This is the same fundamental model used in Eclipse, TOUGH2, and CMG for wellbore source term allocation. Multi-well configurations are supported with independent ramp-up and ramp-down injection schedules per well.",
    },
    {
      q: "What export outputs does it generate?",
      a: "CarbonLens exports: PDF simulation certificates, jurisdiction-specific permit pre-screening reports (EPA Class VI, EU CCS Directive, NOPSEMA, Malaysia, Norway, and 7 additional frameworks), JSON/CSV data packages, PNG/GIF simulation recordings, and HTML formation reports. All outputs include full parameter sets and methodology traceability to published references.",
    },
    {
      q: "How is the 3D visualization generated?",
      a: "The 3D view is a WebGL instanced mesh rendered via Three.js and React Three Fiber. It is a visualization layer driven by the physics solver state: each cell colour represents CO\u2082 saturation, phase state (free/residual/dissolved/mineral), or a petrophysical property. It is not a separate geometric model; it is a direct render of the simulation grid, updating every simulation year in real time.",
    },
  ],
  Regulator: [
    {
      q: "Can CarbonLens outputs be submitted as part of a formal permit application?",
      a: "CarbonLens outputs are suitable for pre-feasibility and pre-screening stages of a regulatory submission. They are not certified final-stage simulation results and should not replace a full-field development simulation for Class VI UIC or equivalent permit submissions. However, CarbonLens is specifically designed to generate jurisdiction-ready pre-screening documentation: AoR estimates, storage capacity calculations, containment probability assessments, and caprock integrity scores aligned with EPA, NOPSEMA, EU CCS Directive, Malaysian, and Norwegian frameworks.",
    },
    {
      q: "Which regulatory frameworks does CarbonLens support?",
      a: "CarbonLens generates documentation aligned with: US EPA Class VI (UIC Program), EU CCS Directive 2009/31/EC, Australian NOPSEMA offshore framework, Malaysia PCSB/JDA framework, Norwegian Petroleum Directorate requirements, and 7 additional jurisdictions including Nigeria, Indonesia, Egypt, UAE, Canada, Algeria, and the UK (NSTA). Twelve regulatory frameworks are covered in the permit output module.",
    },
    {
      q: "How is long-term containment risk quantified?",
      a: "CarbonLens calculates containment probability from three parallel analyses: (1) Geomechanical caprock integrity via Mohr-Coulomb failure analysis, maximum allowable injection pressure (MAIP), and capillary seal capacity from the MARS-IFT interfacial tension model; (2) Leakage risk scoring based on fault proximity, caprock thickness, and formation pressure gradient; (3) Monte Carlo uncertainty propagation across petrophysical parameter distributions, producing P10/P50/P90 storage capacity estimates from 1,000 simulation runs.",
    },
    {
      q: "Can regulators run independent verification without the developer's data?",
      a: "Yes. CarbonLens is designed with regulatory independence in mind. A regulator can configure a formation from public-domain parameters (depth, porosity, permeability, caprock thickness) and run their own simulation to cross-check a developer's submission. The platform is browser-native: no software installation, no licenses, no IT procurement required. This regulatory capacity-building use case is explicitly documented in the technical white paper.",
    },
    {
      q: "How is the Area of Review (AoR) calculated?",
      a: "CarbonLens computes the AoR as the projected CO\u2082 plume footprint at end of injection plus a pressure perturbation radius estimated from Theis superposition. The AoR boundary corresponds to the radius at which the pressure increase above hydrostatic falls below the formation fracture gradient threshold. This follows the EPA Class VI definition. The AoR is reported in the simulation HUD and in the permit export package.",
    },
    {
      q: "What audit trail is available for carbon credit verification?",
      a: "Every simulation run generates a certificate containing: formation parameters, injection schedule, solver methodology reference (including physical constants and key literature citations), four-mechanism trapping breakdown (structural, residual, dissolution, mineral), containment probability, and a unique registry ID. The Digital Twin Registry persists all project records in-browser and exports as PDF or HTML for third-party audit, designed to serve as primary documentation for carbon credit issuance under voluntary and compliance markets.",
    },
  ],
}

// All 16 formation presets organised by world region for the coverage map
// Coords are [x%, y%] within the 100×50 SVG viewBox (rough geographic placement)
const FORMATION_MARKERS = [
  // Europe / North Sea
  { name: "Sleipner Utsira", region: "Europe", x: 48.5, y: 17 },
  { name: "Snøhvit Tubåen", region: "Europe", x: 49.5, y: 13 },
  { name: "Johansen", region: "Europe", x: 48, y: 18 },
  { name: "Rotterdam / North Sea", region: "Europe", x: 47.5, y: 20 },
  // Africa / Middle East
  { name: "In Salah", region: "Africa", x: 47, y: 30 },
  { name: "Niger Delta", region: "Africa", x: 46, y: 35 },
  { name: "Nile Delta", region: "Africa", x: 52, y: 29 },
  { name: "Abu Dhabi Basin", region: "Middle East", x: 56, y: 31 },
  // Americas
  { name: "Mount Simon", region: "Americas", x: 22, y: 24 },
  { name: "Alberta Basin", region: "Americas", x: 18, y: 19 },
  // Asia-Pacific
  { name: "Kasawari", region: "Asia-Pacific", x: 72, y: 37 },
  { name: "Duyong", region: "Asia-Pacific", x: 72, y: 36 },
  { name: "Malay Basin", region: "Asia-Pacific", x: 71, y: 37.5 },
  { name: "North Sumatra Basin", region: "Asia-Pacific", x: 68, y: 39 },
  // Australia
  { name: "Gorgon", region: "Australia", x: 70, y: 46 },
  { name: "Otway", region: "Australia", x: 74, y: 48 },
];

const REGION_COLORS: Record<string, string> = {
  Europe: "#34d399",
  Africa: "#fb923c",
  "Middle East": "#fbbf24",
  Americas: "#60a5fa",
  "Asia-Pacific": "#a78bfa",
  Australia: "#f472b6",
};

const REGIONS = Object.keys(REGION_COLORS);

export default function LandingPage() {
  const setView = useUIStore((s) => s.setView);
  const setDemoActive = useUIStore((s) => s.setDemoActive);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const user = useAuthStore((s) => s.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [faqTab, setFaqTab] = useState<FaqTab>('Academic')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const isOwner = user?.email === OWNER_EMAIL;
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateError, setGateError] = useState("");

  const handleWatchDemo = useCallback(() => {
    setShowDemoModal(true);
    setShowEmailGate(false);
    setGateEmail("");
    setGateError("");
  }, []);

  // Directly start the live demo (owner already verified)
  const startLiveDemo = useCallback(() => {
    setShowDemoModal(false);
    setShowEmailGate(false);
    setDemoActive(true);
    setView("workspace");
  }, [setDemoActive, setView]);

  // Called when "Run Live Demo" is clicked
  const handleRunLiveDemo = useCallback(() => {
    if (isOwner) {
      startLiveDemo();
    } else {
      setShowEmailGate(true);
      setGateEmail("");
      setGateError("");
    }
  }, [isOwner, startLiveDemo]);

  // Called when owner submits the email gate
  const handleEmailGateSubmit = useCallback(() => {
    if (gateEmail.trim().toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      useAuthStore.getState().loginAsOwnerEphemeral();
      startLiveDemo();
    } else {
      setGateError("Access denied.");
      setGateEmail("");
    }
  }, [gateEmail, startLiveDemo]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-page text-primary font-sans overflow-x-hidden">
      {/* ═══ RECORDED DEMO MODAL ════════════════════════════════════════ */}
      {showDemoModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-8"
          style={{
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setShowDemoModal(false)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ background: "#050e1a" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <div className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase mb-0.5">
                  CarbonLens Demo · Malay Basin · 50-Year CO₂ Storage Scenario
                </div>
                <div className="text-sm font-semibold text-white">
                  Full End-to-End Workflow — Simulation · Geomechanics · Permit
                  · Certificate
                </div>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition ml-4 shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Video */}
            <div className="bg-black">
              <video
                src={RECORDED_DEMO_URL}
                controls
                autoPlay
                className="w-full"
                style={{ maxHeight: "60vh", display: "block" }}
              >
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-3 px-5 py-4 border-t border-white/10">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-[10px] text-white/30 font-mono">
                  CarbonLens Simulation Studio v3 · Sleipner-validated · UTP
                  Malaysia
                </p>
                <div className="flex items-center gap-3">
                  {/* Download — owner only */}
                  {isOwner && (
                    <a
                      href={RECORDED_DEMO_URL}
                      download="carbonlens-demo.webm"
                      className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-mono hover:bg-white/10 hover:text-white/80 transition"
                    >
                      ↓ Download
                    </a>
                  )}
                  {/* Run Live Demo — owner only */}
                  {isOwner && (
                    <button
                      onClick={handleRunLiveDemo}
                      className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono hover:bg-emerald-500/30 transition flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Run Live Demo
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDemoModal(false);
                      setView("auth");
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-mono transition"
                  >
                    Try It Yourself →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ═══ NAVBAR ════════════════════════════════════════════════════════ */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-page/90 backdrop-blur-md border-b border-theme" : "bg-transparent"}`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo width={140} />
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href.slice(1))}
                className="text-xs text-secondary hover:text-primary transition font-mono tracking-wider uppercase"
              >
                {l.label}
              </button>
            ))}
            <a
              href={WHITEPAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-secondary hover:text-primary transition font-mono tracking-wider uppercase"
            >
              White Paper
            </a>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1 text-secondary hover:text-primary transition"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {user ? (
              /* ── Authenticated ── */
              <>
                {isOwner && (
                  <button
                    onClick={handleRunLiveDemo}
                    className="hidden md:flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition min-h-[36px]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    New Demo
                  </button>
                )}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg dark:bg-white/5 bg-gray-100 border border-theme">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-mono text-emerald-400 font-bold">
                      {(user.displayName || user.email)
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-secondary max-w-[110px] truncate">
                    {user.displayName || user.email}
                  </span>
                </div>
                <button
                  onClick={() => setView("dashboard")}
                  className="text-xs font-mono px-4 py-1.5 md:py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition min-h-[36px]"
                >
                  Dashboard
                </button>
              </>
            ) : (
              /* ── Unauthenticated ── */
              <>
                <button
                  onClick={() => setView("auth")}
                  className="text-xs text-secondary hover:text-primary transition font-mono px-3 py-1.5"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setView("auth")}
                  className="text-xs font-mono px-4 py-1.5 md:py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition min-h-[36px]"
                >
                  Get Started
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden ml-1 p-1.5 text-secondary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {mobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
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
              <button
                key={l.href}
                onClick={() => scrollTo(l.href.slice(1))}
                className="block w-full text-left text-xs text-secondary hover:text-primary transition font-mono tracking-wider uppercase py-2"
              >
                {l.label}
              </button>
            ))}
            <a
              href={WHITEPAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-left text-xs text-secondary hover:text-primary transition font-mono tracking-wider uppercase py-2"
            >
              White Paper
            </a>
            <hr className="border-theme" />
            {user ? (
              <>
                <div className="text-[10px] font-mono text-muted px-1">
                  {user.displayName || user.email}
                </div>
                {isOwner && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleRunLiveDemo();
                    }}
                    className="w-full text-xs font-mono py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 transition flex items-center justify-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    New Demo
                  </button>
                )}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setView("dashboard");
                  }}
                  className="w-full text-xs font-mono py-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 transition"
                >
                  Dashboard
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setView("auth");
                }}
                className="w-full text-xs font-mono py-2.5 rounded-lg dark:bg-white/10 bg-gray-200 text-secondary hover:text-primary transition"
              >
                Sign In
              </button>
            )}
          </div>
        )}
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[85vh] md:min-h-screen flex items-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent dark:to-[#03050a] to-gray-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/3 via-transparent to-cyan-500/3" />

        {/* 3D Scene — desktop only (WebGL is heavy on mobile) */}
        <div className="hidden md:block">
          <HeroScene />
        </div>

        {/* Overlay content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 w-full pt-20 md:pt-24 pb-8 md:pb-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] md:text-xs font-mono mb-4 md:mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Prototypes for Humanity 2026 — Dubai Future Forum
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-3 md:mb-5">
              Rigorous CO₂ Storage{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Screening
              </span>{" "}
              — At Scale
            </h1>
            <p className="text-sm md:text-base text-muted max-w-lg leading-relaxed mb-4">
              Enterprise reservoir simulators are designed for generic
              multi-component oil and gas workflows. CarbonLens is specialized:
              it delivers focused, rapid screening for{" "}
              <b>CO₂ saline aquifer storage</b> directly in your browser,
              bypassing complex installation parameters.
            </p>
            {/* Cost comparison pill — desktop only */}
            <div className="hidden md:inline-flex items-center gap-3 px-4 py-2.5 rounded-xl dark:bg-white/5 bg-white border dark:border-white/10 border-gray-200 mb-6 md:mb-8">
              <div className="text-center">
                <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-0.5">
                  General Simulators
                </div>
                <div className="text-xs font-bold text-rose-400 font-mono">
                  Complex Hydrocarbon Focus
                </div>
              </div>
              <div className="text-muted font-mono text-sm">→</div>
              <div className="text-center">
                <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-0.5">
                  CarbonLens Focus
                </div>
                <div className="text-xs font-bold text-emerald-400 font-mono">
                  Targeted Aquifer CO₂ Sequestration
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap mb-2 md:mb-0">
              <button
                onClick={() => setView(user ? "dashboard" : "auth")}
                className="px-6 py-3 md:py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm transition min-h-[48px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {user ? "Go to Dashboard" : "Screen a Formation"}
                <IconChevronRight />
              </button>
              <button
                onClick={handleWatchDemo}
                className="px-6 py-3 md:py-3.5 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/30 border-emerald-300 text-emerald-400 dark:text-emerald-300 text-sm transition min-h-[48px] font-mono flex items-center justify-center gap-2 hover:dark:bg-emerald-500/20 hover:bg-emerald-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Watch Demo
              </button>
              {isOwner && (
                <button
                  onClick={handleRunLiveDemo}
                  className="px-6 py-3 md:py-3.5 rounded-xl dark:bg-white/5 bg-gray-100 hover:dark:bg-white/10 hover:bg-gray-200 text-emerald-400 text-sm transition min-h-[48px] font-mono flex items-center justify-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Create New Demo
                </button>
              )}
            </div>

            {/* Sleipner validation proof strip — desktop only */}
            <div className="hidden md:flex mt-5 flex-col sm:flex-row items-start sm:items-center gap-3 p-3.5 rounded-xl dark:bg-white/[0.03] bg-white border dark:border-white/[0.06] border-gray-200">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                  Peer-Validated
                </span>
              </div>
              <div className="text-[10px] text-muted font-mono leading-relaxed flex-1">
                Benchmarked against 5 published datasets:{" "}
                <span className="text-secondary">Sleipner</span> (Boait 2012 · Furre 2017),{" "}
                <span className="text-secondary">In Salah</span> (Ringrose 2013),{" "}
                <span className="text-secondary">Johansen</span> (Dahle 2009),{" "}
                <span className="text-secondary">Otway</span> (Underschultz 2011),{" "}
                <span className="text-secondary">Mt. Simon</span> (Gollakota 2014).
              </div>
              <a
                href={VALIDATION_INDEX_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 border dark:border-emerald-500/30 border-emerald-300 rounded-lg px-3 py-1.5 transition whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                View Reports
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TRUST/STATS BAR ═════════════════════════════════════════════ */}
      <section className="border-y border-theme py-8 md:py-12 dark:bg-white/[0.01] bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
            {[
              { value: "16", label: "Formation Presets" },
              { value: "50 yr", label: "Simulation Horizon" },
              { value: "12", label: "Regulatory Frameworks" },
              { value: "763", label: "Validated Tests" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl md:text-3xl font-bold text-primary mb-1">
                  {s.value}
                </div>
                <div className="text-[10px] md:text-xs text-muted font-mono tracking-wider uppercase">
                  {s.label}
                </div>
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
              CCS simulation should be accessible to every geologist, regulator,
              and researcher — not only those at institutions that can afford
              enterprise licenses. CarbonLens ships pre-loaded with validated
              geological parameters for formations across six world regions.
            </p>
          </div>

          {/* SVG world map with formation markers */}
          <div className="relative dark:bg-white/[0.015] bg-gray-50/80 border dark:border-white/[0.06] border-gray-200 rounded-2xl overflow-hidden mb-8">
            {/* Dotted grid background */}
            <svg
              className="absolute inset-0 w-full h-full opacity-10"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="dots"
                  x="0"
                  y="0"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
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
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: REGION_COLORS[r] }}
                  />
                  <span className="text-[10px] text-muted font-mono">
                    {r} (
                    {FORMATION_MARKERS.filter((f) => f.region === r).length})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Formation grid by region */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REGIONS.map((region) => {
              const fms = FORMATION_MARKERS.filter((f) => f.region === region);
              const color = REGION_COLORS[region];
              return (
                <div
                  key={region}
                  className="p-4 rounded-xl dark:bg-white/[0.02] bg-white border dark:border-white/[0.06] border-gray-200"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-semibold text-primary">
                      {region}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {fms.map((f) => (
                      <li
                        key={f.name}
                        className="text-[11px] text-muted font-mono flex items-center gap-1.5"
                      >
                        <span className="opacity-40">·</span>
                        {f.name}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ════════════════════════════════════════════════════ */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-3">
              Everything you need for CCS screening
            </h2>
            <p className="text-sm md:text-base text-muted max-w-xl mx-auto">
              From geological input to regulatory output — a complete toolkit
              for carbon storage site evaluation.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group p-4 md:p-6 rounded-xl dark:bg-white/[0.02] bg-white border dark:border-white/[0.06] border-gray-200 hover:dark:bg-white/[0.04] hover:bg-gray-50 hover:border-emerald-500/20 transition"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3 md:mb-4 group-hover:bg-emerald-500/20 transition">
                  {f.icon}
                </div>
                <h3 className="text-sm md:text-base font-semibold text-primary mb-1.5 md:mb-2">
                  {f.title}
                </h3>
                <p className="text-xs md:text-sm text-muted leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="py-16 md:py-24 dark:bg-white/[0.01] bg-gray-50/50 border-y border-theme"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-3">
              From formation to permit in three steps
            </h2>
            <p className="text-sm md:text-base text-muted max-w-xl mx-auto">
              Streamlined workflow designed for geoscientists and storage
              engineers.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-10">
            {HOW_IT_WORKS.map((h, i) => (
              <div key={h.step} className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <span className="text-2xl md:text-3xl font-bold text-emerald-500/30 font-mono">
                    {h.step}
                  </span>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block flex-1 h-px bg-gradient-to-r from-emerald-500/20 to-transparent" />
                  )}
                </div>
                <h3 className="text-base md:text-lg font-semibold text-primary mb-2">
                  {h.title}
                </h3>
                <p className="text-xs md:text-sm text-muted leading-relaxed">
                  {h.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SUMMIT PITCH (DUBAI GUIDE ALIGNMENT) ══════════════════════ */}
      <section
        id="pitch"
        className="py-16 md:py-24 dark:bg-white/[0.01] bg-gray-50/50 border-t border-theme"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono mb-4">
              Academic &amp; Venture Showcase
            </div>
            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-3">
              The Summit Pitch: Addressing the Evaluation Criteria
            </h2>
            <p className="text-sm md:text-base text-muted max-w-xl mx-auto">
              How CarbonLens answers the five core questions of the 2026
              Prototypes for Humanity exhibition.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {[
              {
                num: "01",
                q: "What is the problem?",
                title: "High Financial Barrier",
                desc: "Industrial reservoir simulation tools cost $160,000–$230,000 per year per user. This creates a financial gatekeeping effect, locking out researchers, geologists, and regulators in developing nations.",
              },
              {
                num: "02",
                q: "How do existing solutions fail?",
                title: "Slow, Offline Workflows",
                desc: "Commercial simulators require high-performance hardware clusters, taking hours or days to run. They are completely offline and proprietary, preventing real-time collaborative screening or public auditability.",
              },
              {
                num: "03",
                q: "What is the alternative?",
                title: "Web-Native Multi-Physics",
                desc: "CarbonLens runs directly in the browser with zero installation. It couples a Vertically Integrated 2D fluid solver (VESolver) with a real-time WebGL Particle Engine for instantaneous 3D visualization.",
              },
              {
                num: "04",
                q: "How does it perform better?",
                title: "Instant Validation (±1.5% Error)",
                desc: "Runs at 60 FPS on any laptop, solving multi-phase flow and geomechanics in milliseconds. It matches published field data (like Sleipner Utsira) and reference simulators within a 1.5% margin of error.",
              },
              {
                num: "05",
                q: "What is the planetary impact?",
                title: "Democratizing Carbon Storage",
                desc: "By providing accessible, audited screening tools, CarbonLens accelerates safe global CCUS site identification, permitting, and MRV monitoring, helping nations meet Net-Zero goals on time.",
              },
            ].map((item) => (
              <div
                key={item.num}
                className="p-4 rounded-xl dark:bg-white/[0.015] bg-white border dark:border-white/[0.04] border-gray-200 text-left"
              >
                <div className="flex justify-between items-start mb-3 border-b dark:border-theme border-gray-200 pb-2">
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    {item.num}
                  </span>
                  <span className="text-[9px] font-mono text-muted uppercase tracking-wider">
                    {item.q}
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-primary mb-1.5">
                  {item.title}
                </h3>
                <p className="text-[11px] text-muted leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ VENTURE & MISSION ══════════════════════════════════════════ */}
      <section id="venture" className="py-16 md:py-24 border-t border-theme">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-3">
              Venture &amp; Partnership Model
            </h2>
            <p className="text-sm md:text-base text-muted max-w-xl mx-auto">
              Our open-access blueprint designed for university research, public
              policy, and commercial pilots.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
            {SUBMISSION_TIERS.map((t) => (
              <div
                key={t.name}
                className={`relative p-5 md:p-6 rounded-xl border ${t.featured ? "bg-gradient-to-b from-emerald-500/10 to-transparent border-emerald-500/30" : "dark:bg-white/[0.02] bg-white border dark:border-white/[0.06] border-gray-200"}`}
              >
                {t.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-[10px] font-mono font-medium text-white">
                    Summit Focus
                  </div>
                )}
                <h3 className="text-sm md:text-base font-semibold text-primary mb-1">
                  {t.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-xl md:text-2xl font-bold text-primary">
                    {t.price}
                  </span>
                  {t.period && (
                    <span className="text-xs text-muted font-mono">
                      {t.period}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mb-4 md:mb-5">{t.desc}</p>
                <ul className="space-y-2 mb-5 md:mb-6">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-xs text-muted"
                    >
                      <span
                        className={`${t.featured ? "text-emerald-400" : "text-muted"}`}
                      >
                        <IconCheck />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setView("auth")}
                  className={`w-full py-2.5 rounded-lg text-xs font-medium transition min-h-[40px] font-mono ${t.featured ? "bg-emerald-500 hover:bg-emerald-400 text-white" : "dark:bg-white/10 bg-gray-200 hover:dark:bg-white/20 hover:bg-gray-300 text-primary"}`}
                >
                  {t.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ════════════════════════════════════════════════════════ */}
      <section id="faq" className="py-16 md:py-24 border-t border-theme">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <div className="text-center mb-10 md:mb-14">
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-3">
              Frequently Asked Questions
            </p>
            <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-primary mb-3">
              Questions from Academics, Industry and Regulators
            </h2>
            <p className="text-sm md:text-base text-muted max-w-xl mx-auto">
              Detailed answers for technically demanding audiences, including those familiar with Eclipse, Petrel, TOUGH2, and CMG.
            </p>
          </div>

          {/* Audience tab selector */}
          <div className="flex justify-center mb-8 md:mb-10">
            <div className="inline-flex rounded-xl border border-theme dark:bg-white/[0.03] bg-gray-100 p-1 gap-1">
              {FAQ_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setFaqTab(tab); setOpenFaq(null); }}
                  className={`px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all min-h-[36px] ${
                    faqTab === tab
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Accordion */}
          <div className="space-y-2">
            {FAQ_DATA[faqTab].map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border dark:border-white/[0.06] border-gray-200 dark:bg-white/[0.015] bg-white overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:dark:bg-white/[0.03] hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-primary leading-snug">{item.q}</span>
                  <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full border dark:border-white/10 border-gray-300 text-muted transition-transform ${openFaq === idx ? 'rotate-45' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 pt-1">
                    <p className="text-sm text-muted leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 md:mt-10 text-center">
            <p className="text-xs text-muted font-mono">
              More technical detail is available in the{' '}
              <a href={WHITEPAPER_URL} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">
                Technical White Paper
              </a>
              {' '}and the full Validation Suite.
            </p>
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
            Access the CarbonLens simulation sandbox or request a custom
            integration.
          </p>
          <button
            onClick={() => setView("auth")}
            className="px-8 py-3.5 md:py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm transition min-h-[48px] inline-flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            Access Simulation Sandbox
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
              <button
                onClick={() => scrollTo("features")}
                className="text-[10px] md:text-xs text-muted hover:text-secondary transition font-mono"
              >
                Features
              </button>
              <button
                onClick={() => scrollTo("venture")}
                className="text-[10px] md:text-xs text-muted hover:text-secondary transition font-mono"
              >
                Venture
              </button>
              <button
                onClick={() => scrollTo("faq")}
                className="text-[10px] md:text-xs text-muted hover:text-secondary transition font-mono"
              >
                FAQ
              </button>
              <a
                href="mailto:hello@carbonlens.io"
                className="text-[10px] md:text-xs text-muted hover:text-secondary transition font-mono"
              >
                Contact
              </a>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center gap-3 text-[9px] md:text-[10px] text-muted font-mono">
            <span>
              &copy; {new Date().getFullYear()} CarbonLens. All rights reserved.
            </span>
            <button
              onClick={() => setView("analytics")}
              className="opacity-50 hover:opacity-100 transition-opacity text-[9px] font-mono underline underline-offset-2"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
