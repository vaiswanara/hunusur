/**
 * Vamsha API Layer
 * Handles all communication with the remote data store.
 *
 * - fetchProfiles()         → GET  https://vaiswanara.com/vamsha_db/data.json
 * - saveProfiles(data, pwd) → POST https://vaiswanara.com/vamsha_db/save.php
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// In production this fetches from your server.
// In dev (localhost) it also fetches from the live server so you always
// have real data. Change to '/src/data.json' if you want local fallback.
const IS_DEV = import.meta.env.DEV;

/**
 * Resolves the backend database API endpoint dynamically.
 * Priority:
 * 1. Runtime window.VAMSHA_CONFIG.apiUrl (editable in compiled index.html)
 * 2. Build-time environment variable VITE_API_URL
 * 3. Default relative path '../vamsha_db/api.php'
 * @returns {string} resolved URL
 */
export function getApiUrl() {
  let url = '';
  if (window.VAMSHA_CONFIG && window.VAMSHA_CONFIG.apiUrl) {
    url = window.VAMSHA_CONFIG.apiUrl;
  } else if (import.meta.env.VITE_API_URL) {
    url = import.meta.env.VITE_API_URL;
  } else if (typeof window !== 'undefined' && window.location.hostname.endsWith('.pages.dev')) {
    url = '/api';
  } else {
    url = '../vamsha_db/api.php';
  }

  // Prepend base URL to relative data.json paths to handle React Router subpaths correctly
  if (url === './data.json' || url === 'data.json') {
    const base = import.meta.env.BASE_URL || '/';
    return `${base.endsWith('/') ? base : base + '/'}data.json`;
  }

  return url;
}

/**
 * Checks if the application is running in static hosting mode (no PHP backend).
 * Returns true if not in DEV mode and the API URL points to a JSON file.
 * @returns {boolean}
 */
export function isStaticHosting() {
  if (IS_DEV) return false;
  const url = getApiUrl();
  return url.endsWith('.json') || url.includes('data.json');
}

export function getSettingsUrl() {
  if (IS_DEV) return '/vamsha_db/settings.json';
  const api = getApiUrl();
  if (api.endsWith('.json')) {
    return api;
  }
  return api.includes('?') ? `${api}&action=get_settings` : `${api}?action=get_settings`;
}

export function getSaveSettingsUrl() {
  if (IS_DEV) return '/api/save_settings';
  const api = getApiUrl();
  if (api.endsWith('.json')) return api;
  return api.includes('?') ? `${api}&action=save_settings` : `${api}?action=save_settings`;
}

export function getHistoryUrl() {
  if (IS_DEV) return '/api/history';
  const api = getApiUrl();
  if (api.endsWith('.json')) return api;
  return api.includes('?') ? `${api}&action=get_history` : `${api}?action=get_history`;
}

export function getClearHistoryUrl() {
  if (IS_DEV) return '/api/clear_history';
  const api = getApiUrl();
  if (api.endsWith('.json')) return api;
  return api.includes('?') ? `${api}&action=clear_history` : `${api}?action=clear_history`;
}

export function getBulkMapLocalUrl() {
  if (IS_DEV) return '/api/bulk_map_local';
  const api = getApiUrl();
  if (api.endsWith('.json')) return api;
  return api.includes('?') ? `${api}&action=bulk_map_local` : `${api}?action=bulk_map_local`;
}

export function getBulkMapCloudinaryUrl() {
  if (IS_DEV) return '/api/bulk_map_cloudinary';
  const api = getApiUrl();
  if (api.endsWith('.json')) return api;
  return api.includes('?') ? `${api}&action=bulk_map_cloudinary` : `${api}?action=bulk_map_cloudinary`;
}

export function getDownloadPhotoUrl() {
  if (IS_DEV) return '/api/download_photo';
  const api = getApiUrl();
  if (api.endsWith('.json')) return api;
  return api.includes('?') ? `${api}&action=download_photo` : `${api}?action=download_photo`;
}

export function getUploadUrl() {
  if (IS_DEV) return '/api/upload';
  const api = getApiUrl();
  return api;
}

export const DATA_URL = IS_DEV
  ? '/vamsha_db/data.json'
  : getApiUrl();

export const SAVE_URL = IS_DEV
  ? '/api/save'
  : getApiUrl();

// ─── FETCH PROFILES ──────────────────────────────────────────────────────────

/**
 * Load all profiles from server.
 * Falls back to empty array on error.
 * @param {string} [password] - authentication password
 * @returns {Promise<Array>}
 */
export async function fetchProfiles(password) {
  const url = IS_DEV
    ? '/vamsha_db/data.json'
    : getApiUrl();

  const headers = {};
  if (password) {
    headers['X-Family-Password'] = password;
    headers['X-Admin-Password'] = password;
  }

  const res = await fetch(url, {
    cache: 'no-cache',    // always get latest data
    headers
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch profiles: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    data.activeBranchId = res.headers.get('X-Active-Branch-Id') || null;
    data.activeBranchRootPid = res.headers.get('X-Active-Branch-Root-Pid') || null;
  }
  return data;
}

// ─── SAVE PROFILES ───────────────────────────────────────────────────────────

/**
 * Save all profiles to server (admin only).
 * @param {Array}  profiles  - full profiles array to save
 * @param {string} password  - admin password (sent as header, not in URL)
 * @returns {Promise<{success: boolean, profiles_saved: number}>}
 */
export async function saveProfiles(profiles, password) {
  const url = IS_DEV
    ? '/api/save'
    : getApiUrl();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': password,      // sent as header, not exposed in URL
    },
    body: JSON.stringify(profiles),
  });

  const data = await res.json();

  if (!res.ok) {
    // PHP returned an error
    throw new Error(data.error || `Save failed: ${res.status}`);
  }

  return data;
}

/**
 * Fetch all pending self-submissions (Admin only).
 * @param {string} password - admin password
 * @returns {Promise<Array>}
 */
export async function getPendingSubmissions(password) {
  const url = IS_DEV ? '/api/pending?action=get_pending' : `${getApiUrl()}?action=get_pending&adminPassword=${encodeURIComponent(password)}`;
  const res = await fetch(url, {
    headers: {
      'X-Admin-Password': password
    }
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch submissions: ${res.status}`);
  }
  return res.json();
}

/**
 * Submit a new profile for moderation (Family/Admin only).
 * @param {FormData} formData - form values and file
 * @param {string} familyPassword - family or admin password
 * @returns {Promise<{success: boolean, pendingId: string}>}
 */
export async function submitPendingProfile(formData, familyPassword) {
  const url = IS_DEV ? '/api/pending' : getApiUrl();
  formData.append('familyPassword', familyPassword);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Family-Password': familyPassword
    },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit details');
  }
  return data;
}

/**
 * Delete a pending submission (Admin only).
 * @param {string} pendingId - target pending submission ID
 * @param {string} adminPassword - admin password
 * @returns {Promise<{success: boolean}>}
 */
export async function deletePendingSubmission(pendingId, adminPassword) {
  const url = IS_DEV ? '/api/pending' : getApiUrl();
  const formData = new FormData();
  formData.append('action', 'delete_pending');
  formData.append('pendingId', pendingId);
  formData.append('adminPassword', adminPassword);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Admin-Password': adminPassword
    },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete submission');
  }
  return data;
}

/**
 * Fetch settings configuration from the backend dynamically.
 * Automatically handles local settings mock vs live PHP endpoints,
 * and includes authorization headers if available in storage.
 * @returns {Promise<Object>} settings object
 */
export async function fetchSettings() {
  if (IS_DEV) {
    const res = await fetch('/vamsha_db/settings.json?t=' + Date.now());
    if (!res.ok) throw new Error('Failed to load local settings');
    return res.json();
  }

  const api = getApiUrl();
  const settingsUrl = api.includes('?') ? `${api}&action=get_settings` : `${api}?action=get_settings`;
  const password = sessionStorage.getItem('vamsha_admin_pwd') || localStorage.getItem('vamsha_decrypt_pwd') || '';
  
  const headers = {};
  if (password) {
    headers['X-Admin-Password'] = password;
    headers['X-Family-Password'] = password;
  }

  const res = await fetch(settingsUrl + '&t=' + Date.now(), {
    headers
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch settings: ${res.status}`);
  }
  return res.json();
}

/**
 * Get profile ID prefix dynamically.
 * Priority: runtime window config -> build-time env config -> fallback "PID"
 * @returns {string} ID prefix
 */
export function getPidPrefix() {
  return window.VAMSHA_CONFIG?.pidPrefix || import.meta.env.VITE_PID_PREFIX || 'PID';
}


