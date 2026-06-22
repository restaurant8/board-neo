import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { type ApiEnvelope, type Paginated } from './api-types'
import { adminBase, apiV2Base } from './config'

/**
 * Build an axios instance whose response interceptor unwraps the Xboard
 * envelope: `{ status, message, data, error }` → returns `data`. Paginator
 * responses (`{ total, current_page, ... }`, no `status` field) are returned
 * as-is. Failures throw an AxiosError whose message is the backend `message`.
 */
function createClient(baseURL: string): AxiosInstance {
  const instance = axios.create({ baseURL, timeout: 30000 })

  instance.interceptors.request.use((cfg) => {
    const token = useAuthStore.getState().auth.accessToken
    if (token) {
      cfg.headers = cfg.headers ?? {}
      // token already stored as the full "Bearer xxx" auth_data string
      cfg.headers.Authorization = token
    }
    cfg.headers['Accept'] = 'application/json'
    return cfg
  })

  instance.interceptors.response.use(
    (response) => {
      const body = response.data
      // Paginator: no envelope, has pagination keys → pass through unchanged.
      if (
        body &&
        typeof body === 'object' &&
        'data' in body &&
        'total' in body &&
        'current_page' in body
      ) {
        return { ...response, data: body }
      }
      // Standard envelope → unwrap to `data`.
      if (body && typeof body === 'object' && 'status' in body) {
        const env = body as ApiEnvelope<unknown>
        if (env.status === 'fail') {
          return Promise.reject(
            new AxiosError(
              env.message || 'Request failed',
              'EBADRESPONSE',
              response.config,
              response.request,
              response
            )
          )
        }
        return { ...response, data: env.data }
      }
      return response
    },
    (error: AxiosError<ApiEnvelope<unknown>>) => {
      const status = error.response?.status
      const msg = error.response?.data?.message
      if (status === 401) {
        useAuthStore.getState().auth.reset()
      }
      if (msg) error.message = msg
      return Promise.reject(error)
    }
  )

  return instance
}

/** Authenticated admin client (prefixed by secure_path). */
export const adminApi = createClient(adminBase)
/** Public client for passport/guest endpoints. */
export const publicApi = createClient(apiV2Base)

/** GET helper returning unwrapped `data`. */
export async function get<T>(
  url: string,
  params?: Record<string, unknown>,
  cfg?: AxiosRequestConfig
): Promise<T> {
  const res = await adminApi.get(url, { params, ...cfg })
  return res.data as T
}

/** POST helper returning unwrapped `data`. */
export async function post<T>(
  url: string,
  data?: unknown,
  cfg?: AxiosRequestConfig
): Promise<T> {
  const res = await adminApi.post(url, data, cfg)
  return res.data as T
}

/** GET helper returning a paginator. */
export async function getPaginated<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<Paginated<T>> {
  const res = await adminApi.get(url, { params })
  return res.data as Paginated<T>
}

/** Toast a server error message (for use outside react-query mutations). */
export function toastError(error: unknown, fallback = '请求失败') {
  const msg = error instanceof AxiosError ? error.message : fallback
  toast.error(msg || fallback)
}
