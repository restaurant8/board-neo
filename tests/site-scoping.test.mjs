import assert from 'node:assert/strict'
import test from 'node:test'
import { filterServerGroupsBySite } from '../src/features/plan/group-site.ts'
import {
  filterPlanCandidatesBySite,
  filterPromotionPlansByScope,
  promotionScopeFrom,
  promotionScopeLabel,
  promotionScopePayload,
} from '../src/features/plan/plan-site.ts'
import {
  mergeSiteSettings,
  siteSettingsToForm,
} from '../src/features/reseller/site-settings.ts'
import { resolvePlanStatusFloor } from '../src/features/reseller/pricing-state.ts'

const groups = [
  { id: 1, name: 'Main', site_id: null },
  { id: 2, name: 'Brand A', site_id: 8 },
  { id: 3, name: 'Brand B', site_id: 9 },
]

test('batch plan status preserves an explicit zero floor', () => {
  assert.equal(resolvePlanStatusFloor('0', 1500, 2000), '0')
  assert.equal(resolvePlanStatusFloor('', 1500, 2000), '15')
  assert.equal(resolvePlanStatusFloor(undefined, null, 2000), '20')
})

test('main-site plans only receive main-site groups', () => {
  assert.deepEqual(
    filterServerGroupsBySite(groups, '').map((group) => group.id),
    [1]
  )
})

test('site plans only receive groups owned by that exact site', () => {
  assert.deepEqual(
    filterServerGroupsBySite(groups, '8').map((group) => group.id),
    [2]
  )
  assert.deepEqual(filterServerGroupsBySite(groups, 99), [])
})

const plans = [
  { id: 1, site_id: null },
  { id: 2, site_id: 8 },
  { id: 3, site_id: 9 },
]

test('main users only receive main plan candidates', () => {
  assert.deepEqual(
    filterPlanCandidatesBySite(plans, '').map((plan) => plan.id),
    [1]
  )
})

test('site users never receive another site exclusive plan', () => {
  assert.deepEqual(
    filterPlanCandidatesBySite(plans, '8', [
      { id: 8, site_type: 'reseller' },
    ]).map((plan) => plan.id),
    [1, 2]
  )
})

test('brand users only receive main plans when explicitly enabled', () => {
  const brand = { id: 8, site_type: 'brand' }
  assert.deepEqual(
    filterPlanCandidatesBySite(plans, '8', [brand]).map((plan) => plan.id),
    [2]
  )
  assert.deepEqual(
    filterPlanCandidatesBySite(plans, '8', [
      { ...brand, settings: { allow_main_plans: true } },
    ]).map((plan) => plan.id),
    [1, 2]
  )
})

test('promotion scope round-trips and filters plans with exact site matching', () => {
  assert.equal(promotionScopeFrom(null, true), 'global')
  assert.equal(promotionScopeFrom(null, false), 'main')
  assert.equal(promotionScopeFrom(8, false), 'site:8')
  assert.deepEqual(promotionScopePayload('global'), {
    site_id: null,
    is_global: true,
  })
  assert.deepEqual(promotionScopePayload('main'), {
    site_id: null,
    is_global: false,
  })
  assert.deepEqual(promotionScopePayload('site:8'), {
    site_id: 8,
    is_global: false,
  })

  assert.deepEqual(
    filterPromotionPlansByScope(plans, 'global').map((plan) => plan.id),
    [1, 2, 3]
  )
  assert.deepEqual(
    filterPromotionPlansByScope(plans, 'main').map((plan) => plan.id),
    [1]
  )
  assert.deepEqual(
    filterPromotionPlansByScope(plans, 'site:8').map((plan) => plan.id),
    [2]
  )
  assert.equal(
    promotionScopeLabel(8, false, [{ id: 8, name: 'Brand A' }]),
    'Brand A'
  )
})

test('site business settings preserve inherit versus explicit disable semantics', () => {
  assert.deepEqual(siteSettingsToForm({ untouched: 'keep' }), {
    payment_scope: 'inherit',
    payment_ids: [],
    trial_plan_id: 'inherit',
    allow_main_plans: false,
    reseller_theme_names: [],
  })

  assert.deepEqual(
    siteSettingsToForm({
      payment_ids: [],
      trial_plan_id: 0,
      allow_main_plans: 1,
    }),
    {
      payment_scope: 'custom',
      payment_ids: [],
      trial_plan_id: 'none',
      allow_main_plans: true,
      reseller_theme_names: [],
    }
  )

  assert.deepEqual(
    siteSettingsToForm({ reseller_theme_names: ['NextSpring'] })
      .reseller_theme_names,
    ['NextSpring']
  )
})

test('site business settings merge preserves unknown keys and normalizes ids', () => {
  assert.deepEqual(
    mergeSiteSettings(
      { untouched: 'keep', payment_ids: [99] },
      {
        payment_scope: 'custom',
        payment_ids: ['2', '2', 'invalid', '3'],
        trial_plan_id: '7',
        allow_main_plans: true,
        reseller_theme_names: ['NextSpring'],
      },
      'brand'
    ),
    {
      untouched: 'keep',
      payment_ids: [2, 3],
      trial_plan_id: 7,
      allow_main_plans: true,
    }
  )

  assert.deepEqual(
    mergeSiteSettings(
      { untouched: 'keep' },
      {
        payment_scope: 'custom',
        payment_ids: [],
        trial_plan_id: 'none',
        allow_main_plans: false,
        reseller_theme_names: [],
      },
      'brand'
    ),
    {
      untouched: 'keep',
      payment_ids: [],
      trial_plan_id: 0,
      allow_main_plans: false,
    }
  )

  assert.deepEqual(
    mergeSiteSettings(
      {
        untouched: 'keep',
        payment_ids: [],
        trial_plan_id: 2,
        allow_main_plans: true,
      },
      {
        payment_scope: 'inherit',
        payment_ids: [],
        trial_plan_id: 'inherit',
        allow_main_plans: true,
        reseller_theme_names: ['NextSpring', 'NextSpring', '../unsafe'],
      },
      'reseller'
    ),
    { untouched: 'keep', reseller_theme_names: ['NextSpring'] }
  )
})
