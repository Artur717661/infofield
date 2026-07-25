import { useMemo, useState } from "react";
import { GraphEdge, GraphNode } from "../lib/entities";

type CollocationGraphProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selected?: string | null;
  onSelectPerson: (person: string) => void;
  onSelectEvent: (event: string) => void;
};

const SIZE = 360;
const CENTER = SIZE / 2;
const MAX_R = SIZE * 0.4;

export function CollocationGraph({ nodes, edges, selected, onSelectPerson, onSelectEvent }: CollocationGraphProps) {
  const [hover, setHover] = useState<string | null>(null);

  const positioned = useMemo(() => {
    const maxSize = Math.max(...nodes.map((n) => n.size), 1);
    return nodes.map((n) => ({
      ...n,
      x: CENTER + Math.cos(n.angle) * MAX_R * n.radius,
      y: CENTER + Math.sin(n.angle) * MAX_R * n.radius,
      r: 6 + (n.size / maxSize) * 16,
    }));
  }, [nodes]);

  const byId = new Map(positioned.map((n) => [n.id, n]));
  const maxWeight = Math.max(...edges.map((e) => e.weight), 1);

  if (nodes.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Недостаточно совместных упоминаний.</div>;
  }

  const activeId = hover ?? selected ?? null;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height={280}>
      {edges.map((edge, i) => {
        const a = byId.get(edge.source);
        const b = byId.get(edge.target);
        if (!a || !b) return null;
        const dim = activeId && activeId !== edge.source && activeId !== edge.target;
        return (
          <line
            key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={dim ? "var(--grid-line)" : "var(--accent-2)"}
            strokeWidth={1 + (edge.weight / maxWeight) * 3}
            opacity={dim ? 0.3 : 0.7}
          />
        );
      })}
      {positioned.map((node) => (
        <g
          key={node.id}
          style={{ cursor: "pointer" }}
          opacity={activeId && activeId !== node.id ? 0.4 : 1}
          onMouseEnter={() => setHover(node.id)}
          onMouseLeave={() => setHover(null)}
          onClick={() => (node.kind === "person" ? onSelectPerson(node.id) : onSelectEvent(node.id))}
        >
          <circle
            cx={node.x} cy={node.y} r={node.r}
            fill={node.kind === "person" ? "var(--accent)" : "var(--accent-2)"}
            opacity={selected === node.id ? 1 : 0.85}
            stroke={selected === node.id ? "var(--text)" : "none"}
            strokeWidth={2}
          />
          {activeId === node.id ? (
            <text
              x={node.x}
              y={node.y + node.r + 13}
              textAnchor="middle"
              fontFamily="var(--mono)"
              fontSize="10.5"
              fill="var(--text)"
            >
              {node.id.length > 22 ? `${node.id.slice(0, 21)}…` : node.id}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
