import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type BaseProps = {
  label: string
  description?: string
}

export function FieldRow({
  label,
  description,
  children,
}: BaseProps & { children: React.ReactNode }) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      {children}
      {description && (
        <p className='text-muted-foreground text-xs'>{description}</p>
      )}
    </div>
  )
}

export function TextField({
  label,
  description,
  value,
  onChange,
  placeholder,
  type = 'text',
}: BaseProps & {
  value: string | number | null | undefined
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <FieldRow label={label} description={description}>
      <Input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldRow>
  )
}

export function TextareaField({
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 6,
}: BaseProps & {
  value: string | null | undefined
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <FieldRow label={label} description={description}>
      <Textarea
        rows={rows}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className='font-mono text-xs'
      />
    </FieldRow>
  )
}

export function SwitchField({
  label,
  description,
  value,
  onChange,
}: BaseProps & {
  value: boolean | undefined
  onChange: (v: boolean) => void
}) {
  return (
    <div className='flex items-center justify-between gap-4 rounded-md border p-3'>
      <div className='grid gap-0.5'>
        <Label>{label}</Label>
        {description && (
          <p className='text-muted-foreground text-xs'>{description}</p>
        )}
      </div>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  )
}

export function SelectField({
  label,
  description,
  value,
  onChange,
  options,
  placeholder,
}: BaseProps & {
  value: string | number | null | undefined
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
}) {
  return (
    <FieldRow label={label} description={description}>
      <Select value={value != null ? String(value) : ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
  )
}
