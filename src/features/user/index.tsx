import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronsUpDown,
  Download,
  FileText,
  Filter,
  KeyRound,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  ScrollText,
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  X,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api-client'
import { handleServerError } from '@/lib/handle-server-error'
import { SimplePagination } from '@/features/gift-card/components/simple-pagination'
import { Checkbox } from '@/components/ui/checkbox'
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
  type UserSort,
  banUsers,
  destroyUser,
  fetchPlans,
  fetchUsers,
  resetSecret,
  resetUserTraffic,
  updateUser,
} from './api'
import { UserEditDialog } from './components/user-edit-dialog'
import { UserGenerateDialog } from './components/user-generate-dialog'
import { UserSendMailDialog } from './components/user-send-mail-dialog'
import { UsageRecordsDialog } from './components/usage-records-dialog'
import { UserAssignOrderDialog } from './components/user-assign-order-dialog'
import { UserOrdersSheet } from './components/user-orders-sheet'
import { UserInvitesSheet } from './components/user-invites-sheet'
import { UserTrafficSheet } from './components/user-traffic-sheet'
import {
  UserAdvancedFilter,
  type FilterCondition,
} from './components/user-advanced-filter'
import {
  formatBytes,
  formatExpireStatus,
  formatMoney,
  formatOnlineStatus,
} from './format'

export function UserPage() {
  const queryClient = useQueryClient()

  // 快速搜索（邮箱）
  const [emailInput, setEmailInput] = useState('')
  const [appliedEmail, setAppliedEmail] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 高级筛选
  const [filterOpen, setFilterOpen] = useState(false)
  // 已应用的高级筛选条件（用于回显 + 生成 filter）
  const [conditions, setConditions] = useState<FilterCondition[]>([])
  // 由高级筛选条件生成的后端 filter 项
  const [advancedFilter, setAdvancedFilter] = useState<UserFilter[]>([])
  // 列排序：单列三态 none → asc → desc → none，驱动后端 sort 参数
  const [sort, setSort] = useState<UserSort[]>([])
  const toggleSort = (field: string) => {
    setPage(1)
    setSort((prev) => {
      const cur = prev[0]
      if (!cur || cur.id !== field) return [{ id: field, desc: false }]
      if (!cur.desc) return [{ id: field, desc: true }]
      return []
    })
  }
  const sortHead = (field: string, label: string, className?: string) => {
    const cur = sort[0]
    const icon =
      !cur || cur.id !== field ? (
        <ChevronsUpDown className='size-3.5 opacity-50' />
      ) : cur.desc ? (
        <ArrowDown className='size-3.5' />
      ) : (
        <ArrowUp className='size-3.5' />
      )
    return (
      <TableHead className={className}>
        <button
          type='button'
          onClick={() => toggleSort(field)}
          className='hover:text-foreground -ms-1 inline-flex items-center gap-1 rounded px-1'
        >
          {label}
          {icon}
        </button>
      </TableHead>
    )
  }

  // 多选（当前页选中的用户 id）
  const [selected, setSelected] = useState<number[]>([])

  // 弹窗状态
  const [editing, setEditing] = useState<User | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [mailOpen, setMailOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [usagePrefill, setUsagePrefill] = useState<string | undefined>(undefined)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [banning, setBanning] = useState<User | null>(null)
  // 行操作：分配订单 / TA的订单 / TA的邀请 / TA的流量记录 / 重置流量
  const [assignTarget, setAssignTarget] = useState<User | null>(null)
  const [ordersTarget, setOrdersTarget] = useState<User | null>(null)
  const [invitesTarget, setInvitesTarget] = useState<User | null>(null)
  const [trafficTarget, setTrafficTarget] = useState<User | null>(null)
  const [resetTrafficTarget, setResetTrafficTarget] = useState<User | null>(null)
  // 批量封禁范围：'selected' | 'filtered' | 'all'
  const [batchBanScope, setBatchBanScope] = useState<
    'selected' | 'filtered' | 'all' | null
  >(null)

  const { data: plans } = useQuery({ queryKey: ['plans-brief'], queryFn: fetchPlans })

  const filter = useMemo<UserFilter[]>(() => {
    const f: UserFilter[] = []
    if (appliedEmail) f.push({ id: 'email', value: `like:${appliedEmail}` })
    f.push(...advancedFilter)
    return f
  }, [appliedEmail, advancedFilter])

  const hasFilter = filter.length > 0

  const params = {
    current: page,
    pageSize,
    filter: hasFilter ? filter : undefined,
    sort: sort.length ? sort : undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['users', params],
    queryFn: () => fetchUsers(params),
  })

  const total = data?.total ?? 0
  const rows = data?.data ?? []
  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  const allOnPageSelected =
    rows.length > 0 && rows.every((u) => selected.includes(u.id))
  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      setSelected((s) => s.filter((id) => !rows.some((u) => u.id === id)))
    } else {
      setSelected((s) => [...new Set([...s, ...rows.map((u) => u.id)])])
    }
  }
  const toggleOne = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const applyQuickSearch = () => {
    setAppliedEmail(emailInput.trim())
    setSelected([])
    setPage(1)
  }

  // 应用高级筛选：保存条件与生成的 filter 项
  const applyAdvancedFilter = (
    f: UserFilter[],
    conds: FilterCondition[]
  ) => {
    setAdvancedFilter(f)
    setConditions(conds)
    setSelected([])
    setPage(1)
  }

  // 重置高级筛选
  const resetAdvancedFilter = () => {
    setAdvancedFilter([])
    setConditions([])
    setSelected([])
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

  const unbanMutation = useMutation({
    mutationFn: (id: number) => updateUser({ id, banned: false }),
    onSuccess: () => {
      toast.success('已解封')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const batchBanMutation = useMutation({
    mutationFn: (scope: 'selected' | 'filtered' | 'all') =>
      banUsers({
        scope,
        user_ids: scope === 'selected' ? selected : undefined,
        filter: scope === 'filtered' && hasFilter ? filter : undefined,
      }),
    onSuccess: () => {
      toast.success('批量封禁成功')
      setBatchBanScope(null)
      setSelected([])
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: handleServerError,
  })

  const resetTrafficMutation = useMutation({
    mutationFn: (id: number) => resetUserTraffic(id),
    onSuccess: () => {
      toast.success('流量已重置')
      setResetTrafficTarget(null)
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
      const scope =
        selected.length > 0 ? 'selected' : hasFilter ? 'filtered' : 'all'
      const res = await adminApi.post(
        '/user/dumpCSV',
        {
          scope,
          user_ids: scope === 'selected' ? selected : undefined,
          filter: scope === 'filtered' ? filter : undefined,
        },
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

  const copyUrl = (u: User) => {
    if (!u.subscribe_url) {
      toast.error('暂无订阅地址')
      return
    }
    navigator.clipboard
      .writeText(u.subscribe_url)
      .then(() => toast.success('订阅URL已复制'))
      .catch(() => toast.error('复制失败'))
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
            <p className='text-muted-foreground'>
              在这里可以管理用户，包括增加、删除、编辑、查询等操作。
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
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
              <Mail className='size-4' /> 发送邮件
            </Button>
            <Button variant='outline' onClick={exportCSV}>
              <Download className='size-4' /> 导出 CSV
            </Button>
            <Button onClick={() => setGenerateOpen(true)}>
              <Plus className='size-4' /> 创建用户
            </Button>
          </div>
        </div>

        {/* 搜索 + 高级筛选 */}
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            className='h-9 w-56'
            placeholder='搜索用户邮箱...'
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyQuickSearch()}
          />
          <Button onClick={applyQuickSearch}>
            <Search className='size-4' /> 查询
          </Button>
          <Button variant='outline' onClick={() => setFilterOpen(true)}>
            <Filter className='size-4' /> 高级筛选
            {conditions.length > 0 && (
              <Badge variant='secondary' className='ms-1'>
                {conditions.length}
              </Badge>
            )}
          </Button>
          {conditions.length > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={resetAdvancedFilter}
            >
              <X className='size-4' /> 清除筛选
            </Button>
          )}
        </div>

        {/* 批量操作栏 */}
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-muted-foreground text-sm'>
            已选择 {selected.length} 项
          </span>
          <Button
            variant='destructive'
            size='sm'
            disabled={selected.length === 0}
            onClick={() => setBatchBanScope('selected')}
          >
            <Ban className='size-4' /> 批量封禁（选中）
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={!hasFilter}
            onClick={() => setBatchBanScope('filtered')}
          >
            封禁筛选结果
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setBatchBanScope('all')}
          >
            封禁全部
          </Button>
          {selected.length > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setSelected([])}
            >
              清除选择
            </Button>
          )}
        </div>

        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-10'>
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={toggleAllOnPage}
                    aria-label='全选本页'
                  />
                </TableHead>
                {sortHead('id', 'ID', 'w-16')}
                <TableHead>用户 / 邮箱</TableHead>
                <TableHead>订阅</TableHead>
                <TableHead>权限组</TableHead>
                {sortHead('expired_at', '到期时间')}
                {sortHead('total_used', '已用 / 总流量')}
                {sortHead('balance', '余额')}
                {sortHead('commission_balance', '佣金')}
                {sortHead('online_count', '在线设备')}
                {sortHead('banned', '状态')}
                {sortHead('created_at', '注册时间')}
                <TableHead className='w-12 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((u) => {
                  const exp = formatExpireStatus(u.expired_at)
                  const on = formatOnlineStatus(u.t)
                  return (
                    <TableRow key={u.id} data-state={selected.includes(u.id) ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(u.id)}
                          onCheckedChange={() => toggleOne(u.id)}
                          aria-label={`选择 ${u.email}`}
                        />
                      </TableCell>
                      <TableCell>{u.id}</TableCell>
                      <TableCell className='font-medium'>
                        {u.email}
                        {!!u.is_admin && (
                          <Badge className='ms-1' variant='outline'>
                            管理员
                          </Badge>
                        )}
                        {!!u.is_staff && (
                          <Badge className='ms-1' variant='outline'>
                            员工
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.plan?.name ?? (
                          <span className='text-muted-foreground'>无</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.group?.name ?? (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        <span
                          className={
                            exp.expired ? 'text-destructive' : undefined
                          }
                        >
                          {exp.text}
                        </span>
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-sm'>
                        {formatBytes((u.u ?? 0) + (u.d ?? 0))} /{' '}
                        {formatBytes(u.transfer_enable)}
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        {formatMoney(u.balance)}
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        {formatMoney(u.commission_balance)}
                      </TableCell>
                      <TableCell title={on.text}>
                        {on.online ? (
                          <Badge variant='default'>
                            {u.online_count ?? 0}
                          </Badge>
                        ) : (
                          <span className='text-muted-foreground'>
                            {u.online_count ?? 0}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.banned ? (
                          <Badge variant='destructive'>封禁</Badge>
                        ) : (
                          <Badge variant='secondary'>正常</Badge>
                        )}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-sm text-muted-foreground'>
                        {new Date(u.created_at * 1000).toLocaleDateString()}
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
                            <DropdownMenuItem
                              onClick={() => setAssignTarget(u)}
                            >
                              <ShoppingCart className='size-4' /> 分配订单
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyUrl(u)}>
                              <Share2 className='size-4' /> 复制订阅URL
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => resetMutation.mutate(u.id)}
                            >
                              <KeyRound className='size-4' /> 重置UUID及订阅URL
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setOrdersTarget(u)}
                            >
                              <FileText className='size-4' /> TA的订单
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setInvitesTarget(u)}
                            >
                              <Users className='size-4' /> TA的邀请
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTrafficTarget(u)}
                            >
                              <ScrollText className='size-4' /> TA的流量记录
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openUsageForUser(u)}
                            >
                              <ScrollText className='size-4' /> 使用记录
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setResetTrafficTarget(u)}
                            >
                              <RefreshCcw className='size-4' /> 重置流量
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.banned ? (
                              <DropdownMenuItem
                                onClick={() => unbanMutation.mutate(u.id)}
                              >
                                <Ban className='size-4' /> 解封
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setBanning(u)}>
                                <Ban className='size-4' /> 封禁
                              </DropdownMenuItem>
                            )}
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
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={13} className='h-24 text-center'>
                    未找到结果
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <SimplePagination
          page={page}
          totalPages={maxPage}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          left={
            <>
              已选择 {selected.length} 项，共 {total} 个用户
            </>
          }
        />
      </Main>

      <UserAdvancedFilter
        open={filterOpen}
        onOpenChange={setFilterOpen}
        plans={plans}
        initial={conditions}
        onApply={applyAdvancedFilter}
        onReset={resetAdvancedFilter}
      />

      <UserEditDialog open={editOpen} onOpenChange={setEditOpen} current={editing} />
      <UserGenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
      <UserSendMailDialog
        open={mailOpen}
        onOpenChange={setMailOpen}
        filter={filter}
        selectedIds={selected}
      />
      <UsageRecordsDialog
        open={usageOpen}
        onOpenChange={setUsageOpen}
        prefillKeyword={usagePrefill}
      />

      <UserAssignOrderDialog
        open={!!assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        email={assignTarget?.email}
      />
      <UserOrdersSheet
        open={!!ordersTarget}
        onOpenChange={(o) => !o && setOrdersTarget(null)}
        user={ordersTarget}
      />
      <UserInvitesSheet
        open={!!invitesTarget}
        onOpenChange={(o) => !o && setInvitesTarget(null)}
        user={invitesTarget}
      />
      <UserTrafficSheet
        open={!!trafficTarget}
        onOpenChange={(o) => !o && setTrafficTarget(null)}
        user={trafficTarget}
      />

      <ConfirmDialog
        open={!!resetTrafficTarget}
        onOpenChange={(o) => !o && setResetTrafficTarget(null)}
        title='重置流量'
        desc={`确定重置用户「${resetTrafficTarget?.email}」的已用流量吗？该用户的已用流量将清零。`}
        confirmText='重置'
        destructive
        isLoading={resetTrafficMutation.isPending}
        handleConfirm={() =>
          resetTrafficTarget &&
          resetTrafficMutation.mutate(resetTrafficTarget.id)
        }
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
        open={!!batchBanScope}
        onOpenChange={(o) => !o && setBatchBanScope(null)}
        title='确认批量封禁'
        desc={
          batchBanScope === 'selected'
            ? `此操作将封禁选中的 ${selected.length} 个用户。此操作无法撤销。`
            : batchBanScope === 'filtered'
              ? '此操作将封禁所有符合当前筛选条件的用户。此操作无法撤销。'
              : '此操作将封禁系统中的所有用户。此操作无法撤销。'
        }
        confirmText='确认封禁'
        destructive
        isLoading={batchBanMutation.isPending}
        handleConfirm={() =>
          batchBanScope && batchBanMutation.mutate(batchBanScope)
        }
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title='确认删除用户'
        desc={`此操作将永久删除用户「${deleting?.email}」及其所有相关数据，包括订单、优惠码、流量记录、工单记录等信息。删除后无法恢复，是否继续？`}
        confirmText='删除'
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </>
  )
}
