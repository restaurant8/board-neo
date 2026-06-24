import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  Server,
  ServerOff,
  CircleCheck,
  TriangleAlert,
  Layers,
  Cpu,
  MemoryStick,
  HardDrive,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Input } from '@/components/ui/input'
import {
  type Machine,
  type MachineCreateResult,
  dropMachine,
  fetchMachines,
} from './api'
import {
  fmtAgo,
  fmtBytes,
  isHighLoad,
  isOnline,
  pct,
  readLoad,
} from './format'
import { InstallCommandDialog } from './components/install-command-dialog'
import { MachineDetailDrawer } from './components/machine-detail-drawer'
import { MachineMutateDialog } from './components/machine-mutate-dialog'

type SecretDialog = {
  title: string
  description?: string
  fields: { label: string; value: string; mono?: boolean }[]
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: string
}) {
  return (
    <Card className='flex-row items-center justify-between p-4'>
      <div>
        <div className='text-muted-foreground text-sm'>{label}</div>
        <div className='text-2xl font-bold'>{value}</div>
      </div>
      <div className={tone}>{icon}</div>
    </Card>
  )
}

function LoadBar({
  icon,
  label,
  value,
  percent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  percent: number
}) {
  return (
    <div className='grid gap-0.5'>
      <div className='text-muted-foreground flex items-center gap-1 text-xs'>
        {icon}
        <span className='w-8'>{label}</span>
        <span className='text-foreground ms-auto'>{value}</span>
      </div>
      <div className='bg-muted h-1 w-36 overflow-hidden rounded-full max-sm:w-full'>
        <div
          className='bg-primary h-full rounded-full'
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function ServerMachinePage() {
  const queryClient = useQueryClient()
  const [mutateOpen, setMutateOpen] = useState(false)
  const [current, setCurrent] = useState<Machine | null>(null)
  const [deleting, setDeleting] = useState<Machine | null>(null)
  const [detail, setDetail] = useState<Machine | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [secret, setSecret] = useState<SecretDialog | null>(null)
  const [keyword, setKeyword] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: fetchMachines,
    refetchInterval: 15000,
  })

  const stats = useMemo(() => {
    const list = data ?? []
    let online = 0
    let high = 0
    let nodes = 0
    list.forEach((m) => {
      if (isOnline(m.last_seen_at)) online++
      if (isHighLoad(readLoad(m.load_status))) high++
      nodes += m.servers_count ?? 0
    })
    return { total: list.length, online, offline: list.length - online, high, nodes }
  }, [data])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return data ?? []
    return (data ?? []).filter(
      (m) =>
        m.name.toLowerCase().includes(kw) ||
        (m.notes ?? '').toLowerCase().includes(kw) ||
        String(m.id).includes(kw)
    )
  }, [data, keyword])

  const dropMutation = useMutation({
    mutationFn: (id: number) => dropMachine(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['machines'] })
      setDeleting(null)
    },
    onError: handleServerError,
  })

  function onCreated(result: MachineCreateResult) {
    queryClient.invalidateQueries({ queryKey: ['machines'] })
    setSecret({
      title: '服务器已创建',
      description: '请保存 token 与安装命令，token 仅在此完整展示一次。',
      fields: [
        { label: 'Token', value: result.token, mono: true },
        { label: '安装命令', value: result.install_command, mono: true },
      ],
    })
  }

  function openDetail(m: Machine) {
    setDetail(m)
    setDetailOpen(true)
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>服务器管理</h2>
          <p className='text-muted-foreground'>
            用于查看服务器健康、负载与承载节点，并从运维视角快捷发起节点操作。
          </p>
        </div>

        {/* 汇总卡片 */}
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-5'>
          <SummaryCard
            icon={<Server className='size-5' />}
            label='服务器总数'
            value={stats.total}
          />
          <SummaryCard
            icon={<CircleCheck className='size-5 text-emerald-500' />}
            label='在线服务器'
            value={stats.online}
          />
          <SummaryCard
            icon={<ServerOff className='size-5 text-muted-foreground' />}
            label='离线/失联'
            value={stats.offline}
          />
          <SummaryCard
            icon={<TriangleAlert className='size-5 text-amber-500' />}
            label='高负载'
            value={stats.high}
          />
          <SummaryCard
            icon={<Layers className='size-5 text-sky-500' />}
            label='节点数'
            value={stats.nodes}
          />
        </div>

        {/* 工具栏 */}
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            onClick={() => {
              setCurrent(null)
              setMutateOpen(true)
            }}
          >
            <Plus className='size-4' /> 添加服务器
          </Button>
          <Input
            placeholder='搜索服务器名称、备注或 SID...'
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className='max-w-xs'
          />
          <div className='text-muted-foreground ms-auto text-sm'>
            在线：{stats.online}/{stats.total} · 高负载：{stats.high}
          </div>
        </div>

        {/* 列表 */}
        <div className='overflow-hidden rounded-md border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-muted-foreground'>
              <tr>
                <th className='p-3 text-start font-normal'>服务器名称</th>
                <th className='p-3 text-start font-normal'>状态</th>
                <th className='p-3 text-start font-normal'>负载</th>
                <th className='p-3 text-start font-normal'>节点数</th>
                <th className='p-3 text-start font-normal'>最后心跳</th>
                <th className='p-3 text-end font-normal'>操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className='h-24 text-center'>
                    加载中...
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((m) => {
                  const load = readLoad(m.load_status)
                  const online = isOnline(m.last_seen_at)
                  return (
                    <tr key={m.id} className='hover:bg-muted/30 border-t'>
                      <td className='p-3'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>{m.name}</span>
                          <Badge variant='secondary' className='text-[10px]'>
                            SID:{m.id}
                          </Badge>
                        </div>
                        {m.notes && (
                          <div className='text-muted-foreground text-xs'>
                            {m.notes}
                          </div>
                        )}
                      </td>
                      <td className='p-3'>
                        {online ? (
                          <Badge>在线</Badge>
                        ) : (
                          <Badge variant='outline'>离线</Badge>
                        )}
                      </td>
                      <td className='p-3'>
                        <div className='grid gap-1'>
                          <LoadBar
                            icon={<Cpu className='size-3' />}
                            label='CPU'
                            value={`${(load.cpu ?? 0).toFixed(0)}%`}
                            percent={load.cpu ?? 0}
                          />
                          <LoadBar
                            icon={<MemoryStick className='size-3' />}
                            label='MEM'
                            value={`${pct(load.mem?.used, load.mem?.total)}%`}
                            percent={pct(load.mem?.used, load.mem?.total)}
                          />
                          <LoadBar
                            icon={<HardDrive className='size-3' />}
                            label='DISK'
                            value={`${fmtBytes(load.disk?.used)} / ${fmtBytes(load.disk?.total)}`}
                            percent={pct(load.disk?.used, load.disk?.total)}
                          />
                        </div>
                      </td>
                      <td className='p-3'>
                        <div>{m.servers_count} 已承载节点</div>
                        <Button
                          variant='link'
                          className='h-auto p-0 text-xs'
                          onClick={() => openDetail(m)}
                        >
                          <Eye className='size-3' /> 服务器详情
                        </Button>
                      </td>
                      <td className='text-muted-foreground p-3 text-xs'>
                        {fmtAgo(m.last_seen_at)}
                      </td>
                      <td className='p-3 text-end whitespace-nowrap'>
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
                          <Trash2 className='text-destructive size-4' />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className='text-muted-foreground h-24 text-center'
                  >
                    暂无服务器
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Main>

      <MachineMutateDialog
        open={mutateOpen}
        onOpenChange={setMutateOpen}
        current={current}
        onCreated={onCreated}
      />

      <MachineDetailDrawer
        machine={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAddNode={() => {
          setDetailOpen(false)
          setCurrent(null)
          setMutateOpen(true)
        }}
      />

      {secret && (
        <InstallCommandDialog
          open={!!secret}
          onOpenChange={(o) => !o && setSecret(null)}
          title={secret.title}
          description={secret.description}
          fields={secret.fields}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除服务器'
        desc={`确定删除服务器「${deleting?.name}」吗？关联节点会自动解除绑定。`}
        confirmText='删除'
        destructive
        handleConfirm={() => deleting && dropMutation.mutate(deleting.id)}
        isLoading={dropMutation.isPending}
      />
    </>
  )
}
