export type TabId = "overview" | "entities" | "trends" | "content" | "admissions";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "entities", label: "Сущности" },
  { id: "trends", label: "Тренды" },
  { id: "content", label: "Контент" },
  { id: "admissions", label: "ИТ-специалитет" },
];

type NavBarProps = {
  active: TabId;
  onChange: (tab: TabId) => void;
  isLive: boolean;
};

export function NavBar({ active, onChange, isLive }: NavBarProps) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="brand">
          <span className="dot" />
          <b>INFOFIELD</b>
          <span>/ аналитика университета</span>
        </div>

        <div className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-button${active === tab.id ? " active" : ""}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={`nav-status${isLive ? "" : " offline"}`}>
          <span className="blip" />
          {isLive ? "ЯНВ – ИЮЛ 2026" : "НЕТ ДАННЫХ"}
        </div>
      </div>
    </nav>
  );
}
