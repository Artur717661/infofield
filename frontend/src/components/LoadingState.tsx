export function LoadingState() {
  return (
    <div className="state-card">
      <div className="spinner" aria-hidden="true" />
      <h3>Загружаем данные</h3>
      <p>Подключаемся к backend и собираем публикации из Telegram и VK.</p>
    </div>
  );
}
