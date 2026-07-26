import { CurrentUser } from "../api/auth";

export type TabId = "overview" | "entities" | "trends" | "content" | "admissions" | "admin";

const BASE_TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "entities", label: "Сущности" },
  { id: "trends", label: "Тренды" },
  { id: "content", label: "Контент" },
  { id: "admissions", label: "ИТ-специалитет" },
];

type NavBarProps = {
  active: TabId;
  onChange: (tab: TabId) => void;
  periodLabel: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  user: CurrentUser | null;
  onLogout: () => void;
  onChangePassword: () => void;
};

export function NavBar(props: NavBarProps) {
  const { active, onChange, periodLabel, refreshing, onRefresh, user, onLogout, onChangePassword } = props;
  const tabs = user?.role === "admin" ? [...BASE_TABS, { id: "admin" as TabId, label: "Доступ" }] : BASE_TABS;

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="brand">
          <span className="dot" />
          <b>INFOFIELD</b>
          <span>/ информационное поле университета</span>
        </div>

        <div className="tabs" role="tablist" aria-label="Экраны дашборда">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={`tab-button${active === tab.id ? " active" : ""}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="nav-right">
          {periodLabel ? (
            <span className="nav-status">
              <span className="blip" />
              {periodLabel}
            </span>
          ) : null}

          <button
            type="button"
            className={`refresh-button${refreshing ? " spinning" : ""}`}
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Обновить данные"
            title="Обновить данные"
          >
            ↻
          </button>

          {user ? (
            <div className="user-menu">
              <button type="button" className="user-chip" onClick={onChangePassword} title="Сменить пароль">
                <span className="user-name">{user.username}</span>
                {user.role === "admin" ? <span className="role-tag">админ</span> : null}
              </button>
              <button type="button" className="reset-button" onClick={onLogout}>
                выйти
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
