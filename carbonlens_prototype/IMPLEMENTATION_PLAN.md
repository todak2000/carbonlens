# Dubai Prototype — Implementation Plan
## CarbonLens v3 → Competition-Ready Prototype
**Competition:** Prototypes for Humanity 2026, Dubai Future Forum
**Submission Deadline:** August 1, 2026
**Today:** June 9, 2026
**Available Time:** ~7.5 weeks

---

## Scope Statement

The Dubai prototype IS the current CarbonLens v3 codebase, enhanced with:
1. Critical bug fixes (broken features cannot be demoed)
2. New formation presets covering all target regions
3. A competition-facing entry experience
4. A decision-maker PDF export
5. A self-running demo mode for the exhibition stand
6. A clean live deployment URL

The Dubai prototype is NOT a rebuild. No new physics. No new ML models. No new simulation algorithms. The MSc MARS IFT model is the scientific centrepiece — everything else serves to demonstrate the platform that was built around it.

**Working directory for all new code:** `v3/carbonlens_v3_poc/`
**No copy or rebuild.** All changes — bug fixes, new presets, new components — go directly into the existing v3 codebase. `carbonlens_prototype/` contains planning documents and application materials only.

---

## Phase 0 — Critical Bug Fixes
**Target: Week 1 (Jun 9–15)**
**Why first:** A buggy demo undermines academic credibility. These must be fixed before anything else is shown.

---

### BUG-01: CO₂ Viscosity — Wrong Functional Form
**Severity:** High — affects injection pressure and MAIP calculations
**File:** `src/engine/classical/viscosity.ts`
**Problem:** Current implementation uses an undocumented custom polynomial, not the published Fenghour et al. (1998) correlation. This was flagged in the poc_audit.
**Fix:** Implement the correct two-step Fenghour (1998) formulation:
- Step 1: Zero-density limit `η₀(T)` using `ln(η₀) = Σ aᵢ(T*/T)^i` with T* = 251.196 K
- Step 2: Density correction `Δη(ρ,T)` using polynomial in density
- Requires Span-Wagner CO₂ density as input (already computed in `density.ts`)
**Reference:** Fenghour, Wakeham & Vesovic, *J. Phys. Chem. Ref. Data*, 27(1), 1998, pp. 31–44
**Acceptance criteria:** Viscosity at 50°C, 15 MPa matches published value of ~0.0724 mPa·s ±2%

---

### BUG-02: Mineral Trapping Always Reports Zero
**Severity:** Medium — trapping budget incorrect for long-timescale scenarios
**File:** `src/engine/plume/` (trapping calculation)
**Problem:** The mineral trapping term is computed but never assigned to the output object — audit item P10
**Fix:** Trace the mineral trapping calculation through the solver and ensure `mineralTrapping` is correctly assigned to `SimulationResult`
**Acceptance criteria:** For a 100-year simulation at Sleipner conditions, mineral trapping reports a non-zero value (expected: 1–3% of injected CO₂)

---

### BUG-03: Dual Solver Results Not Connected
**Severity:** High — grid solver runs but results never appear in output
**File:** `src/engine/index.ts` and `src/hooks/useSimulation.ts`
**Problem:** The analytical solver and grid solver run independently. Grid-computed trapping values are never fed into the final `SimulationResult` — audit item P5
**Fix:** After grid solver completes, merge grid trapping outputs into the final result object. If grid solver fails, fall back to analytical results with a warning flag.
**Acceptance criteria:** Running simulation with grid mode produces trapping breakdown values that differ from analytical-only run

---

### BUG-04: 3D Viewer Caprock Positioning
**Severity:** Low-Medium — visual credibility issue for exhibition
**File:** `src/components/ThreeViewer/ReservoirViewer.tsx` or `CaprockMesh.tsx`
**Problem:** Caprock Y position is hardcoded incorrectly — audit item P10
**Fix:** Derive caprock Y position from formation depth and thickness parameters dynamically
**Acceptance criteria:** 3D viewer shows caprock mesh correctly positioned above the reservoir for all 8 existing formation presets

---

## Phase 1 — Formation Presets (7 New Formations)
**Target: Week 1–2 (Jun 9–22)**
**Why:** These anchor the impact narrative and demonstrate global relevance to judges

**File to modify:** `v3/carbonlens_v3_poc/src/data/formationPresets.ts`

All geological parameters are already researched and documented in `carbonlens_prototype/formations/`. This is data entry work, not engineering.

### PRESET-01: Malay Basin (Malaysia)
```typescript
{
  name: "Malay Basin",
  country: "Malaysia",
  depth: 1500, thickness: 50, porosity: 0.25, permeability: 250,
  temperature: 75, pressure: 15,
  monovalentSalinity: 30000, bivalentSalinity: 2000,
  area: 100, netToGross: 0.65, geometryType: "anticline",
  caprockFriction: 30, caprockCohesion: 5, biotCoefficient: 0.75,
  description: "Deltaic sandstone aquifer, South China Sea. PETRONAS operational domain."
}
```

### PRESET-02: Niger Delta Basin (Nigeria)
```typescript
{
  name: "Niger Delta Basin",
  country: "Nigeria",
  depth: 1800, thickness: 60, porosity: 0.30, permeability: 800,
  temperature: 80, pressure: 18,
  monovalentSalinity: 35000, bivalentSalinity: 1500,
  area: 200, netToGross: 0.72, geometryType: "dome",
  caprockFriction: 25, caprockCohesion: 4, biotCoefficient: 0.80,
  description: "Agbada Formation sandstone. Akata shale caprock. Sub-Saharan Africa's largest storage potential."
}
```

### PRESET-03: North Sumatra Basin (Indonesia)
```typescript
{
  name: "North Sumatra Basin",
  country: "Indonesia",
  depth: 1600, thickness: 45, porosity: 0.22, permeability: 200,
  temperature: 78, pressure: 16,
  monovalentSalinity: 40000, bivalentSalinity: 2500,
  area: 150, netToGross: 0.55, geometryType: "anticline",
  caprockFriction: 28, caprockCohesion: 4.5, biotCoefficient: 0.78,
  description: "Under Indonesia's CCS Law (2023). SKK Migas priority basin."
}
```

### PRESET-04: Nile Delta (Egypt)
```typescript
{
  name: "Nile Delta",
  country: "Egypt",
  depth: 2200, thickness: 70, porosity: 0.24, permeability: 300,
  temperature: 90, pressure: 22,
  monovalentSalinity: 65000, bivalentSalinity: 4000,
  area: 400, netToGross: 0.62, geometryType: "stratigraphic",
  caprockFriction: 35, caprockCohesion: 8, biotCoefficient: 0.72,
  description: "Messinian evaporite caprock — exceptional seal quality. Egypt hosted COP27."
}
```

### PRESET-05: Abu Dhabi Basin (UAE) ← HIGHEST PRIORITY
```typescript
{
  name: "Abu Dhabi Basin",
  country: "UAE",
  depth: 2800, thickness: 80, porosity: 0.16, permeability: 120,
  temperature: 110, pressure: 28,
  monovalentSalinity: 180000, bivalentSalinity: 12000,
  area: 500, netToGross: 0.55, geometryType: "dome",
  caprockFriction: 38, caprockCohesion: 10, biotCoefficient: 0.65,
  description: "Al Reyadah CCS project formation. ADNOC operational since 2016. 800K tCO₂/year injected."
}
```

### PRESET-06: Rotterdam / North Sea (Netherlands)
```typescript
{
  name: "Rotterdam / North Sea",
  country: "Netherlands",
  depth: 3100, thickness: 65, porosity: 0.22, permeability: 120,
  temperature: 108, pressure: 31,
  monovalentSalinity: 200000, bivalentSalinity: 14000,
  area: 300, netToGross: 0.65, geometryType: "layered",
  caprockFriction: 32, caprockCohesion: 7, biotCoefficient: 0.73,
  description: "Porthos CCS project. EU flagship — Shell, ExxonMobil, Air Liquide injecting from 2026."
}
```

### PRESET-07: Alberta Basin (Canada)
```typescript
{
  name: "Alberta Basin",
  country: "Canada",
  depth: 2200, thickness: 50, porosity: 0.14, permeability: 50,
  temperature: 75, pressure: 22,
  monovalentSalinity: 250000, bivalentSalinity: 18000,
  area: 1000, netToGross: 0.65, geometryType: "layered",
  caprockFriction: 30, caprockCohesion: 6, biotCoefficient: 0.70,
  description: "Quest CCS project (Shell/ADNOC/Chevron). Operational since 2015. >7 Mt CO₂ injected."
}
```

**Acceptance criteria:** All 7 presets load without errors, run simulation to completion, produce geologically plausible outputs. Total formation count in selector: 15.

---

## Phase 2 — Impact Onboarding Screen
**Target: Week 2–3 (Jun 16–29)**
**Why:** First impression for judges. Must communicate the problem before they touch anything.

**New file:** `src/components/LandingScreen/LandingScreen.tsx`
**Modified file:** `src/main.tsx` or `src/App.tsx` — show LandingScreen before auth

### Layout Spec
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   [Dark background, full screen]                        │
│                                                         │
│   The most rigorous CO₂ storage screening tools         │
│   cost $200,000 per year.                               │
│                                                         │
│   [World map SVG — dots on storage potential regions]   │
│   [Few bright dots = affordable tools today]            │
│   [Many faint dots = identified geology, no tools]      │
│                                                         │
│   Enterprise CCS screening:  $160K–$230K / year         │
│   CarbonLens:                $0                         │
│                                                         │
│   [Button: → Screen a Formation]                        │
│                                                         │
│   Developed at Universiti Teknologi PETRONAS, Malaysia  │
│   Validated against Sleipner field data · SPE11A bench  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Technical Notes
- World map: use a simple inline SVG (Natural Earth / Robinson projection), no external library
- Dots: hardcoded SVG circles at approximate lat/lon for ~15 storage regions (bright) and ~5 active tool regions (dim)
- Stat block: large monospace font, matches existing IBM Plex Mono theme
- "Screen a Formation" button: navigates to main app, bypassing login in demo mode
- On mobile: hide map, show only stat block and CTA

**Acceptance criteria:** Screen displays correctly on 1920×1080 and 1280×720. Button navigates to main app. No external dependencies added.

---

## Phase 3 — Executive Summary PDF Export
**Target: Week 3–4 (Jun 23–Jul 6)**
**Why:** The one-page output that gets shown to ministers and investors, not engineers.

**New file:** `src/utils/exportExecutiveSummary.ts`
**Modified file:** `src/components/PermitExport/ExportPanel.tsx` — add "Executive Summary" button alongside existing exports

### Output Spec (Single A4 page, jsPDF)

```
┌──────────────────────────────────────────────────┐
│ CarbonLens          CO₂ Storage Screening Report │
│                                   [Date]         │
├──────────────────────────────────────────────────┤
│ FORMATION: Niger Delta Basin, Nigeria            │
├──────────────────────────────────────────────────┤
│                                                  │
│  ✓  VIABLE FOR CO₂ STORAGE                       │  ← coloured verdict box
│     Recommended for detailed feasibility study   │
│                                                  │
├────────────────┬───────────────┬─────────────────┤
│ STORAGE        │ SAFETY        │ INJECTION       │
│ P50: 245 Mt    │ MODERATE      │ Within bounds   │
│ P10–P90:       │ SF: 1.8       │ 18.2 MPa        │
│ 180–310 Mt     │               │ MAIP: 22.4 MPa  │
├──────────────────────────────────────────────────┤
│ CO₂ TRAPPING AFTER 100 YEARS                     │
│ Residual    ████████████  48%                    │
│ Solubility  ██████████    38%                    │
│ Mobile      ████          14%                    │
├──────────────────────────────────────────────────┤
│ RECOMMENDATIONS                                  │
│ 1. [auto-generated from results]                 │
│ 2. [auto-generated from results]                 │
│ 3. [auto-generated from results]                 │
├──────────────────────────────────────────────────┤
│ Generated by CarbonLens · carbonlens.app         │
│ ML model: UTP Malaysia MSc research              │
│ Validated: Sleipner field data, SPE11A benchmark │
│ For screening only — full feasibility required   │
└──────────────────────────────────────────────────┘
```

### Verdict Logic
```typescript
function getVerdict(result: SimulationResult, geo: GeomechanicsResult): Verdict {
  if (result.containmentProbability > 0.75 && geo.safetyFactor > 1.5)
    return { label: "VIABLE", colour: "#22c55e", sub: "Recommended for detailed feasibility study" }
  if (result.containmentProbability > 0.5 || geo.safetyFactor > 1.0)
    return { label: "NEEDS FURTHER STUDY", colour: "#f59e0b", sub: "Additional data required before proceeding" }
  return { label: "NOT RECOMMENDED", colour: "#ef4444", sub: "Significant risks identified — consult specialist" }
}
```

### Auto-Generated Recommendations Logic
- If safetyFactor < 1.8: "Conduct geomechanical study to verify caprock integrity before injection"
- If monovalentSalinity > 100,000: "Formation brine salinity requires laboratory sampling to refine IFT prediction"
- If plumeRadius > 3000: "Large plume radius projected — verify lateral caprock extent with 3D seismic"
- If containmentProbability < 0.85: "Storage efficiency below threshold — evaluate alternative injection rates"
- If storageCapacity > 100: "Storage capacity economically attractive — proceed to full feasibility"

**Acceptance criteria:** Clicking "Executive Summary" generates a downloadable single-page PDF for any formation. Verdict colour matches risk level. All values pull from current simulation result.

---

## Phase 4 — Demo Mode
**Target: Week 4 (Jun 30–Jul 6)**
**Why:** Exhibition stand will be unattended. The 3D plume animation is the strongest visual asset.

**New file:** `src/components/DemoMode/DemoMode.tsx`
**Modified file:** `src/App.tsx` — add `?demo=true` URL param triggers demo mode

### Behaviour
1. Auto-load Abu Dhabi Basin preset (or Sleipner — decide before build)
2. Auto-run simulation without user input (2-second delay after load)
3. Cycle every 8 seconds through:
   - **Scene 1:** 3D plume viewer (fullscreen, animation playing)
   - **Scene 2:** Overview panel — key metrics (capacity, safety factor, trapping)
   - **Scene 3:** Geomechanics panel — Mohr-Coulomb diagram
   - **Scene 4:** Executive Summary PDF preview
   - → Loop back to Scene 1
4. Persistent overlay (bottom of screen, non-intrusive):
   ```
   CarbonLens  ·  Real geological data  ·  Peer-validated physics  ·  Running in your browser
   ```
5. Any mouse click or keyboard press exits demo mode and returns to normal app

**Acceptance criteria:** Demo mode runs continuously without user input for 60+ minutes without crash, freeze, or memory leak. Exit on click works reliably.

---

## Phase 5 — Methodology Panel & Academic Attribution
**Target: Week 5 (Jul 7–13)**
**Why:** Directly scores the academic rigour criterion in the application form.

**Modified file:** `src/components/MethodologyPanel/MethodologyPanel.tsx`

### Additions
1. **ML Model section** — explicit attribution:
   > "Interfacial tension is predicted using a MARS (Multivariate Adaptive Regression Splines) model developed from 3,265 experimental CO₂-brine datapoints compiled from 16 independent laboratories. The model was developed and validated at Universiti Teknologi PETRONAS, Malaysia, using a Cross-Laboratory External Validation framework. Conformal prediction intervals are provided at the 80% confidence level."

2. **Validation summary** — add a table:
   | Benchmark | Metric | CarbonLens | Literature |
   |---|---|---|---|
   | Sleipner (Chadwick et al. 2004) | Plume radius at year 8 | ~600 m | ~600 m |
   | SPE11A | Storage efficiency | ~0.58 | 0.55–0.65 |
   | IFT (supercritical, external validation) | nRMSE | 5.62% | — |

3. **Full reference list** — all 12 peer-reviewed sources cited in the engine

4. **Limitations statement** — what the prototype does not yet include (contact angle model, impure CO₂ streams, full geochemistry) — this is honest and protects against over-claiming

**Acceptance criteria:** Methodology panel loads and displays all sections. References are formatted consistently.

---

## Phase 6 — Deployment & Polish
**Target: Week 6 (Jul 14–20)**
**Why:** Judges need a live link. The app must be fast, stable, and visually clean.

### Deployment
- Deploy to Vercel (preferred) or Netlify for clean URL
- Target URL: `carbonlens.vercel.app` or `demo.carbonlens.app`
- Must be accessible without VPN, login, or installation
- Test on Chrome, Firefox, Safari, Edge

### Performance Checks
- Initial load under 5 seconds on standard broadband
- 3D viewer maintains ≥30 fps during animation
- Simulation runs in under 3 seconds for standard formation

### Visual Polish
- Verify all 15 formation presets display correctly in the selector
- Verify all 5 jurisdiction permit exports generate without error
- Verify 3D viewer caprock positioning fix (BUG-04) looks correct for all geometries
- Dark mode is default — verify contrast ratios on all text elements

**Acceptance criteria:** App loads, runs, and exports on all 4 major browsers. URL is stable and accessible. No console errors on standard workflow.

---

## Phase 7 — Application Materials
**Target: Week 6–7 (Jul 14–Aug 1)**
**Why:** The application text, screenshots, and video are as important as the prototype itself.

### Deliverables
- [ ] Competition form completed at prototypesforhumanity.com
- [ ] Supervisor name, title, email added to form
- [ ] 5 high-resolution screenshots (1920×1080):
  - Onboarding screen (world map + stat block)
  - Formation input panel with Abu Dhabi preset loaded
  - 3D plume viewer mid-animation
  - Geomechanics panel (Mohr-Coulomb diagram)
  - Executive Summary PDF output
- [ ] System architecture diagram (hand-drawn or Excalidraw — clear and well-labelled)
- [ ] Demo video (2:30 max) — script at `application/video_script.md`
- [ ] Detailed project PDF — use `application/application_form_answers.md` as base
- [ ] Live URL included in application

---

## What Is Explicitly Out of Scope

Do not build any of the following for the Dubai prototype. These belong to the PhD:
- Contact angle ML model
- Improved solubility model for divalent brines
- Impure CO₂ PVT models
- Joint uncertainty propagation to P10/P50/P90
- Full 3D compositional flow (MRST backend)
- Cloud compute backend
- Real-time collaboration / multi-user
- Supabase authentication (mock auth is fine for prototype)
- Eclipse .DATA file import

---

## Full Timeline

| Week | Dates | Phase | Key Output |
|---|---|---|---|
| 1 | Jun 9–15 | Bug fixes (BUG-01 to BUG-04) + Formation presets (all 7) | Working engine + 15 formations |
| 2 | Jun 16–22 | Impact onboarding screen | Landing screen live |
| 3 | Jun 23–29 | Executive Summary PDF export (structure + logic) | PDF exports working |
| 4 | Jun 30–Jul 6 | Executive Summary polish + Demo mode | Demo mode running |
| 5 | Jul 7–13 | Methodology panel + end-to-end test pass | All features complete |
| 6 | Jul 14–20 | Deployment + visual polish + screenshots | Live URL + assets ready |
| 7 | Jul 21–Aug 1 | Application writing + video + supervisor review + submit | Submitted |

---

## Approval Checklist

Before development begins, confirm:

- [ ] Supervisor has reviewed `MSC_PHD_DISTINCTION.md` and signed off
- [ ] Supervisor name confirmed for competition application form
- [ ] Daniel approves the scope (what's in, what's out)
- [ ] Working directory confirmed: `carbonlens_prototype/src/` based on v3 codebase
- [ ] Live URL strategy confirmed (Vercel vs Netlify vs GitHub Pages with custom domain)
- [ ] Demo mode formation confirmed (Abu Dhabi Basin recommended — Dubai relevance)

---

*Once approved, development begins with Phase 0 Bug Fixes.*
