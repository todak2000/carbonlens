# CarbonLens — CCUS Permit Engineer Use Case Walkthrough

**Context:** Offshore field, unknown formation, tasked with securing a storage permit (UK NSTA or PETRONAS framework).

---

## Phase 1 — Site Data You Need to Collect First

Before touching CarbonLens, gather what data you have. Every field below can be **imported from a LAS file** OR **entered manually** if LAS is unavailable.

| Data Category | Specific Data | Typical Source | Manual Entry? |
|---|---|---|---|
| Well logs | Porosity (PHIE), bulk density (RHOB), depth (TVD), gamma ray | LAS 2.0 file | Enter values directly in formation panel |
| Reservoir properties | Temperature at depth, pore pressure, formation water salinity | Lab reports / DST | Direct input fields |
| Geometry | Formation depth, thickness, lateral extent, structural trap type | Seismic interpretation | Dropdown + number inputs |
| Permeability | Core plug measurements or NMR log | mD values | Direct entry per well |
| Caprock data | Seal lithology, thickness, known faults | Geological report | Text + numeric fields |
| Injection plan | Target injection rate, planned well count, injection interval | Engineering design | Direct input |

> **No LAS file? No problem.** All inputs have manual fallback fields. The parametric builder accepts typed values for every parameter — you never need a well log to start a simulation.

---

## Phase 2 — Getting Into CarbonLens (3 Steps)

### Step 1 — Start or load a project
New project → name it → your workspace is ready. Or load a `.carbonlens` file from a previous session. Cloud save restores everything — no lost work.

### Step 2 — Pick your jurisdiction
Toggle: **EPA Class VI** / **UK NSTA** / **Norwegian NPD** / **PETRONAS Malaysia**

This sets all output labels, unit systems (MPa vs psi, TVDss vs KB), and the permit template structure that generates at the end.

### Step 3 — Import LAS or enter data manually

**If you have a LAS 2.0 file:**
Drop your LAS 2.0 file. The parser auto-extracts:
- TVD → formation depth
- PHIE → porosity
- RHOB → overburden stress calculation
- Temperature gradient → reservoir T at depth

CarbonLens maps these to formation panel inputs automatically. You confirm or reassign unrecognised curves.

**If you don't have a LAS file:**
Enter the same values directly in the formation panel. Every parameter a LAS file would populate has a corresponding manual input field:
- Depth (m) — type it in
- Porosity (%) — type it in
- Bulk density (g/cc) — type it in (for overburden stress)
- Temperature gradient (°C/km) — type it in

Both paths converge to the same reservoir model. The 3D renders identically either way.

---

## Phase 3 — Build the Reservoir Model

**Formation panel inputs** (parametric or LAS-populated, or manual):
- Depth (m), thickness (m), temperature (°C), pressure (MPa)
- Porosity (%), permeability (mD), formation water salinity (mol/kg NaCl)
- Geometry type: anticline / dome / layered aquifer / fault-bounded
- **One-click load** a validated preset (Sleipner, Decatur, Otway) as a benchmark or starting point

**3D visualisation:**
- Three.js renders your formation live as you change parameters
- Click directly on the 3D surface to place injection wells (up to 5 in PoC)
- Set well depth, injection rate, perforation interval per well
- Toggle 2D cross-section view (D3.js) — shows formation layers, caprock line, well symbol

Every parameter change updates the 3D model in real time.

---

## Phase 4 — Run CO₂ Plume Simulation

Hit **Play**. The Web Worker engine runs a Darcy flow simulation on a 50×50 grid:

- CO₂ plume animates outward from injection well(s)
- Colour map: 0% saturation = formation colour → 100% saturation = red
- **P10/P50/P90 uncertainty envelopes** render as three overlaid contours:
  - Blue = P10 (conservative, small plume)
  - Teal = P50 (most likely)
  - Amber = P90 (worst-case, largest plume)
- Playback controls: Play / Pause / Reset, timestep slider, years elapsed
- Scrub through 10 / 20 / 50 year snapshots

The plume extents directly define your **Area of Review (AoR)** — the regulatory boundary within which you must assess impacts.

---

## Phase 5 — ML Property Engine (Runs Live, Updates Everything)

As you change T / P / salinity, CarbonLens's ML engine recalculates all 7 CO₂ properties in real time:

| Property | Why It Matters for Your Permit |
|---|---|
| Interfacial Tension (IFT) | Controls caprock seal capacity — directly feeds seal index |
| CO₂ Density | Determines buoyancy forces, plume rise rate |
| CO₂ Viscosity | Controls flow velocity, sweep efficiency |
| CO₂ Solubility | Quantifies dissolution trapping — long-term storage security |
| Brine density | Pressure gradient calculations |
| Phase state | Is CO₂ supercritical at your reservoir conditions? It must be |
| Pore pressure | Injection feasibility, MAIP threshold |

Each property shows P50 ± uncertainty range with the source citation — audit-ready.

---

## Phase 6 — Geomechanical Module (Permit-Critical)

This is what regulators scrutinise most. The geomechanical tab computes:

| Output | What You Submit | CarbonLens Method |
|---|---|---|
| Overburden stress (σv) | Mechanical integrity baseline | Integrated RHOB from LAS or 22.6 MPa/km default |
| Min. horizontal stress (σh) | Fracture propagation threshold | Eaton (1969) correlation |
| Fracture Pressure Gradient (FPG) | Injection pressure ceiling | σh / depth, shown as MPa/m and psi/ft |
| MAIP | Maximum Allowable Injection Pressure | FPG × depth × 0.9 safety factor |
| Caprock Seal Index | How much CO₂ the caprock can hold | CO₂ column height = (2γ cosθ)/(r ρg), fed by live ML IFT output |

The seal index updates live as your ML IFT changes — if you change salinity, the seal capacity recalculates instantly. No other web tool does this.

---

## Phase 7 — Sensitivity Analysis & Parameter Changes

This is where you make informed decisions:

- **Change injection rate** → watch AoR expand/contract in 3D
- **Change salinity** → ML recalculates IFT → seal index updates → know if you're safe
- **Adjust depth** → MAIP recalculates → know your injection pressure budget
- **Adjust porosity** → plume size changes → AoR boundary shifts
- **Drag the uncertainty sigma slider** → P10/P90 envelopes widen/narrow → understand risk range

Every change is non-destructive. Save checkpoints as `.carbonlens` files or cloud-save mid-session.

---

## Phase 8 — Export Everything for Your Permit Application

Hit **Export Permit Report** (PDF, jurisdiction-matched template):

| Section | Content |
|---|---|
| Site Characterisation | Formation parameters table with units, sources, LAS file reference |
| Reservoir Model | 3D geometry description, geometry type, well count and specifications |
| CO₂ Property Summary | All 7 ML-predicted properties at reservoir conditions, P10/P50/P90 bounds, citations |
| Plume Simulation Results | AoR extents at 10 / 20 / 50 years (P10/P50/P90), plume maps |
| Geomechanical Analysis | σv, σh, FPG, MAIP — all with calculation method references |
| Caprock Seal Integrity | Seal index, CO₂ column height, IFT source |
| Injection Parameters | Rate, depth, perforation interval, well count |
| Regulatory Compliance Table | Auto-formatted to your selected jurisdiction (EPA / NSTA / NPD / PETRONAS) |

The jurisdiction toggle reformats the entire output: EPA uses AoR + psi; NSTA uses plume footprint + MPa; NPD uses Norwegian Petroleum Act structure; PETRONAS uses PETRONAS CCS framework labels.

---

## What CarbonLens Cannot Do Yet (Transparent with Your Client)

- No pipeline sizing or transport calculations
- No GIS shapefile overlay of your field boundary
- No multi-well dataset batch analysis
- No TOUGH2/CMG simulator export
- No team collaboration or version control
- No full MMV (monitoring, measurement, verification) plan

These are real permit requirements — for the full permit package, CarbonLens covers the **storage assessment** and **geomechanical** sections. Other tools or consultants handle the capture and transport sections.

---

**Bottom line:** CarbonLens takes you from raw LAS file (or manual data) → 3D reservoir model → CO₂ plume simulation → ML property analysis → MAIP calculation → jurisdiction-formatted permit export. Every parameter is adjustable, every output is traceable to a source, and the report is ready to hand to a regulator.
