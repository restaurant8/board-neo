#!/usr/bin/env bash
# 路 B：本地构建并把产物同步进 Xboard 仓库的 public/assets/admin/，
# 然后(可选)自动提交+推送 Xboard。服务器只需 git pull。
#
# 用法:
#   bash scripts/deploy-local.sh            # 只构建+同步文件(不提交)
#   bash scripts/deploy-local.sh --push     # 构建+同步+提交+推送 Xboard
# 环境变量:
#   XBOARD_DIR  Xboard 仓库本地路径(默认 ../Xboard)
set -e
cd "$(dirname "$0")/.."

XBOARD_DIR="${XBOARD_DIR:-../Xboard}"
DST="$XBOARD_DIR/public/assets/admin"

if [ ! -d "$XBOARD_DIR/.git" ]; then
  echo "找不到 Xboard 仓库: $XBOARD_DIR  (用 XBOARD_DIR=路径 指定)"; exit 1
fi

echo "[1/3] 构建..."
npm run build

echo "[2/3] 同步到 $DST ..."
mkdir -p "$DST"
rm -rf "$DST/assets"
rm -f "$DST/manifest.json" \
      "$DST/dns-auto-sync-ui.js" "$DST/node-backend-manager.js" \
      "$DST/dns-sync-manager.js" "$DST/user-usage-record.js" \
      "$DST/index.html" "$DST/index.legacy.html"
cp -r dist/assets "$DST/assets"
[ -d dist/images ] && { rm -rf "$DST/images"; cp -r dist/images "$DST/images"; }
cp dist/.vite/manifest.json "$DST/manifest.json"
echo "同步完成。"

if [ "$1" = "--push" ]; then
  echo "[3/3] 提交并推送 Xboard..."
  cd "$XBOARD_DIR"
  git add public/assets/admin
  if git diff --cached --quiet; then
    echo "无变更。"
  else
    git commit -q -m "chore(admin): rebuild admin panel"
    git push
    echo "已推送。服务器执行: git pull && php artisan optimize:clear"
  fi
else
  echo "[3/3] 跳过提交(加 --push 可自动提交并推送 Xboard)。"
  echo "手动: cd $XBOARD_DIR && git add public/assets/admin && git commit -m 'rebuild admin' && git push"
fi
