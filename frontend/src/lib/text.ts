import { Post } from "../types/post";

const STOPWORDS = new Set([
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она",
  "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее",
  "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда",
  "даже", "ну", "вдруг", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до",
  "вас", "нибудь", "опять", "уж", "вам", "для", "этого", "чтобы", "без", "будто", "чего",
  "раз", "тоже", "себе", "под", "этот", "того", "потому", "этом", "своей", "своего",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[«»"'()–—:;,.!?№]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word) && !/^\d+$/.test(word));
}

function bigrams(tokens: string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    pairs.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return pairs;
}

export function topNgrams(posts: Post[], limit = 8): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!post.hasRealText) continue;
    for (const gram of bigrams(tokenize(post.text))) {
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
