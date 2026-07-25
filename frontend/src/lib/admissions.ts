import { Post } from "../types/post";
import { sentimentBreakdown } from "./metrics";

export type AdmissionsSpotlight = {
  share: number;
  posts: Post[];
  engagementRate: number;
  overallEngagementRate: number;
  sentiment: ReturnType<typeof sentimentBreakdown>;
  monthly: { month: string; admissions: number; total: number }[];
  funnel: { label: string; value: number }[];
};

const MONTH_LABELS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function admissionsSpotlight(allPosts: Post[]): AdmissionsSpotlight {
  const admissionsPosts = allPosts.filter((p) => p.isAdmissions);
  const totalEngagement = allPosts.reduce((s, p) => s + p.engagement, 0);
  const admissionsEngagement = admissionsPosts.reduce((s, p) => s + p.engagement, 0);

  const monthBuckets = new Map<string, { admissions: number; total: number }>();
  for (const post of allPosts) {
    const month = post.date.slice(0, 7);
    const bucket = monthBuckets.get(month) ?? { admissions: 0, total: 0 };
    bucket.total += 1;
    if (post.isAdmissions) bucket.admissions += 1;
    monthBuckets.set(month, bucket);
  }

  const monthly = [...monthBuckets.keys()].sort().map((month) => {
    const bucket = monthBuckets.get(month)!;
    const monthIndex = Number(month.slice(5, 7)) - 1;
    return { month: MONTH_LABELS[monthIndex] ?? month, ...bucket };
  });

  // Each stage narrows the previous one so the funnel actually funnels,
  // instead of mixing independent counts that could grow between stages.
  const discussed = admissionsPosts.filter((p) => p.comments > 0);
  const postRelease = discussed.filter(
    (p) => p.events.some((e) => e.includes("Приёмная кампания")) || /итог|зачисл/i.test(p.text)
  );
  const reshared = postRelease.filter((p) => p.reposts > 0);

  return {
    share: allPosts.length > 0 ? Math.round((admissionsPosts.length / allPosts.length) * 100) : 0,
    posts: admissionsPosts,
    engagementRate: admissionsPosts.length > 0 ? Number((admissionsEngagement / admissionsPosts.length).toFixed(1)) : 0,
    overallEngagementRate: allPosts.length > 0 ? Number((totalEngagement / allPosts.length).toFixed(1)) : 0,
    sentiment: sentimentBreakdown(admissionsPosts),
    monthly,
    funnel: [
      { label: "Анонс", value: admissionsPosts.length },
      { label: "Обсуждение", value: discussed.length },
      { label: "Пост-релиз", value: postRelease.length },
      { label: "Повторный охват", value: reshared.length },
    ],
  };
}
