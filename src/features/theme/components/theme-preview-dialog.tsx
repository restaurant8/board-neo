import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type ThemeItem } from '../api'

type Props = {
  theme: ThemeItem | null
  onOpenChange: (open: boolean) => void
}

function PreviewBody({ theme }: { theme: ThemeItem }) {
  const [index, setIndex] = useState(0)
  const images = theme.images ?? []

  return (
    <>
      <DialogHeader>
        <DialogTitle>{theme.name} 主题预览</DialogTitle>
        <DialogDescription className='text-center'>
          {index + 1} / {images.length}
        </DialogDescription>
      </DialogHeader>

      <div className='relative'>
        <div className='bg-muted aspect-[16/9] overflow-hidden rounded-lg border'>
          {images[index] && (
            <img
              src={images[index]}
              alt={`${theme.name} 预览图 ${index + 1}`}
              className='h-full w-full object-contain'
            />
          )}
        </div>
        {images.length > 1 && (
          <>
            <Button
              variant='outline'
              size='icon'
              className='bg-background/80 hover:bg-background absolute top-1/2 left-4 h-8 w-8 -translate-y-1/2 rounded-full'
              onClick={() =>
                setIndex((i) => (i === 0 ? images.length - 1 : i - 1))
              }
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='bg-background/80 hover:bg-background absolute top-1/2 right-4 h-8 w-8 -translate-y-1/2 rounded-full'
              onClick={() =>
                setIndex((i) => (i === images.length - 1 ? 0 : i + 1))
              }
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className='mt-4 flex gap-2 overflow-x-auto pb-2'>
          {images.map((img, t) => (
            <button
              key={t}
              onClick={() => setIndex(t)}
              className={cn(
                'relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2',
                index === t ? 'border-primary' : 'border-transparent'
              )}
            >
              <img
                src={img}
                alt={`缩略图 ${t + 1}`}
                className='h-full w-full object-cover'
              />
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export function ThemePreviewDialog({ theme, onOpenChange }: Props) {
  return (
    <Dialog open={!!theme} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl'>
        {theme && <PreviewBody key={theme.name} theme={theme} />}
      </DialogContent>
    </Dialog>
  )
}
