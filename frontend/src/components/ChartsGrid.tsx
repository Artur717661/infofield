import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartDatum } from "../types/post";
import { EmptyState } from "./EmptyState";

const PIE_COLORS = ["#0f766e", "#f59e0b", "#ef4444", "#6366f1", "#ec4899", "#8b5cf6"];

type ChartCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <article className="panel chart-card">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

function ChartFallback({ description }: { description: string }) {
  return <EmptyState title="Нет данных для отображения" description={description} />;
}

function BasicTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span>{payload[0]?.value ?? 0}</span>
    </div>
  );
}

function VerticalBarChart({
  data,
  color,
}: {
  data: ChartDatum[];
  color: string;
}) {
  if (data.length === 0) {
    return <ChartFallback description="Попробуйте изменить фильтры или дождитесь появления данных в backend." />;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
        <XAxis type="number" stroke="var(--muted-color)" />
        <YAxis dataKey="label" type="category" width={140} stroke="var(--muted-color)" />
        <Tooltip content={<BasicTooltip />} />
        <Bar dataKey="value" fill={color} radius={[0, 10, 10, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type ChartsGridProps = {
  postsByDate: ChartDatum[];
  audiences: ChartDatum[];
  sentiments: ChartDatum[];
  directions: ChartDatum[];
  units: ChartDatum[];
  events: ChartDatum[];
  engagement: ChartDatum[];
};

export function ChartsGrid(props: ChartsGridProps) {
  const { postsByDate, audiences, sentiments, directions, units, events, engagement } = props;

  return (
    <section className="charts-grid">
      <ChartCard title="Посты по датам" subtitle="Количество публикаций в выбранном периоде">
        {postsByDate.length === 0 ? (
          <ChartFallback description="Нет постов, подходящих под текущие фильтры." />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={postsByDate} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
              <XAxis dataKey="label" stroke="var(--muted-color)" />
              <YAxis allowDecimals={false} stroke="var(--muted-color)" />
              <Tooltip content={<BasicTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Аудитории" subtitle="На какие аудитории чаще направлены посты">
        <VerticalBarChart data={audiences} color="#0ea5e9" />
      </ChartCard>

      <ChartCard title="Тональность" subtitle="Распределение публикаций по sentiment">
        {sentiments.length === 0 ? (
          <ChartFallback description="Тональность появится, когда backend вернет размеченные данные." />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={sentiments}
                dataKey="value"
                nameKey="label"
                innerRadius={72}
                outerRadius={108}
                paddingAngle={4}
              >
                {sentiments.map((entry, index) => (
                  <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<BasicTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Топ направлений" subtitle="10 самых частых направлений">
        <VerticalBarChart data={directions} color="#8b5cf6" />
      </ChartCard>

      <ChartCard title="Топ подразделений" subtitle="10 самых частых подразделений">
        <VerticalBarChart data={units} color="#f97316" />
      </ChartCard>

      <ChartCard title="Топ событий" subtitle="10 самых частых событий">
        <VerticalBarChart data={events} color="#14b8a6" />
      </ChartCard>

      <ChartCard title="Вовлечённость" subtitle="Likes + comments + reposts по датам">
        {engagement.length === 0 ? (
          <ChartFallback description="Нет данных о вовлечённости для выбранной выборки." />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={engagement} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
              <XAxis dataKey="label" stroke="var(--muted-color)" />
              <YAxis stroke="var(--muted-color)" />
              <Tooltip content={<BasicTooltip />} />
              <Bar dataKey="value" fill="#ef4444" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </section>
  );
}
