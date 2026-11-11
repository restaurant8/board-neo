import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UserEmailLink } from '@/components/user-email-link'
import { SimplePagination } from '@/features/gift-card/components/simple-pagination'
import {
  type BalanceLog,
  type BalanceLogAccount,
  type User,
  fetchBalanceLogs,
} from '../api'
import { formatTimestamp } from '../format'

const ACCOUNT_TABS: { value: BalanceLogAccount | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'balance', label: '余额' },
  { value: 'commission', label: '佣金' },
]

const ACCOUNT_LABEL: Record<BalanceLogAccount, string> = {
  balance: '余额',
  commission: '佣金',
}

/** 变动来源文案，对齐后端 UserBalanceLog::TYPE_*。 */
const TYPE_LABEL: Record<string, string> = {
  order_pay: '余额支付订单',
  order_cancel: '订单取消退回',
  surplus_credit: '换购折抵返还',
  commission: '邀请返佣',
  transfer_out: '佣金划转到余额',
  transfer_in: '佣金划转入余额',
  gift_card: '礼品卡兑换',
  gift_card_invite: '下级兑换礼品卡奖励',
  admin: '后台手动调整',
  reseller_deposit: '分销申请押金',
  reseller_profit: '分销利润入账',
  reseller_refund: '分销退款扣回',
  other: '其他',
}

const yuan = (cents: number) => (cents / 100).toFixed(2)

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  /** 打开时默认筛选的账户（点余额/佣金单元格进入时带上）。 */
  initialAccount?: BalanceLogAccount | ''
}

export function UserBalanceLogDialog({
  open,
  onOpenChange,
  user,
  initialAccount = '',
}: Props) {
  const [account, setAccount] = useState<BalanceLogAccount | ''>(initialAccount)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 每次为某个用户打开时回到入口指定的账户和第一页（渲染期间同步，避免 effect 里 setState）
  const openKey = open && user ? `${user.id}:${initialAccount}` : null
  const [prevOpenKey, setPrevOpenKey] = useState(openKey)
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (openKey) {
      setAccount(initialAccount)
      setPage(1)
    }
  }

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['user-balance-logs', user?.id, account, page, pageSize],
    queryFn: () =>
      fetchBalanceLogs({
        user_id: user!.id,
        account,
        page,
        page_size: pageSize,
      }),
    enabled: open && !!user,
    placeholderData: keepPreviousData,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[85dvh] max-h-[85dvh] w-[95vw] max-w-4xl flex-col gap-3 sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>资金记录</DialogTitle>
          <DialogDescription>
            {user?.email} · 当前余额 ¥{Number(user?.balance ?? 0).toFixed(2)} ·
            佣金 ¥{Number(user?.commission_balance ?? 0).toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className='flex items-center justify-between gap-2'>
          <div className='flex gap-1'>
            {ACCOUNT_TABS.map((t) => (
              <Button
                key={t.value || 'all'}
                size='sm'
                variant={account === t.value ? 'default' : 'outline'}
                onClick={() => {
                  setAccount(t.value)
                  setPage(1)
                }}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <Button
            size='sm'
            variant='outline'
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
            刷新
          </Button>
        </div>

        <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='whitespace-nowrap'>时间</TableHead>
                <TableHead className='whitespace-nowrap'>账户</TableHead>
                <TableHead className='whitespace-nowrap'>来源</TableHead>
                <TableHead className='text-right whitespace-nowrap'>
                  变动
                </TableHead>
                <TableHead className='text-right whitespace-nowrap'>
                  变动前 → 变动后
                </TableHead>
                <TableHead>关联</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='h-32 text-center text-muted-foreground'
                  >
                    {isFetching
                      ? '加载中…'
                      : '暂无记录（仅记录功能上线之后的资金变动）'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='font-mono text-xs whitespace-nowrap'>
                      {formatTimestamp(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.account === 'commission' ? 'secondary' : 'outline'
                        }
                      >
                        {ACCOUNT_LABEL[r.account] ?? r.account}
                      </Badge>
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {TYPE_LABEL[r.type] ?? r.type}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium whitespace-nowrap tabular-nums',
                        r.amount > 0 ? 'text-green-600' : 'text-destructive'
                      )}
                    >
                      {r.amount > 0 ? '+' : '-'}¥{yuan(Math.abs(r.amount))}
                    </TableCell>
                    <TableCell className='text-right whitespace-nowrap text-muted-foreground tabular-nums'>
                      {yuan(r.before)} → {yuan(r.after)}
                    </TableCell>
                    <TableCell className='text-xs'>
                      <LogRelation log={r} onNavigate={close} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <SimplePagination
          page={page}
          totalPages={maxPage}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

/** 关联信息：订单号（跳订单页）、关联用户、操作管理员、备注。 */
function LogRelation({
  log,
  onNavigate,
}: {
  log: BalanceLog
  onNavigate: () => void
}) {
  const parts: React.ReactNode[] = []
  if (log.trade_no) {
    parts.push(
      <div key='trade'>
        订单{' '}
        <Link
          to='/order'
          search={{ trade_no: log.trade_no }}
          onClick={onNavigate}
          className='font-mono break-all text-primary hover:underline'
        >
          {log.trade_no}
        </Link>
      </div>
    )
  }
  if (log.related_user_id) {
    parts.push(
      <div key='related'>
        来自{' '}
        <UserEmailLink
          email={log.related_user_email}
          fallback={`用户 #${log.related_user_id}`}
          onNavigate={onNavigate}
        />
      </div>
    )
  }
  if (log.operator_id) {
    parts.push(
      <div key='operator'>
        操作人 {log.operator_email ?? `#${log.operator_id}`}
      </div>
    )
  }
  if (log.remark) {
    parts.push(
      <div key='remark' className='break-all text-muted-foreground'>
        {log.remark}
      </div>
    )
  }
  return parts.length ? (
    <div className='space-y-0.5'>{parts}</div>
  ) : (
    <span className='text-muted-foreground'>—</span>
  )
}
