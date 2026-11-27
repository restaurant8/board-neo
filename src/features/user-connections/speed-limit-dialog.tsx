import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Gauge } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { updateUser } from '@/features/user/api'
import { type OnlineConnectionRow } from './api'
import {
  resolveInitialSpeedInput,
  resolveSpeedDialogSessionKey,
} from './state'

const PRESET_LIMITS = [1, 5, 10, 20, 50, 100]

function formatLimit(limit: number | null) {
  if (limit == null || limit <= 0) return '不限速'
  return `${limit} Mbps`
}

export function SpeedLimitDialog({
  row,
  open,
  onOpenChange,
  onSaved,
}: {
  row: OnlineConnectionRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (userId: number, speedLimit: number | null) => void
}) {
  const queryClient = useQueryClient()
  const sessionKey = resolveSpeedDialogSessionKey(open, row)
  const [syncedSessionKey, setSyncedSessionKey] = useState<string | null>(
    sessionKey
  )
  const [value, setValue] = useState(() => resolveInitialSpeedInput(row))

  // 仅在打开弹窗或切换目标用户时重置表单输入，避免后台自动轮询刷新覆盖正在输入的限速值
  if (sessionKey !== syncedSessionKey) {
    setSyncedSessionKey(sessionKey)
    if (open && row) {
      setValue(resolveInitialSpeedInput(row))
    }
  }

  const mutation = useMutation({
    mutationFn: (speedLimit: number | null) => {
      if (!row) return Promise.resolve(false)
      return updateUser({ id: row.user_id, speed_limit: speedLimit })
    },
    onSuccess: (_, speedLimit) => {
      toast.success(
        speedLimit != null && speedLimit > 0
          ? `已将 ${row?.user_email} 限速调整为 ${speedLimit} Mbps`
          : `已取消 ${row?.user_email} 的带宽限速`
      )
      if (row) {
        onSaved?.(row.user_id, speedLimit)
      }
      queryClient.invalidateQueries({ queryKey: ['user-online-connections'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  if (!row) return null

  const trimmed = value.trim()
  const parsed = trimmed === '' ? null : Number(trimmed)
  const isValid =
    parsed === null ||
    (Number.isInteger(parsed) && parsed > 0 && parsed <= 100000)

  const currentLimit =
    row.speed_limit != null && row.speed_limit > 0 ? row.speed_limit : null
  const isRelaxing =
    currentLimit != null && (parsed === null || (isValid && parsed > currentLimit))

  const handleSubmit = () => {
    if (!isValid) {
      toast.error('请输入正整数限速值（Mbps），或留空表示不限速')
      return
    }
    mutation.mutate(parsed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Gauge className='size-4 text-primary' />
            调整账号限速
          </DialogTitle>
          <DialogDescription>
            为 {row.user_email}（#{row.user_id}）设置实时限速，节点同步后生效。
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-1'>
          <div className='flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs'>
            <span className='text-muted-foreground'>当前限速：</span>
            <Badge variant='secondary' className='font-mono'>
              {formatLimit(currentLimit)}
            </Badge>
            <span className='ms-2 text-muted-foreground'>套餐默认：</span>
            <Badge variant='outline' className='font-mono'>
              {formatLimit(row.plan_speed_limit)}
            </Badge>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='speed-limit-input'>目标限速（Mbps，留空 = 不限速）</Label>
            <Input
              id='speed-limit-input'
              type='number'
              min={1}
              step={1}
              className='font-mono'
              placeholder='输入正整数 Mbps，留空为不限速'
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <span className='text-xs text-muted-foreground'>快捷档位：</span>
            <div className='flex flex-wrap gap-1.5'>
              {PRESET_LIMITS.map((mbps) => {
                const wouldRelax = currentLimit != null && mbps > currentLimit
                return (
                  <Button
                    key={mbps}
                    type='button'
                    size='sm'
                    variant={trimmed === String(mbps) ? 'default' : 'outline'}
                    className='h-7 px-2.5 font-mono text-xs'
                    disabled={wouldRelax}
                    title={
                      wouldRelax
                        ? `当前已限速 ${currentLimit} Mbps，禁止用快捷收紧按钮放宽限速（如需调高请手动输入）`
                        : undefined
                    }
                    onClick={() => setValue(String(mbps))}
                  >
                    {mbps}M
                  </Button>
                )
              })}
              {row.plan_speed_limit != null && row.plan_speed_limit > 0 && (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  className='h-7 px-2.5 text-xs'
                  onClick={() => setValue(String(row.plan_speed_limit))}
                >
                  恢复套餐默认 ({row.plan_speed_limit}M)
                </Button>
              )}
              <Button
                type='button'
                size='sm'
                variant={trimmed === '' ? 'default' : 'outline'}
                className='h-7 px-2.5 text-xs'
                onClick={() => setValue('')}
              >
                不限速
              </Button>
            </div>
          </div>

          {isRelaxing && (
            <Alert className='border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'>
              <AlertTriangle className='size-4' />
              <AlertDescription className='text-xs'>
                注意：目标限速（{formatLimit(parsed)}）高于当前限速（
                {formatLimit(currentLimit)}），保存后将放宽该账号的带宽限制，请确认是否为预期操作。
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || mutation.isPending}
          >
            {isRelaxing ? '确认放宽并保存' : '确认保存限速'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
