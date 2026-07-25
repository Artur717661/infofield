const MEASURES = [
  { label: "CSP", title: "Content-Security-Policy: скрипты только со своего origin, без eval" },
  { label: "текст без HTML", title: "Текст постов из TG/VK рендерится как текст, а не как разметка" },
  { label: "credentials: omit", title: "Запросы к API не несут cookie и токены" },
  { label: "no-referrer", title: "Referrer-Policy не раскрывает адреса дашборда внешним хостам" },
  { label: "CSV без формул", title: "Экспорт экранирует ячейки, начинающиеся с = + - @" },
];

export function SecurityNote() {
  return (
    <footer className="security-strip">
      <span className="security-label">Защита данных</span>
      {MEASURES.map((item) => (
        <span key={item.label} className="sec-chip" title={item.title}>
          {item.label}
        </span>
      ))}
    </footer>
  );
}
