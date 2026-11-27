/**
 * Cookie utility functions using manual document.cookie approach
 * Replaces js-cookie dependency for better consistency
 */

const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function decodeCookieValue(raw: string): string {
  // 新版 buildCookieString 使用 encodeURIComponent 编码，产物不会包含裸引号、花括号、方括号或空格。
  // 若检测到上述字符，说明是升级前旧版写入的未编码原始值（例如含 "team%41@example.test" 的 JSON），
  // 必须原样返回，避免 decodeURIComponent 将合法 %XX 序列误改写。
  if (/["{}[\]\s]/.test(raw)) {
    return raw
  }
  try {
    return decodeURIComponent(raw)
  } catch {
    // 兼容升级前未做 URL 编码且含裸 % 的旧 Cookie
    return raw
  }
}

function isHttpsContext(): boolean {
  return (
    typeof window !== 'undefined' && window.location?.protocol === 'https:'
  )
}

export function parseCookieHeader(
  cookieHeader: string,
  name: string
): string | undefined {
  const value = `; ${cookieHeader}`
  const parts = value.split(`; ${name}=`)
  if (parts.length >= 2) {
    const cookieValue = parts.pop()?.split(';').shift()
    return cookieValue !== undefined ? decodeCookieValue(cookieValue) : undefined
  }
  return undefined
}

export function buildCookieString(
  name: string,
  value: string,
  maxAge: number = DEFAULT_MAX_AGE,
  secure: boolean = isHttpsContext()
): string {
  const encoded = maxAge <= 0 ? '' : encodeURIComponent(value)
  const secureAttr = secure ? '; Secure' : ''
  return `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax${secureAttr}`
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined

  return parseCookieHeader(document.cookie, name)
}

/**
 * Set a cookie with name, value, and optional max age
 */
export function setCookie(
  name: string,
  value: string,
  maxAge: number = DEFAULT_MAX_AGE
): void {
  if (typeof document === 'undefined') return

  document.cookie = buildCookieString(name, value, maxAge)
}

/**
 * Remove a cookie by setting its max age to 0
 */
export function removeCookie(name: string): void {
  if (typeof document === 'undefined') return

  document.cookie = buildCookieString(name, '', 0)
}
