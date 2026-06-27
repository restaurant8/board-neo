import {
  CheckCircle2,
  CircleHelp,
  Clock,
  Loader2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import {
  COMMISSION_STATUS_MAP,
  ORDER_STATUS_MAP,
  ORDER_TYPE_MAP,
  PERIOD_MAP,
} from './api'

/** faceted 多选选项（value 为字符串，提交后端时再转 number / 内部 period 值）。 */
function toOptions(map: Record<number | string, string>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }))
}

/** 「类型」筛选项。 */
export const typeOptions = toOptions(ORDER_TYPE_MAP)

/** 「周期」筛选项（value 为旧版周期键，如 month_price）。 */
export const periodOptions = toOptions(PERIOD_MAP)

/** 「订单状态」筛选项。 */
export const statusOptions = toOptions(ORDER_STATUS_MAP)

/** 「佣金状态」筛选项。 */
export const commissionStatusOptions = toOptions(COMMISSION_STATUS_MAP)

/** 订单状态对应图标，用于状态单元格（对齐原版 u6t）。 */
export const ORDER_STATUS_ICON: Record<number, LucideIcon> = {
  0: Clock, // 待支付
  1: Loader2, // 开通中
  2: XCircle, // 已取消
  3: CheckCircle2, // 已完成
  4: CheckCircle2, // 已折抵
}

/** 订单状态图标颜色（对齐原版：黄/蓝/红/绿/绿）。 */
export const ORDER_STATUS_COLOR: Record<number, string> = {
  0: 'text-yellow-500',
  1: 'text-blue-500',
  2: 'text-red-500',
  3: 'text-green-500',
  4: 'text-green-500',
}

/** 佣金状态图标（对齐原版 h6t）。 */
export const COMMISSION_STATUS_ICON: Record<number, LucideIcon> = {
  0: CircleHelp,
  1: CircleHelp,
  2: CircleHelp,
  3: CircleHelp,
}

/** 佣金状态图标颜色（待确认黄 / 发放中蓝 / 已发放绿 / 无效红）。 */
export const COMMISSION_STATUS_COLOR: Record<number, string> = {
  0: 'text-yellow-500',
  1: 'text-blue-500',
  2: 'text-green-500',
  3: 'text-red-500',
}
