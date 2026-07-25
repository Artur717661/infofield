import { Selection } from "../types/post";

export type FunnelStage = {
  label: string;
  value: number;
  note: string;
  selection: Selection;
};

type TrendFunnelProps = {
  stages: FunnelStage[];
  onSelect: (selection: Selection) => void;
};

export function TrendFunnel({ stages, onSelect }: TrendFunnelProps) {
  const max = Math.max(...stages.map((s) => s.value), 1);

  if (max === 0) {
    return <div className="panel-empty">Нет публикаций для воронки.</div>;
  }

  return (
    <div className="funnel">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const conversion = prev && prev > 0 ? Math.round((stage.value / prev) * 100) : null;

        return (
          <button
            key={stage.label}
            type="button"
            className="funnel-row"
            onClick={() => onSelect(stage.selection)}
            title={stage.note}
          >
            <span className="funnel-label">{stage.label}</span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{
                  width: `${Math.max((stage.value / max) * 100, 2)}%`,
                  background: i < 2 ? "var(--accent-2)" : "var(--accent)",
                }}
              />
            </span>
            <span className="funnel-value">
              {stage.value}
              {conversion !== null ? <em>{conversion}%</em> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
