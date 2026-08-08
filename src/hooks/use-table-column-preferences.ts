import { useEffect, useMemo, useRef, useState } from 'react'

export type TableColumnOption<T extends string> = {
  id: T
  label: string
  defaultVisible?: boolean
}

type ColumnPreferences<T extends string> = {
  order: T[]
  hidden: T[]
  known: T[]
}

type StoredColumnPreferences = Partial<
  Record<keyof ColumnPreferences<string>, unknown>
>

function getDefaultPreferences<T extends string>(
  columns: readonly TableColumnOption<T>[]
): ColumnPreferences<T> {
  const order = columns.map((column) => column.id)
  return {
    order,
    hidden: columns
      .filter((column) => column.defaultVisible === false)
      .map((column) => column.id),
    known: order,
  }
}

function validUniqueIds<T extends string>(
  value: unknown,
  validIds: Set<string>
): T[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is T => validIds.has(id)))]
}

export function parseTableColumnPreferences<T extends string>(
  raw: string | null,
  columns: readonly TableColumnOption<T>[]
): ColumnPreferences<T> {
  const defaults = getDefaultPreferences(columns)
  if (!raw) return defaults

  try {
    const stored = JSON.parse(raw) as StoredColumnPreferences | null
    if (!stored || typeof stored !== 'object') return defaults

    const validIds = new Set<string>(defaults.order)
    const storedOrder = validUniqueIds<T>(stored.order, validIds)
    const order = [...new Set([...storedOrder, ...defaults.order])] as T[]
    const known = validUniqueIds<T>(stored.known, validIds)
    const previouslyKnown = new Set(known.length > 0 ? known : storedOrder)
    const hidden = new Set(
      Array.isArray(stored.hidden)
        ? validUniqueIds<T>(stored.hidden, validIds)
        : defaults.hidden
    )

    // 老配置尚未见过的新列仍遵循 defaultVisible，而不是一律变成可见。
    defaults.hidden.forEach((id) => {
      if (!previouslyKnown.has(id)) hidden.add(id)
    })

    // 即使本地数据被手工修改或损坏，仍至少保留一个业务列。
    if (hidden.size >= order.length) hidden.delete(order[order.length - 1])

    return { order, hidden: [...hidden], known: defaults.order }
  } catch {
    return defaults
  }
}

function loadPreferences<T extends string>(
  storageKey: string,
  columns: readonly TableColumnOption<T>[]
) {
  if (typeof window === 'undefined') return getDefaultPreferences(columns)
  return parseTableColumnPreferences(
    window.localStorage.getItem(storageKey),
    columns
  )
}

function savePreferences<T extends string>(
  storageKey: string,
  preferences: ColumnPreferences<T>
) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences))
  } catch {
    // localStorage 被浏览器禁用时仍保留当前会话内的列设置。
  }
}

export function renderVisibleColumns<T extends string, TResult>(
  visibleColumns: readonly T[],
  renderers: Record<T, () => TResult>
) {
  return visibleColumns.map((column) => renderers[column]())
}

export function getTableColumnSpan(
  visibleColumns: readonly string[],
  fixedColumns = 2
) {
  return visibleColumns.length + fixedColumns
}

export function useTableColumnPreferences<T extends string>(
  storageKey: string,
  columns: readonly TableColumnOption<T>[],
  options?: {
    onExternalVisibilityChange?: (hidden: Set<T>) => void
  }
) {
  const columnSignature = JSON.stringify(
    columns.map((column) => [column.id, column.defaultVisible !== false])
  )
  const stableColumns = useMemo<readonly TableColumnOption<T>[]>(() => {
    const schema = JSON.parse(columnSignature) as Array<[T, boolean]>
    return schema.map(([id, defaultVisible]) => ({
      id,
      label: id,
      defaultVisible,
    }))
  }, [columnSignature])
  const [preferences, setPreferences] = useState<ColumnPreferences<T>>(() =>
    loadPreferences(storageKey, stableColumns)
  )
  const preferencesRef = useRef(preferences)
  const previousConfig = useRef({
    storageKey,
    signature: columnSignature,
  })
  const onExternalVisibilityChange = useRef(options?.onExternalVisibilityChange)

  useEffect(() => {
    onExternalVisibilityChange.current = options?.onExternalVisibilityChange
  }, [options?.onExternalVisibilityChange])

  useEffect(() => {
    const previous = previousConfig.current
    if (
      previous.storageKey !== storageKey ||
      previous.signature !== columnSignature
    ) {
      const next = loadPreferences(storageKey, stableColumns)
      preferencesRef.current = next
      setPreferences(next)
      onExternalVisibilityChange.current?.(new Set(next.hidden))
      previousConfig.current = {
        storageKey,
        signature: columnSignature,
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (
        event.storageArea === window.localStorage &&
        event.key === storageKey
      ) {
        const next = parseTableColumnPreferences(event.newValue, stableColumns)
        preferencesRef.current = next
        setPreferences(next)
        onExternalVisibilityChange.current?.(new Set(next.hidden))
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [columnSignature, stableColumns, storageKey])

  const updatePreferences = (
    update: (current: ColumnPreferences<T>) => ColumnPreferences<T>
  ) => {
    const current = preferencesRef.current
    const next = update(current)
    if (next === current) return
    preferencesRef.current = next
    setPreferences(next)
    savePreferences(storageKey, next)
  }

  const hiddenSet = useMemo(
    () => new Set<T>(preferences.hidden),
    [preferences.hidden]
  )
  const visibleColumns = useMemo(
    () => preferences.order.filter((id) => !hiddenSet.has(id)),
    [hiddenSet, preferences.order]
  )

  const toggleColumn = (id: T) => {
    updatePreferences((current) => {
      const hidden = new Set(current.hidden)
      if (hidden.has(id)) hidden.delete(id)
      else if (current.order.length - hidden.size > 1) hidden.add(id)
      else return current
      return { ...current, hidden: [...hidden] }
    })
  }

  const moveColumn = (id: T, direction: -1 | 1) => {
    updatePreferences((current) => {
      const index = current.order.indexOf(id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.order.length)
        return current
      const order = [...current.order]
      ;[order[index], order[target]] = [order[target], order[index]]
      return { ...current, order }
    })
  }

  const resetColumns = () =>
    updatePreferences(() => getDefaultPreferences(stableColumns))

  return {
    orderedColumns: preferences.order,
    visibleColumns,
    hiddenSet,
    toggleColumn,
    moveColumn,
    resetColumns,
  }
}
