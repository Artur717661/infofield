import { FiltersState, PostSource } from "../types/post";
import { DATA_MAX_DATE, DATA_MIN_DATE, hasActiveFilters } from "../lib/filters";

type FilterBarProps = {
  filters: FiltersState;
  audiences: string[];
  onChange: (next: FiltersState) => void;
  onReset: () => void;
};

const SENTIMENTS: { id: string; label: string }[] = [
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

export function FilterBar({ filters, audiences, onChange, onReset }: FilterBarProps) {
  const set = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <input
          type="date"
          className="date-input"
          min={DATA_MIN_DATE}
          max={filters.dateTo}
          value={filters.dateFrom}
          onChange={(e) => set("dateFrom", e.target.value)}
        />
        <span style={{ color: "var(--text-faint)", fontSize: 12 }}>—</span>
        <input
          type="date"
          className="date-input"
          min={filters.dateFrom}
          max={DATA_MAX_DATE}
          value={filters.dateTo}
          onChange={(e) => set("dateTo", e.target.value)}
        />
      </div>

      <div className="filter-divider" />

      <div className="filter-group">
        {(["tg", "vk"] as PostSource[]).map((source) => (
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
            className={`chip${filters.sentiments.includes(s.id) ? ` active ${s.id === "neg" ? "neg" : s.id === "pos" ? "pos" : ""}` : ""}`}
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
        title="Только упоминания ИТ-специалитета и приёмной кампании"
      >
        ● ИТ-специалитет
      </button>

      <input
        type="search"
        className="search-input"
        placeholder="Поиск по тексту, персоне, событию…"
        value={filters.query}
        onChange={(e) => set("query", e.target.value)}
      />

      {hasActiveFilters(filters) ? (
        <button type="button" className="reset-button" onClick={onReset}>
          сбросить
        </button>
      ) : null}
    </div>
  );
}
