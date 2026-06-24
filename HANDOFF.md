# Xboard 管理端重建（board-neo）— 交付说明

基于 `satnaing/shadcn-admin`（React 19 + Vite + TanStack Router/Query/Table + Tailwind v4 + shadcn/ui）重写的 Xboard 管理后台，对接现有开源 PHP 后端，覆盖 20 个模块 / ~138 接口，并原生重写了原注入式 JS 脚本功能。

## 状态：✅ 全量构建通过（tsc + vite），dev 实测登录与各模块渲染正常

## 运行

> ⚠️ 本机 Node 由 winget 安装在非 PATH 目录。Node 24 位置：
> `C:\Users\x\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.17.0-win-x64`
> 建议把该目录加入系统 PATH（`setx PATH ...`），否则需用全路径调用 node/npm。

```bash
cd D:\board-neo
npm install
npm run dev      # http://localhost:5173 （或指定 --port）
npm run build    # 产物在 dist/
```

## 配置（部署时改，无需重新构建）
`public/settings.js` 注入 `window.XBOARD_CONFIG`：
```js
window.XBOARD_CONFIG = { apiBase: '', securePath: '<secure_path>', title: 'Xboard' }
```
- `apiBase`：后端源。`''` = 同源（生产由 Laravel public 提供；dev 由 Vite 代理）。
- `securePath`：后台动态前缀 `admin_setting('secure_path')`。
- dev 代理：`vite.config.ts` 把 `/api` 转发到 `VITE_PROXY_TARGET`（默认 `https://<你的站点>`）。

## 架构
- `src/lib/config.ts`：运行时配置。
- `src/lib/api-client.ts`：axios 实例，自动注入 Bearer、解包后端信封 `{status,message,data,error}`、分页直通、错误取后端 message。helper：`get/post/getPaginated`。
- `src/stores/auth-store.ts`：token（auth_data 全串）+ 管理员信息，cookie 持久化。
- 登录：`src/features/auth`（POST `/passport/auth/login`，已实测）。鉴权守卫：`src/routes/_authenticated/route.tsx`。
- 导航：`src/components/layout/data/sidebar-data.ts`。
- 每模块：`src/features/<module>/{api.ts,index.tsx,components/*}` + 路由 `src/routes/_authenticated/<path>/index.tsx`。黄金范式见 `src/features/notice`。

## 原生重写的自定义功能
- 用户使用记录（真实IP/订阅IP、归属地、UA、去重、在线IP数、排序、一键清除、刷新/返回全部）→ `src/features/user/components/usage-records-dialog.tsx`，接口 `/user/usageRecords`、`/user/clearUsageRecords`。
- 后端节点管理（双栈上报IP、版本对比、远程升级+回执轮询、远程重启、超时提示）→ `src/features/server-machine/components/backend-manager.tsx`。
- Cloudflare DNS 自动同步（配置 + 节点映射）→ `src/features/server-dns`。

## 已知事项 / 后续可打磨
1. **该 demo 后端 nginx/WAF 拦截所有 `GET /api/v2/*`**（POST 正常）。需在服务器放开 `/api` 的 GET 拦截，否则列表类 GET 接口在浏览器里也会 404。代码按源码契约已写正确。
2. UI 文案为简体中文硬编码（未接入 `locales/*.js` 的 i18n key），面板本即以 zh-CN 为主；如需多语言切换需再接 i18n。
3. 排序（plan/knowledge/notice）后端 `sort` 接口已封装，列表暂按 sort 字段展示，未做拖拽交互。
4. 优惠券批量生成返回 CSV 文本（非 JSON），当前不解析下载；如需可改 axios responseType。
5. `getRanking` 后端无实现（会 500），仪表盘用户排行改用 `getTrafficRank?type=user`。
6. 节点多协议（11 种）的 `protocol_settings` 采用「基础字段 + JSON 编辑 + ECH 生成」方案；如需每协议全字段表单化需额外工作。
7. 模板自带 demo 路由（tasks/apps/chats/clerk/users 等）仍在但未挂菜单，可后续清理。
