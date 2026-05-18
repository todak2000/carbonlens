# CarbonLens — Researcher / Academic Use Case Walkthrough

**Context:** Teaching a CO₂ storage module in a petroleum engineering or geoscience programme. Or conducting published research on CCS.

---

## Phase 1 — What You Need to Get Started

Unlike the engineer case, you likely do **not** have LAS files or proprietary field data. You have:

| Data Category | What You Actually Have | How CarbonLens Handles It |
|---|---|---|
| Published formation data | Numbers from a paper (e.g. Celia et al., Sleipner benchmark) | Enter directly in formation panel — all fields accept manual input |
| Teaching dataset | Handout from your lecturer with T, P, porosity, salinity | Type them in. Takes 30 seconds. |
| Research data | Your own IFT lab measurements or literature values | Manual entry. Compare your lab results against CarbonLens ML predictions side-by-side. |
| No data at all | Just exploring / learning | **One-click presets** — load Sleipner, Decatur, or Otway with pre-filled, published parameters |

> **No field data? No problem.** CarbonLens is built for the parametric workflow. Start from a preset, a published paper's table, or a blank formation and explore.

---

## Phase 2 — Getting Into CarbonLens (3 Steps)

### Step 1 — Start a project
Name it something academic: `sleipner_benchmark_2026` or `student_demo_section_a`. Cloud save keeps everything between sessions.

### Step 2 — Pick your jurisdiction
For research publications, this matters less — but for context-aware teaching, toggle **EPA Class VI** (most published US examples) or **Norwegian NPD** (Sleipner is in Norwegian waters). The outputs relabel themselves automatically.

### Step 3 — Load a preset or type your data

**Teaching mode:**
Click **Load Preset** → Sleipner Formation. The panel fills with the published parameters:
- Depth: 1012 m
- Porosity: 35%
- Permeability: 3000 mD
- Temperature: 37°C
- Pressure: 10.3 MPa
- Salinity: 0.56 mol/kg

**Research mode:**
Enter your own parameters directly. Every field has a manual input — depth, T, P, porosity, permeability, salinity, geometry type. No LAS file required.

---

## Phase 3 — Build & Visualise the Reservoir

The formation renders in 3D immediately:

- **Anticline, dome, layered aquifer, or fault-bounded** — toggle geometry type and watch the 3D shape change
- Rotate, zoom, pan. Toggle 2D cross-section for publication screenshots
- Click to place 1–5 injection wells. Set well depths and injection rates
- **Teaching/showing:** switch between 3D and 2D view to explain trap geometry to students

For a publication figure, export the 3D view or 2D cross-section as PNG/SVG.

---

## Phase 4 — Run CO₂ Plume Simulation

Hit **Play**. The Web Worker runs a Darcy flow simulation on a 50×50 grid:

- Watch the CO₂ plume migrate from the well in real time
- **P10/P50/P90 envelopes** render simultaneously:
  - Blue = P10 (conservative)
  - Teal = P50 (most likely)
  - Amber = P90 (worst-case)
- Scrub through 10/20/50 year snapshots
- Pause at any timestep to capture a figure

**For your paper or thesis:**
- Export side-by-side P10/P50/P90 plume maps — this uncertainty framing is novel in published CCUS literature and reviewers will note it
- Compare your simulation extent against published plume radii from CMG GEM or TOUGH2 simulations of the same formation

---

## Phase 5 — ML Property Engine (Your Research Comparison Tool)

This is where CarbonLens earns its research value. The ML engine computes all 7 CO₂–brine properties at your formation T/P/salinity:

| Property | What You Can Do With It for Research |
|---|---|
| Interfacial Tension (IFT) | Compare against your own lab measurements. Does the ML ensemble match within experimental error? |
| CO₂ Density | Validate against Span-Wagner EOS. Tabulate P50 vs NIST reference. |
| CO₂ Viscosity | Compare to Fenghour correlation — see where ML correction changes the prediction. |
| CO₂ Solubility | Compare to Duan-Sun model. Check ML correction at high salinity. |
| Brine density | Garcia (2001) baseline vs ML — useful for a methods section. |
| Phase state | Instant go/no-go check for supercritical condition. |
| Pore pressure | Context for injection feasibility discussion. |

Every property ships with **R², RMSE, and training dataset size** displayed. You can cite the ML method directly in your paper's methodology section.

**For a thesis chapter or journal paper:**
- Run a parametric sweep (vary T from 30–120°C, record IFT at each step)
- Export the CSV → plot in Python/Matlab → label as "CarbonLens ML prediction vs Li et al. correlation"
- The sweep takes 2 minutes. The figure is publication-ready.

---

## Phase 6 — Geomechanical Analysis (For Research Papers on Storage Integrity)

Even at the research level, the geomechanical tab provides publishable outputs:

| Output | Why a Researcher Cares |
|---|---|
| Overburden stress (σv) | Baseline for any storage integrity paper |
| Fracture Pressure Gradient (FPG) | Compare to published FPG values from similar formations |
| MAIP | Context for injection feasibility discussion |
| Caprock Seal Index | Directly compare against published seal capacity estimates — show how ML IFT changes the answer |

The Caprock Seal Index is particularly valuable: it lets you show how **uncertainty in IFT propagates to uncertainty in storage security** — a novel research contribution that fits naturally in a CCUS paper.

---

## Phase 7 — Teaching a CCUS Module (Instructor Walkthrough)

If you're a professor running a 2-hour lab session:

### Before class (5 minutes of prep)
1. Open CarbonLens
2. Load **Sleipner preset**
3. Click Play. Pause at 10 years. Your demo is ready.

### In class — interactive exercises
- **Exercise 1:** "Load the Sleipner preset. Run the simulation to 20 years. Record the AoR radius at P50. Now increase permeability by 50% — what happens to the plume?"
- **Exercise 2:** "Decrease salinity from 0.56 to 0.1 mol/kg. Watch IFT change. Does the seal index increase or decrease? Explain why."
- **Exercise 3:** "Toggle from 3D to cross-section view. Identify the caprock, the injection interval, and the CO₂ plume. Describe the trapping mechanism you see."
- **Exercise 4:** "Export the property summary table. Compare the ML-predicted IFT against the published Bachu & Bennion value for these conditions. What's the % difference?"

### Student requirements
- No installation. Opens in Chrome/Firefox on any laptop.
- Free tier (Explorer) has everything needed for a 2-hour lab.
- Students can save their `.carbonlens` file and submit it with their report.

---

## Phase 8 — Export for Papers, Theses & Teaching

| What You Need | How CarbonLens Delivers It |
|---|---|
| Property summary table for thesis appendix | Export CSV. All 7 properties with P10/P50/P90 and citations. |
| Plume simulation figure for a journal paper | Export 3D view or 2D cross-section as SVG/PNG. Publication-resolution vector graphics. |
| Permeability/porosity sensitivity chart | Run the sweep, export, plot externally. |
| IFT-vs-temperature comparison plot | Export CSV from the live property dashboard — plot CarbonLens vs Li et al. vs your lab data. |
| Student assignment handouts | Use the AoR risk envelope chart as a discussion question. Export as PDF. |
| "Data availability" statement for paper | "Formation properties were loaded from published datasets [Celia 2015, Singh 2022] into the CarbonLens CO₂ Storage Simulation Studio, which computed thermophysical properties using its white-box ML ensemble (GMDH/MGGP/MARS) with bootstrap uncertainty quantification." |

---

## What CarbonLens Cannot Do Yet for Researchers (Be Transparent)

- No direct integration with Python/R for custom analysis (export CSV and process externally)
- No batch sensitivity sweeps over >100 combinations in the free tier
- No TOUGH2/CMG input file export for cross-simulator comparison (Studio tier)
- No team collaboration or shared project workspaces
- No GIS overlay for basin-scale studies

---

## Suggested Citation Format

> CarbonLens CO₂ Storage Simulation Studio (v2.0) [Computer software]. (2026). CarbonLens Ltd. https://carbonlens.io

For method-specific citation, cite the ML ensemble paper once published.

---

**Bottom line for researchers:** CarbonLens turns 30 seconds of data entry into a publication-quality plume simulation with ML-predicted properties, uncertainty quantification, and exportable figures. For teaching, it replaces a $185K/year simulator with a browser tab that 30 students can open simultaneously. For research, it provides an independent ML validation platform that you can cite in your methods section and compare against your own measurements.
