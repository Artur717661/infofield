import { useEffect, useMemo, useState } from "react";
import { fetchPosts } from "./api/client";
import { ChartsGrid } from "./components/ChartsGrid";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { FiltersPanel } from "./components/FiltersPanel";
import { Header } from "./components/Header";
import { LoadingState } from "./components/LoadingState";
import { MetricCard } from "./components/MetricCard";
import { PostsTable } from "./components/PostsTable";
import { FiltersState, Post } from "./types/post";
import {
  calculateMetrics,
  createDefaultFilters,
  extractFilterOptions,
  filterPosts,
  getEngagementByDate,
  getTopDirections,
  getTopEvents,
  getTopUnits,
  groupPostsByAudience,
  groupPostsByDate,
  groupPostsBySentiment,
  hasActiveFilters,
} from "./utils/analytics";

type LoadState = "idle" | "loading" | "success" | "error";
type ThemeMode = "light" | "dark";

const STORAGE_KEY = "infofield-theme";

function getInitialTheme(): ThemeMode {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "dark" ? "dark" : "light";
}

function getBackendHint(): string {
  const explicitBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  return explicitBaseUrl || "http://localhost:8000";
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<FiltersState>(createDefaultFilters());
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadState("loading");
        setError("");
        const data = await fetchPosts();
        if (cancelled) {
          return;
        }

        setPosts(data);
        setLoadState("success");
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        const message = loadError instanceof Error
          ? loadError.message
          : "Unknown backend request error.";

        setError(
          `Проверьте, что backend запущен на ${getBackendHint()} и отвечает на /telegram и /vk. Детали: ${message}`,
        );
        setLoadState("error");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPosts = useMemo(() => filterPosts(posts, filters), [posts, filters]);
  const metrics = useMemo(() => calculateMetrics(filteredPosts), [filteredPosts]);
  const options = useMemo(() => extractFilterOptions(posts), [posts]);
  const chartData = useMemo(
    () => ({
      postsByDate: groupPostsByDate(filteredPosts),
      audiences: groupPostsByAudience(filteredPosts),
      sentiments: groupPostsBySentiment(filteredPosts),
      directions: getTopDirections(filteredPosts),
      units: getTopUnits(filteredPosts),
      events: getTopEvents(filteredPosts),
      engagement: getEngagementByDate(filteredPosts),
    }),
    [filteredPosts],
  );

  const textSearchEnabled = posts.some((post) => post.hasRealText);

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <main className="page">
        <Header theme={theme} onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))} />

        {loadState === "loading" || loadState === "idle" ? <LoadingState /> : null}

        {loadState === "error" ? <ErrorState message={error} onRetry={() => window.location.reload()} /> : null}

        {loadState === "success" ? (
          <>
            <section className="metrics-grid">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
              ))}
            </section>

            <FiltersPanel
              filters={filters}
              audiences={options.audiences}
              sentiments={options.sentiments}
              units={options.units}
              directions={options.directions}
              events={options.events}
              sources={options.sources}
              onChange={setFilters}
              onReset={() => setFilters(createDefaultFilters())}
              textSearchEnabled={textSearchEnabled}
            />

            {posts.length === 0 ? (
              <EmptyState
                title="Backend вернул пустой список"
                description="Когда в базе появятся публикации, здесь автоматически появятся метрики, графики и таблица."
              />
            ) : filteredPosts.length === 0 ? (
              <EmptyState
                title="Фильтры ничего не нашли"
                description={
                  hasActiveFilters(filters)
                    ? "Смените фильтры или очистите их, чтобы увидеть публикации."
                    : "Данные пока не найдены."
                }
              />
            ) : (
              <>
                <ChartsGrid {...chartData} />
                <PostsTable posts={filteredPosts} />
              </>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
