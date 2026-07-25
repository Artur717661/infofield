type TagCloudProps = {
  items: { label: string; value: number }[];
  onSelect: (label: string) => void;
};

export function TagCloud({ items, onSelect }: TagCloudProps) {
  if (items.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Недостаточно данных для облака тем.</div>;
  }

  const max = Math.max(...items.map((i) => i.value));
  const min = Math.min(...items.map((i) => i.value));
  const scale = (value: number) => 12 + ((value - min) / Math.max(max - min, 1)) * 16;

  return (
    <div className="tagcloud">
      {items.map((item, i) => (
        <button
          key={item.label}
          style={{ fontSize: scale(item.value), color: i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? "var(--accent-2)" : "var(--text-dim)" }}
          onClick={() => onSelect(item.label)}
          title={`${item.value} упоминаний`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
