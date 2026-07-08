/**
 * Vamsha Cloudflare Pages Functions API Handler
 * Handles all tree operations (Profiles, History, Submissions, Cloudinary)
 * powered by Cloudflare KV namespace and Cloudinary.
 */

// Helper to hash passwords to SHA-256 for comparisons
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to generate Cloudinary signature
async function generateCloudinarySignature(params, apiSecret) {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&') + apiSecret;

  const encoder = new TextEncoder();
  const data = encoder.encode(paramString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check authorization headers or query parameters
async function isAuthorized(request, env, role = 'family') {
  const adminPasswordHash = env.ADMIN_PASSWORD || '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // default: admin
  const familyPasswordHash = env.FAMILY_PASSWORD || 'fa3659cf7d7a1262d989f66453957242861c80b27b34e4020a597a760c410c51'; // default: vamsha

  // Extract from headers
  const authHeaderAdmin = request.headers.get('X-Admin-Password') || '';
  const authHeaderFamily = request.headers.get('X-Family-Password') || '';

  // Extract from URL query params
  const url = new URL(request.url);
  const queryAdmin = url.searchParams.get('adminPassword') || '';
  const queryFamily = url.searchParams.get('familyPassword') || '';

  const inputAdmin = authHeaderAdmin || queryAdmin;
  const inputFamily = authHeaderFamily || queryFamily;

  if (inputAdmin) {
    const hashed = await sha256(inputAdmin);
    if (hashed === adminPasswordHash) return true;
  }

  if (role === 'family' && inputFamily) {
    const hashed = await sha256(inputFamily);
    if (hashed === familyPasswordHash || hashed === adminPasswordHash) return true;
  }

  return false;
}

// Upload file helper to Cloudinary (signed upload)
async function uploadToCloudinary(fileBlob, cloudName, apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureParams = { timestamp };
  const signature = await generateCloudinarySignature(signatureParams, apiSecret);

  const uploadFormData = new FormData();
  uploadFormData.append('file', fileBlob);
  uploadFormData.append('api_key', apiKey);
  uploadFormData.append('timestamp', timestamp.toString());
  uploadFormData.append('signature', signature);

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const uploadRes = await fetch(cloudinaryUrl, {
    method: 'POST',
    body: uploadFormData
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  return uploadRes.json();
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const action = url.searchParams.get('action') || '';

  // Initialize KV Namespace check
  const KV = env.VAMSHA_KV;
  if (!KV) {
    return new Response(JSON.stringify({ error: 'Cloudflare KV namespace "VAMSHA_KV" is not bound to this project.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── GET ROUTER ───────────────────────────────────────────────────────────
    if (method === 'GET') {
      if (action === 'get_pending') {
        if (!await isAuthorized(request, env, 'admin')) {
          return new Response(JSON.stringify({ error: 'Unauthorized admin credentials.' }), { status: 401, headers: corsHeaders });
        }
        let pending = await KV.get('pending') || '[]';
        try {
          JSON.parse(pending);
        } catch (e) {
          await KV.delete('pending');
          pending = '[]';
        }
        return new Response(pending, { headers: corsHeaders });
      }

      if (action === 'history' || action === 'get_history') {
        let history = await KV.get('history') || '[]';
        try {
          JSON.parse(history);
        } catch (e) {
          await KV.delete('history');
          history = '[]';
        }
        return new Response(history, { headers: corsHeaders });
      }

      if (action === 'get_settings' || action === 'settings') {
        let settings = await KV.get('settings');
        let isValid = false;
        if (settings) {
          try {
            JSON.parse(settings);
            isValid = true;
          } catch (e) {
            await KV.delete('settings');
            settings = null;
          }
        }
        if (!settings) {
          settings = JSON.stringify({
            adminUploadService: 'cloudinary',
            userUploadService: 'cloudinary'
          });
        }
        return new Response(settings, { headers: corsHeaders });
      }

      // Default: get profiles
      let profiles = await KV.get('profiles');
      let isProfilesValidJson = false;
      if (profiles) {
        try {
          JSON.parse(profiles);
          isProfilesValidJson = true;
        } catch (e) {
          await KV.delete('profiles');
          profiles = null;
        }
      }

      if (!profiles || !isProfilesValidJson) {
        // Fetch static data.json from site origin as fallback database initialization
        try {
          const fallbackRes = await fetch(`${url.origin}/data.json`);
          if (fallbackRes.ok) {
            const fetchedText = await fallbackRes.text();
            try {
              JSON.parse(fetchedText);
              profiles = fetchedText;
              // Pre-warm the KV store with this baseline
              await KV.put('profiles', profiles);
            } catch (jsonErr) {
              profiles = '[]';
            }
          } else {
            profiles = '[]';
          }
        } catch (err) {
          profiles = '[]';
        }
      }
      return new Response(profiles, { headers: corsHeaders });
    }

    // ─── POST ROUTER ──────────────────────────────────────────────────────────
    if (method === 'POST') {
      const contentType = request.headers.get('content-type') || '';

      // JSON parsing routes
      if (contentType.includes('application/json')) {
        const body = await request.json();

        // 1. Download image and pipe to Cloudinary
        if (body.action === 'download_photo') {
          if (!await isAuthorized(request, env, 'admin')) {
            return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: corsHeaders });
          }
          const { url: imageUrl, pid, apiKey, apiSecret, cloudName } = body;
          if (!imageUrl || !pid || !apiKey || !apiSecret || !cloudName) {
            return new Response(JSON.stringify({ error: 'Missing parameters for Cloudinary upload.' }), { status: 400, headers: corsHeaders });
          }

          const imageRes = await fetch(imageUrl);
          if (!imageRes.ok) {
            throw new Error(`Failed to fetch image from source URL: ${imageUrl}`);
          }
          const imageBlob = await imageRes.blob();
          const cloudData = await uploadToCloudinary(imageBlob, cloudName, apiKey, apiSecret);

          return new Response(JSON.stringify({
            success: true,
            secure_url: cloudData.secure_url,
            public_id: cloudData.public_id
          }), { headers: corsHeaders });
        }

        // 2. Save settings
        if (body.action === 'save_settings') {
          if (!await isAuthorized(request, env, 'admin')) {
            return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: corsHeaders });
          }
          await KV.put('settings', JSON.stringify(body));
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        // 3. Cloudinary Bulk Sync scan
        if (body.action === 'bulk_map_cloudinary') {
          if (!await isAuthorized(request, env, 'admin')) {
            return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: corsHeaders });
          }
          const { apiKey, apiSecret, cloudName, updateDb } = body;
          if (!apiKey || !apiSecret || !cloudName) {
            return new Response(JSON.stringify({ error: 'Cloudinary credentials missing.' }), { status: 400, headers: corsHeaders });
          }

          const auth = btoa(`${apiKey}:${apiSecret}`);
          const cloudinaryListUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?max_results=500`;
          
          const cloudRes = await fetch(cloudinaryListUrl, {
            headers: { 'Authorization': `Basic ${auth}` }
          });
          
          if (!cloudRes.ok) {
            const errText = await cloudRes.text();
            throw new Error(`Cloudinary API resource fetch failed: ${errText}`);
          }

          const cloudData = await cloudRes.json();
          const resources = cloudData.resources || [];
          const urlMap = {};
          const dateMap = {};

          resources.forEach(resAsset => {
            const publicId = resAsset.public_id || '';
            const secureUrl = resAsset.secure_url || '';
            const createdAt = resAsset.created_at || '';

            const match = publicId.match(/PID\d+/i) || secureUrl.match(/PID\d+/i);
            if (match) {
              let pid = match[0].toUpperCase();
              const numPart = pid.replace('PID', '');
              if (numPart.length < 4) {
                pid = 'PID' + numPart.padStart(4, '0');
              }
              if (!urlMap[pid] || (createdAt && new Date(createdAt) > new Date(dateMap[pid]))) {
                urlMap[pid] = secureUrl;
                dateMap[pid] = createdAt;
              }
            }
          });

          // Fetch profiles
          const profilesStr = await KV.get('profiles') || '[]';
          const profiles = JSON.parse(profilesStr);
          let updatedCount = 0;
          const updatedMappings = [];

          const updatedProfiles = profiles.map(profile => {
            const pid = (profile.pid || '').toUpperCase();
            const fullName = `${profile.firstName || ''} ${profile.surName || ''}`.trim();
            if (pid && urlMap[pid]) {
              updatedCount++;
              updatedMappings.push({
                pid,
                name: fullName,
                photoUrl: urlMap[pid]
              });
              if (updateDb !== false) {
                return { ...profile, photoUrl: urlMap[pid] };
              }
            }
            return profile;
          });

          if (updateDb !== false && updatedCount > 0) {
            await KV.put('profiles', JSON.stringify(updatedProfiles));
          }

          return new Response(JSON.stringify({
            success: true,
            updatedCount,
            mappings: updatedMappings
          }), { headers: corsHeaders });
        }

        // 4. Local Bulk Sync scan (not supported on serverless disk, return message)
        if (body.action === 'bulk_map_local') {
          return new Response(JSON.stringify({ error: 'Local server folder scanning is not supported in Serverless KV mode.' }), { status: 400, headers: corsHeaders });
        }

        // Default: save profiles
        if (Array.isArray(body)) {
          if (!await isAuthorized(request, env, 'admin')) {
            return new Response(JSON.stringify({ error: 'Unauthorized admin credentials.' }), { status: 401, headers: corsHeaders });
          }

          const existingProfilesStr = await KV.get('profiles') || '[]';
          const oldProfiles = JSON.parse(existingProfilesStr);
          const newPids = new Set(body.map(p => p.pid));
          const deletedProfiles = oldProfiles.filter(p => !newPids.has(p.pid));
          const historyEntries = [];
          const timestamp = new Date().toISOString();

          // Compute deletion logs
          deletedProfiles.forEach(oldProfile => {
            historyEntries.push({
              pid: oldProfile.pid,
              action: 'delete',
              timestamp,
              oldData: oldProfile
            });
          });

          // Compute modifications logs
          body.forEach(newProfile => {
            const oldProfile = oldProfiles.find(p => p.pid === newProfile.pid);
            if (oldProfile) {
              const changedFields = {};
              let hasChange = false;
              const allKeys = new Set([...Object.keys(oldProfile), ...Object.keys(newProfile)]);

              allKeys.forEach(key => {
                const valOld = oldProfile[key];
                const valNew = newProfile[key];
                if (JSON.stringify(valOld) !== JSON.stringify(valNew)) {
                  changedFields[key] = valOld !== undefined ? valOld : null;
                  hasChange = true;
                }
              });

              if (hasChange) {
                historyEntries.push({
                  pid: newProfile.pid,
                  action: 'edit',
                  timestamp,
                  oldData: changedFields
                });
              }
            }
          });

          // Write history
          if (historyEntries.length > 0) {
            const existingHistoryStr = await KV.get('history') || '[]';
            const existingHistory = JSON.parse(existingHistoryStr);
            const mergedHistory = [...existingHistory, ...historyEntries];
            await KV.put('history', JSON.stringify(mergedHistory));
          }

          await KV.put('profiles', JSON.stringify(body));
          return new Response(JSON.stringify({ success: true, profiles_saved: body.length }), { headers: corsHeaders });
        }
      }

      // FormData parsing routes (uploads and submissions)
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const action = formData.get('action') || '';

        // 1. Submit pending profile
        if (action === 'submit_pending') {
          const familyPassword = formData.get('familyPassword') || '';
          if (!await isAuthorized(request, env, 'family')) {
            return new Response(JSON.stringify({ error: 'Invalid family passcode.' }), { status: 401, headers: corsHeaders });
          }

          const file = formData.get('photo');
          let photoUrl = '';

          // Upload file directly to Cloudinary if file size is > 0
          if (file && file.size > 0) {
            const cloudName = env.CLOUDINARY_CLOUD_NAME || 'klr3yhep';
            const apiKey = env.CLOUDINARY_API_KEY || '896888396441996';
            const apiSecret = env.CLOUDINARY_API_SECRET || '';

            if (apiSecret) {
              const cloudData = await uploadToCloudinary(file, cloudName, apiKey, apiSecret);
              photoUrl = cloudData.secure_url;
            } else {
              return new Response(JSON.stringify({ error: 'Server is missing CLOUDINARY_API_SECRET configuration.' }), { status: 500, headers: corsHeaders });
            }
          }

          const pendingId = 'PENDING_' + Date.now();
          const newSubmission = {
            pendingId,
            firstName: formData.get('firstName') || '',
            surName: formData.get('surName') || '',
            gender: formData.get('gender') || 'Male',
            birthDate: formData.get('birthDate') || '',
            birthPlace: formData.get('birthPlace') || '',
            gotra: formData.get('gotra') || '',
            nakshatra: formData.get('nakshatra') || '',
            rashi: formData.get('rashi') || '',
            phone: formData.get('phone') || '',
            email: formData.get('email') || '',
            fatherNameText: formData.get('fatherNameText') || '',
            motherNameText: formData.get('motherNameText') || '',
            spouseNameText: formData.get('spouseNameText') || '',
            photoUrl: photoUrl || formData.get('photoUrl') || '',
            isUpdateOfPid: formData.get('isUpdateOfPid') || '',
            submittedAt: new Date().toISOString()
          };

          const pendingStr = await KV.get('pending') || '[]';
          const pending = JSON.parse(pendingStr);
          pending.push(newSubmission);
          await KV.put('pending', JSON.stringify(pending));

          return new Response(JSON.stringify({ success: true, pendingId }), { headers: corsHeaders });
        }

        // 2. Delete pending submission
        if (action === 'delete_pending') {
          if (!await isAuthorized(request, env, 'admin')) {
            return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: corsHeaders });
          }

          const pendingId = formData.get('pendingId') || '';
          const pendingStr = await KV.get('pending') || '[]';
          let pending = JSON.parse(pendingStr);
          pending = pending.filter(s => s.pendingId !== pendingId);
          await KV.put('pending', JSON.stringify(pending));

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        // 3. Standard file upload
        if (action === 'upload' || formData.has('file')) {
          if (!await isAuthorized(request, env, 'admin')) {
            return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: corsHeaders });
          }

          const file = formData.get('file') || formData.get('photo');
          if (!file || file.size === 0) {
            return new Response(JSON.stringify({ error: 'No file provided for upload.' }), { status: 400, headers: corsHeaders });
          }

          const cloudName = env.CLOUDINARY_CLOUD_NAME || 'klr3yhep';
          const apiKey = env.CLOUDINARY_API_KEY || '896888396441996';
          const apiSecret = env.CLOUDINARY_API_SECRET || '';

          if (!apiSecret) {
            return new Response(JSON.stringify({ error: 'Server is missing CLOUDINARY_API_SECRET configuration.' }), { status: 500, headers: corsHeaders });
          }

          const cloudData = await uploadToCloudinary(file, cloudName, apiKey, apiSecret);

          return new Response(JSON.stringify({
            success: true,
            secure_url: cloudData.secure_url,
            public_id: cloudData.public_id,
            bytes: file.size
          }), { headers: corsHeaders });
        }
      }
    }

    return new Response(JSON.stringify({ error: `Unsupported request method/action combination: ${method} ${action}` }), {
      status: 400,
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
