import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpCircle, CheckCircle2, KeyRound, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  checkUpdate,
  executeUpdate,
  getUpdateToken,
  setUpdateToken,
} from './api'

export function UpdatePage() {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [token, setToken] = useState(getUpdateToken())

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['update', 'check'],
    queryFn: checkUpdate,
    enabled: token.length > 0,
    retry: false,
  })

  const executeMutation = useMutation({
    mutationFn: executeUpdate,
    onSuccess: (res) => {
      toast.success(`更新完成${res.version ? `（${res.version}）` : ''}，请刷新页面`)
      setConfirmOpen(false)
      queryClient.invalidateQueries({ queryKey: ['update', 'check'] })
    },
    onError: handleServerError,
  })

  const saveToken = () => {
    setUpdateToken(token.trim())
    refetch()
  }

  const hasUpdate = data?.has_update === true

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
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>系统更新</h2>
            <p className='text-muted-foreground'>
              检查并更新本管理前端（board-neo）至 dist-standalone 最新构建版本。
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => refetch()}
            disabled={isFetching || token.length === 0}
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
            重新检查
          </Button>
        </div>

        {/* 更新密钥 */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <KeyRound className='size-5' /> 更新密钥
            </CardTitle>
            <CardDescription>
              与站点根目录 <code>update.php</code> 里的 <code>UPDATE_TOKEN</code>{' '}
              保持一致；仅保存在本浏览器。未设置时无法检查 / 更新。
            </CardDescription>
          </CardHeader>
          <CardContent className='flex gap-2'>
            <Input
              type='password'
              placeholder='输入 update.php 的 UPDATE_TOKEN'
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className='max-w-sm'
            />
            <Button variant='secondary' onClick={saveToken}>
              保存并检查
            </Button>
          </CardContent>
        </Card>

        {token.length === 0 ? (
          <p className='text-muted-foreground text-sm'>请先填写更新密钥。</p>
        ) : isLoading ? (
          <div className='text-muted-foreground py-12 text-center'>加载中...</div>
        ) : error ? (
          <p className='text-destructive text-sm'>
            检查失败：{(error as Error).message}
          </p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  版本信息
                  {hasUpdate ? (
                    <Badge>
                      <ArrowUpCircle className='size-3' /> 有可用更新
                    </Badge>
                  ) : (
                    <Badge variant='secondary'>
                      <CheckCircle2 className='size-3' /> 已是最新
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  当前已部署版本与 board-neo dist-standalone 最新提交对比。
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-3 sm:grid-cols-2'>
                <div className='grid gap-1'>
                  <span className='text-muted-foreground text-sm'>当前版本</span>
                  <code className='bg-muted rounded px-2 py-1 text-sm'>
                    {data?.current_version || '未知'}
                  </code>
                </div>
                <div className='grid gap-1'>
                  <span className='text-muted-foreground text-sm'>最新版本</span>
                  <code className='bg-muted rounded px-2 py-1 text-sm'>
                    {data?.latest_version || '未知'}
                  </code>
                </div>
                {data?.published_at && (
                  <div className='grid gap-1'>
                    <span className='text-muted-foreground text-sm'>提交时间</span>
                    <span className='text-sm'>{data.published_at}</span>
                  </div>
                )}
                {data?.message && (
                  <div className='grid gap-1 sm:col-span-2'>
                    <span className='text-muted-foreground text-sm'>最新提交</span>
                    <span className='text-sm whitespace-pre-wrap'>
                      {data.message}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div>
              <Button
                disabled={!hasUpdate || executeMutation.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                <ArrowUpCircle className='size-4' />
                一键更新
              </Button>
              {!hasUpdate && (
                <p className='text-muted-foreground mt-2 text-sm'>
                  当前已是最新版本，无需更新。
                </p>
              )}
            </div>
          </>
        )}
      </Main>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title='执行前端更新'
        desc={
          <div className='space-y-2'>
            <p>
              将从 <code>{data?.current_version}</code> 更新至{' '}
              <code>{data?.latest_version}</code>。
            </p>
            <p className='text-muted-foreground'>
              update.php 会下载最新 dist 并覆盖当前站点目录（保留 settings.js 等配置）。完成后请刷新页面。
            </p>
          </div>
        }
        confirmText='开始更新'
        isLoading={executeMutation.isPending}
        handleConfirm={() => executeMutation.mutate()}
      />
    </>
  )
}
