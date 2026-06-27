import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  disabled?: boolean
  loading?: boolean
  onConfirm: () => void
}

export function ThemeDeleteButton({ disabled, loading, onConfirm }: Props) {
  return (
    <Button
      disabled={disabled || loading}
      variant='ghost'
      size='icon'
      className='text-muted-foreground hover:text-destructive h-8 w-8'
      onClick={onConfirm}
    >
      <Trash2 className='h-4 w-4' />
    </Button>
  )
}
