export function fmtMoney(v: number | string | undefined, withSymbol = true): string {
  const n = Number(v || 0);
  const str = n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withSymbol ? '¥' + str : str;
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
