type SiteScopedPlan = {
  site_id: number | null
}

type PlanSite = {
  id: number
  site_type: 'reseller' | 'brand'
  settings?: Record<string, unknown> | null
}

type NamedSite = {
  id: number
  name: string
}

export type PromotionScope = 'global' | 'main' | `site:${number}`

/**
 * Admin-side candidate filtering. Main-site users only receive main plans;
 * site users may receive their own plans and, subject to backend commercial
 * policy, main plans. The backend remains the final availability authority.
 */
export function filterPlanCandidatesBySite<T extends SiteScopedPlan>(
  plans: T[],
  siteId: string | number | null | undefined,
  sites: PlanSite[] = []
): T[] {
  const normalizedSiteId =
    siteId == null || siteId === '' || siteId === 'main' ? null : Number(siteId)

  if (normalizedSiteId === null) {
    return plans.filter((plan) => plan.site_id === null)
  }

  const site = sites.find((candidate) => candidate.id === normalizedSiteId)
  const allowsMainPlans =
    site?.site_type === 'reseller' ||
    (site?.site_type === 'brand' && !!site.settings?.allow_main_plans)

  return plans.filter(
    (plan) =>
      plan.site_id === normalizedSiteId ||
      (allowsMainPlans && plan.site_id === null)
  )
}

export function promotionScopeFrom(
  siteId: number | null | undefined,
  isGlobal: boolean | null | undefined
): PromotionScope {
  if (isGlobal) return 'global'
  return siteId ? `site:${siteId}` : 'main'
}

export function promotionScopePayload(scope: PromotionScope): {
  site_id: number | null
  is_global: boolean
} {
  if (scope === 'global') return { site_id: null, is_global: true }
  if (scope === 'main') return { site_id: null, is_global: false }

  const siteId = Number(scope.slice('site:'.length))
  return {
    site_id: Number.isSafeInteger(siteId) && siteId > 0 ? siteId : null,
    is_global: false,
  }
}

/**
 * Promotions use stricter plan scoping than ordinary admin assignment: a
 * non-global promotion may only reference plans whose site_id exactly matches
 * its own. Global promotions may reference plans from every site.
 */
export function filterPromotionPlansByScope<T extends SiteScopedPlan>(
  plans: T[],
  scope: PromotionScope
): T[] {
  if (scope === 'global') return plans
  const { site_id: siteId } = promotionScopePayload(scope)
  return filterPlanCandidatesBySite(plans, siteId, [])
}

export function promotionScopeLabel(
  siteId: number | null | undefined,
  isGlobal: boolean | null | undefined,
  sites: NamedSite[] = []
): string {
  if (isGlobal) return '全站通用'
  if (!siteId) return '主站'
  return sites.find((site) => site.id === siteId)?.name ?? `站点 #${siteId}`
}
