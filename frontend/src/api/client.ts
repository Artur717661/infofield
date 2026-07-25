import { ApiPost, Post, PostSource } from "../types/post";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

const ENDPOINTS = {
  telegram: `${API_BASE_URL}/telegram`,
  vk: `${API_BASE_URL}/vk`,
} as const;

// Deliberately narrow to the IT specialty itself, not general admissions
// terms ("день открытых дверей", "приёмная комиссия") that other faculties
// and departments use too — otherwise the admissions share-of-voice inflates
// with unrelated programs and stops answering "how visible is IT-специалитет".
const ADMISSIONS_MARKERS = ["ит-специалитет"];

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

function detectAdmissions(text: string, units: string[], events: string[]): boolean {
  const haystack = [text, ...units, ...events].join(" ").toLowerCase();
  return ADMISSIONS_MARKERS.some((marker) => haystack.includes(marker));
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
  const units = sanitizeStringArray(raw.units);
  const events = sanitizeStringArray(raw.events);

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
    units,
    events,
    directions: sanitizeStringArray(raw.directions),
    likes,
    comments,
    reposts,
    views,
    engagement: likes + comments + reposts,
    isAdmissions: detectAdmissions(text, units, events),
  };
}

async function fetchEndpoint(url: string): Promise<ApiPost[]> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    // Same-origin API by design: never forward cookies/credentials cross-origin.
    credentials: "omit",
    referrerPolicy: "no-referrer",
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
