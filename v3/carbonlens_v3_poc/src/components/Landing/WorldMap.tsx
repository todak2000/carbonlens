import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const MARKERS = [
  { name: 'Sleipner Utsira',       region: 'Europe',       coordinates: [1.9,   58.3] as [number,number] },
  { name: 'Snøhvit Tubåen',        region: 'Europe',       coordinates: [20.5,  71.0] as [number,number] },
  { name: 'Johansen',              region: 'Europe',       coordinates: [3.5,   61.0] as [number,number] },
  { name: 'Rotterdam / North Sea', region: 'Europe',       coordinates: [4.0,   53.5] as [number,number] },
  { name: 'In Salah',              region: 'Africa',       coordinates: [2.5,   27.5] as [number,number] },
  { name: 'Niger Delta',           region: 'Africa',       coordinates: [5.5,    5.5] as [number,number] },
  { name: 'Nile Delta',            region: 'Africa',       coordinates: [31.5,  31.0] as [number,number] },
  { name: 'Abu Dhabi Basin',       region: 'Middle East',  coordinates: [54.5,  24.5] as [number,number] },
  { name: 'Mount Simon',           region: 'Americas',     coordinates: [-88.5, 40.0] as [number,number] },
  { name: 'Alberta Basin',         region: 'Americas',     coordinates: [-114.0,53.5] as [number,number] },
  { name: 'Kasawari',              region: 'Asia-Pacific', coordinates: [114.5,  4.0] as [number,number] },
  { name: 'Duyong',                region: 'Asia-Pacific', coordinates: [103.5,  5.5] as [number,number] },
  { name: 'Malay Basin',           region: 'Asia-Pacific', coordinates: [105.0,  5.0] as [number,number] },
  { name: 'North Sumatra Basin',   region: 'Asia-Pacific', coordinates: [97.5,   4.5] as [number,number] },
  { name: 'Gorgon',                region: 'Australia',    coordinates: [115.0, -20.5] as [number,number] },
  { name: 'Otway',                 region: 'Australia',    coordinates: [142.5, -38.5] as [number,number] },
]

const REGION_COLORS: Record<string, string> = {
  'Europe':       '#34d399',
  'Africa':       '#fb923c',
  'Middle East':  '#fbbf24',
  'Americas':     '#60a5fa',
  'Asia-Pacific': '#a78bfa',
  'Australia':    '#f472b6',
}

export default function WorldMap() {
  return (
    <ComposableMap
      projection="geoNaturalEarth1"
      projectionConfig={{ scale: 147, center: [20, 10] }}
      style={{ width: '100%', height: 'auto', maxHeight: '320px' }}
    >
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill="#10b981"
              fillOpacity={0.1}
              stroke="#10b981"
              strokeWidth={0.4}
              strokeOpacity={0.5}
              style={{
                default: { outline: 'none' },
                hover:   { fill: '#10b981', fillOpacity: 0.2, outline: 'none' },
                pressed: { outline: 'none' },
              }}
            />
          ))
        }
      </Geographies>
      {MARKERS.map((m) => (
        <Marker key={m.name} coordinates={m.coordinates}>
          <title>{m.name}</title>
          <circle r={7} fill="none" stroke={REGION_COLORS[m.region]} strokeWidth={0.8} opacity={0.4} />
          <circle r={3.5} fill={REGION_COLORS[m.region]} opacity={0.9} />
        </Marker>
      ))}
    </ComposableMap>
  )
}
