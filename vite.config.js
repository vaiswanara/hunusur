import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

const saveDataPlugin = () => ({
  name: 'save-data-plugin',
  configureServer(server) {
    server.middlewares.use('/api/save', (req, res, next) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            
            // Handle AdminGate password verification ping locally (always succeed in dev)
            if (parsed && parsed.__ping) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, ping: true }));
              return;
            }

            const dataPath = path.resolve(__dirname, 'src/data.json');
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

