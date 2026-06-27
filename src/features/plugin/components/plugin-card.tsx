import {
  ArrowUpCircle,
  FileText,
  Power,
  Puzzle,
  Settings2,
  Shield,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { type Plugin, type PluginType } from '../api'

type Props = {
  plugin: Plugin
  typeInfo?: PluginType
  onInstall: (code: string) => void
  onUpgrade: (code: string) => void
  onUninstall: (code: string) => void
  onToggleEnable: (code: string, enabled: boolean) => void
  onOpenConfig: (plugin: Plugin) => void
  onDelete: (plugin: Plugin) => void
  onShowReadme?: () => void
  isLoading?: boolean
}

function hasConfig(config: Plugin['config']) {
  if (!config) return false
  if (Array.isArray(config)) return config.length > 0
  return Object.keys(config).length > 0
}

export function PluginCard({
  plugin: p,
  typeInfo,
  onInstall,
  onUpgrade,
  onUninstall,
  onToggleEnable,
  onOpenConfig,
  onDelete,
  onShowReadme,
  isLoading,
}: Props) {
  return (
    <Card className='group relative gap-0 overflow-hidden py-0 transition-all hover:shadow-md'>
      <div className='p-4'>
        <div className='mb-2 flex items-center justify-between'>
          <div className='flex min-w-0 flex-1 items-center gap-2'>
            <h3 className='truncate text-base font-semibold'>{p.name}</h3>
            {typeInfo && (
              <Badge
                variant='outline'
                className='border-primary/20 bg-primary/5 text-primary px-1.5 py-0.5 text-xs'
              >
                {typeInfo.label}
              </Badge>
            )}
            {p.is_installed ? (
              <Badge
                variant={p.is_enabled ? 'default' : 'outline'}
                className='px-1.5 py-0.5 text-xs'
              >
                {p.is_enabled ? '已启用' : '已禁用'}
              </Badge>
            ) : (
              <Badge
                variant='outline'
                className='border-muted-foreground/30 bg-muted/30 text-muted-foreground px-1.5 py-0.5 text-xs'
              >
                未安装
              </Badge>
            )}
          </div>
          <div className='flex flex-shrink-0 items-center gap-1.5'>
            {p.is_protected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className='flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'>
                    <Shield className='h-3 w-3' />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>受保护</p>
                </TooltipContent>
              </Tooltip>
            )}
            {p.readme && onShowReadme && (
              <button
                type='button'
                onClick={onShowReadme}
                className='text-muted-foreground hover:bg-muted hover:text-primary flex h-5 w-5 items-center justify-center rounded-full transition-colors'
                title='查看文档'
              >
                <FileText className='h-3 w-3' />
              </button>
            )}
          </div>
        </div>

        <div className='text-muted-foreground mb-2 flex items-center gap-3 text-xs'>
          <div className='flex items-center gap-1'>
            <Puzzle className='h-3 w-3' />
            <code className='bg-muted rounded px-1 py-0.5 text-xs'>
              {p.code}
            </code>
          </div>
          <span>v{p.version}</span>
          <span>作者: {p.author}</span>
        </div>

        <p
          className='text-muted-foreground mb-3 overflow-hidden text-ellipsis text-sm'
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {p.description}
        </p>

        <div className='flex items-center justify-end gap-2'>
          {p.is_installed ? (
            <>
              {p.need_upgrade && (
                <Button
                  variant='destructive'
                  size='sm'
                  disabled={isLoading}
                  onClick={() => onUpgrade(p.code)}
                  className='h-7 bg-red-600 px-2 text-xs text-white hover:bg-red-700'
                >
                  <ArrowUpCircle className='mr-1 h-3 w-3' />
                  升级
                </Button>
              )}
              {hasConfig(p.config) && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => onOpenConfig(p)}
                  disabled={!p.is_enabled || isLoading}
                  className='h-7 px-2 text-xs'
                >
                  <Settings2 className='mr-1 h-3 w-3' />
                  配置
                </Button>
              )}
              <Button
                variant={p.is_enabled ? 'destructive' : 'default'}
                size='sm'
                onClick={() => onToggleEnable(p.code, p.is_enabled)}
                disabled={isLoading}
                className='h-7 px-2 text-xs'
              >
                <Power className='mr-1 h-3 w-3' />
                {p.is_enabled ? '禁用' : '启用'}
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => onUninstall(p.code)}
                disabled={isLoading || p.is_enabled}
                className='text-muted-foreground hover:text-destructive h-7 px-2 text-xs'
              >
                <Trash2 className='mr-1 h-3 w-3' />
                卸载
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => onInstall(p.code)}
                disabled={isLoading}
                size='sm'
                className='h-7 px-3 text-xs'
              >
                {isLoading ? (
                  <div className='mr-1 h-3 w-3 animate-spin rounded-full border border-current border-t-transparent' />
                ) : null}
                安装
              </Button>
              {p.can_be_deleted !== false && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => onDelete(p)}
                  disabled={isLoading}
                  className='text-muted-foreground hover:text-destructive h-7 w-7 p-0'
                >
                  <Trash2 className='h-3 w-3' />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
