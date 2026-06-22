import { createFileRoute } from '@tanstack/react-router'
import { MailTemplatePage } from '@/features/mail-template'

export const Route = createFileRoute('/_authenticated/mail-template/')({
  component: MailTemplatePage,
})
