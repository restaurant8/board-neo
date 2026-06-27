import { useMemo } from 'react'
import MarkdownIt from 'markdown-it'
import MdEditor from 'react-markdown-editor-lite'
import 'react-markdown-editor-lite/lib/index.css'
import { cn } from '@/lib/utils'

/**
 * 共享 Markdown 编辑器（对齐原版 Xboard：react-markdown-editor-lite + markdown-it）。
 *
 * 工具栏沿用组件默认插件集，与原版一致：
 * 标题字号、加粗、斜体、下划线、删除线、无序/有序列表、引用、行内代码、
 * 代码块、表格、图片、链接、清除、撤销/重做，以及视图/全屏切换。
 */

// markdown-it 渲染器，供实时预览使用。
const mdParser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
})

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  /** 编辑器高度，默认 400px。 */
  height?: number
  placeholder?: string
  className?: string
}

export function MarkdownEditor({
  value,
  onChange,
  height = 400,
  placeholder,
  className,
}: MarkdownEditorProps) {
  // editor 实例稳定，避免每次渲染重建解析器。
  const renderHTML = useMemo(
    () => (text: string) => mdParser.render(text),
    []
  )

  return (
    <MdEditor
      // shadcn 风格：圆角 + 边框，与其它表单控件对齐。
      className={cn('overflow-hidden rounded-md border', className)}
      style={{ height }}
      value={value ?? ''}
      placeholder={placeholder}
      renderHTML={renderHTML}
      onChange={({ text }) => onChange(text)}
    />
  )
}

export default MarkdownEditor
