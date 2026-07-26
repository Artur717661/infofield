import { useState } from "react";
import { motion } from "framer-motion";
import { ApiError, changePassword } from "../api/auth";

type ChangePasswordDialogProps = {
  forced: boolean;
  onDone: () => void;
  onCancel: () => void;
};

export function ChangePasswordDialog({ forced, onDone, onCancel }: ChangePasswordDialogProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (next !== repeat) {
      setError("Новый пароль и повтор не совпадают.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await changePassword(current, next);
      onDone();
    } catch (changeError) {
      setError(changeError instanceof ApiError ? changeError.message : "Не удалось сменить пароль.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="drilldown-backdrop" onClick={forced ? undefined : onCancel} />
      <motion.form
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Смена пароля"
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <h3>Смена пароля</h3>
        {forced ? (
          <p className="modal-note">
            Этот пароль выдан администратором. Задайте свой, прежде чем продолжить.
          </p>
        ) : null}

        <label className="login-field">
          <span>Текущий пароль</span>
          <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy} />
        </label>

        <label className="login-field">
          <span>Новый пароль</span>
          <input type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} />
        </label>

        <label className="login-field">
          <span>Повторите новый пароль</span>
          <input type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} disabled={busy} />
        </label>

        <p className="modal-note">
          Минимум 12 символов и три вида символов из четырёх: строчные, прописные, цифры, знаки.
          Пароль не должен содержать логин.
        </p>

        {error ? (
          <div className="login-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="modal-actions">
          {forced ? null : (
            <button type="button" className="reset-button" onClick={onCancel} disabled={busy}>
              отмена
            </button>
          )}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Сохраняем…" : "Сменить пароль"}
          </button>
        </div>
      </motion.form>
    </>
  );
}
