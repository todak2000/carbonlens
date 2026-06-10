# CarbonLens: Master Implementation Plan
### From MSc Completion → PhD → Production → Commercialisation
**Daniel Tosin Olagunju | UTP Malaysia | v1.0 | May 2026**

---

## How to Read This Document

This plan has four parts that flow sequentially:

- **Part A** — Months 6–18: Finish the MSc, lock the PoC, prepare for PhD
- **Part B** — PhD Years 1–3: Research arc, publications, platform maturation
- **Part C** — Paper Portfolio: Six paper titles with full contribution mapping
- **Part D** — Commercialisation: From PoC to paying customers

Every section answers four questions: *What, How, Where, Who.*

---

## Part A — The Next 18 Months (MSc Completion + Pre-PhD)

> **Your current position:** Month 6 of MSc. MARS IFT paper drafted. CarbonLens v3 PoC built.
> **Target:** Graduate month 18. Enter PhD with one paper submitted, one near-ready, and a PoC solid enough to demo to PETRONAS.

---

### PHASE A1 — Months 6–9: Thesis + Paper 1 Submission

**Priority stack (in order):**

#### A1.1 — Submit the MARS Paper (Weeks 1–6 of this phase)

*What:* Submit Paper 1 (your attached draft) to *International Journal of Greenhouse Gas Control* (Elsevier, IF 6.19, Q1).

*How — step by step:*
1. Address the subcritical EV R² vulnerability before submission. Add a single supplementary analysis: take 15 random observations from Li et al. (2012), treat them as apparatus-calibration data, re-compute a UIF-adjusted conformal quantile, and show that subcritical EV coverage improves to ~70–75%. This costs ~3 days of code work but pre-empts the most predictable reviewer objection.
2. Register on Elsevier Editorial Manager: `https://www.editorialmanager.com/ijggc`
3. Format per IJGGC author guidelines (double-spaced, line numbers, references in numbered style). Download the official template from the journal homepage.
4. Your cover letter must state three things: (a) the SHA-256 external validation protocol is novel relative to all 29 reviewed studies, (b) the conformal prediction framework is the first deployed for CO₂-brine IFT, (c) the closed-form MARS equations are publicly accessible at your web tool URL.
5. Suggested reviewers to name (you can recommend): Seyed Mahdi Mousavi (IFT ML, published 2024), Samuel Krevor (Imperial College, IJGGC editor-in-chief's group), Stefan Iglauer (Edith Cowan University, CO₂-brine IFT expert).
6. Do NOT submit simultaneously to *Fuel* — IJGGC is the right target. If rejected with substantive feedback, revise and resubmit within 3 weeks. If desk-rejected, go to *Fuel* or *Energy & Fuels* (ACS).

*Where:* Elsevier Editorial Manager online. Your institution (UTP) has an Elsevier open-access agreement — check with COReD (Centre for Research and Development) whether YUTP grant (015LC0-585) covers the APC of USD 3,900. If not, apply for UTP's open-access fund separately.

*Who:* You lead. Get supervisor Okorie Agwu's final approval on the cover letter before submitting.

---

#### A1.2 — Complete MSc Thesis Write-Up (Weeks 4–12 of this phase)

*What:* Structure your MSc thesis around four chapters that mirror the work you've already done.

*Recommended thesis structure:*

```
Chapter 1: Introduction
  - CO₂ storage at scale: why IFT matters
  - The dual deployment gap (no cross-lab EV, no UQ)
  - Research objectives and scope

Chapter 2: Literature Review (sections 2.1–2.3 from your paper, expanded)
  - Experimental IFT database: 16 campaigns, structured critique
  - EoS and regression approaches: Table 2 from paper
  - ML approaches: Tables 3 and 4 from paper, expanded

Chapter 3: Dataset, Feature Engineering, External Validation Design
  - Section 3 of your paper verbatim-adapted
  - Add: full dataset provenance table (DOIs for all 16 sources)
  - Add: SHA-256 hash verification procedure (appendix)

Chapter 4: Model Development — ANN, MARS, GMDH
  - Section 4 of your paper verbatim-adapted
  - Add: noise ceiling rationale (GBR benchmark)
  - Add: full hyperparameter grid search results (supplementary table)

Chapter 5: Results and Discussion
  - Full results section from paper
  - Add: extended physical compliance analysis
  - Add: the supplementary UIF recalibration analysis

Chapter 6: Deployment — CarbonLens Web Tool
  - Describe the web application as the deployment artefact
  - Show screenshots of the applicability-domain gate in action
  - Link to Zenodo dataset and GitHub repository

Chapter 7: Conclusions and Future Work
  - Six conclusions from paper
  - Future work: contact angle, solubility, diffusivity ML (seeds PhD)
```

*How:* Write Chapter 6 last because it makes the thesis commercially relevant — the web tool deployment is what distinguishes this thesis from a pure ML paper collection. Use LaTeX (Overleaf, free tier is sufficient). UTP's thesis template is available from the Postgraduate Office on the UTP portal.

*Where:* Overleaf at `overleaf.com`. Submit draft chapters to supervisors via email in PDF, not Word, to preserve formatting.

*Who:* You write. Each chapter goes to Okorie Agwu for review. Target: complete draft to supervisor by Month 8.

---

#### A1.3 — CarbonLens PoC v3 Hardening (Weeks 1–12, parallel)

*What:* Make the existing PoC solid enough to demo to a PETRONAS engineer without embarrassment. This is NOT about adding features — it's about making what exists bulletproof.

*The six hardening tasks, in priority order:*

**Task 1 — Fix the permit templates to reflect Malaysian CCUS Act 2025**

The current Malaysia template in your PoC was built before the Act was gazetted (1 October 2025). The actual permit structure now requires:
- MyCCUS Agency as the named licensing authority (not PETRONAS Technical Standards)
- Offshore Assessment Permit fields: permit area coordinates, intended geological assessment methods, three-year timeline
- Storage Licence fields: storage complex characterisation, monitoring plan commitment, corrective measures protocol
- Fee schedule: RM 80,000 (assessment), RM 120,000 (storage licence)

*How to get the actual template fields:* The CCUS Act 2025 (Akta Penangkapan, Penggunaan dan Penyimpanan Karbon 2025) and the CCUS (Offshore Permit and Licensing) Regulations 2025 are gazetted documents. Get them from: the Attorney General's Chambers e-Federal Gazette at `efaz.agc.gov.my`, or from the Pinsent Masons / Skrine / Azmi & Associates legal briefings freely available on their websites (search "Malaysia CCUS Act 2025 Azmi"). Also email: `myccs@petra.gov.my` (MyCCUS Agency contact from PETRONAS official press release) to request a copy of the application form — government agencies often release these when asked professionally.

**Task 2 — Validate the MARS engine against your published paper**

Your v3 PoC has the MARS equations hardcoded in TypeScript. Run the 3,265 data points from your Zenodo dataset through the browser implementation and verify that predictions match your Python implementation to within 0.01 mN/m. Any discrepancy means a transcription error in the scaler parameters or hinge coefficients.

*How:* Export predictions from your Python pipeline (Zenodo code) as a CSV. Load the same inputs into the browser tool. Compute RMSE between the two. Log this test as a unit test in `src/__tests__/engine/mars/integration.test.ts`.

**Task 3 — Add the Applicability Domain gate as a visible UI element**

The three-tier AD gate (Green/Yellow/Red) from your paper must appear in the UI. When a user inputs formation conditions, the tool should show a coloured badge (Green = interpolation, Yellow = near-boundary, Red = extrapolation) alongside the conformal PI half-width for that AD status.

*How to implement:* In `src/engine/mars/index.ts`, add an `assessApplicabilityDomain(input, regime)` function that checks each scaled input against Appendix A1 bounds from your paper. Return a `{ status: 'green'|'yellow'|'red', pi_halfwidth: number, pi_level: number }` object. Display in `FluidProperties` component.

**Task 4 — Replace mock authentication with Supabase**

The current localStorage mock auth is fine for a demo but looks amateurish to any technical reviewer. Supabase (free tier) takes 2 hours to implement and gives you real email/password auth, row-level security, and a proper user table.

*How:* `npm install @supabase/supabase-js`. Create a project at `supabase.com`. Replace `authStore.ts` with Supabase client calls. Free tier supports up to 50,000 monthly active users — more than sufficient for PoC.

**Task 5 — Deploy to a production URL, not GitHub Pages**

GitHub Pages is fine for the PRD demo but the PoC needs a proper domain. Register `carbonlens.io` or `carbonlens.app` (~$12/year on Namecheap). Deploy via Vercel (free tier, connected to your GitHub repo, auto-deploys on push). This takes 30 minutes and transforms how the product looks to any stakeholder.

*How:* `npm install -g vercel`, run `vercel` in the project root, follow prompts, attach custom domain in Vercel dashboard.

**Task 6 — Record a 3-minute demo video**

This is your most powerful sales/academic tool. Record once, use everywhere. Use Loom (free, `loom.com`). Script: (1) enter Kasawari formation parameters, (2) watch MARS IFT compute in <50ms with Green AD badge, (3) run UQ simulation, see P10/P50/P90, (4) export Malaysian CCUS Act 2025 permit report. Upload to YouTube (unlisted) and embed the link in your GitHub README and thesis Chapter 6.

---

### PHASE A2 — Months 9–12: Data Collection for Contact Angle Paper

*What:* Compile the CO₂-brine contact angle (wettability) experimental database. This is the dataset for your first PhD paper and the work can start now, during the tail end of your MSc, with zero conflict.

*Why contact angle first:* Your MARS IFT paper and a MARS contact angle paper together give you a natural pair — both use the same methodology, same conformal prediction framework, same closed-form output. The combined contribution is "a validated, uncertainty-aware, white-box thermophysical property library for CO₂-brine systems." One paper is a result; two papers with the same methodology is a research programme.

*How to build the contact angle database:*

Step 1 — Primary literature search. Use Web of Science and Scopus with query: `("contact angle" OR "wettability") AND ("CO2" OR "carbon dioxide") AND ("brine" OR "saline") AND ("reservoir" OR "geological storage")`. Filter: 2000–2026, English only. You will find approximately 40–60 experimental papers. Target 600–900 data points total.

Step 2 — Key sources to prioritise (these are the anchor datasets):
- Chiquet et al. (2007) — quartz and calcite, 5-45 MPa, 308-383 K
- Arif et al. (2016) — CO₂-brine-mica, pressure and temperature range
- Farokhpoor et al. (2013) — sandstone and carbonate, multiple salts
- Saraji et al. (2013) — quartz substrate, NaCl brine
- Al-Yaseri et al. (2016) — basalt, relevant to Saudi Arabia basalt case study
- Bikkina (2011) — sandstone, wide P-T range
- Wan et al. (2014) — multiple rock types
- Mutailipu et al. (2019) — contact angle and IFT simultaneously (useful for joint model)

Step 3 — Data extraction. Use WebPlotDigitizer (`apps.automeris.io/wpd/`) for extracting data from figures. This is free and runs in the browser. For each paper, record: P (MPa), T (°C), brine salinity (mol/kg, speciated by ion), rock substrate type, measurement method (sessile drop, tilted plate, captive bubble), equilibration time, contact angle (degrees), reference DOI.

Step 4 — Quality screening. Apply the same criteria as your IFT paper: exclude non-equilibrated measurements (equilibration < 30 min), flag measurements with stated uncertainty > ±5°, note substrate roughness if reported.

Step 5 — Lock two laboratories as EV before any analysis. Choose your EV sets to represent: (a) a substrate type underrepresented in training (e.g., basalt if dominated by quartz/calcite), and (b) a brine chemistry underrepresented (divalent-cation dominated). SHA-256 lock as per your IFT methodology.

*Where to store data:* Zenodo (free, get a DOI immediately with `zenodo.org`). Create the dataset record now even before all data is compiled — you can update it. This establishes priority.

*Who:* You compile the dataset. Your supervisor Okorie Agwu should review the exclusion criteria. If you need a co-author with wettability experimental expertise, check UTP's Chemical Engineering department — wettability is actively studied there. Dr. Saad Alatefi (your PAAET co-author) may also have relevant contacts in the Gulf region where wettability experiments are conducted.

---

### PHASE A3 — Months 12–18: Viva Prep + PhD Registration + PoC v4

#### A3.1 — Viva Preparation (Months 12–14)

*What:* Prepare for the most likely hard questions.

*The five questions your viva panel will ask and how to answer them:*

**Q1: "Why MARS over XGBoost or random forest, given they have higher test R²?"**
Answer: The test R² comparison is the wrong metric for deployment. My cross-laboratory external validation shows that MARS achieves EV R² = 0.945 supercritically while ANN degrades to 0.450 and GMDH to 0.036 on the same EV data. MARS's piecewise-linear structure is the mechanism: it extrapolates linearly beyond the training boundary, while polynomial networks diverge and neural networks plateau non-physically. This architectural property, not accuracy on shared-apparatus test data, is the criterion that matters for field deployment.

**Q2: "The subcritical EV R² of 0.581 is low. Is the model actually useful subcritically?"**
Answer: The 0.581 is apparatus-offset-driven, not architecture-limited. When the Li et al. (2012) laboratory is isolated (UIF = 3.41), the remaining subcritical EV achieves R² = 0.859 — commensurate with test accuracy. The UIF framework I introduce provides a quantitative protocol for handling apparatus offset: widen the conformal interval by the UIF factor, collect 15-20 calibration measurements from the new apparatus, recalibrate. This is not a model failure; it is a deployment protocol.

**Q3: "How does this compare with the Span-Wagner EoS for IFT?"**
Answer: Span-Wagner is a CO₂ density equation of state, not an IFT model. IFT is typically computed from EoS-based density using the Parachor method. The Parachor approach achieves AARE of ~16.7% outside its calibration range (Chalbaud et al. 2009). My supercritical MARS EV nRMSE is 5.62%, a 3-fold improvement under genuinely out-of-distribution conditions.

**Q4: "What is the novelty relative to Turkson et al. (2026)?"**
Answer: Turkson et al. report k-fold cross-validation plus a held-out test set drawn from the same pooled database — training and test observations share apparatus-level biases. My protocol holds out entire laboratories (complete-laboratory exclusion, SHA-256 locked). The EV data in my study come from instruments not represented in training; in Turkson et al., they do not. This distinction is the entire difference between within-apparatus interpolation and cross-apparatus generalisation.

**Q5: "What is the path to commercialisation?"**
Answer: The CarbonLens web platform deploys the MARS equations in a browser-native CO₂ storage simulation tool. PETRONAS CCS Ventures received Malaysia's first Offshore Assessment Permit (Duyong, October 2025) under the CCUS Act 2025 — the permit application process requires exactly the thermophysical property predictions and uncertainty bounds my model provides. The commercial path is a permit-automation SaaS product priced at RM 80,000 per permit application (matching the government fee structure).

#### A3.2 — PhD Registration (Months 13–15)

*What:* Register your PhD research proposal at UTP before your MSc viva.

*How — step by step:*

1. Draft a 3-page PhD research proposal. Title suggestion: *"ML-Augmented Thermophysical Property Prediction with Calibrated Uncertainty for Geological CO₂ Storage: A Cross-Laboratory Validation Framework"*. This is intentionally broad enough to cover IFT, contact angle, solubility, and diffusivity across three years.

2. The proposal must contain: (a) Problem statement (the dual deployment gap — no cross-lab EV, no UQ — across the full thermophysical property suite), (b) Research objectives (3-4 objectives, each mapping to one paper), (c) Methodology (cross-laboratory EV protocol + conformal prediction + MARS/white-box), (d) Expected contributions (explicit equations for CO₂-brine system properties, all deployable without specialist software), (e) Timeline (3 years, 4-6 publications).

3. Nominate supervisors before submitting the proposal. Your primary supervisor (Okorie Agwu) continues from the MSc — this is the cleanest transition. If Agwu cannot continue for administrative reasons, target: Dr. Bhajan Lal (UTP, petroleum engineering, CCS-active), or Dr. Mysara Mohyaldinn (UTP, flow assurance). For a co-supervisor with ML expertise, contact the Computer and Information Sciences department at UTP.

4. Submit via UTP's Postgraduate Studies portal. The Postgraduate Office handles the paperwork; COReD handles the research grant aspects.

5. Apply simultaneously for a PETRONAS Research Fund (PRF) grant to cover PhD stipend and consumables. PRF application cycle typically opens in Q1 each year. Budget request: RM 150,000 over 3 years (stipend RM 2,500/month + conference RM 20,000 + publication APC RM 30,000 + compute RM 5,000). The CCUS Act 2025 and PETRONAS's explicit commitment to AI for CCS (stated in the ADNOC/Storegga JSA, August 2025) makes this a well-aligned application.

*Where:* UTP Postgraduate Portal at `sgs.utp.edu.my`. PRF application through UTP's Research Management Centre (RMC).

*Who:* You draft the proposal. Okorie Agwu endorses it. Submit before your MSc viva — having a registered PhD application demonstrates continuity to the viva panel.

#### A3.3 — CarbonLens PoC v4 (Months 15–18)

*What:* Three targeted upgrades that transform the PoC from "impressive demo" to "credible industry tool." These are specifically chosen because they require no backend server and can be shipped before the PhD starts.

**Upgrade 1 — PHREEQC.js Integration for Mineral Trapping**

PHREEQC is the US Geological Survey's geochemical speciation code. A JavaScript port (phreeqc.js) exists and runs in the browser. Adding this gives CarbonLens geochemical trapping calculations — the fourth and most permanent CO₂ trapping mechanism.

*How:* Find the PHREEQC.js build at `github.com/usgs/phreeqc3` — there is a WebAssembly build in the issues/forks. Alternatively, use the `react-phreeqc` wrapper if published by then. If no stable JS port exists by month 15, use a simplified mineral trapping calculation: the Xu et al. (2004) simplified geochemical model (calcite, dolomite, dawsonite precipitation kinetics) can be implemented as a lookup table calibrated against PHREEQC outputs for the Sleipner and Johansen formations.

*Where in the codebase:* New directory `src/engine/geochemistry/`. New panel component `GeochemistryPanel/`. Add "Mineral Trapping" as a new tab in the simulation results section.

**Upgrade 2 — Sleipner/Johansen Benchmark Cases Pre-Loaded**

These are the two most-cited CCS benchmark cases in the literature. Pre-loading them as named presets (alongside your existing 8 formation presets) gives the tool instant credibility with any academic reviewer.

Sleipner Utsira data (your existing preset is correct — depth 1012m, porosity 37%, permeability 3000mD). The key addition is the CO₂ plume monitoring data: Arts et al. (2004) reported plume geometry from 4D seismic in the paper you already cite. Add a "Plume Comparison Mode" that overlays your simulated plume extent against the observed Sleipner plume at years 1, 4, 8, and 12 post-injection.

Johansen formation data: depth ~2,100m, porosity 14–25%, permeability 10–1000mD, NaCl brine 0.5 mol/kg. This is the Norwegian benchmark case used for the SINTEF MRST validation studies. The data is public at `co2datashare.eu`.

**Upgrade 3 — Read-Only Eclipse/E100 Deck Parser**

Eclipse .DATA deck format is the lingua franca of reservoir simulation. Adding a read-only parser means CarbonLens can import formation geometry and property grids from any simulator that exports Eclipse format — which is every major simulator (CMG, SLB, tNavigator, OPM).

*How:* MRST (MATLAB Reservoir Simulation Toolbox) has an open-source Eclipse deck parser. The parsing logic is well-documented in Lie (2019). Port the core functions to TypeScript: (1) RUNSPEC section parser for unit system and grid dimensions, (2) GRID section parser for DX/DY/DZ/TOPS arrays, (3) PROPS section parser for PERMX/PERMY/PERMZ and PORO. Ignore the SCHEDULE section initially — you don't need the production history. This is approximately 400 lines of TypeScript.

*Where in the codebase:* New file `src/utils/eclipseParser.ts`. Hook into `FormationInputs` component as a new import option alongside the existing LAS import.

---

## Part B — The PhD (Years 1–3)

> **Entry conditions:** MSc graduated, MARS paper submitted (ideally in review or published), contact angle dataset compiled, PhD registered at UTP, PRF grant applied for.

### PhD Year 1 — Foundation Papers + Platform Core

#### B1.1 — Paper 2: Contact Angle MARS (Months 1–10 of PhD)

**Full title:** *"Cross-Laboratory Generalisation of CO₂-Brine-Rock Contact Angle Prediction: MARS Equations with Conformal Uncertainty for Capillary Pressure Assessment in Geological Carbon Storage"*

**Target journal:** *International Journal of Greenhouse Gas Control* (primary) or *Fuel*

**Core novelty:** Same methodology as Paper 1 applied to contact angle. The joint IFT + contact angle contribution propagates uncertainty through Young-Laplace: Pc = 2γcosθ/r. For the first time, P10/P50/P90 bounds on capillary entry pressure can be computed directly from two independently validated conformal models.

**Paper structure:**
- Identical methodological framing as Paper 1 (cross-laboratory EV, SHA-256 lock, conformal prediction, MARS)
- Key difference: rock substrate type as an input feature (quartz, calcite, dolomite, shale, basalt encoded as dummy variables or a categorical embedding)
- New contribution: joint IFT-contact angle uncertainty propagation to capillary pressure (Section 7 or 8 in the paper)
- Field case: propagate to Kasawari (Sarawak carbonate) and Duyong (Terengganu — check lithology from PETRONAS Duyong permit documentation)

**How to write it:** Start with Section 3 (data) since the dataset is already compiled. Write Section 4 (models) by adapting your IFT paper directly — the architecture is identical. The unique contribution is the substrate-type encoding strategy and the joint uncertainty propagation. Budget 8 months from dataset lock to submission-ready draft.

**Who to involve:** If you can establish any co-authorship with an experimental group — someone who has measured contact angles and can provide data from their apparatus as a validation set — this strengthens the external validation claim. Contact Stefan Iglauer (Edith Cowan University, Perth) — he has published extensively on CO₂-brine-rock wettability and has shared data before.

#### B1.2 — CarbonLens Backend Foundation (Months 6–12 of PhD, parallel)

*What:* Add the thin cloud-compute backend that removes the browser's computational ceiling. This is the single most important architectural decision of the PhD — do it early so the rest of the PhD can build on it.

**Architecture decision:** Serverless, not a dedicated server.

*How to implement — step by step:*

**Step 1 — Backend setup (2 weeks)**
- Create a Google Cloud account (GCP Free Tier: 2 million Cloud Run requests/month free)
- Set up a Python FastAPI application in a new repository: `carbonlens-api`
- Structure: `POST /simulate/theis` (transient pressure), `POST /simulate/capacity` (DOE storage capacity), `POST /simulate/plume-2d` (simple 2D analytical plume)
- Containerise with Docker. Deploy to Cloud Run.
- Add authentication: Supabase JWT verification on every API endpoint

**Step 2 — Connect frontend to backend (1 week)**
- In the React frontend, add an `apiClient.ts` utility that wraps fetch with Supabase auth headers
- The simulation panel's "Run" button now calls the API instead of the in-browser calculation
- Results return as JSON and render exactly as before — the user sees no difference

**Step 3 — MRST integration (Months 8–12)**
- Install MRST (open source, SINTEF) on a Cloud Run container with MATLAB Runtime (free, no MATLAB license required — only the Runtime)
- Or, use the Octave port of MRST (fully open source, no MATLAB needed): `github.com/SINTEF-Energy/MRST`
- This gives CarbonLens access to MRST-co2lab's full 2D/3D CO₂ plume simulation for grid cells up to ~200,000 cells — sufficient for site screening at real formation scale

*Where to learn:* MRST documentation at `mrst.no`. SINTEF runs free MRST courses (annual, check `sintef.no/projectweb/mrst/`). The MRST co2lab module is documented in the companion textbook: Lie, K.-A. (2019), *Introduction to Reservoir Simulation Using MATLAB*, Cambridge University Press (freely available PDF at `sintef.no`).

*Cost estimate:* Cloud Run at 10,000 simulation requests/month ≈ USD $5–20/month. Within the PoC budget.

---

### PhD Year 2 — Property Suite Completion + Industry Engagement

#### B2.1 — Paper 3: CO₂ Solubility in Brine (Months 10–20 of PhD)

**Full title:** *"Machine Learning Prediction of CO₂ Solubility in Multi-Component Brines: Cross-Laboratory Validation and Conformal Uncertainty for Dissolution Trapping Assessment"*

**Target journal:** *Chemical Engineering Journal* (IF 13.4) or *International Journal of Greenhouse Gas Control*

**Core novelty:** Duan-Sun (2003) is the industry standard but has documented limitations for: (a) temperatures above 100°C, (b) divalent-cation-dominated brines (CaCl₂, MgCl₂), (c) mixed-salt systems, (d) CO₂ impurity streams (CH₄, N₂ present). A MARS model trained on a compiled multi-laboratory database addresses all four gaps with the same cross-laboratory EV framework.

**Dataset to compile:** Key sources include:
- Duan and Sun (2003) calibration data (baseline)
- Koschel et al. (2006) — high-pressure, high-temperature solubility
- Zhao et al. (2015) — CaCl₂ brine
- Ji et al. (2015) — mixed NaCl/CaCl₂
- Bastami et al. (2014) — MgCl₂ brine
- Hou et al. (2013) — impure CO₂ streams with CH₄
Target: 500–800 data points across 8–10 independent groups.

**Features to engineer:**
- Pr, Tr (reduced pressure and temperature, same as IFT paper)
- Ionic strength (mol/kg), ionically speciated (monovalent, divalent)
- CO₂ fugacity coefficient (computed from Span-Wagner EOS — already in your engine)
- Gas-phase impurity fractions (CH₄, N₂)

**New academic contribution beyond methodology:** Solubility governs dissolution trapping, which is the dominant long-term sequestration mechanism (>1000 years). An uncertainty-aware solubility prediction directly enables probabilistic dissolution capacity estimation — a first in the literature.

#### B2.2 — Paper 4: Joint UQ Propagation Paper (Months 18–24 of PhD)

**Full title:** *"Propagating Thermophysical Uncertainty Through CO₂ Storage Capacity and Caprock Integrity Assessment: A Conformal Framework for P10/P50/P90 Engineering Bounds"*

**Target journal:** *SPE Reservoir Evaluation & Engineering* or *International Journal of Greenhouse Gas Control*

**Core novelty:** This is the synthesis paper. It takes Papers 1, 2, and 3 (IFT, contact angle, solubility) and propagates their conformal prediction intervals jointly through:
- Young-Laplace → P10/P50/P90 capillary entry pressure → caprock integrity bounds
- Dissolution capacity model → P10/P50/P90 dissolution trapping over 100 years
- DOE storage efficiency framework → P10/P50/P90 total storage capacity

This is what no prior study has done: a complete probabilistic pipeline from thermophysical measurement uncertainty to storage engineering decision bounds. The paper is heavily computational (Monte Carlo propagation through three MARS models) but the key insight is simple — if your IFT has ±2.25 mN/m uncertainty (80% PI) and your contact angle has ±3° uncertainty (to be determined), the resulting capillary pressure uncertainty is quantifiable and currently ignored in regulatory submissions.

**Industry relevance hook:** EPA Class VI Area of Review calculations, EU CCS Directive Annex I Step 3 dynamic modelling, and Malaysia CCUS Act 2025 monitoring plan requirements all implicitly need P10/P50/P90 property bounds. This paper provides the first formal framework for generating them from ML models.

#### B2.3 — Industry Engagement: PETRONAS Design Partner (Months 12–18 of PhD)

*What:* Secure a Letter of Intent or MOU with PETRONAS CCS Ventures (PCCSV) for CarbonLens as a research-collaboration tool for the Duyong permit process.

*How — step by step:*

1. Prepare a 4-page "Industry Brief" (not an academic paper, not a sales pitch — a technical brief in the style of a consultant's summary). Structure: (a) The permit problem: what PCCSV needs to submit under the CCUS Act 2025 Regulations, (b) What CarbonLens computes: IFT, contact angle, solubility with conformal bounds mapped to permit requirements, (c) A worked example using Duyong parameters (depth ~1,500m, porosity 22%, permeability 600mD from your formation preset), (d) One page on methodology with MARS equations.

2. The access pathway to PCCSV is through UTP. UTP is PETRONAS-owned. Your supervisor Okorie Agwu, or any UTP faculty member with active PETRONAS research collaboration, can make an introduction. Alternatively: PETRONAS Research & Technology (R&T) in Bangi, Selangor is the formal channel — contact `research@petronas.com.my` with a subject line: "CCS Software Collaboration: Closed-Form ML Property Prediction for CCUS Act 2025 Compliance."

3. The ask is NOT a contract or money initially. The ask is: permission to use Duyong reservoir parameters (non-confidential, published or paraphrasable) as a CarbonLens validation case, and a named PCCSV engineer as a CarbonLens beta user/advisor. This is low-ask and high-return.

4. If PCCSV engagement stalls, alternative pathways: TotalEnergies Malaysia (partner on Duyong JV, contact via TotalEnergies Foundation's open innovation platform), Mitsui Malaysia (third JV partner), or JOGMEC Malaysia office.

*Who:* Your supervisor makes the introduction. You prepare the technical brief. First meeting is a 30-minute Microsoft Teams presentation — prepare 8 slides maximum.

---

### PhD Year 3 — Synthesis, Deployment, and PhD Exit

#### B3.1 — Paper 5: CO₂ Diffusivity in Brine (Months 22–30 of PhD)

**Full title:** *"Multivariate Adaptive Regression Splines for CO₂ Diffusivity Prediction in Formation Brines: Cross-Source Validation and Applicability for Long-Term Dissolution Trapping Modelling"*

**Target journal:** *Advances in Water Resources* or *Journal of CO₂ Utilization*

**Core novelty:** Diffusivity governs the rate at which dissolved CO₂ spreads through brine by molecular diffusion — critical for dissolution trapping kinetics over 50-1000 year horizons. The Stokes-Einstein and Wilke-Chang correlations are the standards but have AARE of 15-30% at high pressures. Dataset is smaller (~200-350 data points) so the cross-laboratory holdout must use a leave-one-group-out design rather than the two-laboratory holdout from Papers 1-3.

**Key features:** Pr, Tr, brine viscosity (computed from Garcia+Fenghour, already in your engine), porosity (for effective diffusivity), tortuosity factor.

#### B3.2 — Paper 6: CarbonLens Platform Paper (Months 28–36 of PhD)

**Full title:** *"CarbonLens: A Browser-Native ML-Augmented Platform for CO₂ Storage Site Screening, Uncertainty Quantification, and Permit-Ready Assessment Under the Malaysian CCUS Act 2025"*

**Target journal:** *Computers & Geosciences* (primary) or *Geoenergy Science and Engineering*

**Core novelty:** This is the software paper. *Computers & Geosciences* has a long tradition of publishing geoscience software platforms with accompanying datasets. The novelty claimed is:
1. First browser-native CCS simulation platform with ML property prediction
2. First cross-jurisdictional permit-export tool with Act-compliant Malaysian templates
3. First CCS screening tool with conformal uncertainty bounds on thermophysical properties
4. Benchmarked against Sleipner and Johansen public datasets

**Structure for a software paper:**
- Section 1: Problem (the $200K gap between free tools and enterprise simulators)
- Section 2: Platform architecture (components, ML engine, simulation engine, export)
- Section 3: Scientific validation (MARS predictions vs. benchmark, plume vs. Sleipner observations)
- Section 4: Permit template validation (walkthrough of Malaysian CCUS Act 2025 compliance)
- Section 5: Performance and limitations (benchmark vs. CMG GEM, where it fails)
- Section 6: Case studies (Kasawari, Duyong, Johansen)
- Code availability: full GitHub repository, MIT licence for academic use, commercial licence separate

#### B3.3 — PhD Viva Preparation (Month 32–36)

Your thesis structure for the PhD should be:

```
Chapter 1: Introduction and motivation
Chapter 2: CO₂ storage fundamentals and thermophysical property requirements  
Chapter 3: IFT — MARS + conformal prediction (Paper 1, published)
Chapter 4: Contact angle — MARS + conformal prediction (Paper 2, published)
Chapter 5: CO₂ solubility — MARS + conformal prediction (Paper 3, published)
Chapter 6: Joint uncertainty propagation to storage capacity and caprock integrity (Paper 4)
Chapter 7: CO₂ diffusivity — MARS + conformal prediction (Paper 5)
Chapter 8: CarbonLens platform — integration and validation (Paper 6)
Chapter 9: Conclusions, limitations, and future work
```

This is a papers-by-publication PhD, which UTP allows. Each chapter is essentially one of your published papers with a connecting narrative added. This format means you write the papers during the PhD, not the thesis — the thesis compiles them with connective text. This is the most efficient format for a founder-researcher with a 5–10 hour/week constraint.

---

## Part C — The Six-Paper Portfolio

| # | Title | Journal | When | Core Novelty |
|---|---|---|---|---|
| 1 | Closed-Form MARS Equations with Calibrated Conformal Uncertainty for CO₂–Brine IFT | IJGGC or Fuel | MSc (now) | Cross-lab EV reversal + conformal UIF framework + deployed tool |
| 2 | Cross-Laboratory MARS for CO₂-Brine-Rock Contact Angle + Joint Pc Uncertainty | IJGGC or Fuel | PhD Y1 | First joint IFT+CA propagation through Young-Laplace |
| 3 | ML Prediction of CO₂ Solubility in Multi-Component Brines with Cross-Lab EV | Chem Eng J or IJGGC | PhD Y2 | Duan-Sun extension to divalent brines + impure CO₂ with UQ |
| 4 | Propagating Thermophysical Uncertainty to Storage Capacity + Caprock Integrity | SPE RE&E or IJGGC | PhD Y2 | First P10/P50/P90 storage engineering bounds from ML property models |
| 5 | MARS for CO₂ Diffusivity in Formation Brines for Dissolution Trapping Modelling | Adv Water Res | PhD Y3 | Cross-source validated diffusivity with applicability domain |
| 6 | CarbonLens: Browser-Native ML Platform for CCS Screening Under CCUS Act 2025 | Computers & Geosciences | PhD Y3 | Software platform paper with Sleipner/Johansen validation |

**Total expected citations at PhD exit (conservative):** 150–300 (if Papers 1-2 are published and indexed 18+ months before thesis submission; geoscience citation velocity is slow but Papers 1-2 address a genuine methodological gap cited by reviewers).

---

## Part D — Path to Production and Commercialisation

### D1 — Revenue-Generating PoC (During PhD, Year 1–2)

*What:* Launch a paid academic tier before the PhD is complete. This is not distraction — it is proof of market demand, which strengthens every grant application and investor conversation.

*Pricing structure (launch during PhD Year 1):*

| Tier | Price | Target | What they get |
|---|---|---|---|
| Academic Free | RM 0 | Students, researchers | Full ML engine, watermarked exports, no SLA |
| Practitioner | RM 1,800/yr (≈USD 400) | Consultants, small E&Ps | Unlocked exports, LAS import, permit reports, email support |
| Institution | RM 9,600/yr (3 seats) | Universities, engineering firms | Multi-user, branded reports, Slack access |
| Enterprise | Negotiated RM 36,000–60,000/yr | NOCs, operators | SSO, on-prem option, custom permit templates, SLA |

*How to launch the Academic and Practitioner tiers:*
1. Add Stripe payment integration (Stripe supports Malaysia). `npm install @stripe/stripe-js`. Create products in Stripe dashboard.
2. Use Supabase row-level security to gate premium features: Practitioner users get a `tier: 'practitioner'` flag in their profile row, which the frontend reads to unlock export without watermarks.
3. Total implementation time: approximately 3 weekends.
4. Announce via: (a) LinkedIn post with demo video link, (b) ResearchGate profile update with tool link, (c) IJGGC paper "Deployment" section pointing to the tool, (d) Post in the SPE CCS Technical Section LinkedIn group.

*Revenue target during PhD:* 5 Practitioner customers by end of PhD Year 1 = RM 9,000/year. This is not revenue-significant but it is proof-of-market that transforms grant applications and investor conversations.

### D2 — PETRONAS/Malaysian Market Entry (PhD Year 2)

*What:* First enterprise customer or MOU. Target PETRONAS CCS Ventures or a PETRONAS-aligned engineering consultancy (e.g., PCSB, Kencana, TechnipFMC Malaysia).

*The commercial case in one sentence:* The CCUS Act 2025 requires every CCS project in Malaysia to submit an Offshore Assessment Permit application (RM 80,000 fee) and a Storage Licence application (RM 120,000 fee). CarbonLens generates the technical inputs for those applications — thermophysical properties with conformal uncertainty bounds, 3D plume screening, Mohr-Coulomb caprock assessment — in hours rather than weeks. For any operator running two or more projects, CarbonLens saves more engineer-time than it costs.

*Target consulting firms to approach (they serve PETRONAS):*
- **Petrofac Malaysia** (large PETRONAS engineering services contractor, KL office)
- **Halliburton Malaysia** (significant PETRONAS relationship, has CCS advisory team)
- **SLB Malaysia** (Kuala Lumpur office, PETRONAS account team)
- **PHEIM Associates** (smaller Malaysian firm, approachable)
- **Cawangan Khas UTP consultancy** (UTP's own consulting arm — zero procurement friction)

*Approach protocol:* Do not cold-email. Attend SPE Malaysia Annual Technical Conference (typically Q3/Q4 each year, KL Convention Centre). Present a poster on your MARS paper. Have the demo running on a tablet. The conversation starts there.

### D3 — Global Market Entry (PhD Year 3 — Post-Graduation)

*What:* Target international early adopters using the DOE SBIR pathway for US credibility and EU Horizon for European.

**DOE SBIR Phase I (if establishing a US entity or partnering with a US university):**
- Award amount: up to USD 200,000 over 9 months
- Application window: NETL publishes SBIR solicitations annually, typically in Q4
- Relevant topic areas: "Carbon Storage Simulation and Monitoring Tools," "ML for Subsurface Characterisation"
- Application at `science.osti.gov/sbir`
- Eligibility: US small business entity required. Options: (a) Incorporate CarbonLens Ltd in Delaware or Wyoming (USD 500 with Stripe Atlas), (b) Partner with a US university (LBNL/NETL/UT Austin) as the applicant

**EU Horizon Europe Innovation Fund:**
- CCS software qualifies under "Industrial Carbon Management" calls
- Grant amounts: EUR 500K–5M (non-dilutive)
- Application via EU Funding & Tenders Portal: `ec.europa.eu/info/funding-tenders`
- Requires at least one EU-based consortium partner. Target: SINTEF (Norway, MRST developers — natural partner), Heriot-Watt University (Edinburgh, SCCS group), or TNO (Netherlands, CCS research centre)

**Strategic acquisition pathway (Year 5–7 post-PhD):**
Based on the Seequent ($1.05B, Bentley, 2021), Resoptima (undisclosed, Halliburton, 2023), and ResFrac (platform investment, Banneker Partners, 2026) precedents, the most likely exit for CarbonLens is acquisition by one of: Bentley Systems (acquired Seequent for geological modelling), Halliburton (acquired Resoptima for reservoir UQ), SLB (actively acquiring CCS-adjacent software), or CMG (would acquire to extend into the browser-native market they currently don't serve).

The trigger for acquisition interest is typically USD 3–5M ARR. At the proposed pricing, this requires approximately 25–35 enterprise customers globally — achievable by Year 5 post-PhD if PETRONAS, one EU operator, and two North American CCS projects are customers.

---

## Summary: The 18-Month Checklist Before PhD

Use this as your single reference document. Check each item monthly.

**Months 6–9**
- [ ] Submit Paper 1 (MARS IFT) to IJGGC
- [ ] Complete MSc thesis draft Chapters 1–5 (send to supervisor)
- [ ] Deploy CarbonLens to custom domain (carbonlens.io or similar)
- [ ] Implement Supabase real authentication
- [ ] Record 3-minute demo video (Loom)
- [ ] Apply for Malaysian CCUS Act 2025 permit template from MyCCUS Agency

**Months 9–12**
- [ ] Revise and resubmit Paper 1 if reviews received
- [ ] Complete MSc thesis Chapters 6–7 and front matter
- [ ] Compile contact angle experimental database (minimum 400 data points)
- [ ] SHA-256 lock contact angle EV sets
- [ ] Submit PRF grant application for PhD funding
- [ ] Register PhD research proposal at UTP

**Months 12–15**
- [ ] Pass MSc viva
- [ ] Update CarbonLens permit module to reflect CCUS Act 2025 Regulations
- [ ] Begin contact angle MARS model training
- [ ] Launch Academic Free tier publicly
- [ ] Prepare PETRONAS Industry Brief (4 pages)

**Months 15–18**
- [ ] Receive MSc graduation
- [ ] Complete draft of Paper 2 (contact angle)
- [ ] Implement Cloud Run backend for simulation (FastAPI + Docker)
- [ ] Add Sleipner/Johansen benchmark presets to CarbonLens
- [ ] Submit Paper 2 to journal
- [ ] Launch Practitioner paid tier (RM 1,800/year via Stripe)
- [ ] First PETRONAS/industry meeting scheduled

---

*Document prepared: May 2026 | For: Daniel Tosin Olagunju | Next review: Month 9 (November 2026)*