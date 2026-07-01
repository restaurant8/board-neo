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

  const saveMutation = useMutation({
    mutationFn: saveResellerPrice,
    onSuccess: () => {
      toast.success('已保存')
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
            <div className='ms-auto flex gap-2'>
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
                    <button
                      type='button'
                      onClick={() => toggle(plan.id)}
                      className='flex w-full items-center justify-between bg-muted/30 px-4 py-3 hover:bg-muted/50'
                    >
                      <span className='flex items-center gap-2'>
                        {open ? (
                          <ChevronDown className='h-4 w-4' />
                        ) : (
                          <ChevronRight className='h-4 w-4' />
                        )}
                        <span className='font-medium'>{plan.name}</span>
                        {plan.exclusive && (
                          <Badge variant='secondary'>专属</Badge>
                        )}
                      </span>
                      <span className='text-xs text-muted-foreground'>
                        {enabledCount(plan)}/{plan.periods.length} 上架 ·{' '}
                        {plan.periods.length} 个周期
                      </span>
                    </button>

                    {open && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='w-[110px]'>周期</TableHead>
                            <TableHead className='w-[110px]'>主站价</TableHead>
                            <TableHead className='w-[150px]'>底价（元）</TableHead>
                            <TableHead className='w-[110px]'>零售价</TableHead>
                            <TableHead className='w-[80px]'>上架</TableHead>
                            <TableHead className='w-[90px] text-end'>
                              操作
                            </TableHead>
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
                                <TableCell className='text-end'>
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    disabled={
                                      saveMutation.isPending ||
                                      edit.floor === ''
                                    }
                                    onClick={() =>
                                      saveMutation.mutate({
                                        site_id: siteId as number,
                                        plan_id: plan.id,
                                        period: period.period,
                                        floor_price: Math.round(
                                          Number(edit.floor) * 100
                                        ),
                                        enabled: edit.enabled,
                                      })
                                    }
                                  >
                                    保存
                                  </Button>
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
