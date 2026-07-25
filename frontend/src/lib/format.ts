export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

export function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}`;
}
