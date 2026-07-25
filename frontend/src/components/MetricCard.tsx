import { formatNumber } from "../utils/analytics";

type MetricCardProps = {
  label: string;
  value: number;
  hint: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{formatNumber(value)}</strong>
      <span className="metric-hint">{hint}</span>
    </article>
  );
}
