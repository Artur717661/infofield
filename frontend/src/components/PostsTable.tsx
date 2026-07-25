import { useState } from "react";
import { Post } from "../types/post";
import { formatNumber } from "../utils/analytics";
import { EmptyState } from "./EmptyState";

type PostsTableProps = {
  posts: Post[];
};

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "—";
}

function TextPreview({ text, expanded }: { text: string; expanded: boolean }) {
  const limit = 260;
  if (expanded || text.length <= limit) {
    return <span>{text}</span>;
  }

  return <span>{text.slice(0, limit).trimEnd()}...</span>;
}

export function PostsTable({ posts }: PostsTableProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  if (posts.length === 0) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Посты</h2>
            <p>Список публикаций по текущим фильтрам.</p>
          </div>
        </div>
        <EmptyState title="Нет постов" description="Попробуйте изменить диапазон дат или очистить фильтры." />
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Посты</h2>
          <p>Всего в таблице: {posts.length}</p>
        </div>
      </div>

      <div className="posts-table-wrapper">
        <table className="posts-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Источник</th>
              <th>Текст</th>
              <th>Аудитория</th>
              <th>Тональность</th>
              <th>Направления</th>
              <th>Подразделения</th>
              <th>События</th>
              <th>Просмотры</th>
              <th>Лайки</th>
              <th>Комментарии</th>
              <th>Репосты</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => {
              const expanded = expandedIds.includes(post.id);

              return (
                <tr key={post.id}>
                  <td>{post.date || "—"}</td>
                  <td>
                    <span className={`source-badge source-${post.src}`}>{post.src.toUpperCase()}</span>
                  </td>
                  <td className="text-cell">
                    <TextPreview text={post.text} expanded={expanded} />
                    <div className="text-actions">
                      {post.text.length > 260 ? (
                        <button
                          className="link-button"
                          type="button"
                          onClick={() =>
                            setExpandedIds((current) =>
                              current.includes(post.id)
                                ? current.filter((id) => id !== post.id)
                                : [...current, post.id],
                            )
                          }
                        >
                          {expanded ? "Свернуть" : "Показать полностью"}
                        </button>
                      ) : null}
                      {!post.hasRealText ? <span className="muted-inline">API не вернул text</span> : null}
                    </div>
                  </td>
                  <td>{formatList(post.aud)}</td>
                  <td>{post.sent}</td>
                  <td>{formatList(post.directions)}</td>
                  <td>{formatList(post.units)}</td>
                  <td>{formatList(post.events)}</td>
                  <td>{formatNumber(post.views)}</td>
                  <td>{formatNumber(post.likes)}</td>
                  <td>{formatNumber(post.comments)}</td>
                  <td>{formatNumber(post.reposts)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
