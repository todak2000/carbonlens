# Niger Delta Basin — CO₂ Storage Formation Data
**Country:** Nigeria
**Region:** Onshore/shallow offshore, Niger Delta
**Relevance:** Daniel's FutuX Nigeria context; largest African CO₂ storage potential; high-impact narrative

## Geological Parameters (for formationPresets.ts)

| Parameter | Value | Source |
|---|---|---|
| Depth to reservoir top | 800–2,500 m | Deep saline aquifers below producing horizons |
| Reservoir thickness (net) | 20–100 m | Agbada Formation sandstones |
| Porosity (mean) | 0.28–0.35 | High-porosity deltaic sands |
| Horizontal permeability | 500–2,000 mD | Excellent reservoir quality |
| Reservoir temperature | 55–95°C | Geothermal gradient ~30°C/km |
| Reservoir pressure | 8–25 MPa | Depth dependent |
| Monovalent salinity | 15,000–50,000 mg/L NaCl | Variable; deep brines higher |
| Bivalent salinity | 500–2,500 mg/L CaCl₂ | |
| Formation area | 100–500 km² | Basin-scale saline aquifer |
| Net-to-gross | 0.60–0.85 | Clean fluvial-deltaic sands |
| Caprock | Akata Formation shale — regionally extensive, excellent seal |

## Recommended Preset Values (single representative case)

```typescript
{
  name: "Niger Delta Basin (Nigeria)",
  depth: 1800,           // m
  thickness: 60,         // m net pay
  porosity: 0.30,
  permeability: 800,     // mD
  temperature: 80,       // °C
  pressure: 18,          // MPa
  monovalentSalinity: 35000,  // mg/L
  bivalentSalinity: 1500,
  area: 200,             // km²
  netToGross: 0.72,
  geometryType: "dome",
  caprockFriction: 25,
  caprockCohesion: 4,
  biotCoefficient: 0.80,
}
```

## Storage Context
- Nigeria is the largest CO₂ emitter in sub-Saharan Africa (gas flaring + LNG + refining)
- NUPRC (formerly DPR) has no affordable screening tool for CCS site assessment
- Akata Formation shale provides one of the most regionally extensive caprocks in Africa
- High permeability and porosity = large injectivity — ideal for industrial-scale CCS
- Direct link to gas flaring reduction policy: Nigeria FLARE OUT programme

## Impact Narrative for Application
Nigeria flares approximately 7 billion cubic metres of gas per year — the equivalent of ~15 Mt CO₂. The Niger Delta has identified saline aquifer capacity potentially exceeding 5 Gt CO₂ (published IEA estimates). No Nigerian regulator currently has a tool to screen or assess this capacity. CarbonLens changes that.

## Key References
- Abe et al. (2019) — "CO₂ storage potential in the Niger Delta"
- IEA Africa Energy Outlook (2022)
- NUPRC / DPR Nigeria regulatory documentation
- Ogbe et al. (2014) — Niger Delta reservoir characterisation
