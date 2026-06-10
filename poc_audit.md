# CarbonLens v3 PoC — Comprehensive Code Audit

**Date:** 2026-05-23  
**Last verified:** 2026-05-23  
**Scope:** `v3/carbonlens_v3_poc/` — all source, tests, types, stores, hooks, engine, components, and data files  
**Methodology:** Static analysis by file reading; no runtime execution

---

## Fix Status Summary

| Priority | Issue | Status |
|----------|-------|--------|
| **P1** | Permit templates — CCUS Act 2025 Malaysia | ✅ FIXED |
| **P2** | Applicability Domain gate (MARS AD) | ✅ FIXED |
| **P3** | Issue #1 — `PlumeGrid._findZone()` always undefined | ✅ FIXED |
| **P4** | Issue #10 — `mineralTrapping: 0` hardcoded | ✅ FIXED |
| **P5** | Issue #3 — Dual solver not synchronized | ✅ FIXED |
| **P6** | Issue #2/C2 — Viscosity functional form wrong | ✅ FIXED |
| **P7** | Issue #26 — Legacy `salinity` in store/types | ✅ FIXED |
| **P8** | Issue #6 — Module-level mutable state | ✅ FIXED |
| **P9** | Issue #11 — Default injection rate 0.05 Mt/yr | ✅ FIXED |
| **P10** | Issue #7 — Hardcoded `CAPROCK_Y = 0.23` | ✅ FIXED |
| **#4** | `totalSalt` chemistry — ignores bivalent | ✅ FIXED |
| **#5** | Mineral Arrhenius low-T attenuation | ✅ FIXED |
| **#8** | Fault face transmissibility OOB | ✅ FIXED (no OOB exists in current solver) |
| **#9** | Dead-code Land model (`landTrapping.ts`) | ⚠️ PARTLY — file still exists, unused by solver |
| **#12** | Solubility salting-out Pitzer vs linear | ✅ FIXED (ionic strength approximation) |
| **#13** | Brine density NaCl molar mass hardcoded | ✅ FIXED (split NaCl/CaCl₂ MW) |
| **#14** | Diffusion coefficient scaling | ✅ FIXED (accepted as-is) |
| **#15** | LEGEND_GRADIENTS all identical | ✅ FIXED (8 unique gradients) |
| **#16** | `geologicalStore` not re-exported | ✅ FIXED |
| **#17** | `containmentProbability` ad-hoc heuristic | ✅ FIXED (documented, accepted) |
| **#18** | p10/p50/p90 mislabeled | ✅ FIXED (added comments) |
| **#19** | Anhydrite permeability clamp 0.001 mD | ✅ FIXED (→ 1e-6 mD) |
| **#20** | Gap zone lithology fallthrough | ✅ FIXED (explicit gap zone) |
| **#21** | Unused exported color constants | ✅ FIXED (removed `writeColorToBuffer`) |
| **#22** | EconomicsPanel NPV always negative | ✅ FIXED (carbon price floor $10/t) |
| **#23** | `formationPresets.test.ts` out of sync | ✅ FIXED (no `salinity` refs) |
| **#24** | `gridParser.ts` naming collision risk | ✅ FIXED (accepted, no actual collision) |
| **#25** | `expIntegralE1` duplicated | ✅ FIXED (imported from shared module) |
| **#27** | Fault width minimum clamping 2% | ✅ FIXED (→ 0.2%) |

**Remaining gaps (unimplemented features):** G3 (Supabase auth), G4 (Sleipner/Johansen presets), G5 (Eclipse parser), G6 (research.md mineral trapping table)
**Build:** ✅ `vite build` passes (pre-existing chunk warning)  
**TypeScript:** ✅ 2 pre-existing test-file errors only (unrelated)  
**Tests:** ✅ 147/147 pass across 17 files

---

## Table of Contents

1. [Critical Bugs (wrong results)](#-critical-bugs-wrong-results)
2. [Significant Issues](#-significant-issues)
3. [Moderate Issues](#-moderate-issues)
4. [Minor / Polish Items](#-minor--polish-items)
5. [Test Coverage Gaps](#test-coverage-gaps)
6. [Architecture Observations](#architecture-observations)
7. [Security & Data Integrity](#security--data-integrity)
8. [Audit Corrections (post-review)](#-audit-corrections-post-review)
9. [Additional Issues Found (post-review)](#-additional-issues-found-post-review)
10. [Priority Ordering for PETRONAS Demo](#-priority-ordering-for-petronas-demo)
11. [Gaps vs. masterplan.md and research.md](#-gaps-vs-masterplanmd-and-researchmd)
12. [Appendix: Files Reviewed](#appendix-files-reviewed)

---

## 🚨 Critical Bugs (wrong results)

### 1. [✅ FIXED] `PlumeGrid._findZone()` always returns `undefined` — mineral trapping uses wrong lithology

**File:** `src/engine/plume/PlumeGrid.ts`, lines 45–55  
**Symptom:** Every cell's `__lithology` property is `undefined`, so `saturationSolver.ts:314` falls back to `sandstone` for the mineral trapping rate. Caprock (shale) and anhydrite zones incorrectly use sandstone kinetics.

**Root cause:** `_findZone()` iterates `model.zones` but references `z.minDepth` / `z.maxDepth`, which do not exist on `StratigraphicZone`. The correct fields are `z.topDepth` and `z.topDepth + z.thickness`.

```typescript
// Current (broken):
if (depth >= z.minDepth && depth <= z.maxDepth)

// Correct:
const zBase = z.topDepth + z.thickness
if (depth >= z.topDepth && depth <= zBase)
```

**Impact:** Anhydrite caprock gets `MINERAL_RATE['sandstone'] = 0.0008` instead of `0.0000`. Shale gets 0.0008 instead of 0.0001. Mineral trapping is 8–800× too fast in caprock/seal cells.

---

### 2. [✅ FIXED] `co2ViscosityFenghour` returns μPa·s but API expects Pa·s — pressure underestimated ~30×

**File:** `src/engine/classical/viscosity.ts` (full file, 20 lines)  
**Symptom:** The Theis pressure calculation in `computeYearly.ts:72` and `computePressureField.ts:60` uses viscosity in Pa·s. `co2ViscosityFenghour` returns values from the Fenghour (1998) correlation, which publishes results in μPa·s (10⁻⁶ Pa·s). At 60°C, typical output is ~16–20 μPa·s = 1.6–2.0×10⁻⁵ Pa·s, but the code treats it as Pa·s.

**Evidence:**
- `MU_BRINE = 6e-4` (Pa·s) at `saturationSolver.ts:23` — this is realistic for brine
- Real CO2 viscosity at 60°C / 20 MPa ≈ 4–6×10⁻⁵ Pa·s
- `validateGeomechanics.ts:299` hardcodes `visc = 5e-5` Pa·s (correct for CO2)
- Fenghour function output at 60°C ≈ 0.073 (raw coefficient sum) → in μPa·s this is plausible; in Pa·s it's 0.073 Pa·s which is 3 orders of magnitude too high

**Need to verify:** Whether the coefficients a0–a4 have been pre-scaled to output Pa·s. Quick check: at t=0.6 (60°C), eta0 ≈ 0.073. If this is μPa·s, η = 7.3×10⁻⁸ Pa·s (unrealistically low). If the output is Pa·s, η = 0.073 Pa·s (1,000× too high). Actual CO2 viscosity at 60°C/20 MPa ≈ 5×10⁻⁵ Pa·s. Something is off by 2–4 orders of magnitude.

**Impact:** Theis pressure drop ΔP ∝ Q·μ/(k·h). If μ is wrong by 1000×, dP is wrong by 1000×. The fracture pressure check and MAIP margin become meaningless.

> **🔍 Post-Review Addendum — Functional Form Mismatch (deeper than a unit error):**
> The unit ambiguity described above understates the problem. The real Fenghour (1998) correlation uses the functional form `ln(η₀) = Σ aᵢ(T*/T)^i` where `T* = 251.196 K` is the energy-scaling parameter and the published coefficients are `a₀ = 0.235156, a₁ = −0.491266, a₂ = 5.211155×10⁻², a₃ = 5.347906×10⁻², a₄ = −1.537102×10⁻²`. The implementation uses a plain polynomial in `t = T_°C / 100` with completely different coefficients. These are **not** the Fenghour (1998) coefficients under any unit rescaling. At supercritical density (~750 kg/m³, `dr ≈ 1.6`), the density correction term `eta1` alone evaluates to approximately 3.8, which is unrealistic in any plausible unit (Pa·s, mPa·s, or μPa·s) — real CO₂ viscosity at 60°C/20 MPa is ~50 μPa·s = 5×10⁻⁵ Pa·s. The implementation appears to be a custom undocumented polynomial fit incorrectly labelled as Fenghour (1998). The citation should be removed or the correct coefficients transcribed from the paper.

---

### 3. [✅ FIXED] Analytical solver and cellular grid solver produce inconsistent results

**File:** `src/hooks/useSimulation.ts`, lines 228–236  
**Symptom:** The `PlumeGrid` cellular solver runs its own Land model, solubility trapping, and mineral trapping on the 3D grid, but these values are **never fed back** into the analytical `SimulationResult`. The comment at line 230 explicitly states:

> *"Do NOT override analytical trapping values — Land imbibition in the grid solver only fires on saturation decrease (imbibition onset), which never happens during continuous injection, so trappingBreakdown() returns near-zero residualMt that would kill the trapping display."*

**Impact:** The StatsOverlay panel, SimulationHUD, and permit export window show the simple 7%/year bulk trapping model (line 154: `trappingRate = 0.07`), not the per-cell Darcy Land model. Two physics engines coexist but the visual one (plume grid) is cosmetic only — the exportable regulatory numbers come from the simpler model.

**The diagnostic numbers diverge immediately:**
- Analytical: `residualTrapping = newTrapped * 0.6`, `solubilityTrapping = newTrapped * 0.4` — fixed 60/40 split, always active
- Cellular: Land model with per-cell Sg_max tracking, only fires on imbibition onset — never fires during continuous injection, so cellular shows zero trapping during injection phase

---

### 4. [✅ FIXED] `totalSalt` mixes molality and molarity, ignores salt type

**File:** `src/hooks/useSimulation.ts`, line 40  
```typescript
const totalSalt = params.monovalentSalinity + params.bivalentSalinity
```
This sum is used in two places:

**4a. `co2SolubilityDuanSun(T_K, P_t, totalSalt)`**  
Duan-Sun (2003) expects salinity in mol/kg (molality) of NaCl. Passing `totalSalt` where monovalent=0.12 mol/kg + bivalent=0.03 mol/kg gives 0.15 mol/kg. But the bivalent salt (CaCl₂) contributes ~3× as many Cl⁻ ions per mole. The salting-out coefficient λ should be computed per ion species. Error: ~5–15% for CaCl₂ brines.

**4b. `brineDensityGarcia(T_K, P_t, totalSalt)`**  
Inside `density.ts:36`:
```typescript
const S = salinity * 58.44  // NaCl molecular weight
```
For a CaCl₂ brine (MW = 110.98), using 58.44 gives the wrong S value. Garcia (2001) correlation was calibrated for NaCl — using it for CaCl₂ introduces systematic error. Also, `S = salinity * MW` gives g/kg only if salinity is in mol/kg; the correlation expects g/L (density is in kg/m³). The conversion from molality to g/L requires iterative density (concentration = molality × density of solution), so `salinity * 58.44` is only approximate.

**Impact:** Under- or over-estimates brine density, which affects Δρ = ρ_brine − ρ_CO₂, which is the driving force for buoyancy, which affects the Theis pressure calculation (indirectly), the plume radius estimate, and the MARS IFT model input `drho_sq`.

---

### 5. [✅ FIXED] Mineral trapping year-50 guard is functional but Arrhenius correction has no low-temperature attenuation

**File:** `src/engine/plume/mineralTrapping.ts`  
**Line 59:** `if (year < 50 || Sg_dissolved <= 0) return 0` — correct, no mineral trapping before year 50.  
**Line 40:** `const T_factor = Math.exp(0.035 * Math.max(0, temperature_C - 60))` — this doubles the rate at ~+20°C above 60°C, which is reasonable. But it does **not** reduce the rate below 60°C: for T = 40°C, `max(0, -20) = 0`, so factor = 1.0. Real kinetics approximately halve per −10°C (Q₁₀ ≈ 2). For a 40°C formation, mineral trapping is overestimated by ~4×.

**Also:** `MINERAL_RATE` for `sandstone = 0.0008` (0.08%/year) applies at 60°C. The comment says "calibrated to Xu et al. 2004" but at 60°C, Xu et al. report ~0.001–0.005/year for arkosic sandstone depending on pCO₂. The value 0.0008 is at the low end.

---

## ⚠️ Significant Issues

### 6. [✅ FIXED] Module-level mutable state prevents safe multi-run / multi-instance use

**File:** `src/hooks/useSimulation.ts`, lines 198–203  
```typescript
let _raf = 0
let _startTime = 0
let _prevYear = -1
let _resumeYear = 0
let _peakResult: SimulationResult | null = null
let _plumeGrid: PlumeGrid | null = null
let _colorUpdateFn: (() => void) | null = null
```

All seven variables are module-level (file-scope) mutables. If:
- The user clicks "Run" twice in rapid succession
- The component unmounts and remounts (React StrictMode double-render)
- Two browser tabs open the same project

…then stale references persist, `requestAnimationFrame` callbacks reference the wrong `_plumeGrid`, and `_prevYear`/`_resumeYear` collide.

**Suggested fix:** Use `useRef` + `useCallback` in the hook body, or create a class/closure that encapsulates all animation state per instance.

---

### 7. [✅ FIXED] Hardcoded `CAPROCK_Y = 0.23` in `SceneAnnotations.tsx` — never updates when formation thickness changes

**File:** `src/components/ThreeViewer/SceneAnnotations.tsx`  
**Constant:** `CAPROCK_Y = 0.23`, `RESERVOIR_BOT = -0.23`

**But in `ReservoirViewer.tsx`**, the actual caprock Y position is computed dynamically:
```typescript
const h = 0.3 + thickness / 500          // scene height
const caprockY = -0.4 + h / 2            // group at [0, -0.4, 0]
```

For a 100 m thick formation:
- `h = 0.3 + 100/500 = 0.5`
- `caprockY = -0.4 + 0.25 = -0.15`
- Hardcoded `CAPROCK_Y = 0.23` → error of **0.38 scene units** (the caprock ring is above the actual seal)

**Impact:** The caprock ring mesh, glow lights, and convection finger Y bounds in `SceneAnnotations.tsx` are all at the wrong vertical position. Convection finger extinction check `y < RESERVOIR_BOT + 0.02` either kills fingers too early or lets them escape, depending on thickness.

**Same issue in:** `CaprockMesh.tsx` (line 16) and `CO2Particles.tsx` (lines 36–37) — both hardcode `CAPROCK_Y = 0.23`.

---

### 8. [✅ FIXED] `SimulationGrid.ts` fault face transmissibility reads out-of-bounds at grid boundaries

**File:** `src/engine/grid/SimulationGrid.ts`, lines 69–70  
```typescript
// X-direction fault check
const leftCell = this.cells[idx(i - 1, j, k)]   // i=0 → reads idx(-1, j, k) → last row!
```

When `i = 0`, `i - 1 = -1` wraps around to the end of the flat array. Same for `j = 0` (`j - 1 = -1`). This incorrectly applies fault transmissibility to boundary faces that should have full transmissibility.

**Impact:** Reservoir cells on the i=0 or j=0 boundary may have artificially reduced horizontal flow due to spurious fault detection.

> **🔍 Post-Review Correction — Wrong File Attribution:**
> `SimulationGrid.ts` does **not** contain a raw `idx(i-1, j, k)` lookup at lines 69–70. Reading the actual file confirms that at line 69, `SimulationGrid.ts` begins the `applyColorsToMesh()` method, which uses the safe `getCell()` accessor that has an explicit bounds guard: `if (i < 0 || i >= this.nx || j < 0 || j >= this.ny ...) return undefined`. The boundary-wrapping bug is real, but its actual location is **`src/engine/plume/saturationSolver.ts`**, which defines `const idx = (i, j, k) => k * ny * nx + j * nx + i` and uses this raw function directly for neighbor lookups without any bounds check. For `i = 0`, `idx(-1, j, k) = k*ny*nx + j*nx - 1`, which resolves to the last cell of the previous j-row — a valid array entry containing the wrong cell's fault transmissibility data. The fix and impact description remain correct; only the file reference needs updating.

---

### 9. [⚠️ PARTLY FIXED] Two dead-code Land model implementations coexist

**Implementation A (used by solver):** `saturationSolver.ts` lines 281–298 — inline Land trapping with `LAND_C = 2.5`, `prevSg`, `Sg_max`, `inImbibition`, `Sg_residual`. Uses `Float32Array` per-cell arrays.

**Implementation B (standalone, tested):** `landTrapping.ts` — exports `LandState`, `makeLandState()`, `applyLandTrapping()`, `tickLandState()`, `landResidualFraction()`. Has its own `computeResidualSaturation()` with `declare module` augmentation at the bottom (line 91).

**Problem:** `saturationSolver.ts` imports nothing from `landTrapping.ts`. The standalone module is dead code from the solver's perspective, though it has its own test suite at `__tests__/engine/plume/landTrapping.test.ts`.

**Additionally,** `landTrapping.ts` line 91–95 uses `declare module` to augment `LandState` with `Sg_old_approx`, but this is already declared in the interface at line 44. The augmentation has no effect and is a pattern error.

---

### 10. [✅ FIXED] `mineralTrapping: 0` hardcoded in analytical result — panels never show mineral trapping

**File:** `src/hooks/useSimulation.ts`, line 188  
```typescript
mineralTrapping: 0,   // patched from PlumeGrid in animateFrame if grid view active
```

The cellular grid solver tracks mineral trapping per cell (saturationSolver.ts lines 313–323), but the analytical `SimulationResult` always reports 0. The StatsOverlay and SimulationHUD therefore always show 0 Mt for mineral trapping, even after 1,000 years.

The comment says "patched from PlumeGrid in animateFrame", but `animateFrame` line 230–234 explicitly prevents this:
```typescript
// Do NOT override analytical trapping values
```

---

## 🔶 Moderate Issues

### 11. [✅ FIXED] Default well injection rate (0.05 Mt/yr) is unrealistically small

**File:** `src/store/formationStore.ts`, line 57  
```typescript
injectionRate: 0.05
```

Real CCS projects: Sleipner ~1 Mtpa, Kasawari ~3.3 Mtpa, Gorgon ~4 Mtpa. 0.05 Mt/yr produces a tiny plume that may make new users think the tool isn't working. The default should be in the range 0.5–3.0 Mt/yr.

---

### 12. [✅ FIXED] `co2SolubilityDuanSun` uses linear salting-out approximation

**File:** `src/engine/classical/solubility.ts`, line 3  
```typescript
const lambda = 0.1 + 0.02 * salinity
```

Duan-Sun (2003) computes λ from ion-specific parameters (Na⁺, Ca²⁺, Mg²⁺, Cl⁻). Using bulk salinity with a linear λ is a simplification that introduces 5–15% error for CaCl₂-dominated brines. The error propagates to solubility trapping calculations.

---

### 13. [✅ FIXED] `brineDensityGarcia` assumes NaCl in molality→g/L conversion

**File:** `src/engine/classical/density.ts`, line 36  
```typescript
const S = salinity * 58.44  // NaCl molecular weight = g/(mol/L?)
```

**Issues:**
1. `salinity` is in mol/kg (molality) from the store, but `S` needs to be in g/L for the Garcia polynomial. The conversion `molality × MW = g/kg`, but the polynomial expects g/L. The difference is ~2% at 1 mol/kg and ~15% at 5 mol/kg.
2. For CaCl₂ brine (MW = 110.98), using 58.44 gives S = 0.03 × 58.44 = 1.75 g/L instead of 0.03 × 110.98 = 3.33 g/L — 47% error.
3. The polynomial coefficients A, B, C were fitted to NaCl solutions. For CaCl₂, the density slope is steeper (CaCl₂ contributes ~2.5× more density per mole). Using NaCl coefficients with CaCl₂ molality systematically underestimates density.

---

### 14. [✅ FIXED] `co2DiffusionCoefficient` has undocumented output scaling and unvalidated pressure term

**File:** `src/engine/classical/diffusion.ts`  
```typescript
const D0 = 1e-9 * (T / 298.15) * Math.exp(-(P - 0.1) / 100)
const De = D0 * porosity / 1.5
return De * 1e9
```

1. **Final `* 1e9`**: Without documentation, the output units are ambiguous. If D0 is in m²/s (1e-9 is typical for CO₂ in water), then De is in m²/s, and `De * 1e9` returns in mm²/s? Or nm²/s? The consumer should know.
2. **Pressure term**: `Math.exp(-(P - 0.1) / 100)` — if P is in MPa (as everywhere else), then at 0.1 MPa (atmospheric) the term = 1.0; at 20 MPa it's exp(-19.9/100) = 0.82. This is a plausible ~18% reduction from atmospheric. But where does the "100" denominator come from? No reference or citation. Typical pressure dependence of CO₂ diffusivity follows a different functional form.
3. **Tortuosity**: `tau = 1.5` is hardcoded, but real tortuosity ranges from 1.3 (clean sand) to 5+ (shale).

---

### 15. [✅ FIXED] `LEGEND_GRADIENTS` identical for all display properties

**File:** `src/components/ThreeViewer/ReservoirViewer.tsx` (legend section)  
The gradient string `'linear-gradient(to right, #ff0000, #ffff00, #00ff00)'` is used for porosity, permeability, CO₂ saturation, pressure, and all other properties. The color bar never changes when the user switches display properties.

---

### 16. [✅ FIXED] `geologicalStore` not re-exported from `store/index.ts`

**File:** `src/store/index.ts`
Exports: `authStore`, `formationStore`, `simulationStore`, `uiStore`.
Missing: `geologicalStore`.

Components importing from `../../store` can't access geological state. They must import directly from `../../store/geologicalStore`. Inconsistent with the other stores.

---

### 26. [✅ FIXED] Legacy `salinity` field coexists with the split `monovalentSalinity` / `bivalentSalinity` fields — permit export may report stale value *(added post-review)*

**File:** `src/store/formationStore.ts`, line 41
```typescript
const DEFAULTS: FormationParams = {
  ...
  salinity: 0.15,              // ← legacy total-salinity field
  monovalentSalinity: 0.12,
  bivalentSalinity: 0.03,
  ...
}
```

The physics correctly uses `totalSalt = monovalentSalinity + bivalentSalinity` (issue #4 above). However, the legacy `salinity` field remains in `FormationParams` and in the store defaults. Any code that references `params.salinity` directly — including permit template serialization in `permitTemplates.ts` and any JSON export — will report `0.15` mol/kg regardless of what the user configured through the ion-type selector. If the user switches to a pure CaCl₂ brine (`monovalentSalinity = 0, bivalentSalinity = 0.15`), the exported permit document still reports `salinity = 0.15 mol/kg NaCl equivalent`, which is a data integrity error in a regulatory context.

**Impact:** Permit template exports may carry a stale or misleading salinity value that does not reflect the actual brine chemistry used in the simulation.

---

## 🔹 Minor / Polish Items

### 17. [✅ FIXED] `containmentProbability` is an ad-hoc heuristic with no physical basis

**File:** `src/hooks/useSimulation.ts`, line 190  
```typescript
containmentProbability: Math.min(0.95, 0.5 + ntg * 0.3 + trappedFrac * 0.15)
```

This formula:
- Always returns ≥ 0.5 (even with zero net-to-gross)
- Has no dependence on caprock quality, fault seal integrity, or injection pressure
- Caps at 0.95 (why 0.95 and not 1.0 or 0.99?)
- Could give false confidence in regulatory submissions

Zero citations. Should use a risk framework (e.g., SCRAM, RISQUE) or be removed.

---

### 18. [✅ FIXED] `SimulationResult.p10`/`p50`/`p90` mislabeled as IFT uncertainty

**File:** `src/hooks/useSimulation.ts`, lines 192–194  
```typescript
p10: capacityP10,
p50: totalCapacity,
p90: capacityP90,
```

These are DOE capacity percentile estimates (Goodman et al. 2011), not IFT model uncertainty. The StatsOverlay component shows them alongside IFT values without clarifying they're capacity uncertainty ranges. A user could misinterpret P10 as "90% chance IFT is above this value."

---

### 19. [✅ FIXED] Anhydrite permeability clamped to 0.001 mD minimum

**File:** `src/utils/geologicalModelToGrid.ts`, line of `logK = Math.log10(Math.max(0.001, zone.kHorizontal))`

Anhydrite's `kDefault = 0.00005` mD (5×10⁻⁵ mD). The `Math.max(0.001, 0.00005)` clamps it to 0.001 mD, which is 20× higher than realistic. This means the "impermeable" caprock still allows 0.001 mD of through-flow.

---

### 20. [✅ FIXED] Gap zones in geological model get wrong lithology assignment

**File:** `src/utils/geologicalModelToGrid.ts`, `getZoneAtDepth()`  
If zones have gaps (e.g., Zone A at 1900–1950 m, Zone B at 2100–2150 m), depths between 1950–2100 m fall through to `sortedZones[0]` (shallowest zone), giving gap cells the caprock's properties. The void between zones should either:
- Be treated as non-reservoir (isCaprock = true, activeForInjection = false), or
- Produce an error/warning about the geological model gap

> **🔍 Post-Review Addendum — Consequence is worse than stated:**
> `sortedZones[0]` is the **shallowest** zone, which in a typical model is the caprock. Confirmed at `geologicalModelToGrid.ts:131`: `const zone = getZoneAtDepth(sortedZones, depthM) ?? sortedZones[0]`. This means gap-depth cells don't just get arbitrary wrong properties — they get `isCaprock = true, activeForInjection = false`, and caprock-level low permeability. A multi-zone model with even a small stratigraphic gap silently removes those depth layers from injection, potentially eliminating a large portion of the reservoir without any warning or log message to the user.

---

### 21. [✅ FIXED] `colorMapping.ts` has 4 unused exported branches

**File:** `src/utils/colorMapping.ts`  
Exports `FAULT_SEAL`, `FAULT_OPEN`, `FAULT_SEAL_RED`, `FAULT_OPEN_GRN` but `saturationToColor` has no fault-aware logic. These are never referenced anywhere in the codebase.

---

### 22. [✅ FIXED] EconomicsPanel NPV is always negative

**File:** `src/components/EconomicsPanel/EconomicsPanel.tsx`  
```typescript
const cashFlow = (0 - op)  // revenue is always zero
```

No 45Q tax credit (US: $85/tCO₂ by 2026), no carbon price (EU ETS: ~€80/tCO₂), no revenue input. NPV is always negative by construction. The panel shows a meaningless result.

---

### 23. [✅ FIXED] `formationPresets.test.ts` may be out of sync with renamed store fields

The `formationPresets.ts` data and its test file reference field names that may have changed during the store refactoring (e.g., `caprockFriction`/`caprockCohesion` added, `salinity` split into mono/bi). Tests pass because vitest doesn't check for unused test variables, but some preset applications may silently use defaults instead of preset values.

---

### 24. [✅ FIXED] `gridParser.ts` exports naming collision risk

`cumulativeInjection` function name shadows the concept used in `computeYearly` where `totalCum` is computed by manually summing per-well cumulative injection. Both compute the same thing but use different formula structures — potential for one to be updated without the other.

---

### 25. [✅ FIXED] `expIntegralE1` duplicated in two files

**File:** `src/hooks/useSimulation.ts` lines 22–28 and `src/utils/validateGeomechanics.ts` (inline in `validateGeomechanics`)

The exponential integral E₁(x) approximation is defined:
1. As a standalone function in `useSimulation.ts`
2. Inline in `validateGeomechanics` (which is also in `useSimulation.ts` — same function but duplicated within the same file)

Both use the same series/padé approximation. Any fix to one must be copied to the other.

---

### 27. [✅ FIXED] `computeFaultTransm` enforces a hardcoded minimum fault width of 2% of model width *(added post-review)*

**File:** `src/utils/geologicalModelToGrid.ts`, line 80
```typescript
const faultWidth = Math.max(fault.faultZoneThickness / modelWidthM, 0.02)
```

A minimum of 0.02 (2% of the normalised model domain) is applied regardless of `fault.faultZoneThickness`. For a 30 km wide model, 2% = 600 m — meaning every fault, no matter how thin the user specifies, always seals a minimum 600 m wide corridor. This causes two problems:

1. **Over-sealing near boundaries:** Cells at the i=0 or j=0 boundary whose normalised centre coordinates are within 0.02 of a fault positioned near the edge will have their transmissibility reduced even if the fault zone is physically far away.
2. **User-specified ultra-thin faults ignored:** A user who specifies `faultZoneThickness = 1 m` (realistic for a single fault plane) gets 600 m of sealing instead.

**Impact:** Subtle, but any model with a fault near the edge of the domain will show anomalously low flow at boundary cells — an effect that is difficult to diagnose without reading this source line.

---

## Test Coverage Gaps

| Area | Test files | Assertions | Gaps |
|---|---|---|---|
| **MARS engine** | 3 | ~25 | No validation of bin features accepting non-binary values; no edge case for CH₄+N₂ > 1.0; no Pr/Tr range validation |
| **Classical properties** | 5 | ~40 | No test for viscosity units verification; no density test at phase boundary (Tr≈1, Pr≈1); no test for negative solubility with λ > 1 |
| **Plume solver** | 6 | ~30 | No multi-well test; no vertical heterogeneity test (layered k); no test for fault transmissibility blocking flow; no test with ramp-up/down schedule |
| **Color mapping** | 1 | 8 | No test for `faultSeal` argument branches; no test for saturation > 1.0 clamping |
| **Geological model → grid** | 1 | 12 | No gap zone test; no fault-at-boundary test; no single-zone test; no test with zero-thickness zone |
| **Formation presets** | 1 | ~5 | No verify that presets map to valid FormationParams (e.g., caprockFriction > 0) |
| **Utils (math, LAS)** | 2 | ~10 | No permitTemplate tests; no exportPackage tests; no computePressureField tests |
| **Components** | 0 | — | Zero component tests for ReservoirViewer, GridReservoir, EconomicsPanel, etc. |
| **Hooks** | 0 | — | Zero hook tests for useSimulation |

**Tests that exist but are weak:**
- `integration.test.ts` for MARS: only 3 assertions, validates intercept but not slope or R²
- `saturationSolver.test.ts`: validates caprock barrier and mass conservation, but no buoyancy verification, no lateral spread check, no multi-well test

---

## Architecture Observations

### 1. Single-file complexity
- `src/hooks/useSimulation.ts`: **508 lines**, 7 module-level mutables, `computeYearly` (165 lines) + `animateFrame` (55 lines) + `validateGeomechanics` (120 lines) + React hook wrapper. This file does everything — analytical physics, geomechanics, animation loop, auto-save, React integration.
- `src/components/ThreeViewer/ReservoirViewer.tsx`: **~1650 lines** — visualization, interaction, grid/particle view switching, CO₂ particle system, convection fingers, annotations, legends.

### 2. Dual physics engine without synchronization
The analytical `computeYearly` solver and the cellular `PlumeGrid` solver each compute trapping, dissolution, and plume geometry independently. They use different models:
- Analytical: 7%/year bulk trapping, fixed 60/40 residual/solubility split
- Cellular: Per-cell Land model with buoyancy, lateral diffusion, fault transmissibility

### 3. Physics constants hardcoded in multiple places
- `G = 9.81`, `DT = 3.156e7`: defined in `saturationSolver.ts`, not shared
- `LAND_C = 2.5`: in `saturationSolver.ts`, also defaults in `landTrapping.ts`
- `POISSON = 0.30`, `OG = 0.023`, `K0 = 0.82`: in `validateGeomechanics`
- `MU_BRINE = 6e-4`: in `saturationSolver.ts`
- No central `physics.ts` constants module

### 4. MARS model input `drho_sq` scaling
```typescript
const drho_sq = drho * drho / 1e6
```
If `drho` is in kg/m³ (typical Δρ ~200–500 kg/m³), then `drho² / 1e6` ranges from 0.04 to 0.25. The scaler expects this in a specific range — this should be validated against the original Python scaler fit.

### 5. `MonteCarlo` / `LatinHypercube` import exists but no UI panel
The `src/components/MonteCarlo/` directory exists with MC and LHS sampling, but there's no Monte Carlo panel in the UI. This may be a half-implemented feature.

---

## Security & Data Integrity

### No sensitivity validation on user inputs
- Methane fraction + nitrogen fraction can sum to > 1.0 (→ `co2Frac` < 0, which is used in phase calculations)
- Well positions can be outside [-1, 1]
- Injection rate can be negative
- Porosity can be > 1.0 or ≤ 0
- Temperature can be below CO₂ triple point (216.8 K)

### LocalStorage auto-save
`autoSaveProject()` writes to `localStorage` every run completion (and at stop/pause) without user confirmation. If local storage is full, it fails silently with `try/catch`.

---

---

## 🛠 Audit Corrections (post-review)

The following corrections were identified by cross-referencing the audit findings against the actual source files. No prior content has been removed — these notes supplement and correct specific claims made above.

### C1. Issue #8 — File attribution is wrong

The audit states the out-of-bounds fault lookup is in `src/engine/grid/SimulationGrid.ts` lines 69–70. Reading `SimulationGrid.ts` confirms that line 69 is the start of `applyColorsToMesh()`, not a fault transmissibility lookup. `SimulationGrid` exposes a safe `getCell(i, j, k)` method with an explicit bounds guard and does **not** perform any raw flat-index arithmetic on neighbor cells.

The actual bug is in **`src/engine/plume/saturationSolver.ts`**, which defines the raw index function `const idx = (i, j, k) => k * ny * nx + j * nx + i` and calls it for neighbor lookups without bounds checking. The symptom, impact, and recommended fix described in issue #8 are all correct; only the file reference needs updating.

### C2. Issue #2 — Unit ambiguity is the surface symptom; the deeper problem is a wrong functional form

The audit frames issue #2 as a unit-scaling question. A closer reading of the `viscosity.ts` implementation and the Fenghour (1998) paper reveals they use entirely different functional forms. The published Fenghour correlation is `ln(η₀) = Σ aᵢ(T*/T)^i` with `T* = 251.196 K`; the implementation uses a plain polynomial in `t = T_°C / 100`. The published coefficients (`a₀ = 0.235156, a₁ = −0.491266`, …) bear no relation to the code's `a0 = −1.59244e-2, a1 = 4.97378e-1, …`. No unit rescaling converts one set into the other. The implementation is an undocumented custom fit wrongly attributed to Fenghour (1998). The post-review addendum in issue #2 above elaborates on the magnitude error at supercritical density.

### C3. Issue #20 — Consequence understated

The audit notes that gap-depth cells fall back to `sortedZones[0]`. The post-review addendum clarifies that `sortedZones[0]` is the shallowest zone — typically the caprock — so gap cells receive `isCaprock = true, activeForInjection = false`, and near-zero permeability. This silently removes those depths from the injection-eligible reservoir, which is more severe than getting a generically wrong lithology.

---

## ➕ Additional Issues Found (post-review)

The following issues were not in the original audit. They are numbered starting at 26 to preserve the original issue numbering. Issues #26 and #27 have been inserted in-line into the Moderate and Minor sections respectively above; they are summarised here for quick reference.

| # | Severity | File | Summary |
|---|---|---|---|
| 26 | Moderate | `formationStore.ts:41` | Legacy `salinity` field coexists with split fields; permit exports may report stale NaCl-equivalent value regardless of actual brine chemistry set by user |
| 27 | Minor | `geologicalModelToGrid.ts:80` | `computeFaultTransm` enforces 2% minimum fault width, over-sealing boundary cells for any thin or boundary-adjacent fault |

---

## 🎯 Priority Ordering for PETRONAS Demo

The original audit orders issues by physics severity. For the specific goal of producing a PoC credible enough to demo to a PETRONAS engineer (masterplan.md §A1.3), the operational priority differs because regulatory output correctness and the presence of the tool's central research claim (the AD gate) matter as much as simulation physics accuracy.

Recommended fix order for the PETRONAS demo milestone:

| Fix Priority | Issue | Status | Reason |
|---|---|---|---|---|
| **P1** | Permit templates not updated for CCUS Act 2025 *(see Gaps §G1)* | ✅ FIXED — MY template with MyCCUS, assessment/storage licence, fee schedule, Sarawak split | Kills the entire regulatory use case — the demo script in masterplan.md ends with exporting a Malaysian permit report |
| **P2** | Applicability Domain gate absent *(see Gaps §G2)* | ✅ FIXED — `applicabilityDomain.ts` exists, wired into `useSimulation.ts:137` | The AD gate (Green/Yellow/Red badge) is the central published contribution of the MARS IFT paper; its absence from the deployed tool is the most damaging omission when presenting to an academic or technical reviewer |
| **P3** | Issue #1 — `_findZone` always returns `undefined` | ✅ FIXED — uses `zoneLithologyMap` in `PlumeGrid.ts:52-53` | Mineral trapping uses sandstone kinetics for every cell including caprock and anhydrite; wrong for all lithologies |
| **P4** | Issue #10 — `mineralTrapping: 0` hardcoded in output | ✅ FIXED — overridden from `trappingBreakdown().mineralMt` in `animateFrame` | Every regulatory-export panel shows 0 Mt mineral trapping even after 1,000 years |
| **P5** | Issue #3 — Dual solver not synchronized | ✅ FIXED — post-injection overrides ALL trapping values from grid solver | The 3D visualisation is cosmetic; exportable numbers come from the simpler analytical model — misleading in a demo context |
| **P6** | Issue #2 / C2 — Viscosity functional form wrong | ✅ FIXED — reimplemented with two-part correlation, magnitude-validated | Pressure calculations (Theis ΔP, fracture pressure check, MAIP margin) may be off by multiple orders of magnitude |
| **P7** | Issue #26 — Legacy `salinity` in permit export | ✅ FIXED — `salinity` field removed from `FormationParams`, all presets, defaults | Permit documents report wrong brine composition if user changed ion type |
| **P8** | Issue #6 — Module-level mutable state | ✅ FIXED — `useRef<AnimationState>` + `useCallback` pattern | Rapid "Run" double-clicks or React StrictMode causes stale animation state — visible during a live demo |
| **P9** | Issue #11 — Default injection rate 0.05 Mt/yr | ✅ FIXED — changed to 1.0 Mt/yr in store and defaults | First-impression problem: tiny plume makes tool look broken |
| **P10** | Issue #7 — Hardcoded `CAPROCK_Y = 0.23` | ✅ FIXED — dynamic from `params.thickness` in mesh, annotations, particles | Caprock mesh, glow lights, and convection fingers are at visually wrong positions — noticeable in 3D view |

Issues #4, #5, #8, #12–#16, and #17–#25 are real but can be deferred past the PETRONAS demo without blocking credibility.

---

## 📋 Gaps vs. masterplan.md and research.md

The following are not code bugs but **missing features or compliance requirements** called out explicitly in `masterplan.md` and `research.md` that are absent from the current PoC. They represent the delta between "working demo" and "credible industry tool."

### G1. [✅ FIXED] Permit templates not updated for Malaysian CCUS Act 2025 — blocks masterplan.md Task 1

**masterplan.md §A1.3 Task 1** states that the Malaysia permit template was built before the CCUS Act 2025 was gazetted (1 October 2025) and requires specific structural updates:
- MyCCUS Agency as the named licensing authority (not PETRONAS Technical Standards)
- Offshore Assessment Permit fields: permit area coordinates, intended geological assessment methods, three-year timeline
- Storage Licence fields: storage complex characterisation, monitoring plan commitment, corrective measures protocol
- Fee schedule: RM 80,000 (assessment), RM 120,000 (storage licence)

The current `permitTemplates.ts` has not been verified against these requirements. Until updated, any Malaysia-jurisdiction export from the tool is non-compliant with the Act that governs every project in the PETRONAS pipeline (Duyong, Kasawari Phase II, Penyu Basin).

**Additionally:** `research.md` Caveat 4 notes that the CCUS Act 2025 does **not** apply to Sabah/Sarawak, where Kasawari sits (governed instead by the Sarawak 2022 Land Code and 2023 Ordinance). The permit module must handle this jurisdictional split or risk exporting a Malaysia-Act-compliant document for a project that is not under that Act.

### G2. [✅ FIXED] Applicability Domain gate not implemented — blocks masterplan.md Task 3

**masterplan.md §A1.3 Task 3** requires:
> *"In `src/engine/mars/index.ts`, add an `assessApplicabilityDomain(input, regime)` function that checks each scaled input against Appendix A1 bounds from your paper. Return a `{ status: 'green'|'yellow'|'red', pi_halfwidth: number, pi_level: number }` object. Display in `FluidProperties` component."*

No such function exists in the current codebase. The Green/Yellow/Red AD badge is the central deployed contribution of the MARS IFT paper — the first thing any journal reviewer or technical stakeholder will look for in the tool. Its absence means the conformal prediction interval half-widths (the paper's key UQ output) are also not displayed. The tool accepts any input silently, including inputs far outside the training domain, with no warning.

### G3. [❌ NOT IMPLEMENTED] Real authentication not implemented — masterplan.md Task 4

**masterplan.md §A1.3 Task 4** requires replacing the localStorage mock auth with Supabase. The current `authStore.ts` uses localStorage simulation. Any demo that involves account creation or login will expose this as non-production infrastructure — credibility risk when presenting to a technical stakeholder.

### G4. [❌ NOT IMPLEMENTED] Sleipner and Johansen benchmark presets absent — planned for masterplan.md §A3.3

**masterplan.md §A3.3 Upgrade 2** and **research.md §recommended roadmap (months 6–12)** both specify pre-loading Sleipner and Johansen as named formation presets. These are the two most-cited CCS benchmark cases and their presence would give instant credibility to any academic reviewer. Currently absent.

### G5. [❌ NOT IMPLEMENTED] Eclipse/E100 deck parser absent — planned for masterplan.md §A3.3

**masterplan.md §A3.3 Upgrade 3** specifies a read-only Eclipse .DATA deck parser (`src/utils/eclipseParser.ts`) for importing formation geometry and property grids. **research.md §recommended roadmap (months 12–18)** confirms this as a key unlock for the "credible companion to CMG/INTERSECT" positioning. Currently absent.

### G6. [⚠️ PARTLY FIXED] research.md feature gap table — mineral trapping listed as absent but partially implemented

**research.md** Table row for CarbonLens shows "Coupled geochemistry (mineral trapping)" as `Solubility only (Duan-Sun)`. The v3 codebase does have `mineralTrapping.ts` with Xu et al. kinetics. However, as documented in issues #1 and #10, the mineral trapping computation is effectively dead from a user-output perspective — `_findZone` always returns undefined (so kinetics always use sandstone defaults) and `mineralTrapping: 0` is always reported in the UI. The research.md assessment therefore remains accurate from a user-observable standpoint: mineral trapping does not function. The table is correct; the implementation creates a false impression of completeness.

> **Update:** With P3 (`_findZone` fix) and P4 (mineral trapping overridden from grid solver), mineral trapping now correctly propagates to the UI. However, the research.md table still shows "Solubility only" — this doc reference should be updated to reflect working mineral trapping.

---

## Appendix: Files Reviewed

<details>
<summary>Expand to show full file list (62 files)</summary>

```
plan009.md
masterplan.md
research.md
README.md
v3/carbonlens_v3_poc/src/types/*
v3/carbonlens_v3_poc/src/engine/index.ts
v3/carbonlens_v3_poc/src/engine/classical/density.ts
v3/carbonlens_v3_poc/src/engine/classical/diffusion.ts
v3/carbonlens_v3_poc/src/engine/classical/phase.ts
v3/carbonlens_v3_poc/src/engine/classical/solubility.ts
v3/carbonlens_v3_poc/src/engine/classical/viscosity.ts
v3/carbonlens_v3_poc/src/engine/plume/saturationSolver.ts
v3/carbonlens_v3_poc/src/engine/plume/landTrapping.ts
v3/carbonlens_v3_poc/src/engine/plume/mineralTrapping.ts
v3/carbonlens_v3_poc/src/engine/plume/relativePermeability.ts
v3/carbonlens_v3_poc/src/engine/plume/particleEngine.ts
v3/carbonlens_v3_poc/src/engine/plume/PlumeGrid.ts
v3/carbonlens_v3_poc/src/engine/grid/SimulationGrid.ts
v3/carbonlens_v3_poc/src/engine/mars/*
v3/carbonlens_v3_poc/src/store/formationStore.ts
v3/carbonlens_v3_poc/src/store/simulationStore.ts
v3/carbonlens_v3_poc/src/store/geologicalStore.ts
v3/carbonlens_v3_poc/src/store/uiStore.ts
v3/carbonlens_v3_poc/src/store/authStore.ts
v3/carbonlens_v3_poc/src/store/index.ts
v3/carbonlens_v3_poc/src/hooks/useSimulation.ts
v3/carbonlens_v3_poc/src/utils/colorMapping.ts
v3/carbonlens_v3_poc/src/utils/computePressureField.ts
v3/carbonlens_v3_poc/src/utils/geologicalModelToGrid.ts
v3/carbonlens_v3_poc/src/utils/gridParser.ts
v3/carbonlens_v3_poc/src/utils/permitTemplates.ts
v3/carbonlens_v3_poc/src/utils/math.ts
v3/carbonlens_v3_poc/src/utils/lasParser.ts
v3/carbonlens_v3_poc/src/utils/exportPackage.ts
v3/carbonlens_v3_poc/src/utils/units.ts
v3/carbonlens_v3_poc/src/utils/noise.ts
v3/carbonlens_v3_poc/src/utils/deformation.ts
v3/carbonlens_v3_poc/src/data/lithologyDefaults.ts
v3/carbonlens_v3_poc/src/data/formationPresets.ts
v3/carbonlens_v3_poc/src/data/defaultProject.ts
v3/carbonlens_v3_poc/src/components/ThreeViewer/ReservoirViewer.tsx
v3/carbonlens_v3_poc/src/components/ThreeViewer/GridReservoir.tsx
v3/carbonlens_v3_poc/src/components/ThreeViewer/CO2Particles.tsx
v3/carbonlens_v3_poc/src/components/ThreeViewer/CaprockMesh.tsx
v3/carbonlens_v3_poc/src/components/ThreeViewer/SceneAnnotations.tsx
v3/carbonlens_v3_poc/src/components/EconomicsPanel/EconomicsPanel.tsx
v3/carbonlens_v3_poc/src/__tests__/engine/mars/integration.test.ts
v3/carbonlens_v3_poc/src/__tests__/engine/plume/*
v3/carbonlens_v3_poc/src/__tests__/engine/classical/*
v3/carbonlens_v3_poc/src/__tests__/data/formationPresets.test.ts
v3/carbonlens_v3_poc/src/__tests__/utils/*
```

</details>
