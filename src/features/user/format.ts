/** 字节转可读流量（对齐后端 Helper::trafficConvert 的语义，按 1024 进制）。 */
export function formatBytes(bytes: number | null | undefined): string {
  const n = Number(bytes ?? 0)
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(Math.abs(n)) / Math.log(1024))
  const idx = Math.min(i, units.length - 1)
  const val = n / Math.pow(1024, idx)
  return `${val.toFixed(2)} ${units[idx]}`
}

/** GiB 数值 ↔ 字节，用于编辑表单（用户以 GB 输入流量）。 */
export function bytesToGiB(bytes: number | null | undefined): number {
  return Math.round(((Number(bytes ?? 0) / 1024 / 1024 / 1024) + Number.EPSILON) * 100) / 100
}
export function giBToBytes(gib: number | null | undefined): number {
  return Math.round(Number(gib ?? 0) * 1024 * 1024 * 1024)
}

/** 秒级时间戳转本地日期时间。 */
export function formatTimestamp(ts: number | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(Number(ts) * 1000)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

/** 到期时间展示：null = 长期有效。 */
export function formatExpire(ts: number | null | undefined): string {
  if (ts === null || ts === undefined) return '长期有效'
  return formatTimestamp(ts)
}

/** 金额（元）展示。 */
export function formatMoney(amount: number | null | undefined): string {
  return `¥${Number(amount ?? 0).toFixed(2)}`
}
