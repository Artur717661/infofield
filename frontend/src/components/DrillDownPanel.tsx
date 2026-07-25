import { AnimatePresence, motion } from "framer-motion";
import { Post } from "../types/post";
import { formatDate, formatNumber } from "../lib/format";

type DrillDownPanelProps = {
  label: string | null;
  posts: Post[];
  onClose: () => void;
};

const SENTIMENT_LABEL: Record<string, string> = { pos: "позитив", neu: "нейтрально", neg: "негатив" };

export function DrillDownPanel({ label, posts, onClose }: DrillDownPanelProps) {
  const open = label !== null;

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
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="drilldown-header">
              <div>
                <h3>{label}</h3>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)" }}>
                  {formatNumber(posts.length)} публикаций
                </span>
              </div>
              <button className="drilldown-close" onClick={onClose} aria-label="Закрыть">
                ✕
              </button>
            </div>
            <div className="drilldown-list">
              {posts.slice(0, 200).map((post) => (
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
              {posts.length === 0 ? (
                <p style={{ color: "var(--text-faint)", fontSize: 13, padding: "20px 8px" }}>Нет публикаций по этому срезу.</p>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
