import { useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type RangeMode = 'today' | '7' | '15' | '30' | 'custom'

export const RANGE_OPTIONS: { value: RangeMode; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: '7', label: '最近7天' },
  { value: '15', label: '最近15天' },
  { value: '30', label: '最近30天' },
  { value: 'custom', label: '自定义范围' },
]

const DAY = 86400

// 后端把当天流量统计行写成 record_at = 服务器时区(Asia/Shanghai, UTC+8) 的 0 点。
// 因此所有“日”边界必须按 UTC+8 计算，不能用浏览器本地时区：否则当浏览器时区领先
// UTC+8（如东京 UTC+9，且已过北京 23:00）时，“今日”窗口会整体偏后一天，把服务器
// 当天的 record_at 排除在外，导致今日流量排行永远空白。这里复刻原版的 NS/ES/LS：
// NS = (480 + getTimezoneOffset()) 分钟，本地为 UTC+8 时 NS=0（行为不变，无回归）。
const SERVER_TZ_OFFSET_MIN = 480 // UTC+8
function nsMs(d: Date) {
  return (SERVER_TZ_OFFSET_MIN + d.getTimezoneOffset()) * 60_000
}
/** 浏览器瞬时 → 一个 getFullYear/Month/Date 读出为“服务器时区墙钟”的 Date（原版 ES） */
function toServer(d: Date) {
  return new Date(d.getTime() + nsMs(d))
}
/** 服务器时区墙钟 Date → 真实 unix 瞬时（原版 LS） */
function fromServer(d: Date) {
  return new Date(d.getTime() - nsMs(d))
}

function startOfToday() {
  const t = toServer(new Date())
  const n = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  return Math.floor(fromServer(n).getTime() / 1000)
}
/** date input(yyyy-mm-dd) → unix 秒(服务器时区 0 点) */
function dateToTs(v: string) {
  if (!v) return 0
  const [y, m, d] = v.split('-').map(Number)
  return Math.floor(fromServer(new Date(y, m - 1, d)).getTime() / 1000)
}
function tsToDate(ts: number) {
  const d = toServer(new Date(ts * 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 仪表盘全局时间范围状态。range 为 [start_date, end_date)（end 为开区间）。 */
export function useTimeRange(initial: RangeMode = '7') {
  const today = startOfToday()
  const [mode, setMode] = useState<RangeMode>(initial)
  const [customStart, setCustomStart] = useState(tsToDate(today - 6 * DAY))
  const [customEnd, setCustomEnd] = useState(tsToDate(today))

  const range = useMemo(() => {
    const end = today + DAY // 开区间上界(明天 0 点)
    if (mode === 'today') return { start_date: today, end_date: end }
    if (mode === 'custom') {
      const s = dateToTs(customStart) || today
      const e = (dateToTs(customEnd) || today) + DAY
      return { start_date: s, end_date: e }
    }
    const days = Number(mode)
    return { start_date: today - (days - 1) * DAY, end_date: end }
  }, [mode, customStart, customEnd, today])

  return {
    mode,
    setMode,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    range,
  }
}

type Props = ReturnType<typeof useTimeRange>

/** 官方同款全局时间范围下拉（今天 / 最近7天 / 最近15天 / 最近30天 / 自定义范围）。 */
export function TimeRangeSelect({
  mode,
  setMode,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: Props) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      {mode === 'custom' && (
        <>
          <Input
            type='date'
            className='h-8 w-36'
            value={customStart}
            max={customEnd}
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <span className='text-muted-foreground text-sm'>~</span>
          <Input
            type='date'
            className='h-8 w-36'
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
          />
        </>
      )}
      <Select value={mode} onValueChange={(v) => setMode(v as RangeMode)}>
        <SelectTrigger className='h-8 w-32'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Activity className='text-muted-foreground size-5' />
    </div>
  )
}
