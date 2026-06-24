import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpCircle, Settings, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { FileDropzone } from '@/components/file-dropzone'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  type Plugin,
  deletePlugin,
  disablePlugin,
  enablePlugin,
  getPlugins,
  installPlugin,
  uninstallPlugin,
  uploadPlugin,
  upgradePlugin,
} from './api'
import { PluginConfigDialog } from './components/plugin-config-dialog'

export function PluginPage() {
  const queryClient = useQueryClient()
  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null)
  const [deleting, setDeleting] = useState<Plugin | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => getPlugins(),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['plugins'] })

  const mkAction = (fn: (code: string) => Promise<unknown>, msg: string) => ({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(msg)
      refresh()
    },
    onError: handleServerError,
  })

  const installMutation = useMutation(mkAction(installPlugin, '插件已安装'))
  const uninstallMutation = useMutation(mkAction(uninstallPlugin, '插件已卸载'))
  const enableMutation = useMutation(mkAction(enablePlugin, '插件已启用'))
  const disableMutation = useMutation(mkAction(disablePlugin, '插件已禁用'))
  const upgradeMutation = useMutation(mkAction(upgradePlugin, '插件已升级'))

  const deleteMutation = useMutation({
    mutationFn: (code: string) => deletePlugin(code),
    onSuccess: () => {
      toast.success('插件已删除')
      refresh()
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPlugin(file),
    onSuccess: () => {
      toast.success('插件上传成功')
      refresh()
    },
    onError: handleServerError,
  })

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>插件管理</h2>
          <p className='text-muted-foreground'>安装、启用、配置与升级插件。</p>
        </div>
        <FileDropzone
          onFile={(f) => uploadMutation.mutate(f)}
          loading={uploadMutation.isPending}
          accept='.zip'
          title='拖拽 .zip 插件包到此处，或点击选择'
          hint='仅支持 .zip 格式的插件包'
        />

        {isLoading ? (
          <div className='text-muted-foreground py-12 text-center'>加载中...</div>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {(data ?? []).map((p) => (
              <Card key={p.code}>
                <CardHeader>
                  <CardTitle className='flex flex-wrap items-center gap-2'>
                    {p.name}
                    <span className='text-muted-foreground text-xs font-normal'>
                      v{p.version}
                    </span>
                    {p.is_protected && <Badge variant='secondary'>核心</Badge>}
                    {p.need_upgrade && <Badge>可升级</Badge>}
                  </CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>{p.author}</span>
                  {p.is_installed && (
                    <div className='flex items-center gap-2'>
                      <span className='text-muted-foreground text-xs'>启用</span>
                      <Switch
                        checked={p.is_enabled}
                        onCheckedChange={(b) =>
                          b
                            ? enableMutation.mutate(p.code)
                            : disableMutation.mutate(p.code)
                        }
                      />
                    </div>
                  )}
                </CardContent>
                <CardFooter className='flex flex-wrap gap-2'>
                  {!p.is_installed ? (
                    <Button
                      size='sm'
                      onClick={() => installMutation.mutate(p.code)}
                      disabled={installMutation.isPending}
                    >
                      安装
                    </Button>
                  ) : (
                    <>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setConfigPlugin(p)}
                      >
                        <Settings className='size-4' /> 配置
                      </Button>
                      {p.need_upgrade && (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => upgradeMutation.mutate(p.code)}
                          disabled={upgradeMutation.isPending}
                        >
                          <ArrowUpCircle className='size-4' /> 升级
                        </Button>
                      )}
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => uninstallMutation.mutate(p.code)}
                        disabled={p.is_enabled || uninstallMutation.isPending}
                      >
                        卸载
                      </Button>
                    </>
                  )}
                  {p.can_be_deleted && (
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 className='size-4 text-destructive' />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </Main>

      <PluginConfigDialog
        open={!!configPlugin}
        onOpenChange={(o) => !o && setConfigPlugin(null)}
        plugin={configPlugin}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除插件'
        desc={`确定删除插件「${deleting?.name}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => deleting && deleteMutation.mutate(deleting.code)}
      />
    </>
  )
}
