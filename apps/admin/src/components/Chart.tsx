/**
 * Lightweight SVG charts — no external deps.
 *
 * Architecture: SVG handles bars/lines only.
 * Axis labels are rendered as HTML (readable on any screen size).
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
  const padL = 44, padR = 8, padT = 12, padB = 4;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allVals = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const maxVal = Math.max(...allVals, 1);

  const x = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * chartW;
  const y = (v: number) => padT + chartH - (v / maxVal) * chartH;

  const ticks = 4;
  const labelStep = Math.max(1, Math.floor(data.length / 6));

  // Y-axis labels as numbers
  const yLabels = Array.from({ length: ticks + 1 }, (_, i) => ({
    val: Math.round(maxVal * (1 - i / ticks)),
    pct: i / ticks,
  }));

  // X-axis labels (dates) — rendered as HTML below SVG
  const xLabels = data
    .map((d, i) => ({ label: String(d.day).slice(5), i }))
    .filter(({ i }) => i % labelStep === 0 || i === data.length - 1);

  return (
    <div style={{ position: "relative" }}>
      {/* Y-axis labels */}
      <div style={{
        position: "absolute",
        top: padT,
        left: 0,
        width: padL - 6,
        height: chartH,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}>
        {yLabels.map(({ val }) => (
          <span key={val} style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1 }}>
            {val > 999 ? `${(val / 1000).toFixed(1)}k` : val}
          </span>
        ))}
      </div>

      {/* Chart SVG — lines/area only, no text */}
      <svg
        viewBox={`${padL} 0 ${chartW + padR} ${H}`}
        style={{ width: "100%", display: "block" }}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* grid lines */}
        {yLabels.map(({ pct }, i) => {
          const yy = padT + pct * chartH;
          return (
            <line
              key={i}
              x1={padL} x2={W - padR}
              y1={yy} y2={yy}
              stroke="#2e3348" strokeWidth={1}
            />
          );
        })}

        {/* series */}
        {series.map((s) => {
          const pts = data.map((d, i) => `${x(i)},${y(Number(d[s.key]) || 0)}`).join(" ");
          const areaBottom = `${x(data.length - 1)},${padT + chartH} ${x(0)},${padT + chartH}`;
          return (
            <g key={s.key}>
              <polygon points={pts + " " + areaBottom} fill={s.color} fillOpacity={0.08} />
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>

      {/* X-axis labels — HTML, always readable */}
      <div style={{ display: "flex", marginLeft: padL, justifyContent: "space-between", marginTop: 4 }}>
        {xLabels.map(({ label, i }) => (
          <span key={i} style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
            {label}
          </span>
        ))}
      </div>
    </div>
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
  const padL = 0, padR = 0, padT = 20, padB = 0;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const slotW = (W - padL - padR) / data.length;
  const barW = Math.max(8, slotW - 8);

  return (
    <div>
      {/* SVG — bars + value labels above bars only */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", display: "block" }}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {data.map((d, i) => {
          const bh = Math.max(2, (d.value / maxVal) * chartH);
          const bx = padL + i * slotW + (slotW - barW) / 2;
          const by = padT + chartH - bh;
          const labelX = bx + barW / 2;
          return (
            <g key={i}>
              <rect x={bx} y={by} width={barW} height={bh} fill={color} rx={3} fillOpacity={0.85} />
              {/* Value label above bar — larger font, readable at any scale */}
              {d.value > 0 && (
                <text x={labelX} y={Math.max(padT - 3, by - 3)} fill="#c8cad8" fontSize={14} textAnchor="middle" fontWeight={500}>
                  {d.value > 999 ? `${(d.value / 1000).toFixed(1)}k` : d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Category labels — HTML flex row, always readable */}
      <div style={{ display: "flex" }}>
        {data.map((d, i) => (
          <div key={i} style={{
            flex: 1,
            textAlign: "center",
            fontSize: 11,
            color: "var(--muted)",
            paddingTop: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>
      Нет данных
    </div>
  );
}
