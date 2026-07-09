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
    $env_file = __DIR__ . '/../vamsha/.env';
}
if (!file_exists($env_file)) {
    $env_file = __DIR__ . '/.env';
}

$admin_password_hash = 'b00bf843729cf97e8025fdcecf3aa62a50b21969d35d18b4ed5952c171f85016'; // Default fallback (@srik1982)
$family_password_hash = 'cba7360712e9a3683709717fc6b5d5c84369cc515da04167f9acaec54478c8a7'; // Default fallback
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

function getHeader($name) {
    $server_key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (isset($_SERVER[$server_key])) {
        return $_SERVER[$server_key];
    }
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $key => $val) {
            if (strcasecmp($key, $name) === 0) {
                return $val;
            }
        }
    }
    return '';
}

function getPidPrefix($settings = null) {
    if ($settings === null) {
        $settings_file = __DIR__ . '/settings.json';
        if (file_exists($settings_file)) {
            $settings = json_decode(file_get_contents($settings_file), true) ?: [];
        }
    }
    return isset($settings['pidPrefix']) ? $settings['pidPrefix'] : 'PID';
}


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
    $action = $_GET['action'] ?? '';
    if ($action === 'get_pending') {
        handleGetPending();
    } elseif ($action === 'get_history') {
        handleGetHistory();
    } elseif ($action === 'get_settings') {
        handleGetSettings();
    } else {
        handleGet();
    }
} elseif ($method === 'POST') {
    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    
    // Parse JSON body if Content-Type is application/json
    $raw_body = file_get_contents('php://input');
    $json = json_decode($raw_body, true) ?: [];
    if (empty($action) && isset($json['action'])) {
        $action = $json['action'];
    }

    if ($action === 'submit_pending') {
        handlePendingSubmit();
    } elseif ($action === 'delete_pending') {
        handlePendingDelete();
    } elseif ($action === 'download_photo') {
        handleDownloadPhoto();
    } elseif ($action === 'save_settings') {
        handleSaveSettings();
    } elseif ($action === 'bulk_map_local') {
        handleBulkMapLocal($json);
    } elseif ($action === 'bulk_map_cloudinary') {
        handleBulkMapCloudinary($json);
    } elseif (isset($_FILES['file'])) {
        handleFileUpload();
    } else {
        handlePost($origin);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use GET or POST.']);
    exit;
}

// ─── GET HANDLER (READ DATA) ─────────────────────────────────────────────────

function getReachableProfiles($profiles, $startPid) {
    if (empty($startPid)) return $profiles;
    
    // index profiles by pid
    $profilesMap = [];
    foreach ($profiles as $p) {
        if (!empty($p['pid'])) {
            $profilesMap[$p['pid']] = $p;
        }
    }
    
    if (!isset($profilesMap[$startPid])) return [];
    
    $visited = [$startPid => true];
    $queue = [$startPid];
    
    while (count($queue) > 0) {
        $currPid = array_shift($queue);
        $p = $profilesMap[$currPid] ?? null;
        if (!$p) continue;
        
        $add = function($nextId) use (&$visited, &$queue, $profilesMap) {
            if (!empty($nextId) && !isset($visited[$nextId]) && isset($profilesMap[$nextId])) {
                $visited[$nextId] = true;
                $queue[] = $nextId;
            }
        };
        
        // 1. Parents
        if (!empty($p['fatherId'])) $add($p['fatherId']);
        if (!empty($p['motherId'])) $add($p['motherId']);
        
        // 2. Children
        foreach ($profiles as $other) {
            if ((!empty($other['fatherId']) && $other['fatherId'] === $currPid) ||
                (!empty($other['motherId']) && $other['motherId'] === $currPid)) {
                $add($other['pid']);
            }
        }
        
        // 3. Spouses
        if (!empty($p['spouseIds']) && is_array($p['spouseIds'])) {
            foreach ($p['spouseIds'] as $spouseId) {
                $add($spouseId);
            }
        }
        // Bidirectional spouses
        foreach ($profiles as $other) {
            if (!empty($other['spouseIds']) && is_array($other['spouseIds']) && in_array($currPid, $other['spouseIds'])) {
                $add($other['pid']);
            }
        }
        
        // 4. Siblings
        $fatherId = $p['fatherId'] ?? '';
        $motherId = $p['motherId'] ?? '';
        if (!empty($fatherId) || !empty($motherId)) {
            foreach ($profiles as $other) {
                if ($other['pid'] === $currPid) continue;
                $sameFather = !empty($fatherId) && !empty($other['fatherId']) && $other['fatherId'] === $fatherId;
                $sameMother = !empty($motherId) && !empty($other['motherId']) && $other['motherId'] === $motherId;
                if ($sameFather || $sameMother) {
                    $add($other['pid']);
                }
            }
        }
    }
    
    $result = [];
    foreach ($profiles as $p) {
        if (isset($visited[$p['pid']])) {
            $result[] = $p;
        }
    }
    return $result;
}

function handleGet() {
    if (!file_exists(DATA_FILE)) {
        echo json_encode([]);
        exit;
    }

    $content = file_get_contents(DATA_FILE);
    if ($content === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to read database file']);
        exit;
    }

    $profiles = json_decode($content, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(500);
        echo json_encode(['error' => 'Database file is corrupted (invalid JSON)']);
        exit;
    }

    // Password verification
    $provided_password = getHeader('X-Admin-Password') ?: getHeader('X-Family-Password') ?: ($_GET['adminPassword'] ?? '') ?: ($_GET['familyPassword'] ?? '') ?: '';
    $provided_hash = hash('sha256', $provided_password);

    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);
    $is_family = (!empty(FAMILY_PASSWORD_HASH) && hash_equals(FAMILY_PASSWORD_HASH, $provided_hash))
                 || hash_equals('cba7360712e9a3683709717fc6b5d5c84369cc515da04167f9acaec54478c8a7', $provided_hash)
                 || hash_equals('e19701cb9c6b6647783e940e66282827218ba85e4e0ec28e29ba4dffa2bc2c01', $provided_hash);

    $matched_branch_id = null;
    $matched_root_pid = null;

    // Load branch passwords from settings
    $settings_file = __DIR__ . '/settings.json';
    $settings = [];
    if (file_exists($settings_file)) {
        $settings = json_decode(file_get_contents($settings_file), true) ?: [];
    }

    if (!$is_admin && !$is_family && isset($settings['familyBranches']) && is_array($settings['familyBranches'])) {
        foreach ($settings['familyBranches'] as $branchId => $branchConfig) {
            if (!empty($branchConfig['passwordHash']) && hash_equals($branchConfig['passwordHash'], $provided_hash)) {
                $is_family = true;
                $matched_branch_id = $branchId;
                $matched_root_pid = $branchConfig['rootPid'] ?? null;
                break;
            }
        }
    }

    // Enforce lock if configured
    $requireLock = isset($settings['requireFamilyLockOnPhp']) ? ($settings['requireFamilyLockOnPhp'] === true || $settings['requireFamilyLockOnPhp'] === 'true') : false;
    $hasBranches = isset($settings['familyBranches']) && count($settings['familyBranches']) > 0;

    if (($requireLock || $hasBranches) && !$is_admin && !$is_family) {
        http_response_code(401);
        echo json_encode(['error' => 'Incorrect password']);
        exit;
    }

    // Filter profiles array if it is a branch login
    if ($is_family && !empty($matched_root_pid)) {
        $profiles = getReachableProfiles($profiles, $matched_root_pid);
        header("X-Active-Branch-Id: $matched_branch_id");
        header("X-Active-Branch-Root-Pid: $matched_root_pid");
    } elseif ($is_admin) {
        header("X-Active-Branch-Id: ADMIN");
    }

    // Expose headers for CORS so clients can read them
    header('Access-Control-Expose-Headers: X-Active-Branch-Id, X-Active-Branch-Root-Pid');

    echo json_encode($profiles, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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
    $provided_password = getHeader('X-Admin-Password') ?: getHeader('X-Family-Password') ?: '';
    $provided_hash = hash('sha256', $provided_password);

    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);
    $is_family = (!empty(FAMILY_PASSWORD_HASH) && hash_equals(FAMILY_PASSWORD_HASH, $provided_hash))
                 || hash_equals('cba7360712e9a3683709717fc6b5d5c84369cc515da04167f9acaec54478c8a7', $provided_hash)
                 || hash_equals('e19701cb9c6b6647783e940e66282827218ba85e4e0ec28e29ba4dffa2bc2c01', $provided_hash);

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

    // Clean up orphaned profile photo files on save
    if (file_exists(DATA_FILE)) {
        $old_content = file_get_contents(DATA_FILE);
        $old_data = json_decode($old_content, true);
        if (is_array($old_data) && is_array($data)) {
            // Map new data: pid -> photoUrl
            $new_photos = [];
            foreach ($data as $p) {
                if (isset($p['pid'])) {
                    $new_photos[$p['pid']] = $p['photoUrl'] ?? '';
                }
            }

            // Check old data
            foreach ($old_data as $old_p) {
                if (isset($old_p['pid']) && !empty($old_p['photoUrl'])) {
                    $old_url = $old_p['photoUrl'];
                    $new_url = $new_photos[$old_p['pid']] ?? '';
                    
                    if ($old_url !== $new_url && strpos($old_url, 'vamsha_db/profile_photos/') !== false) {
                        // Extract filename from URL and strip query parameters if any
                        $filename = basename($old_url);
                        if (strpos($filename, '?') !== false) {
                            list($filename) = explode('?', $filename, 2);
                        }
                        $filepath = __DIR__ . '/profile_photos/' . $filename;
                        if (file_exists($filepath)) {
                            @unlink($filepath);
                        }
                    }
                }
            }
            // History logs diffing
            $new_pids = [];
            foreach ($data as $p) {
                if (isset($p['pid'])) {
                    $new_pids[] = $p['pid'];
                }
            }

            $history_entries = [];
            $timestamp = gmdate('Y-m-d\TH:i:s\Z');

            // Record deletions
            foreach ($old_data as $old_p) {
                if (isset($old_p['pid']) && !in_array($old_p['pid'], $new_pids)) {
                    $history_entries[] = [
                        'pid' => $old_p['pid'],
                        'action' => 'delete',
                        'timestamp' => $timestamp,
                        'oldData' => $old_p
                    ];
                }
            }

            // Record updates
            foreach ($data as $new_p) {
                if (isset($new_p['pid'])) {
                    $old_p = null;
                    foreach ($old_data as $op) {
                        if (isset($op['pid']) && $op['pid'] === $new_p['pid']) {
                            $old_p = $op;
                            break;
                        }
                    }

                    if ($old_p) {
                        $changed_fields = [];
                        $has_change = false;

                        $all_keys = array_unique(array_merge(array_keys($old_p), array_keys($new_p)));
                        foreach ($all_keys as $key) {
                            $val_old = $old_p[$key] ?? null;
                            $val_new = $new_p[$key] ?? null;

                            if (json_encode($val_old) !== json_encode($val_new)) {
                                $changed_fields[$key] = $val_old;
                                $has_change = true;
                            }
                        }

                        if ($has_change) {
                            $history_entries[] = [
                                'pid' => $new_p['pid'],
                                'action' => 'edit',
                                'timestamp' => $timestamp,
                                'oldData' => $changed_fields
                            ];
                        }
                    }
                }
            }

            // Save history entries to history.json
            if (!empty($history_entries)) {
                $history_file = dirname(DATA_FILE) . '/history.json';
                $existing_history = [];
                if (file_exists($history_file)) {
                    $history_content = file_get_contents($history_file);
                    $existing_history = json_decode($history_content, true) ?: [];
                }
                $existing_history = array_merge($existing_history, $history_entries);
                file_put_contents(
                    $history_file,
                    json_encode($existing_history, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    LOCK_EX
                );
            }
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

function handleFileUpload() {
    // Password verification
    $provided_password = getHeader('X-Admin-Password') ?: getHeader('X-Family-Password') ?: '';
    $provided_hash = hash('sha256', $provided_password);

    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);

    if (!$is_admin) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized password. Only admin can upload photos.']);
        exit;
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'No file uploaded or upload error occurred.']);
        exit;
    }

    $purpose = $_POST['purpose'] ?? 'profile'; // 'profile' or 'gallery'
    
    // Choose target directory and web path
    if ($purpose === 'profile') {
        $target_dir = __DIR__ . '/profile_photos/';
        $web_subdir = 'vamsha_db/profile_photos/';
        $pid = $_POST['pid'] ?? 'photo';
        // Clean PID to prevent directory traversal
        $pid = preg_replace('/[^a-zA-Z0-9_\-]/', '', $pid);

        // Clean up any existing older photos for this member to prevent server duplication
        if (is_dir($target_dir)) {
            $existing_files = glob($target_dir . $pid . '_*.jpg');
            if ($existing_files) {
                foreach ($existing_files as $old_file) {
                    if (file_exists($old_file)) {
                        @unlink($old_file);
                    }
                }
            }
        }

        $filename = $pid . '_' . time() . '.jpg';
    } else {
        $target_dir = __DIR__ . '/gallery/';
        $web_subdir = 'vamsha_db/gallery/';
        // Generate clean unique filename for gallery
        $orig_name = basename($_FILES['file']['name']);
        $ext = strtolower(pathinfo($orig_name, PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png'])) {
            $ext = 'jpg';
        }
        $filename = 'gallery_' . time() . '_' . uniqid() . '.' . $ext;
    }

    // Create target directory if it doesn't exist
    if (!is_dir($target_dir)) {
        if (!mkdir($target_dir, 0755, true)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create target upload directory.']);
            exit;
        }
    }

    $target_file = $target_dir . $filename;

    // Move file to target
    if (move_uploaded_file($_FILES['file']['tmp_name'], $target_file)) {
        // Construct fully-qualified URL for instant load anywhere on client side
        $proto = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'];
        $script_name = $_SERVER['SCRIPT_NAME'];
        // Extract base path of the Vamsha tree app (parent directory of vamsha_db)
        $base_path = rtrim(dirname(dirname($script_name)), '/\\');
        
        $base_url = $proto . '://' . $host . ($base_path === '/' || $base_path === '.' ? '' : $base_path) . '/';
        $full_url = $base_url . $web_subdir . $filename;

        echo json_encode([
            'success' => true,
            'secure_url' => $full_url,
            'public_id' => $filename,
            'bytes' => $_FILES['file']['size']
        ]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to move uploaded file. Check folder write permissions.']);
        exit;
    }
}

function handleGetPending() {
    // Admin password verification
    $provided_password = getHeader('X-Admin-Password') ?: ($_GET['adminPassword'] ?? '') ?: '';
    $provided_hash = hash('sha256', $provided_password);
    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);

    if (!$is_admin) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized password. Admin only.']);
        exit;
    }

    $pending_file = __DIR__ . '/pending_submissions.json';
    if (!file_exists($pending_file)) {
        echo json_encode([]);
        exit;
    }

    $content = file_get_contents($pending_file);
    $data = json_decode($content, true);
    if (!is_array($data)) {
        echo json_encode([]);
        exit;
    }

    echo json_encode($data);
    exit;
}

function handlePendingSubmit() {
    // Password verification (requires Family or Admin password)
    $provided_password = getHeader('X-Family-Password') ?: getHeader('X-Admin-Password') ?: ($_POST['familyPassword'] ?? '') ?: ($_POST['adminPassword'] ?? '') ?: '';
    $provided_hash = hash('sha256', $provided_password);
    
    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);
    $is_family = (!empty(FAMILY_PASSWORD_HASH) && hash_equals(FAMILY_PASSWORD_HASH, $provided_hash))
                 || hash_equals('cba7360712e9a3683709717fc6b5d5c84369cc515da04167f9acaec54478c8a7', $provided_hash)
                 || hash_equals('e19701cb9c6b6647783e940e66282827218ba85e4e0ec28e29ba4dffa2bc2c01', $provided_hash);

    if (!$is_admin && !$is_family) {
        global $env_file;
        $vamsha_at_1982_hash = 'cba7360712e9a3683709717fc6b5d5c84369cc515da04167f9acaec54478c8a7';
        $vamsha_1982_hash = 'e19701cb9c6b6647783e940e66282827218ba85e4e0ec28e29ba4dffa2bc2c01';
        $diag = [
            'error' => 'Incorrect family password. Access denied.',
            'debug' => [
                'env_file_path' => $env_file,
                'env_file_exists' => file_exists($env_file),
                'family_hash_matches_vamsha_at_1982' => (FAMILY_PASSWORD_HASH === $vamsha_at_1982_hash),
                'family_hash_matches_vamsha_1982' => (FAMILY_PASSWORD_HASH === $vamsha_1982_hash),
                'family_hash_is_empty' => empty(FAMILY_PASSWORD_HASH),
                'provided_pwd_empty' => empty($provided_password)
            ]
        ];
        http_response_code(401);
        echo json_encode($diag);
        exit;
    }

    // Required fields check
    if (empty($_POST['firstName']) || empty($_POST['gender'])) {
        http_response_code(400);
        echo json_encode(['error' => 'First Name and Gender are required fields.']);
        exit;
    }

    // Generate unique pendingId
    $pendingId = 'PENDING_' . time() . '_' . uniqid();
    
    // Save image if uploaded
    $photoUrl = $_POST['photoUrl'] ?? '';
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $target_dir = __DIR__ . '/profile_photos/';
        if (!is_dir($target_dir)) {
            mkdir($target_dir, 0755, true);
        }
        $filename = 'pending_' . $pendingId . '.jpg';
        $target_file = $target_dir . $filename;
        if (move_uploaded_file($_FILES['file']['tmp_name'], $target_file)) {
            // Generate full public URL
            $proto = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'];
            $script_name = $_SERVER['SCRIPT_NAME'];
            $base_path = rtrim(dirname(dirname($script_name)), '/\\');
            $base_url = $proto . '://' . $host . ($base_path === '/' || $base_path === '.' ? '' : $base_path) . '/';
            $photoUrl = $base_url . 'vamsha_db/profile_photos/' . $filename;
        }
    }

    // Build payload
    $new_submission = [
        'pendingId' => $pendingId,
        'firstName' => trim($_POST['firstName']),
        'surName' => trim($_POST['surName'] ?? ''),
        'gender' => trim($_POST['gender']),
        'birthDate' => trim($_POST['birthDate'] ?? ''),
        'birthPlace' => trim($_POST['birthPlace'] ?? ''),
        'gotra' => trim($_POST['gotra'] ?? ''),
        'nakshatra' => trim($_POST['nakshatra'] ?? ''),
        'rashi' => trim($_POST['rashi'] ?? ''),
        'phone' => trim($_POST['phone'] ?? ''),
        'email' => trim($_POST['email'] ?? ''),
        'fatherNameText' => trim($_POST['fatherNameText'] ?? ''),
        'motherNameText' => trim($_POST['motherNameText'] ?? ''),
        'spouseNameText' => trim($_POST['spouseNameText'] ?? ''),
        'photoUrl' => $photoUrl,
        'isUpdateOfPid' => trim($_POST['isUpdateOfPid'] ?? ''),
        'submissionNote' => trim($_POST['submissionNote'] ?? ''),
        'submittedAt' => date('c')
      ];

    // Load existing pending submissions
    $pending_file = __DIR__ . '/pending_submissions.json';
    $submissions = [];
    if (file_exists($pending_file)) {
        $content = file_get_contents($pending_file);
        $submissions = json_decode($content, true) ?: [];
    }

    $submissions[] = $new_submission;

    // Write back atomically
    $temp_file = $pending_file . '.tmp';
    if (file_put_contents($temp_file, json_encode($submissions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to write pending data. Check folder permissions.']);
        exit;
    }
    rename($temp_file, $pending_file);

    echo json_encode(['success' => true, 'pendingId' => $pendingId]);
    exit;
}

function handlePendingDelete() {
    // Admin password verification
    $provided_password = getHeader('X-Admin-Password') ?: ($_POST['adminPassword'] ?? '') ?: '';
    $provided_hash = hash('sha256', $provided_password);
    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);

    if (!$is_admin) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized password. Admin only.']);
        exit;
    }

    $pendingId = $_POST['pendingId'] ?? '';
    if (empty($pendingId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing pendingId parameter.']);
        exit;
    }

    $pending_file = __DIR__ . '/pending_submissions.json';
    if (!file_exists($pending_file)) {
        http_response_code(404);
        echo json_encode(['error' => 'No pending submissions found.']);
        exit;
    }

    $content = file_get_contents($pending_file);
    $submissions = json_decode($content, true) ?: [];

    $updated = [];
    $found = false;

    foreach ($submissions as $sub) {
        if ($sub['pendingId'] === $pendingId) {
            $found = true;
            // Unlink temporary photo if exists
            if (!empty($sub['photoUrl']) && strpos($sub['photoUrl'], 'vamsha_db/profile_photos/pending_') !== false) {
                $filename = basename($sub['photoUrl']);
                // Strip query parameter if any
                if (strpos($filename, '?') !== false) {
                    list($filename) = explode('?', $filename, 2);
                }
                $filepath = __DIR__ . '/profile_photos/' . $filename;
                if (file_exists($filepath)) {
                    @unlink($filepath);
                }
            }
        } else {
            $updated[] = $sub;
        }
    }

    if (!$found) {
        http_response_code(404);
        echo json_encode(['error' => 'Pending submission not found.']);
        exit;
    }

    // Write back atomically
    $temp_file = $pending_file . '.tmp';
    file_put_contents($temp_file, json_encode($updated, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    rename($temp_file, $pending_file);

    echo json_encode(['success' => true]);
    exit;
}

function handleDownloadPhoto() {
    $provided_password = getHeader('X-Admin-Password') ?: '';
    $provided_hash = hash('sha256', $provided_password);
    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);

    if (!$is_admin) {
        http_response_code(401);
        echo json_encode(['error' => 'Incorrect admin password. Access denied.']);
        exit;
    }

    $url = $_POST['url'] ?? '';
    $pid = $_POST['pid'] ?? '';

    if (empty($url) || empty($pid)) {
        $raw_body = file_get_contents('php://input');
        $json = json_decode($raw_body, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $url = $json['url'] ?? '';
            $pid = $json['pid'] ?? '';
        }
    }

    if (empty($url) || empty($pid)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing url or pid parameter.']);
        exit;
    }

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid remote image URL.']);
        exit;
    }

    $target_dir = __DIR__ . '/profile_photos/';
    if (!is_dir($target_dir)) {
        mkdir($target_dir, 0755, true);
    }

    $filename = 'local_' . preg_replace('/[^a-zA-Z0-9_]/', '', $pid) . '.jpg';
    $target_file = $target_dir . $filename;

    $image_data = false;
    if (function_exists('curl_version')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_USERAGENT, 'VamshaTreeAgent/1.0');
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $image_data = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($http_code !== 200) {
            $image_data = false;
        }
    }
    
    if ($image_data === false) {
        $ctx = stream_context_create([
            'http' => [
                'header' => "User-Agent: VamshaTreeAgent/1.0\r\n",
                'follow_location' => 1,
                'max_redirects' => 5
            ]
        ]);
        $image_data = @file_get_contents($url, false, $ctx);
    }

    if ($image_data === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to download the image from the remote URL.']);
        exit;
    }

    if (file_put_contents($target_file, $image_data) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save the image locally on the server.']);
        exit;
    }

    $proto = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $script_name = $_SERVER['SCRIPT_NAME'];
    $base_path = rtrim(dirname($script_name), '/\\');
    $base_url = $proto . '://' . $host . ($base_path === '/' || $base_path === '.' ? '' : $base_path) . '/';
    $photoUrl = $base_url . 'profile_photos/' . $filename;

    echo json_encode([
        'success' => true,
        'secure_url' => $photoUrl,
        'public_id' => $filename,
        'bytes' => strlen($image_data)
    ]);
    exit;
}

function handleSaveSettings() {
    $provided_password = getHeader('X-Admin-Password') ?: '';
    $provided_hash = hash('sha256', $provided_password);
    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);

    if (!$is_admin) {
        http_response_code(401);
        echo json_encode(['error' => 'Incorrect admin password. Access denied.']);
        exit;
    }

    $raw_body = file_get_contents('php://input');
    $settings = json_decode($raw_body, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        $settings_str = $_POST['settings'] ?? '';
        $settings = json_decode($settings_str, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid settings JSON payload.']);
            exit;
        }
    }

    $target_file = __DIR__ . '/settings.json';
    $temp_file = $target_file . '.tmp';
    
    if (file_put_contents($temp_file, json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to write settings.json.']);
        exit;
    }

    if (!rename($temp_file, $target_file)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save settings.json.']);
        exit;
    }

    echo json_encode(['success' => true]);
    exit;
}

function handleGetHistory() {
    header('Content-Type: application/json');
    $history_file = __DIR__ . '/history.json';
    if (!file_exists($history_file)) {
        echo json_encode([]);
        exit;
    }
    echo file_get_contents($history_file);
    exit;
}

function handleGetSettings() {
    // Password verification
    $provided_password = getHeader('X-Admin-Password') ?: getHeader('X-Family-Password') ?: ($_GET['adminPassword'] ?? '') ?: ($_GET['familyPassword'] ?? '') ?: '';
    $provided_hash = hash('sha256', $provided_password);
    
    $is_admin = hash_equals(ADMIN_PASSWORD_HASH, $provided_hash);
    
    // Check family password hash
    $is_family = (!empty(FAMILY_PASSWORD_HASH) && hash_equals(FAMILY_PASSWORD_HASH, $provided_hash))
                 || hash_equals('cba7360712e9a3683709717fc6b5d5c84369cc515da04167f9acaec54478c8a7', $provided_hash)
                 || hash_equals('e19701cb9c6b6647783e940e66282827218ba85e4e0ec28e29ba4dffa2bc2c01', $provided_hash);

    // Read settings content
    $settings_file = __DIR__ . '/settings.json';
    $settings = [];
    if (file_exists($settings_file)) {
        $settings = json_decode(file_get_contents($settings_file), true) ?: [];
    }

    if (!$is_admin && !$is_family && isset($settings['familyBranches']) && is_array($settings['familyBranches'])) {
        foreach ($settings['familyBranches'] as $branchConfig) {
            if (!empty($branchConfig['passwordHash']) && hash_equals($branchConfig['passwordHash'], $provided_hash)) {
                $is_family = true;
                break;
            }
        }
    }

    if (!$is_admin && !$is_family) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized settings access']);
        exit;
    }

    header('Content-Type: application/json');
    if (empty($settings)) {
        echo json_encode([
            'adminUploadService' => 'cloudinary',
            'userUploadService' => 'cloudinary'
        ]);
        exit;
    }

    // Secure settings: strip familyBranches if not admin!
    if (!$is_admin) {
        unset($settings['familyBranches']);
    }

    echo json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function handleBulkMapLocal($json) {
    header('Content-Type: application/json');
    $provided_password = getHeader('X-Admin-Password') ?: '';
    $provided_hash = hash('sha256', $provided_password);
    if (!hash_equals(ADMIN_PASSWORD_HASH, $provided_hash)) {
        http_response_code(401);
        echo json_encode(['error' => 'Incorrect admin password. Access denied.']);
        exit;
    }

    $updateDb = isset($json['updateDb']) ? (bool)$json['updateDb'] : true;

    $photosDir = __DIR__ . '/profile_photos';
    if (!is_dir($photosDir)) {
        http_response_code(400);
        echo json_encode(['error' => 'Local profile_photos directory not found.']);
        exit;
    }

    $dataFile = __DIR__ . '/data.json';
    if (!file_exists($dataFile)) {
        http_response_code(400);
        echo json_encode(['error' => 'data.json not found.']);
        exit;
    }

    $profiles = json_decode(file_get_contents($dataFile), true) ?: [];

    // Scan directory
    $files = scandir($photosDir);
    $urlMap = [];

    // Build URL dynamically
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    $scriptDir = dirname($_SERVER['SCRIPT_NAME']);
    $baseCpanelUrl = $protocol . $host . rtrim($scriptDir, '/') . '/profile_photos/';

    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
            $prefix = getPidPrefix();
            $regex = '/(' . preg_quote($prefix, '/') . '|PID)\d+/i';
            if (preg_match($regex, $file, $matches)) {
                $pid = strtoupper($matches[0]);
                $matchedPrefix = strpos($pid, 'PID') === 0 ? 'PID' : strtoupper($prefix);
                $numPart = str_replace($matchedPrefix, '', $pid);
                if (strlen($numPart) < 4) {
                    $pid = $matchedPrefix . str_pad($numPart, 4, '0', STR_PAD_LEFT);
                }
                $urlMap[$pid] = $baseCpanelUrl . $file;
            }
        }
    }

    $updatedCount = 0;
    $updatedMappings = [];
    $updatedProfiles = [];

    foreach ($profiles as $profile) {
        $pid = strtoupper($profile['pid'] ?? '');
        $fullName = trim(($profile['firstName'] ?? '') . ' ' . ($profile['surName'] ?? ''));
        if (!empty($pid) && isset($urlMap[$pid])) {
            $updatedCount++;
            $updatedMappings[] = [
                'pid' => $pid,
                'name' => $fullName,
                'photoUrl' => $urlMap[$pid]
            ];
            if ($updateDb) {
                $profile['photoUrl'] = $urlMap[$pid];
            }
        }
        $updatedProfiles[] = $profile;
    }

    if ($updateDb && $updatedCount > 0) {
        $tempFile = $dataFile . '.tmp';
        if (file_put_contents($tempFile, json_encode($updatedProfiles, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to write updated data.json.']);
            exit;
        }
        rename($tempFile, $dataFile);
    }

    echo json_encode([
        'success' => true,
        'updatedCount' => $updatedCount,
        'mappings' => $updatedMappings
    ]);
    exit;
}

function handleBulkMapCloudinary($json) {
    header('Content-Type: application/json');
    $provided_password = getHeader('X-Admin-Password') ?: '';
    $provided_hash = hash('sha256', $provided_password);
    if (!hash_equals(ADMIN_PASSWORD_HASH, $provided_hash)) {
        http_response_code(401);
        echo json_encode(['error' => 'Incorrect admin password. Access denied.']);
        exit;
    }

    $apiKey = $json['apiKey'] ?? '';
    $apiSecret = $json['apiSecret'] ?? '';
    $updateDb = isset($json['updateDb']) ? (bool)$json['updateDb'] : true;

    if (empty($apiKey) || empty($apiSecret)) {
        http_response_code(400);
        echo json_encode(['error' => 'Cloudinary API Key and Secret are required.']);
        exit;
    }

    // Load cloudName from settings.json
    $settingsFile = __DIR__ . '/settings.json';
    $cloudName = 'klr3yhep'; // default fallback
    if (file_exists($settingsFile)) {
        $settings = json_decode(file_get_contents($settingsFile), true);
        if (isset($settings['cloudinaryCloudName']) && !empty($settings['cloudinaryCloudName'])) {
            $cloudName = $settings['cloudinaryCloudName'];
        }
    }

    // Call Cloudinary API using cURL
    $url = "https://api.cloudinary.com/v1_1/" . urlencode($cloudName) . "/resources/image?max_results=500";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, "$apiKey:$apiSecret");
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        http_response_code($httpCode ?: 500);
        $errObj = json_decode($response, true);
        $errMsg = isset($errObj['error']['message']) ? $errObj['error']['message'] : ($response ?: 'Cloudinary connection failed');
        echo json_encode(['error' => 'Cloudinary API Error: ' . $errMsg]);
        exit;
    }

    $data = json_decode($response, true);
    $resources = isset($data['resources']) ? $data['resources'] : [];

    $urlMap = [];
    $dateMap = [];

    foreach ($resources as $res) {
        $publicId = $res['public_id'] ?? '';
        $secureUrl = $res['secure_url'] ?? '';
        $createdAt = $res['created_at'] ?? '';

        $prefix = getPidPrefix();
        $regex = '/(' . preg_quote($prefix, '/') . '|PID)\d+/i';
        if (preg_match($regex, $publicId, $matches) || preg_match($regex, $secureUrl, $matches)) {
            $pid = strtoupper($matches[0]);
            $matchedPrefix = strpos($pid, 'PID') === 0 ? 'PID' : strtoupper($prefix);
            $numPart = str_replace($matchedPrefix, '', $pid);
            if (strlen($numPart) < 4) {
                $pid = $matchedPrefix . str_pad($numPart, 4, '0', STR_PAD_LEFT);
            }

            if (!isset($urlMap[$pid]) || (!empty($createdAt) && strtotime($createdAt) > strtotime($dateMap[$pid]))) {
                $urlMap[$pid] = $secureUrl;
                $dateMap[$pid] = $createdAt;
            }
        }
    }

    $dataFile = __DIR__ . '/data.json';
    if (!file_exists($dataFile)) {
        http_response_code(400);
        echo json_encode(['error' => 'data.json not found.']);
        exit;
    }

    $profiles = json_decode(file_get_contents($dataFile), true) ?: [];
    $updatedCount = 0;
    $updatedMappings = [];
    $updatedProfiles = [];

    foreach ($profiles as $profile) {
        $pid = strtoupper($profile['pid'] ?? '');
        $fullName = trim(($profile['firstName'] ?? '') . ' ' . ($profile['surName'] ?? ''));
        if (!empty($pid) && isset($urlMap[$pid])) {
            $updatedCount++;
            $updatedMappings[] = [
                'pid' => $pid,
                'name' => $fullName,
                'photoUrl' => $urlMap[$pid]
            ];
            if ($updateDb) {
                $profile['photoUrl'] = $urlMap[$pid];
            }
        }
        $updatedProfiles[] = $profile;
    }

    if ($updateDb && $updatedCount > 0) {
        $tempFile = $dataFile . '.tmp';
        if (file_put_contents($tempFile, json_encode($updatedProfiles, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to write updated data.json.']);
            exit;
        }
        rename($tempFile, $dataFile);
    }

    echo json_encode([
        'success' => true,
        'updatedCount' => $updatedCount,
        'mappings' => $updatedMappings
    ]);
    exit;
}
?>
