import { AxiosError } from 'axios'
import { MutationCache } from '@tanstack/react-query'

/** 全局回调独立于各功能的 onError，保证写操作也能处理登录失效。 */
export function createAuthMutationCache(onUnauthorized: () => void) {
  return new MutationCache({
    onError: (error) => {
      if (error instanceof AxiosError && error.response?.status === 401) {
        onUnauthorized()
      }
    },
  })
}
