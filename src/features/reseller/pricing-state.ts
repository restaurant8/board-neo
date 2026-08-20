/** Preserve an explicitly entered zero; only an absent/empty edit uses server fallback. */
export function resolvePlanStatusFloor(
  currentFloor: string | undefined,
  floorPrice: number | null,
  mainPrice: number
): string {
  return currentFloor === undefined || currentFloor === ''
    ? String((floorPrice ?? mainPrice) / 100)
    : currentFloor
}
