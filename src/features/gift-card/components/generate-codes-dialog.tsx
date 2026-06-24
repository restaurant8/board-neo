import { useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchTemplates, generateCodes } from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 预选模板 id。 */
  templateId?: number | null
}

export function GenerateCodesDialog({
  open,
  onOpenChange,
  templateId,
}: Props) {
  const queryClient = useQueryClient()

  const [tplId, setTplId] = useState('')
  const [count, setCount] = useState('1')
  const [prefix, setPrefix] = useState('GC')
  const [expiresHours, setExpiresHours] = useState('')
  const [maxUsage, setMaxUsage] = useState('1')

  const { data: templates } = useQuery({
    queryKey: ['gift-templates', 'all'],
    queryFn: () => fetchTemplates({ per_page: 1000 }),
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      setTplId(templateId ? String(templateId) : '')
      setCount('1')
      setPrefix('GC')
      setExpiresHours('')
      setMaxUsage('1')
    }
  }, [open, templateId])

  const mutation = useMutation({
    mutationFn: () =>
      generateCodes({
        template_id: Number(tplId),
        count: Number(count),
        prefix: prefix || undefined,
        expires_hours: expiresHours ? Number(expiresHours) : undefined,
        max_usage: maxUsage ? Number(maxUsage) : undefined,
      }),
    onSuccess: (res) => {
      toast.success(`已生成 ${res.count} 个兑换码（批次 ${res.batch_id}）`)
      queryClient.invalidateQueries({ queryKey: ['gift-codes'] })
      queryClient.invalidateQueries({ queryKey: ['gift-templates'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>生成兑换码</DialogTitle>
          <DialogDescription>为指定模板批量生成兑换码。</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>礼品卡模板</Label>
            <Select value={tplId} onValueChange={setTplId}>
              <SelectTrigger>
                <SelectValue placeholder='选择模板' />
              </SelectTrigger>
              <SelectContent>
                {(templates?.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label>生成数量</Label>
              <Input
                type='number'
                min='1'
                max='10000'
                placeholder='如 100'
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>前缀</Label>
              <Input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder='GC'
              />
            </div>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label>有效期（小时）</Label>
              <Input
                type='number'
                placeholder='留空长期有效'
                value={expiresHours}
                onChange={(e) => setExpiresHours(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>最大使用次数</Label>
              <Input
                type='number'
                min='1'
                placeholder='如 1'
                value={maxUsage}
                onChange={(e) => setMaxUsage(e.target.value)}
              />
            </div>
          </div>
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
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !tplId || !count}
          >
            生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
