# Rotterdam / North Sea (Porthos) — CO₂ Storage Formation Data
**Country:** Netherlands / North Sea (EU jurisdiction)
**Region:** Offshore Rotterdam, P/Rijnmond area, North Sea
**Relevance:** Porthos is the EU's flagship CCS project — first industrial-scale CCS in continental Europe to reach Final Investment Decision (2023). Shell, ExxonMobil, Air Liquide, and Air Products are injecting CO₂ from Rotterdam's industrial cluster.

## Why This Formation Matters for the Competition

Porthos is the most actively discussed CCS project in European policy circles right now. It received its FID in 2023, construction is underway, and first injection is targeted for 2026. Any CCS tool that doesn't include a Rotterdam/North Sea preset will look dated to a European judge. Including it signals that CarbonLens tracks current, live projects — not just academic case studies.

## Geological Parameters (for formationPresets.ts)

| Parameter | Value | Source |
|---|---|---|
| Target formation | P/Rijnmond offshore saline aquifer (Lower Triassic Bunter Sandstone equivalent) | Porthos EIA, TNO reports |
| Depth to reservoir top | 2,900–3,200 m | Porthos injection target |
| Reservoir thickness (net) | 40–100 m | Bunter Sandstone |
| Porosity (mean) | 0.18–0.26 | Good quality sandstone |
| Horizontal permeability | 50–200 mD | Moderate — consistent with Bunter |
| Reservoir temperature | 100–115°C | Deep North Sea gradient |
| Reservoir pressure | 29–32 MPa | Near-hydrostatic, deep |
| Monovalent salinity | 150,000–250,000 mg/L NaCl | Very high salinity North Sea brines |
| Bivalent salinity | 8,000–18,000 mg/L CaCl₂ | |
| Formation area | 150–600 km² | Porthos injection area |
| Net-to-gross | 0.55–0.75 | |
| Caprock | Röt Formation mudstone/anhydrite — regionally extensive, well-characterised |

## Recommended Preset Values (single representative case)

```typescript
{
  name: "Rotterdam / North Sea (Netherlands)",
  depth: 3100,           // m — Porthos injection depth
  thickness: 65,         // m net
  porosity: 0.22,
  permeability: 120,     // mD
  temperature: 108,      // °C
  pressure: 31,          // MPa
  monovalentSalinity: 200000,  // mg/L — very high salinity
  bivalentSalinity: 14000,
  area: 300,             // km²
  netToGross: 0.65,
  geometryType: "layered",
  caprockFriction: 32,
  caprockCohesion: 7,
  biotCoefficient: 0.73,
}
```

## Storage Context
- Porthos (Port of Rotterdam CO₂ Transport Hub and Offshore Storage) — operational 2026
- Capacity: ~37 Mt CO₂ over 15 years from Shell, ExxonMobil, Air Liquide, Air Products
- Regulated under EU CCS Directive (already in CarbonLens jurisdiction panel — perfect alignment)
- The Netherlands government has committed €2.1 billion in CCS infrastructure
- Porthos is explicitly cited in EU Green Deal and Fit for 55 documentation

## Competition Talking Point
"The Porthos project in Rotterdam — Europe's most high-profile CCS initiative — uses geology similar to what CarbonLens screens. A Dutch university student or a Rotterdam port operator can evaluate the same type of formation in their browser today."

## Key References
- Porthos EIA documentation (2021) — publically available
- TNO (2020) — "CO₂ storage potential, Netherlands North Sea"
- EU CCS Directive (2009/31/EC) — storage permit framework
- Neele et al. (2019) — "Porthos CCS project development"
- IEAGHG (2022) — European CCS project portfolio review
