# CarbonLens — Prototypes for Humanity 2026
## Competition Prototype Plan

**Competition:** Dubai Future Solutions — Prototypes for Humanity 2026
**Venue:** Dubai Future Forum, Dubai — November 15–19, 2026
**Award Fund:** $100,000
**Final Submission Deadline:** August 1, 2026
**Submitting:** Daniel T. Olagunju, MSc Researcher, Universiti Teknologi PETRONAS (UTP)
**Supervisor:** [Supervisor name to be confirmed on application form]

---

## The Core Reframe

CarbonLens is not being presented as a CCS engineering suite.
It is being presented as a **democratisation tool** — making rigorous geological CO₂ storage screening accessible to universities, regulators, and operators across the Global South who cannot afford enterprise software.

### The Headline

> "The most rigorous CO₂ storage screening tools cost $160,000–$230,000 per year and require weeks of specialist training. CarbonLens removes that barrier — a peer-validated, ML-powered simulator that runs in any browser, free, available to every geologist, regulator, and researcher who needs it."

**Note on framing:** Do NOT position this as a "Global South tool" or a charity product. The access story is universal — Shell engineers, Malaysian regulators, Norwegian researchers, Nigerian geologists, and Dutch operators all benefit equally from zero-cost, zero-install access to rigorous CCS simulation. The impact on resource-constrained institutions is a consequence of good design, not the stated purpose.

---

## Judging Criteria Mapping

| Criterion | How CarbonLens answers it |
|---|---|
| **Positive impact on people, communities, or the planet** | Developing nations locked out of CCS infrastructure = climate impact at scale. Opens access to 50+ countries with identified storage geology but no affordable tools. |
| **Application of technology** | MARS ML model (trained on CO₂-brine experimental data from UTP research) + multi-physics simulation engine + 3D interactive visualisation, running entirely in a browser at zero installation cost. |
| **Academic rigour** | Validated against Sleipner CO₂ injection field data and SPE11A benchmark. All correlations cite peer-reviewed literature (Span-Wagner 1996, Duan-Sun 2003, Fenghour 1998, Theis 1935, Brooks-Corey, Land 1968, Mohr-Coulomb). MARS model derived from published MSc research at UTP Malaysia. |

---

## Application Narrative (Competition Form Answers)

### What is the problem?
Geological carbon capture and storage (CCS) is essential to meeting global net-zero targets, yet the tools required to screen and assess CO₂ storage sites cost $160,000–$230,000 per year in software licenses. This locks out universities, government regulators, and small operators across the developing world — precisely the regions with the greatest underdeveloped storage potential and the greatest need for affordable decarbonisation pathways.

### How are existing solutions failing?
CMG-GEM, Petrel, and ECLIPSE require institutional procurement, dedicated workstations, specialist training, and multi-year licensing agreements. Open-source alternatives (TOUGH2, MRST) require advanced programming skills and weeks of setup. Nothing affordable, accurate, and immediately usable exists for a regulator in Malaysia, Nigeria, or Egypt who needs to evaluate a formation today.

### What is your alternative solution?
CarbonLens is a browser-native CO₂ storage simulation studio that runs on any device with no installation, no license fee, and no specialist software training required. It implements peer-reviewed physics models (Span-Wagner EOS, Duan-Sun solubility, Theis pressure model, Brooks-Corey relative permeability) and an ML-based fluid property engine developed from CO₂-brine experimental research at Universiti Teknologi PETRONAS, validated against the Sleipner CO₂ injection field dataset and the SPE11A benchmark.

### How does it perform better?
A screening workflow that takes 4–6 weeks using enterprise software can be completed in under an hour with CarbonLens. The tool produces equivalent accuracy on storage capacity estimation (P10/P50/P90), geomechanical safety assessment, and regulatory permit documentation — at zero marginal cost per user.

### What is the impact?
CarbonLens directly enables the 50+ developing nations with identified CO₂ storage geology but no affordable assessment capability to participate in the global CCS buildout. Commercially, it creates a pathway for the $2.5 trillion CCS infrastructure market to expand beyond Western basins. Academically, it makes rigorous CCS methodology accessible to research groups without enterprise software budgets.

---

## Priority Build Recommendations

Ranked by competition impact. Do not add new physics — the engine is already rigorous. The gap is framing, narrative, and polish.

---

### Priority 1 — New Formation Presets (Global Coverage)
**Effort:** 3–5 days | **Impact:** High — directly supports the democratisation narrative AND covers key audience regions

Add 7 new formation presets alongside the existing 8 (Sleipner, Mount Simon, Johansen, Gorgon, Snøhvit, In Salah, Kasawari, Otway), bringing the total to 15:

**Global South — democratisation narrative:**

| Formation | Country | Why it matters |
|---|---|---|
| Malay Basin | Malaysia | Tied directly to UTP research context |
| Niger Delta Basin | Nigeria | Largest African storage potential; community impact narrative |
| North Sumatra Basin | Indonesia | Largest SE Asia developing-world CO₂ storage potential |
| Nile Delta | Egypt | Gulf-adjacent, politically resonant for Dubai audience |

**Middle East, Europe, Americas — cover the deep-pocket markets:**

| Formation | Country | Why it matters |
|---|---|---|
| Abu Dhabi Basin | UAE | Al Reyadah CCS project; ADNOC; judges are literally from here |
| Rotterdam / North Sea | Netherlands | Porthos — EU's flagship live CCS project, FID 2023 |
| Alberta Basin | Canada | Quest CCS (ADNOC co-owned); most-published MVA data in Americas |

**Strategic note:** The UAE preset is highest priority within this group. Having Abu Dhabi geology in the tool is a direct conversation opener with the most powerful people in that room. The Alberta–Abu Dhabi link (ADNOC co-owns Quest) is a compelling narrative thread connecting Middle East and Americas presets.

Geological parameters for each formation documented in `formations/` folder and added to `src/data/formationPresets.ts`.

---

### Priority 2 — Impact Onboarding Screen
**Effort:** 3–4 days | **Impact:** High — first impression for judges

Replace or supplement the current entry screen with a screen that communicates the problem before the user touches the tool:

- World map (SVG) highlighting CO₂ storage potential hotspots in the Global South
- Hard statistic displayed prominently: "Enterprise CCS screening: $160K–$230K/year. CarbonLens: $0."
- Brief 2-line problem statement
- Single CTA: "Screen a Formation →"

This is what a Dubai exhibition judge sees in the first 10 seconds.

---

### Priority 3 — Executive Summary PDF Export
**Effort:** 4–5 days | **Impact:** High — what gets shown to ministers and investors

A single-page decision-maker report, separate from the technical permit template. Designed for a government official or investor, not a reservoir engineer. Contents:

- Site name and country
- Screening verdict: **VIABLE** / **NEEDS FURTHER STUDY** / **NOT RECOMMENDED**
- Storage capacity estimate (P10/P50/P90 in Mt CO₂)
- Safety rating (caprock integrity, geomechanical risk level)
- Top 3 recommendations
- Generated by CarbonLens — citing UTP Malaysia research

Use existing jsPDF infrastructure. This is template and layout work.

---

### Priority 4 — Demo Mode / Auto-Play
**Effort:** 2–3 days | **Impact:** Medium-High — exhibition stand runs unattended

Build a `Demo Mode` that:
- Auto-loads the Malay Basin or Sleipner preset
- Runs the simulation without user input
- Cycles through: 3D plume animation → geomechanics panel → executive summary export
- Displays large-text overlay: "Real geological data. Real physics. Running in your browser."

The 3D CO₂ plume animation is the strongest visual asset. It must be front and centre at the stand.

---

### Priority 5 — Methodology & Academic Rigour Panel Strengthening
**Effort:** 1–2 days | **Impact:** Medium — directly scores the academic rigour criterion

Update the existing methodology panel to include:
- Explicit citation: "ML model developed from peer-reviewed CO₂-brine experimental research at Universiti Teknologi PETRONAS, Malaysia"
- Validation summary: Sleipner match statistics, SPE11A benchmark comparison
- Clear statement of prototype scope vs. full production system
- Full reference list (Span-Wagner 1996, Duan-Sun 2003, Fenghour 1998, Land 1968, etc.)

---

### Priority 6 — Live Deployment to Clean URL
**Effort:** 1 day | **Impact:** Essential — judges need a live link

Deploy to a clean, accessible URL (not a raw GitHub Pages path). Options:
- Custom domain: `carbonlens.app` or `demo.carbonlens.io`
- Vercel deployment with clean URL
- Must be live, stable, and fast-loading before application submission

---

## What NOT to Change

- Core physics engine — already rigorous and validated
- Multi-jurisdiction permit export system — genuinely differentiating
- History matching module — demonstrates academic depth
- 3D visualisation architecture — keep, polish only
- Zustand state management — working well

**Do not add new physics features.** Judges are not reservoir engineers. Depth of feature set does not win this competition. Clarity of impact and accessibility of the tool does.

---

## Build Timeline

| Week | Dates | Focus |
|---|---|---|
| 1 | Jun 9–15 | Global South formation presets (geological data research + implementation) |
| 2 | Jun 16–22 | Impact onboarding screen + Executive Summary PDF template |
| 3 | Jun 23–29 | Demo mode + 3D viewer polish + methodology panel update |
| 4 | Jun 30–Jul 6 | Full end-to-end test pass + live deployment to clean URL |
| 5 | Jul 7–13 | Application writing, screenshots, system architecture diagram, video demo |
| 6 | Jul 14–20 | Application review with supervisor, final edits |
| 7 | Jul 21–Aug 1 | Final submission buffer + submit |

---

## Application Materials Checklist

- [ ] Application form submitted at prototypesforhumanity.com
- [ ] Supervisor details confirmed and included
- [ ] High-resolution screenshots of: onboarding screen, 3D plume viewer, geomechanics panel, executive summary PDF output
- [ ] System architecture diagram (clear, well-labelled)
- [ ] Short demo video (2–3 min) uploaded to YouTube — showing: problem statement → formation input → simulation run → 3D animation → executive summary export
- [ ] Detailed project PDF: research context, methodology, development process, outcomes
- [ ] Live prototype URL included in application

---

## Folder Structure

```
carbonlens_prototype/
├── PLAN.md                          ← This file
├── formations/                      ← Geological data research for new presets
│   ├── malay_basin.md
│   ├── niger_delta.md
│   ├── north_sumatra.md
│   └── nile_delta.md
├── design/                          ← UI mockups, diagrams, visual assets
│   ├── onboarding_screen.md
│   ├── executive_summary_template.md
│   └── architecture_diagram.md
├── application/                     ← Competition application drafts
│   ├── application_form_answers.md
│   ├── project_pdf_draft.md
│   └── video_script.md
└── src/                             ← New code lives here (built on v3 base)
```

---

## Key References to Cite in Application

- Span & Wagner (1996) — CO₂ equation of state
- Duan & Sun (2003) — CO₂ solubility in brine
- Fenghour et al. (1998) — CO₂ viscosity
- Land (1968) — residual trapping model
- Theis (1935) — transient radial flow (pressure model)
- Brooks & Corey (1964) — relative permeability
- Biot (1941) — poroelastic coupling
- IEA (2023) — CCS technology deployment status
- IPCC AR6 (2022) — CCS role in net-zero pathways
- Bachu (2003) — CO₂ storage capacity assessment methodology
- Chadwick et al. (2004) — Sleipner CO₂ storage monitoring
- Daniel T. Olagunju et al. (UTP MSc research) — MARS ML model for CO₂-brine IFT

---

*Last updated: 2026-06-09*
