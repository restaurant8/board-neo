import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getTableColumnSpan,
  parseTableColumnPreferences,
  renderVisibleColumns,
} from '../src/hooks/use-table-column-preferences.ts'

const columns = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'secret', label: 'Secret', defaultVisible: false },
]

test('老配置升级时保留顺序和隐藏项，并隐藏新增的默认隐藏列', () => {
  const result = parseTableColumnPreferences(
    JSON.stringify({ order: ['b', 'a'], hidden: ['b'] }),
    columns
  )

  assert.deepEqual(result.order, ['b', 'a', 'secret'])
  assert.deepEqual(result.hidden, ['b', 'secret'])
  assert.deepEqual(result.known, ['a', 'b', 'secret'])
})

test('用户主动显示过的默认隐藏列在后续加载时保持显示', () => {
  const result = parseTableColumnPreferences(
    JSON.stringify({
      order: ['a', 'b', 'secret'],
      hidden: [],
      known: ['a', 'b', 'secret'],
    }),
    columns
  )

  assert.deepEqual(result.hidden, [])
})

test('重复 hidden id 或损坏数据不会隐藏全部业务列', () => {
  const duplicateHidden = parseTableColumnPreferences(
    JSON.stringify({
      order: ['a', 'b', 'secret'],
      hidden: ['a', 'b', 'secret', 'secret'],
    }),
    columns
  )
  const visible = duplicateHidden.order.filter(
    (id) => !new Set(duplicateHidden.hidden).has(id)
  )

  assert.equal(visible.length, 1)
  assert.deepEqual(parseTableColumnPreferences('{broken', columns), {
    order: ['a', 'b', 'secret'],
    hidden: ['secret'],
    known: ['a', 'b', 'secret'],
  })
})

test('删除列后丢弃旧 id，并保留其余列的用户顺序', () => {
  const result = parseTableColumnPreferences(
    JSON.stringify({
      order: ['removed', 'b', 'a'],
      hidden: ['removed', 'b'],
      known: ['removed', 'b', 'a'],
    }),
    columns
  )

  assert.deepEqual(result.order, ['b', 'a', 'secret'])
  assert.deepEqual(result.hidden, ['b', 'secret'])
})

test('只调用可见列 renderer，并据此计算包含固定列的 colSpan', () => {
  const calls = { a: 0, b: 0, secret: 0 }
  const renderers = {
    a: () => ++calls.a,
    b: () => ++calls.b,
    secret: () => ++calls.secret,
  }

  const rendered = Array.from({ length: 100 }, () =>
    renderVisibleColumns(['a', 'secret'], renderers)
  )

  assert.equal(rendered.flat().length, 200)
  assert.deepEqual(calls, { a: 100, b: 0, secret: 100 })
  assert.equal(getTableColumnSpan(['a', 'secret']), 4)
})
