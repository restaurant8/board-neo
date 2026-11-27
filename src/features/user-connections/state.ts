/**
 * 计算限速弹窗的会话标识：仅在弹窗打开且目标用户 ID 变化时切换会话，
 * 同一用户的轮询刷新保持相同会话标识，不覆盖正在编辑的输入值。
 */
export function resolveSpeedDialogSessionKey(
  open: boolean,
  row: { user_id: number } | null
): string | null {
  return open && row ? String(row.user_id) : null
}

/**
 * 计算限速弹窗打开时的默认输入值。
 */
export function resolveInitialSpeedInput(
  row: { speed_limit: number | null } | null
): string {
  return row?.speed_limit != null && row.speed_limit > 0
    ? String(row.speed_limit)
    : '10'
}

export interface UrlSearchSnapshot {
  keyword: string | undefined
  serverId: number | undefined
}

/**
 * 协调 URL 查询参数向本地筛选状态的单向同步：
 * 仅当某个字段在 URL 中实际发生变化且为非 undefined 时才覆盖本地状态，
 * 避免某一字段清空（如 IP 反查清除 URL keyword）误触发另一字段回写，
 * 也避免异步 navigate 完成前误把旧 URL 关键词写回。
 */
export function reconcileUrlSearchSync(
  syncedSearch: UrlSearchSnapshot,
  urlSearch: UrlSearchSnapshot
): {
  changed: boolean
  nextSyncedSearch: UrlSearchSnapshot
  applyKeyword?: string
  applyServerId?: string
} {
  const keywordChanged = syncedSearch.keyword !== urlSearch.keyword
  const serverIdChanged = syncedSearch.serverId !== urlSearch.serverId
  if (!keywordChanged && !serverIdChanged) {
    return { changed: false, nextSyncedSearch: syncedSearch }
  }

  return {
    changed: true,
    nextSyncedSearch: {
      keyword: urlSearch.keyword,
      serverId: urlSearch.serverId,
    },
    applyKeyword:
      keywordChanged && urlSearch.keyword !== undefined
        ? urlSearch.keyword
        : undefined,
    applyServerId:
      serverIdChanged && urlSearch.serverId !== undefined
        ? String(urlSearch.serverId)
        : undefined,
  }
}

/**
 * 生成精确客户端 IP 反查后的筛选状态：清空用户关键词与页码，确保展示共用该 IP 的全部在线账号。
 */
export function buildExactIpFilterState(ip: string): {
  page: number
  keywordInput: string
  appliedKeyword: string
  exactIp: string
} {
  return {
    page: 1,
    keywordInput: '',
    appliedKeyword: '',
    exactIp: ip,
  }
}

/**
 * 调和取证抽屉的实时行与保留快照：
 * - 当前分页存在该用户时，更新为最新实时行并标记在线可见；
 * - 用户离线或移出当前分页时，保留最后快照不关闭抽屉，并标记实时列表中已不可见。
 */
export function reconcileDetailSnapshot<T extends { user_id: number }>(
  snapshot: T | null,
  rows: readonly T[],
  hasLoadedData: boolean
): {
  activeRow: T | null
  nextSnapshot: T | null
  isRealtimePresent: boolean
} {
  if (!snapshot) {
    return {
      activeRow: null,
      nextSnapshot: null,
      isRealtimePresent: true,
    }
  }

  const liveRow = rows.find((r) => r.user_id === snapshot.user_id) ?? null
  if (liveRow) {
    return {
      activeRow: liveRow,
      nextSnapshot: liveRow,
      isRealtimePresent: true,
    }
  }

  return {
    activeRow: snapshot,
    nextSnapshot: snapshot,
    isRealtimePresent: !hasLoadedData,
  }
}
