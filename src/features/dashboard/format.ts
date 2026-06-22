export function formatBytes(bytes: number | null | undefined): string {
  const n = Number(bytes ?? 0)
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(
    Math.floor(Math.log(Math.abs(n)) / Math.log(1024)),
    units.length - 1
  )
  return `${(n / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

/** 分 → 元，带 ¥。 */
export function formatCents(cents: number | null | undefined): string {
  return `¥${(Number(cents ?? 0) / 100).toFixed(2)}`
}

/** 元金额（已 /100 的字段，如 stat record paid_total）。 */
export function formatYuan(yuan: number | null | undefined): string {
  return `¥${Number(yuan ?? 0).toFixed(2)}`
}

export function formatPercent(p: number | null | undefined): string {
  const n = Number(p ?? 0)
  return `${n > 0 ? '+' : ''}${n}%`
}
