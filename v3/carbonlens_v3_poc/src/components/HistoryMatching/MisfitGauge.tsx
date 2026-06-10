/**
 * MisfitGauge — SVG circular gauge showing total misfit (0 to 1, lower is better).
 */

interface MisfitGaugeProps {
  misfit: number;
}

export default function MisfitGauge({ misfit }: MisfitGaugeProps) {
  const clamped = Math.max(0, Math.min(1, misfit));
  const cx = 60, cy = 60, r = 48;
  const startAngle = -Math.PI * 0.8;
  const endAngle = Math.PI * 0.8;
  const totalArc = endAngle - startAngle;
  const fillArc = clamped * totalArc;

  function arcPath(start: number, end: number, radius: number): string {
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const largeArc = Math.abs(end - start) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  const fillColor = clamped < 0.2 ? '#22c55e' : clamped < 0.5 ? '#f59e0b' : '#ef4444';

  const fillEnd = startAngle + fillArc;

  return (
    <svg viewBox="0 0 120 90" width="120" height="90" aria-label={`Misfit gauge: ${clamped.toFixed(3)}`}>
      {/* Background arc */}
      <path
        d={arcPath(startAngle, endAngle, r)}
        fill="none"
        stroke="#374151"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Filled arc */}
      {clamped > 0.001 && (
        <path
          d={arcPath(startAngle, fillEnd, r)}
          fill="none"
          stroke={fillColor}
          strokeWidth="10"
          strokeLinecap="round"
        />
      )}
      {/* Center value text */}
      <text
        x={cx}
        y={cy + 6}
        textAnchor="middle"
        fontSize="16"
        fontFamily="monospace"
        fontWeight="bold"
        fill={fillColor}
      >
        {clamped.toFixed(3)}
      </text>
      {/* Label */}
      <text
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        fontSize="8"
        fontFamily="monospace"
        fill="#6b7280"
      >
        Total Misfit
      </text>
      {/* Scale labels */}
      <text x={cx - r - 4} y={cy + 14} textAnchor="end" fontSize="7" fontFamily="monospace" fill="#6b7280">0</text>
      <text x={cx + r + 4} y={cy + 14} textAnchor="start" fontSize="7" fontFamily="monospace" fill="#6b7280">1</text>
    </svg>
  );
}
