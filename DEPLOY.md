# 部署到 Xboard 服务器（替换原管理面板）

## 原理（无需改后端代码）
Xboard 后端的管理路由 `/{secure_path}` 渲染 `resources/views/admin.blade.php`，它会：
- 读 `public/assets/admin/manifest.json` 自动发现入口并加载 `/assets/admin/...` 的 JS/CSS；
- 注入 `window.settings = { base_url, secure_path }`。

本面板已适配这套机制：
- `vite.config.ts`：构建 `base = /assets/admin/` 且输出 `manifest.json`；
- `src/lib/config.ts`：优先读 `window.settings`（拿到 secure_path / base_url）。

所以**只要把构建产物放进服务器的 `public/assets/admin/`**，访问 `/{secure_path}` 就是新面板，secure_path 由后端自动注入，无需手填。

## 步骤

### 1. 本地打包
```bash
bash scripts/stage-admin.sh
```
产物在 `deploy/assets/admin/`（含 `assets/`、`images/`、`manifest.json`）。

### 2. 备份服务器旧面板（重要，便于回滚）
```bash
cd /www/wwwroot/<你的站点>
cp -r public/assets/admin public/assets/admin.bak
```

### 3. 上传新产物（覆盖）
```bash
# 在本地 board-neo 目录执行，按你的服务器路径/凭据修改
rsync -av deploy/assets/admin/  root@<服务器>:/www/wwwroot/<你的站点>/public/assets/admin/
```
（也可用宝塔文件管理器把 `deploy/assets/admin/` 里的内容传到 `public/assets/admin/`。）

### 4. 服务器上清理 + 清缓存
```bash
cd /www/wwwroot/<你的站点>
# 旧的注入式 JS 功能已原生写进面板，删除以免重复加载/冲突
rm -f public/assets/admin/dns-auto-sync-ui.js \
      public/assets/admin/node-backend-manager.js \
      public/assets/admin/dns-sync-manager.js \
      public/assets/admin/user-usage-record.js \
      public/assets/admin/index.html \
      public/assets/admin/index.legacy.html
php artisan optimize:clear
```

### 5. 验证
浏览器**强制刷新**（Ctrl+F5）打开 `https://<你的站点>/<secure_path>`，用管理员账号登录即可。

## 回滚
```bash
cd /www/wwwroot/<你的站点>
rm -rf public/assets/admin && mv public/assets/admin.bak public/assets/admin
php artisan optimize:clear
```

## 说明
- **不需要**改 `admin.blade.php` 或任何后端文件。
- **不需要**手动配 secure_path —— 后端 Blade 已注入 `window.settings.secure_path`。
- 旧的 `locales/*.js` 保留无害（本面板用内置中文）；如需删除也可。
- 每次有新改动：重复步骤 1→3→4 即可。
