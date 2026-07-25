import { ChartDatum, FiltersState, Post, SummaryMetric } from "../types/post";

const ALL_VALUE = "all";

function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase();
}

function matchesArrayFilter(values: string[], selected: string): boolean {
  if (!selected || selected === ALL_VALUE) {
    return true;
  }

  const expected = normalizeFilterValue(selected);
  return values.some((value) => normalizeFilterValue(value) === expected);
}

function matchesText(post: Post, query: string): boolean {
  if (!query.trim()) {
    return true;
  }

  const normalized = normalizeFilterValue(query);
  const haystack = [
    post.text,
    post.sent,
    post.src,
    ...post.aud,
    ...post.units,
    ...post.directions,
    ...post.events,
    ...post.persons,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function isWithinDateRange(date: string, from: string, to: string): boolean {
  if (!date) {
    return false;
  }

  if (from && date < from) {
    return false;
  }

  if (to && date > to) {
    return false;
  }

  return true;
}

function countByValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value.trim();
    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function sortChartData(counts: Map<string, number>, limit?: number): ChartDatum[] {
  const items = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }

      return left.label.localeCompare(right.label, "ru");
    });

  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export function createDefaultFilters(): FiltersState {
  return {
    dateFrom: "",
    dateTo: "",
    audience: ALL_VALUE,
    sentiment: ALL_VALUE,
    unit: ALL_VALUE,
    direction: ALL_VALUE,
    event: ALL_VALUE,
    source: ALL_VALUE,
    query: "",
  };
}

export function filterPosts(posts: Post[], filters: FiltersState): Post[] {
  return posts.filter((post) => {
    if (!isWithinDateRange(post.date, filters.dateFrom, filters.dateTo)) {
      return false;
    }

    if (filters.source !== ALL_VALUE && post.src !== filters.source) {
      return false;
    }

    if (filters.sentiment !== ALL_VALUE && normalizeFilterValue(post.sent) !== normalizeFilterValue(filters.sentiment)) {
      return false;
    }

    if (!matchesArrayFilter(post.aud, filters.audience)) {
      return false;
    }

    if (!matchesArrayFilter(post.units, filters.unit)) {
      return false;
    }

    if (!matchesArrayFilter(post.directions, filters.direction)) {
      return false;
    }

    if (!matchesArrayFilter(post.events, filters.event)) {
      return false;
    }

    return matchesText(post, filters.query);
  });
}

export function calculateMetrics(posts: Post[]): SummaryMetric[] {
  const totalPosts = posts.length;
  const totalViews = posts.reduce((sum, post) => sum + post.views, 0);
  const totalLikes = posts.reduce((sum, post) => sum + post.likes, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.comments, 0);
  const totalReposts = posts.reduce((sum, post) => sum + post.reposts, 0);
  const averageEngagement = totalPosts > 0
    ? Number(((totalLikes + totalComments + totalReposts) / totalPosts).toFixed(1))
    : 0;

  return [
    { label: "Всего постов", value: totalPosts, hint: "Сумма публикаций после фильтрации" },
    { label: "Всего просмотров", value: totalViews, hint: "Views по всем источникам" },
    { label: "Всего лайков", value: totalLikes, hint: "Суммарные реакции" },
    { label: "Всего комментариев", value: totalComments, hint: "Комментарии и обсуждения" },
    { label: "Всего репостов", value: totalReposts, hint: "Поделились публикацией" },
    { label: "Средняя вовлеченность", value: averageEngagement, hint: "Likes + comments + reposts на пост" },
  ];
}

export function groupPostsByDate(posts: Post[]): ChartDatum[] {
  const counts = countByValues(posts.map((post) => post.date));
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function groupPostsByAudience(posts: Post[]): ChartDatum[] {
  return sortChartData(countByValues(posts.flatMap((post) => post.aud)));
}

export function groupPostsBySentiment(posts: Post[]): ChartDatum[] {
  return sortChartData(countByValues(posts.map((post) => post.sent)));
}

export function getTopDirections(posts: Post[], limit = 10): ChartDatum[] {
  return sortChartData(countByValues(posts.flatMap((post) => post.directions)), limit);
}

export function getTopUnits(posts: Post[], limit = 10): ChartDatum[] {
  return sortChartData(countByValues(posts.flatMap((post) => post.units)), limit);
}

export function getTopEvents(posts: Post[], limit = 10): ChartDatum[] {
  return sortChartData(countByValues(posts.flatMap((post) => post.events)), limit);
}

export function getEngagementByDate(posts: Post[]): ChartDatum[] {
  const counts = new Map<string, number>();

  for (const post of posts) {
    counts.set(post.date, (counts.get(post.date) ?? 0) + post.engagement);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function extractFilterOptions(posts: Post[]) {
  const unique = (values: string[]) =>
    [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "ru"));

  return {
    audiences: unique(posts.flatMap((post) => post.aud)),
    sentiments: unique(posts.map((post) => post.sent)),
    units: unique(posts.flatMap((post) => post.units)),
    directions: unique(posts.flatMap((post) => post.directions)),
    events: unique(posts.flatMap((post) => post.events)),
    sources: unique(posts.map((post) => post.src)),
  };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

export function hasActiveFilters(filters: FiltersState): boolean {
  return Object.entries(filters).some(([key, value]) => {
    if (key === "query" || key === "dateFrom" || key === "dateTo") {
      return value !== "";
    }

    return value !== ALL_VALUE;
  });
}
