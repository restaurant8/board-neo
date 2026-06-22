import { useQuery } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type Server, getInstallCommand } from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  node: Server | null
}

export function InstallCommandDialog({ open, onOpenChange, node }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['node-install-command', node?.id],
    queryFn: () => getInstallCommand(node!.id),
    enabled: open && !!node,
  })

  const command = data?.command ?? node?.install_command ?? ''

  const handleCopy = async () => {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      toast.success('已复制安装命令')
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>安装命令</DialogTitle>
          <DialogDescription>
            在节点服务器上以 root 身份执行以下命令完成安装。
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className='text-muted-foreground text-sm'>加载中...</p>
        ) : isError ? (
          <p className='text-destructive text-sm'>
            {(error as Error)?.message || '获取安装命令失败（请确认已配置 server_token）'}
          </p>
        ) : command ? (
          <div className='relative'>
            <pre className='bg-muted overflow-x-auto rounded-md p-4 pe-12 text-sm whitespace-pre-wrap break-all'>
              {command}
            </pre>
            <Button
              variant='outline'
              size='icon'
              className='absolute end-2 top-2'
              onClick={handleCopy}
            >
              <Copy className='size-4' />
            </Button>
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            暂无安装命令，请先在系统设置中配置 server_token。
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
