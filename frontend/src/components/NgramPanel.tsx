type NgramPanelProps = {
  items: { label: string; value: number }[];
  color: string;
  emptyNote: string;
  selected?: string | null;
  onSelect: (term: string) => void;
};

export function NgramPanel({ items, color, emptyNote, selected, onSelect }: NgramPanelProps) {
  if (items.length === 0) {
    return <div className="panel-empty">{emptyNote}</div>;
  }

  const max = Math.max(...items.map((i) => i.value));

  return (
    <div className="ngram-list">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`bar-row${selected === item.label ? " selected" : ""}`}
          onClick={() => onSelect(item.label)}
          style={{ opacity: selected && selected !== item.label ? 0.45 : 1 }}
        >
          <span className="term">{item.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(item.value / max) * 100}%`, background: color }} />
          </span>
          <span className="count">{item.value}</span>
        </button>
      ))}
    </div>
  );
}
