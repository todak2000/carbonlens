# Nile Delta — CO₂ Storage Formation Data
**Country:** Egypt
**Region:** Northern Egypt, Mediterranean offshore / onshore delta
**Relevance:** Largest North African storage potential; Gulf-adjacent; politically resonant for Dubai audience; Egypt COP27 host

## Geological Parameters (for formationPresets.ts)

| Parameter | Value | Source |
|---|---|---|
| Depth to reservoir top | 1,500–3,000 m | Deep saline aquifer and depleted gas field targets |
| Reservoir thickness (net) | 30–120 m | Miocene-Pliocene sandstones |
| Porosity (mean) | 0.20–0.30 | Good reservoir quality |
| Horizontal permeability | 100–600 mD | Variable — channel sands highest |
| Reservoir temperature | 70–110°C | |
| Reservoir pressure | 15–30 MPa | |
| Monovalent salinity | 40,000–100,000 mg/L NaCl | High-salinity deep brines |
| Bivalent salinity | 2,000–6,000 mg/L CaCl₂ | |
| Formation area | 200–1,000 km² | Basin-scale aquifer |
| Net-to-gross | 0.50–0.75 | |
| Caprock | Messinian evaporites (anhydrite/salt) — exceptional seal quality |

## Recommended Preset Values (single representative case)

```typescript
{
  name: "Nile Delta (Egypt)",
  depth: 2200,           // m
  thickness: 70,         // m
  porosity: 0.24,
  permeability: 300,     // mD
  temperature: 90,       // °C
  pressure: 22,          // MPa
  monovalentSalinity: 65000,
  bivalentSalinity: 4000,
  area: 400,             // km²
  netToGross: 0.62,
  geometryType: "stratigraphic",
  caprockFriction: 35,
  caprockCohesion: 8,    // evaporite caprock — high cohesion
  biotCoefficient: 0.72,
}
```

## Storage Context
- Egypt hosted COP27 (2022) — strong national commitment to climate solutions on record
- Egypt's Ministry of Petroleum has active CCS feasibility programme
- Nile Delta holds one of North Africa's largest identified saline aquifer storage volumes
- Messinian evaporite caprock = one of the most reliable seals globally (similar to Zechstein in North Sea)
- Gulf proximity makes this directly resonant with Dubai Future Forum audience

## Key References
- Lashin & Al Arifi (2012) — "Geothermal and CO₂ storage potential, Nile Delta"
- IEAGHG (2009) — "CO₂ storage prospectivity, North Africa and Middle East"
- Egyptian General Petroleum Corporation (EGPC) basin reports
- COP27 Egypt National Statement on CCS (2022)
