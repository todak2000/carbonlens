# CarbonLens Storage Studio — Implementation Tracker
**Updated: 18 May 2026 · Phase 0 (Math Engine) + Phase 1 (State/Auth/Presets) + Phase 2 (3D + Persistence) + Phase 6 (3D Enhancements + LAS) — DONE**

---

## Key Architecture Decisions (V3.3 — Actual)

| Decision | V3.2 Plan | V3.3 Actual | Rationale |
|----------|-----------|-------------|-----------|
| **Hosting** | Firebase Hosting | **GitHub Pages** | Simpler, free CDN, no account setup needed |
| **Auth** | Firebase Auth (email/Google) | **Mock localStorage** | Zero backend, instant login |
| **Persistence** | Firestore cloud saves | **localStorage + Dexie (IndexedDB)** | Fully client-side, no cloud costs |
| **Billing** | Simulated localStorage | **Simulated localStorage** | Same — works fine |
| **Backend** | Firebase Functions | **None** | All equations client-side |
| **ML Scope** | Only IFT needs ML | **Only IFT needs ML** | Unchanged — MARS already done |
| **Stack** | Vite + React + TS + Tailwind | **Same** | Unchanged |

---

## Build Progress

### Phase 0 — Math Engine ✅ DONE
| Module | Files | Status |
|--------|-------|--------|
| MARS subcritical (16-term) evaluator + scaler | `engine/mars/subModel.ts` | ✅ Built from your JSON |
| MARS supercritical (35-term) evaluator + scaler | `engine/mars/supModel.ts` | ✅ Built from your JSON |
| Hinge function + feature scaling | `engine/mars/evaluate.ts`, `scaler.ts` | ✅ Verified |
| Span-Wagner CO₂ density | `engine/classical/density.ts` | ✅ Implemented |
| Fenghour CO₂ viscosity | `engine/classical/viscosity.ts` | ✅ Implemented |
| Duan-Sun CO₂ solubility | `engine/classical/solubility.ts` | ✅ Implemented |
| Garcia brine density | `engine/classical/density.ts` | ✅ Implemented |
| Diffusion coefficient | `engine/classical/diffusion.ts` | ✅ Implemented |
| Kay's rule phase detection | `engine/classical/phase.ts` | ✅ Implemented |

### Phase 1 — State + Auth + Presets ✅ DONE
| Feature | Files | Status |
|---------|-------|--------|
| Zustand stores (auth, formation, simulation, UI) | `store/*.ts` | ✅ 4 stores |
| Mock auth (any email/password → localStorage) | `store/authStore.ts` + `AuthScreen.tsx` | ✅ Login/Register |
| Dashboard with project CRUD | `components/Dashboard/*.tsx` | ✅ Create, open, delete |
| 8 formation presets (Sleipner, Mt Simon, Snøhvit, Gorgon, In Salah, Kasawari, Duyong, Otway) | `data/formationPresets.ts` | ✅ Load from dashboard |
| Two-input salinity (monovalent + bivalent) + salt-type dropdown | `components/FormationInputs/FormationPanel.tsx` | ✅ Confirmed design |

### Phase 2 — 3D + Persistence ✅ DONE
| Feature | Files | Status |
|---------|-------|--------|
| Three.js reservoir renderer (R3F Canvas) | `components/ThreeViewer/ReservoirViewer.tsx` | ✅ OrbitControls, lighting |
| Anticline geometry (sine-wave deformed) | Same file | ✅ Parametric |
| Dome geometry (radial bulge) | Same file | ✅ Parametric |
| Layered geometry (flat strata) | Same file | ✅ Parametric |
| Fault geometry (vertical offset) | Same file | ✅ Parametric |
| Caprock (semi-transparent overlay) | `CaprockMesh` in viewer | ✅ Follows surface |
| CO₂ plume (blue sphere, scales with result) | `PlumeMesh` in viewer | ✅ Grows with capacity |
| Well markers (cylinder + label) | `WellMarkers` in viewer | ✅ Store-driven, up to 5, real-time updates |
| Grid helper + slow auto-rotation | Viewer | ✅ |
| Dexie.js installed for IndexedDB | `package.json` | ✅ Ready for Phase 2 upgrade |

### Phase 3 — Simulation + UQ 🟡 PARTIAL
| Feature | Files | Status |
|---------|-------|--------|
| Run Simulation button → computes all 7 properties | `components/SimulationPanel/SimulationPanel.tsx` | ✅ Wired end-to-end |
| IFT prediction via MARS (sub/sup auto-detect) | Same file | ✅ Phase detection → correct model |
| Storage capacity, plume radius, containment | Same file | ✅ Computed from params |
| P10/P50/P90 UQ bar chart | `UQDisplay.tsx` | ✅ Simple bar display |
| Web Worker simulation thread | `worker/simulation.worker.ts` | 🔧 Stub — needs full physics |
| Playback controls (timestep slider) | — | ❌ Not started |
| Saturation plume rendering (Viridis) | — | ❌ Not started |
| D3.js 2D cross-section | — | ❌ Not started |

### Phase 4 — Geomechanics + Jurisdiction + Export ✅ DONE
| Feature | Files | Status |
|---------|-------|--------|
| Caprock stress, fracture pressure, safety factor | `components/GeomechanicsPanel/GeomechanicsPanel.tsx` | ✅ Computed live |
| Induced seismicity risk (low/mod/high) | Same file | ✅ Colour-coded badge |
| Fault slip potential bar | Same file | ✅ Visual bar |
| 5-jurisdiction toggle (US, EU, Malaysia, Australia, Norway) | `components/JurisdictionToggle/JurisdictionPanel.tsx` | ✅ With requirements list |
| Plaintext permit export + copy to clipboard | `components/PermitExport/ExportPanel.tsx` | ✅ Download + copy |

### Phase 6 — 3D Enhancements + LAS Upload ✅ DONE
| Feature | Files | Status |
|---------|-------|--------|
| Wells in shared formation store (add/remove/rate) | `store/formationStore.ts` | ✅ All wells in Zustand, not local state |
| 3D wells driven by store (positions, rates, labels) | `components/ThreeViewer/ReservoirViewer.tsx` | ✅ Real-time add/remove/rate updates |
| All formation params drive 3D rebuild | Same file | ✅ depth, porosity, permeability, thickness, geometry |
| Porosity → vertex color mapping | Same file | ✅ Dark brown (5%) → warm tan (40%) |
| Permeability → surface roughness | Same file | ✅ Noise amplitude scales with permeability |
| FBM noise for organic terrain | `utils/noise.ts` | ✅ 3-octave smooth noise, seeded by geometry type |
| Seal outline replaces dark caprock overlay | `ReservoirViewer.tsx` | ✅ Thin teal wire + "Seal" label, no dark overlay |
| Improved geometry (layered bands, fault smoothstep, anticline/dome refinements) | Same file | ✅ Each type visually distinct |
| LAS file parser | `utils/lasParser.ts` | ✅ Basic parser (curves + metadata) |
| LAS upload UI + sample download | `components/FormationInputs/FormationPanel.tsx` | ✅ Upload .las → store curves, download sample link |
| Sample LAS file | `public/sample_well.las`, `src/sample/sample_well.las` | ✅ 20 depth samples with POR/PERM/GR/RHOB |

### Phase 5 — Polish + Deploy 🟡 PARTIAL
| Feature | Files | Status |
|---------|-------|--------|
| GitHub Actions deploy workflow | `.github/workflows/deploy.yml` | ✅ Ready |
| Build passes (`yarn build` → 325 KB gzip) | — | ✅ Verified |
| Tailwind styling | All components | ✅ Dark theme, sliders, buttons |
| Onboarding tutorial | — | ❌ Not started |
| Tier gating (Free/Pro features) | — | ❌ Not started |
| Accessibility audit | — | ❌ Not started |

---

## File Map (45 source files)

```
src/
├── types/index.ts                    # All shared types
├── engine/
│   ├── mars/                         # MARS IFT equation
│   │   ├── types.ts                  # MarsInput, MarsEquation, etc.
│   │   ├── evaluate.ts               # hinge() + evaluateMars()
│   │   ├── scaler.ts                 # Min-max scaler [-1, 1]
│   │   ├── subModel.ts              # 16-term subcritical model
│   │   ├── supModel.ts              # 35-term supercritical model
│   │   └── index.ts
│   ├── classical/                    # 6 published correlations
│   │   ├── density.ts               # Span-Wagner CO₂ + Garcia brine
│   │   ├── viscosity.ts             # Fenghour CO₂
│   │   ├── solubility.ts            # Duan-Sun
│   │   ├── diffusion.ts             # Literature ensemble
│   │   ├── phase.ts                 # Kay's rule auto-detect
│   │   └── index.ts
│   └── index.ts
├── store/
│   ├── authStore.ts                 # mock login/logout/register
│   ├── formationStore.ts            # formation params + setters
│   ├── simulationStore.ts           # status + result
│   ├── uiStore.ts                   # panel, jurisdiction, units
│   └── index.ts
├── data/
│   ├── formationPresets.ts          # 8 world formations
│   └── defaultProject.ts            # blank project factory
├── components/
│   ├── Auth/AuthScreen.tsx          # Login / Register
│   ├── Dashboard/index.tsx          # Project list + create
│   ├── Dashboard/ProjectCard.tsx     # Card with status badge
│   ├── Layout/MainLayout.tsx        # Shell: header + sidebar + 3D
│   ├── Layout/Sidebar.tsx           # Icon nav bar
│   ├── FluidProperties/PropertyPanel.tsx  # All properties readout
│   ├── FluidProperties/PropertyRow.tsx
│   ├── FormationInputs/FormationPanel.tsx # All sliders + toggles
│   ├── SimulationPanel/SimulationPanel.tsx # Run + IFT + results
│   ├── SimulationPanel/UQDisplay.tsx      # P10/P50/P90 bars
│   ├── ThreeViewer/ReservoirViewer.tsx    # R3F 3D scene
│   ├── GeomechanicsPanel/GeomechanicsPanel.tsx
│   ├── JurisdictionToggle/JurisdictionPanel.tsx
│   └── PermitExport/ExportPanel.tsx
├── hooks/
│   ├── useSalinityDefaults.ts
│   ├── useThreeScene.ts
│   ├── useSimulation.ts
│   └── useProjectPersistence.ts
├── worker/
│   └── simulation.worker.ts         # Web Worker stub
├── utils/
│   ├── math.ts                      # Clamp, interp, conversions
│   └── units.ts                     # Metric/Imperial labels
├── App.tsx                          # Auth gate → MainLayout
├── main.tsx                         # Entry point
└── index.css                        # Tailwind + slider styles
```

---

## Commands

| Command | Purpose |
|---------|---------|
| `yarn dev` | Run dev server (localhost:5173) |
| `yarn build` | Production build → `dist/` |
| `yarn lint` | TypeScript type-check |
| `yarn preview` | Preview production build |

---

## What's Running

To start the app:
```bash
cd v3/carbonlens_v3_poc
yarn dev
```

Open `http://localhost:5173/carbonlens/` — enter any email/password to log in.

---

## Next Steps (Priority Order)

1. **Run `yarn dev` and verify** — log in, create project, adjust sliders, run sim, check 3D rendering
2. **Validate IFT output** — compare sub/sup model predictions against your Python/MATLAB benchmarks
3. **Geomechanics physics** — replace simplified formulas with proper Eaton/FPG/MAIP calculations
4. **Web Worker physics** — implement Darcy-flow grid simulation on separate thread
5. **2D D3.js cross-section** — complement the 3D view
6. **Playback controls** — timestep slider through 50-year injection
7. **Saturation plume rendering** — Viridis colourmap on 3D plume
8. **Deploy to GitHub Pages** — push main branch → auto-deploys
9. **Onboarding tutorial** — 6-step guided walkthrough
10. **Tier gating** — Free/Researcher/Professional feature limits
