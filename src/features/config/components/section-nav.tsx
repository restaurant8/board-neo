import { type JSX } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type SectionNavItem = {
  key: string
  title: string
  icon: JSX.Element
}

type SectionNavProps = Omit<
  React.HTMLAttributes<HTMLElement>,
  'onChange'
> & {
  items: SectionNavItem[]
  value: string
  onChange: (key: string) => void
}

/**
 * In-page settings section switcher. Mirrors the original Xboard
 * 系统配置 sidebar nav (icon + title list on lg, dropdown on mobile),
 * but driven by local state instead of routed sub-pages.
 */
export function SectionNav({
  className,
  items,
  value,
  onChange,
  ...props
}: SectionNavProps) {
  return (
    <>
      <div className='p-1 md:hidden'>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className='h-12 sm:w-48'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.key} value={item.key}>
                <div className='flex gap-x-4 px-2 py-1'>
                  <span className='scale-125'>{item.icon}</span>
                  <span className='text-md'>{item.title}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea
        orientation='horizontal'
        type='always'
        className='hidden w-full min-w-40 bg-background px-1 py-2 md:block'
      >
        <nav
          className={cn(
            'flex space-x-2 py-1 lg:flex-col lg:space-y-1 lg:space-x-0',
            className
          )}
          {...props}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type='button'
              onClick={() => onChange(item.key)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                value === item.key
                  ? 'bg-muted hover:bg-accent'
                  : 'hover:bg-accent hover:underline',
                'justify-start'
              )}
            >
              <span className='me-2'>{item.icon}</span>
              {item.title}
            </button>
          ))}
        </nav>
      </ScrollArea>
    </>
  )
}
