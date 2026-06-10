# CarbonLens PoC → Production-Grade CO2 Screening Tool

**Date:** 2026-05-23  
**Scope:** `v3/carbonlens_v3_poc/` — all source, tests, types, stores, hooks, engine, components, and data files  
**Goal:** Engineering-submission-grade browser tool credible against commercial simulators (CMG GEM) for CO₂ storage screening  
**Team:** 1 dev + AI assistant  
**Timeline:** Open-ended (quality first)  
**Validation data:** Public benchmarks only (Sleipner, Otway, In Salah published data)

---

## Philosophy

We cannot out-spend CMG GEM's 30+ years of EOS compositional engine development. We win on:

- **Speed**: Real-time browser response vs hours-long GEM runs
- **Focus**: CO₂-brine only — no hydrocarbon phases, no thermal EOR — means simpler, faster, more auditable
- **Permit-readiness**: End-to-end from input → simulation → jurisdiction-compliant PDF permit report
- **Transparency**: Every equation documented, every approximation labelled, no black boxes

For engineering submissions, the bar is: *can a regulator or reviewer verify the methodology and reproduce the results?* That means auditable code, documented approximations, and validated benchmarks — not necessarily full-physics EOS.

---

## Phase 1 — Physics Credibility

Fix the remaining gaps that make the solver indefensible in an engineering context.

### 1.1 Stress-Dependent Permeability & Porosity Evolution

**Current state:** Porosity and permeability are static inputs. They never change as CO₂ injects, even as pore pressure rises by 10+ MPa.

**Required physics:**
- Effective stress: `σ_eff = σ_overburden - α·Biot·P_pore`
- Permeability multiplier: `k = k₀ · exp(c_k · Δσ_eff)` where `c_k` is the permeability-stress sensitivity (0.01–0.1 MPa⁻¹ for sandstone)
- Porosity multiplier: `φ = φ₀ · exp(c_φ · Δσ_eff)` or via Kozeny-Carman: `k ∝ φ³/(1-φ)²`
- Salt precipitation near injector: oversaturation → halite precipitation → porosity reduction → permeability loss (simplified as `φ = φ₀ - min(φ_ppt, cumulative_mass_out / brine_vol · salt_molality · MW_halite / ρ_halite)`)

**Files to modify:**
- `src/engine/plume/saturationSolver.ts` — add stress-dependent update step
- `src/types/index.ts` — add `Biot_coefficient` to `FormationParams` if not present (it is: `biotCoefficient`)
- `src/utils/geologicalModelToGrid.ts` — initialise dynamic k/phi storage
- `src/hooks/useSimulation.ts` — wire pressure field into permeability update

**Validation:** Pressure response should match Theis analytical solution within 20% for homogeneous cases.

### 1.2 Capillary Pressure with Hysteresis

**Current state:** No capillary pressure model. CO₂ migration is purely buoyancy-driven + diffusive lateral spreading.

**Required physics:**
- Leverett J-function: `Pc = σ·cosθ · √(φ/k) · J(Sw)`
- Drainage curve: Brooks-Corey or van Genuchten `Pc(Sw)`
- Imbibition curve: different shape + residual trapping (Land already handled separately)
- Entry pressure per lithology (already in `capillaryEntryPressure` field, currently unused)

**New file:** `src/engine/plume/capillaryPressure.ts`
**Files to modify:**
- `src/engine/plume/saturationSolver.ts` — add capillary-driven flow term in lateral spread step
- `src/data/lithologyDefaults.ts` — verify entry pressure defaults

**Validation:** Capillary pressure should retain CO₂ below seal at realistic column heights (100–300 m for good caprock).

### 1.3 Relative Permeability Hysteresis (Killough Model)

**Current state:** `krGas(Sg)` in `relativePermeability.ts` returns a single drainage kr curve. No imbibition curve. Land model only handles residual saturation, not the shape change.

**Required physics:**
- Drainage kr: `krg_drain = krg_max · ((Sg - Sgr)/(1 - Swc - Sgr))^ng`
- Imbibition kr (Killough 1976): interpolate between drainage and a scanning imbibition curve based on saturation reversal point
- Trapped gas saturation from Land model feeds into imbibition kr endpoint

**Files to modify:**
- `src/engine/plume/relativePermeability.ts` — rewrite with Killough hysteresis
- `src/engine/plume/saturationSolver.ts` — pass imbibition flag and scanning curve into kr lookup

**Validation:** Imbibition kr should be ≤ drainage kr at same Sg (physical). Compare to Corey curves from literature.

### 1.4 EOS-Based Solubility Trapping (Not Constant 3%/yr)

**Current state:** Line 303: `dDissolved = min(freeCO2 * 0.03, dissolutionBudget - Sg_dissolved)`. Constant 3% of free CO₂ dissolves per year regardless of interfacial area, mixing, or convection.

**Required physics:**
- Interfacial-area-limited: `dDissolved = k_la · (C_sat - C_bulk) · A_interface · dt`
- Convective mixing enhancement: onset after some time (density-driven), accelerates dissolution by 2–5×
- Solubility limit from Duan-Sun (already correct)
- Mass transfer coefficient `k_la` as function of permeability, dispersivity, and gravity number

**Files to modify:**
- `src/engine/plume/saturationSolver.ts` — rewrite dissolution step
- `src/hooks/useSimulation.ts` — may need to pass additional fluid properties

**Validation:** At Sleipner conditions, dissolution should reach ~15–25% of injected CO₂ after 50 years (consistent with published estimates).

### 1.5 Input Validation

**Current state:** Methane+N₂ fraction can exceed 1.0. Wells can be outside [-1,1]. Injection rate can be negative. No user-facing warnings.

**Required:**
- Validate all form inputs on change/submit
- Show inline warnings (yellow) and errors (red)
- Prevent simulation with invalid inputs
- Validate: fraction sums, temperature range, pressure > 0, porosity in (0,1], permeability > 0, injection wells within domain
- Log validation state to console for debugging

**New file:** `src/utils/validation.ts`
**Files to modify:**
- `src/components/FormationInputs/FormationPanel.tsx`
- `src/components/WellPanel/WellPanel.tsx`
- `src/hooks/useSimulation.ts` — gate simulation start on validation pass

### 1.6 Sleipner Benchmark Reference Data

**Required:**
- Hard-code published Sleipner Utsira plume extent at years 4, 8, 12, 16 (from Arts et al. 2004, Chadwick et al. 2009, Furre et al. 2017)
- Add an overlay toggle in the 3D view that shows the observed plume outline
- Run simulation with Sleipner preset → compare plume radius and layer distribution
- Document deviation from observed data

**New file:** `src/data/sleipnerBenchmark.ts`
**Files to modify:**
- `src/components/ThreeViewer/ReservoirViewer.tsx` — add overlay rendering

**Validation metric:** Plume radius at each seismic survey year should be within ±30% of observed.

### 1.7 Full Test Coverage

**Current gaps:**
- Zero component tests
- Zero hook tests
- No multi-well or fault-blocking solver tests
- No viscosity accuracy test (only magnitude bounds)
- No benchmark comparison test

**Required additions:**
- `src/__tests__/hooks/useSimulation.test.ts` — test `computeYearly` with known inputs matches analytical checks
- `src/__tests__/components/EconomicsPanel.test.tsx` — renders, NPV > 0 for US jurisdiction
- `src/__tests__/components/ExportPanel.test.tsx` — renders, template selector works
- `src/__tests__/engine/plume/capillaryPressure.test.ts` — Pc positive, hysteresis works
- `src/__tests__/engine/plume/relativePermeability.test.ts` — imbibition kr ≤ drainage kr
- `src/__tests__/engine/classical/viscosity.test.ts` — extend with accuracy range checks
- `src/__tests__/utils/validation.test.ts` — every rule tested
- `src/__tests__/data/sleipnerBenchmark.test.ts` — reference data matches form

---

## Phase 2 — Production Features

### 2.1 PDF Permit Export

**Current state:** Permit exports as `.txt` plaintext. Unacceptable for regulatory submissions.

**Required:**
- Add `html2canvas` and `jsPDF` as dependencies
- Render permit report as styled HTML in a hidden div
- Capture with html2canvas → convert to PDF with jsPDF
- Include: header with logo, project info, formation parameters, simulation results, trapping breakdown, economics summary
- Support all jurisdictions (US, Malaysia-Federal, Sarawak, Australia, Norway, standard)
- Download as `.pdf`

**Files to modify:**
- `src/components/PermitExport/ExportPanel.tsx` — add PDF button and render logic
- `src/utils/permitTemplates.ts` — may need to add HTML-formatted sections alongside text

### 2.2 In-App Methodology Documentation

**Required:**
- A methodology panel showing every equation used, with citation
- Organised by physics domain: CO2 density, brine density, viscosity, solubility, IFT, trapping, pressure, geomechanics
- Each equation shows: name, formula, parameters, reference
- Linked from the help/info menu

**New file:** `src/data/methodology.ts`
**New component:** `src/components/MethodologyPanel/MethodologyPanel.tsx`

### 2.3 Edge Case & Error Handling

**Required:**
- Handle empty geological model gracefully
- Handle zero-thickness formation
- Handle single-zone model
- Handle no wells configured
- Handle simulation with zero injection rate
- Handle extremely large/small values (porosity = 0.99, k = 100000 mD)
- All error states show user-friendly messages, not NaN or crash

---

## Phase 3 — Platform (Beyond AI Scope)

These items require infrastructure setup and deployment that an AI assistant can't perform, but I can provide the code.

### 3.1 Supabase Auth & Multi-User

- Replace localStorage mock auth with Supabase real auth
- User registration, login, password reset
- Project save/load per user
- Role-based access (viewer vs editor vs admin)

**I can provide:** Store layer, API calls, React context. You handle Supabase project setup and deployment.

### 3.2 Eclipse .DATA Parser

- Parse Eclipse E100/E300 .DATA deck format
- Extract grid geometry, poro/perm arrays, faults, well specifications
- Map to CarbonLens geological model format

**I can provide:** Full parser implementation. You validate against real .DATA files.

### 3.3 Multi-Run Monte Carlo Engine

- Monte Carlo sampling over uncertain parameters (permeability, porosity, fault transmissibility)
- Latin Hypercube sampling (code exists but no UI)
- Results dashboard showing P10/P50/P90 of storage capacity, plume extent, leakage risk
- Exportable as CSV

**I can provide:** Engine, sampling, statistics. UI layout needs a designer.

### 3.4 REST API

- Express/Fastify backend wrapping simulation engine
- Endpoint: `POST /api/simulate` — accepts formation params, returns result
- Endpoint: `POST /api/optimize` — finds optimal well rate
- Endpoint: `GET /api/benchmarks/sleipner` — returns reference data
- Enables third-party integration and scriptable batch runs

---

## Priority Order

| Order | Item | Effort | Impact | Dependencies |
|---|---|---|---|---|
| 1 | Stress-dependent k/φ evolution | Medium | High — fixes static rock properties | None |
| 2 | Capillary pressure model | Medium | High — Pc is essential for plume behaviour | None |
| 3 | Rel perm hysteresis (Killough) | Medium | High — changes plume shape and trapping | Land model already present |
| 4 | EOS solubility trapping | Large | High — fixes constant-rate dissolution issue | Duan-Sun already correct |
| 5 | Input validation | Small | Medium — prevents silent wrong results | None |
| 6 | Sleipner reference data | Small | Medium — enables validation story | None |
| 7 | PDF export | Medium | High — required for submissions | None |
| 8 | Full test coverage | Large | Medium — trust in code | Everything above |
| 9 | Methodology docs | Small | Low — nice-to-have for transparency | None |
| 10 | Edge-case handling | Medium | Medium — production polish | Phase 1 physics |
| 11 | Supabase auth | Large | Low — not needed for demos | Infrastructure |
| 12 | Eclipse parser | Large | Low — nice-to-have for data import | None |
| 13 | Monte Carlo | Large | Low — not needed for single-run demos | None |
| 14 | REST API | Large | Low — not needed for browser tool | None |

---

## What I Need From You

- **Approval to start Phase 1, items 1→2→3→4→5→6→7→8 in order**
- Published Sleipner data if you find it (I'll find what's publicly available too)
- Feedback on physics choices: e.g., which stress-sensitivity coefficient range is appropriate for a PETRONAS carbonate reservoir vs a North Sea sandstone
- Review of the PDF template design — what fields must a Malaysia CCUS permit contain?
- Later: CMG GEM license or access to Sleipner benchmark results for validation

---

## Success Criteria

The tool is ready for engineering submissions when:

1. All Phase 1 physics implemented with passing tests
2. PDF permit export produces a regulator-ready document
3. Input validation catches all known error states
4. Sleipner preset plume matches published data within ±30%
5. Every equation in the methodology panel has a citation
6. `npx vite build` passes, `npx vitest run` passes, `npx tsc --noEmit` shows zero errors
