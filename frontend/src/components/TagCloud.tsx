import type React from "react";

type TagCloudProps = {
  items: { label: string; value: number }[];
  onSelect: (label: string) => void;
};

export function TagCloud({ items, onSelect }: TagCloudProps) {
  if (items.length === 0) {
    return <div className="panel-empty">Недостаточно данных для облака тем.</div>;
  }

  const max = Math.max(...items.map((i) => i.value));
  const min = Math.min(...items.map((i) => i.value));
  const scale = (value: number) => 12.5 + ((value - min) / Math.max(max - min, 1)) * 15;

  return (
    <div className="tagcloud">
      {items.map((item) => {
        const weight = (item.value - min) / Math.max(max - min, 1);
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect(item.label)}
            title={`${item.value} упоминаний`}
            // Size goes through a custom property so CSS can cap it on narrow
            // screens; an inline font-size would outrank any media query.
            style={
              {
                "--tag-size": `${scale(item.value)}px`,
                color: weight > 0.66 ? "var(--accent)" : weight > 0.33 ? "var(--accent-2)" : "var(--text-dim)",
              } as React.CSSProperties
            }
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
