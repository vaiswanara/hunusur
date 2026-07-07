<?php
/**
 * Vamsha Family Tree — Unified Data API
 * Handles both loading (GET) and saving (POST) profiles data.
 *
 * Security:
 *   - Password check for saves (SHA-256 hash stored in .env — not plain text)
 *   - JSON schema validation before writing
 *   - Automatic CORS matching for local hosts and current domain
 *   - Additional CORS configuration via .env
 *   - Path customization for data.json via .env (can be placed in secure home directory)
 */

// ─── CONFIG & ENVIRONMENT ───────────────────────────────────────────────────

// Load environment variables from .env file if it exists
$env_file = __DIR__ . '/../.env';
if (!file_exists($env_file)) {
    $env_file = __DIR__ . '/.env';
}

$admin_password_hash = 'b8ffa75cdfcd1e2a919e55e190e4ae56968c0154e45e547a8a3ee744d3d68638'; // Default fallback
$family_password_hash = '5e2b694b29bb88c42287b3a4a9c6870d057a667104b2c1fcf4e4277b069d12a6'; // Default fallback
$cors_allowed_origins_env = '';
$vamsha_db_path_env = '';

if (file_exists($env_file)) {
    $lines = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (strpos($line, '#') === 0 || empty($line)) continue;
        list($name, $value) = explode('=', $line, 2) + [NULL, NULL];
        if ($name !== NULL && $value !== NULL) {
            $name = trim($name);
            $value = trim($value, " \t\n\r\0\x0B\"'");
            if ($name === 'VITE_ADMIN_PASSWORD_HASH') {
                $admin_password_hash = $value;
            } elseif ($name === 'VITE_FAMILY_PASSWORD_HASH') {
                $family_password_hash = $value;
            } elseif ($name === 'CORS_ALLOWED_ORIGINS') {
                $cors_allowed_origins_env = $value;
            } elseif ($name === 'VAMSHA_DB_PATH') {
                $vamsha_db_path_env = $value;
            }
        }
    }
}

define('ADMIN_PASSWORD_HASH', $admin_password_hash);
define('FAMILY_PASSWORD_HASH', $family_password_hash);

// Resolve data.json path
$db_path = __DIR__ . '/data.json'; // Default fallback
if (!empty($vamsha_db_path_env)) {
    // If it's a relative path (does not start with '/' and not a Windows absolute path 'C:\')
    if (DIRECTORY_SEPARATOR === '/' ? (strpos($vamsha_db_path_env, '/') !== 0) : (!preg_match('/^[a-zA-Z]:\\\\/', $vamsha_db_path_env) && strpos($vamsha_db_path_env, '\\') !== 0)) {
        $resolved_path = __DIR__ . '/' . $vamsha_db_path_env;
    } else {
        $resolved_path = $vamsha_db_path_env;
    }

    // If configured path resolves to a directory, append data.json
    if (is_dir($resolved_path)) {
        $db_path = rtrim($resolved_path, '/\\') . '/data.json';
    } else {
        $db_path = $resolved_path;
    }
}

define('DATA_FILE', $db_path);

// ─── CORS HEADERS ────────────────────────────────────────────────────────────

$allowed_origins = [
    'http://localhost:5173',   // vite dev server
    'http://localhost:4173',   // vite preview
];

// Automatically allow the current server domain
if (isset($_SERVER['HTTP_HOST'])) {
    $proto = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $allowed_origins[] = $proto . '://' . $_SERVER['HTTP_HOST'];
}

// Add user-defined origins from .env
if (!empty($cors_allowed_origins_env)) {
    $custom_origins = explode(',', $cors_allowed_origins_env);
    foreach ($custom_origins as $origin_item) {
        $trimmed = trim($origin_item);
        if (!empty($trimmed)) {
            $allowed_origins[] = $trimmed;
        }
    }
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Password, X-Family-Password');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    handleGet();
} elseif ($method === 'POST') {
    handlePost($origin);
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use GET or POST.']);
    exit;
}

// ─── GET HANDLER (READ DATA) ─────────────────────────────────────────────────

function handleGet() {
    if (!file_exists(DATA_FILE)) {
        // If file doesn't exist, return empty profiles array
        echo json_encode([]);
        exit;
    }

    $content = file_get_contents(DATA_FILE);
    if ($content === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to read database file']);
        exit;
    }

    // Verify it is valid JSON before outputting
    $json = json_decode($content);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(500);
        echo json_encode(['error' => 'Database file is corrupted (invalid JSON)']);
        exit;
    }

    echo $content;
    exit;
}

// ─── POST HANDLER (WRITE DATA) ────────────────────────────────────────────────

function handlePost($origin) {
    // Rate Limiting (Simple File-Based) for saving only
    $rate_file = sys_get_temp_dir() . '/vamsha_rate_' . md5($origin ?: ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $max_requests = 10;      // max 10 saves per window
    $window = 60;            // per 60 seconds

    $rate_data = ['count' => 0, 'start' => time()];
    if (file_exists($rate_file)) {
        $rate_data = json_decode(file_get_contents($rate_file), true) ?? $rate_data;
    }

    if (time() - $rate_data['start'] > $window) {
        $rate_data = ['count' => 0, 'start' => time()]; // Reset window
    }

    $rate_data['count']++;
    file_put_contents($rate_file, json_encode($rate_data), LOCK_EX);

    if ($rate_data['count'] > $max_requests) {
        http_response_code(429);
        echo json_encode(['error' => 'Too many requests. Please wait a minute before saving again.']);
        exit;
    }

    // Password verification
    $provided_password = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? $_SERVER['HTTP_X_FAMILY_PASSWORD'] ?? '';
    $provided_hash = hash('sha256', $provided_password);

    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);
    $is_family = !empty(FAMILY_PASSWORD_HASH) && hash_equals(FAMILY_PASSWORD_HASH, $provided_hash);

    if (!$is_admin && !$is_family) {
        http_response_code(401);
        echo json_encode(['error' => 'Incorrect password']);
        exit;
    }

    // Read payload body
    $raw_body = file_get_contents('php://input');

    if (strlen($raw_body) > 5 * 1024 * 1024) { // 5MB limit
        http_response_code(413);
        echo json_encode(['error' => 'Payload too large']);
        exit;
    }

    $data = json_decode($raw_body, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload: ' . json_last_error_msg()]);
        exit;
    }

    // Handle AdminGate login check ping
    if (is_array($data) && isset($data['__ping'])) {
        echo json_encode(['success' => true, 'ping' => true]);
        exit;
    }

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Expected a JSON array of family profiles']);
        exit;
    }

    // Validate profiles array structure
    foreach ($data as $i => $profile) {
        if (empty($profile['pid']) || empty($profile['firstName']) || empty($profile['gender'])) {
            http_response_code(400);
            echo json_encode(['error' => "Profile at index $i is missing required fields (pid, firstName, gender)"]);
            exit;
        }
    }

    // Create target directory if it doesn't exist (for custom home directories)
    $dir = dirname(DATA_FILE);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            http_response_code(500);
            echo json_encode(['error' => "Failed to create database directory: $dir"]);
            exit;
        }
    }

    // Backup existing file before overwriting
    if (file_exists(DATA_FILE)) {
        $backup_file = DATA_FILE . '.bak';
        copy(DATA_FILE, $backup_file);
    }

    // Write using atomic temp file pattern to prevent file truncation/corruption on crash
    $temp_file = DATA_FILE . '.tmp';
    $written = file_put_contents(
        $temp_file,
        json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );

    if ($written === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to write data to temporary file. Check folder permissions.']);
        exit;
    }

    if (!rename($temp_file, DATA_FILE)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to replace database file atomically. Check permissions.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'profiles_saved' => count($data),
        'bytes_written' => $written,
        'timestamp' => date('c')
    ]);
    exit;
}
?>
