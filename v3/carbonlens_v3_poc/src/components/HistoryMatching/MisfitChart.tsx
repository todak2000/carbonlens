/**
 * MisfitChart — SVG line chart overlaying observed vs simulated time series.
 * Draws two lines per observable: dashed (observed) and solid (simulated).
 */

import type { ObservationData } from '../../engine/historyMatching/types';
import type { SimulationResult } from '../../types';

interface MisfitChartProps {
  observationData: ObservationData;
  simulatedResults: SimulationResult[];
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
const W = 260, H = 140;
const PL = 44, PR = 10, PT = 12, PB = 28;
const PW = W - PL - PR;
const PH = H - PT - PB;

function linePath(points: [number, number][], xScale: (x: number) => number, yScale: (y: number) => number): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${xScale(x).toFixed(1)} ${yScale(y).toFixed(1)}`).join(' ');
}

export default function MisfitChart({ observationData, simulatedResults }: MisfitChartProps) {
  if (simulatedResults.length === 0) {
    return (
      <div className="text-[10px] text-muted font-mono text-center py-4">
        Run simulation to see chart
      </div>
    );
  }

  // Build series: {name, obsPoints, simPoints}
  interface Series {
    name: string;
    obsPoints: [number, number][];
    simPoints: [number, number][];
  }

  const series: Series[] = [];

  const getSimAt = (year: number): SimulationResult => {
    const idx = Math.min(year, simulatedResults.length) - 1;
    return simulatedResults[Math.max(0, idx)];
  };

  if (observationData.plumeAreaVsTime && observationData.plumeAreaVsTime.length > 0) {
    const obs = observationData.plumeAreaVsTime;
    const obsPoints = obs.map(p => [p.year, p.value] as [number, number]);
    const simPoints = obs.map(p => {
      const sim = getSimAt(p.year);
      const areaKm2 = Math.PI * sim.plumeRadius ** 2 / 1e6;
      return [p.year, areaKm2] as [number, number];
    });
    series.push({ name: 'Plume Area (km²)', obsPoints, simPoints });
  }

  if (observationData.plumeRadiusTargets && observationData.plumeRadiusTargets.length > 0) {
    const obs = observationData.plumeRadiusTargets;
    const obsPoints = obs.map(p => [p.year, p.value / 1000] as [number, number]); // m → km
    const simPoints = obs.map(p => {
      const sim = getSimAt(p.year);
      return [p.year, sim.plumeRadius / 1000] as [number, number];
    });
    series.push({ name: 'Plume Radius (km)', obsPoints, simPoints });
  }

  if (observationData.injectionPressureVsTime && observationData.injectionPressureVsTime.length > 0) {
    const obs = observationData.injectionPressureVsTime;
    const obsPoints = obs.map(p => [p.year, p.value] as [number, number]);
    const simPoints = obs.map(p => {
      const sim = getSimAt(p.year);
      return [p.year, sim.injectionPressure] as [number, number];
    });
    series.push({ name: 'Inj. Press. (MPa)', obsPoints, simPoints });
  }

  if (series.length === 0) {
    return (
      <div className="text-[10px] text-muted font-mono text-center py-4">
        No observations loaded
      </div>
    );
  }

  // Each series gets its own sub-chart stacked vertically
  const subH = Math.floor((H - 20) / series.length);

  return (
    <div className="space-y-1">
      {series.map((s, si) => {
        const allPoints = [...s.obsPoints, ...s.simPoints];
        const allX = allPoints.map(p => p[0]);
        const allY = allPoints.map(p => p[1]);
        const xMin = Math.min(...allX);
        const xMax = Math.max(...allX);
        const yMin = 0;
        const yMax = Math.max(...allY) * 1.15;

        const xScale = (x: number) => PL + ((x - xMin) / Math.max(xMax - xMin, 1)) * PW;
        const yScale = (y: number) => PT + PH - ((y - yMin) / Math.max(yMax - yMin, 0.001)) * PH;

        const color = COLORS[si % COLORS.length];
        const h = subH;

        return (
          <div key={s.name}>
            <div className="text-[8px] text-muted font-mono mb-0.5">{s.name}</div>
            <svg viewBox={`0 0 ${W} ${h}`} width="100%" style={{ height: h }}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1.0].map(t => {
                const y = PT + (1 - t) * (h - PT - PB);
                const val = yMin + t * (yMax - yMin);
                return (
                  <g key={t}>
                    <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#374151" strokeWidth="0.5" />
                    <text x={PL - 2} y={y + 3} textAnchor="end" fontSize="6" fontFamily="monospace" fill="#6b7280">
                      {val.toFixed(val > 10 ? 0 : 2)}
                    </text>
                  </g>
                );
              })}

              {/* X axis labels */}
              {s.obsPoints.map(([x]) => (
                <text key={x} x={xScale(x)} y={h - PB + 10} textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#6b7280">
                  {x}
                </text>
              ))}
              <text x={PL + PW / 2} y={h - 2} textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#6b7280">year</text>

              {/* Observed line (dashed) */}
              <path
                d={linePath(s.obsPoints, xScale, (y) => PT + (h - PT - PB) - ((y - yMin) / Math.max(yMax - yMin, 0.001)) * (h - PT - PB))}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.8"
              />

              {/* Simulated line (solid) */}
              <path
                d={linePath(s.simPoints, xScale, (y) => PT + (h - PT - PB) - ((y - yMin) / Math.max(yMax - yMin, 0.001)) * (h - PT - PB))}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
              />

              {/* Observed dots */}
              {s.obsPoints.map(([x, y]) => (
                <circle key={x}
                  cx={xScale(x)}
                  cy={PT + (h - PT - PB) - ((y - yMin) / Math.max(yMax - yMin, 0.001)) * (h - PT - PB)}
                  r="2.5" fill={color} opacity="0.7"
                />
              ))}

              {/* Simulated dots */}
              {s.simPoints.map(([x, y]) => (
                <circle key={x}
                  cx={xScale(x)}
                  cy={PT + (h - PT - PB) - ((y - yMin) / Math.max(yMax - yMin, 0.001)) * (h - PT - PB)}
                  r="2" fill="none" stroke={color} strokeWidth="1"
                />
              ))}

              {/* Legend */}
              <line x1={PL + 2} y1={PT + 4} x2={PL + 14} y2={PT + 4} stroke={color} strokeWidth="1.5" strokeDasharray="4 3" />
              <text x={PL + 16} y={PT + 7} fontSize="6" fontFamily="monospace" fill="#9ca3af">Obs.</text>
              <line x1={PL + 34} y1={PT + 4} x2={PL + 46} y2={PT + 4} stroke={color} strokeWidth="1.5" />
              <text x={PL + 48} y={PT + 7} fontSize="6" fontFamily="monospace" fill="#9ca3af">Sim.</text>
            </svg>
          </div>
        );
      })}
    </div>
  );
}
