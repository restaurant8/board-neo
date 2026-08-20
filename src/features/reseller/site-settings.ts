export type SiteBusinessSettingsForm = {
  payment_scope: 'inherit' | 'custom'
  payment_ids: string[]
  trial_plan_id: string
  allow_main_plans: boolean
  reseller_theme_names: string[]
}

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key)

function positiveIntegerStrings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value]

  return [
    ...new Set(
      values
        .map(Number)
        .filter((item) => Number.isSafeInteger(item) && item > 0)
        .map(String)
    ),
  ]
}

function validThemeNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(
      value.filter(
        (item): item is string =>
          typeof item === 'string' && /^[A-Za-z0-9_-]+$/.test(item)
      )
    ),
  ]
}

/**
 * Translate persisted settings into form state without losing the important
 * distinction between an absent key (inherit) and an explicit empty/zero
 * value (disable for this site).
 */
export function siteSettingsToForm(
  source: Record<string, unknown> | null | undefined
): SiteBusinessSettingsForm {
  const settings = source ?? {}
  const hasPaymentIds = hasOwn(settings, 'payment_ids')
  const hasTrialPlan = hasOwn(settings, 'trial_plan_id')
  const trialPlanId = Number(settings.trial_plan_id)

  return {
    payment_scope: hasPaymentIds ? 'custom' : 'inherit',
    payment_ids: hasPaymentIds
      ? positiveIntegerStrings(settings.payment_ids)
      : [],
    trial_plan_id: !hasTrialPlan
      ? 'inherit'
      : Number.isSafeInteger(trialPlanId) && trialPlanId > 0
        ? String(trialPlanId)
        : 'none',
    allow_main_plans: !!settings.allow_main_plans,
    reseller_theme_names: hasOwn(settings, 'reseller_theme_names')
      ? validThemeNames(settings.reseller_theme_names)
      : [],
  }
}

/** Merge only the settings exposed by the site dialog, preserving other keys. */
export function mergeSiteSettings(
  source: Record<string, unknown> | null | undefined,
  values: SiteBusinessSettingsForm,
  siteType: 'reseller' | 'brand'
): Record<string, unknown> {
  const settings = { ...(source ?? {}) }

  if (values.payment_scope === 'inherit') {
    delete settings.payment_ids
  } else {
    settings.payment_ids = positiveIntegerStrings(values.payment_ids).map(
      Number
    )
  }

  if (values.trial_plan_id === 'inherit') {
    delete settings.trial_plan_id
  } else if (values.trial_plan_id === 'none') {
    settings.trial_plan_id = 0
  } else {
    const trialPlanId = Number(values.trial_plan_id)
    if (Number.isSafeInteger(trialPlanId) && trialPlanId > 0) {
      settings.trial_plan_id = trialPlanId
    }
  }

  if (siteType === 'brand') {
    settings.allow_main_plans = values.allow_main_plans
    delete settings.reseller_theme_names
  } else {
    delete settings.allow_main_plans
    settings.reseller_theme_names = validThemeNames(values.reseller_theme_names)
  }

  return settings
}
