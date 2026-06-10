# CarbonLens User Manual
### Browser-based CO₂ Storage Screening & Simulation Studio
**Version 3 — POC Release**

---

## What Is CarbonLens?
 
CarbonLens is a fully browser-based CO₂ storage assessment studio. No installation. No backend server. Every calculation — thermodynamics, geomechanics, simulation — runs live in your browser using scientific models calibrated against published field data.

It takes a geologist or engineer from raw formation parameters to a regulator-ready screening report in one session.

---

## Who Is This For?

### Government Agency / Regulatory Body
*"We need to assess our country's CCS storage potential and evaluate permit applications."*

Your workflow:
1. **Overview** → understand the project scope and CO₂ status
2. **Formation** → load a preset formation in your jurisdiction (e.g. Malay Basin, Niger Delta, Nile Delta) or enter your own well data
3. **Geomechanics** → confirm injection pressures stay below MAIP — this is your regulatory safety gate
4. **Simulation** → run storage capacity estimates (DOE P10/P50/P90 range) with trapping analysis
5. **Leakage** → review legacy well cement integrity risk in the Area of Review
6. **Screening** → get a red/amber/green bankability and site readiness score
7. **Jurisdiction** → toggle your regulatory framework (EU ETS, US EPA Class VI, Malaysia PCPP)
8. **Export** → download the executive summary PDF and permit pre-application report

**What CarbonLens gives you:**
- Independent capacity estimates not supplied by the project developer
- Geomechanical risk flags before a permit is considered
- A defensible audit trail (DOE Goodman 2011 methodology, cited references)

---

### Research / Academic Group
*"We are studying CCS feasibility and CO₂ behaviour in saline aquifers."*

Your workflow:
1. **Formation** → set formation parameters, or load one of the 16 real-world presets (Sleipner, Johansen, Snøhvit, In Salah, SPE11, etc.)
2. **Properties** → inspect Span-Wagner EOS outputs: CO₂ density, viscosity, solubility, diffusion coefficient, IFT — at your formation's T/P conditions
3. **Geology** → define stratigraphy, facies, fault planes, and caprock geometry for the 3D visualiser
4. **Simulation** → run the plume model; watch residual/solubility/mineral trapping evolve over time
5. **Validation** → compare your results against Sleipner field data (Boait 2012, Furre 2017), or run the physics sanity suite and preset analytical benchmarks
6. **History Matching** → calibrate the model against observed field data (e.g. seismic-derived plume areas)
7. **Methodology** → read the scientific basis for every calculation; all equations are cited

**What CarbonLens gives you:**
- In-browser ML-augmented property prediction (MARS model, trained on CCS thermodynamic data)
- Physics sensitivity validation: confirm that halving thickness halves P50 capacity within ±15%
- Benchmark reproducibility: Sleipner plume radius comparison at years 4, 8, 12
- Export simulation time-series as JSON/Excel for external analysis

---

### Petroleum / CCUS Engineer
*"I need to size an injection project, assess geomechanical risk, and produce a screening report for a client."*

Your workflow:
1. **Formation** → load the target formation preset (e.g. Gorgon, Alberta Basin, Abu Dhabi) — wells are auto-optimized to the maximum safe injection rate
2. **Geomechanics** → review 6-check geomechanical risk assessment: caprock integrity, safety factor, Mohr-Coulomb failure, MAIP margin; use the optimizer to find the safe injection rate automatically
3. **Simulation** → run the full dynamic simulation with animated plume growth, trapping evolution, DOE capacity range
4. **Economics** → estimate NPV, breakeven carbon price, CapEx/OpEx, and project IRR
5. **Leakage** → quantify legacy well risk in the AoR; add well count and cement condition data
6. **Monte Carlo** → propagate uncertainty across all input parameters to generate probability distributions of capacity and containment
7. **Registry** → log the project to the storage registry with location, operator, and status
8. **Export** → generate the full export package: executive PDF, permit pre-application, JSON data, Excel time-series, 3D viewer screenshot

**What CarbonLens gives you:**
- Validated pressure model (Theis radial flow with multi-well superposition)
- Auto-optimizer that finds the maximum injection rate consistent with caprock safety
- PwC/Deloitte-grade executive summary PDF (light theme, print-safe, cited methodology)
- Regulatory permit pre-application template — pre-filled from your simulation data

---

## Panel-by-Panel Reference

### 1. Overview
**What it is:** Project dashboard showing active wells, status, and a summary of the last simulation result.

**Key actions:** Create/load a project, set project name, review stored CO₂ and capacity utilisation at a glance.

**For agencies:** Quick audit snapshot before diving into detail panels.

---

### 2. Properties (Fluid Properties)
**What it is:** Real-time CO₂ and brine property calculator using:
- **Span-Wagner EOS** for CO₂ density and viscosity
- **Duan-Sun model** for CO₂ solubility in brine
- **Garcia (2001)** for brine density
- **MARS ML model** for interfacial tension (IFT)

**Key outputs:** CO₂ density (kg/m³), CO₂ viscosity (Pa·s), brine density, IFT (mN/m), CO₂ solubility (mol/kg brine), diffusion coefficient

**Why it matters:** Storage capacity is proportional to CO₂ density. A formation at 100°C/28 MPa stores considerably less CO₂ per cubic metre than one at 37°C/10 MPa. This panel tells you exactly how much.

**For researchers:** Applicability domain (AD) assessment flags when your T/P/salinity conditions are outside the MARS model's training domain — outputs are marked accordingly.

---

### 3. Formation
**What it is:** Primary input panel for geological parameters and well configuration.

**Parameters:**
| Parameter | What it controls |
|-----------|-----------------|
| Depth (m) | Reservoir pressure, temperature gradient, CO₂ phase |
| Thickness / Storage Interval (m) | Linear effect on storage capacity (P50 ∝ h) |
| Porosity (fraction) | Linear effect on storage capacity (P50 ∝ φ) |
| Permeability (mD) | Injection pressure (ΔP ∝ 1/k) — not capacity |
| Area (km²) | Linear effect on storage capacity (P50 ∝ A) |
| Net-to-Gross | Used in containment probability; capacity uses gross pore volume per DOE |
| Pressure / Temperature | CO₂ density, phase state, Mohr-Coulomb calculations |
| Salinity | CO₂ solubility (higher salinity → lower solubility) |

**Presets:** 16 real-world formations. The active preset is highlighted in solid accent colour with a white dot and a pulsing indicator card below. Selecting a preset auto-optimizes your wells.

**Wells:** Add up to 5 injection wells. Each well has an injection rate, ramp-up/ramp-down schedule, and position in the reservoir.

**Important:** Thickness and porosity directly scale P50 capacity. Permeability affects injection pressure but NOT capacity. This is a common confusion — the simulator respects the DOE Goodman 2011 framework.

---

### 4. Geology
**What it is:** 3D geological model builder. Define stratigraphy (rock layers), faults, caprock geometry, and facies distribution.

**Key actions:** Add geological layers with lithology (sandstone, shale, carbonate), set fault planes, toggle caprock geometry. The model feeds the 3D reservoir viewer.

**For engineers:** Use this to visually confirm the structural trap before running simulation.

---

### 5. Geomechanics
**What it is:** Geomechanical risk assessment for the injection scenario.

**6 safety checks:**
| Check | What it tests | Pass condition |
|-------|--------------|----------------|
| Caprock fracture ratio | Injection P vs caprock fracture P | Ratio < 0.9 |
| Safety factor | Total stress vs effective stress | SF ≥ 1.5 |
| Mohr-Coulomb failure | Shear stress on caprock | Margin > 0 MPa |
| MAIP margin | How close to Maximum Allowable Injection Pressure | > 20% headroom |
| Shear reactivation | Fault slip potential | Low risk |
| Surface heave | Induced uplift | < 5 mm |

**MAIP definition:** `0.9 × fracture pressure` — the regulatory standard (Hubbert-Willis). Sleipner injects at ~50% of fracture pressure.

**Auto-optimizer:** If checks fail, the "Apply Safe Rate" button recalculates and applies the maximum well rates that satisfy all 6 constraints simultaneously.

**Connected to Formation:** When you change injection rate in the Formation panel, Geomechanics updates instantly. The Theis pressure model uses your full injection rate (no ramp factor — safety validation always checks peak rate as worst case).

---

### 6. Simulation
**What it is:** Dynamic CO₂ plume simulation with animated results.

**Engine:** Theis transient radial flow (multi-well superposition) + Span-Wagner EOS + DOE Goodman 2011 capacity framework.

**Key outputs:**
| Output | Definition |
|--------|-----------|
| Stored CO₂ (Mt) | Cumulative injection at current year |
| P50 Capacity (Mt) | DOE statistical estimate: A × h × φ × 2.0% × ρ_CO₂ |
| DOE Range | P90 (conservative) / P50 (best) / P10 (optimistic) |
| Utilisation (%) | Stored / P50 — > 100% signals overpressure risk |
| Stor. Eff. | Always 2.0% Cc — shown for transparency (DOE Goodman 2011) |
| CO₂ Trapping | Residual (pore snap-off), Dissolved (into brine), Mineral (geochemical), Mobile (still migrating) |

**P10/P90 convention:** CarbonLens uses **petroleum engineering convention**: P10 = optimistic (only 10% of outcomes exceed this), P90 = conservative (90% exceed this). This is the opposite of the raw DOE Cc coefficient ordering — the display has been corrected.

**Run controls:** Play, Pause, Resume, Stop, Re-run, speed multiplier (1×–10×)

**Lock Baseline:** After a complete run, click "Baseline" to lock the result. Then modify a parameter and re-run — the Validation panel's Δ Params tab will show whether the change produced the physically expected outcome.

---

### 7. History Matching
**What it is:** Calibrates the simulator against observed field data (e.g. CO₂ plume area from seismic surveys).

**How it works:** Runs the forward model at multiple parameter combinations (permeability, porosity, injection rate) and minimises the mismatch between simulated and observed outputs.

**For researchers:** Use with Sleipner seismic data (Layer 9 area vs time) to demonstrate model calibration. The matched parameters are more defensible than raw estimates.

---

### 8. Economics
**What it is:** Financial feasibility model for the CCS project.

**Key outputs:** Total CapEx, OpEx/year, NPV at various carbon prices, breakeven CO₂ price ($/tonne), project IRR.

**For agencies:** Use to assess whether a proposed project is financially viable at your jurisdiction's carbon price. A project that requires $180/tonne to break even at current $50/tonne prices needs policy support.

**For engineers:** Quick client-facing sanity check before a full techno-economic study.

---

### 9. Leakage
**What it is:** Legacy well leakage risk assessment in the Area of Review (AoR).

**Risk factors:** Number of legacy wells, cement condition (0 = failed, 1 = excellent), well age, injection pressure drive (ΔP above reservoir pressure increases leakage drive through old well pathways).

**Key rule:** Zero wells in the AoR = zero leakage pathway risk (green banner confirms this). The cement factor only activates if legacy wells exist.

**For agencies:** This is the AoR analysis required by most regulatory frameworks. A high leakage risk score (>400) should trigger additional cement remediation requirements before permitting.

---

### 10. Screening
**What it is:** Bankability and site readiness scorecard.

**Output:** Red / Amber / Green assessment across capacity, injectivity, seal integrity, economic viability, and regulatory readiness — the same framework CCS investment committees use.

**For agencies:** Use this to triage multiple site applications — green sites advance, amber sites need conditions, red sites are rejected at screening.

**For researchers:** Provides a structured framework to report CCS site assessments in publications.

---

### 11. Registry
**What it is:** Project storage registry log.

**What it stores:** Operator name, location coordinates, formation name, injected volumes, project status (exploratory / active / closed), monitoring data.

**Why it matters:** Most national CCS regulatory frameworks (EU CCS Directive, US EPA Class VI, Malaysia PCPP) require operators to maintain and report to a national CO₂ storage registry. This panel generates the reporting data in a standard format.

---

### 12. Jurisdiction
**What it is:** Regulatory framework selector.

**Options:** EU ETS / CCS Directive, US EPA Class VI, Malaysia PCPP/DOE, Australia CCS Act, generic.

**Effect:** Switching jurisdiction changes the permit template language in the Export panel and adjusts the screening criteria thresholds to match local regulatory standards.

---

### 13. Export
**What it is:** Document generation hub.

**Available outputs:**
| Export type | Description |
|-------------|-------------|
| Executive Summary PDF | Light-theme, print-safe A4 report. PwC/Deloitte-grade layout with CarbonLens logo, cited methodology, DOE capacity range, trapping analysis. Suitable for board presentations and regulatory submissions. |
| Permit Pre-Application Report | Pre-filled regulatory report using your simulation data. Language adapts to selected jurisdiction. This is NOT a permit — it is a pre-application screening document. |
| JSON Data Package | Full simulation results in machine-readable format for integration with external tools |
| Excel Time Series | Year-by-year injection, trapping, and pressure data |
| 3D Screenshot | PNG export of the current 3D reservoir viewer state |

---

### 14. Methodology
**What it is:** Scientific reference panel — every equation, model, and coefficient used in CarbonLens with its literature citation.

**Why it matters:** A simulation tool without cited methodology is not defensible in a regulatory or peer-review context. Every number in CarbonLens traces to a published source.

---

### 15. Validation
**What it is:** Four-tab quality assurance panel.

| Tab | What it does |
|-----|--------------|
| **Sanity** | Physics checks on current result: supercritical T/P, CO₂ density range, injection < MAIP, DOE formula consistency |
| **Compare** | Automatically compares your result against the active preset's analytical reference baseline. Shows which parameter changes explain the deviation. |
| **Presets** | Batch analytical scan of all 16 preset formations — validates CO₂ phase state, density, expected P50, MAIP |
| **Δ Params** | Sensitivity validation: lock a baseline, modify a parameter, re-run — confirms result changes as physics predicts (e.g. halving thickness → P50 drops ~50%) |
| **Sleipner** | Direct comparison against Sleipner Utsira field measurements (Boait 2012, Furre 2017) |

---

### 16. Monte Carlo
**What it is:** Uncertainty propagation. Runs hundreds of simulations across probability distributions for uncertain inputs (porosity, permeability, thickness) to generate P10/P50/P90 distributions.

**For agencies:** Replace a single "best estimate" with an honest uncertainty band. A P90 capacity of 50 Mt with P10 of 200 Mt tells a very different story than a point estimate of 100 Mt.

---

## The Permit Section — Dubai Competition Context

**Short answer: Yes, keep it — and it is one of your strongest differentiators.**

Here is why:

The **Export > Permit Pre-Application Report** is not a regulatory permit — it is a pre-application screening report template pre-filled with your simulation data. Most CCS regulatory frameworks (EU, US, Malaysia, Australia) require operators to submit a site characterisation report *before* a permit application is considered. CarbonLens generates the draft of that document automatically.

For the Dubai competition (ADIPEC / COP28 / similar MENA energy competition context):

1. **Abu Dhabi has a specific ADNOC-2030 CCS target** — the Abu Dhabi Basin preset in CarbonLens directly addresses this. A regulator or developer in the UAE can load the Abu Dhabi Basin preset, run a simulation, and export a pre-application report in one session. That is a demonstration of immediate commercial value.

2. **The MENA CCS market is nascent** — most projects are in the permitting phase, not operational. A tool that accelerates the pre-permitting workflow is directly relevant.

3. **Competition judges are looking for real-world applicability** — showing a complete workflow from formation parameters → simulation → permit document is far more compelling than stopping at capacity numbers.

4. **The jurisdiction toggle** — switching from Malaysia PCPP to UAE and showing how the permit language changes accordingly is a live demo moment that resonates with an international panel.

**Recommended demo flow for Dubai:**
1. Load **Abu Dhabi Basin** preset → note auto-optimized wells
2. Run simulation → show P50 capacity, DOE range, trapping analysis
3. Switch jurisdiction to UAE/Abu Dhabi
4. Export Executive Summary PDF → show print-ready report with CarbonLens logo
5. Export Permit Pre-Application → show pre-filled regulatory document
6. Open Validation → Compare tab → show result vs analytical reference baseline

This 5-minute demo covers the full value chain: geological assessment → engineering simulation → regulatory output. That is the "promise land."

---

## Common Questions

**Q: Why does changing permeability not change storage capacity?**
A: Permeability controls how easily CO₂ flows into the rock (injection pressure and rate), but it does not change how much space is available. Capacity is set by pore volume × CO₂ density × efficiency factor. Doubling permeability means you can inject faster at lower pressure — but the total storage potential is the same.

**Q: Why is my P50 capacity much smaller than the formation description suggests?**
A: The formation descriptions quote the *total* storage potential of the entire geological unit (sometimes thousands of km²). CarbonLens simulates your *project area* (the Area parameter in the Formation panel). Set Area to the full formation area if you want the basin-scale estimate.

**Q: What does "Cc = 2.0%" mean in the results?**
A: This is the DOE P50 storage efficiency coefficient from Goodman et al. (2011). It means that on average, 2% of the gross pore volume in a saline aquifer is accessible for CO₂ storage at the P50 (most-likely) estimate. P90 (optimistic, 10% probability of exceedance) uses 5.5%, P90 conservative uses 0.51%.

**Q: Why is my injection pressure flagged even at low rates?**
A: Check the Geomechanics panel — the issue is usually that the formation pressure (depth × 0.0433 MPa/m) is already close to the fracture pressure. The optimizer in Geomechanics will find the maximum safe rate automatically.

**Q: Can I use CarbonLens results in a regulatory submission?**
A: CarbonLens is a screening and pre-application tool, not a certified regulatory simulator. Results should be used to inform early-stage feasibility and pre-application reports. Site-specific full-physics reservoir simulation is required for formal permit applications. The export report includes this disclaimer.

---

*CarbonLens — MSc Research, Universiti Teknologi PETRONAS, Malaysia | Preliminary screening only*
*Scientific basis: DOE Goodman et al. (2011), Span-Wagner (1996), Duan-Sun (2003), Furre et al. (2017), Boait et al. (2012)*
