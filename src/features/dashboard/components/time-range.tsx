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

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}
/** date input(yyyy-mm-dd) → unix 秒(当地 0 点) */
function dateToTs(v: string) {
  return v ? Math.floor(new Date(`${v}T00:00:00`).getTime() / 1000) : 0
}
function tsToDate(ts: number) {
  const d = new Date(ts * 1000)
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
