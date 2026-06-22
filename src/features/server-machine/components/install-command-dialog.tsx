import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Field = { label: string; value: string; mono?: boolean }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fields: Field[]
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type='button'
      variant='outline'
      size='icon'
      className='shrink-0'
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          toast.success('已复制')
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error('复制失败，请手动选择文本')
        }
      }}
    >
      {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
    </Button>
  )
}

/** 展示只读的 token / 安装命令，带复制按钮。 */
export function InstallCommandDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className='grid gap-4'>
          {fields.map((f) => (
            <div key={f.label} className='grid gap-1.5'>
              <span className='text-sm font-medium'>{f.label}</span>
              <div className='flex items-start gap-2'>
                <code
                  className={`flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 text-xs ${
                    f.mono ? 'font-mono' : ''
                  } break-all`}
                >
                  {f.value || '—'}
                </code>
                {f.value ? <CopyButton value={f.value} /> : null}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
