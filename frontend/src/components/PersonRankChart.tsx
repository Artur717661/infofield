import { useMemo, useState } from "react";
import { RankSeriesPoint } from "../lib/entities";

type PersonRankChartProps = {
  series: RankSeriesPoint[];
  persons: string[];
  selected?: string | null;
  onSelect: (person: string) => void;
};

const COLORS = ["#ffb238", "#56e8d0", "#8b7bd8", "#4ade80", "#ff8fa3"];
const WIDTH = 420;
const HEIGHT = 156;
const PAD_X = 26;
const PAD_Y = 22;

export function PersonRankChart({ series, persons, selected, onSelect }: PersonRankChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const maxRank = Math.max(persons.length, 2);

  const lines = useMemo(() => {
    if (series.length < 2) return [];
    const stepX = (WIDTH - PAD_X * 2) / (series.length - 1);
    const innerH = HEIGHT - PAD_Y * 2;

    return persons.map((person, index) => {
      const pts: { x: number; y: number }[] = [];
      series.forEach((point, i) => {
        const rank = point.ranks[person];
        if (rank == null) return;
        pts.push({
          x: PAD_X + i * stepX,
          y: PAD_Y + ((rank - 1) / (maxRank - 1)) * innerH,
        });
      });
      return {
        person,
        color: COLORS[index % COLORS.length],
        d: pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
        pts,
      };
    });
  }, [series, persons, maxRank]);

  if (series.length < 2 || persons.length === 0) {
    return <div className="panel-empty">Недостаточно данных для рейтинга — нужно минимум два месяца с упоминаниями персон.</div>;
  }

  const active = hover ?? selected ?? null;

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Рейтинг персон по месяцам">
        <text x={4} y={PAD_Y + 3} fontFamily="var(--mono)" fontSize="8.5" fill="var(--text-faint)">#1</text>
        <text x={4} y={HEIGHT - PAD_Y + 3} fontFamily="var(--mono)" fontSize="8.5" fill="var(--text-faint)">
          #{maxRank}
        </text>

        {lines.map(({ person, color, d, pts }) => (
          <g
            key={person}
            opacity={active && active !== person ? 0.22 : 1}
            style={{ cursor: "pointer", transition: "opacity 0.15s ease" }}
            onMouseEnter={() => setHover(person)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(person)}
          >
            <path d={d} fill="none" stroke={color} strokeWidth={active === person ? 2.6 : 1.8} strokeLinejoin="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2.6} fill={color} />
            ))}
          </g>
        ))}

        {series.map((point, i) => (
          <text
            key={point.month + i}
            x={PAD_X + i * ((WIDTH - PAD_X * 2) / (series.length - 1))}
            y={HEIGHT - 4}
            textAnchor="middle"
            fontFamily="var(--mono)"
            fontSize="8.5"
            fill="var(--text-faint)"
          >
            {point.month}
          </text>
        ))}
      </svg>

      <div className="rank-legend">
        {persons.map((person, i) => (
          <button
            key={person}
            type="button"
            className={selected === person ? "active" : ""}
            onMouseEnter={() => setHover(person)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(person)}
          >
            <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
            {person}
          </button>
        ))}
      </div>
    </div>
  );
}
