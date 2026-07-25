import { TreemapNode } from "../lib/entities";

type EntityTreemapProps = {
  nodes: TreemapNode[];
  selected?: string | null;
  onSelect: (unit: string) => void;
};

function sentimentColor(sentiment: number): string {
  if (sentiment > 0.15) return "color-mix(in srgb, var(--pos) 55%, var(--bg-panel))";
  if (sentiment < -0.15) return "color-mix(in srgb, var(--neg) 55%, var(--bg-panel))";
  return "color-mix(in srgb, var(--accent) 45%, var(--bg-panel))";
}

// Greedy row packing: fills rows until a target sum, giving a treemap-like
// area encoding without a full squarified layout algorithm.
function packRows(nodes: TreemapNode[]): TreemapNode[][] {
  const total = nodes.reduce((s, n) => s + n.size, 0) || 1;
  const targetPerRow = total / 3;
  const rows: TreemapNode[][] = [[]];
  let rowSum = 0;

  for (const node of nodes) {
    const current = rows[rows.length - 1];
    if (rowSum >= targetPerRow && current.length > 0) {
      rows.push([]);
      rowSum = 0;
    }
    rows[rows.length - 1].push(node);
    rowSum += node.size;
  }
  return rows;
}

export function EntityTreemap({ nodes, selected, onSelect }: EntityTreemapProps) {
  if (nodes.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Нет данных о подразделениях.</div>;
  }

  const rows = packRows(nodes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, height: 180 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 4, flex: 1, minHeight: 0 }}>
          {row.map((node) => (
            <div
              key={node.name}
              className={`treemap-cell${selected === node.name ? " selected" : ""}`}
              style={{ flexGrow: node.size, flexBasis: 0, background: sentimentColor(node.sentiment), color: "var(--bg)" }}
              onClick={() => onSelect(node.name)}
              title={`${node.name} · ${node.size} упоминаний`}
            >
              {node.name}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
