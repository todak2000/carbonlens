/**
 * ParameterSweep — SVG line chart showing misfit vs parameter value.
 * Marks the current parameter value with a vertical dotted line.
 */

import type { SensitivityResult } from '../../engine/historyMatching/types';

interface ParameterSweepProps {
  result: SensitivityResult | null;
  currentValue: number;
  paramLabel: string;
}

const W = 260, H = 120;
const PL = 44, PR = 10, PT = 12, PB = 28;
const PW = W - PL - PR;
const PH = H - PT - PB;

export default function ParameterSweep({ result, currentValue, paramLabel }: ParameterSweepProps) {
  if (!result || result.sweep.length === 0) {
    return (
      <div className="text-[10px] text-muted font-mono text-center py-4">
        Run sweep to see sensitivity
      </div>
    );
  }

  const { sweep } = result;
  const xValues = sweep.map(p => p.paramValue);
  const yValues = sweep.map(p => p.misfit);

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = 0;
  const yMax = Math.max(...yValues, result.baselineMisfit) * 1.15;

  const toSvgX = (x: number) => PL + ((x - xMin) / Math.max(xMax - xMin, 1e-10)) * PW;
  const toSvgY = (y: number) => PT + PH - ((y - yMin) / Math.max(yMax - yMin, 1e-10)) * PH;

  const linePath = sweep
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.paramValue).toFixed(1)} ${toSvgY(p.misfit).toFixed(1)}`)
    .join(' ');

  const curX = toSvgX(currentValue);

  // X tick values
  const xTicks = [xMin, (xMin + xMax) / 2, xMax];
  const yTicks = [0, yMax / 2, yMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: H }}>
      {/* Background */}
      <rect x={PL} y={PT} width={PW} height={PH} fill="#111827" rx="2" />

      {/* Grid lines Y */}
      {yTicks.map((y, i) => (
        <g key={i}>
          <line x1={PL} y1={toSvgY(y)} x2={W - PR} y2={toSvgY(y)} stroke="#374151" strokeWidth="0.5" />
          <text x={PL - 2} y={toSvgY(y) + 3} textAnchor="end" fontSize="6" fontFamily="monospace" fill="#6b7280">
            {y.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Grid lines X */}
      {xTicks.map((x, i) => (
        <g key={i}>
          <line x1={toSvgX(x)} y1={PT} x2={toSvgX(x)} y2={PT + PH} stroke="#374151" strokeWidth="0.5" />
          <text x={toSvgX(x)} y={PT + PH + 10} textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#6b7280">
            {x > 100 ? x.toFixed(0) : x.toFixed(3)}
          </text>
        </g>
      ))}

      {/* Axis labels */}
      <text x={PL + PW / 2} y={H - 2} textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#9ca3af">
        {paramLabel}
      </text>
      <text x={8} y={PT + PH / 2} textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#9ca3af"
        transform={`rotate(-90, 8, ${PT + PH / 2})`}>
        Misfit
      </text>

      {/* Misfit line */}
      <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" />

      {/* Baseline misfit horizontal line */}
      <line
        x1={PL} y1={toSvgY(result.baselineMisfit)}
        x2={W - PR} y2={toSvgY(result.baselineMisfit)}
        stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2"
      />
      <text x={W - PR - 2} y={toSvgY(result.baselineMisfit) - 2}
        textAnchor="end" fontSize="6" fontFamily="monospace" fill="#f59e0b">
        baseline
      </text>

      {/* Current value vertical dotted line */}
      {currentValue >= xMin && currentValue <= xMax && (
        <>
          <line
            x1={curX} y1={PT}
            x2={curX} y2={PT + PH}
            stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 3"
          />
          <text x={curX} y={PT - 2}
            textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#22c55e">
            current
          </text>
        </>
      )}

      {/* Dots on the sweep line */}
      {sweep.filter((_, i) => i % Math.max(1, Math.floor(sweep.length / 10)) === 0).map((p) => (
        <circle key={p.paramValue}
          cx={toSvgX(p.paramValue)}
          cy={toSvgY(p.misfit)}
          r="1.5" fill="#3b82f6"
        />
      ))}
    </svg>
  );
}
