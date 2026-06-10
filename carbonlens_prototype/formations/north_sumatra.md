# North Sumatra Basin — CO₂ Storage Formation Data
**Country:** Indonesia
**Region:** Northern Sumatra, onshore/shallow offshore
**Relevance:** Indonesia is the largest CO₂ emitter in Southeast Asia; government has committed to CCS under Just Energy Transition Partnership

## Geological Parameters (for formationPresets.ts)

| Parameter | Value | Source |
|---|---|---|
| Depth to reservoir top | 1,000–2,200 m | Deep saline aquifer targets |
| Reservoir thickness (net) | 25–70 m | Carbonate and sandstone intervals |
| Porosity (mean) | 0.18–0.26 | Mixed carbonate-clastic |
| Horizontal permeability | 80–400 mD | Moderate-good reservoir quality |
| Reservoir temperature | 60–95°C | Geothermal gradient ~35–45°C/km (volcanically influenced) |
| Reservoir pressure | 10–22 MPa | |
| Monovalent salinity | 25,000–60,000 mg/L NaCl | Deep brines |
| Bivalent salinity | 1,500–4,000 mg/L CaCl₂ | |
| Formation area | 80–300 km² | |
| Net-to-gross | 0.45–0.65 | |
| Caprock | Interbedded mudstone/shale sequences |

## Recommended Preset Values (single representative case)

```typescript
{
  name: "North Sumatra Basin (Indonesia)",
  depth: 1600,           // m
  thickness: 45,         // m
  porosity: 0.22,
  permeability: 200,     // mD
  temperature: 78,       // °C
  pressure: 16,          // MPa
  monovalentSalinity: 40000,
  bivalentSalinity: 2500,
  area: 150,             // km²
  netToGross: 0.55,
  geometryType: "anticline",
  caprockFriction: 28,
  caprockCohesion: 4.5,
  biotCoefficient: 0.78,
}
```

## Storage Context
- Indonesia's CCS Law (Peraturan Pemerintah No. 2/2023) mandates CCS for oil & gas operations
- SKK Migas (upstream regulator) has identified North Sumatra as priority CCS basin
- Proximity to Pertamina refineries and geothermal plants = large CO₂ point sources nearby
- Under-resourced in terms of accessible screening tools — universities lack CMG/Petrel licenses

## Key References
- IEA (2023) — Indonesia CCS Readiness Assessment
- Prasetyo et al. (2022) — "CO₂ geological storage potential in Indonesia"
- SKK Migas CCS regulatory framework documentation
- IESR (Institute for Essential Services Reform) Indonesia energy reports
