import { createFileRoute } from '@tanstack/react-router'
import { ThemePage } from '@/features/theme'

export const Route = createFileRoute('/_authenticated/theme/')({
  component: ThemePage,
})
