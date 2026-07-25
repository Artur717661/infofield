import { Kpis } from "../lib/metrics";
import { formatCompact, formatNumber, formatSigned } from "../lib/format";

type KpiRowProps = {
  kpis: Kpis;
  onAnomalyClick: () => void;
};

export function KpiRow({ kpis, onAnomalyClick }: KpiRowProps) {
  return (
    <div className="kpi-row">
      <div className="kpi-card">
        <div className="k">Объём упоминаний</div>
        <div className="v">
          {formatNumber(kpis.totalMentions)}
          {kpis.deltaPct !== null ? (
            <span className={`delta ${kpis.deltaPct >= 0 ? "up" : "down"}`}>{formatSigned(kpis.deltaPct)}%</span>
          ) : null}
        </div>
      </div>

      <div className="kpi-card">
        <div className="k">Вовлечённость / пост</div>
        <div className="v">{formatNumber(kpis.engagementRate)}</div>
      </div>

      <div className="kpi-card">
        <div className="k">Просмотры (охват)</div>
        <div className="v">{formatCompact(kpis.reach)}</div>
      </div>

      <div className="kpi-card">
        <div className="k">Индекс лояльности</div>
        <div className="v" style={{ color: kpis.loyaltyIndex >= 0 ? "var(--pos)" : "var(--neg)" }}>
          {formatSigned(kpis.loyaltyIndex)}
        </div>
      </div>

      <div className="kpi-card clickable" onClick={onAnomalyClick} role="button" tabIndex={0}>
        <div className="k">Дней-аномалий · σ ≥ 2</div>
        <div className="v" style={{ color: kpis.anomalyDays > 0 ? "var(--neg)" : "var(--text)" }}>
          {kpis.anomalyDays}
        </div>
      </div>
    </div>
  );
}
