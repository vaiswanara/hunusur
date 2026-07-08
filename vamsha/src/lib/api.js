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
 * @returns {Promise<Array>}
 */
export async function fetchProfiles() {
  const url = IS_DEV
    ? '/vamsha_db/data.json'
    : getApiUrl();

  const res = await fetch(url, {
    cache: 'no-cache',    // always get latest data
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch profiles: ${res.status} ${res.statusText}`);
  }

  return res.json();
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

