import { FiltersState, PostSource } from "../types/post";
import { DateBounds, RANGE_PRESETS, activePresetId, hasActiveFilters } from "../lib/filters";

type FilterBarProps = {
  filters: FiltersState;
  bounds: DateBounds;
  audiences: string[];
  sources: PostSource[];
  matchCount: number;
  totalCount: number;
  onChange: (next: FiltersState) => void;
  onReset: () => void;
};

const SENTIMENTS = [
  { id: "pos", label: "Позитив" },
  { id: "neu", label: "Нейтрально" },
  { id: "neg", label: "Негатив" },
];

const AUDIENCE_LABELS: Record<string, string> = {
  students: "Студенты",
  employees: "Сотрудники",
  applicants: "Абитуриенты",
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterBar(props: FilterBarProps) {
  const { filters, bounds, audiences, sources, matchCount, totalCount, onChange, onReset } = props;
  const set = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  const preset = activePresetId(filters, bounds);
  const filtered = hasActiveFilters(filters, bounds);

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-group">
          {RANGE_PRESETS.map((item) => {
            const [from, to] = item.resolve(bounds);
            return (
              <button
                key={item.id}
                type="button"
                className={`chip${preset === item.id ? " active" : ""}`}
                onClick={() => onChange({ ...filters, dateFrom: from, dateTo: to })}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="filter-divider" />

        <div className="filter-group">
          <input
            type="date"
            className="date-input"
            aria-label="Дата от"
            min={bounds.min}
            max={filters.dateTo}
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
          />
          <span className="date-dash">—</span>
          <input
            type="date"
            className="date-input"
            aria-label="Дата до"
            min={filters.dateFrom}
            max={bounds.max}
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
          />
        </div>

        <div className="filter-spacer" />

        <span className="filter-count" aria-live="polite">
          {filtered ? `${matchCount} из ${totalCount}` : `${totalCount} публикаций`}
        </span>
      </div>

      <div className="filter-row">
        <div className="filter-group">
          {sources.map((source) => (
            <button
              key={source}
              type="button"
              className={`chip${filters.sources.includes(source) ? " active" : ""}`}
              onClick={() => set("sources", toggle(filters.sources, source))}
            >
              {source.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="filter-divider" />

        <div className="filter-group">
          {audiences.map((aud) => (
            <button
              key={aud}
              type="button"
              className={`chip${filters.audiences.includes(aud) ? " active" : ""}`}
              onClick={() => set("audiences", toggle(filters.audiences, aud))}
            >
              {AUDIENCE_LABELS[aud] ?? aud}
            </button>
          ))}
        </div>

        <div className="filter-divider" />

        <div className="filter-group">
          {SENTIMENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`chip sentiment-${s.id}${filters.sentiments.includes(s.id) ? " active" : ""}`}
              onClick={() => set("sentiments", toggle(filters.sentiments, s.id))}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="filter-divider" />

        <button
          type="button"
          className={`chip spotlight${filters.admissionsOnly ? " active" : ""}`}
          onClick={() => set("admissionsOnly", !filters.admissionsOnly)}
          title="Только упоминания ИТ-специалитета"
        >
          ИТ-специалитет
        </button>

        <input
          type="search"
          className="search-input"
          placeholder="Поиск по тексту, персоне, событию…"
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
        />

        {filtered ? (
          <button type="button" className="reset-button" onClick={onReset}>
            сбросить
          </button>
        ) : null}
      </div>
    </div>
  );
}
