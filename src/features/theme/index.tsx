import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Settings, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { saveConfig } from '@/features/config/api'
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
import { type ThemeItem, deleteTheme, getThemes, uploadTheme } from './api'
import { ThemeConfigDialog } from './components/theme-config-dialog'

export function ThemePage() {
  const queryClient = useQueryClient()
  const [configTheme, setConfigTheme] = useState<ThemeItem | null>(null)
  const [deleting, setDeleting] = useState<ThemeItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: getThemes,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['themes'] })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadTheme(file),
    onSuccess: () => {
      toast.success('主题上传成功')
      refresh()
    },
    onError: handleServerError,
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteTheme(name),
    onSuccess: () => {
      toast.success('主题已删除')
      refresh()
      setDeleting(null)
    },
    onError: handleServerError,
  })

  // 切换主题：通过 config/save 的 frontend_theme（后端 save 会触发主题 switch）
  const activateMutation = useMutation({
    mutationFn: (name: string) => saveConfig({ frontend_theme: name }),
    onSuccess: () => {
      toast.success('已切换主题')
      refresh()
    },
    onError: handleServerError,
  })

  const themes = data ? Object.values(data.themes) : []
  const active = data?.active

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
          <h2 className='text-2xl font-bold tracking-tight'>主题管理</h2>
          <p className='text-muted-foreground'>上传、配置、切换前端主题。</p>
        </div>
        <FileDropzone
          onFile={(f) => uploadMutation.mutate(f)}
          loading={uploadMutation.isPending}
          accept='.zip'
          title='拖拽 .zip 主题包到此处，或点击选择'
          hint='仅支持 .zip 格式的主题包'
        />

        {isLoading ? (
          <div className='text-muted-foreground py-12 text-center'>加载中...</div>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {themes.map((t) => {
              const isActive = t.name === active
              return (
                <Card key={t.name} className={isActive ? 'border-primary' : ''}>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      {t.name}
                      {isActive && (
                        <Badge>
                          <CheckCircle2 className='size-3' /> 当前
                        </Badge>
                      )}
                      {t.is_system && <Badge variant='secondary'>系统</Badge>}
                    </CardTitle>
                    <CardDescription>
                      {t.description || '—'}
                      {t.version ? ` · v${t.version}` : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='text-muted-foreground text-sm'>
                    配置项：{t.configs?.length ?? 0}
                  </CardContent>
                  <CardFooter className='flex flex-wrap gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={isActive || activateMutation.isPending}
                      onClick={() => activateMutation.mutate(t.name)}
                    >
                      {isActive ? '使用中' : '设为当前'}
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => setConfigTheme(t)}
                    >
                      <Settings className='size-4' /> 配置
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      disabled={t.can_delete === false}
                      onClick={() => setDeleting(t)}
                    >
                      <Trash2 className='size-4 text-destructive' />
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </Main>

      <ThemeConfigDialog
        open={!!configTheme}
        onOpenChange={(o) => !o && setConfigTheme(null)}
        theme={configTheme}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除主题'
        desc={`确定删除主题「${deleting?.name}」吗？此操作不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => deleting && deleteMutation.mutate(deleting.name)}
      />
    </>
  )
}
