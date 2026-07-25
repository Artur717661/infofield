import { Post } from "../types/post";
import { sentimentBreakdown } from "./metrics";
import type { FunnelStage } from "../components/TrendFunnel";

export type MonthlyBucket = {
  key: string;
  label: string;
  admissions: number;
  total: number;
  dates: string[];
};

export type AdmissionsSpotlight = {
  share: number;
  posts: Post[];
  engagementRate: number;
  overallEngagementRate: number;
  sentiment: ReturnType<typeof sentimentBreakdown>;
  monthly: MonthlyBucket[];
  funnel: FunnelStage[];
};

const MONTH_LABELS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[Number(month) - 1]} ${year.slice(2)}`;
}

export function admissionsSpotlight(allPosts: Post[]): AdmissionsSpotlight {
  const admissionsPosts = allPosts.filter((p) => p.isAdmissions);
  const totalEngagement = allPosts.reduce((s, p) => s + p.engagement, 0);
  const admissionsEngagement = admissionsPosts.reduce((s, p) => s + p.engagement, 0);

  const monthBuckets = new Map<string, { admissions: number; total: number; dates: Set<string> }>();
  for (const post of allPosts) {
    const key = post.date.slice(0, 7);
    const bucket = monthBuckets.get(key) ?? { admissions: 0, total: 0, dates: new Set<string>() };
    bucket.total += 1;
    bucket.dates.add(post.date);
    if (post.isAdmissions) bucket.admissions += 1;
    monthBuckets.set(key, bucket);
  }

  const monthly: MonthlyBucket[] = [...monthBuckets.keys()].sort().map((key) => {
    const bucket = monthBuckets.get(key)!;
    return {
      key,
      label: monthLabel(key),
      admissions: bucket.admissions,
      total: bucket.total,
      dates: [...bucket.dates],
    };
  });

  // Each stage is a subset of the previous one, so the funnel genuinely narrows
  // instead of mixing independent counts that could grow between stages.
  const discussed = admissionsPosts.filter((p) => p.comments > 0);
  const spread = discussed.filter((p) => p.reposts > 0);
  const amplified = spread.filter((p) => p.views >= 200);

  const ids = (list: Post[]) => list.map((p) => p.id);

  const funnel: FunnelStage[] = [
    {
      label: "Опубликовано",
      value: admissionsPosts.length,
      note: "Все публикации об ИТ-специалитете за период",
      selection: { kind: "admissions", value: "all", label: "ИТ-специалитет · все публикации" },
    },
    {
      label: "Обсудили",
      value: discussed.length,
      note: "Публикации, под которыми есть комментарии",
      selection: { kind: "posts", value: ids(discussed), label: "ИТ-специалитет · с обсуждением" },
    },
    {
      label: "Поделились",
      value: spread.length,
      note: "Из обсуждаемых — те, которые репостили",
      selection: { kind: "posts", value: ids(spread), label: "ИТ-специалитет · с репостами" },
    },
    {
      label: "Вышли за канал",
      value: amplified.length,
      note: "Из репощенных — те, что собрали 200+ просмотров",
      selection: { kind: "posts", value: ids(amplified), label: "ИТ-специалитет · широкий охват" },
    },
  ];

  return {
    share: allPosts.length > 0 ? Math.round((admissionsPosts.length / allPosts.length) * 100) : 0,
    posts: admissionsPosts,
    engagementRate: admissionsPosts.length > 0 ? Number((admissionsEngagement / admissionsPosts.length).toFixed(1)) : 0,
    overallEngagementRate: allPosts.length > 0 ? Number((totalEngagement / allPosts.length).toFixed(1)) : 0,
    sentiment: sentimentBreakdown(admissionsPosts),
    monthly,
    funnel,
  };
}
