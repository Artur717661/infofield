import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Post } from "../types/post";
import { formatDate, formatNumber } from "../lib/format";
import { downloadCsv, safeFilename } from "../lib/export";

type DrillDownPanelProps = {
  label: string | null;
  posts: Post[];
  onClose: () => void;
};

type SortMode = "date" | "engagement";

const SENTIMENT_LABEL: Record<string, string> = { pos: "позитив", neu: "нейтрально", neg: "негатив" };
const PAGE_SIZE = 40;

export function DrillDownPanel({ label, posts, onClose }: DrillDownPanelProps) {
  const open = label !== null;
  const [sort, setSort] = useState<SortMode>("date");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setVisible(PAGE_SIZE);
    setSort("date");
    closeRef.current?.focus();
  }, [open, label]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sorted = useMemo(() => {
    const copy = [...posts];
    if (sort === "engagement") {
      copy.sort((a, b) => b.engagement - a.engagement);
    } else {
      copy.sort((a, b) => b.date.localeCompare(a.date));
    }
    return copy;
  }, [posts, sort]);

  const summary = useMemo(() => {
    const engagement = posts.reduce((s, p) => s + p.engagement, 0);
    const views = posts.reduce((s, p) => s + p.views, 0);
    const neg = posts.filter((p) => p.sent === "neg").length;
    return { engagement, views, negShare: posts.length ? Math.round((neg / posts.length) * 100) : 0 };
  }, [posts]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            className="drilldown-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            className="drilldown-panel"
            role="dialog"
            aria-modal="true"
            aria-label={label ?? undefined}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 340 }}
          >
            <div className="drilldown-header">
              <div className="drilldown-title">
                <h3>{label}</h3>
                <span className="drilldown-count">{formatNumber(posts.length)} публикаций</span>
              </div>
              <button ref={closeRef} className="drilldown-close" onClick={onClose} aria-label="Закрыть панель">
                ✕
              </button>
            </div>

            {posts.length > 0 ? (
              <>
                <div className="drilldown-summary">
                  <div>
                    <span className="k">Вовлечённость</span>
                    <b>{formatNumber(summary.engagement)}</b>
                  </div>
                  <div>
                    <span className="k">Просмотры</span>
                    <b>{formatNumber(summary.views)}</b>
                  </div>
                  <div>
                    <span className="k">Негатив</span>
                    <b style={{ color: summary.negShare > 20 ? "var(--neg)" : undefined }}>{summary.negShare}%</b>
                  </div>
                </div>

                <div className="drilldown-tools">
                  <div className="filter-group">
                    <button
                      type="button"
                      className={`chip${sort === "date" ? " active" : ""}`}
                      onClick={() => setSort("date")}
                    >
                      по дате
                    </button>
                    <button
                      type="button"
                      className={`chip${sort === "engagement" ? " active" : ""}`}
                      onClick={() => setSort("engagement")}
                    >
                      по вовлечённости
                    </button>
                  </div>
                  <button
                    type="button"
                    className="reset-button"
                    onClick={() => downloadCsv(safeFilename(label ?? "срез"), sorted)}
                  >
                    CSV
                  </button>
                </div>
              </>
            ) : null}

            <div className="drilldown-list">
              {sorted.slice(0, visible).map((post) => (
                <article key={post.id} className="drill-post">
                  <div className="meta">
                    <span className={`source-tag ${post.src}`}>{post.src}</span>
                    <span>{formatDate(post.date)}</span>
                    <span className={`pill ${post.sent === "pos" ? "pos" : post.sent === "neg" ? "neg" : "neu"}`}>
                      {SENTIMENT_LABEL[post.sent] ?? post.sent}
                    </span>
                  </div>
                  {/* Plain-text React child only — never HTML from an external source. */}
                  <p className="text">{post.text}</p>
                  <div className="stats">
                    <span>♥ {formatNumber(post.likes)}</span>
                    <span>💬 {formatNumber(post.comments)}</span>
                    <span>↻ {formatNumber(post.reposts)}</span>
                    <span>👁 {formatNumber(post.views)}</span>
                  </div>
                </article>
              ))}

              {sorted.length > visible ? (
                <button type="button" className="load-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Показать ещё {Math.min(PAGE_SIZE, sorted.length - visible)}
                </button>
              ) : null}

              {posts.length === 0 ? <p className="drilldown-empty">Нет публикаций по этому срезу.</p> : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
