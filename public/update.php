<?php
/**
 * board-neo 前端自更新脚本（部署在静态站点根目录，需要 PHP + cURL + ZipArchive）。
 *
 * 安全约束：
 *  - 更新来源「写死」为 restaurant8/board-neo 的 dist-standalone 分支，无法被传入任意 URL。
 *  - 需要密钥：部署后请把下面的 UPDATE_TOKEN 改成你自己的随机串，并在「系统更新」页填入相同密钥。
 *    为空则一律拒绝（防止被人随意触发）。
 *
 * 接口：
 *  GET  /update.php?action=check&token=xxx   → 比对当前版本与 dist-standalone 最新 commit
 *  POST /update.php?action=apply&token=xxx   → 下载 zip、解压、覆盖当前目录（保留 settings.js / update.php / .bn-version）
 */

header('Content-Type: application/json; charset=utf-8');

const ZIP_URL = 'https://github.com/restaurant8/board-neo/archive/refs/heads/dist-standalone.zip';
const COMMITS_API = 'https://api.github.com/repos/restaurant8/board-neo/commits/dist-standalone';

/* ⬇⬇⬇ 部署后改成你自己的随机密钥（与系统更新页填的一致）⬇⬇⬇ */
const UPDATE_TOKEN = '';
/* ⬆⬆⬆ 为空将拒绝任何操作 ⬆⬆⬆ */

const PRESERVE = ['settings.js', 'update.php', '.bn-version'];

$DIR = __DIR__;
$VERSION_FILE = $DIR . '/.bn-version';

function out($data, $code = 200)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function http_fetch($url)
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 180,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT => 'board-neo-updater',
        CURLOPT_HTTPHEADER => ['Accept: application/vnd.github+json'],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return [$code, $body, $err];
}

function latest_sha()
{
    [$code, $body] = http_fetch(COMMITS_API);
    if ($code !== 200) {
        return [null, null, null];
    }
    $j = json_decode($body, true);
    return [
        substr($j['sha'] ?? '', 0, 7),
        $j['commit']['committer']['date'] ?? '',
        $j['commit']['message'] ?? '',
    ];
}

function rrmdir($d)
{
    if (!is_dir($d)) return;
    foreach (scandir($d) as $it) {
        if ($it === '.' || $it === '..') continue;
        $p = "$d/$it";
        is_dir($p) ? rrmdir($p) : @unlink($p);
    }
    @rmdir($d);
}

function copy_dir($src, $dst)
{
    if (!is_dir($dst)) mkdir($dst, 0755, true);
    foreach (scandir($src) as $it) {
        if ($it === '.' || $it === '..') continue;
        $s = "$src/$it";
        $d = "$dst/$it";
        if (in_array($it, PRESERVE, true) && is_file($d)) continue; // 保留运行配置
        if (is_dir($s)) {
            copy_dir($s, $d);
        } else {
            copy($s, $d);
        }
    }
}

/* ------------------------------- 鉴权 ------------------------------- */
$token = $_REQUEST['token'] ?? '';
if (UPDATE_TOKEN === '' || !hash_equals(UPDATE_TOKEN, (string) $token)) {
    out(['error' => '未授权：请在 update.php 设置 UPDATE_TOKEN，并在系统更新页填入相同密钥。'], 403);
}

$action = $_GET['action'] ?? 'check';

/* ------------------------------- 检查 ------------------------------- */
if ($action === 'check') {
    [$latest, $date, $msg] = latest_sha();
    if (!$latest) out(['error' => '无法访问 GitHub（请确认服务器能联通 api.github.com）'], 502);
    $current = is_file($VERSION_FILE) ? trim(file_get_contents($VERSION_FILE)) : '';
    out([
        'current_version' => $current !== '' ? $current : '未知',
        'latest_version' => $latest,
        'has_update' => $current !== '' ? ($current !== $latest) : true,
        'published_at' => $date,
        'message' => $msg,
    ]);
}

/* ------------------------------- 应用更新 ------------------------------- */
if ($action === 'apply') {
    if (!class_exists('ZipArchive')) out(['error' => '服务器缺少 ZipArchive 扩展'], 500);

    [$sha] = latest_sha();

    [$code, $zip] = http_fetch(ZIP_URL);
    if ($code !== 200 || !$zip) out(['error' => '下载更新包失败', 'http' => $code], 502);

    $tmpZip = tempnam(sys_get_temp_dir(), 'bn') . '.zip';
    file_put_contents($tmpZip, $zip);
    $tmpDir = sys_get_temp_dir() . '/bn-' . uniqid();

    $za = new ZipArchive();
    if ($za->open($tmpZip) !== true) {
        @unlink($tmpZip);
        out(['error' => '解压失败：无法打开更新包'], 500);
    }
    $za->extractTo($tmpDir);
    $za->close();
    @unlink($tmpZip);

    $src = $tmpDir . '/board-neo-dist-standalone';
    if (!is_dir($src)) {
        rrmdir($tmpDir);
        out(['error' => '更新包结构异常（缺少 board-neo-dist-standalone 目录）'], 500);
    }

    // 旧的 hash 资源整目录替换，避免堆积
    rrmdir($DIR . '/assets');
    copy_dir($src, $DIR);
    rrmdir($tmpDir);

    if ($sha) file_put_contents($VERSION_FILE, $sha);
    out(['success' => true, 'version' => $sha ?: '已更新']);
}

out(['error' => '未知操作'], 400);
