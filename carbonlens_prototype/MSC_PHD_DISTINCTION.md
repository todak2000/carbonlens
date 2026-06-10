# Research Boundary Document
## MSc vs PhD — CarbonLens Prototype vs CarbonLens PhD Product

**Author:** Daniel T. Olagunju
**Institution:** Universiti Teknologi PETRONAS (UTP), Malaysia
**Date:** 2026-06-09
**Purpose:** Formal boundary definition for supervisor sign-off, competition submission framing, and future examiner reference

---

## Section 1: The MSc Research

### Title
*Interpretable Machine Learning for CO₂-Brine Interfacial Tension Prediction: A Cross-Laboratory External Validation Framework*

### The Single Novel Contribution
A **Cross-Laboratory External Validation (CLEV) framework** that demonstrates a rank inversion in ML model performance — where models with the highest test-set accuracy (ANN) fail on data from unseen laboratories, while interpretable models (MARS) generalise reliably. Applied specifically to CO₂-brine interfacial tension (IFT) prediction.

### What the MSc Produced
| Deliverable | Description |
|---|---|
| **Dataset** | 3,265 experimental datapoints compiled from 16 independent laboratories across the literature |
| **CLEV protocol** | SHA-256-locked holdout of entire laboratories before training — first application of this method to CO₂-brine property prediction |
| **MARS IFT model** | Two closed-form piecewise-linear equations (subcritical and supercritical regimes) — transcribable directly into any simulator |
| **Conformal prediction intervals** | 80% prediction intervals with Uncertainty Inflation Factor (UIF) for apparatus-offset diagnosis and recalibration |
| **Rank inversion finding** | Formal demonstration that ANN achieves highest test-set R² (0.964) but catastrophic external R² (-0.48); MARS achieves lower test-set R² (0.939) but reliable external R² (0.945) |

### Strict Scope Boundary — What the MSc Does NOT Claim
The MSc covers **IFT only**. It makes no contribution to:
- Contact angle / wettability prediction
- CO₂ solubility in brine
- Brine density with dissolved CO₂
- CO₂ mixture (impure stream) properties
- Joint uncertainty propagation across properties
- Any integrated simulation platform

---

## Section 2: The Dubai Competition Prototype (CarbonLens v3)

### What It Is
A browser-native CO₂ geological storage simulation platform built on top of the MSc MARS IFT model, combined with classical published correlations for all other thermophysical properties, wrapped in an engineering workflow covering simulation, geomechanics, economics, and regulatory permit export.

### ML Components (MSc-Origin)
| Component | Source | Status in Prototype |
|---|---|---|
| MARS IFT model — subcritical (16-term) | MSc research, UTP | ✓ Deployed |
| MARS IFT model — supercritical (35-term) | MSc research, UTP | ✓ Deployed |
| Conformal prediction / applicability domain | MSc research, UTP | ✓ Deployed (AD gate) |

### Classical Correlation Components (Published Literature — No PhD Novelty)
| Property | Model Used | Reference | PhD Will Replace? |
|---|---|---|---|
| CO₂ density | Span-Wagner EOS | Span & Wagner (1996) | No — near-perfect for pure CO₂ |
| CO₂ viscosity | Fenghour et al. | Fenghour et al. (1998) | Partial — PhD extends to impure streams |
| CO₂ solubility | Duan-Sun | Duan & Sun (2003) | **Yes** — PhD Paper 3 |
| Brine density (with CO₂) | Garcia correlation | Garcia (2001) | **Yes** — PhD Paper 4 |
| Relative permeability | Brooks-Corey | Brooks & Corey (1964) | No — rock-specific, history matching domain |
| Residual trapping | Land model | Land (1968) | No — remains |
| Pressure model | Theis radial flow | Theis (1935) | No — remains |
| Geomechanics | Mohr-Coulomb + Biot | Standard literature | No — remains |

### Engineering Platform Components (Product Innovation — Not Thesis IP)
- Multi-physics simulation workflow (pressure + flow + trapping + geomechanics)
- Interactive 3D CO₂ plume visualisation (Three.js / React Three Fiber)
- Multi-jurisdiction permit export (US EPA Class VI, EU CCS Directive, Malaysia PETRONAS, Norway NPD, Australia OPGGS)
- History matching (Nelder-Mead optimiser)
- Economics and leakage risk panels
- Formation preset library (15 formations across 7 countries after Dubai additions)
- Project management and persistence layer

### What the Prototype Is NOT
The prototype is **not** a PhD thesis contribution. It is a demonstration of:
1. The MSc MARS IFT model deployed in a working engineering tool
2. An engineering platform designed to receive the PhD ML property library when it is built

### Correct Public Description for Competition
> *"CarbonLens incorporates an interpretable ML model for CO₂-brine interfacial tension prediction, developed from MSc research at Universiti Teknologi PETRONAS, with classical peer-reviewed correlations for other thermophysical properties. Ongoing PhD research will extend the ML property library to contact angle, solubility, and brine density, with calibrated uncertainty propagating through the full storage capacity estimate."*

---

## Section 3: The PhD Research

### Proposed Title
*An ML-Augmented Thermophysical Property Library with Calibrated Uncertainty for Geological CO₂ Storage: Cross-Laboratory Validation and Integrated Deployment*

### The Central Research Question
Can the CLEV framework developed for IFT be systematically extended to the other critical CO₂-brine thermophysical properties where classical correlations have documented, quantified failures — and can the resulting ML property library be formally propagated to yield defensible P10/P50/P90 regulatory storage capacity estimates?

### PhD Deliverables — What Does Not Exist Today

| Paper | Property | Why Classical Model Fails | Data Available |
|---|---|---|---|
| **Paper 2** | Contact angle / wettability | No accepted model exists; prototype uses static assumption | 800–1,100 pts, 14–18 labs |
| **Paper 3** | CO₂ solubility (divalent brines + impure CO₂) | Duan-Sun fails for CaCl₂/MgCl₂ (8–15% error) and CO₂+CH₄ mixtures | 2,800–3,500 pts, 20+ labs |
| **Paper 4** | Brine density (multi-component with dissolved CO₂) | Garcia (2001) NaCl-only; 1–3% error for CaCl₂ brines | 600–900 pts, 8–12 labs |
| **Paper 5** | CO₂ mixture density/viscosity (impure streams) | GERG-2008 fails for SO₂-bearing and ternary streams | 800–1,200 pts (binary) |
| **Paper 6** | Joint uncertainty propagation → storage capacity P10/P50/P90 | Does not exist anywhere; prototype has no end-to-end UQ | Analytical / Monte Carlo |
| **Paper 7** | CarbonLens platform (full ML library deployed) | Prototype uses classical correlations for 4 properties | Software contribution |

### The Gap That Cannot Be Stolen From the Prototype

The prototype uses Duan-Sun, Garcia, and Fenghour — **20-year-old published correlations freely available to anyone**. The PhD replaces them with four new MARS models trained on experimental data that has never been compiled and validated this way. Those models do not exist in the prototype. They cannot be reverse-engineered from the prototype. They require original research.

---

## Section 4: The Two CarbonLens Products

### CarbonLens Dubai Prototype (2026)
```
ML models:        1 (MARS IFT — MSc)
Classical models: 4 (Duan-Sun, Garcia, Fenghour, Span-Wagner)
Uncertainty:      IFT only (applicability domain gate)
Validation:       Sleipner benchmark (partial), SPE11A (partial)
Deployment:       Browser, zero-install, free
```

### CarbonLens PhD Product (2028–2029)
```
ML models:        5 (IFT + contact angle + solubility + brine density + impure CO₂ PVT)
Classical models: 2 retained (Span-Wagner for pure CO₂, Theis for pressure)
Uncertainty:      Joint conformal intervals for all 5 properties → storage capacity P10/P50/P90
Validation:       Sleipner 4D seismic match, Quest MVA data, Johansen benchmark
Deployment:       Browser + cloud compute backend (FastAPI + MRST)
```

### Visual Summary

```
MSc (done):
└── MARS IFT model + CLEV framework
        │
        ▼
Dubai Prototype (2026):
└── MSc IFT model
    + 4 classical correlations (not novel)
    + engineering platform (not thesis IP)
        │
        ▼
PhD (2027–2029):
└── 4 new MARS models (contact angle, solubility, brine density, impure CO₂)
    + joint uncertainty propagation → P10/P50/P90
    + full field validation
        │
        ▼
CarbonLens PhD Product (2029):
└── 5 ML models deployed
    + calibrated end-to-end uncertainty
    + cloud compute backend
    + regulatory compliance (5 jurisdictions, validated)
```

---

## Section 5: One-Paragraph Summary for Supervisor / Examiner

*"My MSc at UTP develops and validates an interpretable MARS model for CO₂-brine interfacial tension prediction using a Cross-Laboratory External Validation framework — demonstrating that test-set performance is an unreliable proxy for field deployability when apparatus bias is present. The Dubai competition prototype (CarbonLens v3) deploys this MSc model alongside classical published correlations for four other thermophysical properties, within a browser-native engineering simulation platform. My PhD extends the CLEV methodology to four properties where those classical correlations have documented quantitative failures: contact angle (no accepted model), CO₂ solubility in divalent brines (Duan-Sun fails at 8–15% error), multi-component brine density (Garcia is NaCl-only), and impure CO₂ stream PVT (GERG-2008 fails for SO₂-bearing streams). The PhD's novel contribution — four new MARS models with calibrated uncertainty propagating jointly to P10/P50/P90 storage capacity estimates — does not exist in the prototype and cannot be derived from it."*

---

*Approved by supervisor: _________________ Date: _________*
