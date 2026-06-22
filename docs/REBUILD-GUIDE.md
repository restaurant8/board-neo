# Xboard 管理端重建 — 开发规范（所有模块必须遵循）

项目：`D:\board-neo`（基于 shadcn-admin，已 `npm install`，构建通过）。
后端源码（字段唯一真理）：`D:\Xboard\app\Http\Controllers\V2\Admin\*`。
路由表：`D:\Xboard\app\Http\Routes\V2\AdminRoute.php`。

## 黄金范式（先读这些再动手）
- `src/features/notice/api.ts` — 模块 API 层写法
- `src/features/notice/index.tsx` — 列表页 + Header + 增删改 + 切换
- `src/features/notice/components/notice-mutate-dialog.tsx` — 表单弹窗（react-hook-form + zod + useMutation）
- `src/routes/_authenticated/notice/index.tsx` — 路由文件写法
- `src/components/confirm-dialog.tsx` — 删除确认弹窗 props

## API 层（统一用 `@/lib/api-client`）
```ts
import { get, post, getPaginated } from '@/lib/api-client'
import { type Paginated, type FetchParams } from '@/lib/api-types'
```
- `get<T>(url, params?)` / `post<T>(url, body?)`：自动解包后端信封 `{status,message,data,error}`，返回 `data`。
- `getPaginated<T>(url, params)`：用于返回 Laravel 分页对象 `{total,current_page,per_page,last_page,data:[]}` 的接口（如 `fetch` 带分页）。
- 失败时 axios 抛错，`error.message` 即后端 `message`。mutation 用 `onError: handleServerError`（`@/lib/handle-server-error`）。
- URL 是相对 admin 前缀的路径，例如 `get('/plan/fetch')` → 实际请求 `/api/v2/{secure_path}/plan/fetch`。
- 鉴权头自动注入，无需手动处理。

## 分页约定
- 后台分页 `fetch` 接口入参一般为 `current`（页码，从1）、`pageSize`（每页）。过滤/排序见对应 Controller 的 `applyFiltersAndSorts`。
- 注意：部分后端路由是 GET，但该 demo 服务器 WAF 拦截 GET。开发期可忽略联调失败，按源码契约写正确即可。

## 页面结构约定
- 每个模块：`src/features/<module>/api.ts` + `index.tsx` + 必要的 `components/*`。
- 路由：`src/routes/_authenticated/<path>/index.tsx`，`createFileRoute('/_authenticated/<path>/')`，component 指向 feature 默认导出页面。`<path>` 必须与 `src/components/layout/data/sidebar-data.ts` 里的 url 一致。
- 页面顶部统一用 `Header` + `ThemeSwitch`/`ConfigDrawer`/`ProfileDropdown`，主体用 `Main`（参考 Notice）。
- UI 文案用简体中文，对齐 Xboard 语义。
- 列表优先用 `@/components/ui/table` 简洁表格（参考 Notice）；复杂筛选可用 `@tanstack/react-table` + `@/components/data-table` 工具条。
- 数据用 `@tanstack/react-query`（useQuery/useMutation），queryKey 用模块名。
- 金额类字段：后端 `transformUserData` 等会把分转成元（/100），写表单/展示时注意单位，按 Controller 实际为准。

## 重要：不要运行 `npm run build` / `npm run dev`
会重生成共享文件 `routeTree.gen.ts`，并行时互相冲突。只管按范式写正确的 TS。最终统一构建由主控负责。

## 交付
完成后回报：创建/修改的文件清单 + 每个模块覆盖的接口数 + 任何与契约不符的疑点。
