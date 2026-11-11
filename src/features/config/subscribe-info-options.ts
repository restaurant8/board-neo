export type SubscribeInfoOption = { value: string; label: string }

/** 订阅信息可勾选项；此处顺序仅为选项列表顺序，实际展示顺序由排序结果决定。 */
export const SUBSCRIBE_INFO_ITEMS: readonly SubscribeInfoOption[] = [
  { value: 'remaining_traffic', label: '剩余流量' },
  { value: 'reset_day', label: '下次重置时间' },
  { value: 'expire_date', label: '到期日期' },
  { value: 'website', label: '官网' },
]

/** 未配置时的默认展示项，对齐后端 SubscribeInfoService::DEFAULT_ITEMS。 */
export const SUBSCRIBE_INFO_DEFAULT_ITEMS = [
  'remaining_traffic',
  'reset_day',
  'expire_date',
]
