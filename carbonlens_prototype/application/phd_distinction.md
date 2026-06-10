# MSc vs PhD Distinction — CarbonLens Research Boundary
*Reference document for supervisor discussion and competition submission framing*

---

## MSc Contribution (Completed / In Progress at UTP)

**Title scope:** ML-based prediction of CO₂–brine interfacial tension using Multivariate Adaptive Regression Splines (MARS) with cross-laboratory external validation.

**The single novel contribution:**
A Cross-Laboratory External Validation (CLEV) framework that demonstrates a rank inversion in ML model performance — where ANN achieves highest test-set accuracy but fails on unseen laboratory data, while MARS achieves lower test-set accuracy but generalises reliably to new laboratories. This was demonstrated across 3,265 datapoints from 16 independent laboratories.

**What the MSc produced:**
1. Two closed-form MARS equations for IFT (subcritical and supercritical regimes)
2. A conformal prediction interval framework with Uncertainty Inflation Factor (UIF) for apparatus-offset diagnosis
3. A validated cross-laboratory holdout protocol (SHA-256-locked, preventing data leakage)
4. Published (or submittable) paper: "Interpretable MARS model for CO₂-brine IFT with cross-laboratory external validation"

**Scope boundary — what the MSc does NOT include:**
- Contact angle (wettability) prediction
- CO₂ solubility in multi-component brines with divalent cations
- CO₂ diffusivity in formation brines
- Uncertainty propagation from fluid properties to storage capacity
- Any other thermophysical property

---

## PhD Contribution (Not Started — Future Research)

**Proposed Title:**
*"An ML-Augmented Thermophysical Property Library with Calibrated Uncertainty for Geological CO₂ Storage: Cross-Laboratory Validation and Integrated Deployment"*

**Core research question:**
Can the CLEV framework developed for IFT be systematically extended to all critical CO₂–brine thermophysical properties, and can the resulting ML property library — with conformal prediction intervals — be formally propagated through a storage capacity simulator to yield defensible P10/P50/P90 regulatory estimates?

**The PhD adds four things the MSc does not contain:**

### PhD Paper 2 — Contact Angle MARS + Joint Uncertainty Propagation
- Build MARS model for CO₂–brine–rock contact angle using same CLEV methodology
- Data: 600–900 published experimental datapoints, held-out lab validation
- Combine with MSc IFT model: joint (IFT, θ) → Young-Laplace capillary pressure Pc = 2γcosθ/r
- Propagate joint uncertainty to maximum CO₂ column height (caprock sealing capacity)
- **Why novel:** No study has jointly modeled IFT and contact angle with shared conformal intervals. Current practice uses IFT alone; wettability uncertainty is ignored in regulatory submissions.

### PhD Paper 3 — CO₂ Solubility in Multi-Component Brines
- Duan-Sun (2003) fails above 100°C, for CaCl₂/MgCl₂ brines, and impure CO₂ streams
- Build MARS solubility model addressing all four gaps
- Data: 500–800 datapoints from peer-reviewed literature; CLEV holdout protocol
- **Why novel:** Dissolution trapping accounts for 15–25% of long-term CO₂ storage at Sleipner conditions. Current classical models introduce 15–30% systematic error in high-salinity divalent environments that are common in Southeast Asian and Middle Eastern basins.

### PhD Paper 4 — Joint Uncertainty Propagation to Regulatory Storage Capacity
- Monte Carlo sampling of IFT, contact angle, and solubility conformal intervals
- Propagate through DOE storage capacity model → P10/P50/P90 capacity bounds
- First formal framework for deriving regulatory uncertainty bounds from ML property uncertainty
- **Why novel:** Current industry practice assigns arbitrary uncertainty to P10/P50/P90 storage estimates. This paper provides a principled, property-physics-grounded basis for those bounds — directly applicable to EPA Class VI, EU CCS Directive, and Malaysia CCUS Act 2025 permit requirements.

### PhD Paper 5 — CO₂ Diffusivity (if time permits)
- MARS model for molecular diffusivity in formation brines
- Application: 50–100 year dissolution trapping kinetics
- Cross-source validation against published diffusivity measurements

### PhD Paper 6 — CarbonLens Platform (Software Contribution)
- Deploy all MARS models (IFT + contact angle + solubility + diffusivity) in integrated simulator
- Replace all classical correlations in CarbonLens with ML models with live conformal bounds
- Validate full simulation pipeline against Sleipner, Johansen, Quest field data
- Report: first browser-native CCS simulator with ML-augmented thermophysical properties and calibrated uncertainty
- **Target journal:** *Computers & Geosciences* or *Environmental Modelling & Software*

---

## The Boundary: Prototype vs PhD Product

### Dubai Competition Prototype (2026) — What Is Being Submitted

CarbonLens v3 is a browser-native CO₂ storage simulation platform that currently contains:

**ML components (MSc-origin):**
- MARS IFT model (subcritical + supercritical) with applicability domain assessment

**Classical correlation components (published literature, no ML novelty):**
- CO₂ density: Span-Wagner (1996) equation of state
- CO₂ viscosity: Fenghour et al. (1998)
- CO₂ solubility: Duan-Sun (2003)
- CO₂ diffusivity: Stokes-Einstein / Wilke-Chang estimates
- Contact angle: not modeled (static assumption)
- Relative permeability: Brooks-Corey (1964)
- Trapping: Land (1968) residual, Henry's Law dissolution

**Engineering platform contributions:**
- Multi-physics simulation workflow (pressure + flow + trapping + geomechanics)
- 3D visualisation (Three.js)
- Multi-jurisdiction permit export (EPA Class VI, EU CCS Directive, PETRONAS, NPD, OPGGS)
- History matching (Nelder-Mead optimiser against observed plume data)
- Formation preset library

**What the prototype does NOT contain (PhD territory):**
- Contact angle MARS model → not built yet
- Multi-component solubility MARS model → not built yet
- Diffusivity MARS model → not built yet
- Joint IFT + θ → capillary pressure uncertainty propagation → not built yet
- Formal P10/P50/P90 bounds from property uncertainty → not built yet
- Validation against real field data (Sleipner 4D seismic, Quest MVA reports) → not built yet

### Full CarbonLens PhD Product (2028–2029) — What Is Not Being Submitted

The PhD version of CarbonLens differs from the prototype in one critical dimension:

> **The prototype uses ONE ML model (IFT) and four classical correlations. The PhD product uses FIVE ML models for all critical thermophysical properties, each with conformal prediction intervals, with joint uncertainty propagating through the full storage capacity calculation.**

This is the scientific contribution of the PhD. It cannot be submitted to Dubai because it does not exist yet.

---

## How to Describe This Publicly (Competition Framing)

In the competition application and any public exhibition:

✓ **Say:** "CarbonLens incorporates an ML model for CO₂–brine interfacial tension prediction, developed from MSc research at UTP Malaysia, with classical correlations for other thermophysical properties."

✓ **Say:** "This prototype demonstrates the feasibility of browser-native ML-augmented CCS screening. Ongoing PhD research will extend the ML property library to contact angle, solubility, and diffusivity, with calibrated uncertainty propagating through the full capacity estimate."

✗ **Do not say:** "CarbonLens contains a novel ML framework for thermophysical property prediction" — that belongs to the PhD.

✗ **Do not present:** The MARS equation terms, coefficients, knot values, or training methodology in the competition materials — those belong to the MSc/PhD papers.

---

## Summary — The One-Paragraph Distinction

*"My MSc at UTP develops and validates an interpretable ML model (MARS) for CO₂–brine interfacial tension prediction using a cross-laboratory external validation framework that proves test-set accuracy is insufficient for field deployability. My intended PhD extends this methodology to four additional CO₂–brine thermophysical properties — contact angle, solubility, diffusivity, and their joint propagation to storage capacity uncertainty — and formalises the resulting ML property library in CarbonLens, a browser-native simulation platform. The Dubai competition prototype demonstrates the engineering platform built on the MSc IFT model; the PhD contribution is the complete ML property library that would replace all remaining classical correlations in that platform."*

---

*Document prepared: 2026-06-09*
*For supervisor review before competition submission*
