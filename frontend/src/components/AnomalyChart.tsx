import { useMemo, useState } from "react";
import { DailyPoint } from "../lib/metrics";
import { formatDate } from "../lib/format";

type AnomalyChartProps = {
  data: DailyPoint[];
  selectedDate?: string | null;
  onSelectDay: (date: string) => void;
};

const WIDTH = 640;
const HEIGHT = 160;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 20;

export function AnomalyChart({ data, selectedDate, onSelectDay }: AnomalyChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const { linePath, areaPath, points, maxCount } = useMemo(() => {
    if (data.length === 0) {
      return { linePath: "", areaPath: "", points: [], maxCount: 0 };
    }
    const max = Math.max(...data.map((d) => d.count), 1);
    const innerW = WIDTH - PAD_X * 2;
    const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

    const pts = data.map((d, i) => ({
      x: PAD_X + i * stepX,
      y: PAD_TOP + innerH * (1 - d.count / max),
      d,
    }));

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} L${pts[0].x.toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} Z`;

    return { linePath: line, areaPath: area, points: pts, maxCount: max };
  }, [data]);

  if (data.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Нет данных за выбранный период.</div>;
  }

  const activeIndex = hover ?? (selectedDate ? data.findIndex((d) => d.date === selectedDate) : -1);
  const active = activeIndex >= 0 ? data[activeIndex] : null;

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} preserveAspectRatio="none">
        <line x1={PAD_X} y1={HEIGHT - PAD_BOTTOM} x2={WIDTH - PAD_X} y2={HEIGHT - PAD_BOTTOM} stroke="var(--grid-line)" strokeWidth="1" />
        <defs>
          <linearGradient id="anomalyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#anomalyFill)" />
        <path d={linePath} fill="none" stroke="var(--accent-2)" strokeWidth="2" />

        {points.map((p, i) => (
          <g key={p.d.date}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.d.isAnomaly ? 5 : 8}
              fill={p.d.isAnomaly ? "var(--neg)" : "transparent"}
              opacity={p.d.isAnomaly ? 0.9 : 0}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={10}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectDay(p.d.date)}
            />
            {p.d.date === selectedDate ? (
              <circle cx={p.x} cy={p.y} r={4} fill="var(--text)" />
            ) : null}
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)" }}>
        <span>{formatDate(data[0].date)}</span>
        {active ? (
          <span style={{ color: active.isAnomaly ? "var(--neg)" : "var(--text-dim)" }}>
            {formatDate(active.date)} · {active.count} сообщ. · z={active.z}
          </span>
        ) : (
          <span>max {maxCount} / день</span>
        )}
        <span>{formatDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
