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
};

export type FiltersState = {
  dateFrom: string;
  dateTo: string;
  audience: string;
  sentiment: string;
  unit: string;
  direction: string;
  event: string;
  source: string;
  query: string;
};

export type SummaryMetric = {
  label: string;
  value: number;
  hint: string;
};

export type ChartDatum = {
  label: string;
  value: number;
};
