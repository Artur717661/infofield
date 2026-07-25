import { useMemo } from "react";
import { Post } from "../types/post";
import { calendarGrid } from "../lib/calendar";
import { formatDate } from "../lib/format";

type CalendarHeatmapProps = {
  posts: Post[];
  startDate: string;
  endDate: string;
  selectedDate?: string | null;
  onSelectDay: (date: string) => void;
};

function colorFor(count: number, max: number, posShare: number, negShare: number): string {
  if (count === 0) return "var(--grid-line-soft)";
  const intensity = Math.round(28 + Math.min(1, count / Math.max(max, 1)) * 72);
  // A day where negativity outweighs positivity reads red regardless of volume —
  // that's the signal an operator needs to catch first.
  if (negShare > posShare) {
    return `color-mix(in srgb, var(--neg) ${intensity}%, var(--bg-panel))`;
  }
  return `color-mix(in srgb, var(--accent) ${intensity}%, var(--bg-panel))`;
}

export function CalendarHeatmap({ posts, startDate, endDate, selectedDate, onSelectDay }: CalendarHeatmapProps) {
  const { cells, weeks, monthMarkers } = useMemo(
    () => calendarGrid(posts, startDate, endDate),
    [posts, startDate, endDate]
  );

  const max = Math.max(...cells.map((c) => c.count), 1);
  const byPosition = new Map(cells.map((c) => [`${c.weekIndex}:${c.weekday}`, c]));

  if (cells.length === 0) {
    return <div className="panel-empty">Нет данных за выбранный период.</div>;
  }

  return (
    <div className="calendar-wrap">
      <div className="calendar-inner">
        <div className="calendar-months">
          {Array.from({ length: weeks }).map((_, i) => {
            const marker = monthMarkers.find((m) => m.weekIndex === i);
            return (
              <span key={i} className="calendar-month-label" style={{ width: 15 }}>
                {marker?.label ?? ""}
              </span>
            );
          })}
        </div>

        <div className="calendar-grid">
          {Array.from({ length: weeks }).map((_, weekIndex) => (
            <div className="calendar-col" key={weekIndex}>
              {Array.from({ length: 7 }).map((_, weekday) => {
                const cell = byPosition.get(`${weekIndex}:${weekday}`);
                if (!cell) return <span key={weekday} className="calendar-cell empty" />;

                return (
                  <button
                    key={weekday}
                    type="button"
                    className={`calendar-cell${cell.date === selectedDate ? " selected" : ""}${cell.count === 0 ? " empty" : ""}`}
                    style={{ background: colorFor(cell.count, max, cell.posShare, cell.negShare) }}
                    title={`${formatDate(cell.date)} · ${cell.count} публикаций`}
                    aria-label={`${formatDate(cell.date)}, ${cell.count} публикаций`}
                    disabled={cell.count === 0}
                    onClick={() => onSelectDay(cell.date)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="calendar-legend">
        <span>меньше</span>
        <span className="scale">
          {[0.15, 0.4, 0.65, 0.9].map((step) => (
            <span key={step} style={{ background: `color-mix(in srgb, var(--accent) ${step * 100}%, var(--bg-panel))` }} />
          ))}
        </span>
        <span>больше</span>
        <span style={{ marginLeft: 10, color: "var(--neg)" }}>■</span>
        <span>перевес негатива</span>
      </div>
    </div>
  );
}
