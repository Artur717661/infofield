import { useCallback, useEffect, useState } from "react";
import {
  AdminUser,
  ApiError,
  AuditEntry,
  createUser,
  fetchAudit,
  listUsers,
  Role,
  setUserActive,
} from "../api/auth";
import { Panel } from "./Panel";

const ACTION_LABELS: Record<string, string> = {
  login_ok: "успешный вход",
  login_failed: "неудачный вход",
  logout: "выход",
  password_changed: "пароль изменён",
  password_change_failed: "неудачная смена пароля",
  password_reset_cli: "пароль сброшен через CLI",
  user_created: "пользователь создан",
  user_created_cli: "пользователь создан через CLI",
  user_deactivated: "пользователь отключён",
  user_activated: "пользователь включён",
  sessions_revoked_cli: "сессии отозваны через CLI",
  cache_refresh: "принудительное обновление данных",
};

function formatMoment(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function AdminPanel({ currentUsername }: { currentUsername: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setError("");
    try {
      const [userList, auditList] = await Promise.all([listUsers(), fetchAudit()]);
      setUsers(userList);
      setAudit(auditList);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Не удалось загрузить данные администрирования.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submitNewUser(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;

    setCreating(true);
    setError("");
    setNotice("");
    try {
      await createUser(newUsername.trim().toLowerCase(), newPassword, newRole);
      setNotice(`Пользователь «${newUsername.trim().toLowerCase()}» создан. При первом входе он сменит пароль.`);
      setNewUsername("");
      setNewPassword("");
      setNewRole("viewer");
      await reload();
    } catch (createError) {
      setError(createError instanceof ApiError ? createError.message : "Не удалось создать пользователя.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user: AdminUser) {
    setError("");
    setNotice("");
    try {
      await setUserActive(user.id, !user.isActive);
      setNotice(
        user.isActive
          ? `«${user.username}» отключён, все его сессии сброшены.`
          : `«${user.username}» снова активен.`
      );
      await reload();
    } catch (toggleError) {
      setError(toggleError instanceof ApiError ? toggleError.message : "Не удалось изменить пользователя.");
    }
  }

  if (loading) {
    return (
      <div className="panel-grid">
        <Panel span={12} title="Администрирование">
          <div className="panel-empty">Загружаем…</div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="panel-grid">
      {error ? (
        <div className="c12">
          <div className="login-error" role="alert">
            {error}
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className="c12">
          <div className="admin-notice" role="status">
            {notice}
          </div>
        </div>
      ) : null}

      <Panel span={7} title="Пользователи" hint="отключение сбрасывает активные сессии">
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Логин</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Сессий</th>
                <th>Последний вход</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className={user.isActive ? "" : "inactive"}>
                  <td>
                    {user.username}
                    {user.username === currentUsername ? <span className="you-tag">вы</span> : null}
                  </td>
                  <td>
                    <span className={`pill ${user.role === "admin" ? "pos" : "neu"}`}>
                      {user.role === "admin" ? "админ" : "просмотр"}
                    </span>
                  </td>
                  <td>{user.isActive ? "активен" : "отключён"}</td>
                  <td className="num">{user.activeSessions}</td>
                  <td className="num">{formatMoment(user.lastLoginAt)}</td>
                  <td>
                    {user.username === currentUsername ? null : (
                      <button type="button" className="reset-button" onClick={() => void toggleActive(user)}>
                        {user.isActive ? "отключить" : "включить"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel span={5} title="Новый пользователь" hint="пароль сменится при первом входе">
        <form className="admin-form" onSubmit={submitNewUser}>
          <label className="login-field">
            <span>Логин</span>
            <input
              type="text"
              required
              minLength={3}
              pattern="[A-Za-z0-9._@\-]+"
              title="Латинские буквы, цифры и символы . _ @ -"
              autoCapitalize="none"
              spellCheck={false}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              disabled={creating}
            />
          </label>

          <label className="login-field">
            <span>Временный пароль</span>
            <input
              type="text"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={creating}
            />
          </label>

          <label className="login-field">
            <span>Роль</span>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} disabled={creating}>
              <option value="viewer">Просмотр — только дашборд</option>
              <option value="admin">Админ — плюс пользователи и обновление данных</option>
            </select>
          </label>

          <p className="modal-note">
            Минимум 12 символов, три вида символов. Передайте пароль сотруднику лично — при первом входе
            система потребует его сменить.
          </p>

          <button type="submit" className="primary-button" disabled={creating}>
            {creating ? "Создаём…" : "Создать пользователя"}
          </button>
        </form>
      </Panel>

      <Panel span={12} title="Журнал событий" hint="входы, смены пароля, изменения пользователей">
        <div className="table-scroll audit-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Событие</th>
                <th>Кто</th>
                <th>IP</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry, i) => (
                <tr key={`${entry.at}-${i}`}>
                  <td className="num">{formatMoment(entry.at)}</td>
                  <td className={entry.action.includes("failed") ? "danger" : ""}>
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </td>
                  <td>{entry.actor ?? "—"}</td>
                  <td className="num">{entry.ip ?? "—"}</td>
                  <td>{entry.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
