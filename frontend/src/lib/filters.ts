import { FiltersState, Post } from "../types/post";

export const DATA_MIN_DATE = "2026-01-01";
export const DATA_MAX_DATE = "2026-07-25";

export function createDefaultFilters(): FiltersState {
  return {
    dateFrom: DATA_MIN_DATE,
    dateTo: DATA_MAX_DATE,
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
  if (!query.trim()) {
    return true;
  }

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

export function hasActiveFilters(filters: FiltersState): boolean {
  return (
    filters.dateFrom !== DATA_MIN_DATE ||
    filters.dateTo !== DATA_MAX_DATE ||
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
    sources: unique(posts.map((p) => p.src)),
  };
}
