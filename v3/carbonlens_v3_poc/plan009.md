# CarbonLens v3 — Implementation Plan 009
## Real-Time CO2 Storage Simulation: Geological Model + Flow Visualization

**Date:** 2026-05-20
**Author:** Daniel T. Olagunju (Co-Founder & CPO, CarbonLens)
**Scope:** Web-based CO2 geological storage simulator — purpose-built for deep saline aquifer CCS, rivalling CMG-GEM / TOUGH2 / ECO2N specifically for this domain.

---

## 0. Mission Alignment

CarbonLens is NOT a general reservoir simulator. It does NOT target oil/gas production, EOR, or compositional hydrocarbon simulation.

CarbonLens IS a **web-native CO2 geological storage simulator** that rivals CMG-GEM, TOUGH2/ECO2N, and ECLIPSE CCS specifically for:
- Deep saline aquifer CO2 injection and storage
- Multiphase CO2-brine flow simulation
- All four trapping mechanisms (structural, residual, solubility, mineral)
- Geomechanical integrity and caprock safety
- Regulatory permit preparation across 5 jurisdictions

**Competitive advantage over certified simulators:**
- Zero installation — runs in any modern browser
- Real-time 3D visualization (CMG/TOUGH2 cannot match this natively)
- Interactive geological model building
- Same governing physics, same output metrics (±10% vs certified simulator for well-characterised aquifer)
- Accessible to consultancies, academics, and operators without expensive licences

**Simulation fidelity target:** Same answer ±10% vs a certified simulator for a well-characterised aquifer.

---

## 1. Existing Implementation (What Is Already Built)

### 1.1 Tech Stack
- **Framework:** React 18.3.1 + TypeScript 5.5.4 (strict mode)
- **Build tool:** Vite 5.4.3
- **3D rendering:** Three.js 0.170.0 + React Three Fiber 8.17.0
- **State:** Zustand 4.5.5 (4 stores: auth, formation, simulation, ui)
- **Persistence:** localStorage + Dexie 4.0.8 (IndexedDB)
- **Styling:** Tailwind CSS 3.4.10
- **Testing:** Vitest 2.0 + happy-dom
- **Package manager:** yarn (NOT npm — enforced across all dev work)
- **Deploy:** GitHub Pages via GitHub Actions

### 1.2 Implemented Physics Engine (`src/engine/`)
| Module | Description | Status |
|--------|-------------|--------|
| MARS IFT ML model | 16/35-term hinge equations, sub/supercritical regimes, 3000+ datapoint trained | Complete |
| Span-Wagner EOS | CO2 density across all phases | Complete |
| Fenghour viscosity | Temperature/pressure/density dependent | Complete |
| Duan-Sun solubility | Salinity-corrected (salting-out) | Complete |
| Garcia brine density | 5th-order polynomial | Complete |
| Diffusion coefficient | Literature ensemble | Complete |
| Kay's rule phase detection | Sub vs supercritical regime selector | Complete |
| Theis transient pressure | Single-well + multi-well superposition (up to 5 wells) | Complete |
| DOE capacity UQ | P10 (0.51%) / P50 (2.0%) / P90 (5.5%) pore volume | Complete |
| Trapping model | Residual 60% + solubility 40% per timestep, cumulative tracking | Complete |

### 1.3 Implemented Visualization
| Feature | Status |
|---------|--------|
| 6 parametric geometry types (anticline, dome, fault, layered, stratigraphic, channel) | Complete |
| Vertex coloring by porosity/permeability (FBM noise) | Complete |
| CO2 plume as scaled sphere at reservoir centre | Complete |
| Pressure field heatmap (24×24 grid, Theis-based) | Complete |
| Cross-section 2D orthographic view | Complete |
| Mohr-Coulomb canvas diagram | Complete |
| OrbitControls (pan/rotate/zoom) | Complete |
| Animation timeline (play/pause/speed 1x–10x, 50-year horizon) | Complete |

### 1.4 Implemented Panels (11 total)
Overview, Fluid Properties, Formation Inputs, Simulation, Geomechanics, Economics, Leakage Risk, Site Screening, Jurisdiction, Export, Registry

### 1.5 Formation Presets (8 world sites)
Sleipner Utsira, Mount Simon, Snøhvit Tubåen, Gorgon, In Salah, Kasawari, Duyong, Otway

---

## 2. What Is Being Added — Full Scope

This plan adds three major capabilities on top of the existing foundation:

1. **Phase 0 — Geological Model Builder:** Realistic stratigraphic layers, faults, lithology, and structural geometry that drive the simulation grid
2. **Phase 1 — Cellular Grid Renderer:** Replace single-mesh reservoir with a per-cell InstancedMesh grid where each cell shows live CO2 saturation
3. **Phase 2 — CO2 Saturation Flow Solver:** Physically motivated advection-diffusion model driving per-cell saturation over time
4. **Phase 3 — Particle System:** CO2 bubbles emitted at wellbore, rising to caprock, spreading laterally
5. **Phase 4 — Animation Loop Integration:** Wire grid solver into existing Zustand animation timeline
6. **Phase 5 — Visual Polish:** Caprock ceiling, pressure wave effects, convective mixing fingers, milestone labels

---

## 3. Phase 0 — Geological Model Builder

### 3.1 Purpose
The geological model is the foundation of all simulation. Every grid cell inherits its rock properties (porosity, permeability, lithology, capillary entry pressure) from the geological model. Fault transmissibility multipliers block or route CO2 migration. Stratigraphic layer geometry defines the structural trap.

### 3.2 Stratigraphic Framework

**Concept:** The user defines N horizons (depth surfaces). Each pair of adjacent horizons defines a stratigraphic zone — a geological unit with uniform or spatially varying properties.

**Example — Formation ABC (3 zones):**
```
Horizon 0: Top Caprock         ─── depth: 1200m
  [CAPROCK ZONE — Shale, sealing, k ≈ 0 mD]
Horizon 1: Top Reservoir L1    ─── depth: 1350m
  [ZONE 1 — Sandstone, φ=22%, k_h=300mD, k_v/k_h=0.1, spans A→B→C]
Horizon 2: Base Reservoir L1   ─── depth: 1420m
  [INTERBURDEN — Siltstone, tight baffle, k=2mD]
Horizon 3: Top Reservoir L2    ─── depth: 1500m
  [ZONE 2 — Carbonate, φ=15%, k_h=80mD, k_v/k_h=0.05, spans D→E→F]
Horizon 4: Base Reservoir L2   ─── depth: 1580m
  [BASEMENT — Impermeable]
```

**Per-zone properties:**

| Property | Input type | Notes |
|----------|-----------|-------|
| Lithology | Dropdown (8 types) | Auto-populates physically correct default ranges |
| Top depth (m) | Number input | Defines horizon position |
| Gross thickness (m) | Slider / number | Total zone thickness |
| Net-to-gross ratio | Slider 0–1 | Fraction of reservoir-quality rock |
| Porosity mean (%) | Slider | Spatially varied via geostatistical noise |
| Porosity std dev (%) | Slider | Controls heterogeneity |
| k_h mean (mD) | Slider (log scale) | Horizontal permeability |
| k_v/k_h ratio | Slider 0–1 | Critical for vertical CO2 migration |
| Capillary entry pressure (MPa) | Slider | Controls residual trapping threshold |
| Wettability | Toggle (water-wet / mixed-wet) | Affects relative permeability curves |
| Lateral extent: X-min, X-max | Range | Zone footprint in model space |
| Lateral extent: Y-min, Y-max | Range | Zone footprint in model space |
| Active for injection | Toggle | Whether CO2 can be injected into this zone |

### 3.3 Lithology Types and Default Properties

| Lithology | φ range (%) | k_h range (mD) | k_v/k_h | Pc entry (MPa) | Mineral trap potential |
|-----------|-------------|----------------|---------|----------------|----------------------|
| Sandstone | 15–35 | 10–3000 | 0.1–0.3 | 0.01–0.1 | Low (quartz stable) |
| Arkosic Sandstone | 12–25 | 5–500 | 0.05–0.2 | 0.05–0.2 | High (feldspar → calcite) |
| Limestone | 5–25 | 1–500 | 0.01–0.1 | 0.1–1.0 | High (calcite precipitation) |
| Dolomite | 5–20 | 0.1–100 | 0.01–0.05 | 0.2–2.0 | Moderate |
| Chalk | 20–45 | 0.1–10 | 0.01 | 0.5–3.0 | Low |
| Siltstone | 10–20 | 0.01–5 | 0.001–0.01 | 1.0–5.0 | Low (baffle/barrier) |
| Shale / Clay | 30–70 | <0.001 | ~0 | 5.0–20.0 | None (seal/caprock) |
| Anhydrite | 0–2 | ~0 | 0 | >20.0 | None (perfect seal) |

Each lithology auto-populates all property sliders with physically correct defaults when selected. The user may override any value.

### 3.4 Structural Horizon Shapes

Each horizon surface can be assigned one of the following structural forms:

| Shape | Definition | Structural trap type |
|-------|-----------|---------------------|
| Flat layer | Constant depth across model | Stratigraphic only |
| Tilted bed | Dip angle (°) + azimuth (°) | Updip migration risk |
| Anticline | Amplitude (m) + wavelength (m) + axis azimuth | Classic structural dome trap |
| Dome | Radius (m) + amplitude (m) | Circular structural high |
| Wedge-out / Pinch-out | Thinning direction + zero-thickness edge | Stratigraphic trap |
| Onlap | Layer terminates against a structural high | Stratigraphic trap |
| Thin rim | Narrow band at crest, defined by rim width (m) | Structural rim trap |
| Eroded unconformity | Irregular surface (FBM noise texture) | Sub-unconformity trap |
| Imported surface | Grid of (x,y,depth) values (JSON or LAS) | Any — user-defined |

Horizon surfaces are rendered as 3D meshes in the viewer, stacked vertically to show the layered stratigraphy. The user sees the model build live as they configure each zone.

### 3.5 Fault Modeling

**Definition:** A fault is a planar discontinuity that offsets rock units and may act as a seal (barrier) or conduit for fluid flow.

**Per-fault parameters:**

| Parameter | Description | Range |
|-----------|-------------|-------|
| Name | User-defined label | String |
| Position (x, y) in model | Map-view location of fault trace centre | Model coordinates |
| Strike (°) | Orientation of fault trace in map view | 0–360° |
| Dip (°) | Angle of fault plane from horizontal | 0–90° |
| Throw (m) | Vertical displacement across fault | 0–500m |
| Length (m) | Lateral extent of fault plane | 0–model width |
| Sealing factor | 0 = fully sealing, 1 = fully open (transmissive) | 0–1 |
| Clay smear factor | Fraction of shale in juxtaposed section; high = better seal | 0–1 |
| Fault zone thickness (m) | Width of damaged/brecciated zone | 0–10m |

**How faults affect simulation:**
- Cells whose faces intersect a fault plane receive a **transmissibility multiplier** = sealing factor (0 → no CO2 crosses; 1 → no resistance)
- Clay smear model: if shale is present in the fault juxtaposition, effective sealing factor = max(sealing_factor, clay_smear_factor)
- Fault planes rendered as semi-transparent planar meshes in 3D viewer, colour-coded by sealing factor (red = sealing, green = open)
- Reactivation risk fed to geomechanics module: low-dip faults with high sealing factor are highest reactivation risk

**Fault interaction with CO2 plume:**
- Sealing fault (factor < 0.1): CO2 accumulates against fault face → overpressure risk → triggers MAIP warning
- Open fault (factor > 0.7): CO2 migrates through fault → leakage pathway → triggers leakage risk alert
- Partial fault (0.1–0.7): Retarded cross-fault flow; CO2 partially bypasses

### 3.6 Geological Model Builder UI

**New panel: "Geology" added to sidebar (between Formation and Simulation)**

Three tabs within the panel:

**Tab 1 — Stratigraphy**
- Layer list (drag to reorder)
- Add Layer button → opens lithology picker + property inputs
- Each layer row shows: colour swatch (by lithology), name, depth range, thickness, φ, k
- Delete layer (with confirmation)
- Horizon shape selector per layer top surface

**Tab 2 — Faults**
- Fault list
- Add Fault button → opens fault parameter form
- Interactive map view (top-down 2D) showing fault traces on the model footprint
- Click fault trace to select and edit
- Delete fault button

**Tab 3 — Property Preview**
- Vertical property log showing φ, k_h, k_v by depth (based on defined layers)
- Same view style as existing cross-section, but driven by geological model
- Confirms what the simulation grid will see

**3D viewer updates live** as geology is configured: layered meshes stack, fault planes appear, well cylinders penetrate all zones.

### 3.7 Data Model (TypeScript Interfaces)

```typescript
// New types added to src/types/index.ts

type LithologyType =
  | 'sandstone'
  | 'arkosic_sandstone'
  | 'limestone'
  | 'dolomite'
  | 'chalk'
  | 'siltstone'
  | 'shale'
  | 'anhydrite';

type HorizonShape =
  | 'flat'
  | 'tilted'
  | 'anticline'
  | 'dome'
  | 'wedge'
  | 'onlap'
  | 'thin_rim'
  | 'unconformity'
  | 'imported';

interface StratigraphicZone {
  id: string;
  name: string;
  lithology: LithologyType;
  topDepth: number;           // metres
  thickness: number;          // metres gross
  netToGross: number;         // 0–1
  porosityMean: number;       // fraction 0–1
  porosityStdDev: number;     // fraction 0–1
  kHorizontal: number;        // mD
  kVerticalRatio: number;     // k_v/k_h, 0–1
  capillaryEntryPressure: number; // MPa
  wettability: 'water_wet' | 'mixed_wet';
  horizonShape: HorizonShape;
  horizonParams: HorizonShapeParams; // shape-specific parameters
  xMin: number; xMax: number;       // lateral extent (normalised model coords)
  yMin: number; yMax: number;
  activeForInjection: boolean;
  isCaprock: boolean;
  color: string;              // auto-assigned by lithology
}

interface HorizonShapeParams {
  dipAngle?: number;          // degrees
  dipAzimuth?: number;        // degrees
  foldAmplitude?: number;     // metres
  foldWavelength?: number;    // metres
  foldAxisAzimuth?: number;   // degrees
  domeRadius?: number;        // metres
  domeAmplitude?: number;     // metres
  wedgeThinningDirection?: number; // azimuth degrees
  rimWidth?: number;          // metres
  importedGrid?: number[][];  // depth offsets
}

interface FaultDefinition {
  id: string;
  name: string;
  positionX: number;          // normalised model coords
  positionY: number;
  strike: number;             // degrees 0–360
  dip: number;                // degrees 0–90
  throw: number;              // metres
  length: number;             // metres
  sealingFactor: number;      // 0 (seal) – 1 (open)
  claySmearFactor: number;    // 0–1
  faultZoneThickness: number; // metres
}

interface GeologicalModel {
  zones: StratigraphicZone[];   // ordered top to bottom
  faults: FaultDefinition[];
  modelWidthM: number;          // real-world model width (metres)
  modelLengthM: number;         // real-world model length (metres)
}
```

### 3.8 Files Created / Modified in Phase 0

| Action | File path | Description |
|--------|-----------|-------------|
| CREATE | `src/types/geological.ts` | All geological model TypeScript interfaces |
| CREATE | `src/store/geologicalStore.ts` | Zustand store for geological model state |
| CREATE | `src/data/lithologyDefaults.ts` | Default property ranges per lithology type |
| CREATE | `src/components/GeologyPanel/GeologyPanel.tsx` | Main panel component (3 tabs) |
| CREATE | `src/components/GeologyPanel/StratigraphyTab.tsx` | Layer list + add/edit/reorder UI |
| CREATE | `src/components/GeologyPanel/FaultsTab.tsx` | Fault list + map view + parameter form |
| CREATE | `src/components/GeologyPanel/PropertyPreviewTab.tsx` | Vertical property log preview |
| CREATE | `src/components/GeologyPanel/LithologyPicker.tsx` | Visual lithology selector (icons + colours) |
| CREATE | `src/utils/geologicalModelToGrid.ts` | Converts GeologicalModel → 3D simulation grid cells with per-cell properties |
| CREATE | `src/components/ThreeViewer/GeologyLayers.tsx` | 3D layered horizon mesh renderer |
| CREATE | `src/components/ThreeViewer/FaultPlanes.tsx` | 3D fault plane mesh renderer |
| MODIFY | `src/types/index.ts` | Import and re-export new geological types |
| MODIFY | `src/store/formationStore.ts` | Add geologicalModel field; integrate with existing params |
| MODIFY | `src/components/Layout/Sidebar.tsx` | Add Geology panel button |
| MODIFY | `src/components/ThreeViewer/ReservoirViewer.tsx` | Render GeologyLayers + FaultPlanes |

---

## 4. Phase 1 — Cellular Grid Renderer

### 4.1 Purpose
Replace the current single parametric mesh with a **3D grid of individually addressable cells** where each cell can independently change colour to reflect live CO2 saturation.

### 4.2 Grid Specification

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Grid size | 20 × 20 × 10 (nx × ny × nz) | 4,000 cells — smooth detail at 60fps |
| Cell shape | Box (hexahedral) | Simple, GPU-efficient |
| Renderer | THREE.InstancedMesh | Single draw call for all 4,000 cells |
| Color buffer | Float32Array (per-instance) | GPU-uploaded each frame |
| Model extent | Matches formation width × length × gross thickness | Real-world scaled |

### 4.3 Per-Cell Data

Each cell stores:
```typescript
interface GridCell {
  instanceId: number;         // InstancedMesh index
  i: number; j: number; k: number;  // grid indices
  zoneId: string;             // which stratigraphic zone
  lithology: LithologyType;
  porosity: number;           // spatially varying (geostatistical)
  kHorizontal: number;        // mD (spatially varying)
  kVertical: number;          // mD
  capillaryEntryPressure: number; // MPa
  faultTransmX: number;       // transmissibility multiplier on X face (0–1)
  faultTransmY: number;       // transmissibility multiplier on Y face (0–1)
  co2Saturation: number;      // 0–1 (live, updated each solver step)
  co2Phase: 'none' | 'free' | 'residual' | 'dissolved' | 'mineral';
  pressure: number;           // MPa (live, updated each solver step)
}
```

### 4.4 Color Mapping Scheme

| State | Color | Hex | Description |
|-------|-------|-----|-------------|
| Pure brine | Deep navy blue | #0d2137 | Virgin formation, no CO2 |
| CO2 arriving (low sat) | Steel blue | #2e6fa3 | 0–20% CO2 saturation |
| Partially filled | Amber | #f59e0b | 20–60% CO2 saturation |
| Heavily filled | Orange-red | #ef4444 | 60–90% CO2 saturation |
| Fully CO2 | Bright red | #dc2626 | >90% CO2 saturation |
| Residually trapped | Forest green | #10b981 | Immobilised, capillary-trapped |
| Dissolved CO2 | Teal | #14b8a6 | CO2 in aqueous phase |
| Mineralised | Dark gold | #b45309 | Permanent mineral trapping |
| Caprock / seal | Translucent grey | #64748b, 40% opacity | Impermeable barrier |
| Fault plane (sealing) | Semi-transparent red | #ef4444, 30% opacity | Sealing fault |
| Fault plane (open) | Semi-transparent green | #10b981, 30% opacity | Transmissive fault |

Color interpolation: smooth linear LERP between states based on co2Saturation float value.

### 4.5 Files Created in Phase 1

| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/engine/grid/SimulationGrid.ts` | Grid data structure + cell array initialisation |
| CREATE | `src/engine/grid/gridFromGeology.ts` | Maps GeologicalModel zones + faults → GridCell[] with correct per-cell properties and transmissibility multipliers |
| CREATE | `src/components/ThreeViewer/GridReservoir.tsx` | InstancedMesh renderer; color buffer update loop |
| CREATE | `src/utils/colorMapping.ts` | CO2 saturation → RGB color functions (smooth gradients) |
| MODIFY | `src/components/ThreeViewer/ReservoirViewer.tsx` | Conditionally render GridReservoir when geological model is defined |

---

## 5. Phase 2 — CO2 Saturation Flow Solver

### 5.1 Purpose
A physically motivated, real-time capable advection-diffusion solver that evolves CO2 saturation in each grid cell over simulation time. Not a full finite-element simulator — intentionally simplified for browser 60fps — but governed by the same physics equations as CMG-GEM/TOUGH2.

### 5.2 Governing Physics (Simplified for Real-Time)

**Darcy multiphase flow (per cell face):**
```
Q_CO2 = (k_abs × k_r_CO2 / μ_CO2) × A × (ΔP/Δx + ρ_CO2 × g × Δz/Δx)
```
Where:
- `k_abs` = absolute permeability of the cell (from geological model)
- `k_r_CO2` = relative permeability of CO2 phase (Brooks-Corey function of Sg)
- `μ_CO2` = CO2 viscosity (from existing Fenghour engine)
- `ΔP` = pressure difference across face (from existing Theis pressure field)
- `ρ_CO2 × g × Δz` = buoyancy term — drives CO2 upward
- `A` = face area

**Relative permeability (Brooks-Corey):**
```
k_r_CO2(Sg) = k_r_max × ((Sg - Sgr) / (1 - Swi - Sgr))^n
where n = 2 (Corey exponent)
      Sgr = residual gas saturation (from lithology)
      Swi = irreducible water saturation (from lithology)
```

**Residual trapping (Land model):**
```
When imbibition begins (Sg decreasing):
  S_gr_land = S_g_max / (1 + C × S_g_max)
  C = Land coefficient (lithology dependent, typically 1–5)
  CO2 below S_gr_land is permanently immobilised
```

**Solubility trapping (Henry's Law — existing engine):**
```
At each timestep, dissolved fraction:
  ΔS_dissolved = k_diss × (C_sat - C_current) × Δt
  k_diss = mass transfer coefficient (function of diffusion, IFT)
  C_sat = Henry's Law saturation (from existing Duan-Sun engine)
  Brine + dissolved CO2 → denser → sinks (density-driven convection)
```

**Mineral trapping (kinetic, long-timescale):**
```
Active only for t > 100 years
  dS_mineral/dt = k_mineral × S_dissolved × (1 - Ω)
  Ω = mineral saturation index (simplified: increases with time/temperature)
  k_mineral from lithology (arkosic sandstone and limestone highest)
```

**Pressure field:**
- Uses existing Theis multi-well superposition (already computed annually)
- Pressure gradient drives lateral viscous flow
- Buoyancy term computed from Δρ = ρ_brine - ρ_CO2 (both from existing engine)

### 5.3 Solver Algorithm (Per Animation Frame)

```
plumeGrid.step(dt, year):
  1. Compute pressure gradient ∇P across each cell face (from Theis field)
  2. For each cell (i,j,k):
     a. Compute buoyancy flux upward: F_buoy = f(Δρ, k_v, k_r_CO2, μ_CO2)
     b. Compute lateral viscous flux: F_visc = f(∇P, k_h, k_r_CO2, μ_CO2)
     c. Apply fault transmissibility: F_face *= faultTransm
     d. Apply caprock barrier: if k == nz-1 and isCaprock: F_buoy = 0
     e. Update saturation: Sg[i,j,k] += (F_in - F_out) / (φ × V_cell)
     f. Check Land criterion → snap to residual if imbibition
     g. Compute dissolved fraction → update co2Phase
     h. If year > 100: apply mineral trapping rate
  3. Upload updated color buffer to InstancedMesh GPU
```

**Performance target:** Full grid update (4,000 cells) in <5ms per frame, leaving 11ms for render at 60fps.

### 5.4 Heterogeneity

Per-cell porosity and permeability are NOT uniform — they are spatially distributed using geostatistical simulation:

```
porosity[i,j,k] = zone.porosityMean + zone.porosityStdDev × ξ_SGS(i,j,k)
```
Where `ξ_SGS` is a Sequential Gaussian Simulation field (approximated using variogram-based correlated noise):
- Variogram range: configurable per zone (controls spatial correlation length)
- Anisotropy ratio: 3:1 horizontal:vertical typical for sandstone
- Same FBM infrastructure already in `src/utils/noise.ts` extended for correlated fields

### 5.5 Files Created in Phase 2

| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/engine/plume/saturationSolver.ts` | Core per-cell CO2 saturation update (Darcy + buoyancy + trapping) |
| CREATE | `src/engine/plume/relativePermeability.ts` | Brooks-Corey kr functions for CO2 and brine phases |
| CREATE | `src/engine/plume/landTrapping.ts` | Land model residual trapping criterion |
| CREATE | `src/engine/plume/mineralTrapping.ts` | Long-timescale kinetic mineral trapping |
| CREATE | `src/engine/plume/plumeGrid.ts` | Grid state container + step() driver; integrates all sub-solvers |
| CREATE | `src/engine/plume/geostatNoise.ts` | Spatially correlated noise for heterogeneous property fields |
| MODIFY | `src/store/simulationStore.ts` | Integrate plumeGrid.step() into animation tick; store grid reference |
| MODIFY | `src/hooks/useSimulation.ts` | Initialise plumeGrid from geological model on sim start |

---

## 6. Phase 3 — Particle System (CO2 Bubbles)

### 6.1 Purpose
Provide intuitive visual feedback of the injection process. Particles emitted at the wellbore represent CO2 molecules entering the formation, rising due to buoyancy, spreading at the caprock, and eventually being trapped.

### 6.2 Particle Lifecycle

```
1. EMIT:     Spawn at wellbore (x_well, y_well, z_injection_zone)
             Rate: proportional to injection rate (Mt/year)
             Initial velocity: slight upward + random radial spread

2. RISE:     Upward velocity: v_up ∝ Δρ / μ_CO2 (buoyancy/viscosity ratio)
             Lateral drift: ±small random walk (captures viscous fingering)
             Size: 0.1–0.3 units, pulsing (sin wave on scale)
             Colour: white → semi-transparent as they age

3. HIT CAPROCK:
             Detect particle z > caprock depth
             Emit lateral splash burst (radial outward particles at caprock base)
             Original particle merges into caprock-adjacent cells (Sg += contribution)

4. SPREAD:   Lateral particles travel along caprock base
             Velocity: horizontal only, proportional to k_h / μ_CO2 × ΔP

5. TRAP:     At random intervals (based on trapping probability):
             Particle shrinks to zero → leaves behind green "trapped" glow at that cell
             Dissolved particles turn teal and slowly drift downward (convective sinking)

6. RECYCLE:  Dead particles returned to pool
             Pool size: 1,000 active particles (fixed, recycled)
```

### 6.3 Implementation

```typescript
// THREE.Points with BufferGeometry
// Position buffer: Float32Array [x,y,z × N]
// Color buffer:    Float32Array [r,g,b × N]
// Size buffer:     Float32Array [size × N]
// All updated on CPU each frame, uploaded to GPU

const particleSystem = new THREE.Points(geometry, new THREE.PointsMaterial({
  vertexColors: true,
  sizeAttenuation: true,
  transparent: true,
  alphaTest: 0.01
}));
```

### 6.4 Additional Particle Effects

| Effect | Implementation |
|--------|---------------|
| Convective mixing fingers | Downward-drifting dark-teal particles below dissolved CO2 zone |
| Pressure wave | Expanding ring at injection start — `THREE.RingGeometry` animated scale |
| Fault leakage alert | If CO2 reaches open fault face: red sparks emit along fault trace |
| Wellbore glow | `THREE.PointLight` at well position, intensity ∝ injection rate |

### 6.5 Files Created in Phase 3

| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/components/ThreeViewer/CO2Particles.tsx` | Particle system R3F component |
| CREATE | `src/engine/plume/particleEngine.ts` | Particle lifecycle logic (emit, move, trap, recycle) |
| MODIFY | `src/components/ThreeViewer/ReservoirViewer.tsx` | Mount CO2Particles component |

---

## 7. Phase 4 — Animation Loop Integration

### 7.1 Purpose
Wire the new grid solver and particle system into the existing Zustand animation timeline so playback controls (play/pause/speed/reset) drive the simulation consistently.

### 7.2 Animation Architecture

```
AnimationTick (useFrame hook in R3F):
  if (isAnimating):
    elapsed += deltaTime × animationSpeed
    if (elapsed >= YEAR_DURATION / animationSpeed):
      currentYear++
      plumeGrid.step(1, currentYear)        ← advance solver 1 year
      particleEngine.step(deltaTime)         ← advance particles
      setTimestep(currentYear)               ← Zustand state update
      if (currentYear >= projectYears): stopAnimation()

InstancedMesh color buffer upload:
  After plumeGrid.step():
    For each cell: colorArray[i*3..i*3+2] = saturationToRGB(cell.co2Saturation, cell.co2Phase)
    instancedMesh.instanceColor.needsUpdate = true   ← GPU upload
```

**Year duration at 1× speed:** 2,400ms (2.4 seconds per simulated year)
**50-year run at 1× speed:** 120 seconds playback
**50-year run at 10× speed:** 12 seconds playback

### 7.3 Timestep Display

- HUD overlay on 3D canvas: "Year: 23 / 50" + trapping breakdown bar
- Trapping bar: stacked horizontal bar showing % free / residual / dissolved / mineral
- Colour-coded per phase (red / green / teal / gold)

### 7.4 Files Modified in Phase 4

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/store/simulationStore.ts` | Add plumeGrid ref; fire step() in animation tick |
| MODIFY | `src/components/ThreeViewer/ReservoirViewer.tsx` | useFrame integration for color buffer upload |
| CREATE | `src/components/ThreeViewer/SimulationHUD.tsx` | Year counter + trapping breakdown bar overlay |

---

## 8. Phase 5 — Visual Polish

### 8.1 Scene Elements

| Element | Implementation | Notes |
|---------|---------------|-------|
| Caprock ceiling | Semi-transparent `PlaneGeometry` at caprock depth | Teal, 40% opacity, wireframe edge |
| Geological layer boundaries | Thin wireframe planes between zones | Colour by lithology |
| Injection well glow | `THREE.PointLight` intensity ∝ injection rate | Pulses on injection |
| Pressure wave | Expanding `THREE.RingGeometry` at injection start | Fades after 3s |
| Density convection fingers | Downward dark-teal particles below dissolved zone | Captures convective mixing |
| Fault leakage alert | Red spark particles on open fault if CO2 arrives | Triggers leakage risk panel alert |
| Milestone labels | Floating text at Year 1, 10, 50, 100, 500, 1000 | Shows trapping mechanism dominant at each stage |
| Formation name label | Floating above model | From project name |
| Depth scale | Vertical ruler on left edge of viewer | Real-world metres |
| Legend panel | Overlay top-right: colour → CO2 phase mapping | Always visible during animation |

### 8.2 Files Created in Phase 5

| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/components/ThreeViewer/SceneAnnotations.tsx` | Labels, ruler, legend overlay |
| CREATE | `src/components/ThreeViewer/CaprockMesh.tsx` | Semi-transparent caprock ceiling mesh |
| MODIFY | `src/components/ThreeViewer/ReservoirViewer.tsx` | Mount all Phase 5 components |

---

## 9. Simulation Output Metrics (What the Solver Reports)

These outputs match what operators look for in CMG-GEM / TOUGH2 results:

| Metric | Unit | Source |
|--------|------|--------|
| Injected CO2 (cumulative) | Mt | Input × time |
| Free-phase CO2 (mobile) | Mt + % | plumeGrid |
| Residually trapped CO2 | Mt + % | plumeGrid (Land model) |
| Dissolved CO2 | Mt + % | plumeGrid (Henry's Law) |
| Mineralised CO2 | Mt + % | plumeGrid (kinetic model) |
| Plume lateral extent | km² | Grid cells with Sg > 0.01 |
| Maximum BHP | MPa | Theis + wellbore model |
| BHP vs MAIP margin | MPa + % | Geomechanics module |
| Pressure front radius | km | Theis radial flow |
| Storage efficiency | % of pore volume | Injected / TPV |
| P10 / P50 / P90 capacity | Mt | DOE framework (existing) |
| Trapping security index | 0–100 | Weighted: residual×0.4 + dissolved×0.35 + mineral×0.25 |
| Caprock safety factor | Dimensionless | Geomechanics (existing) |
| Induced seismicity risk | Low/Moderate/High | Geomechanics (existing) |

---

## 10. Integration with Existing Modules

| Existing module | Integration point |
|----------------|------------------|
| MARS IFT engine | IFT used in capillary entry pressure calc; feeds residual trapping threshold |
| Fenghour viscosity | μ_CO2 in Darcy flow equation per cell |
| Span-Wagner density | ρ_CO2 in buoyancy term; supercritical check |
| Duan-Sun solubility | CO2 dissolution rate per cell; salting-out effect |
| Garcia brine density | ρ_brine for buoyancy Δρ computation |
| Theis pressure field | ∇P driving Darcy lateral flow |
| Geomechanics module | BHP from plumeGrid fed to MAIP check; fault reactivation from fault definitions |
| Trapping model (existing) | New per-cell Land model replaces bulk % model; totals must remain consistent |
| Formation presets (8 sites) | Each preset will include a default geological model (zones + faults) |
| Export / Permit panel | Simulation outputs from plumeGrid replace existing bulk estimates in permit reports |

---

## 11. Implementation Sequence

```
Phase 0:  Geological Model Builder
  - Types + store + lithology defaults
  - GeologyPanel UI (3 tabs)
  - geologicalModelToGrid utility
  - 3D layer + fault plane rendering

Phase 1:  Cellular Grid Renderer
  - SimulationGrid data structure
  - InstancedMesh GridReservoir component
  - Color mapping (saturation → RGB)

Phase 2:  CO2 Saturation Flow Solver
  - Brooks-Corey relative permeability
  - Land residual trapping
  - Darcy advection (buoyancy + viscous)
  - Solubility + mineral trapping
  - plumeGrid.step() driver

Phase 3:  Particle System
  - CO2 bubble particle lifecycle
  - Convective mixing + leakage effects

Phase 4:  Animation Loop Integration
  - Wire solver into useFrame
  - Color buffer GPU upload
  - SimulationHUD overlay

Phase 5:  Visual Polish
  - Caprock mesh, labels, ruler, legend
  - Fault leakage alerts
  - Milestone annotations
```

---

## 12. Testing Requirements

| Test | File | Validates |
|------|------|-----------|
| Geological model → grid cell count | `geologicalModelToGrid.test.ts` | Correct nx×ny×nz from zone definitions |
| Fault transmissibility assignment | `gridFromGeology.test.ts` | Sealing fault → 0.0 transmX on correct faces |
| Brooks-Corey kr at Sgr=0 | `relativePermeability.test.ts` | kr_CO2 = 0 at residual saturation |
| Land model snapping | `landTrapping.test.ts` | Saturation below S_gr_land locked |
| Saturation conservation | `saturationSolver.test.ts` | Mass conservation: total CO2 in = sum of cell saturations × φ × V |
| Caprock barrier | `saturationSolver.test.ts` | Zero flux through caprock cells |
| Color mapping boundaries | `colorMapping.test.ts` | Sat=0 → navy, sat=1 → red, residual → green |
| Lithology defaults validation | `lithologyDefaults.test.ts` | All 8 types have valid φ, k, Pc ranges |

---

## 13. Constraints and Decisions

| Decision | Rationale |
|----------|-----------|
| Grid 20×20×10 (4,000 cells) | Balance between visual detail and 60fps browser performance |
| InstancedMesh (not ShaderMaterial volume) | Simpler implementation, easier cell-level control, sufficient visual quality |
| Brooks-Corey kr (not van Genuchten) | Standard for CO2 storage; simpler implementation; used in TOUGH2/ECO2N |
| Land model (not Killough) | Industry standard for CO2 residual trapping; matches CMG-GEM default |
| Simplified kinetic mineral trapping | Full geochemical kinetics (TOUGHREACT-level) not feasible in browser at 60fps; simplified k_mineral rate adequate for storage capacity assessment |
| Theis pressure field (not full FD pressure solve) | Theis already implemented, accurate for radial flow; full FD pressure solve adds 10× compute cost for marginal gain at screening stage |
| No capillary pressure hysteresis in pressure equation | Simplification; capillary effects captured in relative permeability hysteresis (Land model) instead |
| yarn only (no npm) | Project convention — enforced |

---

## 14. Out of Scope (This Plan)

- Full compositional EOS flash calculations at every grid cell (too expensive for browser real-time)
- Chemical speciation and full geochemical kinetics (TOUGHREACT / PHREEQC level)
- Wellbore flow model (coupled tubing/wellbore hydraulics)
- History matching / data assimilation
- 3D seismic import and interpretation
- Time-lapse seismic modelling
- Coupled geomechanical deformation (full stress tensor per cell)
- Multi-phase stream injection (CO2 + impurities compositional)
- CO2 Enhanced Water Recovery coupling

These are future roadmap items beyond the v3 PoC scope.

---

*Plan009 — agreed 2026-05-20. Begin implementation with Phase 0.*
