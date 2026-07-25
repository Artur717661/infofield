export function SecurityNote() {
  return (
    <div className="security-strip">
      <span className="sec-chip">🔒 CSP</span>
      <span className="sec-chip">текст без HTML-рендера</span>
      <span className="sec-chip">CORS allowlist</span>
      <span className="sec-chip">credentials: omit</span>
    </div>
  );
}
