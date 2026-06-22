import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  type Plugin,
  type PluginConfigField,
  getPluginConfig,
  updatePluginConfig,
} from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  plugin: Plugin | null
}

function normalizeOptions(
  options: PluginConfigField['options']
): Array<{ value: string; label: string }> {
  if (!options) return []
  if (Array.isArray(options)) return options
  return Object.entries(options).map(([value, label]) => ({ value, label }))
}

export function PluginConfigDialog({ open, onOpenChange, plugin }: Props) {
  const queryClient = useQueryClient()
  const code = plugin?.code
  const [values, setValues] = useState<Record<string, unknown>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['plugin-config', code],
    queryFn: () => getPluginConfig(code!),
    enabled: open && !!code,
  })

  useEffect(() => {
    if (data) {
      const init: Record<string, unknown> = {}
      Object.entries(data).forEach(([k, f]) => (init[k] = f.value))
      setValues(init)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => updatePluginConfig(code!, values),
    onSuccess: () => {
      toast.success('配置已更新')
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const set = (k: string, v: unknown) => setValues((p) => ({ ...p, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>插件配置 - {plugin?.name}</DialogTitle>
          <DialogDescription>调整插件参数后保存。</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='text-muted-foreground py-12 text-center'>加载中...</div>
        ) : (
          <div className='grid max-h-[60vh] gap-4 overflow-y-auto pr-1'>
            {data && Object.keys(data).length === 0 && (
              <p className='text-muted-foreground text-sm'>该插件没有可配置项。</p>
            )}
            {data &&
              Object.entries(data).map(([key, f]) => {
                const type = f.type ?? 'string'
                if (type === 'boolean') {
                  return (
                    <div
                      key={key}
                      className='flex items-center justify-between gap-4 rounded-md border p-3'
                    >
                      <div className='grid gap-0.5'>
                        <Label>{f.label || key}</Label>
                        {f.description && (
                          <p className='text-muted-foreground text-xs'>{f.description}</p>
                        )}
                      </div>
                      <Switch
                        checked={!!values[key]}
                        onCheckedChange={(b) => set(key, b)}
                      />
                    </div>
                  )
                }
                return (
                  <div key={key} className='grid gap-2'>
                    <Label>{f.label || key}</Label>
                    {type === 'text' ? (
                      <Textarea
                        rows={4}
                        placeholder={f.placeholder}
                        value={(values[key] as string) ?? ''}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    ) : type === 'select' ? (
                      <Select
                        value={values[key] != null ? String(values[key]) : ''}
                        onValueChange={(v) => set(key, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={f.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {normalizeOptions(f.options).map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={type === 'number' || type === 'integer' ? 'number' : 'text'}
                        placeholder={f.placeholder}
                        value={(values[key] as string) ?? ''}
                        onChange={(e) =>
                          set(
                            key,
                            type === 'number' || type === 'integer'
                              ? e.target.value === ''
                                ? ''
                                : Number(e.target.value)
                              : e.target.value
                          )
                        }
                      />
                    )}
                    {f.description && (
                      <p className='text-muted-foreground text-xs'>{f.description}</p>
                    )}
                  </div>
                )
              })}
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
