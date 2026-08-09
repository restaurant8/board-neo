import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
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
import { MultiCheck } from '@/components/multi-check'
import { fetchPlans } from '@/features/plan/api'
import {
  type PromotionScope,
  filterPromotionPlansByScope,
  promotionScopeFrom,
  promotionScopePayload,
} from '@/features/plan/plan-site'
import { fetchResellerSites } from '@/features/reseller/api'
import { PromotionScopeSelect } from '@/features/reseller/components/promotion-scope-select'
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
      {hint && <p className='text-xs text-muted-foreground'>{hint}</p>}
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
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
    enabled: open,
  })
  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: ['reseller-sites'],
    queryFn: fetchResellerSites,
    enabled: open,
  })

  // 基础
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState(1)
  const [status, setStatus] = useState(true)
  const [sort, setSort] = useState('0')
  const [scope, setScope] = useState<PromotionScope>('main')
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

  // 打开时装载：渲染期间派生重置（React 官方模式），避免 effect 里同步 setState
  const [loaded, setLoaded] = useState<{
    open: boolean
    current?: typeof current
  } | null>(null)

  if (loaded?.open !== open || loaded?.current !== current) {
    setLoaded({ open, current })
    if (open) loadForm()
  }

  function loadForm() {
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
    setScope(promotionScopeFrom(current?.site_id, current?.is_global ?? false))
    setBalance(r.balance ? String(Number(r.balance) / 100) : '')
    setTransferEnable(
      r.transfer_enable ? String(Number(r.transfer_enable) / GB) : ''
    )
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
      Array.isArray(c.allowed_plans)
        ? c.allowed_plans.map((x) => String(x))
        : []
    )
    setMaxUsePerUser(num(l.max_use_per_user))
    setCooldownHours(num(l.cooldown_hours))
    setStartTime(toLocal(s.start_time as number | undefined))
    setEndTime(toLocal(s.end_time as number | undefined))
    setFestivalBonus(num(s.festival_bonus))
    setThemeColor(current?.theme_color ?? '#1890ff')
    setIcon(current?.icon ?? '')
    setBackgroundImage(current?.background_image ?? '')
  }

  const planCandidates = filterPromotionPlansByScope(plans ?? [], scope)
  const siteNames = new Map((sites ?? []).map((site) => [site.id, site.name]))
  const planOptions = planCandidates.map((plan) => ({
    value: String(plan.id),
    label: `${plan.name}（${plan.site_id ? (siteNames.get(plan.site_id) ?? `站点 #${plan.site_id}`) : '主站'}）`,
  }))

  const changeScope = (nextScope: PromotionScope) => {
    const allowedPlanIds = new Set(
      filterPromotionPlansByScope(plans ?? [], nextScope).map((plan) =>
        String(plan.id)
      )
    )
    setPlanId((selected) => (allowedPlanIds.has(selected) ? selected : ''))
    setAllowedPlans((selected) =>
      selected.filter((selectedId) => allowedPlanIds.has(selectedId))
    )
    setScope(nextScope)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const allowedPlanIds = new Set(
        planCandidates.map((plan) => String(plan.id))
      )
      const scopedPlanId = allowedPlanIds.has(planId) ? planId : ''
      const scopedAllowedPlans = allowedPlans.filter((selectedId) =>
        allowedPlanIds.has(selectedId)
      )

      // rewards（balance 元→分；transfer GB→字节）
      const rewards: Record<string, unknown> = { ...(current?.rewards ?? {}) }
      if (n(balance)) rewards.balance = Math.round(Number(balance) * 100)
      else delete rewards.balance
      if (n(transferEnable)) {
        rewards.transfer_enable = Math.round(Number(transferEnable) * GB)
      } else delete rewards.transfer_enable
      if (n(expireDays)) rewards.expire_days = n(expireDays)
      else delete rewards.expire_days
      if (n(deviceLimit)) rewards.device_limit = n(deviceLimit)
      else delete rewards.device_limit
      if (resetPackage) rewards.reset_package = true
      else delete rewards.reset_package
      if (n(inviteRewardRate)) {
        rewards.invite_reward_rate = n(inviteRewardRate)
      } else delete rewards.invite_reward_rate
      if (type === TYPE_PLAN) {
        if (n(scopedPlanId)) rewards.plan_id = n(scopedPlanId)
        else delete rewards.plan_id
        if (n(planValidityDays)) {
          rewards.plan_validity_days = n(planValidityDays)
        } else delete rewards.plan_validity_days
      } else if (
        current?.type === type &&
        rewards.plan_id != null &&
        allowedPlanIds.has(String(rewards.plan_id))
      ) {
        // Preserve a legacy/base plan reward that this form does not expose,
        // while still enforcing the newly selected promotion scope.
      } else {
        delete rewards.plan_id
        delete rewards.plan_validity_days
      }
      if (type === 3 && Array.isArray(rewards.random_rewards)) {
        rewards.random_rewards = rewards.random_rewards.map((reward) => {
          if (!reward || typeof reward !== 'object' || Array.isArray(reward)) {
            return reward
          }
          const scopedReward = { ...(reward as Record<string, unknown>) }
          if (
            scopedReward.plan_id != null &&
            !allowedPlanIds.has(String(scopedReward.plan_id))
          ) {
            delete scopedReward.plan_id
          }
          return scopedReward
        })
      } else if (type !== 3) {
        delete rewards.random_rewards
      }

      const conditions: Record<string, unknown> = {
        ...(current?.conditions ?? {}),
      }
      if (newUserOnly) conditions.new_user_only = true
      else delete conditions.new_user_only
      if (n(newUserMaxDays)) {
        conditions.new_user_max_days = n(newUserMaxDays)
      } else delete conditions.new_user_max_days
      if (paidUserOnly) conditions.paid_user_only = true
      else delete conditions.paid_user_only
      if (requireInvite) conditions.require_invite = true
      else delete conditions.require_invite
      if (scopedAllowedPlans.length) {
        conditions.allowed_plans = scopedAllowedPlans.map((x) => Number(x))
      } else delete conditions.allowed_plans

      const limits: Record<string, unknown> = { ...(current?.limits ?? {}) }
      if (n(maxUsePerUser)) limits.max_use_per_user = n(maxUsePerUser)
      else delete limits.max_use_per_user
      if (n(cooldownHours)) limits.cooldown_hours = n(cooldownHours)
      else delete limits.cooldown_hours

      const special: Record<string, unknown> = {
        ...(current?.special_config ?? {}),
      }
      if (fromLocal(startTime)) special.start_time = fromLocal(startTime)
      else delete special.start_time
      if (fromLocal(endTime)) special.end_time = fromLocal(endTime)
      else delete special.end_time
      if (n(festivalBonus)) special.festival_bonus = n(festivalBonus)
      else delete special.festival_bonus

      const payload = {
        ...promotionScopePayload(scope),
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
            <Section title='基础配置'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
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
              <Field
                label='作用范围'
                hint='全站通用可用于任意站点；主站或指定站点只能引用同归属套餐。'
              >
                <PromotionScopeSelect
                  value={scope}
                  sites={sites ?? []}
                  onChange={changeScope}
                  disabled={sitesLoading || plansLoading}
                />
              </Field>
              <Field label='描述'>
                <Textarea
                  rows={2}
                  placeholder='请输入礼品卡描述'
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
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
                    <p className='text-xs text-muted-foreground'>
                      禁用后无法生成或兑换
                    </p>
                  </div>
                  <Switch checked={status} onCheckedChange={setStatus} />
                </div>
              </div>
            </Section>

            {/* 奖励内容 */}
            <Section title='奖励内容'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
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
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <Field label='赠送套餐'>
                    <Select
                      value={planId || 'none'}
                      onValueChange={(v) => setPlanId(v === 'none' ? '' : v)}
                      disabled={plansLoading}
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
                  <p className='text-xs text-muted-foreground'>
                    兑换时将用户当前套餐的已用流量清零
                  </p>
                </div>
                <Switch
                  checked={resetPackage}
                  onCheckedChange={setResetPackage}
                />
              </div>
            </Section>

            {/* 使用条件 */}
            <Section title='使用条件'>
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
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
                <div className='flex items-center justify-between rounded-md border p-2'>
                  <Label className='text-xs'>仅限新用户</Label>
                  <Switch
                    checked={newUserOnly}
                    onCheckedChange={setNewUserOnly}
                  />
                </div>
                <div className='flex items-center justify-between rounded-md border p-2'>
                  <Label className='text-xs'>仅限付费用户</Label>
                  <Switch
                    checked={paidUserOnly}
                    onCheckedChange={setPaidUserOnly}
                  />
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
                  empty={plansLoading ? '加载套餐中...' : '该范围暂无套餐'}
                />
              </Field>
            </Section>

            {/* 使用限制 */}
            <Section title='使用限制'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
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
            <Section title='特殊配置'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
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
            <Section title='显示效果'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
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
            disabled={
              mutation.isPending || plansLoading || sitesLoading || !name
            }
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
