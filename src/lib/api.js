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
  if (window.VAMSHA_CONFIG && window.VAMSHA_CONFIG.apiUrl) {
    return window.VAMSHA_CONFIG.apiUrl;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '../vamsha_db/api.php';
}

export const DATA_URL = IS_DEV
  ? `${import.meta.env.BASE_URL}src/data.json`
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
    ? `${import.meta.env.BASE_URL}src/data.json`    // served by Vite during dev
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

