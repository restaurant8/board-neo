# GitHub 全自动部署（服务器只需 git pull）

流程：改 `board-neo` 源码 → 推到 GitHub `main` → GitHub Action 自动构建 → 把编译产物
提交进 `restaurant8/Xboard` 的 `public/assets/admin/` → 服务器 `git pull` 即更新面板。

工作流文件：`.github/workflows/deploy-admin.yml`（已就绪）。

## 一次性配置

### 1. 建一个有写权限的 Token（注意：admin 是子模块）
`public/assets/admin` 是 git 子模块 → `restaurant8/board-neo-admin-dist`。
GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens** →
Generate：
- Repository access：选 **`restaurant8/board-neo-admin-dist` 和 `restaurant8/Xboard`** 两个
- Permissions：**Contents: Read and write**

复制生成的 token。

### 2. 把 Token 加到 board-neo 仓库 Secrets
`restaurant8/board-neo` → Settings → Secrets and variables → Actions → New repository secret：
- Name：`XBOARD_DEPLOY_TOKEN`
- Value：上一步的 token

### 3.（可选）开启"构建后自动部署到服务器"
再加 4 个 secret（不加则跳过此步，你手动 git pull）：
- `SSH_HOST`：服务器 IP
- `SSH_USER`：如 `root`
- `SSH_KEY`：服务器可登录的 SSH 私钥
- `SITE_PATH`：站点路径，如 `/www/wwwroot/你的站点`

配齐后，每次推送会自动 SSH 到服务器执行 `git pull --ff-only && php artisan optimize:clear`，
**真正全自动,服务器你什么都不用做**。

## 服务器一次性准备（让 git pull 干净）
服务器的 Xboard 必须是 git 仓库且跟踪 `restaurant8/Xboard` 的 main，且
`public/assets/admin/` 没有本地改动（否则 pull 冲突）。第一次切换时：
```bash
cd /www/wwwroot/你的站点
cp -r public/assets/admin public/assets/admin.bak   # 备份旧面板
git stash -u 2>/dev/null || true                      # 暂存本地改动（如有）
git pull
php artisan optimize:clear
```

## 日常使用
1. 本地改 `board-neo`，`git push`（推到 main）。
2. 等 Action 跑完（board-neo 仓库 Actions 页可看进度）。
3. 服务器：
   ```bash
   cd /www/wwwroot/你的站点 && git pull && git submodule update --init --recursive && php artisan optimize:clear
   ```
   （若配了第 3 步的 SSH secrets，这步也自动完成，你无需操作。）
4. 浏览器 Ctrl+F5 刷新后台。

## 说明
- Action 每次会把旧的注入式 JS（dns/backend/usage 等）一并删除（功能已原生写进面板）。
- 产物提交进 Xboard 仓库会产生构建产物的 diff，属正常（这是"服务器只 git"的代价）。
- 回滚：服务器 `rm -rf public/assets/admin && mv public/assets/admin.bak public/assets/admin && php artisan optimize:clear`，或 `git revert` 对应的自动提交。
