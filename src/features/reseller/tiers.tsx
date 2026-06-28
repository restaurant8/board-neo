import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type ResellerTier,
  fetchResellerTiers,
  saveResellerTiers,
} from './api'

export function ResellerTiersPage() {
  const queryClient = useQueryClient()
  const [tiers, setTiers] = useState<ResellerTier[]>([])
  const [cooldown, setCooldown] = useState('2')
  const [baseDomain, setBaseDomain] = useState('')

  const { data } = useQuery({
    queryKey: ['reseller-tiers'],
    queryFn: fetchResellerTiers,
  })

  useEffect(() => {
    if (data?.tiers) setTiers(data.tiers)
    if (data?.cooldown_days != null) setCooldown(String(data.cooldown_days))
    if (data?.base_domain != null) setBaseDomain(data.base_domain)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (t: ResellerTier[]) =>
      saveResellerTiers(t, Number(cooldown), baseDomain.trim()),
    onSuccess: () => {
      toast.success('已保存')
      queryClient.invalidateQueries({ queryKey: ['reseller-tiers'] })
    },
    onError: handleServerError,
  })

  const update = (i: number, key: keyof ResellerTier, val: string) => {
    setTiers((prev) =>
      prev.map((t, idx) => (idx === i ? { ...t, [key]: Number(val) } : t))
    )
  }
  const addRow = () =>
    setTiers((prev) => [...prev, { threshold: 0, discount: 100 }])
  const removeRow = (i: number) =>
    setTiers((prev) => prev.filter((_, idx) => idx !== i))

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
          <h2 className='mb-2 text-2xl font-bold tracking-tight'>销量阶梯</h2>
          <p className='text-muted-foreground'>
            按站长<strong>累计已确认销量</strong>给予成本折扣：达到门槛后，站长进货成本（底价）按折扣计算，卖得越多成本越低、利润越大。折扣只作用于成本，零售价仍由站长自定。
          </p>
        </div>

        <div className='-mx-4 flex-1 overflow-auto px-4 py-1'>
          <div className='mb-4 rounded-lg border p-4'>
            <div className='mb-1 text-sm font-medium'>泛域名根域（自助开站）</div>
            <p className='mb-2 text-xs text-muted-foreground'>
              填写后，用户申请分站时只需填<strong>前缀</strong>（如 <code>abc</code>），系统自动生成
              <code>abc.根域</code> 作为分站域名。需在 DNS 配好该根域的<strong>泛解析</strong>（<code>*.根域 → 服务器IP</code>）和<strong>泛域名证书</strong>。留空 = 关闭，申请时改为自由填写完整域名。
            </p>
            <Input
              type='text'
              placeholder='例如：example.com'
              value={baseDomain}
              onChange={(e) => setBaseDomain(e.target.value)}
              className='h-8 w-64 font-mono'
            />
          </div>

          <div className='mb-4 rounded-lg border p-4'>
            <div className='mb-1 text-sm font-medium'>提现冷静期（天）</div>
            <p className='mb-2 text-xs text-muted-foreground'>
              站长价差利润结算后需经过冷静期才入账并可提现；期间退款直接撤销、不影响余额。防止「提现后退款」薅平台。0 = 即时入账。
            </p>
            <Input
              type='number'
              min='0'
              max='90'
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
              className='h-8 w-28 font-mono'
            />
          </div>

          <div className='mb-3'>
            <Button variant='outline' size='sm' onClick={addRow}>
              <Plus className='mr-1 h-4 w-4' /> 添加档位
            </Button>
          </div>

          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[60px]'>档位</TableHead>
                  <TableHead>累计销量门槛（元）</TableHead>
                  <TableHead>成本折扣（%，100=原价）</TableHead>
                  <TableHead className='w-[80px]'>等价</TableHead>
                  <TableHead className='w-[70px] text-end'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.length > 0 ? (
                  tiers.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className='font-mono'>{i + 1}</TableCell>
                      <TableCell>
                        <Input
                          type='number'
                          min='0'
                          step='1'
                          value={t.threshold}
                          onChange={(e) =>
                            update(i, 'threshold', e.target.value)
                          }
                          className='h-8 w-40 font-mono'
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type='number'
                          min='1'
                          max='100'
                          step='1'
                          value={t.discount}
                          onChange={(e) =>
                            update(i, 'discount', e.target.value)
                          }
                          className='h-8 w-32 font-mono'
                        />
                      </TableCell>
                      <TableCell className='font-mono text-muted-foreground'>
                        {(t.discount / 10).toFixed(1)} 折
                      </TableCell>
                      <TableCell className='text-end'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8'
                          onClick={() => removeRow(i)}
                        >
                          <Trash2 className='h-4 w-4 text-muted-foreground hover:text-red-600' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>
                      暂无档位，点击「添加档位」
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className='mt-4'>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(tiers)}
            >
              保存阶梯
            </Button>
            <p className='mt-2 text-xs text-muted-foreground'>
              示例：门槛 0 / 折扣 100（起步原价），门槛 1000 / 折扣 90（卖满 1000
              元享 9 折成本），门槛 5000 / 折扣 80。系统自动按门槛升序匹配。
            </p>
          </div>
        </div>
      </Main>
    </>
  )
}
