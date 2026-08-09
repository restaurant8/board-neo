import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type PromotionScope } from '@/features/plan/plan-site'
import { type ResellerSite } from '../api'

export function PromotionScopeSelect({
  value,
  sites,
  onChange,
  disabled = false,
}: {
  value: PromotionScope
  sites: ResellerSite[]
  onChange: (value: PromotionScope) => void
  disabled?: boolean
}) {
  const selectedSiteId = value.startsWith('site:')
    ? Number(value.slice('site:'.length))
    : null
  const missingSelectedSite =
    selectedSiteId != null && !sites.some((site) => site.id === selectedSiteId)

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as PromotionScope)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder='选择作用范围' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='main'>主站</SelectItem>
        {missingSelectedSite && (
          <SelectItem value={value} disabled>
            站点 #{selectedSiteId}（已删除或不可用）
          </SelectItem>
        )}
        {sites.map((site) => (
          <SelectItem key={site.id} value={`site:${site.id}`}>
            {site.name}
            {site.site_type === 'brand' ? '（品牌站）' : '（分销站）'}
          </SelectItem>
        ))}
        <SelectItem value='global'>全站通用</SelectItem>
      </SelectContent>
    </Select>
  )
}
