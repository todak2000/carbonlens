# CarbonLens Storage Studio — PoC Implementation Roadmap
**POC EDITION · V3.2 · CONFIDENTIAL**

> 7-Week Build. Week 5: Live Demo. Week 7: First Design Partners.

*Daniel T. Olagunju — Co-Founder & CPO, CarbonLens*
*MSc Researcher, Universiti Teknologi PETRONAS*
*May 2026*

---

## What You Already Have (Head Start)

| Asset | Status | Impact |
|-------|--------|--------|
| **MARS IFT equation as JSON** | ✅ Done | Weeks 1–2 eliminated. MARS extraction → TypeScript in hours instead of days. |
| **3000+ IFT dataset** | ✅ Ready | Augments GMDH/MGGP training. Stronger ensemble. |
| **Sleipner/Decatur/Otway parameters** | ✅ From research | Presets ready — no data gathering needed. |
| **CCUS consulting firm target list** | ✅ Researched | 10 firms with Class VI experience identified. |
| **PETRONAS CCS intelligence** | ✅ Researched | Contacts, regulations, market data all compiled. |
| **EPA Class VI guidance links** | ✅ Provided | 9 official PDFs — no searching needed. |
| **Malaysian CCUS legal framework** | ✅ Researched | Dossier structure, permit modules, licensing regime. |

---

## What Changes vs. Earlier Plans

| Decision | Old Plan | New Plan (V3.2) | Why |
|----------|----------|-----------------|-----|
| **Hosting** | Cloudflare Pages + KV + Workers | **Firebase** (Hosting + Auth + Firestore + Functions) | One platform. Auth + DB + serverless. Free tier sufficient. |
| **Billing** | Stripe integration | **Simulated** (localStorage flag) | PoC validates conversion intent without payment infra. Stripe post-PoC. |
| **ML Models** | Train all from scratch | **Only IFT needs ML** — 6 others are classical | MARS already done. Others are published correlations. |
| **Customer discovery** | You provide contacts | **I researched 10 firms** + PETRONAS ecosystem | Target list ready to use. |
| **Formation data** | You provide | **Already compiled** from research | Sleipner/Decatur/Otway param tables ready. |

---

## 7-Week Build Plan

### Week 1 — Environment + Classical Models + IFT Extraction
*7 hrs*

| Task | Type | Notes |
|------|------|-------|
| Set up Firebase project: Hosting, Auth, Firestore, Functions (all free tier) | Infra | firebase.google.com. Create project, enable services. |
| Implement Span-Wagner EOS in Python → TypeScript | Code | CO₂ density. Validate against CoolProp/NIST within 0.1%. Published 1996 — well-established. |
| Implement Fenghour CO₂ viscosity in TypeScript | Code | Published 1998. Implement directly — no ML needed. |
| Implement Duan-Sun CO₂ solubility in TypeScript | Code | ~200 lines. Published 2003. Industry standard. |
| Implement Garcia (2001) brine density + diffusion coefficient in TypeScript | Code | Simple polynomials. Trivial implementation. |
| **Transcribe your MARS JSON equation to TypeScript** | Code | `predictIFT_mars(T, P, S)` → returns P50. Your existing JSON is the equation. |
| Scaffold Vite + React + TypeScript + Tailwind | Code | `npm create vite@latest --template react-ts`. Install three, d3, zustand, firebase. |
| Define Zustand store schema | Code | Reservoir params, well positions, simulation state, jurisdiction, user tier. |

### Week 2 — 3D Reservoir Builder + Presets + Save/Load
*7 hrs*

| Task | Type | Notes |
|------|------|-------|
| Build Three.js reservoir renderer (BoxGeometry, layered materials, OrbitControls) | Code | Formation renders live from Zustand parameters |
| Implement Sleipner preset JSON | Code | All Utsira Sand params from compiled research data |
| Implement Decatur preset JSON | Code | Mt. Simon Sandstone params from compiled data |
| Implement Otway preset JSON | Code | Waarre C Sandstone params from compiled data |
| One-click preset loader | Code | Populates all inputs. Citation badge in UI. |
| Anticline / dome / layered aquifer geometry | Code | Three geometry types selectable, renders live |
| Well placement raycaster (click on 3D surface → place well) | Code | Up to 5 wells. CylinderGeometry. |
| JSON save/load (export/import .carbonlens file) | Code | Zustand store serialization. Round-trip tested. |
| Firebase Auth (email/password + Google) | Code | Sign-up -> login -> user ID for cloud saves |

### Week 3 — Simulation Engine + Property Dashboard + 2D View
*7 hrs*

| Task | Type | Notes |
|------|------|-------|
| Build Web Worker simulation engine | Code | 50×50 grid. Simplified Darcy flow. No ML yet — placeholder physics first. |
| Wire saturation arrays to Three.js vertex colour updates | Code | 0% = formation colour → 100% = red (Viridis colormap) |
| Build D3.js 2D cross-section view | Code | Colour-mapped SVG grid, caprock line, well symbol, plume |
| Playback controls (Play/Pause/Reset, timestep slider, years) | Code | Scrub through 10/20/50 year snapshots |
| Build property dashboard panel | Code | IBM Plex Mono readouts. All 7 properties. P50 value displayed. |
| **Wire MARS IFT equation to property dashboard** | Code | Live updates as T/P/salinity change. Confirm <0.5% deviation from Python. |
| Wire classical correlations (Density, Viscosity, Solubility, Brine Density, Phase) | Code | All 6 implemented in Week 1 — now connected to UI. |
| Wire all 7 properties to simulation engine (replace placeholders) | Code | Simulation now driven by real ML + classical properties |

### Week 4 — P0: Cloud Saves + P10/P50/P90 + Geomechanics + Jurisdiction
*7 hrs*

| Task | Type | Notes |
|------|------|-------|
| Firestore cloud save integration | Code | Zustand state → Firestore doc keyed to user ID. Save/load from any device. |
| P10/P50/P90 bootstrap bounds implementation | Code | Bootstrap from your 3000+ IFT dataset → hardcoded percentile arrays in TypeScript. |
| P10/P50/P90 plume envelope rendering | Code | Three overlaid contours: blue (P10) / teal (P50) / amber (P90) |
| Uncertainty sigma slider | Code | Widens/narrows P10/P90 envelopes. Maps to formation data quality. |
| Implement geomechanical tab | Code | σv (integrated density), Eaton σh, FPG, MAIP (FPG × depth × 0.9) |
| Wire caprock seal index to live IFT output | Code | CO₂ column height = (2γcosθ)/(rρg). Updates as IFT changes. **No other web tool does this.** |
| Jurisdiction toggle dropdown | Code | EPA / UK NSTA / Norwegian NPD / PETRONAS Malaysia |
| Jurisdiction-specific permit export (PDF) | Code | Templates match each framework. Unit systems, labels, structure all change with toggle. |
| PETRONAS Malaysia-specific template | Code | Based on CCUS Act 2025 module structure: (1) Admin, (2) Site ID, (3) Engineering Plan, (4) 4 Annexed Blueprints, (5) Risk + Financial Security |

### Week 5 — P0: Deploy Live + Onboarding + Simulated Billing + GTM Assets
*7 hrs*

| Task | Type | Notes |
|------|------|-------|
| Deploy to Firebase Hosting with custom domain | Infra | Global CDN. Auto HTTPS. Zero server config. |
| Build onboarding tutorial | Code | 6-step guided sequence: loads Sleipner, explains params, places well, runs sim, exports |
| Implement simulated billing | Code | localStorage flags: Free / Researcher ($49) / Professional ($799). "Subscribe" button sets flag. No real payment. |
| Tier gating | Code | 3D simulation → Pro. Permit export → Researcher+. Cloud save → Researcher+. Free: 2D + 3 presets + JSON save only. |
| Write technical white paper draft | Write | 15 pages: methodology, validation, Sleipner benchmark, comparison to Li et al. + published data |
| Create download landing page | Code | White paper gate behind email capture |
| **Deploy live — carbonlens-studio.web.app or custom domain** | Milestone | Shareable link ready for outreach |

> **Week 5 Milestone: carbonlens-studio.web.app is LIVE**
> Working 3D reservoir builder. 3 presets. All 7 properties. P10/P50/P90. Geomechanics. 4 jurisdictions. Permit export. Cloud saves. Simulated billing.

### Week 6 — GTM: Outreach + White Paper Publication
*7 hrs*

| Task | Type | Notes |
|------|------|-------|
| Publish white paper. Gate behind email. Post on LinkedIn. | Biz | Downloadable PDF. Post link in CCUS engineering groups. |
| Send 20 personalised cold emails to consulting firms | Biz | Target list: Numeric Solutions, Ridgeline, Tetra Tech, SCS, Burns & McDonnell, Upstream EP, Graves, EXP |
| Email 3 UTP faculty: "Free Studio access in exchange for Sleipner validation feedback" | Biz | Academic citation pipeline |
| Email PETRONAS CCS contacts: Emry Hisham Yusoff, Nora'in Md Salleh | Biz | "Web tool with PETRONAS jurisdiction template. Would your team pilot it for Duyong or Kasawari screening?" |
| Post 60-second LinkedIn video: Sleipner preset → plume simulation → toggle jurisdiction → export permit PDF | Biz | Target: CCUS engineering groups, SPE LinkedIn community |
| Prepare SPE abstract submission | Write | "CarbonLens Storage Studio: Browser-Based ML-Powered CO₂ Storage Simulation" |

### Week 7 — Iterate + Convert + Validate
*7 hrs*

| Task | Type | Notes |
|------|------|-------|
| Follow up with all outreach contacts | Biz | Direct demo link. Offer free Professional access. |
| Collect feedback from design partners | Biz | What's missing? What breaks? What would they pay for? |
| Fix 5 highest-priority bugs/issues | Code | From early user feedback |
| Submit paper to JPSE or IJGGC | Write | Methods section cites CarbonLens. |
| Submit SPE abstract | Write | Conference submission deadline permitting |
| Update white paper with user feedback | Write | Second edition — incorporate validation comments |

---

## Final Architecture

```
┌──────────────────────────────────────────────────────┐
│                 Firebase Hosting                       │
│              carbonlens-studio.web.app                  │
├──────────────────────────────────────────────────────┤
│                    Browser                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  Three.js 3D │ │  D3.js 2D   │ │  Web Worker  │  │
│  │  Reservoir   │ │  Cross-sec. │ │  Simulation  │  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
│  ┌──────────────────────────────────────────────────┐ │
│  │           ML Property Engine (TS)                │ │
│  │  ┌─────────┐ ┌────────┐ ┌────────────────────┐  │ │
│  │  │Classical│ │MARS IFT│ │Firebase Function   │  │ │
│  │  │Correlat.│ │(from   │ │(protected ensemble │  │ │
│  │  │(client) │ │JSON)   │ │weights → P10/P90)  │  │ │
│  │  └─────────┘ └────────┘ └────────────────────┘  │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  Zustand     │ │Geomechanical│ │ Jurisdiction │  │ │
│  │  State Mgmt  │ │  Module     │ │   Toggle     │  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
├──────────────────────────────────────────────────────┤
│              Firebase Backend                          │
│  ┌──────────┐ ┌────────────┐ ┌──────────────────┐   │
│  │ Auth     │ │  Firestore │ │  Functions       │    │
│  │(email/   │ │ (cloud     │ │  (ensemble       │    │
│  │ Google)  │ │  saves)    │ │   endpoint)      │    │
│  └──────────┘ └────────────┘ └──────────────────┘   │
├──────────────────────────────────────────────────────┤
│         Billing: Simulated (localStorage)             │
│  Free (Explorer) → Researcher ($49) → Pro ($799)     │
└──────────────────────────────────────────────────────┘
```

---

## Tech Stack Summary

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Framework | Vite + React | Latest | Fast builds, pure static output, TypeScript-native |
| 3D Rendering | Three.js | r160+ | Industry standard. Scientific 3D. Large ecosystem. |
| 2D Viz | D3.js | v7 | Pixel-level control for scientific plots. |
| State Mgmt | Zustand | v5 | Lightweight. TS-native. Works with Three.js. |
| Styling | Tailwind CSS | v4 | Utility-first. Design tokens. Fast iteration. |
| Hosting | Firebase Hosting | Free tier | Auth + DB + serverless in one platform. |
| Auth | Firebase Auth | Free | Email/password + Google. User ID for cloud saves. |
| Database | Firestore | Free tier | 1 GiB stored, 50K reads/day. Cloud saves. |
| Functions | Firebase Functions | Free | ML ensemble weight endpoint. 2M invocations/month. |
| Billing | Simulated | localStorage | No real payment. State per user. Stripe post-PoC. |

**Zero monthly cost until you exceed Firebase free tier limits.** At PoC scale, that's not happening.

---

## What I Need From You — Deliverables Checklist

| # | Item | Format | By When |
|---|------|--------|---------|
| 1 | **MARS IFT equation JSON file** | JSON attached or linked | **Now** — determines start date |
| 2 | **IFT dataset** (3000+ rows) | CSV | Week 1 (for GMDH/MGGP training) |
| 3 | **Firebase account** | firebase.google.com — free tier | Week 1 (I'll guide setup) |
| 4 | **Domain choice** (or use firebase subdomain) | Confirm or skip | Week 0 |
| 5 | **Read EPA guidance docs #1–3** | epa.gov/uic PDFs | Week 1 (you verify permit accuracy) |
| 6 | **Review Sleipner/Decatur/Otway presets** | I'll share draft JSON | Week 2 (you confirm accuracy) |
| 7 | **Write white paper text** | Google Doc — I'll scaffold | Weeks 5–6 (you know the science) |
| 8 | **Cold email drafts review** | I'll draft — you approve | Week 6 (your name, your network) |

**You own:** MARS model, IFT data, domain, EPA guidance review, white paper, email approval.

**I own:** All code (frontend, simulation, geomechanics, jurisdiction, export), Firebase setup, equation extraction, ML training (GMDH/MGGP), deployment, outreach draft, formation presets.

---

## Key Design Decisions for You to Confirm

1. **Name:** "CarbonLens Storage Studio" — confirm?
2. **Pricing:** Free / Researcher $49/mo / Professional $799/mo — reasonable?
3. **PETRONAS template accuracy:** I built the template from the CCUS Act 2025 framework you shared. Review when live.
4. **Hosting:** Firebase (not GitHub Pages, not Cloudflare) — agree?
5. **Billing:** Simulated localStorage for PoC (no Stripe) — agree?
6. **Formation presets:** Sleipner (Norway), Decatur (US), Otway (Australia) — any others needed?

---

*CARBONLENS PoC ROADMAP v3.2 · Confidential — Not for distribution*
