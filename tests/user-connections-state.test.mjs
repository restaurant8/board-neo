import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  buildExactIpFilterState,
  reconcileDetailSnapshot,
  reconcileUrlSearchSync,
  resolveInitialSpeedInput,
  resolveSpeedDialogSessionKey,
} from '../src/features/user-connections/state.ts'

test('限速弹窗仅在打开或切换用户时更新会话标识，同一用户轮询刷新不重置输入', () => {
  const poll1 = { user_id: 42, speed_limit: 5 }
  const poll2 = { user_id: 42, speed_limit: 5 }
  const otherUser = { user_id: 99, speed_limit: null }

  assert.equal(resolveSpeedDialogSessionKey(false, poll1), null)
  assert.equal(resolveSpeedDialogSessionKey(true, poll1), '42')
  // 下一轮轮询返回全新对象引用但仍是同一用户，sessionKey 保持不变
  assert.equal(
    resolveSpeedDialogSessionKey(true, poll2),
    resolveSpeedDialogSessionKey(true, poll1)
  )
  // 切换至另一用户时 sessionKey 改变
  assert.equal(resolveSpeedDialogSessionKey(true, otherUser), '99')

  assert.equal(resolveInitialSpeedInput(poll1), '5')
  assert.equal(resolveInitialSpeedInput(otherUser), '10')
})

test('精确 IP 反查清空用户关键词并回到第一页，避免遗漏同 IP 共用账号', () => {
  const next = buildExactIpFilterState('203.0.113.99')
  assert.deepEqual(next, {
    page: 1,
    keywordInput: '',
    appliedKeyword: '',
    exactIp: '203.0.113.99',
  })
})

test('真实点击 IP 反查流程：异步清除 URL 期间与清除完成后均不回写旧用户关键词，共用账号 Bob 正常可见', () => {
  // 模拟从 /user/connections?keyword=alice@example.com&server_id=7 进入页面，且用户已手动切换到全部节点
  let urlSearch = { keyword: 'alice@example.com', serverId: 7 }
  let syncedSearch = { ...urlSearch }
  let keywordInput = 'alice@example.com'
  let appliedKeyword = 'alice@example.com'
  let exactIp = ''
  let serverId = '__all__'
  let pendingNavigate = null

  const renderPass = () => {
    const sync = reconcileUrlSearchSync(syncedSearch, urlSearch)
    if (sync.changed) {
      syncedSearch = sync.nextSyncedSearch
      if (sync.applyKeyword !== undefined) {
        keywordInput = sync.applyKeyword
        appliedKeyword = sync.applyKeyword
      }
      if (sync.applyServerId !== undefined) {
        serverId = sync.applyServerId
      }
    }
    return {
      keyword: appliedKeyword || undefined,
      ip: exactIp || undefined,
      server_id: serverId !== '__all__' ? Number(serverId) : undefined,
    }
  }

  // 初始渲染：仅查 Alice
  assert.deepEqual(renderPass(), {
    keyword: 'alice@example.com',
    ip: undefined,
    server_id: undefined,
  })

  // 用户点击 Alice 行的客户端 IP 203.0.113.99（不提前改写 syncedSearch，异步触发 navigate 清理 URL keyword）
  const next = buildExactIpFilterState('203.0.113.99')
  keywordInput = next.keywordInput
  appliedKeyword = next.appliedKeyword
  exactIp = next.exactIp
  pendingNavigate = () => {
    urlSearch = { ...urlSearch, keyword: undefined }
  }

  // 第 1 帧渲染（异步 navigate 尚未完成，URL 仍是 ?keyword=alice@example.com）：不得把 Alice 写回
  const paramsFrame1 = renderPass()
  assert.equal(keywordInput, '')
  assert.equal(appliedKeyword, '')
  assert.deepEqual(paramsFrame1, {
    keyword: undefined,
    ip: '203.0.113.99',
    server_id: undefined,
  })

  // 第 2 帧渲染（异步 navigate 完成，URL 已移除 keyword）：输入框与请求参数仍保持无 keyword，且未误还原 server_id=7
  pendingNavigate()
  const paramsFrame2 = renderPass()
  assert.equal(keywordInput, '')
  assert.equal(appliedKeyword, '')
  assert.equal(syncedSearch.keyword, undefined)
  assert.deepEqual(paramsFrame2, {
    keyword: undefined,
    ip: '203.0.113.99',
    server_id: undefined,
  })

  // 验证以此请求参数过滤实时记录时，共用同 IP 的 Alice 与 Bob 均会被返回
  const allRows = [
    { user_email: 'alice@example.com', ips: ['203.0.113.99'] },
    { user_email: 'bob@example.com', ips: ['203.0.113.99'] },
    { user_email: 'carol@example.com', ips: ['198.51.100.5'] },
  ]
  const matched = allRows.filter(
    (r) =>
      (!paramsFrame2.keyword || r.user_email.includes(paramsFrame2.keyword)) &&
      (!paramsFrame2.ip || r.ips.includes(paramsFrame2.ip))
  )
  assert.deepEqual(
    matched.map((r) => r.user_email),
    ['alice@example.com', 'bob@example.com']
  )

  // 第 3 帧渲染（后续用户再次携带新 URL 关键词导航进来）：依然能正常同步新关键词
  urlSearch = { ...urlSearch, keyword: 'carol@example.com' }
  const paramsFrame3 = renderPass()
  assert.equal(keywordInput, 'carol@example.com')
  assert.equal(paramsFrame3.keyword, 'carol@example.com')

  // 源码防回归检查：filterByExactIp 中绝不允许提前调用 setSyncedSearch
  const pageSource = readFileSync(
    new URL('../src/features/user-connections/index.tsx', import.meta.url),
    'utf8'
  )
  const fnMatch = pageSource.match(/const filterByExactIp = [\s\S]*?\n  \}/)
  assert.ok(fnMatch, 'filterByExactIp function should exist')
  assert.doesNotMatch(fnMatch[0], /setSyncedSearch/)
})

test('取证抽屉在用户在线时刷新快照，用户离线或移出当前页时保留快照不断开抽屉', () => {
  const initialAlice = { user_id: 2, user_email: 'alice@example.com', total_connections: 12 }
  const updatedAlice = { user_id: 2, user_email: 'alice@example.com', total_connections: 25 }
  const bobOnlyRows = [{ user_id: 3, user_email: 'bob@example.com', total_connections: 8 }]

  // 1. 用户仍在当前页：刷新为最新实时行且标记在线可见
  const live = reconcileDetailSnapshot(initialAlice, [updatedAlice, ...bobOnlyRows], true)
  assert.equal(live.activeRow, updatedAlice)
  assert.equal(live.nextSnapshot, updatedAlice)
  assert.equal(live.isRealtimePresent, true)

  // 2. 用户离线或移出当前页：保留最后快照（不返回 null 关闭抽屉），标记实时不可见
  const offline = reconcileDetailSnapshot(updatedAlice, bobOnlyRows, true)
  assert.equal(offline.activeRow, updatedAlice)
  assert.equal(offline.nextSnapshot, updatedAlice)
  assert.equal(offline.isRealtimePresent, false)
})
