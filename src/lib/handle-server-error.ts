import { AxiosError } from 'axios'
import { toast } from 'sonner'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = 'Something went wrong!'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'No content.'
  }

  if (error instanceof AxiosError) {
    // Xboard envelope uses `message`; fall back to `title`, then the axios
    // error message (which our api-client interceptor sets to the backend
    // message on failure responses).
    const data = error.response?.data as
      | { message?: string; title?: string }
      | undefined
    const candidate = data?.message || data?.title || error.message
    if (typeof candidate === 'string' && candidate.length > 0) {
      errMsg = candidate
    }
  }

  toast.error(errMsg)
}
