import type { Server, ServerSavePayload } from './api'

export type RateRangeInput = { start: string; end: string; rate: string }

export type NodeRateSettings = {
  mode: 'static' | 'dynamic'
  rate: number
  ranges: Array<{ start: string; end: string; rate: number }>
}

export type NodeRateFailure = { id: number; name: string; message: string }

export type BatchNodeRateResult = {
  succeededIds: number[]
  failures: NodeRateFailure[]
}

export function validateNodeRateSettings(
  mode: NodeRateSettings['mode'] | null,
  rate: string,
  ranges: RateRangeInput[]
): { settings: NodeRateSettings | null; error: string | null } {
  const invalid = (error: string) => ({ settings: null, error })
  const validRate = (value: string) =>
    value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0

  if (!mode) return invalid('请选择静态倍率或动态倍率')
  if (!validRate(rate)) return invalid('请输入大于或等于 0 的有效基础倍率')
  // v2_server.rate is DECIMAL(8, 2); do not let the database silently round
  // small positive rates to zero. Dynamic range rates are stored separately in JSON.
  if (
    Number(rate) > 999999.99 ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(Number(rate)))
  ) {
    return invalid('基础倍率不能超过 999999.99，且最多保留两位小数')
  }
  if (mode === 'static') {
    return { settings: { mode, rate: Number(rate), ranges: [] }, error: null }
  }
  if (ranges.length === 0) return invalid('动态倍率至少需要一个时间段')

  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
  for (const [index, range] of ranges.entries()) {
    if (!timePattern.test(range.start) || !timePattern.test(range.end)) {
      return invalid(`规则 ${index + 1}：请输入完整的开始和结束时间`)
    }
    if (range.start > range.end) {
      return invalid(
        `规则 ${index + 1}：结束时间不能早于开始时间，跨午夜请拆成两条规则`
      )
    }
    if (!validRate(range.rate)) {
      return invalid(`规则 ${index + 1}：请输入大于或等于 0 的有效时段倍率`)
    }
    // Server::getCurrentRate includes both endpoints and uses the first match.
    const overlapping = ranges
      .slice(0, index)
      .findIndex(
        (previous) => range.start <= previous.end && range.end >= previous.start
      )
    if (overlapping !== -1) {
      return invalid(
        `规则 ${overlapping + 1} 与规则 ${index + 1} 时间重叠（起止分钟均生效）`
      )
    }
  }

  return {
    settings: {
      mode,
      rate: Number(rate),
      ranges: ranges.map((range) => ({ ...range, rate: Number(range.rate) })),
    },
    error: null,
  }
}

export function nodeRateSavePayload(
  node: Server,
  settings: NodeRateSettings
): ServerSavePayload {
  if (node.server_port == null) {
    throw new Error('节点缺少服务端口，请先在节点编辑中补全后重试')
  }
  // /save requires these base and protocol fields. Omit all other fields so
  // unrelated groups, certificates, traffic limits and DNS settings stay intact.
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    host: node.host,
    port: node.port,
    server_port: node.server_port,
    protocol_settings: node.protocol_settings ?? {},
    rate: settings.rate,
    rate_time_enable: settings.mode === 'dynamic',
    rate_time_ranges: settings.mode === 'dynamic' ? settings.ranges : [],
  }
}

/** Use the existing save contract; batchUpdate does not accept rate fields. */
export async function updateNodeRates(
  ids: number[],
  settings: NodeRateSettings,
  api: {
    getNodes: () => Promise<Server[]>
    saveNode: (payload: ServerSavePayload) => Promise<boolean>
  }
): Promise<BatchNodeRateResult> {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) throw new Error('请选择需要修改倍率的节点')
  const validation = validateNodeRateSettings(
    settings.mode,
    String(settings.rate),
    settings.ranges.map((range) => ({ ...range, rate: String(range.rate) }))
  )
  if (!validation.settings) throw new Error(validation.error ?? '倍率配置无效')
  const normalizedSettings = validation.settings
  // Refresh before writing rather than reusing the table's potentially stale data.
  const nodes = new Map((await api.getNodes()).map((node) => [node.id, node]))
  const outcomes: Array<{ id: number; failure?: NodeRateFailure }> = []
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < uniqueIds.length) {
      const index = nextIndex++
      const id = uniqueIds[index]
      const node = nodes.get(id)
      try {
        if (!node) throw new Error('节点已不存在或无权访问，请刷新列表')
        const saved = await api.saveNode(
          nodeRateSavePayload(node, normalizedSettings)
        )
        if (saved !== true)
          throw new Error('服务器未确认保存成功，请刷新核对后重试')
        outcomes[index] = { id }
      } catch (error) {
        outcomes[index] = {
          id,
          failure: {
            id,
            name: node?.name ?? `节点 #${id}`,
            message:
              error instanceof Error ? error.message : '保存失败，请稍后重试',
          },
        }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(3, uniqueIds.length) }, worker)
  )
  return {
    succeededIds: outcomes
      .filter((outcome) => !outcome.failure)
      .map(({ id }) => id),
    failures: outcomes.flatMap((outcome) =>
      outcome.failure ? [outcome.failure] : []
    ),
  }
}
