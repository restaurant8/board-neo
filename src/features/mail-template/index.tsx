import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type MailTemplateListItem, listMailTemplates } from './api'
import { MailTemplateEditDialog } from './components/mail-template-edit-dialog'

export function MailTemplatePage() {
  const [editOpen, setEditOpen] = useState(false)
  const [current, setCurrent] = useState<MailTemplateListItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['mail-templates'],
    queryFn: listMailTemplates,
  })

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>邮件模板</h2>
          <p className='text-muted-foreground'>编辑系统邮件的标题与内容，可重置为默认。</p>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模板</TableHead>
                <TableHead>标题</TableHead>
                <TableHead className='w-24'>状态</TableHead>
                <TableHead className='w-24 text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>加载中...</TableCell>
                </TableRow>
              ) : data && data.length > 0 ? (
                data.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className='font-medium'>
                      {t.label}
                      <span className='text-muted-foreground ms-2 text-xs'>{t.name}</span>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>{t.subject ?? '—'}</TableCell>
                    <TableCell>
                      {t.customized ? (
                        <Badge>已自定义</Badge>
                      ) : (
                        <Badge variant='secondary'>默认</Badge>
                      )}
                    </TableCell>
                    <TableCell className='text-end'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          setCurrent(t)
                          setEditOpen(true)
                        }}
                      >
                        <Pencil className='size-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>暂无模板</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Main>

      <MailTemplateEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        template={current}
      />
    </>
  )
}
