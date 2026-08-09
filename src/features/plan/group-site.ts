type SiteScopedGroup = {
  site_id: number | null
}

/**
 * A plan may only use a permission group owned by the exact same site.
 * null/empty means the main site; site-specific plans never fall back to a
 * main-site group.
 */
export function filterServerGroupsBySite<T extends SiteScopedGroup>(
  groups: T[],
  siteId: string | number | null | undefined
): T[] {
  const normalizedSiteId =
    siteId == null || siteId === '' ? null : Number(siteId)

  return groups.filter((group) => group.site_id === normalizedSiteId)
}
