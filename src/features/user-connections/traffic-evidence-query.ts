import type { UserAuditParams, UserAuditResult } from '../traffic-stat/api'

export function userTrafficEvidenceQueryOptions(
  userId: number,
  days: number,
  fetchAudit: (params: UserAuditParams) => Promise<UserAuditResult>,
  now: () => Date = () => new Date()
) {
  // 请求实现和时钟不属于数据身份；每次执行 queryFn 时都读取最新时间。
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return {
    queryKey: ['conn-evidence-audit', userId, days] as const,
    queryFn: () => {
      // 每次请求都重算起点；截止时间由后端取当前时间，刷新不会被旧时间截断。
      const start = new Date(now())
      start.setHours(0, 0, 0, 0)
      if (days > 0) start.setDate(start.getDate() - (days - 1))
      return fetchAudit({
        user_id: userId,
        start_time: Math.floor(start.getTime() / 1000),
        mode: 'diagnostic',
        group_by: 'detail',
        with_filters: 0,
        order_by: 'total',
        order_dir: 'desc',
        page: 1,
        page_size: 30,
      })
    },
    staleTime: 30_000,
  }
}
