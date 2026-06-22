import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Download,
  KeyRound,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api-client'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type User,
  type UserFilter,
  banUsers,
  destroyUser,
  fetchPlans,
  fetchUsers,
  resetSecret,
} from './api'
import { UserEditDialog } from './components/user-edit-dialog'
import { UserGenerateDialog } from './components/user-generate-dialog'
import { UserSendMailDialog } from './components/user-send-mail-dialog'
import { UsageRecordsDialog } from './components/usage-records-dialog'
import { formatBytes, formatExpire, formatMoney } from './format'

const PAGE_SIZE = 20

export function UserPage() {
  const queryClient = useQueryClient()

  // 筛选输入
  const [emailInput, setEmailInput] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all') // plan_id 或 'all'
  const [bannedFilter, setBannedFilter] = useState<string>('all') // 'all' | '1' | '0'
  const [page, setPage] = useState(1)

  // 已应用筛选
  const [applied, setApplied] = useState<{
    email: string
    plan: string
    banned: string
  }>({ email: '', plan: 'all', banned: 'all' })

  // 弹窗状态
  const [editing, setEditing] = useState<User | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [mailOpen, setMailOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [usagePrefill, setUsagePrefill] = useState<string | undefined>(undefined)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [banning, setBanning] = useState<User | null>(null)

  const { data: plans } = useQuery({ queryKey: ['plans-brief'], queryFn: fetchPlans })

  const filter = useMemo<UserFilter[]>(() => {
    const f: UserFilter[] = []
    if (applied.email) f.push({ id: 'email', value: applied.email })
    if (applied.plan !== 'all')
      f.push({ id: 'plan_id', value: `eq:${applied.plan}` })
    if (applied.banned !== 'all')
      f.push({ id: 'banned', value: `eq:${applied.banned}` })
    return f
  }, [applied])

  const params = {
    current: page,
    pageSize: PAGE_SIZE,
    filter: filter.length ? filter : undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['users', params],
    queryFn: () => fetchUsers(params),
  })

  const total = data?.total ?? 0
  const rows = data?.data ?? []
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const applyFilters = () => {
    setApplied({
      email: emailInput.trim(),
      plan: planFilter,
      banned: bannedFilter,
    })
    setPage(1)
  }

  const resetMutation = useMutation({
    mutationFn: (id: number) => resetSecret(id),
    onSuccess: () => {
      toast.success('订阅已重置')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const banMutation = useMutation({
    mutationFn: (id: number) => banUsers({ scope: 'selected', user_ids: [id] }),
    onSuccess: () => {
      toast.success('已封禁')
      setBanning(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => destroyUser(id),
    onSuccess: () => {
      toast.success('已删除')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const exportCSV = async () => {
    try {
      const res = await adminApi.post(
        '/user/dumpCSV',
        { scope: filter.length ? 'filtered' : 'all', filter: filter.length ? filter : undefined },
        { responseType: 'blob' }
      )
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users_${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      handleServerError(e)
    }
  }

  const openUsageForUser = (u: User) => {
    setUsagePrefill(u.email)
    setUsageOpen(true)
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
            <h2 className='text-2xl font-bold tracking-tight'>用户管理</h2>
            <p className='text-muted-foreground'>管理用户套餐、流量、余额与订阅。</p>
          </div>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              onClick={() => {
                setUsagePrefill(undefined)
                setUsageOpen(true)
              }}
            >
              <ScrollText className='size-4' /> 使用记录
            </Button>
            <Button variant='outline' onClick={() => setMailOpen(true)}>
              <Mail className='size-4' /> 群发邮件
            </Button>
            <Button variant='outline' onClick={exportCSV}>
              <Download className='size-4' /> 导出CSV
            </Button>
            <Button onClick={() => setGenerateOpen(true)}>
              <Plus className='size-4' /> 生成用户
            </Button>
          </div>
        </div>

        {/* 筛选条 */}
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            className='h-9 w-56'
            placeholder='邮箱（模糊）'
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className='h-9 w-40'>
              <SelectValue placeholder='套餐' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>全部套餐</SelectItem>
              {plans?.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bannedFilter} onValueChange={setBannedFilter}>
            <SelectTrigger className='h-9 w-32'>
              <SelectValue placeholder='状态' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>全部状态</SelectItem>
              <SelectItem value='0'>正常</SelectItem>
              <SelectItem value='1'>已封禁</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={applyFilters}>
            <Search className='size-4' /> 查询
          </Button>
        </div>

        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>到期</TableHead>
                <TableHead>流量(已用/总)</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className='w-24 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.id}</TableCell>
                    <TableCell className='font-medium'>{u.email}</TableCell>
                    <TableCell>
                      {u.plan?.name ?? (
                        <span className='text-muted-foreground'>无</span>
                      )}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {formatExpire(u.expired_at)}
                    </TableCell>
                    <TableCell className='whitespace-nowrap text-sm'>
                      {formatBytes((u.u ?? 0) + (u.d ?? 0))} /{' '}
                      {formatBytes(u.transfer_enable)}
                    </TableCell>
                    <TableCell>{formatMoney(u.balance)}</TableCell>
                    <TableCell>
                      {u.banned ? (
                        <Badge variant='destructive'>已封禁</Badge>
                      ) : (
                        <Badge variant='secondary'>正常</Badge>
                      )}
                    </TableCell>
                    <TableCell className='text-end'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='icon'>
                            <MoreHorizontal className='size-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(u)
                              setEditOpen(true)
                            }}
                          >
                            <Pencil className='size-4' /> 编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openUsageForUser(u)}>
                            <ScrollText className='size-4' /> 使用记录
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => resetMutation.mutate(u.id)}
                          >
                            <KeyRound className='size-4' /> 重置订阅
                          </DropdownMenuItem>
                          {!u.banned && (
                            <DropdownMenuItem onClick={() => setBanning(u)}>
                              <Ban className='size-4' /> 封禁
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className='text-destructive'
                            onClick={() => setDeleting(u)}
                          >
                            <Trash2 className='size-4' /> 删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className='h-24 text-center'>
                    暂无用户
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <div className='flex items-center gap-3 text-sm'>
          <span className='text-muted-foreground'>共 {total} 个用户</span>
          <div className='ms-auto flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <span>
              {page} / {maxPage}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= maxPage}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      </Main>

      <UserEditDialog open={editOpen} onOpenChange={setEditOpen} current={editing} />
      <UserGenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
      <UserSendMailDialog
        open={mailOpen}
        onOpenChange={setMailOpen}
        filter={filter}
      />
      <UsageRecordsDialog
        open={usageOpen}
        onOpenChange={setUsageOpen}
        prefillKeyword={usagePrefill}
      />

      <ConfirmDialog
        open={!!banning}
        onOpenChange={(o) => !o && setBanning(null)}
        title='封禁用户'
        desc={`确定封禁用户「${banning?.email}」吗？将强制其下线。`}
        confirmText='封禁'
        destructive
        isLoading={banMutation.isPending}
        handleConfirm={() => banning && banMutation.mutate(banning.id)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='删除用户'
        desc={`确定删除用户「${deleting?.email}」吗？将同时删除其订单、工单等关联数据，不可撤销。`}
        confirmText='删除'
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </>
  )
}
