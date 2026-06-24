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

/**
 * 到期状态（对齐官方 columns.expire_status）：
 * - null → 长期有效
 * - 已过去 → 已过期 N 天
 * - 未来 → 剩余 N 天
 */
export function formatExpireStatus(ts: number | null | undefined): {
  text: string
  expired: boolean
  permanent: boolean
} {
  if (!ts) return { text: '长期有效', expired: false, permanent: true }
  const now = Math.floor(Date.now() / 1000)
  const dayMs = 86400
  if (ts <= now) {
    const days = Math.max(0, Math.floor((now - ts) / dayMs))
    return { text: `已过期 ${days} 天`, expired: true, permanent: false }
  }
  const days = Math.max(0, Math.ceil((ts - now) / dayMs))
  return { text: `剩余 ${days} 天`, expired: false, permanent: false }
}

/**
 * 在线状态（对齐官方 columns.online_status）。
 * t = 最后在线时间戳（秒），0/null = 从未在线。
 * 5 分钟内视为当前在线。
 */
export function formatOnlineStatus(t: number | null | undefined): {
  text: string
  online: boolean
} {
  const last = Number(t ?? 0)
  if (!last) return { text: '从未在线', online: false }
  const now = Math.floor(Date.now() / 1000)
  const diff = now - last
  if (diff <= 300) return { text: '当前在线', online: true }
  let dur: string
  if (diff >= 86400) dur = `离线时长: ${Math.floor(diff / 86400)}天`
  else if (diff >= 3600) dur = `离线时长: ${Math.floor(diff / 3600)}小时`
  else if (diff >= 60) dur = `离线时长: ${Math.floor(diff / 60)}分钟`
  else dur = `离线时长: ${diff}秒`
  return { text: `最后在线时间: ${formatTimestamp(last)}（${dur}）`, online: false }
}

/** 设备限制展示（对齐官方 columns.device_limit）。 */
export function formatDeviceLimit(limit: number | null | undefined): string {
  if (limit === null || limit === undefined || limit === 0)
    return '无设备数限制'
  return `最多可同时在线 ${limit} 台设备`
}

/** 金额（元）展示。 */
export function formatMoney(amount: number | null | undefined): string {
  return `¥${Number(amount ?? 0).toFixed(2)}`
}
