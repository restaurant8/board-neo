import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw, ArrowUpCircle } from 'lucide-react'
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
import { checkUpdate, executeUpdate } from './api'

export function UpdatePage() {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['update', 'check'],
    queryFn: checkUpdate,
  })

  const executeMutation = useMutation({
    mutationFn: executeUpdate,
    onSuccess: (res) => {
      toast.success(res.message || '更新完成')
      setConfirmOpen(false)
      queryClient.invalidateQueries({ queryKey: ['update', 'check'] })
    },
    onError: handleServerError,
  })

  const hasUpdate = data?.has_update === true
  const isLocalNewer = data?.is_local_newer === true

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
              检查并应用 Xboard 面板的最新版本。
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`size-4 ${isFetching ? 'animate-spin' : ''}`}
            />
            重新检查
          </Button>
        </div>

        {isLoading ? (
          <div className='text-muted-foreground py-12 text-center'>加载中...</div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  版本信息
                  {isLocalNewer ? (
                    <Badge variant='secondary'>本地领先</Badge>
                  ) : hasUpdate ? (
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
                  当前版本与上游仓库最新版本对比。
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
                {data?.author && (
                  <div className='grid gap-1'>
                    <span className='text-muted-foreground text-sm'>
                      最新提交作者
                    </span>
                    <span className='text-sm'>{data.author}</span>
                  </div>
                )}
                {data?.published_at && (
                  <div className='grid gap-1'>
                    <span className='text-muted-foreground text-sm'>
                      发布时间
                    </span>
                    <span className='text-sm'>{data.published_at}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {data && data.update_logs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>更新日志</CardTitle>
                  <CardDescription>
                    当前版本之后的提交记录（共 {data.update_logs.length} 条）。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className='flex flex-col gap-3'>
                    {data.update_logs.map((log, i) => (
                      <li
                        key={`${log.version}-${i}`}
                        className='border-border border-b pb-3 last:border-0 last:pb-0'
                      >
                        <div className='flex items-center gap-2'>
                          <code className='bg-muted rounded px-1.5 py-0.5 text-xs'>
                            {log.version}
                          </code>
                          {log.is_local && (
                            <Badge variant='secondary'>本地</Badge>
                          )}
                          <span className='text-muted-foreground text-xs'>
                            {log.author} · {log.date}
                          </span>
                        </div>
                        <p className='mt-1 text-sm whitespace-pre-wrap'>
                          {log.message}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div>
              <Button
                disabled={!hasUpdate || executeMutation.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                <ArrowUpCircle className='size-4' />
                一键更新
              </Button>
              {!hasUpdate && !isLocalNewer && (
                <p className='text-muted-foreground mt-2 text-sm'>
                  当前已是最新版本，无需更新。
                </p>
              )}
              {isLocalNewer && (
                <p className='text-muted-foreground mt-2 text-sm'>
                  本地版本领先于上游，无法执行更新。
                </p>
              )}
            </div>
          </>
        )}
      </Main>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title='执行系统更新'
        desc={
          <div className='space-y-2'>
            <p>
              将从 <code>{data?.current_version}</code> 更新至{' '}
              <code>{data?.latest_version}</code>。
            </p>
            <p className='text-muted-foreground'>
              更新过程会备份数据库、拉取最新代码、执行数据库迁移并清理缓存，期间面板可能短暂不可用。请确认已了解风险。
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
