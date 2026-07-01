import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type ResellerPricePlan,
  fetchResellerPrices,
  fetchResellerSites,
  saveResellerPrice,
} from './api'

const PERIOD_LABELS: Record<string, string> = {
  monthly: '月付',
  quarterly: '季付',
  half_yearly: '半年付',
  yearly: '年付',
  two_yearly: '两年付',
  three_yearly: '三年付',
  onetime: '一次性',
  reset_traffic: '流量重置',
}

const yuan = (cents: number | null | undefined) =>
  cents == null ? '—' : (cents / 100).toFixed(2)

export function ResellerPricingPage() {
  const queryClient = useQueryClient()
  const [siteId, setSiteId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  // 本地编辑缓冲：key = `${planId}:${period}` → { floor(元字符串), enabled }
  const [edits, setEdits] = useState<
    Record<string, { floor: string; enabled: boolean }>
  >({})

  const { data: sites } = useQuery({
    queryKey: ['reseller-sites'],
    queryFn: fetchResellerSites,
  })

  useEffect(() => {
    if (siteId == null && sites && sites.length > 0) setSiteId(sites[0].id)
  }, [sites, siteId])

  const { data: pricing } = useQuery({
    queryKey: ['reseller-prices', siteId],
    queryFn: () => fetchResellerPrices(siteId as number),
    enabled: siteId != null,
  })

  // 切换分站时清空编辑缓冲（换站点才整体重置）
  useEffect(() => {
    setEdits({})
  }, [siteId])

  // 拉到数据时，只为「尚未编辑过」的行填充服务器值；已在编辑/刚保存的行保持本地值，
  // 避免保存一行后 refetch 把其它未保存行的开关/底价刷回去。
  useEffect(() => {
    if (!pricing) return
    setEdits((prev) => {
      const next = { ...prev }
      pricing.plans.forEach((p) =>
        p.periods.forEach((pe) => {
          const key = `${p.id}:${pe.period}`
          if (!(key in next)) {
            next[key] = {
              floor: pe.floor_price == null ? '' : String(pe.floor_price / 100),
              enabled: pe.enabled,
            }
          }
        })
      )
      return next
    })
  }, [pricing])

  // 服务器原值，用于判断哪些行改动过（脏）
  const originalMap = useMemo(() => {
    const m: Record<string, { floor: string; enabled: boolean }> = {}
    pricing?.plans.forEach((p) =>
      p.periods.forEach((pe) => {
        m[`${p.id}:${pe.period}`] = {
          floor: pe.floor_price == null ? '' : String(pe.floor_price / 100),
          enabled: pe.enabled,
        }
      })
    )
    return m
  }, [pricing])

  const dirtyKeys = useMemo(
    () =>
      Object.keys(edits).filter((key) => {
        const e = edits[key]
        if (!e || e.floor === '') return false // 无底价不可保存
        const o = originalMap[key]
        if (!o) return true
        return e.floor !== o.floor || e.enabled !== o.enabled
      }),
    [edits, originalMap]
  )

  // 整页一次性保存所有改动过的行（批量）
  const saveAllMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        dirtyKeys.map((key) => {
          const i = key.indexOf(':')
          const planId = Number(key.slice(0, i))
          const period = key.slice(i + 1)
          const e = edits[key]
          return saveResellerPrice({
            site_id: siteId as number,
            plan_id: planId,
            period,
            floor_price: Math.round(Number(e.floor) * 100),
            enabled: e.enabled,
          })
        })
      )
    },
    onSuccess: () => {
      toast.success(`已保存 ${dirtyKeys.length} 项`)
      queryClient.invalidateQueries({ queryKey: ['reseller-prices', siteId] })
    },
    onError: handleServerError,
  })

  const plans = useMemo(() => {
    if (!pricing) return [] as ResellerPricePlan[]
    const kw = search.trim().toLowerCase()
    return kw
      ? pricing.plans.filter((p) => p.name.toLowerCase().includes(kw))
      : pricing.plans
  }, [pricing, search])

  const toggle = (id: number) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  // 一键把该套餐所有周期的底价填成主站价（保留上架开关，等整页保存）
  const fillFloorFromMain = (plan: ResellerPricePlan) => {
    let filled = 0
    setEdits((prev) => {
      const next = { ...prev }
      plan.periods.forEach((pe) => {
        if (pe.main_price == null) return
        const key = `${plan.id}:${pe.period}`
        next[key] = {
          ...(next[key] ?? { floor: '', enabled: false }),
          floor: String(pe.main_price / 100),
        }
        filled++
      })
      return next
    })
    toast.success(
      filled > 0 ? `已填入 ${filled} 个周期的主站价，记得保存` : '该套餐无主站价可填'
    )
  }

  const enabledCount = (p: ResellerPricePlan) =>
    p.periods.filter((pe) => edits[`${p.id}:${pe.period}`]?.enabled).length

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col' fixed>
        <div className='mb-2'>
          <h2 className='mb-2 text-2xl font-bold tracking-tight'>分站定价</h2>
          <p className='text-muted-foreground'>
            为分站设置每个套餐每个周期的<strong>底价</strong>
            并决定是否上架。站长在底价之上自定零售价，差价即站长利润。
          </p>
        </div>

        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <span className='text-sm text-muted-foreground'>选择分站：</span>
          <Select
            value={siteId == null ? '' : String(siteId)}
            onValueChange={(v) => setSiteId(Number(v))}
          >
            <SelectTrigger className='w-[240px]'>
              <SelectValue placeholder='选择分站' />
            </SelectTrigger>
            <SelectContent>
              {(sites ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                  {s.domain ? ` (${s.domain})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className='relative'>
            <Search className='absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='搜索套餐名...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='h-9 w-[200px] pl-8'
            />
          </div>
          {plans.length > 0 && (
            <div className='ms-auto flex items-center gap-2'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() =>
                  setExpanded(
                    Object.fromEntries(plans.map((p) => [p.id, true]))
                  )
                }
              >
                全部展开
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setExpanded({})}
              >
                全部折叠
              </Button>
              <Button
                size='sm'
                disabled={dirtyKeys.length === 0 || saveAllMutation.isPending}
                onClick={() => saveAllMutation.mutate()}
              >
                保存
                {dirtyKeys.length > 0 ? ` (${dirtyKeys.length})` : ''}
              </Button>
            </div>
          )}
        </div>

        <div className='-mx-4 flex-1 overflow-auto px-4 py-1'>
          {plans.length > 0 ? (
            <div className='space-y-2'>
              {plans.map((plan) => {
                const open = !!expanded[plan.id]
                return (
                  <div key={plan.id} className='overflow-hidden rounded-md border'>
                    <div className='flex w-full items-center justify-between gap-2 bg-muted/30 px-4 py-3'>
                      <button
                        type='button'
                        onClick={() => toggle(plan.id)}
                        className='flex flex-1 items-center gap-2 text-left hover:opacity-80'
                      >
                        {open ? (
                          <ChevronDown className='h-4 w-4 shrink-0' />
                        ) : (
                          <ChevronRight className='h-4 w-4 shrink-0' />
                        )}
                        <span className='font-medium'>{plan.name}</span>
                        {plan.exclusive && (
                          <Badge variant='secondary'>专属</Badge>
                        )}
                      </button>
                      <span className='hidden text-xs text-muted-foreground sm:inline'>
                        {enabledCount(plan)}/{plan.periods.length} 上架 ·{' '}
                        {plan.periods.length} 个周期
                      </span>
                      <Button
                        variant='outline'
                        size='sm'
                        className='shrink-0'
                        onClick={() => fillFloorFromMain(plan)}
                      >
                        底价填主站价
                      </Button>
                    </div>

                    {open && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='w-[110px]'>周期</TableHead>
                            <TableHead className='w-[110px]'>主站价</TableHead>
                            <TableHead className='w-[150px]'>底价（元）</TableHead>
                            <TableHead className='w-[110px]'>零售价</TableHead>
                            <TableHead className='w-[80px]'>上架</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plan.periods.map((period) => {
                            const key = `${plan.id}:${period.period}`
                            const edit = edits[key] ?? {
                              floor: '',
                              enabled: false,
                            }
                            return (
                              <TableRow key={key}>
                                <TableCell>
                                  {PERIOD_LABELS[period.period] ??
                                    period.period}
                                </TableCell>
                                <TableCell className='font-mono text-xs text-muted-foreground'>
                                  ¥{yuan(period.main_price)}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type='number'
                                    min='0'
                                    step='0.01'
                                    value={edit.floor}
                                    onChange={(e) =>
                                      setEdits((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...(prev[key] ?? edit),
                                          floor: e.target.value,
                                        },
                                      }))
                                    }
                                    className='h-8 w-28 font-mono'
                                    placeholder='底价'
                                  />
                                </TableCell>
                                <TableCell className='font-mono text-xs'>
                                  ¥{yuan(period.retail_price)}
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={edit.enabled}
                                    onCheckedChange={(v) =>
                                      setEdits((prev) => ({
                                        ...prev,
                                        [key]: { ...(prev[key] ?? edit), enabled: v },
                                      }))
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className='rounded-md border py-16 text-center text-muted-foreground'>
              {siteId == null
                ? '请先选择分站'
                : search
                  ? '没有匹配的套餐'
                  : '该分站暂无可定价套餐'}
            </div>
          )}
        </div>
      </Main>
    </>
  )
}
