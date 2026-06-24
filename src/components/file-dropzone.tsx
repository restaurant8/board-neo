import { useRef, useState } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  /** 选中/拖入文件后的回调 */
  onFile: (file: File) => void
  /** accept 过滤,如 ".zip" */
  accept?: string
  /** 上传中 */
  loading?: boolean
  /** 主提示文案 */
  title?: string
  /** 副提示文案 */
  hint?: string
  className?: string
}

/**
 * 拖拽 + 点击 上传框。把文件拖进虚线框,或点击选择文件。
 */
export function FileDropzone({
  onFile,
  accept = '.zip',
  loading = false,
  title = '拖拽文件到此处,或点击选择',
  hint,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const matchesAccept = (f: File) => {
    if (!accept) return true
    const exts = accept.split(',').map((s) => s.trim().toLowerCase())
    return exts.some((ext) =>
      ext.startsWith('.')
        ? f.name.toLowerCase().endsWith(ext)
        : f.type === ext
    )
  }

  const handle = (f?: File | null) => {
    if (!f) return
    if (!matchesAccept(f)) return
    onFile(f)
  }

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={() => !loading && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !loading)
          inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!loading) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!loading) handle(e.dataTransfer.files?.[0])
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        loading && 'pointer-events-none opacity-60',
        className
      )}
    >
      {loading ? (
        <Loader2 className='text-muted-foreground size-7 animate-spin' />
      ) : (
        <UploadCloud className='text-muted-foreground size-7' />
      )}
      <div className='text-sm font-medium'>
        {loading ? '上传中...' : title}
      </div>
      {hint && <div className='text-muted-foreground text-xs'>{hint}</div>}
      <input
        ref={inputRef}
        type='file'
        accept={accept}
        className='hidden'
        onChange={(e) => {
          handle(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
