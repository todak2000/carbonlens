# CarbonLens v0.1.0 — Screening-Level CO₂ Storage Assessment

**Browser-native CO₂ storage screening tool** for saline aquifers and depleted gas fields. Zero backend — all physics runs in the browser.

## What it does

- Storage capacity (DOE P10/P50/P90, structural/residual/dissolution/mineral trapping)
- Plume geometry (Buckley-Leverett frontal advance, Hesse gravity currents)
- Pressure front / Area of Review (Theis, Hantush, Nordbotten two-phase composite)
- Geomechanical screening (Hubbert-Willis MAIP, Mohr-Coulomb fault slip, surface heave)
- Impure CO₂ EOS (Peng-Robinson mixing, Span-Wagner pure CO₂)
- Multi-salt solubility (Duan et al. 2006 — Na⁺, K⁺, Ca²⁺, Mg²⁺)
- IFT surrogate (white-box MARS — citable, inspectable coefficients)
- Heterogeneous formation corrections (Shook & Mitchell 2009, Kopp et al. 2010)
- Exportable reports (HTML, executive summary PDF, registry certificates)

## What it does NOT do

- This is **not a regulatory submission tool**. All outputs are screening-level and require independent expert review before regulatory use.
- Does not replace numerical simulation (OPM, ECLIPSE, MRST) for FEED-stage or permit-stage assessment.
- Does not include MARS surrogates for dissolution or fault reactivation (in development for future releases).

## Quick start

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Requires a modern browser (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+).

## Test

```bash
npm test                 # 726 tests across 44 files
npm run test:watch       # watch mode
npm run test:ui          # Vitest UI
```

## Citing

If you use CarbonLens in your research, please cite:

- Paper 1 (IFT MARS surrogate) — DOI when available
- Software: `git tag v0.1.0` (Zenodo DOI when archived)

```bibtex
@software{carbonlens2025,
  author = {Shamsuddin, Muhammad Taufiq and Olagunju, Daniel and {other authors}},
  title = {CarbonLens: Browser-based CO2 storage screening},
  version = {0.1.0},
  year = {2025},
  url = {https://carbonlens.app}
}
```

## License

MIT — see [LICENSE](LICENSE).

## Research context

CarbonLens is developed as part of an MSc research project at Universiti Teknologi PETRONAS. Physics modules are peer-reviewed published correlations. The MARS IFT surrogate has been submitted for publication. The tool is released for community testing and feedback.
