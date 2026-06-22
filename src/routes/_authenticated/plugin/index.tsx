import { createFileRoute } from '@tanstack/react-router'
import { PluginPage } from '@/features/plugin'

export const Route = createFileRoute('/_authenticated/plugin/')({
  component: PluginPage,
})
