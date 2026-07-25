type AdmissionsMonthlyChartProps = {
  monthly: { month: string; admissions: number; total: number }[];
  onSelectMonth?: (month: string) => void;
};

export function AdmissionsMonthlyChart({ monthly, onSelectMonth }: AdmissionsMonthlyChartProps) {
  if (monthly.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Нет данных.</div>;
  }
  const max = Math.max(...monthly.map((m) => m.total), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150 }}>
      {monthly.map((m) => (
        <div
          key={m.month}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: onSelectMonth ? "pointer" : "default" }}
          onClick={() => onSelectMonth?.(m.month)}
        >
          <div style={{ position: "relative", width: "100%", height: 110, display: "flex", alignItems: "flex-end" }}>
            <div
              style={{
                width: "100%",
                height: `${(m.total / max) * 100}%`,
                background: "var(--grid-line-soft)",
                borderRadius: 4,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  width: "100%",
                  height: `${m.total > 0 ? (m.admissions / m.total) * 100 : 0}%`,
                  background: "var(--accent)",
                  borderRadius: "0 0 4px 4px",
                }}
              />
            </div>
          </div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>{m.month}</span>
        </div>
      ))}
    </div>
  );
}
