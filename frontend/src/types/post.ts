export type PostSource = "tg" | "vk" | "unknown";

export type ApiPost = {
  id: string | number;
  date: string | null;
  src?: string;
  aud?: string[] | null;
  sent?: string | null;
  persons?: string[] | null;
  units?: string[] | null;
  events?: string[] | null;
  directions?: string[] | null;
  likes?: number | null;
  comments?: number | null;
  reposts?: number | null;
  views?: string | number | null;
  text?: string | null;
};

export type Post = {
  id: string;
  originalId: string | number;
  date: string;
  src: PostSource;
  text: string;
  hasRealText: boolean;
  aud: string[];
  sent: string;
  persons: string[];
  units: string[];
  events: string[];
  directions: string[];
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  engagement: number;
  isAdmissions: boolean;
};

export type FiltersState = {
  dateFrom: string;
  dateTo: string;
  sources: PostSource[];
  audiences: string[];
  sentiments: string[];
  query: string;
  admissionsOnly: boolean;
};

export type ChartDatum = {
  label: string;
  value: number;
};

export type Selection =
  | { kind: "day"; value: string; label: string }
  | { kind: "days"; value: string[]; label: string }
  /** Exact set of post ids — used where a date range would be too coarse. */
  | { kind: "posts"; value: string[]; label: string }
  | { kind: "sentiment"; value: string; label: string }
  | { kind: "unit"; value: string; label: string }
  | { kind: "person"; value: string; label: string }
  | { kind: "event"; value: string; label: string }
  | { kind: "direction"; value: string; label: string }
  | { kind: "ngram"; value: string; label: string }
  | { kind: "source"; value: string; label: string }
  | { kind: "admissions"; value: string; label: string }
  | null;
