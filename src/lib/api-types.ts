/** Backend response envelope: `$this->success()` / `$this->fail()`. */
export type ApiEnvelope<T> = {
  status: 'success' | 'fail'
  message: string
  data: T
  error: string | null
}

/** Laravel paginator shape returned by `$this->paginate()` (no envelope). */
export type Paginated<T> = {
  total: number
  current_page: number
  per_page: number
  last_page: number
  data: T[]
}

/** Common list query params accepted by admin `fetch` endpoints. */
export type FetchParams = {
  current?: number
  pageSize?: number
  /** Sort column, e.g. "id". */
  sort?: string
  /** "ASC" | "DESC". */
  sort_type?: 'ASC' | 'DESC'
  /** Per-column filters: [{ key, condition, value }]. */
  filter?: Array<{ key: string; condition: string; value: unknown }>
  [key: string]: unknown
}
