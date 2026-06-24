// Deploy-time configuration. Edit these values when deploying; no rebuild needed.
// apiBase '' = same origin (served by Laravel public/). In dev, the Vite proxy
// forwards /api to the backend defined in vite.config.ts, so keep apiBase ''.
// 注意:生产由后端 admin.blade.php 注入 window.settings.secure_path,此处仅 dev 占位。
// 本地联调如需指定真实后台路径,改本地副本即可,不要把真实 secure_path 提交到公开仓库。
window.XBOARD_CONFIG = {
  apiBase: '',
  securePath: 'admin',
  title: 'Xboard',
}
