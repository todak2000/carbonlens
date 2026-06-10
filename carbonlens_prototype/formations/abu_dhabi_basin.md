# Abu Dhabi Basin — CO₂ Storage Formation Data
**Country:** United Arab Emirates
**Region:** Abu Dhabi, onshore and shallow offshore
**Relevance:** DIRECTLY relevant to Dubai competition audience. Al Reyadah CCS facility — world's first commercial-scale CCS on a steel plant. ADNOC is one of the most CCS-active NOCs globally.

## Why This Formation Matters for the Competition

This is a strategic addition. The Dubai Future Forum is hosted by the UAE government. ADNOC officials, Abu Dhabi sovereign wealth fund representatives, and UAE Ministry of Energy delegates will be in that room. Having UAE geology in the tool is not just academically sound — it is a direct conversation opener with the most important people in the audience.

Al Reyadah (operated by ADNOC + Masdar) has been injecting CO₂ into Abu Dhabi saline aquifers since 2016 at ~800,000 tonnes/year. It is one of the most-cited CCS reference projects globally.

## Geological Parameters (for formationPresets.ts)

| Parameter | Value | Source |
|---|---|---|
| Target formation | Khuff Formation (carbonate) / Arab Formation (carbonate) / Deep saline sandstones | ADNOC CCS literature |
| Depth to reservoir top | 2,000–3,500 m | Al Reyadah injection zone |
| Reservoir thickness (net) | 50–150 m | Carbonate intervals |
| Porosity (mean) | 0.12–0.22 | Carbonate reservoirs — lower than clastics |
| Horizontal permeability | 50–300 mD | Variable — vuggy carbonates higher |
| Reservoir temperature | 90–130°C | Deep, hot basin |
| Reservoir pressure | 20–35 MPa | Overpressured in deeper zones |
| Monovalent salinity | 100,000–250,000 mg/L NaCl | Highly saline formation brines |
| Bivalent salinity | 5,000–20,000 mg/L CaCl₂ | High divalent ion content |
| Formation area | 200–2,000 km² | Basin-scale aquifer extent |
| Net-to-gross | 0.40–0.70 | Carbonate heterogeneity |
| Caprock | Anhydrite / tight carbonate — very high integrity seal |

## Recommended Preset Values (single representative case)

```typescript
{
  name: "Abu Dhabi Basin (UAE)",
  depth: 2800,           // m — Al Reyadah injection depth range
  thickness: 80,         // m net reservoir
  porosity: 0.16,        // carbonate reservoir
  permeability: 120,     // mD
  temperature: 110,      // °C
  pressure: 28,          // MPa
  monovalentSalinity: 180000,  // mg/L — highly saline
  bivalentSalinity: 12000,
  area: 500,             // km²
  netToGross: 0.55,
  geometryType: "dome",  // structural traps common in Arabian platform carbonates
  caprockFriction: 38,
  caprockCohesion: 10,   // anhydrite caprock — extremely high cohesion
  biotCoefficient: 0.65, // stiffer carbonate matrix
}
```

## Storage Context
- Al Reyadah CCS: operational since 2016, capturing CO₂ from Emirates Steel, injecting into saline aquifers
- ADNOC CCS Hub target: 5 Mt CO₂/year by 2030 (currently ~800K tonnes/year)
- UAE Net Zero 2050 Strategic Initiative — CCS is a listed pillar technology
- Abu Dhabi hosts IRENA headquarters — clean energy credibility of the host nation
- Khuff Formation is one of the most well-studied carbonate reservoirs globally (also a major gas reservoir in the Gulf region)

## Competition Talking Point
"We built CarbonLens with Abu Dhabi's geology already inside it. The same formation where Al Reyadah is injecting CO₂ today can be screened in under an hour — and shared with any regulator or researcher in the region at no cost."

## Key References
- Stanton et al. (2020) — "Al Reyadah CCS project overview"
- ADNOC Sustainability Reports (2022, 2023)
- IEAGHG (2019) — "Abu Dhabi CCS feasibility assessment"
- Al-Hashami et al. (2005) — "Khuff Formation reservoir characterisation"
- UAE Ministry of Energy — Net Zero 2050 Strategic Initiative documentation
