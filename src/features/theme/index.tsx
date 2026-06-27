import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { FileDropzone } from '@/components/file-dropzone'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  type ThemeItem,
  deleteTheme,
  getThemes,
  switchTheme,
  uploadTheme,
} from './api'
import { ThemeCard } from './components/theme-card'
import { ThemeConfigDialog } from './components/theme-config-dialog'
import { ThemePreviewDialog } from './components/theme-preview-dialog'

export function ThemePage() {
  const queryClient = useQueryClient()
  const [configTheme, setConfigTheme] = useState<ThemeItem | null>(null)
  const [previewTheme, setPreviewTheme] = useState<ThemeItem | null>(null)
  const [deleting, setDeleting] = useState<{ key: string; theme: ThemeItem } | null>(
    null
  )
  const [activatingKey, setActivatingKey] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: getThemes,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['themes'] })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadTheme(file),
    onSuccess: () => {
      toast.success('主题上传成功')
      setUploadOpen(false)
      refresh()
    },
    onError: handleServerError,
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteTheme(name),
    onSuccess: () => {
      toast.success('主题删除成功')
      refresh()
      setDeleting(null)
    },
    onError: handleServerError,
  })

  // 切换主题：调用专用 switchTheme 接口（后端 ThemeService::switch）
  const activateMutation = useMutation({
    mutationFn: (name: string) => {
      setActivatingKey(name)
      return switchTheme(name)
    },
    onSuccess: () => {
      toast.success('主题切换成功')
      refresh()
    },
    onError: handleServerError,
    onSettled: () => setActivatingKey(null),
  })

  const entries = data ? Object.entries(data.themes) : []
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

      <Main>
        <header className='mb-8'>
          <div className='mb-2'>
            <h1 className='text-2xl font-bold tracking-tight'>主题配置</h1>
          </div>
          <div className='flex items-center justify-between'>
            <div className='text-muted-foreground'>
              主题配置，包括主题色、字体大小等。如果你采用前后分离的方式部署
              V2board，那么主题配置将不会生效。
            </div>
            <Button
              onClick={() => setUploadOpen(true)}
              variant='outline'
              className='ml-4 shrink-0'
              size='sm'
            >
              <Upload className='mr-2 h-4 w-4' />
              上传主题
            </Button>
          </div>
        </header>

        <section className='grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'>
          {isLoading ? (
            <div className='text-muted-foreground col-span-full py-12 text-center'>
              加载中...
            </div>
          ) : (
            entries.map(([key, t]) => (
              <ThemeCard
                key={key}
                themeKey={key}
                theme={t}
                isActive={key === active}
                activating={activatingKey === key}
                onActivate={(k) => activateMutation.mutate(k)}
                onDelete={(k) => {
                  if (k === active) {
                    toast.error('不能删除当前使用的主题')
                    return
                  }
                  setDeleting({ key: k, theme: t })
                }}
                onPreview={setPreviewTheme}
                onConfig={setConfigTheme}
              />
            ))
          )}
        </section>
      </Main>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>上传主题</DialogTitle>
            <DialogDescription>
              请上传一个有效的主题压缩包（.zip
              格式）。主题包应包含完整的主题文件结构。
            </DialogDescription>
          </DialogHeader>
          <FileDropzone
            onFile={(f) => uploadMutation.mutate(f)}
            loading={uploadMutation.isPending}
            accept='.zip'
            title='将主题文件拖放到此处，或者点击选择'
            hint='支持 .zip 格式的主题包'
            className='mt-4 h-64'
          />
        </DialogContent>
      </Dialog>

      <ThemePreviewDialog
        theme={previewTheme}
        onOpenChange={(o) => !o && setPreviewTheme(null)}
      />

      <ThemeConfigDialog
        open={!!configTheme}
        onOpenChange={(o) => !o && setConfigTheme(null)}
        theme={configTheme}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除主题'
        desc='确定要删除该主题吗？删除后无法恢复。'
        confirmText='删除'
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => deleting && deleteMutation.mutate(deleting.theme.name)}
      />
    </>
  )
}
