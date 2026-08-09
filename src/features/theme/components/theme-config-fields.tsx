import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type ThemeItem } from '../api'

type Props = {
  theme: ThemeItem | null
  values: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  className?: string
}

/**
 * Render the dynamic fields declared by a theme's config.json.
 * Both the global theme dialog and site editor use this component so new
 * theme fields automatically appear in both places.
 */
export function ThemeConfigFields({
  theme,
  values,
  onChange,
  className,
}: Props) {
  const fields = theme?.configs ?? []

  if (fields.length === 0) {
    return <p className='text-sm text-muted-foreground'>该主题没有可配置项。</p>
  }

  return (
    <div className={className ?? 'grid gap-4'}>
      {fields.map((field) => {
        const value = String(
          values[field.field_name] ?? field.default_value ?? ''
        )

        return (
          <div key={field.field_name} className='grid gap-2'>
            <Label>{field.label}</Label>
            {field.field_type === 'textarea' ? (
              <Textarea
                rows={4}
                placeholder={field.placeholder}
                value={value}
                onChange={(event) =>
                  onChange(field.field_name, event.target.value)
                }
              />
            ) : field.field_type === 'select' ? (
              <Select
                value={value}
                onValueChange={(nextValue) =>
                  onChange(field.field_name, nextValue)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={field.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(field.select_options ?? {}).map(
                    ([optionValue, label]) => (
                      <SelectItem key={optionValue} value={optionValue}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder={field.placeholder}
                value={value}
                onChange={(event) =>
                  onChange(field.field_name, event.target.value)
                }
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
