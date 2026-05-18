# CarbonLens Storage Studio — PoC Product Bible
**POC EDITION · V3.2 · CONFIDENTIAL**

> Working Demo in 7 Weeks. Week 5: Live. Week 8: First Users.

*CarbonLens Ltd. · Confidential — Not for distribution*
*PoC Product Bible · Version 3.2 · May 2026*
*Daniel T. Olagunju — Co-Founder & CPO*
*MSc Researcher, Universiti Teknologi PETRONAS*

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 01 | What This PoC Is (and Is Not) | Honest scope, naming decision, market gap |
| 02 | Competitive Landscape Deep-Dive | All CCUS software categories. Where CarbonLens fits. New web-based competitors identified. |
| 03 | The Wedge: Screening-to-Permit Layer | Complements CMG. Compared to MRST-co2lab and CCS Energy. |
| 04 | All 7 Properties — What Needs ML vs. Classical | Only IFT needs ML. Rest are published correlations. |
| 05 | Formation Presets (From Published Data) | Sleipner, Decatur, Otway — full parameter tables sourced from literature |
| 06 | PoC Feature Set | P0/P1/P2 features. Hosting on Firebase. Simulated billing. |
| 07 | Project Persistence | JSON export + Firebase Firestore cloud saves |
| 08 | Geomechanical Module | FPG, Eaton, MAIP, caprock seal index |
| 09 | Jurisdiction Toggle | EPA / UK NSTA / Norwegian NPD / PETRONAS Malaysia |
| 10 | IP Strategy | Hybrid architecture. MARS equation in TypeScript. Ensemble weights server-side. |
| 11 | Design Partner Targets | 10+ CCUS consulting firms identified. PETRONAS CCS contacts. |
| 12 | Go-to-Market Strategy | White paper, academic outreach, demo-led sales |
| 13 | Technical Architecture | Firebase Hosting + Auth + Firestore. No real Stripe — simulated. |
| 14 | PoC Success Criteria | What done looks like |

---

## 01 — What This PoC Is (and Is Not)

> **NAMING DECISION**
> The name "CarbonLens" implies full CCUS coverage. The PoC covers the storage component. Launch as **"CarbonLens Storage Studio"**.

### The Market Gap

There are 8+ major CCUS software tools. **None** are browser-native, UQ-native, permit-ready, and accessible to non-simulation-experts simultaneously. The web-based tools that do exist (CCS Energy calculators) are simpler property lookups with no 3D, no UQ, and no permit export.

**CarbonLens fills the $200K gap between "nothing" and "enterprise suite"** — screening-to-permit layer used *before* you license CMG.

### What the PoC Proves

- **H1:** A CCUS engineer who sees the 3D reservoir builder with Sleipner running will request a paid account. Validated: 3 paying customers by Week 8.
- **H2:** Client-side TypeScript equations update properties in <50ms on mid-range hardware.
- **H3:** A professor can load Sleipner and reproduce published P50 plume extent within 15%.

---

## 02 — Competitive Landscape Deep-Dive

### Category 1: Commercial Giants ($50K–$500K/yr)

| Tool | Company | Cost | Key Gap |
|------|---------|------|---------|
| Petrel + INTERSECT/ECLIPSE | SLB | $100–500K/yr | Requires Petrel. No UQ. No permit output. |
| GEM | CMG | $160–230K/yr | Specialist training needed. No browser access. |
| RMS + Tempest MORE | Roxar (Emerson) | $50–150K/yr | Desktop-only. No UQ built-in. |

### Category 2: Open-Source / Academic (Free but Inaccessible)

| Tool | Developer | Barrier |
|------|-----------|---------|
| GEOS | US National Labs + Stanford | HPC cluster required |
| MRST-co2lab | SINTEF | MATLAB $2K/yr license + scripting |
| TOUGH3/TOUGHREACT | LBNL | Linux, compilation, CLI-only |
| SimCCS | LANL | Java, optimization-only (not simulation) |

### Category 3: Screening & Cost Tools

| Tool | Developer | What It Does |
|------|-----------|-------------|
| SCO2TPRO | Carbon Solutions LLC | Desktop screening: injection rates, storage costs |
| SimCCSPRO | Carbon Solutions LLC | Pipeline network optimization |
| CO2NCORD | Carbon Solutions LLC | Capture source identification |

### Category 4: Web-Based CCUS Tools (Most Relevant Comparison)

| Tool | Developer | What It Does | CarbonLens Advantage |
|------|-----------|-------------|---------------------|
| **CCS Energy Calculators** (ccsenergy.com.au) | CCS Energy (Australia) | Browser-based CO₂ property calculator, injection pressure calculator, storage capacity estimator. Free. No install. | **CarbonLens has 3D simulation, UQ, permit export, LAS import, geomechanics** — CCS Energy is simpler property lookups only. |
| **CarbonStorage.io** | CarbonStorage.io | CCUS project analytics, competitive intelligence, CO₂ capacity estimates. | Analytics platform. No simulation. No UQ. |
| **OGCI CCUS Hub Platform** | OGCI | Hub identification map, 279 potential hubs, playbook. | Screening only. No individual formation simulation. |
| **Halliburton CO2 Storage Suite** | Halliburton | Industry-validated CCS workflows, plume modeling. | Desktop/enterprise. Not browser-based. |
| **Rose & Associates CCS Tools** | Rose | CCS risk analysis, economics, storage mass. | Economics/risk focus. No plume simulation. |

**Key finding:** CCS Energy (Australia) is the closest existing tool to CarbonLens — and it confirms the market for browser-based CCUS tools exists. But they offer individual calculators, not an integrated 3D simulation studio. This validates the gap.

### CarbonLens Position

CarbonLens creates a **new sub-category**: the integrated browser-based CO₂ storage simulation studio with:
- 3D visual reservoir builder (CCS Energy has no 3D)
- Real-time plume simulation with UQ (CCS Energy has no simulation)
- Permit-ready export (no web tool offers this)
- LAS file import + geomechanics (no web tool offers this)
- Jurisdiction-matched regulatory output (no web tool offers this)

---

## 03 — The Wedge: Screening-to-Permit Layer

> Use CarbonLens to screen 20 sites in an afternoon. Identify the top 3. Generate initial permit figures. Validate the investment case — *then* spend $200K on CMG for the detailed simulation.

CMG should love CarbonLens because:
- CarbonLens trains engineers on CCS concepts before they touch a $200K simulator
- CarbonLens identifies which 2–3 formations justify the CMG license
- CarbonLens produces client-facing visuals that sell the CMG study
- CarbonLens is the "gateway drug" — consulting firms that buy CarbonLens are the same firms that buy CMG

### Compared to MRST-co2lab (SINTEF)

| Dimension | MRST-co2lab | CarbonLens |
|-----------|-------------|------------|
| Physics | 10+ years SINTEF R&D | Simplified Darcy + ML IFT |
| Access | MATLAB ($2K/yr) + scripts | Browser. Free/paid. |
| GUI | None | Three.js 3D + D3.js 2D |
| UQ | Manual Monte Carlo | P10/P50/P50 default |
| Presets | Norwegian Continental Shelf scripts | Sleipner, Decatur, Otway — one-click |
| Permit output | None | EPA/NSTA/NPD/PETRONAS |
| LAS import | Manual MATLAB | Drag-and-drop parser |
| Price | Free (+ $2K/yr MATLAB) | Free + $49–$799/mo paid |

**CarbonLens is MRST-co2lab's physics philosophy delivered as a browser-native, permit-ready product.**

---

## 04 — All 7 Properties: What Needs ML vs. Classical

This is a critical question you asked. Here is the honest breakdown:

| Property | Model Type | Status | Training Data Needed? | Effort |
|----------|-----------|--------|----------------------|--------|
| **IFT** (Interfacial Tension) | **ML** (MARS/GMDH/MGGP ensemble) | ✅ **You have MARS equation as JSON**. GMDH + MGGP to train. | Your 3000+ IFT dataset | **Low** — equation already exists. Just transcribe to TypeScript. |
| **CO₂ Density** | **Classical** (Span-Wagner EOS, 1996) | Needs implementation | None — published correlation | **Medium** — implement polynomial in TypeScript |
| **CO₂ Viscosity** | **Classical** (Fenghour et al., 1998) | Needs implementation | None — published correlation | **Medium** — implement in TypeScript |
| **CO₂ Solubility in Brine** | **Classical** (Duan-Sun, 2003) | Needs implementation | None — published model | **Medium** — ~200 lines of math |
| **Brine Density** (with dissolved CO₂) | **Classical** (Garcia, 2001) | Needs implementation | None — published correlation | **Low** — simple polynomial |
| **CO₂ Diffusion Coefficient** | **Literature ensemble** | Needs implementation | None — compile from papers | **Low** — 3–5 values interpolated |
| **Phase State Identifier** | **Simple logic** (Tc=31.04°C, Pc=7.38 MPa) | Needs implementation | None — critical point constants | **Trivial** — one-line check |

**Only IFT needs ML.** The other 6 properties are published classical correlations that are well-established in the CCUS literature. They need correct implementation, not training. This means your existing MARS JSON puts you significantly ahead — you have the hardest part done.

**Total implementation effort for all 7 properties in TypeScript:** ~3–5 days for a developer familiar with the math.

---

## 05 — Formation Presets (From Published Data)

Three one-click validated presets sourced from published literature:

### Sleipner (Utsira Sand) — Norway

| Parameter | Value | Source |
|-----------|-------|--------|
| Depth | ~900 m TVD | Arts et al. 2004 |
| Porosity | 35–42% (avg 0.42) | Audigane 2006 |
| Permeability | 1,000–5,000 mD | Boait et al. 2012 |
| Temperature | 36–37°C | Published field data |
| Initial Pressure | 8–11 MPa | Hydrostatic gradient |
| Salinity | 35,000 mg/L (~0.6 mol/kg) | Seawater equivalent |
| kv/kh ratio | ~0.003 (due to internal shales) | Boait et al. 2012 |
| Plume extent (2010) | 5–8 km² (Layer 9) | Boait et al. 2012 |
| Injection rate | ~0.9–1.0 Mt/yr | Equinor operational data |

### Decatur (Illinois Basin — Mt. Simon Sandstone) — USA

| Parameter | Value | Source |
|-----------|-------|--------|
| Depth | 1,900–2,140 m | Finley 2014 (MGSC) |
| Porosity | 16–22% (avg 0.19) | Published core data |
| Permeability | 50–400 mD | Well test data |
| Temperature | 46–50°C | Field measurements |
| Initial Pressure | ~21 MPa | Deep hydrostatic |
| Salinity | 150,000–200,000 mg/L (~2.5–3.5 mol/kg) | Hypersaline brine |
| kv/kh ratio | 0.1–0.4 | Bedding stratification |
| Plume radius | ~1.5–2 km from CCS1 well | Seismic + microseismic |
| Total injected (CCS1) | 1.0 million metric tons (2011–2014) | ADM operational data |

### Otway (Waarre C Sandstone) — Australia

| Parameter | Value | Source |
|-----------|-------|--------|
| Depth | ~2,050 m | CO2CRC reports |
| Porosity | 19–25% (avg 0.23) | Core analysis |
| Permeability | 1,000–3,000 mD | Well test data |
| Temperature | 85°C | High geothermal gradient |
| Initial Pressure | 17.5 MPa (depleted to 3.5 MPa) | Post-depletion |
| Salinity | ~42,000 mg/L (~0.7 mol/kg) | Brine background |
| Injected composition | 80% CO₂ + 20% CH₄ | Gas separation byproduct |
| Total injected | 65,445 metric tons (Stage 1) | CO2CRC |
| Plume extent | <0.5 km² (fault-bounded trap) | Jenkins 2011 |

**Implementation:** Each preset as a JSON object. One-click load populates all parameters and renders formation in 3D. Citation badge references source publication.

---

## 06 — PoC Feature Set

### P0 — Must Have at Launch

**Project Save / Load**
JSON export on free tier. Firebase Firestore cloud save on paid tiers.

**Formation Presets**
Sleipner, Decatur, Otway — one-click validated.

### P1 — Before First Paying User

**Geomechanical Tab**
FPG, Eaton σh, MAIP, caprock seal index linked to live ML IFT.

**Jurisdiction Toggle**
EPA / UK NSTA / Norwegian NPD / PETRONAS Malaysia.

**Guided Onboarding**
"First simulation in 3 minutes" — step-by-step.

### P2 — First 60 Days Post-Launch

**LAS 2.0 Parser** — drag-and-drop well log import
**MMV Planner placeholder** — wireframe showing monitoring well concept
**Technical White Paper** — 15-page downloadable validation document

### Hosting Decision: Firebase

| Service | Why |
|---------|-----|
| **Firebase Hosting** | Free tier (10 GB storage, 360 MB/day data). Static Vite + React app. Custom domain. Global CDN. |
| **Firebase Auth** | Email/password + Google sign-in. Free. |
| **Firestore** | Cloud saves keyed to user ID. Free tier (1 GiB stored, 50K reads/day, 20K writes/day). Sufficient for PoC. |
| **Firebase Functions** | Protected ML ensemble endpoint (returns P10/P50/P90 weights). 2M invocations/month free. |

GitHub Pages also works for the static site, but Firebase is preferred because it gives auth + database + serverless functions in one platform.

### Billing: Simulated (No Stripe)

For the PoC, tier gating is handled entirely client-side via local state. A "Subscribe" button sets a localStorage flag that enables Pro features. No real payment. This lets us validate conversion intent without payment infrastructure.

Post-PoC, Stripe replaces simulated billing.

---

## 07–10 — Feature Specifications

(Project persistence via Firestore, Geomechanical module, Jurisdiction toggle, and IP strategy follow the same architecture as v3.0 with hosting updated from Cloudflare → Firebase. See the Implementation Roadmap for detailed specs.)

---

## 11 — Design Partner Targets (Researched)

### US-based CCUS Consulting Firms (Class VI Experts)

| Firm | Location | Class VI Experience | Contact |
|------|----------|-------------------|---------|
| **Numeric Solutions LLC** | Ventura, CA | 14+ Class VI permits, 9 administrative completeness, 6 final approval | numericsolutions.com |
| **Ridgeline Engineering** | Denver, CO | 10+ Class VI permits across 5 states | ridgeline-eng.com |
| **Tetra Tech** | Global | Full CCS lifecycle: permitting, modeling, monitoring | tetratech.com |
| **SCS Engineers** | US nationwide | Groundbreaking time-based AoR model (co-developed with EPA) | scsengineers.com |
| **Burns & McDonnell** | US nationwide | 15-well Class VI project, AoR >170 sq miles | burnsmcd.com |
| **Upstream EP Advisors** | US | CCS project lifecycle, site screening to Class VI | upstreamepadvisors.com |
| **Graves & Co. Consulting** | Texas | CCS, DOE pilot projects, EOR experience | gravesconsulting.us |
| **EXP** | US + Canada | Full-service CCUS engineering | exp.com |

### Academic Partners (Research + Citation Channel)

| Institution | Program | Contact Strategy |
|-------------|---------|-----------------|
| **UTP Malaysia** | Your MSc programme | Faculty supervisor + PETRONAS connection |
| **University of Wyoming** | School of Energy Resources (CCUS active research group) | Listed in v1 as target — email faculty offering free Studio access |
| **UT Austin** | Bureau of Economic Geology (GCCS research) | Leading CCS academic program — email research faculty |
| **CO2CRC (Australia)** | Otway project operator | Academic network connection via Otway data usage |

### PETRONAS CCS Ecosystem (Malaysia)

| Contact | Role | Relevance |
|---------|------|-----------|
| **Emry Hisham Yusoff** | Head of Carbon Management, PETRONAS | Key decision-maker. Linked to Kasawari CCS (2027 injection), Duyong project, Southern CCS hub. |
| **Nora'in Md Salleh** | CEO, PETRONAS CCS Solutions Sdn Bhd | Operations lead for Kuantan CCS hub. |
| **PETRONAS CCS Ventures (PCCSV)** | Subsidiary for CCS projects | Awarded Malaysia's first CCS permit (Nov 2025). Partnered with TotalEnergies and Mitsui. |

Malaysia has committed to 15 Mtpa by 2030, 40 Mtpa by 2040, 80 Mtpa by 2050. Total assessed storage capacity: 2.4 billion tonnes. 5–7 CCS sites under evaluation.

**This is the first-mover opportunity for CarbonLens: no web-based tool exists for PETRONAS-format permit outputs. We can be the first.**

---

## 12 — Go-to-Market Strategy

### Primary: Technical White Paper (Downloadable PDF)
15 pages: ML methodology, validation against NIST data + Li et al. + published Sleipner results. Highest-converting asset for engineering audiences. Gate behind email capture.

### Secondary: Cold Outreach to Design Partners
Target the 10 firms above with personalised emails including direct Sleipner demo link.

### Academic: Co-Authored Paper + Course Integration
- Co-author "CarbonLens: A Browser-Based CO₂ Storage Simulation Studio" with UTP faculty
- Target course: "Reservoir Engineering for CCS" (you could help create this curriculum)
- Student citations → future consultancy advocates

### SEO: "MIT CO₂ Calculator Alternative"
Ongoing organic search from engineers seeking free CO₂ property tools.
Also target "CCS Energy calculator alternative" and "browser CO2 storage simulation."

---

## 13 — Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Firebase Hosting                     │
│  Vite + React 18 + TypeScript + Tailwind (static app) │
├─────────────────────────────────────────────────────┤
│                  Client-Side (Browser)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Three.js  │  │  D3.js   │  │  Web Worker       │   │
│  │3D Render │  │2D Charts │  │  Sim. Engine      │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────────────┐    │
│  │  ML Property Engine (TypeScript functions)    │     │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────────┐ │    │
│  │  │Classical│ │MARS IFT  │ │Ensemble Weight │ │    │
│  │  │Correlat.│ │(from JSON│ │Call (Firebase   │ │    │
│  │  │(client) │ │→ TS)     │ │Function → KV)   │ │    │
│  │  └─────────┘ └──────────┘ └────────────────┘ │    │
│  └──────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────┤
│             Firebase Backend Services                 │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ Auth (email  │ │Firestore │ │Functions     │     │
│  │ / Google)    │ │(cloud    │ │(ensemble     │     │
│  │              │ │ saves)   │ │ endpoint)    │     │
│  └──────────────┘ └──────────┘ └──────────────┘    │
├─────────────────────────────────────────────────────┤
│  Billing: Simulated (localStorage flag per tier)     │
│  Free (Explorer) → Researcher ($49) → Pro ($799)     │
└─────────────────────────────────────────────────────┘
```

No real Stripe. No Docker. No GCP. No server orchestration.

---

## 14 — PoC Success Criteria

| Metric | Target |
|--------|--------|
| Paying users by Week 8 (simulated or committed) | 3 |
| Sleipner preset reproduces published P50 extent within 15% | Validated |
| Property update latency on M1 MacBook Air | <50ms |
| Jurisdictions in permit toggle | 4 |
| Formation presets at launch | 3 |
| White paper published | Downloadable PDF |
| Design partner outreach emails sent | 20+ |

---

*CARBONLENS STORAGE STUDIO · PoC Product Bible v3.2 · Confidential — Not for distribution*
