#!/usr/bin/env bash
# 本地构建并发布管理面板。
# 关键:Xboard 的 public/assets/admin 是 git 子模块 → restaurant8/xboard-admin-dist。
# 正确流程:产物写进子模块 → 提交并推送子模块 → 在父仓库 Xboard 更新子模块指针并推送。
# 服务器:git pull && git submodule update --init --recursive && php artisan optimize:clear
#
# 用法:
#   bash scripts/deploy-local.sh            # 只构建+同步到子模块工作区(不提交)
#   bash scripts/deploy-local.sh --push     # 构建+提交推送子模块+更新父仓库指针并推送
# 环境变量: XBOARD_DIR  Xboard 仓库本地路径(默认 ../Xboard)
set -e
cd "$(dirname "$0")/.."

XBOARD_DIR="${XBOARD_DIR:-../Xboard}"
SUB="$XBOARD_DIR/public/assets/admin"

[ -d "$XBOARD_DIR/.git" ] || { echo "找不到 Xboard 仓库: $XBOARD_DIR"; exit 1; }
[ -e "$SUB/.git" ] || { echo "子模块未初始化: $SUB (先在 Xboard 跑 git submodule update --init)"; exit 1; }

echo "[1/4] 构建..."
npm run build

echo "[2/4] 同步产物到子模块工作区 $SUB ..."
rm -rf "$SUB/assets"
rm -f "$SUB/manifest.json" "$SUB/index.html" "$SUB/index.legacy.html" \
      "$SUB/dns-auto-sync-ui.js" "$SUB/node-backend-manager.js" \
      "$SUB/dns-sync-manager.js" "$SUB/user-usage-record.js"
cp -r dist/assets "$SUB/assets"
[ -d dist/images ] && { rm -rf "$SUB/images"; cp -r dist/images "$SUB/images"; }
cp dist/.vite/manifest.json "$SUB/manifest.json"
echo "同步完成。"

if [ "$1" != "--push" ]; then
  echo "[3/4] 跳过提交(加 --push 自动提交推送子模块+父仓库)。"
  exit 0
fi

echo "[3/4] 提交并推送子模块 (xboard-admin-dist)..."
( cd "$SUB" && git add -A && \
  ( git diff --cached --quiet && echo "子模块无变更" || \
    { git commit -q -m "rebuild admin panel"; git push origin HEAD:main; } ) )

echo "[4/4] 更新父仓库 Xboard 子模块指针并推送..."
( cd "$XBOARD_DIR" && git add public/assets/admin && \
  ( git diff --cached --quiet && echo "父仓库指针无变更" || \
    { git commit -q -m "chore(admin): bump admin submodule"; git push; } ) )

echo
echo "完成。服务器执行:"
echo "  git pull && git submodule update --init --recursive && php artisan optimize:clear"
