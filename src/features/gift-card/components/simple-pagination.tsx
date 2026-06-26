import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50]

type SimplePaginationProps = {
  /** 当前页（从 1 开始）。 */
  page: number
  /** 总页数。 */
  totalPages: number
  /** 总条数。 */
  total: number
  /** 每页条数。 */
  pageSize: number
  /** 跳转到指定页（从 1 开始，调用方负责边界裁剪）。 */
  onPageChange: (page: number) => void
  /** 改变每页条数（实现内部已回到第 1 页，调用方只需更新 pageSize）。 */
  onPageSizeChange: (pageSize: number) => void
  /**
   * 左侧文案。默认显示「共 N 条」。
   * 有多选的页面可传入自定义节点（如「已选择 X 项，共 N 项」）。
   */
  left?: React.ReactNode
  /** 可选的每页条数候选项，默认 10/20/30/50。 */
  pageSizeOptions?: number[]
}

/**
 * 统一的列表分页控件（与订单页观感一致）：
 * 左侧「共 N 条」+ 右侧「每页显示 ▾ / 第 X 页，共 Y 页 / 首·上·下·末」。
 * 纯展示组件，不关心数据是服务端分页还是客户端分页。
 */
export function SimplePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  left,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: SimplePaginationProps) {
  const currentPage = Math.max(1, page)
  const lastPage = Math.max(1, totalPages)
  const canPrev = currentPage > 1
  const canNext = currentPage < lastPage

  return (
    <div className='flex flex-col-reverse items-center justify-between gap-4 px-2 sm:flex-row'>
      <div className='text-muted-foreground text-sm'>
        {left ?? <>共 {total} 条</>}
      </div>
      <div className='flex items-center gap-4 sm:gap-6 lg:gap-8'>
        <div className='flex items-center gap-2'>
          <p className='text-sm font-medium'>每页显示</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className='h-8 w-17.5'>
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side='top'>
              {pageSizeOptions.map((s) => (
                <SelectItem key={s} value={`${s}`}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex w-28 items-center justify-center text-sm font-medium'>
          第 {currentPage} 页，共 {lastPage} 页
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            className='hidden size-8 p-0 lg:flex'
            onClick={() => onPageChange(1)}
            disabled={!canPrev}
          >
            <span className='sr-only'>首页</span>
            <DoubleArrowLeftIcon className='size-4' />
          </Button>
          <Button
            variant='outline'
            className='size-8 p-0'
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canPrev}
          >
            <span className='sr-only'>上一页</span>
            <ChevronLeftIcon className='size-4' />
          </Button>
          <Button
            variant='outline'
            className='size-8 p-0'
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canNext}
          >
            <span className='sr-only'>下一页</span>
            <ChevronRightIcon className='size-4' />
          </Button>
          <Button
            variant='outline'
            className='hidden size-8 p-0 lg:flex'
            onClick={() => onPageChange(lastPage)}
            disabled={!canNext}
          >
            <span className='sr-only'>末页</span>
            <DoubleArrowRightIcon className='size-4' />
          </Button>
        </div>
      </div>
    </div>
  )
}
