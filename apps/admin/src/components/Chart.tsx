/**
 * Lightweight SVG line/bar chart — no external deps.
 */

interface LineChartProps {
  data: Array<{ day: string; [key: string]: number | string }>;
  series: Array<{ key: string; color: string; label: string }>;
  height?: number;
}

export function LineChart({ data, series, height = 160 }: LineChartProps) {
  if (!data.length) return <Empty height={height} />;

  const W = 600;
  const H = height;
  const padL = 40, padR = 12, padT = 12, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allVals = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const maxVal = Math.max(...allVals, 1);

  const x = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * chartW;
  const y = (v: number) => padT + chartH - (v / maxVal) * chartH;

  const ticks = 4;
  const labelStep = Math.max(1, Math.floor(data.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      {/* grid */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const yy = padT + (i / ticks) * chartH;
        const val = Math.round(maxVal * (1 - i / ticks));
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yy} y2={yy} stroke="#2e3348" strokeWidth={1} />
            <text x={padL - 4} y={yy + 4} fill="#8b8fa8" fontSize={10} textAnchor="end">{val}</text>
          </g>
        );
      })}

      {/* x labels */}
      {data.map((d, i) => {
        if (i % labelStep !== 0 && i !== data.length - 1) return null;
        const label = String(d.day).slice(5); // MM-DD
        return (
          <text key={i} x={x(i)} y={H - 4} fill="#8b8fa8" fontSize={10} textAnchor="middle">
            {label}
          </text>
        );
      })}

      {/* series */}
      {series.map((s) => {
        const pts = data.map((d, i) => `${x(i)},${y(Number(d[s.key]) || 0)}`).join(" ");
        const areaBottom = `${x(data.length - 1)},${padT + chartH} ${x(0)},${padT + chartH}`;
        return (
          <g key={s.key}>
            <polygon
              points={pts + " " + areaBottom}
              fill={s.color}
              fillOpacity={0.08}
            />
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}


interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
}

export function BarChart({ data, color = "#7c6af7", height = 140 }: BarChartProps) {
  if (!data.length) return <Empty height={height} />;

  const W = 600;
  const H = height;
  const padL = 8, padR = 8, padT = 12, padB = 40;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(4, (W - padL - padR) / data.length - 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const bh = (d.value / maxVal) * chartH;
        const bx = padL + i * ((W - padL - padR) / data.length) + 2;
        const by = padT + chartH - bh;
        const labelX = bx + barW / 2;
        const shortLabel = d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={barW} height={bh} fill={color} rx={3} fillOpacity={0.85} />
            <text x={labelX} y={H - 4} fill="#8b8fa8" fontSize={9} textAnchor="middle">{shortLabel}</text>
            {d.value > 0 && (
              <text x={labelX} y={by - 3} fill="#8b8fa8" fontSize={9} textAnchor="middle">{d.value}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>
      Нет данных
    </div>
  );
}
