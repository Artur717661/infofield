import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type SentimentDonutProps = {
  pos: number;
  neu: number;
  neg: number;
  selected?: string | null;
  onSelect: (sentiment: string) => void;
};

const COLORS: Record<string, string> = {
  pos: "#4ade80",
  neu: "#8b85a6",
  neg: "#ff5468",
};
const LABELS: Record<string, string> = { pos: "Позитив", neu: "Нейтрально", neg: "Негатив" };

export function SentimentDonut({ pos, neu, neg, selected, onSelect }: SentimentDonutProps) {
  const total = pos + neu + neg || 1;
  const data = [
    { id: "pos", value: pos },
    { id: "neu", value: neu },
    { id: "neg", value: neg },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 130, height: 130, flexShrink: 0 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="id"
              innerRadius={38}
              outerRadius={60}
              paddingAngle={2}
              stroke="none"
              animationDuration={600}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={COLORS[entry.id]}
                  opacity={selected && selected !== entry.id ? 0.35 : 1}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelect(entry.id)}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name, item) => [`${value} (${Math.round((value / total) * 100)}%)`, LABELS[item.payload.id]]}
              contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--grid-line)", borderRadius: 8, fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {data.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onSelect(entry.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: selected === entry.id ? "var(--text)" : "var(--text-dim)",
              fontSize: 13,
              padding: 0,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[entry.id] }} />
            {LABELS[entry.id]}
            <span style={{ fontFamily: "var(--mono)", color: "var(--text-faint)" }}>
              {Math.round((entry.value / total) * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
