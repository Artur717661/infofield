import { Post, Selection } from "../types/post";

export function postsForSelection(posts: Post[], selection: Selection): Post[] {
  if (!selection) return [];

  switch (selection.kind) {
    case "day":
      return posts.filter((p) => p.date === selection.value);
    case "sentiment":
      return posts.filter((p) => p.sent === selection.value);
    case "unit":
      return posts.filter((p) => p.units.includes(selection.value));
    case "person":
      return posts.filter((p) => p.persons.includes(selection.value));
    case "event":
      return posts.filter((p) => p.events.includes(selection.value));
    case "direction":
      return posts.filter((p) => p.directions.includes(selection.value));
    case "source":
      return posts.filter((p) => p.src === selection.value);
    case "ngram":
      return posts.filter((p) => p.hasRealText && p.text.toLowerCase().includes(selection.value.toLowerCase()));
    case "admissions":
      return posts.filter((p) => p.isAdmissions);
    default:
      return [];
  }
}
