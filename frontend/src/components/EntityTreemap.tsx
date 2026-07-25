import { useState } from "react";
import { TreemapNode } from "../lib/entities";

type EntityTreemapProps = {
  nodes: TreemapNode[];
  selected?: string | null;
  onSelect: (unit: string) => void;
};

function sentimentColor(sentiment: number): string {
  if (sentiment > 0.2) return "color-mix(in srgb, var(--pos) 52%, var(--bg-panel))";
  if (sentiment < -0.05) return "color-mix(in srgb, var(--neg) 52%, var(--bg-panel))";
  return "color-mix(in srgb, var(--accent) 48%, var(--bg-panel))";
}

// Greedy row packing: fills rows toward an equal share of the total, giving an
// area encoding that reads correctly without a full squarified layout.
function packRows(nodes: TreemapNode[], rowCount: number): TreemapNode[][] {
  const total = nodes.reduce((s, n) => s + n.size, 0) || 1;
  const target = total / rowCount;
  const rows: TreemapNode[][] = [[]];
  let rowSum = 0;

  for (const node of nodes) {
    if (rowSum >= target && rows.length < rowCount) {
      rows.push([]);
      rowSum = 0;
    }
    rows[rows.length - 1].push(node);
    rowSum += node.size;
  }
  return rows;
}

export function EntityTreemap({ nodes, selected, onSelect }: EntityTreemapProps) {
  const [hover, setHover] = useState<string | null>(null);

  if (nodes.length === 0) {
    return <div className="panel-empty">Нет данных о подразделениях.</div>;
  }

  const rows = packRows(nodes, Math.min(3, nodes.length));
  const active = hover ? nodes.find((n) => n.name === hover) : null;

  return (
    <div className="treemap-wrap">
      <div className="treemap-readout">
        {active ? (
          <>
            <b>{active.name}</b>
            <span>
              {active.size} упоминаний ·{" "}
              {active.sentiment > 0.2 ? "позитивный фон" : active.sentiment < -0.05 ? "негативный фон" : "нейтральный фон"}
            </span>
          </>
        ) : (
          <span className="monthly-legend">
            <i className="swatch pos" /> позитив
            <i className="swatch neu" /> нейтрально
            <i className="swatch neg" /> негатив
          </span>
        )}
      </div>

      <div className="treemap">
        {rows.map((row, i) => (
          // Row height tracks the row's share of the total, so area — not just
          // width — encodes mentions. Equal-height rows would misread.
          <div
            className="treemap-row"
            key={i}
            style={{ flexGrow: row.reduce((s, n) => s + n.size, 0) }}
          >
            {row.map((node) => (
              <button
                key={node.name}
                type="button"
                className={`treemap-cell${selected === node.name ? " selected" : ""}`}
                style={{ flexGrow: node.size, background: sentimentColor(node.sentiment) }}
                onMouseEnter={() => setHover(node.name)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(node.name)}
              >
                <span className="treemap-name">{node.name}</span>
                <span className="treemap-size">{node.size}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
