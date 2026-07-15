<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$rootDir = dirname(__DIR__);
$dataDir = $rootDir . DIRECTORY_SEPARATOR . 'data';
$cachePath = $dataDir . DIRECTORY_SEPARATOR . 'tiktok-cache.json';

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_file(string $path, array $fallback): array
{
    if (!is_file($path)) return $fallback;
    $raw = file_get_contents($path);
    if (!is_string($raw) || $raw === '') return $fallback;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function write_json_file(string $path, array $payload): void
{
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) return;
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0775, true);
    file_put_contents($path, $json, LOCK_EX);
}

function http_get_text(string $url): string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => [
                'Accept-Language: en-US,en;q=0.9',
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
            ],
        ]);
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (is_string($body) && $body !== '' && $code >= 200 && $code < 400) return $body;
        return '';
    }

    $opts = [
        'http' => [
            'method' => 'GET',
            'timeout' => 20,
            'header' => "Accept-Language: en-US,en;q=0.9\r\nUser-Agent: Mozilla/5.0\r\n",
        ],
    ];
    $context = stream_context_create($opts);
    $body = @file_get_contents($url, false, $context);
    return is_string($body) ? $body : '';
}

function parse_tiktok_video_ids(string $html): array
{
    $ids = [];

    if (preg_match_all('#/video/(\d{8,})#', $html, $m) && isset($m[1])) {
        foreach ($m[1] as $id) {
            $id = (string)$id;
            if (strlen($id) >= 12) $ids[] = $id;
        }
    }

    if (preg_match_all('/"id":"(\d{8,})"/', $html, $m2) && isset($m2[1])) {
        foreach ($m2[1] as $id) {
            $id = (string)$id;
            if (strlen($id) >= 12) $ids[] = $id;
        }
    }

    return array_values(array_unique($ids));
}

function sanitize_username(string $value): string
{
    $clean = preg_replace('/[^a-zA-Z0-9._]/', '', $value) ?? '';
    return $clean !== '' ? $clean : 'nuwa_travels';
}

try {
    $username = sanitize_username((string)($_GET['user'] ?? 'nuwa_travels'));
    $limit = (int)($_GET['limit'] ?? 6);
    $limit = max(1, min(12, $limit));
    $ttl = 60 * 60 * 6;

    $cache = read_json_file($cachePath, []);
    $sameUser = (($cache['username'] ?? '') === $username);
    $cachedVideos = is_array($cache['videos'] ?? null) ? $cache['videos'] : [];
    $cacheAge = time() - (int)($cache['cachedAt'] ?? 0);

    if ($sameUser && $cacheAge >= 0 && $cacheAge < $ttl && !empty($cachedVideos)) {
        json_response(200, [
            'ok' => true,
            'username' => $username,
            'videos' => array_slice($cachedVideos, 0, $limit),
            'cached' => true,
            'stale' => false,
            'fetchedAt' => $cache['fetchedAt'] ?? null,
        ]);
    }

    $sourceUrl = 'https://www.tiktok.com/@' . rawurlencode($username) . '?lang=en';
    $html = http_get_text($sourceUrl);
    $ids = parse_tiktok_video_ids($html);

    $videos = [];
    foreach ($ids as $id) {
        if (count($videos) >= $limit) break;
        $videos[] = [
            'id' => $id,
            'url' => 'https://www.tiktok.com/@' . $username . '/video/' . $id,
            'embedUrl' => 'https://www.tiktok.com/embed/v2/' . $id,
        ];
    }

    if (!empty($videos)) {
        write_json_file($cachePath, [
            'username' => $username,
            'cachedAt' => time(),
            'fetchedAt' => gmdate('c'),
            'sourceUrl' => $sourceUrl,
            'videos' => $videos,
        ]);

        json_response(200, [
            'ok' => true,
            'username' => $username,
            'videos' => $videos,
            'cached' => false,
            'stale' => false,
            'fetchedAt' => gmdate('c'),
        ]);
    }

    if ($sameUser && !empty($cachedVideos)) {
        json_response(200, [
            'ok' => true,
            'username' => $username,
            'videos' => array_slice($cachedVideos, 0, $limit),
            'cached' => true,
            'stale' => true,
            'fetchedAt' => $cache['fetchedAt'] ?? null,
        ]);
    }

    json_response(200, [
        'ok' => true,
        'username' => $username,
        'videos' => [],
        'cached' => false,
        'stale' => true,
        'fetchedAt' => null,
        'error' => 'No videos could be fetched right now.',
    ]);
} catch (Throwable $e) {
    json_response(500, [
        'ok' => false,
        'error' => $e->getMessage(),
    ]);
}
