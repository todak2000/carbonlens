# Malay Basin — CO₂ Storage Formation Data
**Country:** Malaysia
**Region:** South China Sea, offshore Peninsular Malaysia
**Relevance:** Direct tie to UTP Malaysia research context; PETRONAS operational domain

## Geological Parameters (for formationPresets.ts)

| Parameter | Value | Source |
|---|---|---|
| Depth to reservoir top | 1,200–1,800 m | Malay Basin studies, PETRONAS reports |
| Reservoir thickness (net) | 30–80 m | Published literature |
| Porosity (mean) | 0.22–0.28 | Sandstone reservoirs, Malay Basin |
| Horizontal permeability | 150–500 mD | Fluvial-deltaic sandstones |
| Reservoir temperature | 65–85°C | Geothermal gradient ~35°C/km |
| Reservoir pressure | 12–18 MPa | Hydrostatic |
| Monovalent salinity | 20,000–40,000 mg/L NaCl | Formation brine data |
| Bivalent salinity | 1,000–3,000 mg/L CaCl₂ | Formation brine data |
| Formation area | 50–200 km² | Prospect-scale estimate |
| Net-to-gross | 0.55–0.75 | Deltaic sequence |
| Caprock | Shale/mudstone, 20–60 m thick | Adequate seal integrity |

## Recommended Preset Values (single representative case)

```typescript
{
  name: "Malay Basin (Malaysia)",
  depth: 1500,           // m
  thickness: 50,         // m net pay
  porosity: 0.25,
  permeability: 250,     // mD
  temperature: 75,       // °C
  pressure: 15,          // MPa
  monovalentSalinity: 30000,  // mg/L
  bivalentSalinity: 2000,
  area: 100,             // km²
  netToGross: 0.65,
  geometryType: "anticline",
  caprockFriction: 30,
  caprockCohesion: 5,
  biotCoefficient: 0.75,
}
```

## Storage Context
- PETRONAS has assessed Malay Basin for CCS feasibility as part of Malaysia's net-zero 2050 commitments
- Proximity to major CO₂ sources: Kasawari gas field (~100 km), refinery emissions onshore
- Regulatory framework: Malaysia PETRONAS Technical Standards (already in CarbonLens jurisdiction panel)

## Key References
- PETRONAS Annual Reports (2022, 2023) — CCS roadmap for Malaysia
- Bahari et al. (2011) — "CO₂ storage potential in Malay Basin"
- IEA (2023) — Southeast Asia Energy Outlook
