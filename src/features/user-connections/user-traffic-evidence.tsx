import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Globe,
  RefreshCw,
} from 'lucide-react'
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
import { formatBytes as formatStatBytes } from '@/features/dashboard/format'
import { fetchUserTrafficAudit } from '@/features/traffic-stat/api'
import { fetchUserTraffic } from '@/features/user/api'
import { formatBytes, formatTimestamp } from '@/features/user/format'
import { userTrafficEvidenceQueryOptions } from './traffic-evidence-query'

const RANGES = [
  { label: '今日', days: 0 },
  { label: '近 7 天', days: 7 },
  { label: '近 30 天', days: 30 },
] as const

/**
 * 单用户流量与访问去向取证面板（内嵌于「连接与风控」取证抽屉）：
 * - 上半部分 / 子视角 1：目的地与主域名审计（`getUserTrafficAudit`，判断是否 BT / 爬虫 / 异常下载）
 * - 子视角 2：近期日流量消耗记录（`getStatUser`，核对突发流量）
 */
export function UserTrafficEvidence({
  userId,
  userEmail,
  active,
  onNavigateAway,
}: {
  userId: number
  userEmail: string
  active: boolean
  onNavigateAway?: () => void
}) {
  const navigate = useNavigate()
  const [subView, setSubView] = useState<'audit' | 'daily'>('audit')
  const [days, setDays] = useState<number>(7)

  const auditQuery = useQuery({
    ...userTrafficEvidenceQueryOptions(userId, days, fetchUserTrafficAudit),
    enabled: active && subView === 'audit',
  })

  const dailyQuery = useQuery({
    queryKey: ['conn-evidence-daily', userId],
    queryFn: () => fetchUserTraffic(userId, 1, 20),
    enabled: active && subView === 'daily',
    staleTime: 30_000,
  })

  if (!active) return null

  const auditRows = auditQuery.data?.list ?? []
  const auditSummary = auditQuery.data?.summary
  const dailyRows = dailyQuery.data?.data ?? []

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-1.5'>
          <Button
            size='sm'
            variant={subView === 'audit' ? 'secondary' : 'ghost'}
            onClick={() => setSubView('audit')}
          >
            访问目的地 / 域名 Top 30
          </Button>
          <Button
            size='sm'
            variant={subView === 'daily' ? 'secondary' : 'ghost'}
            onClick={() => setSubView('daily')}
          >
            近期每日流量记录
          </Button>
        </div>

        <div className='flex flex-wrap items-center gap-1.5'>
          {subView === 'audit' && (
            <div className='flex items-center gap-1'>
              {RANGES.map((r) => (
                <Button
                  key={r.days}
                  size='sm'
                  variant={days === r.days ? 'default' : 'outline'}
                  className='h-7 px-2 text-xs'
                  onClick={() => setDays(r.days)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          )}
          <Button
            size='sm'
            variant='outline'
            className='h-7 px-2 text-xs'
            onClick={() =>
              subView === 'audit' ? auditQuery.refetch() : dailyQuery.refetch()
            }
          >
            <RefreshCw className='size-3.5' />
            刷新
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='h-7 px-2 text-xs'
            onClick={() => {
              onNavigateAway?.()
              navigate({
                to: '/traffic-stat',
                search: { tab: 'audit', user: userEmail || String(userId) },
              })
            }}
          >
            <ExternalLink className='size-3.5' />
            完整流量审计
          </Button>
        </div>
      </div>

      {subView === 'audit' ? (
        <>
          {auditSummary && (
            <div className='flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs'>
              <span className='text-muted-foreground'>区间流量汇总：</span>
              <span className='font-mono'>
                上行 {formatStatBytes(auditSummary.u)}
              </span>
              <span className='font-mono'>
                下行 {formatStatBytes(auditSummary.d)}
              </span>
              <span className='font-mono font-semibold text-foreground'>
                总计 {formatStatBytes(auditSummary.total)}
              </span>
            </div>
          )}

          <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
            <Table>
              <TableHeader className='sticky top-0 z-10 bg-background'>
                <TableRow>
                  <TableHead>目的地 / 主域名</TableHead>
                  <TableHead>类别 / 协议</TableHead>
                  <TableHead>源 IP / 节点</TableHead>
                  <TableHead className='text-right'>上行 / 下行</TableHead>
                  <TableHead className='text-right'>总流量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditQuery.isFetching ? (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>
                      加载目的地审计数据中...
                    </TableCell>
                  </TableRow>
                ) : auditQuery.isError ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='h-24 text-center text-xs text-muted-foreground'
                    >
                      暂无流量审计数据（需在「系统配置 → 服务器 → 流量统计模式」开启授权诊断模式）。
                    </TableCell>
                  </TableRow>
                ) : auditRows.length > 0 ? (
                  auditRows.map((r, idx) => (
                    <TableRow
                      key={`${r.server_id}-${r.source_ip}-${r.destination}-${r.destination_port}-${idx}`}
                    >
                      <TableCell className='max-w-[240px]'>
                        <div
                          className='flex items-center gap-1.5 truncate font-mono text-xs font-medium'
                          title={r.destination || r.main_domain}
                        >
                          <Globe className='size-3 shrink-0 text-muted-foreground' />
                          <span className='truncate'>
                            {r.destination || r.main_domain || '—'}
                          </span>
                          {r.destination_port > 0 && (
                            <span className='text-muted-foreground'>
                              :{r.destination_port}
                            </span>
                          )}
                        </div>
                        {r.main_domain && r.main_domain !== r.destination && (
                          <div className='truncate text-[11px] text-muted-foreground'>
                            主域名：{r.main_domain}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        <div className='flex items-center gap-1'>
                          {r.category && (
                            <Badge variant='secondary' className='text-[11px]'>
                              {r.category}
                            </Badge>
                          )}
                          {r.network && (
                            <Badge
                              variant='outline'
                              className='font-mono text-[10px] uppercase'
                            >
                              {r.network}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        <div className='font-mono text-xs'>
                          {r.source_ip || '—'}
                        </div>
                        <div className='max-w-[140px] truncate text-[11px] text-muted-foreground'>
                          {r.server_name || `Node #${r.server_id}`}
                        </div>
                      </TableCell>
                      <TableCell className='text-right font-mono text-xs whitespace-nowrap'>
                        <div className='text-emerald-600 dark:text-emerald-400'>
                          ↑ {formatStatBytes(r.u)}
                        </div>
                        <div className='text-blue-600 dark:text-blue-400'>
                          ↓ {formatStatBytes(r.d)}
                        </div>
                      </TableCell>
                      <TableCell className='text-right font-mono text-xs font-semibold whitespace-nowrap'>
                        <div>{formatStatBytes(r.total)}</div>
                        <div className='text-[11px] font-normal text-muted-foreground'>
                          {r.report_count} 次上报
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='h-24 text-center text-xs text-muted-foreground'
                    >
                      该时间范围内暂无目的地审计记录（仅在开启「授权诊断」模式后采集）
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
          <Table>
            <TableHeader className='sticky top-0 z-10 bg-background'>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>上行流量</TableHead>
                <TableHead>下行流量</TableHead>
                <TableHead>倍率</TableHead>
                <TableHead>计费总计</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyQuery.isFetching ? (
                <TableRow>
                  <TableCell colSpan={5} className='h-24 text-center'>
                    加载流量记录中...
                  </TableCell>
                </TableRow>
              ) : dailyQuery.isError ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='h-24 text-center text-xs text-muted-foreground'
                  >
                    加载流量记录失败，请点击刷新重试。
                  </TableCell>
                </TableRow>
              ) : dailyRows.length > 0 ? (
                dailyRows.map((r) => {
                  const rate = parseFloat(String(r.server_rate)) || 1
                  return (
                    <TableRow key={r.id}>
                      <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
                        {formatTimestamp(r.record_at)}
                      </TableCell>
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        <ArrowUp className='mr-1 inline size-3 text-emerald-500' />
                        {formatBytes((r.u ?? 0) / rate)}
                      </TableCell>
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        <ArrowDown className='mr-1 inline size-3 text-blue-500' />
                        {formatBytes((r.d ?? 0) / rate)}
                      </TableCell>
                      <TableCell className='font-mono text-xs whitespace-nowrap'>
                        {rate}x
                      </TableCell>
                      <TableCell className='font-mono text-xs font-medium whitespace-nowrap'>
                        {formatBytes((r.u ?? 0) + (r.d ?? 0))}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='h-24 text-center text-xs text-muted-foreground'
                  >
                    暂无流量记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
