/**
 * Lightweight SVG charts — no external deps.
 *
 * Architecture:
 * - LineChart: flex row [Y-labels | SVG] + X-labels HTML row below.
 *   Both Y-labels div and SVG share the same explicit height → always aligned.
 * - BarChart: SVG bars + HTML category labels row below.
 */
import { formatDayMonth } from "../utils/format";

interface LineChartProps {
  data: Array<{ day: string; [key: string]: number | string }>;
  series: Array<{ key: string; color: string; label: string }>;
  height?: number;
}

const CHART_HEIGHT_CLASS: Record<number, string> = {
  130: "chart-h-130",
  150: "chart-h-150",
  160: "chart-h-160",
  180: "chart-h-180",
};

function chartHeightClass(height: number): string {
  return CHART_HEIGHT_CLASS[height] ?? "chart-h-160";
}

export function LineChart({ data, series, height = 160 }: LineChartProps) {
  if (!data.length) return <Empty height={height} />;

  // SVG coordinate space — full width, no left pad (Y-axis is HTML)
  const W = 560;
  const H = height;
  const padR = 8, padT = 12, padB = 8;
  const chartW = W - padR;
  const chartH = H - padT - padB;

  const allVals = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const maxVal = Math.max(...allVals, 1);

  const x = (i: number) => (i / Math.max(data.length - 1, 1)) * chartW;
  const y = (v: number) => padT + chartH - (v / maxVal) * chartH;

  const ticks = 4;
  const labelStep = Math.max(1, Math.floor(data.length / 6));

  const yLabels = Array.from({ length: ticks + 1 }, (_, i) => ({
    val: Math.round(maxVal * (1 - i / ticks)),
    pct: i / ticks,
  }));

  const xLabels = data
    .map((d, i) => ({ label: formatDayMonth(String(d.day)), i }))
    .filter(({ i }) => i % labelStep === 0 || i === data.length - 1);
  const heightClass = chartHeightClass(height);

  return (
    <div className="chart-scroll-x">
      <div>
        {/* Chart row: Y-axis + SVG — same explicit height, always aligned */}
        <div className="line-chart-row">
          {/* Y-axis labels */}
          <div className={`line-chart-y-axis ${heightClass}`}>
            {yLabels.map(({ val }, i) => (
              <span key={i} className="line-chart-y-label">
                {val >= 10000 ? `${(val / 1000).toFixed(0)}k` : val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </span>
            ))}
          </div>

          {/* SVG: lines + grid, no text */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className={`line-chart-svg ${heightClass}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* horizontal grid lines */}
            {yLabels.map(({ pct }, i) => {
              const yy = padT + pct * chartH;
              return <line key={i} x1={0} x2={W - padR} y1={yy} y2={yy} stroke="#2e3348" strokeWidth={1} />;
            })}

            {/* series */}
            {series.map((s) => {
              const pts = data.map((d, i) => `${x(i)},${y(Number(d[s.key]) || 0)}`).join(" ");
              const areaBot = `${x(data.length - 1)},${padT + chartH} ${x(0)},${padT + chartH}`;
              return (
                <g key={s.key}>
                  <polygon points={`${pts} ${areaBot}`} fill={s.color} fillOpacity={0.08} />
                  <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
                </g>
              );
            })}
          </svg>
        </div>

        {/* X-axis labels — HTML row, indented to match SVG start */}
        <div className="line-chart-x-axis">
          {xLabels.map(({ label, i }) => (
            <span key={i} className="line-chart-x-label">{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}


interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
}

export function BarChart({ data, color = "#7c6af7", height = 130 }: BarChartProps) {
  if (!data.length) return <Empty height={height} />;

  const W = 600;
  const H = height;
  const padT = 22, padB = 0;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const slotW = W / data.length;
  const barW = Math.max(8, slotW * 0.6);
  const heightClass = chartHeightClass(height);

  return (
    <div className="chart-scroll-x">
      <div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`bar-chart-svg ${heightClass}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {data.map((d, i) => {
            const bh = Math.max(2, (d.value / maxVal) * chartH);
            const bx = i * slotW + (slotW - barW) / 2;
            const by = padT + chartH - bh;
            const labelX = bx + barW / 2;
            const fmt = (v: number) => v >= 10000 ? `${(v/1000).toFixed(0)}k` : v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v);
            return (
              <g key={i}>
                <rect x={bx} y={by} width={barW} height={bh} fill={color} rx={3} fillOpacity={0.85} />
                {d.value > 0 && (
                  <text x={labelX} y={Math.max(padT - 4, by - 4)} fill="#c8cad8" fontSize={13} textAnchor="middle" fontWeight={500}>
                    {fmt(d.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Category labels */}
        <div className="bar-chart-label-row">
          {data.map((d, i) => (
            <div key={i} className="bar-chart-label">
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div className={`chart-empty ${chartHeightClass(height)}`}>
      Нет данных
    </div>
  );
}
