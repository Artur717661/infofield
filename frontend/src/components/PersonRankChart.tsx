import { useMemo, useState } from "react";
import { RankSeriesPoint } from "../lib/entities";

type PersonRankChartProps = {
  series: RankSeriesPoint[];
  persons: string[];
  selected?: string | null;
  onSelect: (person: string) => void;
};

const COLORS = ["#ffb238", "#56e8d0", "#8b7bd8", "#4ade80", "#ff5468"];
const WIDTH = 560;
const HEIGHT = 150;
const PAD = 18;

export function PersonRankChart({ series, persons, selected, onSelect }: PersonRankChartProps) {
  const [hoverPerson, setHoverPerson] = useState<string | null>(null);
  const maxRank = persons.length;

  const paths = useMemo(() => {
    if (series.length < 2) return [];
    const stepX = (WIDTH - PAD * 2) / (series.length - 1);
    const innerH = HEIGHT - PAD * 2;

    return persons.map((person, personIndex) => {
      const pts: { x: number; y: number }[] = [];
      series.forEach((point, i) => {
        const rank = point.ranks[person];
        if (rank == null) return;
        const x = PAD + i * stepX;
        const y = PAD + ((rank - 1) / Math.max(maxRank - 1, 1)) * innerH;
        pts.push({ x, y });
      });
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      return { person, d, color: COLORS[personIndex % COLORS.length], pts };
    });
  }, [series, persons, maxRank]);

  if (series.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Недостаточно данных для рейтинга.</div>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT}>
        {paths.map(({ person, d, color, pts }) => (
          <g
            key={person}
            opacity={hoverPerson && hoverPerson !== person ? 0.25 : selected && selected !== person ? 0.3 : 1}
            style={{ cursor: "pointer", transition: "opacity 0.15s ease" }}
            onMouseEnter={() => setHoverPerson(person)}
            onMouseLeave={() => setHoverPerson(null)}
            onClick={() => onSelect(person)}
          >
            <path d={d} fill="none" stroke={color} strokeWidth={selected === person ? 3 : 2} />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
            ))}
          </g>
        ))}
        <text x={PAD} y={PAD - 6} fontFamily="var(--mono)" fontSize="9" fill="var(--text-faint)">#1</text>
        <text x={PAD} y={HEIGHT - PAD + 12} fontFamily="var(--mono)" fontSize="9" fill="var(--text-faint)">#{maxRank}</text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
        {persons.map((person, i) => (
          <button
            key={person}
            onClick={() => onSelect(person)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
              fontSize: 11.5, color: selected === person ? "var(--text)" : "var(--text-dim)", padding: 0,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length] }} />
            {person}
          </button>
        ))}
      </div>
    </div>
  );
}
