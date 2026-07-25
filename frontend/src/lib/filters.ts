import { FiltersState, Post, PostSource } from "../types/post";

export type DateBounds = { min: string; max: string };

// Fallback only — real bounds are derived from whatever the backend returns,
// so the dashboard follows the data instead of a hardcoded window.
export const FALLBACK_BOUNDS: DateBounds = { min: "2025-09-01", max: "2026-07-31" };

export function deriveBounds(posts: Post[]): DateBounds {
  const dates = posts.map((p) => p.date).filter(Boolean).sort();
  if (dates.length === 0) return FALLBACK_BOUNDS;
  return { min: dates[0], max: dates[dates.length - 1] };
}

export function createDefaultFilters(bounds: DateBounds = FALLBACK_BOUNDS): FiltersState {
  return {
    dateFrom: bounds.min,
    dateTo: bounds.max,
    sources: [],
    audiences: [],
    sentiments: [],
    query: "",
    admissionsOnly: false,
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesText(post: Post, query: string): boolean {
  if (!query.trim()) return true;

  const needle = normalize(query);
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

  return haystack.includes(needle);
}

export function filterPosts(posts: Post[], filters: FiltersState): Post[] {
  return posts.filter((post) => {
    if (filters.dateFrom && post.date < filters.dateFrom) return false;
    if (filters.dateTo && post.date > filters.dateTo) return false;
    if (filters.sources.length && !filters.sources.includes(post.src)) return false;
    if (filters.sentiments.length && !filters.sentiments.includes(post.sent)) return false;
    if (filters.audiences.length && !post.aud.some((a) => filters.audiences.includes(a))) return false;
    if (filters.admissionsOnly && !post.isAdmissions) return false;
    return matchesText(post, filters.query);
  });
}

export function hasActiveFilters(filters: FiltersState, bounds: DateBounds): boolean {
  return (
    filters.dateFrom !== bounds.min ||
    filters.dateTo !== bounds.max ||
    filters.sources.length > 0 ||
    filters.audiences.length > 0 ||
    filters.sentiments.length > 0 ||
    filters.admissionsOnly ||
    filters.query.trim() !== ""
  );
}

export function extractFilterOptions(posts: Post[]) {
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  return {
    audiences: unique(posts.flatMap((p) => p.aud)),
    sources: unique(posts.map((p) => p.src)) as PostSource[],
  };
}

export type RangePreset = { id: string; label: string; resolve: (bounds: DateBounds) => [string, string] };

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clamp(value: string, bounds: DateBounds): string {
  if (value < bounds.min) return bounds.min;
  if (value > bounds.max) return bounds.max;
  return value;
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: "all", label: "Весь период", resolve: (b) => [b.min, b.max] },
  { id: "90d", label: "90 дней", resolve: (b) => [clamp(shiftDays(b.max, -89), b), b.max] },
  { id: "30d", label: "30 дней", resolve: (b) => [clamp(shiftDays(b.max, -29), b), b.max] },
  {
    // The admissions window is what this dashboard exists to watch.
    id: "admissions",
    label: "Приёмная кампания",
    resolve: (b) => [clamp(`${b.max.slice(0, 4)}-04-01`, b), b.max],
  },
];

export function activePresetId(filters: FiltersState, bounds: DateBounds): string | null {
  for (const preset of RANGE_PRESETS) {
    const [from, to] = preset.resolve(bounds);
    if (filters.dateFrom === from && filters.dateTo === to) return preset.id;
  }
  return null;
}
