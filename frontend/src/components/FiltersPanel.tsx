import { FiltersState } from "../types/post";

type FiltersPanelProps = {
  filters: FiltersState;
  audiences: string[];
  sentiments: string[];
  units: string[];
  directions: string[];
  events: string[];
  sources: string[];
  onChange: (next: FiltersState) => void;
  onReset: () => void;
  textSearchEnabled: boolean;
};

const ALL_VALUE = "all";

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={ALL_VALUE}>Все</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FiltersPanel(props: FiltersPanelProps) {
  const {
    filters,
    audiences,
    sentiments,
    units,
    directions,
    events,
    sources,
    onChange,
    onReset,
    textSearchEnabled,
  } = props;

  const setField = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    onChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Фильтры</h2>
          <p>Все графики, карточки и посты пересчитываются на клиенте.</p>
        </div>
        <button className="ghost-button" type="button" onClick={onReset}>
          Сбросить
        </button>
      </div>

      <div className="filters-grid">
        <label className="filter-field">
          <span>Дата от</span>
          <input type="date" value={filters.dateFrom} onChange={(event) => setField("dateFrom", event.target.value)} />
        </label>

        <label className="filter-field">
          <span>Дата до</span>
          <input type="date" value={filters.dateTo} onChange={(event) => setField("dateTo", event.target.value)} />
        </label>

        <SelectField label="Источник" value={filters.source} options={sources} onChange={(value) => setField("source", value)} />
        <SelectField label="Аудитория" value={filters.audience} options={audiences} onChange={(value) => setField("audience", value)} />
        <SelectField label="Тональность" value={filters.sentiment} options={sentiments} onChange={(value) => setField("sentiment", value)} />
        <SelectField label="Подразделение" value={filters.unit} options={units} onChange={(value) => setField("unit", value)} />
        <SelectField label="Направление" value={filters.direction} options={directions} onChange={(value) => setField("direction", value)} />
        <SelectField label="Событие" value={filters.event} options={events} onChange={(value) => setField("event", value)} />

        <label className="filter-field filter-field-wide">
          <span>Поиск по постам</span>
          <input
            type="search"
            placeholder={textSearchEnabled ? "Текст, персона, событие, подразделение..." : "API не отдаёт text, поиск работает по доступным полям"}
            value={filters.query}
            onChange={(event) => setField("query", event.target.value)}
          />
        </label>
      </div>

      {!textSearchEnabled ? (
        <p className="filters-note">
          Backend сейчас не возвращает поле <code>text</code>, поэтому поиск работает по доступным метаданным и покажет полный текст только если API начнет его отдавать.
        </p>
      ) : null}
    </section>
  );
}
