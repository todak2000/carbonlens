# Impact Onboarding Screen — Design Specification

This screen replaces or precedes the current login/entry screen.
Its job: communicate the problem and the solution in under 10 seconds.

---

## Layout

### Full-screen, dark background (matches existing dark theme)

---

### Top Section — Problem Statement

```
[ Large display text ]

"CCS screening software costs $200,000/year."
"Most of the world can't afford it."

[ Sub-text, smaller ]
"50+ countries have the geology to store CO₂.
 Almost none have the tools to assess it."
```

---

### Centre Section — World Map

- SVG world map
- Colour coding:
  - **Dark green dots** = countries with identified CO₂ storage geology (Nigeria, Indonesia, Malaysia, Egypt, Kenya, India, Brazil, etc.)
  - **Bright accent dots** = countries with affordable screening tools today (Norway, USA, Australia, UK, Netherlands) — this should be visibly few
- Label: "CO₂ storage potential vs. accessible screening tools"
- This visual makes the access gap immediately visible without a word of explanation

---

### Lower Section — CTA

```
[ Prominent stat block ]
Enterprise CCS screening: $160,000–$230,000 / year
CarbonLens: $0

[ Primary CTA button — large ]
→  Screen a Formation
```

---

### Footer

```
Developed at Universiti Teknologi PETRONAS, Malaysia
Built on peer-reviewed research | Validated against Sleipner field data
```

---

## Implementation Notes

- World map: use a simple SVG (Natural Earth projection) — no external map library needed
- Dots can be hardcoded as SVG circles at lat/lon coordinates
- Animation: dots pulse gently on load (CSS keyframes)
- The "Screen a Formation" button navigates to the main app (skips login for demo mode)
- On mobile: collapse to stacked layout, remove map, keep stat block and CTA

---

## Tone

- Not a sales pitch
- Matter-of-fact, data-driven
- The map does the emotional work — text stays factual
