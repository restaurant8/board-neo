import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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

function jsonString(obj: unknown) {
  if (obj == null) return ''
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return ''
  }
}

export function TemplateMutateDialog({ open, onOpenChange, current }: Props) {
  const isEdit = !!current
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<number>(1)
  const [status, setStatus] = useState(true)
  const [themeColor, setThemeColor] = useState('#1890ff')
  const [icon, setIcon] = useState('')
  const [sort, setSort] = useState('0')
  const [rewards, setRewards] = useState('{}')
  const [conditions, setConditions] = useState('')
  const [limits, setLimits] = useState('')

  useEffect(() => {
    if (open) {
      setName(current?.name ?? '')
      setDescription(current?.description ?? '')
      setType(current?.type ?? 1)
      setStatus(current ? !!current.status : true)
      setThemeColor(current?.theme_color ?? '#1890ff')
      setIcon(current?.icon ?? '')
      setSort(current?.sort != null ? String(current.sort) : '0')
      setRewards(current ? jsonString(current.rewards) : '{}')
      setConditions(current?.conditions ? jsonString(current.conditions) : '')
      setLimits(current?.limits ? jsonString(current.limits) : '')
    }
  }, [open, current])

  const mutation = useMutation({
    mutationFn: () => {
      let rewardsObj: Record<string, unknown>
      try {
        rewardsObj = JSON.parse(rewards || '{}')
      } catch {
        throw new Error('奖励配置不是合法 JSON')
      }
      const parseOptional = (s: string, field: string) => {
        if (!s.trim()) return null
        try {
          return JSON.parse(s)
        } catch {
          throw new Error(`${field} 不是合法 JSON`)
        }
      }
      const payload = {
        name,
        description: description || null,
        type,
        status,
        theme_color: themeColor || null,
        icon: icon || null,
        sort: Number(sort) || 0,
        rewards: rewardsObj,
        conditions: parseOptional(conditions, '使用条件'),
        limits: parseOptional(limits, '限制条件'),
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
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑模板' : '新建模板'}</DialogTitle>
          <DialogDescription>
            奖励/条件/限制以 JSON 格式配置。
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='max-h-[60vh] pr-4'>
          <div className='grid gap-4'>
            <div className='grid gap-2'>
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className='grid gap-2'>
              <Label>描述</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>类型</Label>
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
              </div>
              <div className='grid gap-2'>
                <Label>排序</Label>
                <Input
                  type='number'
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                />
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>主题色</Label>
                <Input
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  placeholder='#1890ff'
                />
              </div>
              <div className='grid gap-2'>
                <Label>图标</Label>
                <Input value={icon} onChange={(e) => setIcon(e.target.value)} />
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Label>启用</Label>
              <Switch checked={status} onCheckedChange={setStatus} />
            </div>
            <div className='grid gap-2'>
              <Label>奖励配置（JSON，必填）</Label>
              <Textarea
                rows={4}
                className='font-mono text-xs'
                value={rewards}
                onChange={(e) => setRewards(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>使用条件（JSON，可选）</Label>
              <Textarea
                rows={3}
                className='font-mono text-xs'
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>限制条件（JSON，可选）</Label>
              <Textarea
                rows={3}
                className='font-mono text-xs'
                value={limits}
                onChange={(e) => setLimits(e.target.value)}
              />
            </div>
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
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
