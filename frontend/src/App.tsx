import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchPosts } from "./api/client";
import { FiltersState, Post, Selection } from "./types/post";
import { createDefaultFilters, extractFilterOptions, filterPosts } from "./lib/filters";
import { computeKpis, dailySeries, sentimentBreakdown, shiftRangeBack } from "./lib/metrics";
import { collocationGraph, personRankSeries, topBy, unitTreemap } from "./lib/entities";
import { topNgrams } from "./lib/text";
import { admissionsSpotlight } from "./lib/admissions";
import { postsForSelection } from "./lib/selection";
import { formatSigned } from "./lib/format";

import { NavBar, TabId } from "./components/NavBar";
import { FilterBar } from "./components/FilterBar";
import { KpiRow } from "./components/KpiRow";
import { AnomalyChart } from "./components/AnomalyChart";
import { SentimentDonut } from "./components/SentimentDonut";
import { CalendarHeatmap } from "./components/CalendarHeatmap";
import { TagCloud } from "./components/TagCloud";
import { EntityTreemap } from "./components/EntityTreemap";
import { PersonRankChart } from "./components/PersonRankChart";
import { CollocationGraph } from "./components/CollocationGraph";
import { NgramPanel } from "./components/NgramPanel";
import { TrendFunnel } from "./components/TrendFunnel";
import { AdmissionsMonthlyChart } from "./components/AdmissionsMonthlyChart";
import { DrillDownPanel } from "./components/DrillDownPanel";
import { LoadingState, ErrorState, EmptyState } from "./components/StateViews";
import { SecurityNote } from "./components/SecurityNote";

type LoadState = "idle" | "loading" | "success" | "error";

function sameSelection(a: Selection, b: Selection): boolean {
  if (!a || !b) return false;
  return a.kind === b.kind && a.value === b.value;
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<FiltersState>(createDefaultFilters());
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadState("loading");
        setError("");
        const data = await fetchPosts();
        if (cancelled) return;
        setPosts(data);
        setLoadState("success");
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : "Неизвестная ошибка запроса.";
        setError(`Проверьте, что backend запущен и отвечает на /telegram и /vk. Детали: ${message}`);
        setLoadState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPosts = useMemo(() => filterPosts(posts, filters), [posts, filters]);

  const previousPosts = useMemo(() => {
    const [prevFrom, prevTo] = shiftRangeBack(filters.dateFrom, filters.dateTo);
    return filterPosts(posts, { ...filters, dateFrom: prevFrom, dateTo: prevTo });
  }, [posts, filters]);

  const kpis = useMemo(() => computeKpis(filteredPosts, previousPosts), [filteredPosts, previousPosts]);
  const series = useMemo(() => dailySeries(filteredPosts), [filteredPosts]);
  const sentiment = useMemo(() => sentimentBreakdown(filteredPosts), [filteredPosts]);
  const options = useMemo(() => extractFilterOptions(posts), [posts]);

  const tagCloudItems = useMemo(
    () => topBy(filteredPosts, (p) => [...p.units, ...p.events, ...p.directions], 14),
    [filteredPosts]
  );

  const treemapNodes = useMemo(() => unitTreemap(filteredPosts), [filteredPosts]);
  const rankData = useMemo(() => personRankSeries(filteredPosts), [filteredPosts]);
  const graph = useMemo(() => collocationGraph(filteredPosts), [filteredPosts]);

  const studentNgrams = useMemo(
    () => topNgrams(filteredPosts.filter((p) => p.aud.includes("students")), 7),
    [filteredPosts]
  );
  const employeeNgrams = useMemo(
    () => topNgrams(filteredPosts.filter((p) => p.aud.includes("employees")), 7),
    [filteredPosts]
  );

  const admissions = useMemo(() => admissionsSpotlight(filteredPosts), [filteredPosts]);

  const drilldownPosts = useMemo(() => postsForSelection(filteredPosts, selection), [filteredPosts, selection]);

  const select = (next: Selection) => setSelection((current) => (sameSelection(current, next) ? null : next));

  const isLive = loadState === "success" && posts.length > 0;

  return (
    <div className="app-shell">
      <NavBar active={activeTab} onChange={setActiveTab} isLive={isLive} />

      <div className="page">
        {loadState === "loading" || loadState === "idle" ? <LoadingState /> : null}
        {loadState === "error" ? <ErrorState message={error} onRetry={() => window.location.reload()} /> : null}

        {loadState === "success" && posts.length === 0 ? (
          <EmptyState
            title="Backend вернул пустой список"
            description="Как только в базе появятся публикации, здесь автоматически появятся метрики и графики."
          />
        ) : null}

        {loadState === "success" && posts.length > 0 ? (
          <>
            <FilterBar
              filters={filters}
              audiences={options.audiences}
              onChange={setFilters}
              onReset={() => setFilters(createDefaultFilters())}
            />

            <KpiRow kpis={kpis} onAnomalyClick={() => select({ kind: "sentiment", value: "neg", label: "Дни с аномальным объёмом" })} />

            {filteredPosts.length === 0 ? (
              <EmptyState title="Фильтры ничего не нашли" description="Смените диапазон дат или снимите часть фильтров." />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  {activeTab === "overview" ? (
                    <section>
                      <div className="panel-grid">
                        <div className="panel c7">
                          <div className="panel-title">
                            Объём упоминаний · Z-score
                            <span className="hint">клик по точке — публикации дня</span>
                          </div>
                          <AnomalyChart
                            data={series}
                            selectedDate={selection?.kind === "day" ? selection.value : null}
                            onSelectDay={(date) => select({ kind: "day", value: date, label: `Публикации · ${date}` })}
                          />
                        </div>
                        <div className="panel c5">
                          <div className="panel-title">Тональность потока</div>
                          <SentimentDonut
                            pos={sentiment.pos}
                            neu={sentiment.neu}
                            neg={sentiment.neg}
                            selected={selection?.kind === "sentiment" ? selection.value : null}
                            onSelect={(value) => select({ kind: "sentiment", value, label: `Тональность · ${value}` })}
                          />
                        </div>
                        <div className="panel c7">
                          <div className="panel-title">
                            Активность по дням
                            <span className="hint">клик по ячейке — публикации дня</span>
                          </div>
                          <CalendarHeatmap
                            posts={filteredPosts}
                            startDate={filters.dateFrom}
                            endDate={filters.dateTo}
                            selectedDate={selection?.kind === "day" ? selection.value : null}
                            onSelectDay={(date) => select({ kind: "day", value: date, label: `Публикации · ${date}` })}
                          />
                        </div>
                        <div className="panel c5">
                          <div className="panel-title">Облако тем периода</div>
                          <TagCloud items={tagCloudItems} onSelect={(label) => setFilters((f) => ({ ...f, query: label }))} />
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeTab === "entities" ? (
                    <section>
                      <div className="panel-grid">
                        <div className="panel c7">
                          <div className="panel-title">
                            Внимание по подразделениям
                            <span className="hint">площадь = упоминания, цвет = тональность</span>
                          </div>
                          <EntityTreemap
                            nodes={treemapNodes}
                            selected={selection?.kind === "unit" ? selection.value : null}
                            onSelect={(unit) => select({ kind: "unit", value: unit, label: `Подразделение · ${unit}` })}
                          />
                        </div>
                        <div className="panel c5">
                          <div className="panel-title">Рейтинг персон по месяцам</div>
                          <PersonRankChart
                            series={rankData.series}
                            persons={rankData.persons}
                            selected={selection?.kind === "person" ? selection.value : null}
                            onSelect={(person) => select({ kind: "person", value: person, label: `Персона · ${person}` })}
                          />
                        </div>
                        <div className="panel c12">
                          <div className="panel-title">
                            Граф «Персона — Событие»
                            <span className="hint">наведите — имя, клик — публикации</span>
                          </div>
                          <CollocationGraph
                            nodes={graph.nodes}
                            edges={graph.edges}
                            selected={selection && (selection.kind === "person" || selection.kind === "event") ? selection.value : null}
                            onSelectPerson={(person) => select({ kind: "person", value: person, label: `Персона · ${person}` })}
                            onSelectEvent={(event) => select({ kind: "event", value: event, label: `Событие · ${event}` })}
                          />
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeTab === "trends" ? (
                    <section>
                      <div className="panel-grid">
                        <div className="panel c5">
                          <div className="panel-title">Воронка: анонс → пост-релиз</div>
                          <TrendFunnel
                            stages={admissions.funnel}
                            onSelect={(label) => select({ kind: "admissions", value: "true", label: `${label} · ИТ-специалитет` })}
                          />
                        </div>
                        <div className="panel c7">
                          <div className="panel-title">Объём: ИТ-специалитет vs всего</div>
                          <AdmissionsMonthlyChart monthly={admissions.monthly} />
                        </div>
                        <div className="panel c12">
                          <div className="panel-title">Топ событий периода</div>
                          <TagCloud
                            items={topBy(filteredPosts, (p) => p.events, 12)}
                            onSelect={(event) => select({ kind: "event", value: event, label: `Событие · ${event}` })}
                          />
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeTab === "content" ? (
                    <section>
                      <div className="panel-grid">
                        <div className="panel c6">
                          <div className="panel-title">
                            Биграммы <span className="pill pos">лексикон студентов</span>
                          </div>
                          <NgramPanel
                            title="лексикона студентов"
                            items={studentNgrams}
                            color="var(--accent-2)"
                            selected={selection?.kind === "ngram" ? selection.value : null}
                            onSelect={(term) => select({ kind: "ngram", value: term, label: `«${term}»` })}
                          />
                        </div>
                        <div className="panel c6">
                          <div className="panel-title">
                            Биграммы <span className="pill neu">лексикон сотрудников</span>
                          </div>
                          <NgramPanel
                            title="лексикона сотрудников"
                            items={employeeNgrams}
                            color="#8b7bd8"
                            selected={selection?.kind === "ngram" ? selection.value : null}
                            onSelect={(term) => select({ kind: "ngram", value: term, label: `«${term}»` })}
                          />
                        </div>
                        <div className="panel c12">
                          <div className="panel-title">Топ направлений</div>
                          <TagCloud
                            items={topBy(filteredPosts, (p) => p.directions, 12)}
                            onSelect={(direction) => select({ kind: "direction", value: direction, label: `Направление · ${direction}` })}
                          />
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeTab === "admissions" ? (
                    <section>
                      <div className="panel-grid">
                        <div className="panel c4">
                          <div className="panel-title">Доля в потоке</div>
                          <div style={{ fontFamily: "var(--serif)", fontSize: 40 }}>{admissions.share}%</div>
                          <div style={{ color: "var(--text-faint)", fontSize: 12 }}>{admissions.posts.length} публикаций</div>
                        </div>
                        <div className="panel c4">
                          <div className="panel-title">Вовлечённость</div>
                          <div style={{ fontFamily: "var(--serif)", fontSize: 40 }}>{admissions.engagementRate}</div>
                          <div style={{ color: "var(--text-faint)", fontSize: 12 }}>
                            {formatSigned(Number((admissions.engagementRate - admissions.overallEngagementRate).toFixed(1)))} к среднему по потоку
                          </div>
                        </div>
                        <div className="panel c4">
                          <div className="panel-title">Тональность обсуждения</div>
                          <div style={{ display: "flex", gap: 10, fontFamily: "var(--mono)", fontSize: 13 }}>
                            <span style={{ color: "var(--pos)" }}>{admissions.sentiment.posPct}%</span>
                            <span style={{ color: "var(--neu)" }}>{admissions.sentiment.neuPct}%</span>
                            <span style={{ color: "var(--neg)" }}>{admissions.sentiment.negPct}%</span>
                          </div>
                        </div>
                        <div className="panel c7">
                          <div className="panel-title">Динамика по месяцам</div>
                          <AdmissionsMonthlyChart monthly={admissions.monthly} />
                        </div>
                        <div className="panel c5">
                          <div className="panel-title">Анонс → пост-релиз</div>
                          <TrendFunnel
                            stages={admissions.funnel}
                            onSelect={(label) => select({ kind: "admissions", value: "true", label: `${label} · ИТ-специалитет` })}
                          />
                        </div>
                        <div
                          className="panel c12 clickable"
                          onClick={() => select({ kind: "admissions", value: "true", label: "Все публикации · ИТ-специалитет" })}
                        >
                          <div className="panel-title">
                            Все публикации об ИТ-специалитете
                            <span className="hint">клик — открыть список</span>
                          </div>
                          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
                            {admissions.posts.length} публикаций за выбранный период
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            )}

            <SecurityNote />
          </>
        ) : null}
      </div>

      <DrillDownPanel label={selection?.label ?? null} posts={drilldownPosts} onClose={() => setSelection(null)} />
    </div>
  );
}
