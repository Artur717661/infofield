import { useState } from "react";
import { MonthlyBucket } from "../lib/admissions";

type AdmissionsMonthlyChartProps = {
  monthly: MonthlyBucket[];
  onSelectMonth?: (month: MonthlyBucket) => void;
};

export function AdmissionsMonthlyChart({ monthly, onSelectMonth }: AdmissionsMonthlyChartProps) {
  const [hover, setHover] = useState<string | null>(null);

  if (monthly.length === 0) {
    return <div className="panel-empty">Нет данных за период.</div>;
  }

  const max = Math.max(...monthly.map((m) => m.total), 1);
  const active = hover ? monthly.find((m) => m.key === hover) : null;

  return (
    <div className="monthly-chart">
      <div className="monthly-readout">
        {active ? (
          <>
            <b>{active.label}</b>
            <span>
              {active.admissions} из {active.total} — ИТ-специалитет
              {active.total > 0 ? ` (${Math.round((active.admissions / active.total) * 100)}%)` : ""}
            </span>
          </>
        ) : (
          <span className="monthly-legend">
            <i className="swatch admissions" /> ИТ-специалитет
            <i className="swatch total" /> остальной поток
          </span>
        )}
      </div>

      <div className="monthly-bars">
        {monthly.map((m) => (
          <button
            key={m.key}
            type="button"
            className="monthly-bar"
            onMouseEnter={() => setHover(m.key)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelectMonth?.(m)}
            aria-label={`${m.label}: ${m.admissions} из ${m.total}`}
          >
            <span className="monthly-col" style={{ height: `${(m.total / max) * 100}%` }}>
              <span
                className="monthly-col-admissions"
                style={{ height: `${m.total > 0 ? (m.admissions / m.total) * 100 : 0}%` }}
              />
            </span>
            <span className="monthly-label">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
