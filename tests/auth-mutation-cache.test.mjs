import assert from 'node:assert/strict'
import test from 'node:test'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { createAuthMutationCache } from '../src/lib/auth-mutation-cache.ts'

for (const status of [401, 403, 500]) {
  test(`写操作 ${status} 在保留局部错误处理时正确处理登录失效`, async () => {
    let unauthorized = 0
    let localErrors = 0
    const client = new QueryClient({
      mutationCache: createAuthMutationCache(() => unauthorized++),
    })
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status, data: {}, headers: {}, config: {},
    })
    const observer = new MutationObserver(client, {
      mutationFn: async () => { throw error },
      onError: () => localErrors++,
    })
    await assert.rejects(observer.mutate(), (actual) => actual === error)
    assert.equal(unauthorized, status === 401 ? 1 : 0)
    assert.equal(localErrors, 1)
    client.clear()
  })
}
