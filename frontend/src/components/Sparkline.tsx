type SparklineProps = {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
};

export function Sparkline({ values, color = "var(--accent)", width = 92, height = 26 }: SparklineProps) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const stepX = width / (values.length - 1);

  const points = values.map((value, i) => ({
    x: i * stepX,
    y: height - 2 - ((value - min) / span) * (height - 4),
  }));

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx={last.x} cy={last.y} r="2.4" fill={color} />
    </svg>
  );
}
