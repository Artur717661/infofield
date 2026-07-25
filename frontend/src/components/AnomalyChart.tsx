import { useMemo, useState } from "react";
import { DailyPoint } from "../lib/metrics";
import { formatDate } from "../lib/format";

type AnomalyChartProps = {
  data: DailyPoint[];
  selectedDate?: string | null;
  onSelectDay: (date: string) => void;
};

const WIDTH = 660;
const HEIGHT = 168;
const PAD_X = 6;
const PAD_TOP = 16;
const PAD_BOTTOM = 16;

export function AnomalyChart({ data, selectedDate, onSelectDay }: AnomalyChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (data.length === 0) return null;

    const max = Math.max(...data.map((d) => d.count), 1);
    const mean = data.reduce((s, d) => s + d.count, 0) / data.length;
    const innerW = WIDTH - PAD_X * 2;
    const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const yFor = (count: number) => PAD_TOP + innerH * (1 - count / max);

    const points = data.map((d, i) => ({ x: PAD_X + i * stepX, y: yFor(d.count), d }));
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const baseY = HEIGHT - PAD_BOTTOM;
    const area = `${line} L${points[points.length - 1].x.toFixed(1)},${baseY} L${points[0].x.toFixed(1)},${baseY} Z`;

    return { points, line, area, max, meanY: yFor(mean), stepX };
  }, [data]);

  if (!geometry) {
    return <div className="panel-empty">Нет данных за выбранный период.</div>;
  }

  const { points, line, area, max, meanY, stepX } = geometry;
  const activeIndex = hover ?? (selectedDate ? data.findIndex((d) => d.date === selectedDate) : -1);
  const active = activeIndex >= 0 ? data[activeIndex] : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        preserveAspectRatio="none"
        role="img"
        aria-label="Объём упоминаний по дням"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Mean line: the baseline the z-score is measured against. */}
        <line x1={PAD_X} y1={meanY} x2={WIDTH - PAD_X} y2={meanY} stroke="var(--grid-line)" strokeDasharray="3 4" />

        <path d={area} fill="url(#volumeFill)" />
        <path d={line} fill="none" stroke="var(--accent-2)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />

        {points
          .filter((p) => p.d.isAnomaly)
          .map((p) => (
            <circle key={`a-${p.d.date}`} cx={p.x} cy={p.y} r="4" fill="var(--accent)" />
          ))}

        {active ? (
          <g>
            <line
              x1={points[activeIndex].x}
              y1={PAD_TOP - 6}
              x2={points[activeIndex].x}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="var(--text-faint)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={points[activeIndex].x} cy={points[activeIndex].y} r="4.5" fill="var(--text)" />
          </g>
        ) : null}

        {/* One transparent hit-target per day, so every point is clickable. */}
        {points.map((p, i) => (
          <rect
            key={p.d.date}
            x={p.x - Math.max(stepX, 2) / 2}
            y={0}
            width={Math.max(stepX, 2)}
            height={HEIGHT}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onClick={() => onSelectDay(p.d.date)}
          />
        ))}
      </svg>

      <div className="chart-footer">
        <span>{formatDate(data[0].date)}</span>
        {active ? (
          <span className={`chart-readout${active.isAnomaly ? " anomaly" : ""}`}>
            {formatDate(active.date)} · {active.count} публикаций · z = {active.z}
            {active.isAnomaly ? " · аномалия" : ""}
          </span>
        ) : (
          <span className="chart-readout">пик {max} / день · пунктир — норма</span>
        )}
        <span>{formatDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
