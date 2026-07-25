import { ReactNode } from "react";

type PanelProps = {
  title: string;
  hint?: string;
  span: 4 | 5 | 6 | 7 | 8 | 12;
  children: ReactNode;
};

export function Panel({ title, hint, span, children }: PanelProps) {
  return (
    <section className={`panel c${span}`}>
      <header className="panel-title">
        <span>{title}</span>
        {hint ? <span className="hint">{hint}</span> : null}
      </header>
      {children}
    </section>
  );
}
