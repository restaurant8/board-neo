import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchInvitedUsers, type User } from '../api'
import { formatExpireStatus, formatTimestamp } from '../format'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function UserInvitesSheet({ open, onOpenChange, user }: Props) {
  const { data, isFetching, isError } = useQuery({
    queryKey: ['user-invites', user?.id],
    queryFn: () => fetchInvitedUsers(user!.id, 1, 100),
    enabled: open && !!user,
  })

  const rows = data?.data ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='flex w-full flex-col gap-3 p-4 sm:max-w-2xl'
      >
        <SheetHeader className='p-0'>
          <SheetTitle>TA的邀请</SheetTitle>
          <SheetDescription>{user?.email} 邀请的下级用户</SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto rounded-md border'>
          <Table>
            <TableHeader className='sticky top-0 bg-background'>
              <TableRow>
                <TableHead className='w-16'>ID</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>订阅</TableHead>
                <TableHead>到期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>注册时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching ? (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    加载中...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='h-24 text-center text-muted-foreground'
                  >
                    暂无法获取邀请记录
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((u) => {
                  const exp = formatExpireStatus(u.expired_at)
                  return (
                    <TableRow key={u.id}>
                      <TableCell>{u.id}</TableCell>
                      <TableCell className='font-medium'>{u.email}</TableCell>
                      <TableCell>
                        {u.plan?.name ?? (
                          <span className='text-muted-foreground'>无</span>
                        )}
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        <span className={exp.expired ? 'text-destructive' : undefined}>
                          {exp.text}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.banned ? (
                          <Badge variant='destructive'>封禁</Badge>
                        ) : (
                          <Badge variant='secondary'>正常</Badge>
                        )}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-sm text-muted-foreground'>
                        {formatTimestamp(u.created_at)}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
                    暂无邀请记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className='text-sm text-muted-foreground'>
          共 {data?.total ?? rows.length} 人
        </div>
      </SheetContent>
    </Sheet>
  )
}
