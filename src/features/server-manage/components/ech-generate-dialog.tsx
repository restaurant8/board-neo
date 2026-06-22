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
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>生成 ECH 密钥</DialogTitle>
          <DialogDescription>
            生成 Encrypted Client Hello 的服务端密钥（key）与客户端配置（config）。
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>Public Name（公开域名）</Label>
            <Input
              value={publicName}
              onChange={(e) => setPublicName(e.target.value)}
              placeholder='ech.example.com'
            />
          </div>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className='w-fit'
          >
            <KeyRound className='size-4' /> 生成
          </Button>

          {result && (
            <div className='grid gap-4'>
              <div className='grid gap-1'>
                <div className='flex items-center justify-between'>
                  <Label>ECH 密钥（服务端 key）</Label>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => copy(result.key, '密钥')}
                  >
                    <Copy className='size-4' /> 复制
                  </Button>
                </div>
                <pre className='bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs break-all'>
                  {result.key}
                </pre>
              </div>
              <div className='grid gap-1'>
                <div className='flex items-center justify-between'>
                  <Label>ECH 配置（客户端 config）</Label>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => copy(result.config, '配置')}
                  >
                    <Copy className='size-4' /> 复制
                  </Button>
                </div>
                <pre className='bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs break-all'>
                  {result.config}
                </pre>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {result && onGenerated && (
            <Button
              onClick={() => {
                onGenerated(result)
                onOpenChange(false)
              }}
            >
              回填到表单
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
