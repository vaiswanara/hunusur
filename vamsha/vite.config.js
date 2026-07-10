import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'

function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  
  let searchIndex = 0;
  while (true) {
    const start = buffer.indexOf(boundaryBuf, searchIndex);
    if (start === -1) break;
    
    const nextBoundaryStart = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (nextBoundaryStart === -1) break;
    
    const partStart = start + boundaryBuf.length + 2;
    const partEnd = nextBoundaryStart - 2;
    
    if (partStart < partEnd) {
      const partBuffer = buffer.subarray(partStart, partEnd);
      const headerEnd = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
      
      if (headerEnd !== -1) {
        const headersStr = partBuffer.subarray(0, headerEnd).toString('utf8');
        const bodyBuffer = partBuffer.subarray(headerEnd + 4);
        
        const headers = {};
        headersStr.split('\r\n').forEach(line => {
          const parts = line.split(': ');
          if (parts.length === 2) {
            headers[parts[0].toLowerCase()] = parts[1];
          }
        });
        
        const contentDisp = headers['content-disposition'] || '';
        const nameMatch = contentDisp.match(/name="([^"]+)"/);
        const filenameMatch = contentDisp.match(/filename="([^"]+)"/);
        
        if (nameMatch) {
          parts.push({
            name: nameMatch[1],
            filename: filenameMatch ? filenameMatch[1] : null,
            contentType: headers['content-type'] || null,
            data: bodyBuffer
          });
        }
      }
    }
    
    searchIndex = nextBoundaryStart;
  }
  return parts;
}

const saveDataPlugin = () => ({
  name: 'save-data-plugin',
  configureServer(server) {
    // 1. Serve files inside the local vamsha_db directory dynamically
    server.middlewares.use('/vamsha_db', (req, res, next) => {
      const cleanUrl = req.url.split('?')[0];
      const filePath = path.resolve(__dirname, '../vamsha_db', cleanUrl.replace(/^\//, ''));
      
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.json') mime = 'application/json';
        else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
        else if (ext === '.png') mime = 'image/png';
        else if (ext === '.gif') mime = 'image/gif';
        
        res.setHeader('Content-Type', mime);
        res.statusCode = 200;
        res.end(fs.readFileSync(filePath));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'File not found' }));
      }
    });

    // 2. Save active profiles directly into ../vamsha_db/data.json
    server.middlewares.use('/api/save', (req, res, next) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            
            // Handle AdminGate password verification ping locally
            if (parsed && parsed.__ping) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, ping: true }));
              return;
            }

            const dataPath = path.resolve(__dirname, '../vamsha_db/data.json');
            
            // 1. Audit logs: compare with existing database to record history entries
            let oldProfiles = [];
            if (fs.existsSync(dataPath)) {
              try {
                const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                if (Array.isArray(rawData)) {
                  oldProfiles = rawData;
                }
              } catch (err) {
                console.error("Failed to parse existing data.json:", err);
              }
            }

            const newPids = new Set(parsed.map(p => p.pid));
            const deletedProfiles = oldProfiles.filter(p => !newPids.has(p.pid));
            const historyEntries = [];
            const timestamp = new Date().toISOString();

            // Record deletions
            deletedProfiles.forEach(oldProfile => {
              historyEntries.push({
                pid: oldProfile.pid,
                action: 'delete',
                timestamp,
                oldData: oldProfile
              });
            });

            // Record updates
            parsed.forEach(newProfile => {
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

            // Write history entries to history.json
            if (historyEntries.length > 0) {
              const historyPath = path.resolve(__dirname, '../vamsha_db/history.json');
              let existingHistory = [];
              if (fs.existsSync(historyPath)) {
                try {
                  existingHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                } catch (err) {
                  console.error("Failed to parse history.json:", err);
                }
              }
              existingHistory = [...existingHistory, ...historyEntries];
              fs.writeFileSync(historyPath, JSON.stringify(existingHistory, null, 2), 'utf8');
            }

            fs.writeFileSync(dataPath, JSON.stringify(parsed, null, 2), 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, profiles_saved: parsed.length }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        next();
      }
    });

    // 3. Upload & crop image handler saving directly to ../vamsha_db/profile_photos
    server.middlewares.use('/api/upload', (req, res, next) => {
      if (req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'No boundary in content-type' }));
          return;
        }
        
        const boundary = boundaryMatch[1];
        let bodyChunks = [];
        req.on('data', chunk => {
          bodyChunks.push(chunk);
        });
        req.on('end', () => {
          try {
            const buffer = Buffer.concat(bodyChunks);
            const parts = parseMultipart(buffer, boundary);
            
            const filePart = parts.find(p => p.filename);
            if (!filePart) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'No file uploaded' }));
              return;
            }
            
            const photosDir = path.resolve(__dirname, '../vamsha_db/profile_photos');
            if (!fs.existsSync(photosDir)) {
              fs.mkdirSync(photosDir, { recursive: true });
            }
            
            const ext = path.extname(filePart.filename) || '.jpg';
            const filename = `uploaded_${Date.now()}${ext}`;
            const filePath = path.join(photosDir, filename);
            
            fs.writeFileSync(filePath, filePart.data);
            
            const host = req.headers.host || 'localhost:5173';
            const secureUrl = `http://${host}/vamsha_db/profile_photos/${filename}`;
            
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              secure_url: secureUrl,
              public_id: filename,
              bytes: filePart.data.length
            }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        next();
      }
    });

    // 3.5. Download remote photo to local server (for hybrid workflow)
    server.middlewares.use('/api/download_photo', (req, res, next) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body);
            const imageUrl = parsed.url;
            const pid = parsed.pid;
            
            if (!imageUrl || !pid) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing url or pid parameter' }));
              return;
            }
            
            const client = imageUrl.startsWith('https') ? https : http;
            
            const photosDir = path.resolve(__dirname, '../vamsha_db/profile_photos');
            if (!fs.existsSync(photosDir)) {
              fs.mkdirSync(photosDir, { recursive: true });
            }
            
            const filename = `local_${pid}.jpg`;
            const filePath = path.join(photosDir, filename);
            
            const downloadImage = (url) => {
              return new Promise((resolve, reject) => {
                const reqGet = client.get(url, (response) => {
                  if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    const redirClient = redirectUrl.startsWith('https') ? https : http;
                    redirClient.get(redirectUrl, (redResp) => {
                      const chunks = [];
                      redResp.on('data', (c) => chunks.push(c));
                      redResp.on('end', () => resolve(Buffer.concat(chunks)));
                    }).on('error', reject);
                  } else {
                    const chunks = [];
                    response.on('data', (c) => chunks.push(c));
                    response.on('end', () => resolve(Buffer.concat(chunks)));
                  }
                });
                reqGet.on('error', reject);
              });
            };
            
            const imageBuffer = await downloadImage(imageUrl);
            fs.writeFileSync(filePath, imageBuffer);
            
            const host = req.headers.host || 'localhost:5173';
            const secureUrl = `http://${host}/vamsha_db/profile_photos/${filename}`;
            
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              secure_url: secureUrl,
              public_id: filename,
              bytes: imageBuffer.length
            }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        next();
      }
    });

    // 3.7. Save runtime settings
    server.middlewares.use('/api/save_settings', (req, res, next) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const settingsFile = path.resolve(__dirname, '../vamsha_db/settings.json');
            fs.writeFileSync(settingsFile, JSON.stringify(parsed, null, 2), 'utf8');
            
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        next();
      }
    });

    // 3.71. Bulk Map Local Photos
    server.middlewares.use('/api/bulk_map_local', (req, res, next) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const updateDb = parsed.updateDb !== false;

            const photosDir = path.resolve(__dirname, '../vamsha_db/profile_photos');
            const dataPath = path.resolve(__dirname, '../vamsha_db/data.json');

            if (!fs.existsSync(photosDir)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'profile_photos folder not found locally.' }));
              return;
            }

            if (!fs.existsSync(dataPath)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'data.json not found locally.' }));
              return;
            }

            let profiles = [];
            try {
              const rawProfiles = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
              if (Array.isArray(rawProfiles)) {
                profiles = rawProfiles;
              }
            } catch (err) {
              console.error("Failed to parse data.json for mapping:", err);
            }
            const files = fs.readdirSync(photosDir);
            const urlMap = {};

            const host = req.headers.host || 'localhost:5173';
            const baseLocalUrl = `http://${host}/vamsha_db/profile_photos/`;

            files.forEach(file => {
              const ext = path.extname(file).toLowerCase();
              if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                const match = file.match(/PID\d+/i);
                if (match) {
                  let pid = match[0].toUpperCase();
                  const numPart = pid.replace('PID', '');
                  if (numPart.length < 4) {
                    pid = 'PID' + numPart.padStart(4, '0');
                  }
                  urlMap[pid] = baseLocalUrl + file;
                }
              }
            });

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
                if (updateDb) {
                  return { ...profile, photoUrl: urlMap[pid] };
                }
              }
              return profile;
            });

            if (updateDb && updatedCount > 0) {
              fs.writeFileSync(dataPath, JSON.stringify(updatedProfiles, null, 2), 'utf8');
            }

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              updatedCount,
              mappings: updatedMappings
            }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        next();
      }
    });

    // 3.72. Bulk Map Cloudinary Photos
    server.middlewares.use('/api/bulk_map_cloudinary', (req, res, next) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const apiKey = parsed.apiKey || '';
            const apiSecret = parsed.apiSecret || '';
            const updateDb = parsed.updateDb !== false;

            if (!apiKey || !apiSecret) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Cloudinary credentials are required.' }));
              return;
            }

            // Load cloudName from settings.json
            const settingsFile = path.resolve(__dirname, '../vamsha_db/settings.json');
            let cloudName = 'klr3yhep';
            if (fs.existsSync(settingsFile)) {
              try {
                const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
                if (settings.cloudinaryCloudName) cloudName = settings.cloudinaryCloudName;
              } catch (err) {}
            }

            // Make HTTPS request to Cloudinary list resources API
            const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
            const options = {
              hostname: 'api.cloudinary.com',
              path: `/v1_1/${cloudName}/resources/image?max_results=500`,
              method: 'GET',
              headers: {
                'Authorization': `Basic ${auth}`,
                'User-Agent': 'VamshaTreeAgent/1.0'
              }
            };

            const reqCloud = https.request(options, (resCloud) => {
              let bodyCloud = '';
              resCloud.on('data', chunk => bodyCloud += chunk);
              resCloud.on('end', () => {
                if (resCloud.statusCode !== 200) {
                  res.statusCode = resCloud.statusCode || 500;
                  try {
                    const errObj = JSON.parse(bodyCloud);
                    res.end(JSON.stringify({ error: errObj.error?.message || bodyCloud }));
                  } catch (e) {
                    res.end(JSON.stringify({ error: bodyCloud }));
                  }
                  return;
                }

                try {
                  const dataCloud = JSON.parse(bodyCloud);
                  const resources = dataCloud.resources || [];
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

                  const dataPath = path.resolve(__dirname, '../vamsha_db/data.json');
                  if (!fs.existsSync(dataPath)) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'data.json not found locally.' }));
                    return;
                  }

                  let profiles = [];
                  try {
                    const rawProfiles = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                    if (Array.isArray(rawProfiles)) {
                      profiles = rawProfiles;
                    }
                  } catch (err) {
                    console.error("Failed to parse data.json for bulk mapping:", err);
                  }
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
                      if (updateDb) {
                        return { ...profile, photoUrl: urlMap[pid] };
                      }
                    }
                    return profile;
                  });

                  if (updateDb && updatedCount > 0) {
                    fs.writeFileSync(dataPath, JSON.stringify(updatedProfiles, null, 2), 'utf8');
                  }

                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify({
                    success: true,
                    updatedCount,
                    mappings: updatedMappings
                  }));

                } catch (e) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to parse Cloudinary response: ' + e.message }));
                }
              });
            });

            reqCloud.on('error', (err) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Cloudinary connection error: ' + err.message }));
            });

            reqCloud.end();

          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        next();
      }
    });

    // 3.8. Fetch edit history logs
    server.middlewares.use('/api/history', (req, res, next) => {
      res.setHeader('Content-Type', 'application/json');
      const historyFile = path.resolve(__dirname, '../vamsha_db/history.json');
      
      if (req.method === 'GET') {
        let history = [];
        if (fs.existsSync(historyFile)) {
          try {
            history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
          } catch (e) {
            console.error("Failed to read history.json:", e);
          }
        }
        res.statusCode = 200;
        res.end(JSON.stringify(history));
      } else {
        next();
      }
    });

    // 4. Pending self-submissions read/write directly inside ../vamsha_db/pending_submissions.json
    server.middlewares.use('/api/pending', (req, res, next) => {
      res.setHeader('Content-Type', 'application/json');
      const pendingFile = path.resolve(__dirname, '../vamsha_db/pending_submissions.json');

      if (req.method === 'GET') {
        let submissions = [];
        if (fs.existsSync(pendingFile)) {
          try {
            submissions = JSON.parse(fs.readFileSync(pendingFile, 'utf8')) || [];
          } catch (e) {
            submissions = [];
          }
        }
        res.statusCode = 200;
        res.end(JSON.stringify(submissions));
      } else if (req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'No boundary in content-type' }));
          return;
        }
        
        const boundary = boundaryMatch[1];
        let bodyChunks = [];
        req.on('data', chunk => {
          bodyChunks.push(chunk);
        });
        req.on('end', () => {
          try {
            const buffer = Buffer.concat(bodyChunks);
            const parts = parseMultipart(buffer, boundary);
            
            const fields = {};
            let filePart = null;
            
            parts.forEach(p => {
              if (p.filename) {
                filePart = p;
              } else {
                fields[p.name] = p.data.toString('utf8');
              }
            });
            
            const action = fields.action || '';
            let submissions = [];
            if (fs.existsSync(pendingFile)) {
              try {
                submissions = JSON.parse(fs.readFileSync(pendingFile, 'utf8')) || [];
              } catch (e) {
                submissions = [];
              }
            }
            
            if (action === 'submit_pending') {
              const pendingId = 'PENDING_mock_' + Date.now();
              let photoUrl = '';
              
              if (filePart && filePart.data.length > 0) {
                const photosDir = path.resolve(__dirname, '../vamsha_db/profile_photos');
                if (!fs.existsSync(photosDir)) {
                  fs.mkdirSync(photosDir, { recursive: true });
                }
                const ext = path.extname(filePart.filename) || '.jpg';
                const filename = `pending_${pendingId}${ext}`;
                const filePath = path.join(photosDir, filename);
                
                fs.writeFileSync(filePath, filePart.data);
                
                const host = req.headers.host || 'localhost:5173';
                photoUrl = `http://${host}/vamsha_db/profile_photos/${filename}`;
              }
              
              const newSubmission = {
                pendingId,
                firstName: fields.firstName || '',
                surName: fields.surName || '',
                gender: fields.gender || 'Male',
                birthDate: fields.birthDate || '',
                birthPlace: fields.birthPlace || '',
                gotra: fields.gotra || '',
                nakshatra: fields.nakshatra || '',
                rashi: fields.rashi || '',
                phone: fields.phone || '',
                email: fields.email || '',
                fatherNameText: fields.fatherNameText || '',
                motherNameText: fields.motherNameText || '',
                spouseNameText: fields.spouseNameText || '',
                photoUrl: photoUrl || fields.photoUrl || '',
                isUpdateOfPid: fields.isUpdateOfPid || '',
                submittedAt: new Date().toISOString()
              };
              submissions.push(newSubmission);
              fs.writeFileSync(pendingFile, JSON.stringify(submissions, null, 2), 'utf8');
              
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, pendingId }));
            } else if (action === 'delete_pending') {
              const deleteId = fields.pendingId || '';
              
              const target = submissions.find(s => s.pendingId === deleteId);
              if (target && target.photoUrl && target.photoUrl.includes('/vamsha_db/profile_photos/')) {
                const parts = target.photoUrl.split('/');
                const filename = parts[parts.length - 1];
                const filePath = path.resolve(__dirname, '../vamsha_db/profile_photos', filename);
                if (fs.existsSync(filePath)) {
                  try { fs.unlinkSync(filePath); } catch(err) {}
                }
              }
              
              submissions = submissions.filter(s => s.pendingId !== deleteId);
              fs.writeFileSync(pendingFile, JSON.stringify(submissions, null, 2), 'utf8');
              
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Unknown pending action: ' + action }));
            }
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        next();
      }
    });
  }
});


const copyEnvPlugin = () => ({
  name: 'copy-env-plugin',
  closeBundle() {
    try {
      const src = path.resolve(__dirname, '.env');
      const dest = path.resolve(__dirname, 'dist/.env');
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log('✅ .env file successfully copied to dist/ folder!');
      }
    } catch (err) {
      console.error('❌ Failed to copy .env file to dist/:', err.message);
    }
  }
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Cloudflare Pages automatically sets CF_PAGES=1. 
  // Cloudflare always serves from root, so we force base to '/' there.
  // Otherwise, we use the local env variable VITE_BASE_URL or default to '/vamsha/'.
  const isCloudflare = process.env.CF_PAGES === '1' || env.CF_PAGES === '1';
  const base = command === 'serve' ? '/' : (isCloudflare ? '/' : (env.VITE_BASE_URL || '/vamsha/'));

  return {
    // Local development runs on '/' while production builds for subdirectory VITE_BASE_URL
    base: base,

    server: {
      host: true
    },

    plugins: [
      react(),
      saveDataPlugin(),
      copyEnvPlugin(),

      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          runtimeCaching: [
            {
              // Cache external profile pictures (GitHub raw URLs or others)
              urlPattern: /^https:\/\/.*\/photos\/.*\.(?:png|jpg|jpeg|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'vamsha-external-photos',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Cache local uploaded images (if served from same host)
              urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'vamsha-local-photos',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
                }
              }
            }
          ]
        },
        includeAssets: [
          'favicon.svg',
          'icons/male_icon.png',
          'icons/female_icon.png',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-maskable-512.png',
          'icons/splash.png',
        ],
        manifest: {
          name: `${env.VITE_APP_TITLE || 'Vamsha'} - Family Tree`,
          short_name: env.VITE_APP_TITLE || 'Vamsha',
          description: `${env.VITE_APP_TITLE || 'Vamsha'} Traditional Family Tree`,
          theme_color: '#63131D',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: base,
          scope: base,
          orientation: 'portrait',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      })
    ],
  };
})

