import { createFileRoute } from '@tanstack/react-router'
import { KnowledgePage } from '@/features/knowledge'

export const Route = createFileRoute('/_authenticated/knowledge/')({
  component: KnowledgePage,
})
