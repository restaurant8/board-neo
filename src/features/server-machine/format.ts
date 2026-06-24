/** 机器负载快照结构（load_status）。 */
export type MachineLoad = {
  cpu?: number
  mem?: { total: number; used: number }
  swap?: { total: number; used: number }
  disk?: { total: number; used: number }
  net?: { in_speed: number; out_speed: number }
  version?: string
}

export function readLoad(load: Record<string, unknown> | null): MachineLoad {
  return (load ?? {}) as MachineLoad
}

/** 字节 → 人类可读（GB/MB...）。 */
export function fmtBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 2)} ${units[i]}`
}

/** 字节/秒 → 速率（MB/s）。 */
export function fmtSpeed(bps?: number): string {
  return `${fmtBytes(bps)}/s`
}

export function pct(used?: number, total?: number): number {
  if (!used || !total || total <= 0) return 0
  return Math.min(100, Math.round((used / total) * 100))
}

/** 相对时间，如 "27s" / "3m" / "2h"。 */
export function fmtAgo(ts?: number | null): string {
  if (!ts) return '—'
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - ts))
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

/** 是否在线（最近 5 分钟内有心跳）。 */
export function isOnline(ts?: number | null): boolean {
  if (!ts) return false
  return Date.now() / 1000 - ts < 300
}

/** 高负载判定。 */
export function isHighLoad(load: MachineLoad): boolean {
  const cpu = load.cpu ?? 0
  const memPct = pct(load.mem?.used, load.mem?.total)
  const diskPct = pct(load.disk?.used, load.disk?.total)
  return cpu >= 80 || memPct >= 85 || diskPct >= 90
}
