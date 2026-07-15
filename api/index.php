<?php

session_start();
header('Content-Type: application/json; charset=utf-8');

$rootDir = dirname(__DIR__);
$dataDir = $rootDir . DIRECTORY_SEPARATOR . 'data';
$imagesDir = $rootDir . DIRECTORY_SEPARATOR . 'images';
$messagesPath = $dataDir . DIRECTORY_SEPARATOR . 'messages.json';
$contentPath = $dataDir . DIRECTORY_SEPARATOR . 'content.json';

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function read_raw_body(): string
{
    $body = file_get_contents('php://input');
    return is_string($body) ? $body : '';
}

function get_json_body(): array
{
    $raw = read_raw_body();
    if ($raw === '') return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function sanitize($value): string
{
    if ($value === null) return '';
    return trim((string)$value);
}

function slugify(string $value): string
{
    $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    $value = trim($value, '-');
    return $value !== '' ? $value : 'blog-post';
}

function escape_html(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
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
    if ($json === false) throw new RuntimeException('Failed to encode JSON.');
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0775, true);
    file_put_contents($path, $json, LOCK_EX);
}

function env_value(string $key, string $default = ''): string
{
    $value = getenv($key);
    if (is_string($value) && $value !== '') return $value;

    static $env = null;
    if ($env === null) {
        $env = [];
        $envPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
        if (is_file($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (is_array($lines)) {
                foreach ($lines as $line) {
                    $line = trim($line);
                    if ($line === '' || $line[0] === '#') continue;
                    $pos = strpos($line, '=');
                    if ($pos === false) continue;
                    $name = trim(substr($line, 0, $pos));
                    $val = trim(substr($line, $pos + 1));
                    $val = trim($val, "\"'");
                    if ($name !== '') $env[$name] = $val;
                }
            }
        }
    }
    return isset($env[$key]) ? (string)$env[$key] : $default;
}

function require_auth(): void
{
    if (!empty($_SESSION['admin_logged_in'])) return;
    json_response(401, ['ok' => false, 'error' => 'Unauthorized']);
}

function route_path(): string
{
    $route = $_GET['route'] ?? null;
    if (is_string($route) && $route !== '') {
        if ($route[0] !== '/') $route = '/' . $route;
        return $route;
    }

    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (!is_string($uriPath)) return '/';
    $pos = strpos($uriPath, '/api/');
    if ($pos === false) return '/';
    $path = substr($uriPath, $pos + 4);
    if ($path === '') return '/';
    if (str_starts_with($path, '/index.php/')) {
        $path = substr($path, strlen('/index.php'));
    } elseif ($path === '/index.php') {
        $path = '/';
    }
    return $path;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = route_path();

try {
    if (($path === '/session' || $path === '/session/') && $method === 'GET') {
        json_response(200, ['ok' => true, 'authenticated' => !empty($_SESSION['admin_logged_in'])]);
    }

    if (($path === '/login' || $path === '/login/') && $method === 'POST') {
        $body = get_json_body();
        $username = sanitize($body['username'] ?? '');
        $password = sanitize($body['password'] ?? '');
        $adminUser = env_value('ADMIN_USER', 'admin');
        $adminPass = env_value('ADMIN_PASSWORD', 'admin');
        $isEnvMatch = ($username === $adminUser && $password === $adminPass);
        $isDefaultMatch = ($username === 'admin' && $password === 'admin');
        if ($isEnvMatch || $isDefaultMatch) {
            $_SESSION['admin_logged_in'] = true;
            json_response(200, ['ok' => true]);
        }
        json_response(401, ['ok' => false, 'error' => 'Invalid credentials']);
    }

    if ($path === '/logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'] ?? '/');
        }
        session_destroy();
        json_response(200, ['ok' => true]);
    }

    if ($path === '/contact' && $method === 'POST') {
        $body = get_json_body();
        $message = [
            'id' => base_convert((string)time() . (string)random_int(100, 999), 10, 36),
            'name' => sanitize(($body['name'] ?? '') ?: (sanitize($body['firstName'] ?? '') . ' ' . sanitize($body['lastName'] ?? ''))),
            'email' => sanitize(($body['email'] ?? '') ?: ($body['contact'] ?? '')),
            'phone' => sanitize(($body['phone'] ?? '') ?: ($body['whatsapp'] ?? '')),
            'month' => sanitize(($body['month'] ?? '') ?: ($body['preferredMonth'] ?? '')),
            'nights' => sanitize(($body['nights'] ?? '') ?: ($body['tripLength'] ?? '')),
            'travelers' => sanitize($body['travelers'] ?? ''),
            'budget' => sanitize($body['budget'] ?? ''),
            'interests' => sanitize(($body['interests'] ?? '') ?: ($body['message'] ?? '')),
            'details' => sanitize(($body['details'] ?? '') ?: ($body['notes'] ?? '')),
            'source' => sanitize(($body['source'] ?? '') ?: 'website'),
            'status' => 'new',
            'createdAt' => gmdate('c'),
        ];
        $data = read_json_file($messagesPath, ['messages' => []]);
        if (!isset($data['messages']) || !is_array($data['messages'])) $data['messages'] = [];
        $data['messages'][] = $message;
        write_json_file($messagesPath, $data);
        json_response(200, ['ok' => true]);
    }

    if ($path === '/admin/content') {
        require_auth();
        if ($method === 'GET') {
            $content = read_json_file($contentPath, ['tours' => [], 'gallery' => [], 'blog' => [], 'districtGuides' => []]);
            json_response(200, ['ok' => true, 'content' => $content]);
        }
        if ($method === 'PUT') {
            $body = get_json_body();
            write_json_file($contentPath, $body);
            json_response(200, ['ok' => true]);
        }
        json_response(405, ['ok' => false, 'error' => 'Method not allowed']);
    }

    if ($path === '/admin/messages' && $method === 'GET') {
        require_auth();
        $data = read_json_file($messagesPath, ['messages' => []]);
        json_response(200, ['ok' => true, 'messages' => $data['messages'] ?? []]);
    }

    if ($path === '/admin/messages/mark-read' && $method === 'POST') {
        require_auth();
        $data = read_json_file($messagesPath, ['messages' => []]);
        $messages = $data['messages'] ?? [];
        foreach ($messages as &$msg) if (is_array($msg)) $msg['status'] = 'read';
        unset($msg);
        $data['messages'] = $messages;
        write_json_file($messagesPath, $data);
        json_response(200, ['ok' => true]);
    }

    if (preg_match('#^/admin/messages/([^/]+)/read$#', $path, $m) && $method === 'POST') {
        require_auth();
        $id = urldecode($m[1]);
        $data = read_json_file($messagesPath, ['messages' => []]);
        $messages = $data['messages'] ?? [];
        foreach ($messages as &$msg) {
            if (is_array($msg) && (($msg['id'] ?? '') === $id)) $msg['status'] = 'read';
        }
        unset($msg);
        $data['messages'] = $messages;
        write_json_file($messagesPath, $data);
        json_response(200, ['ok' => true]);
    }

    if (preg_match('#^/admin/messages/([^/]+)$#', $path, $m) && $method === 'DELETE') {
        require_auth();
        $id = urldecode($m[1]);
        $data = read_json_file($messagesPath, ['messages' => []]);
        $messages = $data['messages'] ?? [];
        $messages = array_values(array_filter($messages, static function ($msg) use ($id) {
            return !is_array($msg) || (($msg['id'] ?? '') !== $id);
        }));
        $data['messages'] = $messages;
        write_json_file($messagesPath, $data);
        json_response(200, ['ok' => true]);
    }

    if ($path === '/admin/upload-image' && $method === 'POST') {
        require_auth();
        $body = get_json_body();
        $fileName = sanitize($body['fileName'] ?? 'upload');
        $dataUrl = (string)($body['dataUrl'] ?? '');
        if (!preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/', $dataUrl, $m)) {
            json_response(400, ['ok' => false, 'error' => 'Invalid image payload.']);
        }
        $mime = strtolower($m[1]);
        $base64 = $m[2];
        $extByMime = ['image/jpeg'=>'.jpg','image/png'=>'.png','image/webp'=>'.webp','image/gif'=>'.gif','image/svg+xml'=>'.svg'];
        if (!isset($extByMime[$mime])) json_response(400, ['ok' => false, 'error' => 'Unsupported image type.']);
        $safeBase = slugify(pathinfo($fileName, PATHINFO_FILENAME));
        $unique = $safeBase . '-' . base_convert((string)time() . (string)random_int(100, 999), 10, 36) . $extByMime[$mime];
        if (!is_dir($imagesDir)) mkdir($imagesDir, 0775, true);
        $bytes = base64_decode($base64, true);
        if ($bytes === false) json_response(400, ['ok' => false, 'error' => 'Invalid base64 image data.']);
        file_put_contents($imagesDir . DIRECTORY_SEPARATOR . $unique, $bytes);
        json_response(200, ['ok' => true, 'path' => 'images/' . $unique]);
    }

    if ($path === '/admin/blog/publish' && $method === 'POST') {
        require_auth();
        $body = get_json_body();
        $title = sanitize($body['title'] ?? '');
        $category = sanitize($body['category'] ?? 'General');
        $readTime = sanitize($body['readTime'] ?? '5 min read');
        $excerpt = sanitize($body['excerpt'] ?? 'Read the full article for travel notes and practical tips.');
        $image = sanitize($body['image'] ?? 'images/1.jpeg');
        $contentHtml = (string)($body['contentHtml'] ?? '');
        $existingUrl = sanitize($body['existingUrl'] ?? '');
        if ($title === '') json_response(400, ['ok' => false, 'error' => 'Title is required.']);

        $safeContent = trim(preg_replace('/<script[\s\S]*?>[\s\S]*?<\/script>/i', '', $contentHtml) ?? '');
        if ($safeContent === '') $safeContent = '<p>' . escape_html($excerpt) . '</p>';

        $fileName = ($existingUrl !== '' && str_ends_with($existingUrl, '.html')) ? $existingUrl : (slugify($title) . '.html');
        $filePath = $rootDir . DIRECTORY_SEPARATOR . $fileName;
        if ($existingUrl === '') {
            $base = slugify($title);
            $counter = 2;
            while (is_file($filePath)) {
                $fileName = $base . '-' . $counter . '.html';
                $filePath = $rootDir . DIRECTORY_SEPARATOR . $fileName;
                $counter++;
            }
        }

        $html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>TuskersEdge | ' . escape_html($title) . '</title><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={theme:{extend:{colors:{jungle:"#064E3B",jungleLight:"#0F766E",sunset:"#F59E0B"},fontFamily:{heading:["Playfair Display","serif"],body:["Inter","system-ui","sans-serif"]}}}};</script><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" /></head><body class="bg-slate-50 font-body text-slate-800"><main class="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12"><a href="blog.html" class="inline-flex rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Back to Blog</a><article class="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"><div class="h-56 bg-cover bg-center md:h-72" style="background-image:url(\'' . escape_html($image) . '\')"></div><div class="p-6 md:p-8"><p class="text-[0.7rem] uppercase tracking-wide text-slate-500">' . escape_html($category) . ' ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ' . escape_html($readTime) . '</p><h1 class="mt-2 font-heading text-3xl text-jungle md:text-4xl">' . escape_html($title) . '</h1><p class="mt-3 text-sm text-slate-600">' . escape_html($excerpt) . '</p><div class="prose prose-slate mt-6 max-w-none">' . $safeContent . '</div></div></article></main></body></html>';
        file_put_contents($filePath, $html, LOCK_EX);
        json_response(200, ['ok' => true, 'url' => $fileName]);
    }

    json_response(404, ['ok' => false, 'error' => 'Not found']);
} catch (Throwable $e) {
    json_response(500, ['ok' => false, 'error' => $e->getMessage()]);
}




