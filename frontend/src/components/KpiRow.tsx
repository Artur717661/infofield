import { Kpis } from "../lib/metrics";
import { formatCompact, formatNumber, formatSigned } from "../lib/format";
import { Sparkline } from "./Sparkline";

type KpiRowProps = {
  kpis: Kpis;
  trend: number[];
  onAnomalyClick: () => void;
  onNegativeClick: () => void;
};

export function KpiRow({ kpis, trend, onAnomalyClick, onNegativeClick }: KpiRowProps) {
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
        <Sparkline values={trend} color="var(--accent)" />
      </div>

      <div className="kpi-card">
        <div className="k">Вовлечённость / пост</div>
        <div className="v">{formatNumber(kpis.engagementRate)}</div>
        <div className="kpi-sub">лайки + комментарии + репосты</div>
      </div>

      <div className="kpi-card">
        <div className="k">Просмотры</div>
        <div className="v">{formatCompact(kpis.reach)}</div>
        <div className="kpi-sub">суммарный охват публикаций</div>
      </div>

      <button type="button" className="kpi-card interactive" onClick={onNegativeClick}>
        <div className="k">Индекс лояльности</div>
        <div className="v" style={{ color: kpis.loyaltyIndex >= 0 ? "var(--pos)" : "var(--neg)" }}>
          {formatSigned(kpis.loyaltyIndex)}
        </div>
        <div className="kpi-sub">(позитив − негатив) / всего</div>
      </button>

      <button type="button" className="kpi-card interactive" onClick={onAnomalyClick}>
        <div className="k">Дней-аномалий</div>
        <div className="v" style={{ color: kpis.anomalyDays > 0 ? "var(--accent)" : undefined }}>
          {kpis.anomalyDays}
        </div>
        <div className="kpi-sub">отклонение σ ≥ 2 от нормы</div>
      </button>
    </div>
  );
}
