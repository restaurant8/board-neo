import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Copy, KeyRound } from 'lucide-react'
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
import { generateEchKey } from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 生成成功后回填 key / config 到表单。 */
  onGenerated?: (result: { key: string; config: string }) => void
}

export function EchGenerateDialog({ open, onOpenChange, onGenerated }: Props) {
  const [publicName, setPublicName] = useState('ech.example.com')
  const [result, setResult] = useState<{ key: string; config: string } | null>(
    null
  )

  const mutation = useMutation({
    mutationFn: () => generateEchKey(publicName || undefined),
    onSuccess: (data) => {
      setResult(data)
      toast.success('已生成 ECH 密钥')
    },
    onError: handleServerError,
  })

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`已复制${label}`)
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl'>
        <DialogHeader className='border-b bg-muted/20 px-6 pb-4 pt-6'>
          <DialogTitle className='font-mono text-sm tracking-wide'>
            生成 ECH 密钥
          </DialogTitle>
          <DialogDescription className='font-mono text-xs opacity-70'>
            生成 Encrypted Client Hello 的服务端密钥（key）与客户端配置（config）。
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[60vh] space-y-4 overflow-y-auto px-6 py-6'>
          <div className='grid gap-2'>
            <Label className='font-mono text-[12px] text-foreground/80'>
              Public Name（公开域名）
            </Label>
            <Input
              value={publicName}
              onChange={(e) => setPublicName(e.target.value)}
              placeholder='ech.example.com'
              className='h-9 font-mono text-xs'
            />
          </div>
          <Button
            type='button'
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className='h-8 w-fit px-4 font-mono text-xs font-bold'
          >
            <KeyRound className='mr-1 size-3.5' /> 生成
          </Button>

          {result && (
            <div className='grid gap-4'>
              <div className='grid gap-1'>
                <div className='flex items-center justify-between'>
                  <Label className='font-mono text-[12px] text-foreground/80'>
                    ECH 密钥（服务端 key）
                  </Label>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => copy(result.key, '密钥')}
                    className='h-7 px-2 font-mono text-[11px]'
                  >
                    <Copy className='mr-1 size-3' /> 复制
                  </Button>
                </div>
                <pre className='max-h-40 overflow-auto rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-[11px] break-all'>
                  {result.key}
                </pre>
              </div>
              <div className='grid gap-1'>
                <div className='flex items-center justify-between'>
                  <Label className='font-mono text-[12px] text-foreground/80'>
                    ECH 配置（客户端 config）
                  </Label>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => copy(result.config, '配置')}
                    className='h-7 px-2 font-mono text-[11px]'
                  >
                    <Copy className='mr-1 size-3' /> 复制
                  </Button>
                </div>
                <pre className='max-h-40 overflow-auto rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-[11px] break-all'>
                  {result.config}
                </pre>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className='flex flex-row items-center justify-end gap-3 border-t bg-muted/20 px-6 py-4 sm:space-x-0'>
          <Button
            type='button'
            variant='ghost'
            onClick={() => onOpenChange(false)}
            className='h-8 px-4 font-mono text-xs font-bold'
          >
            关闭
          </Button>
          {result && onGenerated && (
            <Button
              type='button'
              onClick={() => {
                onGenerated(result)
                onOpenChange(false)
              }}
              className='h-8 bg-primary px-8 font-mono text-xs font-bold text-primary-foreground hover:bg-primary/90'
            >
              回填到表单
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
