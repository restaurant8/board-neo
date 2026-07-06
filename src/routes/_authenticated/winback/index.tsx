import { createFileRoute } from '@tanstack/react-router'
import { WinbackPage } from '@/features/winback'

export const Route = createFileRoute('/_authenticated/winback/')({
  component: WinbackPage,
})
