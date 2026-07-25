type HeaderProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function Header({ theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="hero">
      <div>
        <div className="eyebrow">InfoField</div>
        <h1>InfoField</h1>
        <p>Аналитика публикаций университета</p>
      </div>

      <button className="theme-toggle" type="button" onClick={onToggleTheme}>
        {theme === "light" ? "Тёмная тема" : "Светлая тема"}
      </button>
    </header>
  );
}
