import MarkdownIt from 'markdown-it'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

// 禁用原始 HTML（html: false），防止分站或外部输入在管理端预览时触发存储型 XSS；
// 同时收紧链接协议白名单，阻断 javascript:/vbscript:/data: 等危险协议。
const mdParser = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
})

const defaultValidateLink = mdParser.validateLink.bind(mdParser)
mdParser.validateLink = (url: string): boolean => {
  const trimmed = url.trim()
  if (!trimmed || !defaultValidateLink(trimmed)) return false

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('?') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return !trimmed.startsWith('//')
  }

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return true
  }

  try {
    const parsed = new URL(trimmed)
    return ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase())
  } catch {
    return false
  }
}

export function renderSafeMarkdown(text: string): string {
  return mdParser.render(text ?? '')
}
