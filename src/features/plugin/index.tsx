import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Puzzle, Search, Upload } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type Plugin,
  deletePlugin,
  disablePlugin,
  enablePlugin,
  getPluginTypes,
  getPlugins,
  installPlugin,
  uninstallPlugin,
  uploadPlugin,
  upgradePlugin,
} from './api'
import { PluginCard } from './components/plugin-card'
import { PluginConfigDialog } from './components/plugin-config-dialog'

export function PluginPage() {
  const queryClient = useQueryClient()
  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null)
  const [deleting, setDeleting] = useState<Plugin | null>(null)
  const [loadingCode, setLoadingCode] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeTab, setTypeTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data: types } = useQuery({
    queryKey: ['plugin-types'],
    queryFn: getPluginTypes,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => getPlugins(),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['plugins'] })

  const mkAction = (fn: (code: string) => Promise<unknown>, msg: string) => ({
    mutationFn: (code: string) => {
      setLoadingCode(code)
      return fn(code)
    },
    onSuccess: () => {
      toast.success(msg)
      refresh()
    },
    onError: handleServerError,
    onSettled: () => setLoadingCode(null),
  })

  const installMutation = useMutation(mkAction(installPlugin, '插件安装成功'))
  const uninstallMutation = useMutation(mkAction(uninstallPlugin, '插件卸载成功'))
  const enableMutation = useMutation(mkAction(enablePlugin, '插件启用成功'))
  const disableMutation = useMutation(mkAction(disablePlugin, '插件禁用成功'))
  const upgradeMutation = useMutation(mkAction(upgradePlugin, '插件升级成功'))

  const deleteMutation = useMutation({
    mutationFn: (code: string) => deletePlugin(code),
    onSuccess: () => {
      toast.success('插件删除成功')
      refresh()
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPlugin(file),
    onSuccess: () => {
      toast.success('插件上传成功')
      setUploadOpen(false)
      refresh()
    },
    onError: handleServerError,
  })

  const typeInfo = (t: string) => types?.find((x) => x.value === t)

  const filtered = (data ?? []).filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q)
    const matchType = typeTab === 'all' || p.type === typeTab
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'installed' && p.is_installed) ||
      (statusFilter === 'available' && !p.is_installed)
    return matchSearch && matchType && matchStatus
  })

  const renderList = () =>
    isLoading ? (
      <div className='text-muted-foreground py-12 text-center'>加载中...</div>
    ) : (
      <div className='space-y-4'>
        {filtered.map((p) => (
          <PluginCard
            key={p.code}
            plugin={p}
            typeInfo={typeInfo(p.type)}
            isLoading={loadingCode === p.code}
            onInstall={(c) => installMutation.mutate(c)}
            onUpgrade={(c) => upgradeMutation.mutate(c)}
            onUninstall={(c) => uninstallMutation.mutate(c)}
            onToggleEnable={(c, enabled) =>
              enabled ? disableMutation.mutate(c) : enableMutation.mutate(c)
            }
            onOpenConfig={setConfigPlugin}
            onDelete={setDeleting}
          />
        ))}
      </div>
    )

  return (
    <>
      <Header fixed>
        <div className='flex items-center gap-2'>
          <Puzzle className='h-6 w-6' />
          <h1 className='text-2xl font-bold tracking-tight'>插件管理</h1>
        </div>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-8 space-y-4'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div className='relative max-w-sm flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                placeholder='搜索插件名称或描述...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-9'
              />
            </div>
            <div className='flex items-center gap-4'>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className='w-[140px]'>
                  <SelectValue placeholder='安装状态' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部状态</SelectItem>
                  <SelectItem value='installed'>已安装</SelectItem>
                  <SelectItem value='available'>可安装</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => setUploadOpen(true)}
                variant='outline'
                className='shrink-0'
                size='sm'
              >
                <Upload className='mr-2 h-4 w-4' />
                上传插件
              </Button>
            </div>
          </div>

          <Tabs value={typeTab} onValueChange={setTypeTab} className='w-full'>
            <TabsList>
              {types?.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  <div className='flex items-center gap-2'>
                    <span>{t.label}</span>
                  </div>
                </TabsTrigger>
              ))}
              <TabsTrigger value='all'>所有插件</TabsTrigger>
            </TabsList>
            <TabsContent value='all' className='mt-6'>
              {renderList()}
            </TabsContent>
            {types?.map((t) => (
              <TabsContent key={t.value} value={t.value} className='mt-6'>
                {renderList()}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </Main>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>上传插件</DialogTitle>
            <DialogDescription>上传插件包 (.zip)</DialogDescription>
          </DialogHeader>
          <FileDropzone
            onFile={(f) => uploadMutation.mutate(f)}
            loading={uploadMutation.isPending}
            accept='.zip'
            title='拖拽插件包到此处，或点击浏览'
            hint='仅支持 .zip 格式文件'
            className='mt-4 h-64'
          />
        </DialogContent>
      </Dialog>

      <PluginConfigDialog
        open={!!configPlugin}
        onOpenChange={(o) => !o && setConfigPlugin(null)}
        plugin={configPlugin}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除插件'
        desc={`确定要删除此插件吗？此操作无法撤销。`}
        confirmText='删除'
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => deleting && deleteMutation.mutate(deleting.code)}
      />
    </>
  )
}
