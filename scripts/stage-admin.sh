#!/usr/bin/env bash
# 构建并把产物组织成 Xboard 后端 `public/assets/admin/` 的目录结构，
# 输出到 ./deploy/assets/admin/ ，整目录上传到服务器的 public/assets/ 即可。
#
# 用法:  bash scripts/stage-admin.sh
set -e
cd "$(dirname "$0")/.."

echo "[1/3] 构建..."
npm run build

OUT="deploy/assets/admin"
echo "[2/3] 组织目录到 $OUT ..."
rm -rf deploy
mkdir -p "$OUT"
cp -r dist/assets "$OUT/assets"
[ -d dist/images ] && cp -r dist/images "$OUT/images"
cp dist/.vite/manifest.json "$OUT/manifest.json"

# 可选: 保留 locales（Blade 会加载；本面板用内置中文，留着无害）
if [ -d public/assets-admin-locales ]; then
  cp -r public/assets-admin-locales "$OUT/locales"
fi

echo "[3/3] 完成。产物在 $OUT"
echo
echo "上传(示例，按你的服务器路径/凭据修改):"
echo "  rsync -av --delete deploy/assets/admin/  root@你的服务器:/www/wwwroot/你的站点/public/assets/admin/"
echo
echo "服务器上执行(清旧的注入脚本 + 清缓存):"
echo "  cd /www/wwwroot/你的站点"
echo "  rm -f public/assets/admin/dns-auto-sync-ui.js public/assets/admin/node-backend-manager.js public/assets/admin/dns-sync-manager.js public/assets/admin/user-usage-record.js public/assets/admin/index.html public/assets/admin/index.legacy.html"
echo "  php artisan optimize:clear"
