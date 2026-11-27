import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { userTrafficEvidenceQueryOptions } from '../src/features/user-connections/traffic-evidence-query.ts'

test('审计刷新包含打开面板之后的新记录，跨天时重新计算日期起点', async () => {
  let clock = new Date('2026-11-27T23:50:00')
  const recordedAt = new Date('2026-11-28T00:05:00').getTime() / 1000
  const requests = []
  const client = new QueryClient()
  const observer = new QueryObserver(client, {
    ...userTrafficEvidenceQueryOptions(42, 0, async (params) => {
      requests.push(params)
      return {
        list: recordedAt >= params.start_time && recordedAt <= (params.end_time ?? clock.getTime() / 1000)
          ? [{ destination: 'new.example.test' }] : [],
      }
    }, () => clock),
    enabled: false,
  })
  assert.equal((await observer.refetch()).data.list.length, 0)
  clock = new Date('2026-11-28T00:10:00')
  assert.equal((await observer.refetch()).data.list[0].destination, 'new.example.test')
  assert.equal(requests[1].user_id, 42)
  assert.equal(requests[1].start_time, new Date('2026-11-28T00:00:00').getTime() / 1000)
  assert.equal('end_time' in requests[1], false)
  client.clear()
})

test('近七天和近三十天审计保留正确的日期范围与用户隔离', async () => {
  const clock = new Date('2026-11-27T10:00:00')
  for (const [days, day] of [[7, 21], [30, 29]]) {
    let params
    const options = userTrafficEvidenceQueryOptions(99, days, async (p) => {
      params = p
      return { list: [] }
    }, () => clock)
    await options.queryFn()
    const expected = new Date(days === 7 ? '2026-11-21T00:00:00' : '2026-10-29T00:00:00')
    assert.equal(expected.getDate(), day)
    assert.equal(params.start_time, expected.getTime() / 1000)
    assert.equal(params.user_id, 99)
    assert.equal(params.mode, 'diagnostic')
    assert.deepEqual(options.queryKey, ['conn-evidence-audit', 99, days])
  }
})
