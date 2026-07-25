export function LoadingState() {
  return (
    <div className="state-card">
      <div className="spinner" />
      <h3>Синхронизация с бэкендом</h3>
      <p>Забираем публикации из /telegram и /vk…</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state-card" style={{ borderColor: "rgba(255,84,104,0.35)" }}>
      <h3 style={{ color: "var(--neg)" }}>Backend недоступен</h3>
      <p>{message}</p>
      <button className="reset-button" onClick={onRetry}>
        повторить
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
