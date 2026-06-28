import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type ResellerSite,
  addResellerDomain,
  dropResellerDomain,
  fetchResellerDomains,
} from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: ResellerSite | null
}

export function DomainManageDialog({ open, onOpenChange, site }: Props) {
  const queryClient = useQueryClient()
  const [newDomain, setNewDomain] = useState('')

  const { data: aliases, isLoading } = useQuery({
    queryKey: ['reseller-domains', site?.id],
    queryFn: () => fetchResellerDomains(site!.id),
    enabled: open && !!site,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['reseller-domains', site?.id] })
    queryClient.invalidateQueries({ queryKey: ['reseller-sites'] })
  }

  const addMutation = useMutation({
    mutationFn: () => addResellerDomain(site!.id, newDomain.trim()),
    onSuccess: () => {
      toast.success('域名已绑定')
      setNewDomain('')
      invalidate()
    },
    onError: handleServerError,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropResellerDomain(id),
    onSuccess: () => {
      toast.success('域名已解绑')
      invalidate()
    },
    onError: handleServerError,
  })

  const submitAdd = () => {
    if (!newDomain.trim()) {
      toast.error('请输入域名')
      return
    }
    addMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md gap-0 overflow-hidden p-0 sm:rounded-2xl'>
        <DialogHeader className='border-b bg-muted/20 px-6 pb-4 pt-6'>
          <DialogTitle className='font-mono text-lg tracking-tight'>
            域名管理 · {site?.name}
          </DialogTitle>
          <DialogDescription className='font-mono text-xs opacity-70'>
            一个分站可绑定多个域名（自有域名 + 主站二级域名并存）。命中任一域名的访客都归属该分站。
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 px-6 py-4 font-mono'>
          {/* 主域名（在编辑分站里改，此处只读展示） */}
          <div>
            <Label className='text-[11px] uppercase tracking-wider text-muted-foreground'>
              主域名（在「编辑分站」中修改）
            </Label>
            <div className='mt-1.5 flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs'>
              <Globe className='h-3.5 w-3.5 text-muted-foreground' />
              {site?.domain ? (
                <span>{site.domain}</span>
              ) : (
                <span className='text-muted-foreground'>未绑定</span>
              )}
            </div>
          </div>

          {/* 别名列表 */}
          <div>
            <Label className='text-[11px] uppercase tracking-wider text-muted-foreground'>
              额外域名
            </Label>
            <div className='mt-1.5 space-y-2'>
              {isLoading ? (
                <div className='flex items-center gap-2 py-2 text-xs text-muted-foreground'>
                  <Loader2 className='h-3.5 w-3.5 animate-spin' /> 加载中...
                </div>
              ) : aliases && aliases.length > 0 ? (
                aliases.map((a) => (
                  <div
                    key={a.id}
                    className='flex items-center justify-between rounded-md border px-3 py-2 text-xs'
                  >
                    <span className='flex items-center gap-2'>
                      <Globe className='h-3.5 w-3.5 text-muted-foreground' />
                      {a.domain}
                    </span>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7 hover:bg-red-100 dark:hover:bg-red-900'
                      onClick={() => dropMutation.mutate(a.id)}
                      disabled={dropMutation.isPending}
                    >
                      <Trash2 className='h-3.5 w-3.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400' />
                      <span className='sr-only'>解绑</span>
                    </Button>
                  </div>
                ))
              ) : (
                <div className='rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground'>
                  暂无额外域名
                </div>
              )}
            </div>
          </div>

          {/* 新增 */}
          <div className='flex items-end gap-2'>
            <div className='flex-1'>
              <Label className='text-[11px] uppercase tracking-wider text-muted-foreground'>
                新增域名
              </Label>
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitAdd()
                  }
                }}
                placeholder='如：shop.example.com'
                className='mt-1.5 h-9 font-mono text-xs'
              />
            </div>
            <Button
              type='button'
              className='h-9 px-4 font-mono text-xs font-bold'
              onClick={submitAdd}
              disabled={addMutation.isPending}
            >
              <Plus className='mr-1 h-4 w-4' /> 添加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
