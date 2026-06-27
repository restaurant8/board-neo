import { Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { type ThemeItem } from '../api'
import { ThemeDeleteButton } from './theme-delete-button'

type Props = {
  themeKey: string
  theme: ThemeItem
  isActive: boolean
  activating: boolean
  onActivate: (key: string) => void
  onDelete: (key: string) => void
  onPreview: (theme: ThemeItem) => void
  onConfig: (theme: ThemeItem) => void
}

export function ThemeCard({
  themeKey,
  theme: t,
  isActive,
  activating,
  onActivate,
  onDelete,
  onPreview,
  onConfig,
}: Props) {
  return (
    <Card
      className='group relative gap-0 overflow-hidden py-0 transition-all hover:shadow-md'
      style={{
        backgroundImage: t.background_url ? `url(${t.background_url})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div
        className={cn(
          'relative z-10 flex h-full flex-col gap-6 py-6 transition-colors',
          t.background_url
            ? 'from-background/95 via-background/80 to-background/60 group-hover:from-background/98 group-hover:via-background/90 group-hover:to-background/70 bg-gradient-to-t backdrop-blur-[1px]'
            : 'bg-background'
        )}
      >
        {!!t.can_delete && (
          <div className='absolute top-2 right-2'>
            <ThemeDeleteButton
              disabled={activating}
              loading={activating}
              onConfirm={() => onDelete(themeKey)}
            />
          </div>
        )}

        <CardHeader>
          <CardTitle>{t.name}</CardTitle>
          <CardDescription>
            <div className='space-y-2'>
              <div>{t.description}</div>
              {t.version && (
                <div className='text-muted-foreground text-sm'>
                  版本: {t.version}
                </div>
              )}
            </div>
          </CardDescription>
        </CardHeader>

        <CardFooter className='flex items-center justify-end space-x-3'>
          {Array.isArray(t.images) && t.images.length > 0 && (
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              onClick={() => onPreview(t)}
            >
              <Eye className='h-4 w-4' />
            </Button>
          )}
          <Button
            variant='outline'
            size='sm'
            onClick={() => onConfig(t)}
          >
            主题设置
          </Button>
          <Button
            onClick={() => onActivate(themeKey)}
            disabled={activating || isActive}
            variant={isActive ? 'secondary' : 'default'}
          >
            {isActive ? '当前主题' : '激活主题'}
          </Button>
        </CardFooter>
      </div>
    </Card>
  )
}
