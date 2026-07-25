type NgramPanelProps = {
  title: string;
  items: { label: string; value: number }[];
  color: string;
  selected?: string | null;
  onSelect: (term: string) => void;
};

export function NgramPanel({ title, items, color, selected, onSelect }: NgramPanelProps) {
  if (items.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Недостаточно текста для {title.toLowerCase()}.</div>;
  }
  const max = Math.max(...items.map((i) => i.value));

  return (
    <div>
      {items.map((item) => (
        <div
          key={item.label}
          className="bar-row"
          onClick={() => onSelect(item.label)}
          style={{ opacity: selected && selected !== item.label ? 0.5 : 1 }}
        >
          <span className="term">{item.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(item.value / max) * 100}%`, background: color }} />
          </div>
          <span className="count">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
