import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  changeSubscriptionPolicy,
  fetchSubscriptionPolicy,
  type PolicyChange,
  type SubscriptionPolicy,
  type SubscriptionRule,
  type SubscriptionTarget,
} from '../api'
import { formatTimestamp, pauseLabel } from '../format'

const modes = { off: '关闭限频', observe: '观察模式', enforce: '执行限频' }
const fieldClass = 'h-9 w-full rounded-md border bg-background px-2 text-sm'
const sectionClass = 'grid content-start gap-4 rounded-lg border p-4'
const labelClass = 'grid gap-1.5 text-sm'
const title = {
  global: '保存全站规则',
  override: '保存用户例外',
  inherit: '恢复全站规则',
  pause: '暂停订阅下载',
  resume: '立即恢复订阅',
  rotate: '仅更换订阅链接',
}

export function PolicyPanel({ user }: { user?: SubscriptionTarget }) {
  const userId = user?.user_id
  const query = useQuery({
    staleTime: 0,
    queryKey: ['subscription-policy', userId],
    queryFn: () => fetchSubscriptionPolicy(userId),
  })
  if (!query.data)
    return (
      <div className='p-6 text-sm'>
        {query.isError ? (
          <Button variant='outline' onClick={() => query.refetch()}>
            读取规则失败，点击重试
          </Button>
        ) : (
          '加载中…'
        )}
      </div>
    )
  return (
    <PolicyForm
      key={JSON.stringify([userId, query.data])}
      user={user}
      policy={query.data}
    />
  )
}

function PolicyForm({
  user,
  policy,
}: {
  user?: SubscriptionTarget
  policy: SubscriptionPolicy
}) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState(policy.global.mode)
  const [max, setMax] = useState(
    String(policy.max_requests ?? policy.global.max_requests)
  )
  const [minutes, setMinutes] = useState(
    String(policy.window_minutes ?? policy.global.window_minutes)
  )
  const [duration, setDuration] = useState('1')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<PolicyChange | null>(null)
  const mutation = useMutation({
    mutationFn: changeSubscriptionPolicy,
    onSuccess: async () => {
      toast.success('订阅设置已更新')
      setPending(null)
      await Promise.all(
        [
          'subscription-policy',
          'subscription-access',
          'subscription-audit',
          'users',
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      )
    },
    onError: (error) => {
      handleServerError(error)
      setPending(null)
      void queryClient.invalidateQueries({ queryKey: ['subscription-policy'] })
    },
  })
  const rule = policy.global
  const globalText = `${modes[rule.mode]} · ${rule.window_minutes} 分钟最多 ${rule.max_requests} 次`
  const suspended = pauseLabel(policy.paused_until)
  const descriptions: Record<PolicyChange['action'], string> = {
    global: `全站将使用「${modes[mode]}」，每 ${minutes} 分钟最多 ${max} 次。观察模式会放行超额请求。`,
    override:
      Number(max) === 0
        ? '该用户将免于自动限频。'
        : `该用户每 ${minutes} 分钟最多 ${max} 次，全站模式仍然适用。`,
    inherit: '该用户的拉取额度将随全站规则调整。',
    pause: `暂停后，用户将无法下载新的订阅配置。原因：${reason}`,
    resume: '解除人工暂停后，下次拉取仍须通过套餐和限频检查。',
    rotate: '旧订阅链接将立即失效。节点 UUID 保留，用户可在账户中获取新链接。',
  }
  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <div className={user ? 'grid gap-4 md:grid-cols-2' : 'max-w-xl'}>
        <form
          className={sectionClass}
          onSubmit={(e) => {
            e.preventDefault()
            setPending(
              user
                ? {
                    action: 'override',
                    user_id: user.user_id,
                    max_requests: Number(max),
                    window_minutes: Number(minutes),
                  }
                : {
                    action: 'global',
                    mode,
                    max_requests: Number(max),
                    window_minutes: Number(minutes),
                  }
            )
          }}
        >
          <h3 className='font-semibold'>
            {user ? '用户限频规则' : '全站订阅限频'}
          </h3>
          {user ? (
            <div className='space-y-1 text-sm'>
              <p>全站 · {globalText}</p>
              <p>
                当前额度 ·{' '}
                {policy.max_requests == null
                  ? '跟随全站'
                  : policy.max_requests === 0
                    ? '免限频'
                    : `${policy.window_minutes} 分钟最多 ${policy.max_requests} 次`}
              </p>
              {policy.retry_at && (
                <p>
                  本窗口额度已用完，{formatTimestamp(policy.retry_at)} 恢复。
                </p>
              )}
            </div>
          ) : (
            <label className={labelClass}>
              运行模式
              <select
                className={fieldClass}
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as SubscriptionRule['mode'])
                }
              >
                {Object.entries(modes).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className='grid grid-cols-2 gap-3'>
            <label className={labelClass}>
              时间窗口（分钟）
              <Input
                type='number'
                required
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
            <label className={labelClass}>
              窗口内最多请求数
              <Input
                type='number'
                required
                min={user ? 0 : 1}
                max={1000000}
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </label>
          </div>
          <p className='text-xs text-muted-foreground'>
            {user
              ? '设为 0 可对该用户免限频。'
              : '观察模式记录超额请求并放行。执行限频时，超额请求将收到 429 和重试时间。'}
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button size='sm'>保存规则</Button>
            {user && policy.max_requests != null && (
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={() =>
                  setPending({ action: 'inherit', user_id: user.user_id })
                }
              >
                跟随全站规则
              </Button>
            )}
          </div>
        </form>
        {user && (
          <div className='grid gap-4'>
            <form
              className={sectionClass}
              onSubmit={(e) => {
                e.preventDefault()
                const until =
                  duration === 'manual'
                    ? 0
                    : duration === 'custom'
                      ? Math.floor(new Date(date).getTime() / 1000)
                      : Math.floor(Date.now() / 1000) + Number(duration) * 3600
                if (
                  !reason.trim() ||
                  (duration !== 'manual' &&
                    (!Number.isFinite(until) || until * 1000 <= Date.now()))
                ) {
                  toast.error('请填写暂停原因并选择未来的恢复时间')
                  return
                }
                setPending({
                  action: 'pause',
                  user_id: user.user_id,
                  reason: reason.trim(),
                  paused_until: until,
                })
              }}
            >
              <h3 className='font-semibold'>订阅下载</h3>
              <div className='text-sm'>
                {suspended || '未设置人工暂停'}
                {suspended && (
                  <p className='break-words text-muted-foreground'>
                    {policy.pause_reason}
                  </p>
                )}
              </div>
              <label className={labelClass}>
                暂停时长
                <select
                  className={fieldClass}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value='1'>1 小时</option>
                  <option value='24'>24 小时</option>
                  <option value='custom'>指定恢复时间</option>
                  <option value='manual'>至手动恢复</option>
                </select>
              </label>
              {duration === 'custom' && (
                <label className={labelClass}>
                  恢复时间
                  <Input
                    type='datetime-local'
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              )}
              <label className={labelClass}>
                暂停原因
                <Input
                  maxLength={200}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className='flex gap-2'>
                <Button size='sm' variant='destructive'>
                  {suspended ? '更新暂停期限' : '暂停下载'}
                </Button>
                {suspended && (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() =>
                      setPending({ action: 'resume', user_id: user.user_id })
                    }
                  >
                    立即恢复
                  </Button>
                )}
              </div>
            </form>
            <div className={sectionClass}>
              <h3 className='font-semibold'>订阅链接</h3>
              <div>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={!policy.link_version}
                  onClick={() =>
                    policy.link_version &&
                    setPending({
                      action: 'rotate',
                      user_id: user.user_id,
                      link_version: policy.link_version,
                    })
                  }
                >
                  仅更换订阅链接
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !mutation.isPending) setPending(null)
          }}
          title={title[pending.action]}
          desc={
            <>
              {user && (
                <p className='mb-2 font-medium'>
                  {user.user_email || `用户 #${user.user_id}`}
                </p>
              )}
              {descriptions[pending.action]}
              {pending.action === 'pause' && (
                <p>
                  {pending.paused_until
                    ? `恢复时间 ${formatTimestamp(pending.paused_until)}`
                    : '至手动恢复'}
                </p>
              )}
            </>
          }
          confirmText='确认'
          cancelBtnText='取消'
          destructive={
            pending.action === 'pause' || pending.action === 'rotate'
          }
          isLoading={mutation.isPending}
          handleConfirm={() => mutation.mutate(pending)}
        />
      )}
    </div>
  )
}
