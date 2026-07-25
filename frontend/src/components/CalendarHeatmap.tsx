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

function colorFor(count: number, max: number, posShare: number): string {
  if (count === 0) return "var(--grid-line-soft)";
  const intensity = Math.min(1, count / Math.max(max, 1));
  if (posShare < 0.35 && count > 0) {
    return `color-mix(in srgb, var(--neg) ${Math.round(30 + intensity * 70)}%, var(--bg-panel))`;
  }
  return `color-mix(in srgb, var(--accent) ${Math.round(30 + intensity * 70)}%, var(--bg-panel))`;
}

export function CalendarHeatmap({ posts, startDate, endDate, selectedDate, onSelectDay }: CalendarHeatmapProps) {
  const { cells, weeks, monthMarkers } = useMemo(() => calendarGrid(posts, startDate, endDate), [posts, startDate, endDate]);
  const max = Math.max(...cells.map((c) => c.count), 1);

  const columns: typeof cells[] = Array.from({ length: weeks }, () => []);
  for (const cell of cells) {
    columns[cell.weekIndex]?.push(cell);
  }

  return (
    <div className="calendar-wrap">
      <div className="calendar-months" style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, 16px)` }}>
        {Array.from({ length: weeks }).map((_, i) => {
          const marker = monthMarkers.find((m) => m.weekIndex === i);
          return <span key={i}>{marker?.label ?? ""}</span>;
        })}
      </div>
      <div className="calendar-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 13px)` }}>
        {columns.map((col, i) => (
          <div className="calendar-col" key={i}>
            {Array.from({ length: 7 }).map((_, weekday) => {
              const cell = col.find((c) => c.weekday === weekday);
              if (!cell) return <div key={weekday} />;
              return (
                <div
                  key={weekday}
                  className={`calendar-cell${cell.date === selectedDate ? " selected" : ""}`}
                  style={{ background: colorFor(cell.count, max, cell.posShare) }}
                  title={`${formatDate(cell.date)} · ${cell.count} сообщ.`}
                  onClick={() => cell.count > 0 && onSelectDay(cell.date)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
