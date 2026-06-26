# 独立分离部署（前后端分离，照搬 Xboard 机制）

本项目与 Xboard 一样是无状态前后端分离：前端是纯静态 SPA，靠 Bearer Token（`Authorization` 头）调用后端 `/api/v2/*`，不依赖 Cookie/Session。因此前端可单独托管在任意服务器 / CDN / Vercel，只通过跨域 API 与后端交换数据。

## 两种部署形态

| 形态 | 命令 | base | manifest | 用途 |
|------|------|------|----------|------|
| 嵌入 Xboard（默认） | `npm run build` | `/assets/admin/` | 生成 | 产物丢进后端 `public/assets/admin/`，由 `admin.blade.php` 加载 |
| 独立分离 | `npm run build:standalone` | `/` | 不生成 | 产物 `dist/` 丢到独立静态服务器，跨域调后端 |

## 独立部署步骤

1. **复制环境模板**并填后端地址：
   ```bash
   cp .env.standalone.example .env.standalone
   ```
   ```ini
   VITE_DEPLOY_MODE=standalone
   VITE_API_BASE=https://你的后端域名      # 后端 origin，带协议不带结尾斜杠
   VITE_SECURE_PATH=你的真实admin路径前缀   # Xboard 的 secure_path / frontend_admin_path
   ```
   `.env.standalone` 已被 `.gitignore` 忽略，真实地址不会入库。

2. **构建**：
   ```bash
   npm run build:standalone
   ```
   产物在 `dist/`，`base` 为根路径，可直接静态托管。

3. **托管 `dist/`**：任意静态服务器（Nginx / Caddy / Vercel / Netlify）。
   - 需配置 SPA 回退：所有未命中静态文件的路径都 rewrite 到 `/index.html`（TanStack Router 客户端路由）。
   - Nginx 示例：`try_files $uri $uri/ /index.html;`

### 免重建的运行时配置（可选）

不想把后端地址编进构建，也可以构建后改 `dist/settings.js`（无需 rebuild）：
```js
window.XBOARD_CONFIG = {
  apiBase: 'https://你的后端域名',
  securePath: '你的真实admin路径前缀',
  title: 'Xboard',
}
```
优先级：`settings.js` (window.XBOARD_CONFIG) > 后端 blade 注入 > 构建期 `VITE_*`。

## 后端：零改动

Xboard 出厂 `config/cors.php` 已是全开（`allowed_origins: ['*']`、`allowed_methods: ['*']`、`allowed_headers: ['*']`、`supports_credentials: false`），配合 Token 鉴权（非 Cookie），跨域调用开箱即用，**无需改后端**。如需收紧，可把 `allowed_origins` 改成你的前端域名白名单。

## 配置解析顺序（src/lib/config.ts）

- `apiBase` = `window.XBOARD_CONFIG.apiBase` ?? `window.settings.base_url` ?? `import.meta.env.VITE_API_BASE` ?? `''`
- `securePath` = 同上链路，最后回退 `'admin'`
- `routeBasePath`：有后端 blade 注入的 `secure_path` 时挂 `/{secure_path}`，独立部署无 blade → 挂根路径 `/`

> 注意：`settings.js` 默认**不要**写 `apiBase: ''`，空串会用 `??` 短路掉构建期的 `VITE_API_BASE`。需要同源时留空（不设该键）即可。
