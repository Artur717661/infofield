import { Post } from "../types/post";

export type DailyPoint = {
  date: string;
  count: number;
  pos: number;
  neu: number;
  neg: number;
  engagement: number;
  z: number;
  isAnomaly: boolean;
};

export type Kpis = {
  totalMentions: number;
  deltaPct: number | null;
  engagementRate: number;
  reach: number;
  loyaltyIndex: number;
  anomalyDays: number;
};

export function sentimentOf(post: Post): "pos" | "neu" | "neg" {
  if (post.sent === "pos" || post.sent === "neu" || post.sent === "neg") return post.sent;
  return "neu";
}

export function dailySeries(posts: Post[]): DailyPoint[] {
  const byDate = new Map<string, { count: number; pos: number; neu: number; neg: number; engagement: number }>();

  for (const post of posts) {
    const bucket = byDate.get(post.date) ?? { count: 0, pos: 0, neu: 0, neg: 0, engagement: 0 };
    bucket.count += 1;
    bucket[sentimentOf(post)] += 1;
    bucket.engagement += post.engagement;
    byDate.set(post.date, bucket);
  }

  const dates = [...byDate.keys()].sort();
  const counts = dates.map((d) => byDate.get(d)!.count);
  const mean = counts.reduce((s, v) => s + v, 0) / (counts.length || 1);
  const variance = counts.reduce((s, v) => s + (v - mean) ** 2, 0) / (counts.length || 1);
  const stdDev = Math.sqrt(variance) || 1;

  return dates.map((date) => {
    const bucket = byDate.get(date)!;
    const z = (bucket.count - mean) / stdDev;
    return {
      date,
      count: bucket.count,
      pos: bucket.pos,
      neu: bucket.neu,
      neg: bucket.neg,
      engagement: bucket.engagement,
      z: Number(z.toFixed(2)),
      isAnomaly: Math.abs(z) >= 2,
    };
  });
}

export function sentimentBreakdown(posts: Post[]) {
  const total = posts.length || 1;
  let pos = 0;
  let neu = 0;
  let neg = 0;
  for (const post of posts) {
    const s = sentimentOf(post);
    if (s === "pos") pos += 1;
    else if (s === "neg") neg += 1;
    else neu += 1;
  }
  return {
    pos,
    neu,
    neg,
    posPct: Math.round((pos / total) * 100),
    neuPct: Math.round((neu / total) * 100),
    negPct: Math.round((neg / total) * 100),
  };
}

export function computeKpis(posts: Post[], previousPosts: Post[], series: DailyPoint[]): Kpis {
  const total = posts.length;
  const engagementSum = posts.reduce((s, p) => s + p.engagement, 0);
  const reach = posts.reduce((s, p) => s + p.views, 0);
  const { pos, neg } = sentimentBreakdown(posts);

  const prevTotal = previousPosts.length;
  const deltaPct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  return {
    totalMentions: total,
    deltaPct,
    engagementRate: total > 0 ? Number((engagementSum / total).toFixed(1)) : 0,
    reach,
    loyaltyIndex: total > 0 ? Math.round(((pos - neg) / total) * 100) : 0,
    anomalyDays: series.filter((d) => d.isAnomaly).length,
  };
}

/** Weekly totals, for the KPI sparkline — daily counts are too noisy to read at 92px. */
export function weeklyTotals(series: DailyPoint[], buckets = 14): number[] {
  if (series.length === 0) return [];
  const size = Math.max(1, Math.ceil(series.length / buckets));
  const out: number[] = [];
  for (let i = 0; i < series.length; i += size) {
    out.push(series.slice(i, i + size).reduce((s, d) => s + d.count, 0));
  }
  return out;
}

export function anomalyDates(series: DailyPoint[]): string[] {
  return series.filter((d) => d.isAnomaly).map((d) => d.date);
}

export function shiftRangeBack(dateFrom: string, dateTo: string): [string, string] {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const spanMs = Math.max(to.getTime() - from.getTime(), 24 * 3600 * 1000);
  const prevTo = new Date(from.getTime() - 24 * 3600 * 1000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return [prevFrom.toISOString().slice(0, 10), prevTo.toISOString().slice(0, 10)];
}
