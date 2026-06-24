import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { fetchPlans } from '@/features/plan/api'
import { MultiCheck } from '@/components/multi-check'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  type GiftCardTemplate,
  GIFT_CARD_TYPE_MAP,
  createTemplate,
  updateTemplate,
} from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current?: GiftCardTemplate | null
}

const GB = 1024 * 1024 * 1024
const TYPE_PLAN = 2

/** 区块标题 */
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className='grid gap-3 rounded-lg border p-4'>
      <div className='text-sm font-semibold'>{title}</div>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className='grid gap-1.5'>
      <Label className='text-xs'>{label}</Label>
      {children}
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  )
}

const n = (s: string): number | undefined =>
  s.trim() === '' ? undefined : Number(s)
const toLocal = (ts?: number) => {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocal = (v: string) =>
  v ? Math.floor(new Date(v).getTime() / 1000) : undefined

export function TemplateMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: fetchPlans })

  // 基础
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState(1)
  const [status, setStatus] = useState(true)
  const [sort, setSort] = useState('0')
  // 奖励
  const [balance, setBalance] = useState('') // 元
  const [transferEnable, setTransferEnable] = useState('') // GB
  const [expireDays, setExpireDays] = useState('')
  const [deviceLimit, setDeviceLimit] = useState('')
  const [resetPackage, setResetPackage] = useState(false)
  const [planId, setPlanId] = useState('')
  const [planValidityDays, setPlanValidityDays] = useState('')
  const [inviteRewardRate, setInviteRewardRate] = useState('')
  // 条件
  const [newUserOnly, setNewUserOnly] = useState(false)
  const [newUserMaxDays, setNewUserMaxDays] = useState('')
  const [paidUserOnly, setPaidUserOnly] = useState(false)
  const [requireInvite, setRequireInvite] = useState(false)
  const [allowedPlans, setAllowedPlans] = useState<string[]>([])
  // 限制
  const [maxUsePerUser, setMaxUsePerUser] = useState('')
  const [cooldownHours, setCooldownHours] = useState('')
  // 特殊
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [festivalBonus, setFestivalBonus] = useState('')
  // 显示
  const [themeColor, setThemeColor] = useState('#1890ff')
  const [icon, setIcon] = useState('')
  const [backgroundImage, setBackgroundImage] = useState('')

  useEffect(() => {
    if (!open) return
    const r = (current?.rewards ?? {}) as Record<string, unknown>
    const c = (current?.conditions ?? {}) as Record<string, unknown>
    const l = (current?.limits ?? {}) as Record<string, unknown>
    const s = (current?.special_config ?? {}) as Record<string, unknown>
    const num = (x: unknown) => (x == null ? '' : String(x))
    setName(current?.name ?? '')
    setDescription(current?.description ?? '')
    setType(current?.type ?? 1)
    setStatus(current ? !!current.status : true)
    setSort(current?.sort != null ? String(current.sort) : '0')
    setBalance(r.balance ? String(Number(r.balance) / 100) : '')
    setTransferEnable(r.transfer_enable ? String(Number(r.transfer_enable) / GB) : '')
    setExpireDays(num(r.expire_days))
    setDeviceLimit(num(r.device_limit))
    setResetPackage(!!r.reset_package)
    setPlanId(num(r.plan_id))
    setPlanValidityDays(num(r.plan_validity_days))
    setInviteRewardRate(num(r.invite_reward_rate))
    setNewUserOnly(!!c.new_user_only)
    setNewUserMaxDays(num(c.new_user_max_days))
    setPaidUserOnly(!!c.paid_user_only)
    setRequireInvite(!!c.require_invite)
    setAllowedPlans(
      Array.isArray(c.allowed_plans) ? c.allowed_plans.map((x) => String(x)) : []
    )
    setMaxUsePerUser(num(l.max_use_per_user))
    setCooldownHours(num(l.cooldown_hours))
    setStartTime(toLocal(s.start_time as number | undefined))
    setEndTime(toLocal(s.end_time as number | undefined))
    setFestivalBonus(num(s.festival_bonus))
    setThemeColor(current?.theme_color ?? '#1890ff')
    setIcon(current?.icon ?? '')
    setBackgroundImage(current?.background_image ?? '')
  }, [open, current])

  const mutation = useMutation({
    mutationFn: () => {
      // rewards（balance 元→分；transfer GB→字节）
      const rewards: Record<string, unknown> = {}
      if (n(balance)) rewards.balance = Math.round(Number(balance) * 100)
      if (n(transferEnable))
        rewards.transfer_enable = Math.round(Number(transferEnable) * GB)
      if (n(expireDays)) rewards.expire_days = n(expireDays)
      if (n(deviceLimit)) rewards.device_limit = n(deviceLimit)
      if (resetPackage) rewards.reset_package = true
      if (n(inviteRewardRate)) rewards.invite_reward_rate = n(inviteRewardRate)
      if (type === TYPE_PLAN) {
        if (n(planId)) rewards.plan_id = n(planId)
        if (n(planValidityDays)) rewards.plan_validity_days = n(planValidityDays)
      }

      const conditions: Record<string, unknown> = {}
      if (newUserOnly) conditions.new_user_only = true
      if (n(newUserMaxDays)) conditions.new_user_max_days = n(newUserMaxDays)
      if (paidUserOnly) conditions.paid_user_only = true
      if (requireInvite) conditions.require_invite = true
      if (allowedPlans.length)
        conditions.allowed_plans = allowedPlans.map((x) => Number(x))

      const limits: Record<string, unknown> = {}
      if (n(maxUsePerUser)) limits.max_use_per_user = n(maxUsePerUser)
      if (n(cooldownHours)) limits.cooldown_hours = n(cooldownHours)

      const special: Record<string, unknown> = {}
      if (fromLocal(startTime)) special.start_time = fromLocal(startTime)
      if (fromLocal(endTime)) special.end_time = fromLocal(endTime)
      if (n(festivalBonus)) special.festival_bonus = n(festivalBonus)

      const payload = {
        name,
        description: description || null,
        type,
        status,
        sort: Number(sort) || 0,
        theme_color: themeColor || null,
        icon: icon || null,
        background_image: backgroundImage || null,
        rewards,
        conditions: Object.keys(conditions).length ? conditions : null,
        limits: Object.keys(limits).length ? limits : null,
        special_config: Object.keys(special).length ? special : null,
      }
      return isEdit
        ? updateTemplate({ ...payload, id: current!.id })
        : createTemplate(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? '已更新' : '已创建')
      queryClient.invalidateQueries({ queryKey: ['gift-templates'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const planOptions = (plans ?? []).map((p) => ({
    value: String(p.id),
    label: p.name,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑模板' : '添加模板'}</DialogTitle>
          <DialogDescription>
            填写礼品卡模板信息，奖励/条件可按需留空。
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='max-h-[65vh] pr-4'>
          <div className='grid gap-4'>
            {/* 基础配置 */}
            <Section title='🌐 基础配置'>
              <div className='grid grid-cols-2 gap-3'>
                <Field label='模板名称'>
                  <Input
                    placeholder='请输入模板名称'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label='类型'>
                  <Select
                    value={String(type)}
                    onValueChange={(v) => setType(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(GIFT_CARD_TYPE_MAP).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label='描述'>
                <Textarea
                  rows={2}
                  placeholder='请输入礼品卡描述'
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <div className='grid grid-cols-2 gap-3'>
                <Field label='排序'>
                  <Input
                    type='number'
                    placeholder='0'
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  />
                </Field>
                <div className='flex items-center justify-between rounded-md border p-2'>
                  <div>
                    <Label className='text-xs'>状态</Label>
                    <p className='text-muted-foreground text-xs'>
                      禁用后无法生成或兑换
                    </p>
                  </div>
                  <Switch checked={status} onCheckedChange={setStatus} />
                </div>
              </div>
            </Section>

            {/* 奖励内容 */}
            <Section title='🎁 奖励内容'>
              <div className='grid grid-cols-2 gap-3'>
                <Field label='奖励余额 (元)'>
                  <Input
                    type='number'
                    step='0.01'
                    placeholder='请输入奖励的金额(元)'
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                  />
                </Field>
                <Field label='奖励流量 (GB)'>
                  <Input
                    type='number'
                    placeholder='请输入奖励的流量(GB)'
                    value={transferEnable}
                    onChange={(e) => setTransferEnable(e.target.value)}
                  />
                </Field>
                <Field label='延长有效期 (天)'>
                  <Input
                    type='number'
                    placeholder='请输入延长的天数'
                    value={expireDays}
                    onChange={(e) => setExpireDays(e.target.value)}
                  />
                </Field>
                <Field label='增加设备数'>
                  <Input
                    type='number'
                    placeholder='请输入增加的设备数量'
                    value={deviceLimit}
                    onChange={(e) => setDeviceLimit(e.target.value)}
                  />
                </Field>
              </div>
              {type === TYPE_PLAN && (
                <div className='grid grid-cols-2 gap-3'>
                  <Field label='赠送套餐'>
                    <Select
                      value={planId || 'none'}
                      onValueChange={(v) => setPlanId(v === 'none' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='选择套餐' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='none'>不指定</SelectItem>
                        {planOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label='套餐有效期 (天)'>
                    <Input
                      type='number'
                      placeholder='套餐生效天数'
                      value={planValidityDays}
                      onChange={(e) => setPlanValidityDays(e.target.value)}
                    />
                  </Field>
                </div>
              )}
              <div className='flex items-center justify-between rounded-md border p-2'>
                <div>
                  <Label className='text-xs'>重置当月流量</Label>
                  <p className='text-muted-foreground text-xs'>
                    兑换时将用户当前套餐的已用流量清零
                  </p>
                </div>
                <Switch checked={resetPackage} onCheckedChange={setResetPackage} />
              </div>
            </Section>

            {/* 使用条件 */}
            <Section title='🎯 使用条件'>
              <Field
                label='新用户注册天数限制'
                hint='例如 7 表示仅注册 7 天内的用户可用，留空不限'
              >
                <Input
                  type='number'
                  placeholder='例如：7'
                  value={newUserMaxDays}
                  onChange={(e) => setNewUserMaxDays(e.target.value)}
                />
              </Field>
              <div className='grid grid-cols-3 gap-2'>
                <div className='flex items-center justify-between rounded-md border p-2'>
                  <Label className='text-xs'>仅限新用户</Label>
                  <Switch checked={newUserOnly} onCheckedChange={setNewUserOnly} />
                </div>
                <div className='flex items-center justify-between rounded-md border p-2'>
                  <Label className='text-xs'>仅限付费用户</Label>
                  <Switch checked={paidUserOnly} onCheckedChange={setPaidUserOnly} />
                </div>
                <div className='flex items-center justify-between rounded-md border p-2'>
                  <Label className='text-xs'>需要邀请关系</Label>
                  <Switch
                    checked={requireInvite}
                    onCheckedChange={setRequireInvite}
                  />
                </div>
              </div>
              <Field label='允许的套餐' hint='留空则不限制可兑换的套餐'>
                <MultiCheck
                  options={planOptions}
                  selected={allowedPlans}
                  onChange={setAllowedPlans}
                  empty='暂无套餐'
                />
              </Field>
            </Section>

            {/* 使用限制 */}
            <Section title='🛡 使用限制'>
              <div className='grid grid-cols-2 gap-3'>
                <Field label='单用户最大使用次数' hint='留空则不限制'>
                  <Input
                    type='number'
                    placeholder='留空则不限制'
                    value={maxUsePerUser}
                    onChange={(e) => setMaxUsePerUser(e.target.value)}
                  />
                </Field>
                <Field label='同类卡冷却时间 (小时)' hint='留空则不限制'>
                  <Input
                    type='number'
                    placeholder='留空则不限制'
                    value={cooldownHours}
                    onChange={(e) => setCooldownHours(e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label='邀请人奖励比例'
                hint='例如 0.2 代表 20%；兑换者有邀请人时，按比例给邀请人奖励'
              >
                <Input
                  type='number'
                  step='0.01'
                  placeholder='例如：0.2'
                  value={inviteRewardRate}
                  onChange={(e) => setInviteRewardRate(e.target.value)}
                />
              </Field>
            </Section>

            {/* 特殊配置 */}
            <Section title='🕒 特殊配置'>
              <div className='grid grid-cols-2 gap-3'>
                <Field label='活动开始时间'>
                  <Input
                    type='datetime-local'
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </Field>
                <Field label='活动结束时间'>
                  <Input
                    type='datetime-local'
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label='节日奖励乘数'
                hint='例如 1.5 代表活动期间奖励 1.5 倍'
              >
                <Input
                  type='number'
                  step='0.1'
                  placeholder='例如：1.5'
                  value={festivalBonus}
                  onChange={(e) => setFestivalBonus(e.target.value)}
                />
              </Field>
            </Section>

            {/* 显示效果 */}
            <Section title='🎨 显示效果'>
              <div className='grid grid-cols-2 gap-3'>
                <Field label='主题色'>
                  <Input
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    placeholder='#1890ff'
                  />
                </Field>
                <Field label='图标'>
                  <Input
                    placeholder='请输入图标的URL'
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                  />
                </Field>
              </div>
              <Field label='背景图片'>
                <Input
                  placeholder='请输入背景图片的URL'
                  value={backgroundImage}
                  onChange={(e) => setBackgroundImage(e.target.value)}
                />
              </Field>
            </Section>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name}
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
