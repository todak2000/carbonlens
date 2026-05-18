# CarbonLens Storage Studio — v3 PoC

> **Browser-native CO₂ geological storage simulation. Screen 20 sites in an afternoon. Generate permit-ready outputs. Zero install.**

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Phase](https://img.shields.io/badge/phase-v3%20PoC-blue)
![License](https://img.shields.io/badge/license-Confidential-red)
![React](https://img.shields.io/badge/React-18.3.1-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-3178c6?logo=typescript)
![Three.js](https://img.shields.io/badge/Three.js-0.170.0-black?logo=three.js)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [1. ML Property Engine](#1-ml-property-engine)
  - [2. 3D Reservoir Visualization](#2-3d-reservoir-visualization)
  - [3. Simulation Engine](#3-simulation-engine)
  - [4. Geomechanics Module](#4-geomechanics-module)
  - [5. Formation Presets](#5-formation-presets-8-world-sites)
  - [6. LAS File Import](#6-las-file-import)
  - [7. Jurisdiction & Permit Export](#7-jurisdiction--permit-export)
  - [8. Economics & Leakage Panels](#8-economics--leakage-panels)
  - [9. Project Management](#9-project-management)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Production Build](#production-build)
  - [Type Check](#type-check)
- [Running Tests](#running-tests)
  - [Test Coverage](#test-coverage)
- [Deployment](#deployment)
- [Key Scientific References](#key-scientific-references)
- [Build Status](#build-status)
- [Contributing / Development Notes](#contributing--development-notes)
- [License](#license)

---

## Overview

**CarbonLens Storage Studio** is an integrated, browser-based CO₂ geological storage simulation platform. It enables CCUS practitioners to screen candidate storage sites, run physics-based simulations, perform uncertainty quantification, and generate jurisdiction-specific permit-ready outputs — entirely within the browser, with zero installation required.

### Market Gap

The current CCS software landscape forces a painful choice:

- **Free tools** (MRST-co2lab, open-source scripts): powerful but require MATLAB/Python expertise, lack 3D visualization, and produce no permit outputs.
- **Enterprise simulators** (CMG GEM, SLB Petrel): best-in-class but cost **$160,000–$230,000/year** per license, require dedicated hardware, and have steep learning curves.

CarbonLens fills the **$200K gap** — a professional-grade simulation studio accessible via browser, priced for consulting firms and academic research groups.

### Key Differentiators

| Capability | CCS Energy (AU) | MRST-co2lab | TOUGH3 | **CarbonLens v3** |
|---|---|---|---|---|
| 3D Reservoir Builder | Partial | No | No | **Yes** |
| ML IFT Prediction (MARS) | No | No | No | **Yes** |
| UQ (P10/P50/P90) | No | Partial | No | **Yes** |
| Permit-Ready Export | No | No | No | **Yes (5 jurisdictions)** |
| LAS File Import | No | No | No | **Yes** |
| Geomechanics Module | No | No | Partial | **Yes** |
| Client-Side / Zero Backend | No | No | No | **Yes** |
| Zero Install | No | No | No | **Yes** |

### Target Users

- **CCUS Consulting Firms** — rapid multi-site screening and client deliverables
- **Academic Research Groups** — teaching tool and early-stage feasibility studies
- **CCS Operators** — PETRONAS, Equinor, Chevron project teams for preliminary assessment

---

## Features

### 1. ML Property Engine

Computes **7 CO₂ physical properties in under 50ms** using a combination of a trained MARS machine learning model and published classical correlations.

#### Interfacial Tension (IFT) — MARS Model

The IFT engine uses Multivariate Adaptive Regression Splines (MARS) derived from 3,000+ CO₂-brine experimental datapoints (MSc research, Universiti Teknologi PETRONAS).

- **Phase Detection:** Auto-detects subcritical vs. supercritical regime using Kay's mixing rule
  - Effective critical temperature `Tc_eff` and pressure `Pc_eff` computed from CO₂/CH₄/N₂ mole fractions
  - Reduced temperature `Tr = T / Tc_eff` and reduced pressure `Pr = P / Pc_eff` determine phase
- **Subcritical MARS Model:** 16-term equation (intercept base: 51.62 mN/m)
- **Supercritical MARS Model:** 35-term equation for higher-accuracy supercritical prediction
- **Feature Scaling:** All inputs scaled to `[-1, 1]` before model evaluation using min-max normalization
- **Hinge Functions:** Piecewise linear basis functions of the form `max(0, x - knot)` and `max(0, knot - x)`

#### CO₂ Density
- **Model:** Span-Wagner Equation of State (1996)
- **Method:** Iterative Z-factor convergence for accurate PVT prediction
- **Range:** Valid across a wide P-T domain including subcritical, supercritical, and liquid CO₂ phases

#### CO₂ Viscosity
- **Model:** Fenghour et al. (1998) correlation
- **Inputs:** Temperature, pressure, CO₂ density

#### CO₂ Solubility in Brine
- **Model:** Duan-Sun (2003)
- **Features:** Salinity-dependent (salting-out effect), pressure and temperature scaling

#### Brine Density
- **Model:** Garcia (2001) polynomial correlation
- **Inputs:** Temperature, salinity, dissolved CO₂ concentration

#### CO₂ Diffusion Coefficient
- **Model:** Literature ensemble
- **Inputs:** Temperature, pressure, porosity — captures both molecular diffusion and pore-scale tortuosity effects

#### Phase Detection
- **Model:** Kay's mixing rule for CO₂/CH₄/N₂ gas mixtures
- Used to route IFT calculation to the correct MARS sub-model

---

### 2. 3D Reservoir Visualization

An interactive 3D scene powered by **React Three Fiber (R3F)** and **Three.js v0.170** for real-time parametric reservoir visualization.

#### Geometry Types
Six parametric reservoir geometries are available:

| Type | Description |
|------|-------------|
| `anticline` | Symmetric anticlinal dome trap |
| `dome` | Circular structural dome |
| `fault` | Faulted block with offset |
| `layered` | Horizontal stratified sequence |
| `stratigraphic` | Wedge-out / pinch-out trap |
| `channel` | Fluvial channel sand body |

#### Rock Property Visualization
- **Porosity → Vertex Color Mapping:** Dark brown (5% porosity) to warm tan (40% porosity) — continuous color gradient across the mesh
- **Permeability → Surface Roughness:** FBM (Fractional Brownian Motion) noise amplitude scales with permeability, providing visual texture variation

#### Scene Elements
- **CO₂ Plume:** Scaled blue sphere centered at reservoir — diameter grows proportionally with computed injection capacity
- **Seal / Caprock Outline:** Teal wireframe mesh with "Seal" label, displayed above the reservoir geometry
- **Well Markers:** Up to 5 wells rendered as cylinders with floating text labels (position and name driven by Zustand store)
- **Custom Grid Import:** JSON grid deformation array for user-supplied reservoir grids
- **OrbitControls:** Full pan, rotate, and zoom navigation

---

### 3. Simulation Engine

Physics-based injection simulation with uncertainty quantification.

#### Pressure Model
- **Theis (1935) Transient Radial Flow** for single-well drawdown/buildup
- **Multi-well Superposition:** Linear pressure superposition for interference modeling with up to 5 wells

#### Storage Capacity (DOE Framework)
Probabilistic storage capacity following US DOE methodology:

| Scenario | Storage Efficiency | Description |
|---|---|---|
| P10 | 0.51% of pore volume | Conservative / low estimate |
| P50 | 2.0% of pore volume | Most likely / base case |
| P90 | 5.5% of pore volume | Optimistic / high estimate |

#### Trapping Model
Per injection timestep:
- **Residual trapping:** 60% of injected CO₂ (capillary trapping)
- **Solubility trapping:** 40% of injected CO₂ (dissolution in brine)

#### Timeline
- **50-year injection horizon** with annual timesteps
- UQ bar chart visualization of P10/P50/P90 outcomes

---

### 4. Geomechanics Module

Evaluates caprock integrity and injection-induced geomechanical risk.

#### Mohr-Coulomb Analysis
- Canvas-based Mohr-Coulomb failure envelope diagram
- Plots effective stress circles against the cohesion-friction failure line
- Visualizes fault slip potential and failure margin

#### MAIP Calculation
- **Maximum Allowable Injection Pressure (MAIP):** Computed from minimum horizontal stress and fracture gradient
- Provides the upper injection pressure bound for operational planning

#### Safety Assessment
- **Caprock Safety Factor:** Ratio of caprock strength to induced stress increment
- **Induced Seismicity Risk Badge:** Categorical assessment — `low` / `moderate` / `high` — based on pressure perturbation magnitude
- **Fault Slip Potential:** Visual indicator of proximity to slip on known fault planes

#### Pre-Flight Validation
4-point checklist run before simulation execution:
1. Pressure within MAIP bounds
2. Injection rate within formation capacity
3. Caprock safety factor above minimum threshold
4. Well placement within reservoir extent

---

### 5. Formation Presets (8 World Sites)

Eight globally representative CO₂ storage formations are pre-loaded as starting points.

| Name | Location | Depth (m) | Porosity | Permeability (mD) | Literature Source |
|---|---|---|---|---|---|
| Sleipner Utsira | North Sea, Norway | 1,012 | 37% | 3,000 | Arts et al. (2004) |
| Mount Simon | Illinois Basin, USA | 2,134 | 15% | 500 | Finley (2014) |
| Snøhvit Tubåen | Barents Sea, Norway | 2,600 | 13% | 150 | Equinor |
| Gorgon | Barrow Island, Australia | 2,300 | 18% | 200 | Chevron |
| In Salah | Algeria | 1,800 | 12% | 50 | BP / Sonatrach |
| Kasawari | Sarawak, Malaysia | 1,300 | 20% | 800 | PETRONAS |
| Duyong | Terengganu, Malaysia | 1,500 | 22% | 600 | PETRONAS (first CCS permit Nov 2025) |
| Otway | Victoria, Australia | 2,000 | 17% | 350 | CO2CRC |

---

### 6. LAS File Import

Drag-and-drop well log import for real data integration.

- **Format:** LAS 2.0 standard
- **Extracted Curves:**
  - `DEPTH` — measured or true vertical depth
  - `POR` — porosity (fraction or percent)
  - `PERM` — permeability (mD)
  - `GR` — gamma ray (API units)
  - `RHOB` — bulk density (g/cc)
- Imported values populate the formation parameter store, overriding manual inputs
- A **sample LAS file** with 20 depth samples is provided at `public/sample_well.las`

---

### 7. Jurisdiction & Permit Export

Generate permit-ready documentation for five major CCS regulatory frameworks.

#### Supported Jurisdictions

| Jurisdiction | Regulatory Body | Template Coverage |
|---|---|---|
| United States | EPA Class VI (Underground Injection Control) | Area of Review, injection zone characterization, monitoring plan |
| European Union | EU CCS Directive (2009/31/EC) | Characterization report, corrective measures plan |
| Malaysia | PETRONAS Technical Standards | Malaysian formation-specific fields, PETRONAS operator data |
| Australia | Offshore Petroleum and Greenhouse Gas Storage Act | Injection license requirements, site characterization |
| Norway | Norwegian Petroleum Directorate (NPD) | NORSOK-aligned, North Sea specific requirements |

#### Export Formats
- **Permit Report:** Jurisdiction-specific `.txt` report with populated template fields
- **Copy to Clipboard:** One-click copy of the full permit text
- **JSON Export:** Full project state (formation params, simulation results, well data)
- **Excel-Compatible Export:** Tabular data for integration with spreadsheet workflows

---

### 8. Economics & Leakage Panels

- **Economics Panel:** Cost/benefit analysis including CAPEX estimates, $/tonne CO₂ storage costs, and revenue projections under carbon credit pricing scenarios
- **Leakage Panel:** Leakage risk assessment with probability × consequence scoring, monitoring requirement recommendations, and risk mitigation notes

---

### 9. Project Management

Full project lifecycle management within the browser.

- **Dashboard:** Project list with cards showing site name, geometry type, last modified date
- **CRUD Operations:** Create new project, open existing, delete with confirmation
- **Mock Authentication:** localStorage-based login/register/logout (no real credentials required)
- **Project Persistence:**
  - `localStorage` for lightweight session state
  - `Dexie` (IndexedDB wrapper) for full project data persistence across sessions
- **8 formation presets** available as starting points when creating a new project

---

## Architecture

```
Browser (Zero Backend)
├── Vite + React 18 + TypeScript + Tailwind CSS
│   └── Entry: main.tsx → App.tsx (auth gate + routing)
│
├── State: Zustand (4 stores)
│   ├── authStore       — mock auth session
│   ├── formationStore  — formation params + well positions
│   ├── simulationStore — run status + results + UQ
│   └── uiStore         — active panel + theme + units
│
├── 3D: React Three Fiber + Three.js
│   ├── 6 parametric geometry generators
│   ├── Porosity → vertex color + Permeability → FBM roughness
│   └── OrbitControls + well markers + plume sphere
│
├── ML Engine: MARS (TypeScript) + Classical Correlations
│   ├── MARS IFT (sub-critical: 16-term, super-critical: 35-term)
│   ├── Span-Wagner EOS (CO₂ density)
│   ├── Fenghour viscosity + Duan-Sun solubility
│   └── Garcia brine density + diffusion ensemble
│
├── Persistence: localStorage + Dexie (IndexedDB)
│   └── Full project state serialized to JSON
│
└── Export: jsPDF + GIF.js + Excel/JSON/ZIP
    ├── 5 jurisdiction permit templates
    ├── Time-series profile generator
    └── Multi-format ZIP package
```

---

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.5.4 | Type safety |
| Vite | 5.4.3 | Build tool + dev server |
| Three.js | 0.170.0 | 3D rendering engine |
| @react-three/fiber | 8.17.0 | React renderer for Three.js |
| @react-three/drei | 9.114.0 | Three.js helpers (OrbitControls, Text, etc.) |
| Zustand | 4.5.5 | Global state management |
| Tailwind CSS | 3.4.10 | Utility-first styling |
| Dexie | 4.0.8 | IndexedDB wrapper for project persistence |
| jsPDF | 2.5.2 | PDF generation for permit exports |
| Lucide React | 1.16.0 | Icon library |
| IBM Plex Sans | Latest | Primary UI font |
| IBM Plex Mono | Latest | Monospace font for data readouts |
| Vitest | Latest | Unit test runner |
| happy-dom | Latest | Lightweight DOM environment for tests |

---

## Project Structure

```
v3/carbonlens_v3_poc/
├── src/
│   ├── types/
│   │   └── index.ts                    # All shared TypeScript interfaces and type definitions
│   │
│   ├── engine/                         # Physics + ML computation layer
│   │   ├── mars/                       # MARS IFT machine learning model
│   │   │   ├── types.ts                # MarsInput, MarsEquation, FeatureScaler interfaces
│   │   │   ├── evaluate.ts             # hinge() basis function + evaluateMars() runner
│   │   │   ├── scaler.ts               # Min-max feature scaling to [-1, 1]
│   │   │   ├── subModel.ts             # 16-term subcritical MARS model coefficients
│   │   │   ├── supModel.ts             # 35-term supercritical MARS model coefficients
│   │   │   └── index.ts                # Public API: predictIFT()
│   │   │
│   │   ├── classical/                  # 6 published physical property correlations
│   │   │   ├── density.ts              # Span-Wagner EOS (CO₂) + Garcia (brine)
│   │   │   ├── viscosity.ts            # Fenghour et al. (1998) CO₂ viscosity
│   │   │   ├── solubility.ts           # Duan-Sun (2003) CO₂-brine solubility
│   │   │   ├── diffusion.ts            # Literature ensemble diffusion coefficient
│   │   │   ├── phase.ts                # Kay's rule phase detection + Tr/Pr computation
│   │   │   └── index.ts                # Public API: computeProperties()
│   │   │
│   │   └── index.ts                    # Unified engine export
│   │
│   ├── store/                          # Zustand global state stores
│   │   ├── authStore.ts                # Mock login / register / logout + session state
│   │   ├── formationStore.ts           # Formation parameters + well CRUD + preset loading
│   │   ├── simulationStore.ts          # Simulation run status + results + UQ outputs
│   │   ├── uiStore.ts                  # Active panel navigation + theme + unit system
│   │   └── index.ts                    # Re-exports all stores
│   │
│   ├── data/                           # Static reference data
│   │   ├── formationPresets.ts         # 8 world-class formation presets
│   │   └── defaultProject.ts           # Blank project factory function
│   │
│   ├── components/                     # React UI components
│   │   ├── Auth/
│   │   │   └── AuthScreen.tsx          # Login / registration screen
│   │   ├── Dashboard/                  # Project list, cards, CRUD controls
│   │   ├── Layout/                     # MainLayout wrapper + collapsible Sidebar
│   │   ├── FluidProperties/            # Real-time 7-property readout panel
│   │   ├── FormationInputs/            # Parameter sliders + LAS drag-drop upload
│   │   ├── SimulationPanel/            # Run button + progress + UQ P10/P50/P90 chart
│   │   ├── GeomechanicsPanel/          # Mohr-Coulomb diagram + MAIP + risk badge
│   │   ├── EconomicsPanel/             # Cost/benefit + $/tonne analysis
│   │   ├── LeakagePanel/               # Leakage risk scoring + monitoring recommendations
│   │   ├── ScreeningPanel/             # Multi-site rapid screening view
│   │   ├── JurisdictionToggle/         # 5-jurisdiction selector (US/EU/MY/AU/NO)
│   │   ├── PermitExport/               # Permit report generation + download panel
│   │   ├── OverviewPanel/              # Project summary + key metrics
│   │   └── ThreeViewer/                # R3F 3D scene + CrossSection view
│   │
│   ├── hooks/                          # Custom React hooks
│   │   ├── useSimulation.ts            # Theis pressure model, trapping, UQ computation
│   │   ├── useThreeScene.ts            # Three.js scene management + geometry generation
│   │   ├── useSalinityDefaults.ts      # Formation-type salinity defaults lookup
│   │   └── useProjectPersistence.ts    # Dexie save/load + localStorage sync
│   │
│   ├── utils/                          # Pure utility functions
│   │   ├── math.ts                     # Clamp, unit conversions, linear interpolation
│   │   ├── units.ts                    # Metric/Imperial label and conversion definitions
│   │   ├── noise.ts                    # FBM noise generator for terrain deformation
│   │   ├── lasParser.ts                # LAS 2.0 file parser (header + curve data)
│   │   ├── gridParser.ts               # JSON grid deformation array parser
│   │   ├── deformation.ts              # Parametric geometry deformation functions
│   │   ├── computePressureField.ts     # Theis equation + multi-well superposition
│   │   ├── computeOptimalRate.ts       # Injection rate envelope optimization
│   │   ├── autoOptimize.ts             # Automated well schedule optimization
│   │   ├── permitTemplates.ts          # 5 jurisdiction permit report templates
│   │   ├── profileGenerator.ts         # Time series generation + JSON export
│   │   ├── exportPackage.ts            # Multi-format ZIP export (JSON + CSV + permit)
│   │   └── gifRecorder.ts              # 3D animation capture to GIF
│   │
│   ├── worker/
│   │   └── simulation.worker.ts        # Web Worker stub (heavy simulation offloading)
│   │
│   ├── App.tsx                         # Root component: auth gate + panel routing
│   ├── main.tsx                        # React DOM root mount
│   └── index.css                       # Tailwind directives + custom slider styles
│
├── public/
│   └── sample_well.las                 # Sample LAS 2.0 file (20 depth samples, POR/PERM/GR/RHOB)
│
├── src/__tests__/                      # Vitest test suite
│   ├── engine/
│   │   ├── mars/
│   │   │   ├── evaluate.test.ts        # hinge() + evaluateMars() unit tests
│   │   │   ├── scaler.test.ts          # scaleInput() unit tests
│   │   │   └── integration.test.ts     # Full MARS pipeline end-to-end tests
│   │   └── classical/
│   │       ├── phase.test.ts           # Phase detection + Kay's rule tests
│   │       ├── density.test.ts         # Span-Wagner EOS + Garcia brine tests
│   │       ├── viscosity.test.ts       # Fenghour viscosity tests
│   │       ├── solubility.test.ts      # Duan-Sun solubility tests
│   │       └── diffusion.test.ts       # Diffusion coefficient tests
│   ├── utils/
│   │   ├── math.test.ts                # Unit conversion + math utility tests
│   │   └── lasParser.test.ts           # LAS 2.0 parser tests
│   └── data/
│       └── formationPresets.test.ts    # Formation preset validation tests
│
├── package.json                        # Dependencies + scripts
├── vite.config.ts                      # Vite build configuration
├── vitest.config.ts                    # Vitest test runner configuration
├── tsconfig.json                       # TypeScript compiler options
├── tailwind.config.js                  # Tailwind CSS theme + purge config
└── postcss.config.js                   # PostCSS plugins (autoprefixer)
```

---

## Getting Started

### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Yarn** (recommended) — `npm install -g yarn`
- A modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Installation

```bash
cd v3/carbonlens_v3_poc
yarn install
```

### Development

```bash
yarn dev
# Opens http://localhost:5173/
```

Log in with **any email and any password** — authentication is mocked via localStorage. No real credentials are needed or stored.

### Production Build

```bash
yarn build
# Output written to dist/

yarn preview
# Preview the production build locally at http://localhost:4173/
```

### Type Check

```bash
yarn lint
# Runs TypeScript compiler (tsc --noEmit) for type-checking without output
```

---

## Running Tests

```bash
# Install dependencies first (if not done)
yarn install

# Run all tests once (CI mode)
yarn test

# Watch mode — re-runs tests on file changes during development
yarn test:watch

# Interactive UI — browser-based test runner with visual diff
yarn test:ui
```

### Test Coverage

The test suite comprises **11 test files** covering the full physics and utility layer.

| Test File | Module | Test Cases |
|-----------|--------|------------|
| `engine/mars/evaluate.test.ts` | `hinge()` + `evaluateMars()` | 8 — direction logic, multi-hinge products, missing features |
| `engine/mars/scaler.test.ts` | `scaleInput()` | 5 — min/max scaling, edge cases, pass-through |
| `engine/mars/integration.test.ts` | Full MARS pipeline | 3 — end-to-end subcritical IFT prediction |
| `engine/classical/phase.test.ts` | `determinePhase()`, `computeTr()`, `computePr()` | 8 — pure CO₂, Kay's mixing, CH₄ + N₂ blends |
| `engine/classical/density.test.ts` | Span-Wagner EOS + Garcia brine | 10 — monotonicity, clamps, Sleipner conditions |
| `engine/classical/viscosity.test.ts` | Fenghour viscosity | 4 — density scaling, positivity |
| `engine/classical/solubility.test.ts` | Duan-Sun solubility | 5 — salting-out, pressure dependence |
| `engine/classical/diffusion.test.ts` | Diffusion coefficient | 5 — T/P/porosity scaling |
| `utils/math.test.ts` | Unit conversions + math utils | 18 — clamp, °C↔K, MPa↔psi, m↔ft, interpolation |
| `utils/lasParser.test.ts` | LAS 2.0 parser | 7 — depths, curves, edge cases |
| `data/formationPresets.test.ts` | 8 formation presets | 10 — validation, Sleipner porosity, salt types |

**Total: 83 test cases**

---

## Deployment

### GitHub Pages (Automatic CI/CD)

The repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml`. Any push to the `main` branch triggers:

1. `yarn install`
2. `yarn build`
3. Deploy `dist/` to GitHub Pages

Live URL: `https://<username>.github.io/carbonlens/`

### Manual Static Deploy

```bash
yarn build
# Upload the contents of dist/ to any static hosting provider:
#   - Netlify (drag and drop dist/ folder)
#   - Vercel (vercel deploy --prod)
#   - Firebase Hosting (firebase deploy)
#   - GitHub Pages (gh-pages -d dist)
#   - AWS S3 + CloudFront
#   - Azure Static Web Apps
```

No server configuration required — the app is a pure static SPA.

---

## Key Scientific References

| Model | Reference |
|-------|-----------|
| CO₂ Density (EOS) | Span, R. & Wagner, W. (1996). A new equation of state for carbon dioxide covering the fluid region from the triple-point temperature to 1100 K at pressures up to 800 MPa. *J. Phys. Chem. Ref. Data*, 25(6), 1509–1596. |
| CO₂ Viscosity | Fenghour, A., Wakeham, W.A., & Vesovic, V. (1998). The viscosity of carbon dioxide. *J. Phys. Chem. Ref. Data*, 27(1), 31–44. |
| CO₂ Solubility in Brine | Duan, Z. & Sun, R. (2003). An improved model calculating CO₂ solubility in pure water and aqueous NaCl solutions from 273 to 533 K and from 0 to 2000 bar. *Chem. Geol.*, 193(3–4), 257–271. |
| Brine Density | Garcia, J.E. (2001). *Density of aqueous solutions of CO₂*. Lawrence Berkeley National Laboratory, LBNL-49023. |
| IFT Prediction (MARS) | Olagunju et al. MSc thesis, Universiti Teknologi PETRONAS (UTP), Malaysia. MARS model trained on 3,000+ CO₂-brine IFT datapoints. |
| Sleipner Plume Monitoring | Boait, F.C., White, N.J., Bickle, M.J., Chadwick, R.A., Neufeld, J.A., & Huppert, H.E. (2012). Spatial and temporal evolution of injected CO₂ at the Sleipner Field, North Sea. *J. Geophys. Res.*, 117(B3). |
| Transient Pressure Model | Theis, C.V. (1935). The relation between the lowering of the piezometric surface and the rate and duration of discharge of a well using groundwater storage. *Trans. AGU*, 16(2), 519–524. |
| Storage Capacity Framework | U.S. DOE (2008). *Carbon Sequestration Atlas of the United States and Canada* (2nd ed.). National Energy Technology Laboratory. |
| Mount Simon Formation | Finley, R.J. (2014). An overview of the Illinois Basin – Decatur Project. *Greenhouse Gases: Sci. Technol.*, 4(5), 571–579. |
| Sleipner Utsira Formation | Arts, R. et al. (2004). Seismic time-lapse monitoring of CO₂ injection under the sea. *The Leading Edge*, 23(2). |

---

## Build Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 — Math Engine | Complete | MARS IFT model + 6 classical correlations (density, viscosity, solubility, diffusion, brine, phase) |
| Phase 1 — State + Auth + Presets | Complete | 4 Zustand stores, mock authentication, 8 world formation presets, project dashboard |
| Phase 2 — 3D + Persistence | Complete | React Three Fiber viewer, 6 parametric geometry types, Dexie IndexedDB persistence |
| Phase 3 — Simulation + UQ | Partial | Core Theis simulation runs; 50-year playback animation + Viridis plume coloring pending |
| Phase 4 — Geomechanics + Export | Complete | Mohr-Coulomb canvas diagram, MAIP calculation, 5 jurisdiction permit export |
| Phase 5 — Polish + Deploy | Partial | Production build passes; onboarding tour + subscription tier gating pending |
| Phase 6 — 3D Enhancements + LAS | Complete | Porosity vertex coloring, permeability FBM roughness, LAS 2.0 drag-drop import |

---

## Contributing / Development Notes

- **Zero Backend:** All physics, ML inference, and data persistence run entirely client-side. No API keys, no servers, no network calls required.
- **MARS Model Origin:** The IFT MARS model coefficients are derived from 3,000+ CO₂-brine interfacial tension datapoints collected as part of MSc research at Universiti Teknologi PETRONAS (UTP), Malaysia. This is a novel, proprietary model.
- **Testing Environment:** Vitest + `happy-dom` — no real browser or headless Chrome required. Tests run in ~2 seconds.
- **Type Safety:** Strict TypeScript throughout. Run `yarn lint` before committing to catch type errors early.
- **Unit System:** The app supports Metric and Imperial unit display. Unit conversions are defined in `src/utils/units.ts` and `src/utils/math.ts`.
- **State Architecture:** All simulation inputs flow through Zustand stores. Components read from stores; hooks write to stores. Avoid prop drilling.
- **Geometry Extensibility:** New reservoir geometry types can be added by creating a new case in the geometry switch in `useThreeScene.ts` and registering it in the formation type enum in `src/types/index.ts`.

---

## License

**Confidential — CarbonLens Ltd. Not for public distribution.**

PoC Edition v0.1.0 — All rights reserved. This software and its associated ML models, permit templates, and simulation methodologies are proprietary to CarbonLens Ltd. Unauthorized copying, distribution, or use is strictly prohibited.

---

*CarbonLens Storage Studio — Built for CCUS practitioners. Powered by browser-native ML and physics.*
