type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="state-card state-card-error">
      <h3>Не удалось подключиться к API</h3>
      <p>{message}</p>
      <button className="primary-button" type="button" onClick={onRetry}>
        Повторить запрос
      </button>
    </div>
  );
}
