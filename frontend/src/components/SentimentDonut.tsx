import { useState } from "react";

type SentimentDonutProps = {
  pos: number;
  neu: number;
  neg: number;
  selected?: string | null;
  onSelect: (sentiment: string) => void;
};

const COLORS: Record<string, string> = {
  pos: "var(--pos)",
  neu: "var(--neu)",
  neg: "var(--neg)",
};
const LABELS: Record<string, string> = { pos: "Позитив", neu: "Нейтрально", neg: "Негатив" };

const SIZE = 132;
const CENTER = SIZE / 2;
const RADIUS = 48;
const STROKE = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2.5; // degrees of breathing room between arcs

export function SentimentDonut({ pos, neu, neg, selected, onSelect }: SentimentDonutProps) {
  const [hover, setHover] = useState<string | null>(null);
  const total = pos + neu + neg;
  const data = [
    { id: "pos", value: pos },
    { id: "neu", value: neu },
    { id: "neg", value: neg },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return <div className="panel-empty">Нет публикаций в этом срезе.</div>;
  }

  const active = hover ?? selected ?? null;
  const activeEntry = active ? data.find((d) => d.id === active) : null;

  let offsetDeg = -90;

  return (
    <div className="donut-row">
      <div className="donut-figure">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label="Распределение тональности">
          {data.map((entry) => {
            const share = entry.value / total;
            const sweep = share * 360;
            const dash = (Math.max(sweep - GAP, 0.6) / 360) * CIRCUMFERENCE;
            const rotation = offsetDeg;
            offsetDeg += sweep;
            const dim = active !== null && active !== entry.id;

            return (
              <circle
                key={entry.id}
                className="donut-arc"
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={COLORS[entry.id]}
                strokeWidth={active === entry.id ? STROKE + 4 : STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                strokeLinecap="butt"
                opacity={dim ? 0.3 : 1}
                transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
                onMouseEnter={() => setHover(entry.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(entry.id)}
              />
            );
          })}
          <text x={CENTER} y={CENTER - 2} textAnchor="middle" className="donut-center-value">
            {activeEntry ? `${Math.round((activeEntry.value / total) * 100)}%` : total}
          </text>
          <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="donut-center-label">
            {activeEntry ? LABELS[activeEntry.id] : "публикаций"}
          </text>
        </svg>
      </div>

      <div className="donut-legend">
        {(["pos", "neu", "neg"] as const).map((id) => {
          const value = id === "pos" ? pos : id === "neu" ? neu : neg;
          return (
            <button
              key={id}
              type="button"
              className={`legend-item${selected === id ? " active" : ""}`}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(id)}
            >
              <span className="legend-dot" style={{ background: COLORS[id] }} />
              <span className="legend-label">{LABELS[id]}</span>
              <span className="legend-value">{Math.round((value / total) * 100)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
