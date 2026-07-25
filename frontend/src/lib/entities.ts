import { Post } from "../types/post";

export type TreemapNode = { name: string; size: number; sentiment: number };
export type RankSeriesPoint = { month: string; ranks: Record<string, number | null> };
export type GraphNode = { id: string; kind: "person" | "event"; size: number; angle: number; radius: number };
export type GraphEdge = { source: string; target: string; weight: number };

function countBy(posts: Post[], pick: (p: Post) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const value of pick(post)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

export function topBy(posts: Post[], pick: (p: Post) => string[], limit = 10): { label: string; value: number }[] {
  return [...countBy(posts, pick).entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "ru"))
    .slice(0, limit);
}

export function unitTreemap(posts: Post[], limit = 12): TreemapNode[] {
  const buckets = new Map<string, { size: number; posBalance: number }>();
  for (const post of posts) {
    for (const unit of post.units) {
      const bucket = buckets.get(unit) ?? { size: 0, posBalance: 0 };
      bucket.size += 1;
      bucket.posBalance += post.sent === "pos" ? 1 : post.sent === "neg" ? -1 : 0;
      buckets.set(unit, bucket);
    }
  }
  return [...buckets.entries()]
    .map(([name, b]) => ({ name, size: b.size, sentiment: b.size > 0 ? b.posBalance / b.size : 0 }))
    .sort((a, b) => b.size - a.size)
    .slice(0, limit);
}

const MONTH_LABELS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function personRankSeries(posts: Post[], topN = 5): { series: RankSeriesPoint[]; persons: string[] } {
  const totals = countBy(posts, (p) => p.persons);
  const topPersons = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);

  const monthBuckets = new Map<string, Map<string, number>>();
  for (const post of posts) {
    const month = post.date.slice(0, 7);
    if (!monthBuckets.has(month)) monthBuckets.set(month, new Map());
    const bucket = monthBuckets.get(month)!;
    for (const person of post.persons) {
      if (!topPersons.includes(person)) continue;
      bucket.set(person, (bucket.get(person) ?? 0) + 1);
    }
  }

  const months = [...monthBuckets.keys()].sort();
  const series = months.map((month) => {
    const bucket = monthBuckets.get(month)!;
    const ranked = topPersons
      .map((person) => ({ person, count: bucket.get(person) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const ranks: Record<string, number | null> = {};
    ranked.forEach((entry, index) => {
      ranks[entry.person] = entry.count > 0 ? index + 1 : null;
    });

    const monthIndex = Number(month.slice(5, 7)) - 1;
    return { month: MONTH_LABELS[monthIndex] ?? month, ranks };
  });

  return { series, persons: topPersons };
}

export function collocationGraph(posts: Post[], maxNodes = 9): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const personCounts = countBy(posts, (p) => p.persons);
  const eventCounts = countBy(posts, (p) => p.events);

  const topPersons = [...personCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.ceil(maxNodes / 2));
  const topEvents = [...eventCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.floor(maxNodes / 2) + 1);

  const personIds = new Set(topPersons.map(([name]) => name));
  const eventIds = new Set(topEvents.map(([name]) => name));

  const edgeWeights = new Map<string, number>();
  for (const post of posts) {
    for (const person of post.persons) {
      if (!personIds.has(person)) continue;
      for (const event of post.events) {
        if (!eventIds.has(event)) continue;
        const key = `${person}|||${event}`;
        edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
      }
    }
  }

  const nodes: GraphNode[] = [];
  topPersons.forEach(([name, count], idx) => {
    nodes.push({ id: name, kind: "person", size: count, angle: (idx / topPersons.length) * Math.PI * 2, radius: 0.9 });
  });
  topEvents.forEach(([name, count], idx) => {
    const offset = Math.PI / Math.max(topEvents.length, 1);
    nodes.push({ id: name, kind: "event", size: count, angle: (idx / topEvents.length) * Math.PI * 2 + offset, radius: 0.45 });
  });

  // Keep only the strongest edges so the graph reads as a network, not a hairball.
  const edges: GraphEdge[] = [...edgeWeights.entries()]
    .map(([key, weight]) => {
      const [source, target] = key.split("|||");
      return { source, target, weight };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 14);

  return { nodes, edges };
}
