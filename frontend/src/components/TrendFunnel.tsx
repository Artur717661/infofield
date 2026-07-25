type TrendFunnelProps = {
  stages: { label: string; value: number }[];
  onSelect: (label: string) => void;
};

export function TrendFunnel({ stages, onSelect }: TrendFunnelProps) {
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div>
      {stages.map((stage, i) => (
        <div key={stage.label} className="funnel-row clickable" onClick={() => onSelect(stage.label)}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{stage.label}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${Math.max((stage.value / max) * 100, 3)}%`,
                background: i < 2 ? "var(--accent-2)" : "var(--accent)",
              }}
            />
          </div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", textAlign: "right" }}>
            {stage.value}
          </span>
        </div>
      ))}
    </div>
  );
}
