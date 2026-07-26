import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UnauthorizedError, fetchPosts } from "./api/client";
import { CurrentUser, fetchCurrentUser, logout as logoutRequest, refreshData } from "./api/auth";
import { FiltersState, Post, Selection } from "./types/post";
import {
  DateBounds,
  FALLBACK_BOUNDS,
  createDefaultFilters,
  deriveBounds,
  extractFilterOptions,
  filterPosts,
} from "./lib/filters";
import {
  anomalyDates,
  computeKpis,
  dailySeries,
  sentimentBreakdown,
  shiftRangeBack,
  weeklyTotals,
} from "./lib/metrics";
import { collocationGraph, personRankSeries, topBy, unitTreemap } from "./lib/entities";
import { topNgrams } from "./lib/text";
import { admissionsSpotlight } from "./lib/admissions";
import { postsForSelection, sameSelection } from "./lib/selection";
import { formatDate, formatSigned } from "./lib/format";

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
import { Panel } from "./components/Panel";
import { LoginScreen } from "./components/LoginScreen";
import { AdminPanel } from "./components/AdminPanel";
import { ChangePasswordDialog } from "./components/ChangePasswordDialog";

type LoadState = "loading" | "success" | "error";
type AuthState = "checking" | "anonymous" | "authenticated";

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function periodLabel(bounds: DateBounds): string {
  const [fromY, fromM] = bounds.min.split("-");
  const [toY, toM] = bounds.max.split("-");
  const from = `${MONTHS_SHORT[Number(fromM) - 1]} ${fromY}`;
  const to = `${MONTHS_SHORT[Number(toM) - 1]} ${toY}`;
  return `${from} — ${to}`.toUpperCase();
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [bounds, setBounds] = useState<DateBounds>(FALLBACK_BOUNDS);
  const [filters, setFilters] = useState<FiltersState>(createDefaultFilters());
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selection, setSelection] = useState<Selection>(null);

  const [authState, setAuthState] = useState<AuthState>("checking");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [passwordDialog, setPasswordDialog] = useState(false);

  const goAnonymous = useCallback(() => {
    setAuthState("anonymous");
    setUser(null);
    setPosts([]);
    setSelection(null);
    setActiveTab("overview");
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoadState("loading");
        setError("");

        // Обновление по кнопке заставляет шлюз перечитать данные из backend,
        // а не отдать закэшированный ответ. Доступно только админу.
        if (isRefresh && user?.role === "admin") {
          await refreshData();
        }

        const data = await fetchPosts();
        const nextBounds = deriveBounds(data);

        setPosts(data);
        setBounds(nextBounds);
        // Возвращаем окно к диапазону самих данных, чтобы после обновления
        // пользователь не остался в пустом периоде.
        setFilters(createDefaultFilters(nextBounds));
        setSelection(null);
        setLoadState("success");
      } catch (loadError) {
        if (loadError instanceof UnauthorizedError) {
          goAnonymous();
          return;
        }
        const message = loadError instanceof Error ? loadError.message : "Неизвестная ошибка запроса.";
        setError(message);
        setLoadState("error");
      } finally {
        setRefreshing(false);
      }
    },
    [goAnonymous, user]
  );

  // Сначала выясняем, есть ли живая сессия, и только потом грузим данные.
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const me = await fetchCurrentUser();
        if (cancelled) return;
        if (me) {
          setUser(me);
          setAuthState("authenticated");
          setPasswordDialog(me.mustChangePassword);
        } else {
          setAuthState("anonymous");
        }
      } catch {
        if (!cancelled) setAuthState("anonymous");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState === "authenticated") void load();
    // load зависит от user.role, но перезагружать данные при смене роли не нужно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      goAnonymous();
    }
  }, [goAnonymous]);

  const filteredPosts = useMemo(() => filterPosts(posts, filters), [posts, filters]);

  const previousPosts = useMemo(() => {
    const [prevFrom, prevTo] = shiftRangeBack(filters.dateFrom, filters.dateTo);
    return filterPosts(posts, { ...filters, dateFrom: prevFrom, dateTo: prevTo });
  }, [posts, filters]);

  const series = useMemo(() => dailySeries(filteredPosts), [filteredPosts]);
  const kpis = useMemo(() => computeKpis(filteredPosts, previousPosts, series), [filteredPosts, previousPosts, series]);
  const trend = useMemo(() => weeklyTotals(series), [series]);
  const sentiment = useMemo(() => sentimentBreakdown(filteredPosts), [filteredPosts]);
  const options = useMemo(() => extractFilterOptions(posts), [posts]);

  const topicItems = useMemo(
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

  const select = useCallback((next: Selection) => {
    setSelection((current) => (sameSelection(current, next) ? null : next));
  }, []);

  const selectDay = useCallback(
    (date: string) => select({ kind: "day", value: date, label: `Публикации за ${formatDate(date)}` }),
    [select]
  );

  const navProps = {
    active: activeTab,
    onChange: setActiveTab,
    user,
    onLogout: () => void handleLogout(),
    onChangePassword: () => setPasswordDialog(true),
  };

  const passwordDialogNode = passwordDialog ? (
    <ChangePasswordDialog
      forced={user?.mustChangePassword ?? false}
      onDone={() => {
        setPasswordDialog(false);
        // Смена пароля отзывает остальные сессии; текущую шлюз сохраняет,
        // но флаг «нужно сменить» надо снять локально.
        setUser((current) => (current ? { ...current, mustChangePassword: false } : current));
      }}
      onCancel={() => setPasswordDialog(false)}
    />
  ) : null;

  if (authState === "checking") {
    return (
      <div className="app-shell">
        <div className="page">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (authState === "anonymous") {
    return (
      <LoginScreen
        onSuccess={(loggedIn) => {
          setUser(loggedIn);
          setPasswordDialog(loggedIn.mustChangePassword);
          setAuthState("authenticated");
        }}
      />
    );
  }

  if (loadState === "loading") {
    return (
      <div className="app-shell">
        <NavBar {...navProps} periodLabel={null} refreshing onRefresh={() => {}} />
        <div className="page">
          <LoadingState />
        </div>
        {passwordDialogNode}
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="app-shell">
        <NavBar {...navProps} periodLabel={null} refreshing={refreshing} onRefresh={() => void load(true)} />
        <div className="page">
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
        {passwordDialogNode}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <NavBar
        {...navProps}
        periodLabel={posts.length > 0 ? periodLabel(bounds) : null}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
      />

      <div className="page">
        {activeTab === "admin" && user?.role === "admin" ? (
          <motion.div
            id="panel-admin"
            role="tabpanel"
            aria-labelledby="tab-admin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <AdminPanel currentUsername={user.username} />
          </motion.div>
        ) : posts.length === 0 ? (
          <EmptyState
            title="Backend вернул пустой список"
            description="Как только парсеры запишут публикации в базу, метрики и графики появятся здесь автоматически."
          />
        ) : (
          <>
            <FilterBar
              filters={filters}
              bounds={bounds}
              audiences={options.audiences}
              sources={options.sources}
              matchCount={filteredPosts.length}
              totalCount={posts.length}
              onChange={setFilters}
              onReset={() => setFilters(createDefaultFilters(bounds))}
            />

            <KpiRow
              kpis={kpis}
              trend={trend}
              onAnomalyClick={() =>
                select({ kind: "days", value: anomalyDates(series), label: "Дни с аномальным объёмом" })
              }
              onNegativeClick={() => select({ kind: "sentiment", value: "neg", label: "Негативные публикации" })}
            />

            {filteredPosts.length === 0 ? (
              <EmptyState
                title="Под фильтры ничего не попало"
                description="Расширьте период или снимите часть фильтров — счётчик справа в панели фильтров покажет, сколько публикаций осталось."
              />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  id={`panel-${activeTab}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${activeTab}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                >
                  {activeTab === "overview" ? (
                    <div className="panel-grid">
                      <Panel span={7} title="Объём упоминаний" hint="клик по точке — публикации дня">
                        <AnomalyChart
                          data={series}
                          selectedDate={selection?.kind === "day" ? selection.value : null}
                          onSelectDay={selectDay}
                        />
                      </Panel>

                      <Panel span={5} title="Тональность потока" hint="клик по сектору — фильтр">
                        <SentimentDonut
                          pos={sentiment.pos}
                          neu={sentiment.neu}
                          neg={sentiment.neg}
                          selected={selection?.kind === "sentiment" ? selection.value : null}
                          onSelect={(value) =>
                            select({
                              kind: "sentiment",
                              value,
                              label:
                                value === "pos" ? "Позитивные публикации" : value === "neg" ? "Негативные публикации" : "Нейтральные публикации",
                            })
                          }
                        />
                      </Panel>

                      <Panel span={7} title="Активность по дням" hint="цвет — объём, красный — перевес негатива">
                        <CalendarHeatmap
                          posts={filteredPosts}
                          startDate={filters.dateFrom}
                          endDate={filters.dateTo}
                          selectedDate={selection?.kind === "day" ? selection.value : null}
                          onSelectDay={selectDay}
                        />
                      </Panel>

                      <Panel span={5} title="Темы периода" hint="клик — поиск по теме">
                        <TagCloud items={topicItems} onSelect={(label) => setFilters((f) => ({ ...f, query: label }))} />
                      </Panel>
                    </div>
                  ) : null}

                  {activeTab === "entities" ? (
                    <div className="panel-grid">
                      <Panel span={7} title="Внимание по подразделениям" hint="площадь — упоминания, цвет — тональность">
                        <EntityTreemap
                          nodes={treemapNodes}
                          selected={selection?.kind === "unit" ? selection.value : null}
                          onSelect={(unit) => select({ kind: "unit", value: unit, label: unit })}
                        />
                      </Panel>

                      <Panel span={5} title="Рейтинг персон по месяцам" hint="клик по линии — публикации персоны">
                        <PersonRankChart
                          series={rankData.series}
                          persons={rankData.persons}
                          selected={selection?.kind === "person" ? selection.value : null}
                          onSelect={(person) => select({ kind: "person", value: person, label: person })}
                        />
                      </Panel>

                      <Panel span={12} title="Связи «персона — событие»" hint="наведите — имя, клик — публикации">
                        <CollocationGraph
                          nodes={graph.nodes}
                          edges={graph.edges}
                          selected={
                            selection && (selection.kind === "person" || selection.kind === "event") ? selection.value : null
                          }
                          onSelectPerson={(person) => select({ kind: "person", value: person, label: person })}
                          onSelectEvent={(event) => select({ kind: "event", value: event, label: event })}
                        />
                      </Panel>
                    </div>
                  ) : null}

                  {activeTab === "trends" ? (
                    <div className="panel-grid">
                      <Panel span={7} title="ИТ-специалитет в общем потоке" hint="жёлтое — доля ИТ-специалитета">
                        <AdmissionsMonthlyChart
                          monthly={admissions.monthly}
                          onSelectMonth={(month) =>
                            select({ kind: "days", value: month.dates, label: `Публикации · ${month.label}` })
                          }
                        />
                      </Panel>

                      <Panel span={5} title="Путь публикации" hint="от анонса до повторного охвата">
                        <TrendFunnel stages={admissions.funnel} onSelect={(stage) => select(stage)} />
                      </Panel>

                      <Panel span={12} title="События периода" hint="клик — публикации события">
                        <TagCloud
                          items={topBy(filteredPosts, (p) => p.events, 12)}
                          onSelect={(event) => select({ kind: "event", value: event, label: event })}
                        />
                      </Panel>
                    </div>
                  ) : null}

                  {activeTab === "content" ? (
                    <div className="panel-grid">
                      <Panel span={6} title="Лексикон абитуриентов и студентов" hint="клик — публикации с фразой">
                        <NgramPanel
                          items={studentNgrams}
                          color="var(--accent-2)"
                          emptyNote="Мало текста в срезе по студентам."
                          selected={selection?.kind === "ngram" ? selection.value : null}
                          onSelect={(term) => select({ kind: "ngram", value: term, label: `«${term}»` })}
                        />
                      </Panel>

                      <Panel span={6} title="Лексикон сотрудников" hint="клик — публикации с фразой">
                        <NgramPanel
                          items={employeeNgrams}
                          color="#8b7bd8"
                          emptyNote="Мало текста в срезе по сотрудникам."
                          selected={selection?.kind === "ngram" ? selection.value : null}
                          onSelect={(term) => select({ kind: "ngram", value: term, label: `«${term}»` })}
                        />
                      </Panel>

                      <Panel span={12} title="Научные направления" hint="клик — публикации направления">
                        <TagCloud
                          items={topBy(filteredPosts, (p) => p.directions, 12)}
                          onSelect={(direction) => select({ kind: "direction", value: direction, label: direction })}
                        />
                      </Panel>
                    </div>
                  ) : null}

                  {activeTab === "admissions" ? (
                    <div className="panel-grid">
                      <Panel span={4} title="Доля в потоке">
                        <div className="stat-big">{admissions.share}%</div>
                        <div className="stat-note">{admissions.posts.length} из {filteredPosts.length} публикаций</div>
                      </Panel>

                      <Panel span={4} title="Вовлечённость">
                        <div className="stat-big">{admissions.engagementRate}</div>
                        <div className="stat-note">
                          {formatSigned(Number((admissions.engagementRate - admissions.overallEngagementRate).toFixed(1)))} к
                          среднему по потоку
                        </div>
                      </Panel>

                      <Panel span={4} title="Тональность обсуждения">
                        <div className="sentiment-split">
                          <span style={{ color: "var(--pos)" }}>{admissions.sentiment.posPct}%</span>
                          <span style={{ color: "var(--neu)" }}>{admissions.sentiment.neuPct}%</span>
                          <span style={{ color: "var(--neg)" }}>{admissions.sentiment.negPct}%</span>
                        </div>
                        <div className="stat-note">позитив / нейтрально / негатив</div>
                      </Panel>

                      <Panel span={7} title="Динамика по месяцам" hint="клик по столбцу — публикации месяца">
                        <AdmissionsMonthlyChart
                          monthly={admissions.monthly}
                          onSelectMonth={(month) =>
                            select({ kind: "days", value: month.dates, label: `ИТ-специалитет · ${month.label}` })
                          }
                        />
                      </Panel>

                      <Panel span={5} title="Путь публикации" hint="каждый этап — подмножество прошлого">
                        <TrendFunnel stages={admissions.funnel} onSelect={(stage) => select(stage)} />
                      </Panel>

                      <Panel span={12} title="Что обсуждают вокруг ИТ-специалитета" hint="клик — публикации с фразой">
                        <NgramPanel
                          items={topNgrams(admissions.posts, 8)}
                          color="var(--accent)"
                          emptyNote="Пока мало текста об ИТ-специалитете в этом периоде."
                          selected={selection?.kind === "ngram" ? selection.value : null}
                          onSelect={(term) => select({ kind: "ngram", value: term, label: `«${term}»` })}
                        />
                      </Panel>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            )}

            <SecurityNote />
          </>
        )}
      </div>

      <DrillDownPanel label={selection?.label ?? null} posts={drilldownPosts} onClose={() => setSelection(null)} />
      {passwordDialogNode}
    </div>
  );
}
