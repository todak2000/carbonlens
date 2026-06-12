# CarbonLens

**Browser-based CO₂ geological storage screening and simulation studio**

[![Live App](https://img.shields.io/badge/Live%20App-GitHub%20Pages-blue?style=flat-square)](https://todak2000.github.io/carbonlens/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-build-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)

**Deployed at:** https://todak2000.github.io/carbonlens/

---

## What is CarbonLens?

CarbonLens is a zero-backend, fully client-side CO₂ geological storage simulator that runs entirely in the browser. It is designed for CCUS (Carbon Capture, Utilization & Storage) consultants, academic researchers, and storage operators who need rapid formation screening, physics-based plume simulation, geomechanical risk assessment, and jurisdiction-aware permit documentation — without installing specialist software or provisioning cloud infrastructure.

All computation runs in-browser using TypeScript physics engines. There is no server, no API, and no subscription required. The application is deployed as a static site on GitHub Pages.

### Market Context

Enterprise CO₂ storage simulators (CMG GEM, SLB Petrel) cost $160,000–$230,000/year per license, require dedicated hardware, and are designed primarily for oil and gas workflows. Free alternatives (MRST-co2lab, TOUGH3) require MATLAB or Python expertise and produce no regulatory outputs. CarbonLens sits between these extremes: professional-grade physics, browser-accessible, focused entirely on CO₂ storage.

### Who Built This

CarbonLens was developed by **Daniel T. Olagunju**, Co-Founder & CPO, MSc researcher at Universiti Teknologi PETRONAS (UTP), Malaysia, as part of unified academic and product development work in CCUS and machine learning. The project has been selected for the **Dubai Future Forum "Prototypes for Humanity 2026"** exhibition.

---

## Validation Proof — Sleipner Utsira Benchmark

> The Sleipner Utsira formation in the North Sea is the world's most data-rich CO₂ storage site, operating continuously since 1996. It is the standard benchmark for validating CO₂ storage simulators.

CarbonLens was validated against three landmark peer-reviewed publications on the Sleipner field:

| Reference | Data Used |
|---|---|
| Arts et al. (2004) — *The Leading Edge* | Plume geometry from 4D seismic at the 4-year mark |
| Boait et al. (2012) — *J. Geophys. Res.* | Layer-by-layer migration patterns and lateral spread |
| Furre et al. (2017) — *Energy Procedia* | Full 20-year injection history and pressure evolution |

CarbonLens reproduced the exact injection years described in each paper and achieved close agreement with published field measurements across plume height, lateral spread, and CO₂ dissolution behavior.

**Full validation report (PDF):** [sleipner-validation-report.pdf](https://todak2000.github.io/carbonlens/sleipner-validation-report.pdf)

This report is included in the deployed application and documents the comparison methodology, input parameters, and result tables side-by-side with the published field data. It constitutes reproducible, peer-anchored evidence that CarbonLens physics engines produce physically meaningful results on a real-world benchmark site.

---

## Features

### Physics Engines

| Engine | Model | Paper |
|---|---|---|
| CO₂ Density | Span-Wagner Equation of State | Span & Wagner (1996) |
| CO₂ Solubility in Brine | Duan-Sun model | Duan & Sun (2003) |
| Two-Phase Plume Migration | Nordbotten analytical model | Nordbotten et al. (2005) |
| Capillary Pressure | van Genuchten model | van Genuchten (1980) |
| Geomechanical Failure | Mohr-Coulomb criterion | — |
| Pore Pressure Coupling | Biot poroelasticity | Biot (1941) |
| Interfacial Tension | MARS ML model (UTP MSc research) | Olagunju et al. (in prep.) |

### Simulation Modules

- **Formation Screening** — 16 global presets with editable petrophysical and geometric parameters
- **Plume Simulation** — time-stepped CO₂ migration with buoyancy, dissolution, and residual trapping
- **Monte Carlo Uncertainty Quantification** — P10/P50/P90 storage capacity distributions with convergence tracking
- **History Matching** — forward model adapter with parameter adjustment and fit metrics
- **Geomechanical Risk Analysis** — MAIP (Maximum Allowable Injection Pressure), Mohr-Coulomb fault stability, surface heave calculation
- **100-Year Projection** — long-term storage security assessment

### Visualization

- **3D Three.js Reservoir Viewer** — real-time plume animation with caprock mesh and grid reservoir rendering
- **Wellbore Schematic** — annotated cross-section view
- **Saturation Maps** — CO₂ saturation distribution in the simulation grid
- **Geology Panel** — fault geometry, dip, strike, and stratigraphy visualization

### Export and Compliance

- **Permit Report PDF Export** — jurisdiction-aware regulatory document generation
- **5 Regulatory Jurisdictions:** EPA Class VI (US), EU CCS Directive (2009/31/EC), UK NSTA, AU NOPSEMA, Middle East frameworks
- **Executive Summary Export** — concise summary document for stakeholder distribution
- **HTML Report Export** — shareable web-format report

### Registry and Certification

- **Digital Twin Registry** — each simulation can be registered with a certificate ID (CL-XXXX)
- **Verifiable Certificate Page** — public URL at `/registry/verify/CL-XXXX` for third-party verification
- **Analytics Dashboard** — visitor and usage tracking for the hosted deployment

### Demo Mode

- **7-Stage Auto-Play Demo** — loads Malay Basin preset, runs simulation at 5x speed, cycles through all panels automatically, and auto-saves a certificate. Completes in under 2 minutes. Designed for unattended exhibition kiosks and live demonstrations.

---

## Formation Coverage

| # | Formation | Region | Type |
|---|---|---|---|
| 1 | Sleipner Utsira | North Sea, Norway | Deep saline aquifer |
| 2 | Malay Basin | Southeast Asia, Malaysia | Offshore saline aquifer |
| 3 | Niger Delta | West Africa, Nigeria | Deltaic sandstone aquifer |
| 4 | Gorgon | Northwest Shelf, Australia | Deep saline aquifer |
| 5 | Alberta Basin | Western Canada | Sedimentary basin aquifer |
| 6 | Mount Simon | Illinois Basin, US | Saline sandstone aquifer |
| 7 | Utsira (Generic) | North Sea | Regional aquifer analog |
| 8 | Weyburn | Saskatchewan, Canada | Depleted carbonate reservoir |
| 9 | In Salah | Algeria | Tight sandstone aquifer |
| 10 | Otway Basin | Victoria, Australia | Shallow sandstone aquifer |
| 11 | Cranfield | Mississippi, US | Depleted oil field |
| 12 | Decatur | Illinois, US | Mt. Simon sandstone |
| 13 | Quest | Alberta, Canada | Carbonate saline aquifer |
| 14 | Northern Lights | Horda Platform, Norway | Sognefjord Formation |
| 15 | Jubail | Eastern Province, Saudi Arabia | Middle East deep aquifer |
| 16 | Offshore Sarawak | East Malaysia | Pliocene sandstone aquifer |

---

## Architecture

CarbonLens is a pure client-side single-page application. There is no backend server, no database, and no external API calls during simulation.

```
Browser
  └── Vite + React 18 + TypeScript (SPA)
        ├── Zustand stores (application state)
        ├── Physics engines (TypeScript, runs in main thread)
        │     ├── engine/classical/      Span-Wagner EOS, Duan-Sun solubility
        │     ├── engine/plume/          Nordbotten model, capillary pressure, saturation
        │     ├── engine/grid/           Simulation grid
        │     └── engine/historyMatching/  Forward model adapter
        ├── Three.js (3D visualization, WebGL)
        ├── jsPDF (PDF report generation, fully client-side)
        └── Static assets (formation presets, Sleipner validation PDF)
```

**Why client-side only?**

- Zero infrastructure cost — deployed as a static GitHub Pages site
- No data leaves the browser, relevant for commercially sensitive formation data
- Works offline after first load
- The entire simulator is a URL — shareable with no setup

---

## Repository Structure

```
v3/carbonlens_v3_poc/
  src/
    components/           React UI components
      ThreeViewer/        3D reservoir visualization
      GeologyPanel/       Fault and structure panels
      GeomechanicsPanel/
      MonteCarloPanel/
      HistoryMatching/
      ValidationPanel/
      PermitExport/
      Landing/
      DemoMode/
      Analytics/
    engine/               Physics simulation engines
      classical/          Density (Span-Wagner), solubility (Duan-Sun)
      plume/              Nordbotten plume, capillary pressure, saturation solver
      grid/               Simulation grid
      historyMatching/    Forward model adapter
    hooks/                useSimulation, useFormation
    store/                Zustand state stores
    utils/                PDF export, Monte Carlo, visitor tracking
    data/                 Formation presets, Sleipner benchmark data
    types/                TypeScript type definitions
  public/
    sleipner-validation-report.pdf
  v3/
    validation/
      Sleipner Utsira Benchmark Validation — CarbonLens.pdf
```

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later (or yarn)

### Install and Run

```bash
# Clone the repository
git clone https://github.com/todak2000/carbonlens.git
cd carbonlens/v3/carbonlens_v3_poc

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

Output is written to `dist/`. The build produces a fully static bundle suitable for any static hosting provider (GitHub Pages, Netlify, Vercel, S3, etc.).

### Run Tests

```bash
npm run test
```

Tests cover physics engine correctness (Span-Wagner density, Duan-Sun solubility, capillary pressure, Nordbotten plume), simulation grid behavior, Monte Carlo sampling, export utilities, and formation preset validation.

---

## Physics Reference

| Model | Reference | Application in CarbonLens |
|---|---|---|
| Span-Wagner EOS | Span & Wagner (1996), *J. Phys. Chem. Ref. Data*, 25(6), 1509–1596 | CO₂ density at reservoir P-T conditions |
| Duan-Sun Solubility | Duan & Sun (2003), *Chem. Geology*, 193(3–4), 257–271 | CO₂ dissolution in formation brine |
| Nordbotten Plume | Nordbotten et al. (2005), *Water Resources Research*, 41(12) | Analytical two-phase plume migration |
| van Genuchten | van Genuchten (1980), *Soil Sci. Soc. Am. J.*, 44(5), 892–898 | Capillary pressure and relative permeability |
| Mohr-Coulomb | Standard geomechanics | Fault reactivation and failure envelope analysis |
| Biot Poroelasticity | Biot (1941), *J. Appl. Phys.*, 12(2), 155–164 | Pore pressure to effective stress coupling |
| MARS IFT | Olagunju et al., UTP MSc research | CO₂-brine interfacial tension prediction |
| Sleipner Benchmark | Arts et al. (2004); Boait et al. (2012); Furre et al. (2017) | Physics validation against field data |

---

## Dubai Future Forum — Prototypes for Humanity 2026

CarbonLens has been selected for the **Dubai Future Forum "Prototypes for Humanity 2026"** exhibition. This program showcases early-stage prototypes addressing global challenges, reviewed by an international panel of scientists, engineers, and policymakers.

CarbonLens was selected on the basis of:

- Validated physics against real-world field data (Sleipner Utsira benchmark)
- Accessibility — free, browser-based, no installation
- Global formation coverage across multiple basins and regulatory jurisdictions
- Relevance to Paris Agreement net-zero pathways, where geological CO₂ storage is a required technology at scale

The prototype is demonstrated live at the exhibition using the 7-stage auto-play demo mode, which was designed specifically for this exhibition context.

---

## Key Differentiators vs. Commercial Tools

| Capability | CMG GEM | MRST-co2lab | TOUGH3 | CarbonLens |
|---|---|---|---|---|
| Browser-based, zero install | No | No | No | Yes |
| ML IFT prediction (MARS) | No | No | No | Yes |
| Monte Carlo UQ (P10/P50/P90) | Partial | Partial | No | Yes |
| Permit-ready export | No | No | No | Yes (5 jurisdictions) |
| 3D reservoir visualization | Yes | No | No | Yes |
| Geomechanics module | Partial | No | Partial | Yes |
| Cost | $160K+/yr | Free (MATLAB req.) | Free (complex) | Free |

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request for significant changes so the scope can be discussed first.

Areas where contributions are most valuable:

- Additional formation presets (especially Africa, Middle East, South Asia)
- Additional regulatory frameworks (Japan, South Korea, Brazil)
- Physics engine improvements or additional benchmark validations
- UI/UX improvements for mobile and tablet form factors
- Localization (Arabic, Bahasa Malaysia, French)

---

## License

MIT License. See [LICENSE](LICENSE) for full text.

---

## Citation

If you use CarbonLens in academic work, please cite:

> Olagunju, D. T. (2026). *CarbonLens: A browser-based CO₂ geological storage screening and simulation studio*. Universiti Teknologi PETRONAS. https://todak2000.github.io/carbonlens/

---

## Contact

**Daniel T. Olagunju**
Co-Founder & CPO, CarbonLens
MSc Researcher, Universiti Teknologi PETRONAS (UTP), Malaysia

GitHub: [@todak2000](https://github.com/todak2000)

---

*CarbonLens — Physics-validated CO₂ storage screening, in your browser.*
