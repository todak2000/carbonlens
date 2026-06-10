# Alberta Basin — CO₂ Storage Formation Data
**Country:** Canada
**Region:** Central Alberta, Western Canada Sedimentary Basin
**Relevance:** Quest CCS project (Shell/ADNOC/Chevron, operational since 2015) — one of the most thoroughly monitored and published CCS projects globally. The Basal Cambrian Sandstone is the best-characterised saline aquifer storage formation in the Americas.

## Why This Formation Matters for the Competition

Quest has been injecting ~1 Mt CO₂/year since 2015 and has published more monitoring, verification, and accounting (MVA) data than almost any other CCS project globally. This makes it exceptionally strong for academic rigour — there is a wealth of peer-reviewed validation data to cite. Including it also covers the Americas without duplicating the existing Mount Simon USA preset, and it connects to ADNOC (Abu Dhabi) which is a co-owner of Quest — creating a natural link between the UAE and Canadian presets in the narrative.

## Geological Parameters (for formationPresets.ts)

| Parameter | Value | Source |
|---|---|---|
| Target formation | Basal Cambrian Sandstone (BCS) | Quest CCS literature |
| Depth to reservoir top | 1,900–2,400 m | Quest injection zone |
| Reservoir thickness (net) | 30–80 m | BCS interval |
| Porosity (mean) | 0.10–0.18 | Tight to moderate — cemented sandstone |
| Horizontal permeability | 10–150 mD | Variable, averaging ~50 mD |
| Reservoir temperature | 65–85°C | |
| Reservoir pressure | 19–24 MPa | |
| Monovalent salinity | 200,000–300,000 mg/L NaCl | Very high — deep formation brines |
| Bivalent salinity | 10,000–25,000 mg/L CaCl₂ | High divalent content |
| Formation area | 500–5,000 km² | Regionally extensive aquifer |
| Net-to-gross | 0.50–0.80 | |
| Caprock | Deadwood Formation shale + Winnipeg Formation — well-characterised |

## Recommended Preset Values (single representative case)

```typescript
{
  name: "Alberta Basin (Canada)",
  depth: 2200,           // m — Quest injection depth
  thickness: 50,         // m net
  porosity: 0.14,        // tight sandstone
  permeability: 50,      // mD — Quest published value
  temperature: 75,       // °C
  pressure: 22,          // MPa
  monovalentSalinity: 250000,  // mg/L — very high salinity
  bivalentSalinity: 18000,
  area: 1000,            // km²
  netToGross: 0.65,
  geometryType: "layered",
  caprockFriction: 30,
  caprockCohesion: 6,
  biotCoefficient: 0.70,
}
```

## Storage Context
- Quest CCS: operational since 2015 at Shell Scotford Upgrader, Fort Saskatchewan, Alberta
- Cumulative injection: >7 Mt CO₂ as of 2024 — one of the largest operating CCS projects globally
- Owned by Shell (60%), ADNOC (20%), Chevron (20%) — NOTE: ADNOC connection links this directly to the UAE preset above
- Regulated under Alberta Carbon Capture Incentive Program and federal Canadian carbon price
- Alberta has a dedicated CCS regulatory framework — one of the most mature in the Americas
- Quest publishes annual MVA reports with full pressure, saturation, and microseismic data

## Competition Talking Point
"The Alberta Quest project — co-owned by ADNOC, the same company running CCS in Abu Dhabi — has injected over 7 million tonnes of CO₂ into the Basal Cambrian Sandstone. That same formation type can be screened in CarbonLens. The science connecting Abu Dhabi and Alberta is in this tool."

## Key References
- Shell Quest CCS Annual Performance Reports (2015–2023) — publicly available
- Mayer et al. (2013) — "Quest CCS project geologic characterisation"
- IEAGHG (2022) — "Quest CCS project 5-year review"
- Alberta Energy Regulator — CCS regulatory framework
- Global CCS Institute (2023) — Quest project profile
