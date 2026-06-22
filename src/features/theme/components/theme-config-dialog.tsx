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
import { Textarea } from '@/components/ui/textarea'
import { type ThemeItem, getThemeConfig, saveThemeConfig } from '../api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: ThemeItem | null
}

export function ThemeConfigDialog({ open, onOpenChange, theme }: Props) {
  const queryClient = useQueryClient()
  const name = theme?.name
  const [values, setValues] = useState<Record<string, unknown>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['theme-config', name],
    queryFn: () => getThemeConfig(name!),
    enabled: open && !!name,
  })

  useEffect(() => {
    if (data) setValues(data)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => saveThemeConfig(name!, values),
    onSuccess: () => {
      toast.success('主题配置已保存')
      queryClient.invalidateQueries({ queryKey: ['theme-config', name] })
      onOpenChange(false)
    },
    onError: handleServerError,
  })

  const set = (k: string, v: unknown) => setValues((p) => ({ ...p, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>主题配置 - {theme?.name}</DialogTitle>
          <DialogDescription>根据主题定义的字段进行配置。</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='text-muted-foreground py-12 text-center'>加载中...</div>
        ) : (
          <div className='grid max-h-[60vh] gap-4 overflow-y-auto pr-1'>
            {(theme?.configs ?? []).length === 0 && (
              <p className='text-muted-foreground text-sm'>该主题没有可配置项。</p>
            )}
            {(theme?.configs ?? []).map((f) => {
              const val = (values[f.field_name] ?? f.default_value ?? '') as string
              return (
                <div key={f.field_name} className='grid gap-2'>
                  <Label>{f.label}</Label>
                  {f.field_type === 'textarea' ? (
                    <Textarea
                      rows={4}
                      placeholder={f.placeholder}
                      value={val}
                      onChange={(e) => set(f.field_name, e.target.value)}
                    />
                  ) : f.field_type === 'select' ? (
                    <Select value={val} onValueChange={(v) => set(f.field_name, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={f.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(f.select_options ?? {}).map(([k, lbl]) => (
                          <SelectItem key={k} value={k}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder={f.placeholder}
                      value={val}
                      onChange={(e) => set(f.field_name, e.target.value)}
                    />
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
