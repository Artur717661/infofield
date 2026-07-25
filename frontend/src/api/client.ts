import { ApiPost, Post, PostSource } from "../types/post";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

const ENDPOINTS = {
  telegram: `${API_BASE_URL}/telegram`,
  vk: `${API_BASE_URL}/vk`,
} as const;

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
}

function resolveSource(value: string | undefined): PostSource {
  if (value === "tg" || value === "vk") {
    return value;
  }

  return "unknown";
}

function normalizePost(raw: ApiPost, index: number): Post {
  const source = resolveSource(raw.src);
  const date = raw.date ?? "";
  const text = typeof raw.text === "string" && raw.text.trim().length > 0
    ? raw.text.trim()
    : "Текст поста недоступен: backend API не вернул поле text.";

  const likes = Math.max(0, Math.trunc(raw.likes ?? 0));
  const comments = Math.max(0, Math.trunc(raw.comments ?? 0));
  const reposts = Math.max(0, Math.trunc(raw.reposts ?? 0));
  const views = Math.max(0, Math.trunc(toNumber(raw.views)));

  return {
    id: `${source}-${String(raw.id ?? index)}`,
    originalId: raw.id ?? index,
    date,
    src: source,
    text,
    hasRealText: typeof raw.text === "string" && raw.text.trim().length > 0,
    aud: sanitizeStringArray(raw.aud),
    sent: raw.sent?.trim() || "unknown",
    persons: sanitizeStringArray(raw.persons),
    units: sanitizeStringArray(raw.units),
    events: sanitizeStringArray(raw.events),
    directions: sanitizeStringArray(raw.directions),
    likes,
    comments,
    reposts,
    views,
    engagement: likes + comments + reposts,
  };
}

async function fetchEndpoint(url: string): Promise<ApiPost[]> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected API response format");
  }

  return payload as ApiPost[];
}

export async function fetchPosts(): Promise<Post[]> {
  const [telegram, vk] = await Promise.all([
    fetchEndpoint(ENDPOINTS.telegram),
    fetchEndpoint(ENDPOINTS.vk),
  ]);

  return [...telegram, ...vk]
    .map(normalizePost)
    .sort((left, right) => right.date.localeCompare(left.date));
}

export { API_BASE_URL, ENDPOINTS };
