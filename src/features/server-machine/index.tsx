import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  RotateCw,
  Terminal,
  ListTree,
} from 'lucide-react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type Machine,
  type MachineCreateResult,
  dropMachine,
  fetchMachines,
  getInstallCommand,
  getMachineToken,
  resetMachineToken,
} from './api'
import { BackendManager } from './components/backend-manager'
import { InstallCommandDialog } from './components/install-command-dialog'
import { MachineMutateDialog } from './components/machine-mutate-dialog'
import { MachineNodesSheet } from './components/machine-nodes-sheet'

function fmtTime(ts: number | null | undefined) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

type SecretDialog = {
  title: string
  description?: string
  fields: { label: string; value: string; mono?: boolean }[]
}

export function ServerMachinePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Machine | null>(null)
  const [deleting, setDeleting] = useState<Machine | null>(null)
  const [nodesOf, setNodesOf] = useState<Machine | null>(null)
  const [secret, setSecret] = useState<SecretDialog | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: fetchMachines,
  })

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropMachine(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['machines'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  const resetTokenMutation = useMutation({
    mutationFn: (id: number) => resetMachineToken(id),
    onSuccess: (res) => {
      setSecret({
        title: '已重置 Token',
        description: '请妥善保存。旧 token 已失效，节点需用新 token 重新配置。',
        fields: [{ label: 'Token', value: res.token, mono: true }],
      })
    },
    onError: handleServerError,
  })

  const getTokenMutation = useMutation({
    mutationFn: (id: number) => getMachineToken(id),
    onSuccess: (res) => {
      setSecret({
        title: '机器 Token',
        fields: [{ label: 'Token', value: res.token, mono: true }],
      })
    },
    onError: handleServerError,
  })

  const installCmdMutation = useMutation({
    mutationFn: (id: number) => getInstallCommand(id),
    onSuccess: (res) => {
      setSecret({
        title: '一键安装命令',
        description: '在目标服务器上以 root 执行以下命令完成安装。',
        fields: [{ label: '安装命令', value: res.command, mono: true }],
      })
    },
    onError: handleServerError,
  })

  function onCreated(result: MachineCreateResult) {
    setSecret({
      title: '机器已创建',
      description: '请保存 token 与安装命令，token 仅在此完整展示一次。',
      fields: [
        { label: 'Token', value: result.token, mono: true },
        { label: '安装命令', value: result.install_command, mono: true },
      ],
    })
  }

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
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>机器管理</h2>
            <p className='text-muted-foreground'>
              管理承载节点的机器，以及各机器上报的后端进程。
            </p>
          </div>
        </div>

        <Tabs defaultValue='machines' className='flex flex-1 flex-col'>
          <TabsList>
            <TabsTrigger value='machines'>机器列表</TabsTrigger>
            <TabsTrigger value='backends'>后端管理</TabsTrigger>
          </TabsList>

          <TabsContent value='machines' className='flex flex-col gap-4'>
            <div className='flex justify-end'>
              <Button
                onClick={() => {
                  setCurrent(null)
                  setMutateOpen(true)
                }}
              >
                <Plus className='size-4' /> 新建机器
              </Button>
            </div>
            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-16'>ID</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>关联节点</TableHead>
                    <TableHead className='w-20'>状态</TableHead>
                    <TableHead>最后在线</TableHead>
                    <TableHead className='text-end'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className='h-24 text-center'>
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : data && data.length > 0 ? (
                    data.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.id}</TableCell>
                        <TableCell>
                          <div className='font-medium'>{m.name}</div>
                          {m.notes ? (
                            <div className='text-xs text-muted-foreground'>
                              {m.notes}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant='link'
                            className='h-auto p-0'
                            onClick={() => setNodesOf(m)}
                          >
                            <ListTree className='size-4' />
                            {m.servers_count} 个节点
                          </Button>
                        </TableCell>
                        <TableCell>
                          {m.is_active ? (
                            <Badge>启用</Badge>
                          ) : (
                            <Badge variant='secondary'>停用</Badge>
                          )}
                        </TableCell>
                        <TableCell className='text-xs text-muted-foreground'>
                          {fmtTime(m.last_seen_at)}
                        </TableCell>
                        <TableCell className='text-end whitespace-nowrap'>
                          <Button
                            variant='ghost'
                            size='icon'
                            title='一键安装命令'
                            onClick={() => installCmdMutation.mutate(m.id)}
                          >
                            <Terminal className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            title='获取 Token'
                            onClick={() => getTokenMutation.mutate(m.id)}
                          >
                            <KeyRound className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            title='重置 Token'
                            onClick={() => resetTokenMutation.mutate(m.id)}
                          >
                            <RotateCw className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            title='编辑'
                            onClick={() => {
                              setCurrent(m)
                              setMutateOpen(true)
                            }}
                          >
                            <Pencil className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            title='删除'
                            onClick={() => setDeleting(m)}
                          >
                            <Trash2 className='size-4 text-destructive' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className='h-24 text-center text-muted-foreground'
                      >
                        暂无机器
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value='backends'>
            <BackendManager />
          </TabsContent>
        </Tabs>
      </Main>

      <MachineMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
        onCreated={onCreated}
      />

      <MachineNodesSheet
        machine={nodesOf}
        onOpenChange={(o) => !o && setNodesOf(null)}
      />

      <InstallCommandDialog
        open={!!secret}
        onOpenChange={(o) => !o && setSecret(null)}
        title={secret?.title ?? ''}
        description={secret?.description}
        fields={secret?.fields ?? []}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除机器'
        desc={`确定删除机器「${deleting?.name}」吗？关联节点会自动解除绑定。`}
        confirmText='删除'
        destructive
        isLoading={dropMutation.isPending}
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
      />
    </>
  )
}
