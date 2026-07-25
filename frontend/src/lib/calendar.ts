import { Post } from "../types/post";

export type CalendarCell = {
  date: string;
  count: number;
  posShare: number;
  weekIndex: number;
  weekday: number;
};

const MONTH_LABELS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function calendarGrid(posts: Post[], startDate: string, endDate: string) {
  const counts = new Map<string, { count: number; pos: number }>();
  for (const post of posts) {
    const bucket = counts.get(post.date) ?? { count: 0, pos: 0 };
    bucket.count += 1;
    if (post.sent === "pos") bucket.pos += 1;
    counts.set(post.date, bucket);
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const startWeekday = (start.getUTCDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - startWeekday);

  const cells: CalendarCell[] = [];
  const monthMarkers: { weekIndex: number; label: string }[] = [];
  let lastMonth = -1;
  const cursor = new Date(gridStart);
  let weekIndex = 0;

  while (cursor <= end) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const iso = cursor.toISOString().slice(0, 10);
      if (cursor >= start && cursor <= end) {
        const bucket = counts.get(iso) ?? { count: 0, pos: 0 };
        cells.push({
          date: iso,
          count: bucket.count,
          posShare: bucket.count > 0 ? bucket.pos / bucket.count : 0,
          weekIndex,
          weekday,
        });
        if (cursor.getUTCMonth() !== lastMonth && cursor.getUTCDate() <= 7) {
          lastMonth = cursor.getUTCMonth();
          monthMarkers.push({ weekIndex, label: MONTH_LABELS[lastMonth] });
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weekIndex += 1;
  }

  return { cells, weeks: weekIndex, monthMarkers };
}
