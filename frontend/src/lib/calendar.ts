import { Post } from "../types/post";

export type CalendarCell = {
  date: string;
  count: number;
  posShare: number;
  negShare: number;
  weekIndex: number;
  weekday: number;
};

const MONTH_LABELS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function calendarGrid(posts: Post[], startDate: string, endDate: string) {
  const counts = new Map<string, { count: number; pos: number; neg: number }>();
  for (const post of posts) {
    const bucket = counts.get(post.date) ?? { count: 0, pos: 0, neg: 0 };
    bucket.count += 1;
    if (post.sent === "pos") bucket.pos += 1;
    if (post.sent === "neg") bucket.neg += 1;
    counts.set(post.date, bucket);
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return { cells: [] as CalendarCell[], weeks: 0, monthMarkers: [] as { weekIndex: number; label: string }[] };
  }

  // Align the grid to Monday so weekday rows stay consistent across ranges.
  const startWeekday = (start.getUTCDay() + 6) % 7;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() - startWeekday);

  const cells: CalendarCell[] = [];
  const monthMarkers: { weekIndex: number; label: string }[] = [];
  let lastMonth = -1;
  let weekIndex = 0;

  while (cursor <= end) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const iso = cursor.toISOString().slice(0, 10);
      if (cursor >= start && cursor <= end) {
        const bucket = counts.get(iso) ?? { count: 0, pos: 0, neg: 0 };
        cells.push({
          date: iso,
          count: bucket.count,
          posShare: bucket.count > 0 ? bucket.pos / bucket.count : 0,
          negShare: bucket.count > 0 ? bucket.neg / bucket.count : 0,
          weekIndex,
          weekday,
        });

        const month = cursor.getUTCMonth();
        if (month !== lastMonth && cursor.getUTCDate() <= 7) {
          lastMonth = month;
          monthMarkers.push({ weekIndex, label: MONTH_LABELS[month] });
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weekIndex += 1;
  }

  return { cells, weeks: weekIndex, monthMarkers };
}
