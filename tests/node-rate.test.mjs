import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import {
  nodeRateSavePayload,
  updateNodeRates,
  validateNodeRateSettings,
} from '../src/features/server-manage/rate.ts'

const staticSettings = { mode: 'static', rate: 2, ranges: [] }
const dynamicSettings = {
  mode: 'dynamic',
  rate: 2,
  ranges: [{ start: '09:00', end: '12:00', rate: 0.5 }],
}

function node(id, overrides = {}) {
  return {
    id,
    type: 'vmess',
    name: `Node ${id}`,
    host: `node-${id}.example.com`,
    port: '443',
    server_port: 8443,
    protocol_settings: { tls: 1, network: 'tcp' },
    rate: 1,
    rate_time_enable: false,
    rate_time_ranges: [],
    group_ids: [7],
    route_ids: [8],
    parent_id: 9,
    cert_config: { provider: 'cert_push' },
    dns_auto_sync: true,
    transfer_enable: 1024,
    show: true,
    enabled: true,
    ...overrides,
  }
}

test('静态倍率允许 0，切换静态时不再使用旧动态规则', () => {
  const result = validateNodeRateSettings('static', '0', [
    { start: '', end: '', rate: '' },
  ])
  assert.deepEqual(result, {
    settings: { mode: 'static', rate: 0, ranges: [] },
    error: null,
  })

  const payload = nodeRateSavePayload(
    node(1, {
      rate_time_enable: true,
      rate_time_ranges: dynamicSettings.ranges,
    }),
    result.settings
  )
  assert.equal(payload.rate, 0)
  assert.equal(payload.rate_time_enable, false)
  assert.deepEqual(payload.rate_time_ranges, [])
})

test('动态规则使用独立绝对倍率并允许免费时段', () => {
  const result = validateNodeRateSettings('dynamic', '2', [
    { start: '09:00', end: '12:00', rate: '0.5' },
    { start: '12:01', end: '23:59', rate: '0' },
  ])
  assert.equal(result.error, null)
  const payload = nodeRateSavePayload(node(1), result.settings)
  assert.equal(payload.rate, 2)
  assert.equal(payload.rate_time_enable, true)
  assert.deepEqual(payload.rate_time_ranges, [
    { start: '09:00', end: '12:00', rate: 0.5 },
    { start: '12:01', end: '23:59', rate: 0 },
  ])
})

test('必须选择模式，动态模式必须有规则', () => {
  for (const args of [
    [null, '1', []],
    ['dynamic', '1', []],
  ]) {
    const result = validateNodeRateSettings(...args)
    assert.equal(result.settings, null)
    assert.ok(result.error)
  }
})

test('基础与时段倍率都拒绝空值、负值和非有限数', () => {
  for (const rate of ['', ' ', '-0.1', 'Infinity', 'NaN', '1e309']) {
    assert.equal(
      validateNodeRateSettings('static', rate, []).settings,
      null,
      `基础倍率 ${JSON.stringify(rate)} 应无效`
    )
    assert.equal(
      validateNodeRateSettings('dynamic', '1', [
        { start: '00:00', end: '23:59', rate },
      ]).settings,
      null,
      `时段倍率 ${JSON.stringify(rate)} 应无效`
    )
  }
})

test('基础倍率符合 DECIMAL(8,2) 边界，动态时段仍支持更小的小数', () => {
  const ranges = [{ start: '00:00', end: '23:59', rate: '0.001' }]
  for (const mode of ['static', 'dynamic']) {
    for (const rate of ['0.001', '1.234', '1000000']) {
      assert.equal(
        validateNodeRateSettings(mode, rate, ranges).settings,
        null,
        `${mode} 基础倍率 ${rate} 应被拒绝`
      )
    }
    for (const rate of ['999999.99', '0.01', '1.2300']) {
      const result = validateNodeRateSettings(mode, rate, ranges)
      assert.equal(result.error, null, `${mode} 基础倍率 ${rate} 应合法`)
      assert.equal(result.settings.rate, Number(rate))
      if (mode === 'dynamic') {
        assert.equal(result.settings.ranges[0].rate, 0.001)
      }
    }
  }
})

test('动态规则要求完整 HH:mm 时间并拒绝跨午夜区间', () => {
  for (const [start, end] of [
    ['', '12:00'],
    ['9:00', '12:00'],
    ['09:00', '24:00'],
    ['09:60', '12:00'],
    ['09:00:00', '12:00'],
    ['23:00', '01:00'],
  ]) {
    const result = validateNodeRateSettings('dynamic', '1', [
      { start, end, rate: '1' },
    ])
    assert.equal(result.settings, null, `${start}–${end} 应无效`)
    assert.ok(result.error)
  }
})

test('动态规则拒绝闭区间端点重叠与包含重叠，分钟相邻合法', () => {
  for (const ranges of [
    [
      { start: '09:00', end: '12:00', rate: '1' },
      { start: '12:00', end: '14:00', rate: '2' },
    ],
    [
      { start: '10:00', end: '11:00', rate: '1' },
      { start: '09:00', end: '12:00', rate: '2' },
    ],
  ]) {
    assert.equal(
      validateNodeRateSettings('dynamic', '1', ranges).settings,
      null
    )
  }

  const adjacent = validateNodeRateSettings('dynamic', '1', [
    { start: '12:01', end: '23:59', rate: '2' },
    { start: '00:00', end: '12:00', rate: '1' },
  ])
  assert.equal(adjacent.error, null)
  assert.equal(adjacent.settings.ranges.length, 2)
})

test('保存仅提交倍率与后端必填字段，并保留完整协议配置', () => {
  const original = node(1, {
    protocol_settings: {
      tls: 1,
      network: 'ws',
      network_settings: { path: '/connect', headers: { Host: 'edge.example' } },
      tls_settings: { ech: { enabled: true, key: 'existing-key' } },
    },
  })
  const before = structuredClone(original)
  const payload = nodeRateSavePayload(original, dynamicSettings)
  assert.deepEqual(payload, {
    id: 1,
    type: 'vmess',
    name: 'Node 1',
    host: 'node-1.example.com',
    port: '443',
    server_port: 8443,
    protocol_settings: before.protocol_settings,
    rate: 2,
    rate_time_enable: true,
    rate_time_ranges: [{ start: '09:00', end: '12:00', rate: 0.5 }],
  })
  assert.deepEqual(original, before)
})

test('批量保存先刷新快照，只更新选中节点且去重', async () => {
  let reads = 0
  const writes = []
  const latest = node(2, {
    name: 'Updated node',
    host: 'latest.example.com',
    protocol_settings: { tls: 0, network: 'ws' },
  })
  const result = await updateNodeRates([2, 1, 2], staticSettings, {
    getNodes: async () => {
      reads += 1
      return [node(1), latest, node(3)]
    },
    saveNode: async (payload) => {
      assert.equal(reads, 1)
      writes.push(payload)
      return true
    },
  })

  assert.equal(reads, 1)
  assert.deepEqual(writes.map((payload) => payload.id).sort(), [1, 2])
  const savedLatest = writes.find((payload) => payload.id === 2)
  assert.equal(savedLatest.name, latest.name)
  assert.equal(savedLatest.host, latest.host)
  assert.deepEqual(savedLatest.protocol_settings, latest.protocol_settings)
  assert.deepEqual(result, { succeededIds: [2, 1], failures: [] })
})

test('批量保存最多并发三个请求且完成全部选中节点', async () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8]
  let inFlight = 0
  let peak = 0
  const result = await updateNodeRates(ids, staticSettings, {
    getNodes: async () => ids.map((id) => node(id)),
    saveNode: async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await setImmediate()
      inFlight -= 1
      return true
    },
  })
  assert.equal(peak, 3)
  assert.equal(inFlight, 0)
  assert.deepEqual(result, { succeededIds: ids, failures: [] })
})

test('部分失败保留成功结果，区分服务端拒绝、异常与缺失节点数据', async () => {
  const attempted = []
  const result = await updateNodeRates([1, 2, 3, 4, 5, 6], dynamicSettings, {
    getNodes: async () => [
      node(1),
      node(2),
      node(3),
      node(4, { server_port: null }),
      node(6),
    ],
    saveNode: async (payload) => {
      attempted.push(payload.id)
      if (payload.id === 2) return false
      if (payload.id === 3) throw new Error('Request failed')
      return true
    },
  })

  assert.deepEqual(attempted.sort(), [1, 2, 3, 6])
  assert.deepEqual(result.succeededIds, [1, 6])
  assert.deepEqual(result.failures.map((failure) => failure.id), [2, 3, 4, 5])
  assert.match(result.failures[0].message, /未确认保存成功/)
  assert.equal(result.failures[1].message, 'Request failed')
  assert.match(result.failures[2].message, /服务端口/)
  assert.match(result.failures[3].message, /不存在|无权访问/)
  assert.equal(result.failures[2].name, 'Node 4')
  assert.equal(result.failures[3].name, '节点 #5')
})

test('全局刷新失败时不执行任何写入', async () => {
  let writes = 0
  await assert.rejects(
    updateNodeRates([1], staticSettings, {
      getNodes: async () => {
        throw new Error('Refresh failed')
      },
      saveNode: async () => {
        writes += 1
        return true
      },
    }),
    /Refresh failed/
  )
  assert.equal(writes, 0)
})

test('零选择和无效设置在发送请求前失败', async () => {
  let requests = 0
  const api = {
    getNodes: async () => {
      requests += 1
      return [node(1)]
    },
    saveNode: async () => {
      requests += 1
      return true
    },
  }
  for (const [ids, settings] of [
    [[], staticSettings],
    [[1], { ...staticSettings, rate: -1 }],
    [[1], { ...staticSettings, rate: Infinity }],
    [[1], { ...dynamicSettings, ranges: [] }],
  ]) {
    await assert.rejects(updateNodeRates(ids, settings, api))
  }
  assert.equal(requests, 0)
})
