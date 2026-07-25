import { Post } from "../types/post";

const HEADERS = ["date", "source", "sentiment", "audiences", "units", "events", "persons", "likes", "comments", "reposts", "views", "text"];

// Prefix cells that a spreadsheet could interpret as a formula. Post text comes
// from external channels, so it must not become executable on export.
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: string | number): string {
  const text = neutralize(String(value ?? ""));
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export function postsToCsv(posts: Post[]): string {
  const rows = posts.map((post) =>
    [
      post.date,
      post.src,
      post.sent,
      post.aud.join("; "),
      post.units.join("; "),
      post.events.join("; "),
      post.persons.join("; "),
      post.likes,
      post.comments,
      post.reposts,
      post.views,
      post.text,
    ]
      .map(cell)
      .join(",")
  );

  // BOM so Excel opens the Cyrillic text in the right encoding.
  return `﻿${HEADERS.join(",")}\n${rows.join("\n")}`;
}

export function downloadCsv(filename: string, posts: Post[]): void {
  const blob = new Blob([postsToCsv(posts)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

/**
 * Chromium silently drops a non-ASCII `download` attribute, which would leave the
 * export named "download" with no extension — so slugs are transliterated.
 */
export function safeFilename(label: string): string {
  const slug = [...label.toLowerCase()]
    .map((char) => TRANSLIT[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `infofield-${slug || "slice"}.csv`;
}
