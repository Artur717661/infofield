import { useState } from "react";
import { ApiError, CurrentUser, login } from "../api/auth";

type LoginScreenProps = {
  onSuccess: (user: CurrentUser) => void;
};

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    try {
      onSuccess(await login(username.trim(), password));
    } catch (loginError) {
      setError(
        loginError instanceof ApiError
          ? loginError.message
          : "Не удалось связаться с сервером. Проверьте соединение."
      );
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-radar" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="dot" />
          <b>INFOFIELD</b>
        </div>
        <h1>Информационное поле университета</h1>
        <p className="login-sub">Доступ к аналитике только для сотрудников. Войдите, чтобы продолжить.</p>

        <label className="login-field">
          <span>Логин</span>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
          />
        </label>

        <label className="login-field">
          <span>Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>

        {error ? (
          <div className="login-error" role="alert">
            {error}
          </div>
        ) : null}

        <button type="submit" className="primary-button login-submit" disabled={busy}>
          {busy ? "Проверяем…" : "Войти"}
        </button>

        <p className="login-note">
          После пяти неудачных попыток вход блокируется на 15 минут. Если забыли пароль, обратитесь к
          администратору дашборда.
        </p>
      </form>
    </div>
  );
}
