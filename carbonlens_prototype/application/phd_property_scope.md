# PhD Thermophysical Property Scope — Research Boundary Document
*Defines which properties belong to MSc, PhD, and post-PhD — and the data evidence for each*

---

## The Governing Principle

The PhD extends the CLEV (Cross-Laboratory External Validation) framework to properties where:
1. ML meaningfully improves on existing classical correlations
2. Sufficient cross-laboratory experimental data exists to apply CLEV rigorously
3. The property directly impacts storage capacity or geomechanical safety calculations

This is NOT "replace every classical correlation with ML." It is a targeted program addressing the specific properties where classical models have documented, quantified gaps.

---

## Property Assessment Summary

### Tier 1 — Core PhD MARS Papers (Data sufficient, gap real, high impact)

| Property | Data Available | Labs | Classical Gap | Direct CarbonLens Impact |
|---|---|---|---|---|
| CO₂ solubility (divalent brines + impure CO₂) | 2,800–3,500 pts | 20+ (NaCl); 6–8 (divalent) | Duan-Sun (2003) fails for CaCl₂/MgCl₂ (8–15% error) and CO₂+CH₄ mixtures | Dissolution trapping budget (15–25% of stored CO₂) |
| Brine density with dissolved CO₂ (multi-cation) | 600–900 pts | 8–12 | Garcia (2001) is NaCl-only; 1–3% error for CaCl₂ brines | Buoyancy force (Δρ drives plume rise and convective mixing) |
| Contact angle / wettability | 800–1,100 pts | 14–18 | No accepted model exists; prototype uses static assumption | Capillary entry pressure → max CO₂ column height → caprock seal |

### Tier 2 — Extended PhD Papers (Feasible, strategic value)

| Property | Data Available | Labs | Classical Gap | Note |
|---|---|---|---|---|
| CO₂ mixture density (impure CO₂: +CH₄, N₂, H₂S) | 800–1,200 (binary) | 8–12 | GERG-2008 fails for SO₂-bearing and ternary streams | Growing industrial relevance; real injection streams not pure CO₂ |
| CO₂ mixture viscosity (impure streams) | 200–400 pts | 5–8 | No validated model for CO₂+SO₂+H₂O; Fenghour only for pure CO₂ | Can be combined paper with mixture density |
| Brine viscosity (divalent + dissolved CO₂) | 100–180 pts (divalent) | 4–6 | CaCl₂ brine viscosity 30–40% higher than NaCl at same salinity; no classical model | Can be Tier 1 if combined with brine density paper |

### Dropped From PhD Scope — With Reason

| Property | Why Dropped |
|---|---|
| CO₂ diffusivity in brine | Only 200–350 datapoints across 4 different measurement techniques with systematic inter-method bias. MARS conformal intervals would be *wider* than Wilke-Chang error range. → Replace with Bayesian uncertainty characterisation paper |
| CO₂-brine relative permeability | Rock-specific by nature. No universal MARS model defensible. Belongs in history matching parameter estimation, not property prediction. |
| Rock geomechanical properties | Different physics domain (solid mechanics not fluid thermodynamics). Well-characterised by existing methods. |
| Mineral reaction kinetics | Geochemical domain. Different modelling methodology required. |
| Seismic/monitoring properties | Monitoring-side geophysics — beyond CarbonLens simulator scope for PhD. |

---

## Complete PhD Publication Plan (Revised)

### Paper 1 (MSc → PhD Chapter 3) — PUBLISHED/SUBMITTED
**CO₂-brine IFT prediction using MARS with cross-laboratory external validation**
- 3,265 datapoints, 16 labs, CLEV framework, conformal prediction with UIF
- Target: *Int. J. Greenhouse Gas Control* or *Fuel*

### Paper 2 (PhD Year 1)
**Contact angle MARS model and joint IFT+θ uncertainty propagation to capillary pressure**
- 800–1,100 datapoints, ~14–18 labs, rock type as categorical input
- Novel: First CLEV-validated contact angle model; first joint (IFT, θ) → Pc conformal uncertainty
- Note: Iglauer group dominates ~40% of data — same cross-lab bias problem your CLEV framework was built to solve. This is actually a *feature* of the paper's narrative.
- Target: *Fuel* or *SPE Reservoir Evaluation & Engineering*

### Paper 3 (PhD Year 1–2)
**CO₂ solubility in multi-component brines and impure CO₂ streams using MARS with CLEV**
- 2,800–3,500 datapoints; focus on divalent-cation brines (CaCl₂, MgCl₂) and CO₂+CH₄/N₂ mixtures
- Novel: First ML model closing the divalent-brine and impure-CO₂ gaps in Duan-Sun
- Target: *Chemical Engineering Journal* or *Int. J. Greenhouse Gas Control*

### Paper 4 (PhD Year 2) — NEW ADDITION
**MARS model for CO₂-saturated brine density in multi-component formation waters**
- 600–900 datapoints; extends Garcia (2001) to CaCl₂/MgCl₂/KCl/Na₂SO₄ brines
- Novel: Closes the NaCl-only limitation of Garcia (2001); direct impact on buoyancy and convective mixing calculations
- Target: *Fluid Phase Equilibria* or *J. Chem. Eng. Data*

### Paper 5 (PhD Year 2) — NEW ADDITION
**MARS model for density and viscosity of impure CO₂ injection streams**
- CO₂ + CH₄, N₂, H₂S, SO₂ binary mixtures; ~800–1,200 binary datapoints
- Novel: GERG-2008 and PR-EOS fail for SO₂-bearing and ternary streams; first ML model for impure CCS injection stream PVT
- Target: *International Journal of Greenhouse Gas Control* or *Fluid Phase Equilibria*

### Paper 6 (PhD Year 2–3)
**Joint uncertainty propagation from ML thermophysical properties to geological CO₂ storage capacity**
- Monte Carlo: sample (IFT, θ, solubility, brine density) conformal intervals → Young-Laplace Pc → capacity P10/P50/P90
- Novel: First principled framework for deriving regulatory P10/P50/P90 bounds from property physics uncertainty
- Target: *SPE Reservoir Evaluation & Engineering* or *Int. J. Greenhouse Gas Control*

### Paper 7 (PhD Year 3) — Software/Platform Paper
**CarbonLens: A browser-native ML-augmented CO₂ geological storage simulator with calibrated uncertainty**
- Deploys all 4 MARS models (IFT, contact angle, solubility, brine density) in integrated simulator
- Replaces classical correlations; joint UQ pipeline; validates against Sleipner, Quest, Johansen
- Novel: First browser-native CCS simulator with ML property library and conformal prediction intervals
- Target: *Computers & Geosciences* or *Environmental Modelling & Software*

### Bonus Paper (if time / data permits)
**Bayesian uncertainty characterisation of CO₂ diffusivity in formation brines**
- Not a MARS prediction paper — a paper about *how uncertain* diffusivity is and what that means for dissolution trapping estimates
- Novel: Quantifies error propagation from sparse diffusivity data through convective mixing model
- Target: *Advances in Water Resources*

---

## The One-Paragraph PhD Synopsis

*"My PhD extends the Cross-Laboratory External Validation (CLEV) framework developed in my MSc for CO₂-brine interfacial tension to four additional thermophysical properties — contact angle, CO₂ solubility in multi-component brines, CO₂-saturated brine density, and impure CO₂ injection stream PVT — each with calibrated conformal prediction intervals. A joint uncertainty propagation pipeline formally connects these ML property models to regulatory storage capacity estimates (P10/P50/P90), providing the first principled thermophysical basis for CCS uncertainty quantification. All models are deployed in CarbonLens, a browser-native simulation platform that is validated against Sleipner, Quest, and Johansen field data and constitutes the software contribution of the thesis."*

---

## What the Dubai Prototype Does NOT Contain (PhD Territory Marker)

The competition prototype (CarbonLens v3) uses:
- MARS IFT model ← MSc contribution
- Duan-Sun (2003) for solubility ← classical, PhD will replace
- Garcia (2001) for brine density ← classical, PhD will replace
- Static contact angle assumption ← PhD Paper 2 will replace
- Span-Wagner for pure CO₂ ← remains (near-perfect, no ML needed)
- Fenghour (1998) for CO₂ viscosity ← PhD Paper 5 will extend to impure streams

The gap between the prototype and the full PhD product is precisely and verifiably four missing MARS models and the uncertainty propagation pipeline connecting them.

---

*Last updated: 2026-06-09*
