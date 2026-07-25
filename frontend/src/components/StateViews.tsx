export function LoadingState() {
  return (
    <div className="state-card">
      <div className="radar-loader" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h3>Собираем информационное поле</h3>
      <p>
        Backend опрашивает Telegram и ВКонтакте, размечает новые публикации и отдаёт их на <code>/telegram</code> и{" "}
        <code>/vk</code>. Первый запрос может занять до минуты.
      </p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state-card error">
      <h3>Нет связи с backend</h3>
      <p>{message}</p>
      <p className="state-hint">
        Проверьте, что запущен <code>uvicorn backend.main:app</code> на порту 8000 и что база доступна.
      </p>
      <button type="button" className="primary-button" onClick={onRetry}>
        Попробовать снова
      </button>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="state-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
