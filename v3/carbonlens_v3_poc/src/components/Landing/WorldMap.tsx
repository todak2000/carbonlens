import { useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface MapMarker {
  name: string
  region: string
  coordinates: [number, number]
  capacity: string
  type: string
}

const MARKERS: MapMarker[] = [
  { name: 'Sleipner Utsira',       region: 'Europe',       coordinates: [1.9,   58.3],  capacity: '200 Gt',  type: 'Saline Aquifer' },
  { name: 'Snøhvit Tubåen',        region: 'Europe',       coordinates: [20.5,  71.0],  capacity: '5.5 Gt',   type: 'Saline Aquifer' },
  { name: 'Johansen',              region: 'Europe',       coordinates: [3.5,   61.0],  capacity: '1.2 Gt',   type: 'Saline Aquifer' },
  { name: 'Rotterdam / North Sea', region: 'Europe',       coordinates: [4.0,   53.5],  capacity: '37 Mt',   type: 'Depleted Gas' },
  { name: 'In Salah',              region: 'Africa',       coordinates: [2.5,   27.5],  capacity: '17 Mt',   type: 'Depleted Gas' },
  { name: 'Niger Delta',           region: 'Africa',       coordinates: [5.5,    5.5],  capacity: '150 Gt',  type: 'Saline Aquifer' },
  { name: 'Nile Delta',            region: 'Africa',       coordinates: [31.5,  31.0],  capacity: '250 Gt',  type: 'Saline Aquifer' },
  { name: 'Abu Dhabi Basin',       region: 'Middle East',  coordinates: [54.5,  24.5],  capacity: '120 Gt',  type: 'Saline Aquifer / Carbonate' },
  { name: 'Mount Simon',           region: 'Americas',     coordinates: [-88.5, 40.0],  capacity: '150 Gt',  type: 'Saline Aquifer' },
  { name: 'Alberta Basin',         region: 'Americas',     coordinates: [-114.0,53.5],  capacity: '2.4 Gt',   type: 'Saline Aquifer' },
  { name: 'Kasawari',              region: 'Asia-Pacific', coordinates: [114.5,  4.0],  capacity: '76 Mt',   type: 'Depleted Carbonate Gas' },
  { name: 'Duyong',                region: 'Asia-Pacific', coordinates: [103.5,  5.5],  capacity: '5.5 Mt',   type: 'Depleted Gas' },
  { name: 'Malay Basin',           region: 'Asia-Pacific', coordinates: [105.0,  5.0],  capacity: '8.0 Gt',   type: 'Saline Aquifer' },
  { name: 'North Sumatra Basin',   region: 'Asia-Pacific', coordinates: [97.5,   4.5],  capacity: '50 Gt',   type: 'Saline Aquifer' },
  { name: 'Gorgon',                region: 'Australia',    coordinates: [115.0, -20.5], capacity: '120 Mt',  type: 'Silty-Sandstone Aquifer' },
  { name: 'Otway',                 region: 'Australia',    coordinates: [142.5, -38.5], capacity: '2.0 Mt',   type: 'Saline Aquifer' },
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
  const [hoveredMarker, setHoveredMarker] = useState<MapMarker | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    // Offset tooltip from cursor
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top - 20,
    })
  }

  return (
    <div className="relative w-full" onMouseMove={handleMouseMove}>
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 155, center: [20, 10] }}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#10b981"
                fillOpacity={0.08}
                stroke="#10b981"
                strokeWidth={0.4}
                strokeOpacity={0.3}
                style={{
                  default: { outline: 'none' },
                  hover:   { fill: '#10b981', fillOpacity: 0.12, outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>
        {MARKERS.map((m) => {
          const color = REGION_COLORS[m.region]
          const isHovered = hoveredMarker?.name === m.name

          return (
            <Marker
              key={m.name}
              coordinates={m.coordinates}
            >
              <g
                onMouseEnter={() => setHoveredMarker(m)}
                onMouseLeave={() => setHoveredMarker(null)}
              >
              {/* Outer pulsing/glowing rings */}
              <circle
                r={isHovered ? 12 : 7}
                fill="none"
                stroke={color}
                strokeWidth={isHovered ? 1.5 : 0.8}
                opacity={isHovered ? 0.8 : 0.4}
                className="transition-all duration-300"
              >
                {!isHovered && (
                  <animate
                    attributeName="r"
                    values="5;12;5"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                )}
                {!isHovered && (
                  <animate
                    attributeName="opacity"
                    values="0.6;0.1;0.6"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
              {/* Core solid marker */}
              <circle
                r={isHovered ? 4.5 : 3.5}
                fill={color}
                opacity={0.9}
                className="transition-all duration-300 cursor-pointer"
                style={{
                  filter: `drop-shadow(0 0 4px ${color})`,
                }}
              />
              </g>
            </Marker>
          )
        })}
      </ComposableMap>

      {/* Tooltip Overlay */}
      {hoveredMarker && (
        <div
          className="absolute z-20 pointer-events-none p-3.5 rounded-xl border bg-page/95 backdrop-blur-md shadow-xl transition-all duration-150 border-theme flex flex-col gap-1 text-[11px] font-mono min-w-[200px]"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px -3px ${REGION_COLORS[hoveredMarker.region]}15`,
          }}
        >
          <div className="flex items-center gap-1.5 font-bold text-primary text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: REGION_COLORS[hoveredMarker.region] }}
            />
            {hoveredMarker.name}
          </div>
          <div className="text-[10px] text-muted">{hoveredMarker.region} &middot; {hoveredMarker.type}</div>
          <div className="border-t border-theme/50 mt-1.5 pt-1.5 flex justify-between items-baseline">
            <span className="text-secondary text-[10px]">Screened Capacity</span>
            <span className="text-emerald-400 font-bold text-sm">{hoveredMarker.capacity}</span>
          </div>
        </div>
      )}
    </div>
  )
}
