// Deploy-time runtime configuration. Edit here to repoint the panel WITHOUT a
// rebuild. Read by src/lib/config.ts via window.XBOARD_CONFIG (highest priority).
//
// 三种部署形态：
//  1) 嵌入 Xboard 后端：本文件被后端 admin.blade.php 的 window.settings 取代，
//     apiBase/securePath 由后端注入，这里留空即可。
//  2) 本地 dev 联调：apiBase 留空（同源），Vite proxy 把 /api 转发到
//     vite.config.ts 里的 VITE_PROXY_TARGET。
//  3) 独立分离部署（npm run build:standalone）：要么在构建期用 .env.standalone
//     的 VITE_API_BASE/VITE_SECURE_PATH，要么在此处运行时填 apiBase/securePath。
//
// 注意：apiBase 不要默认写成 ''——空串会用 ?? 短路掉构建期的 VITE_API_BASE。
// 需要指定后端时再取消下面注释并填真实值（真实 secure_path 不要提交到公开仓库）。
window.XBOARD_CONFIG = {
  // apiBase 留空 = 同源（前端与 Xboard 后端同域）。跨域时填后端 origin。
  // apiBase: 'https://your-backend-domain.com',
  securePath: '6abf31ce', // 管理路由前缀（与后端 secure_path 一致）
  title: 'Xboard',
}
