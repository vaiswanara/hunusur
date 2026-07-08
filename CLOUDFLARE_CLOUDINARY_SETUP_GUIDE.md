# Vamsha (వంశ) — Cloudflare & Cloudinary Deployment Guide

Vamsha is a multilingual family tree application. This guide explains step-by-step how to deploy and configure it for **Cloudflare Pages (with KV database & Cloudinary uploads)** and **GitHub Pages (static encrypted hosting)** so you can easily set it up for other family members or friends in the future.

---

## 🌳 Deployment Method 1: Cloudflare Pages + KV + Cloudinary (Recommended)

This method deploys the application with a serverless backend. It allows you to dynamically read/write family data using a Cloudflare KV database, upload profile photos directly to Cloudinary, and manage the tree in real-time from the admin panel.

### Part 1: GitHub Repository Setup
1. Push the entire project source code (not just the compiled `dist` folder) to your GitHub repository.
2. Ensure your repository root has the following structure:
   ```text
   Your-Repository (Root)
   ├── functions/
   │   └── api.js             <-- IMPORTANT: The serverless KV backend script
   ├── public/
   │   ├── _redirects         <-- IMPORTANT: For Single Page App routing
   │   └── config.js          <-- Runtime configs
   ├── src/                   <-- React components & assets
   ├── package.json
   ├── vite.config.js
   └── ...
   ```

> [!NOTE]
> The `public/_redirects` file must contain exactly:
> `/* /index.html 200`
> This prevents 404 errors when reloading subpages like `/tree` or `/dashboard`.

---

### Part 2: Cloudflare Pages Configuration
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select your repository and branch (`main`).
4. In the **Build settings** section, configure:
   - **Framework preset:** `None` or `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** Leave empty `/` (since files are at the root of the repository).
5. Click **Save and Deploy**.

---

### Part 3: Setting up the Cloudflare KV Database
1. In the Cloudflare Dashboard, go to **Workers & Pages** > **KV**.
2. Click **Create namespace**.
3. Enter a namespace name (e.g., `vamsha-kv`) and click **Add**.
4. Now, go back to **Workers & Pages** > Select your Pages project.
5. Go to **Settings** > **Functions** > Scroll to **KV namespace bindings**.
6. Under **Production** (and optionally **Preview**), click **Add binding**:
   - **Variable name:** `VAMSHA_KV` (Must be exactly uppercase `VAMSHA_KV`).
   - **KV namespace:** Select your newly created namespace (e.g., `vamsha-kv`).
7. Click **Save**.

---

### Part 4: Setting up Cloudinary for Image Uploads
To let the app upload photos directly from the browser to Cloudinary, configure an **Unsigned Upload Preset**:

1. Sign up for a free account at [Cloudinary](https://cloudinary.com).
2. Go to your **Console Dashboard** and copy your **Cloud Name** (e.g. `xoh8xwy1`).
3. Click the **Settings (⚙️ Gear Icon)** in the bottom left corner.
4. Select the **Upload** settings tab.
5. Scroll down to **Upload presets** and click **Add upload preset**.
6. Configure the following fields:
   - **Upload preset name:** Give it a clear name (e.g., `VITE_CLOUDINARY_UPLOAD_PRESET`).
   - **Signing Mode:** Change from **Signed** to **Unsigned** (Critical!).
   - **Folder:** Set to `vamsha` (Optional: keeps photos in a dedicated folder).
7. Leave all other options at their defaults and click **Save** (top right).

---

### Part 5: Setting Cloudflare Pages Environment Variables
Now, add the environment variables to Cloudflare Pages so they are injected during builds and runtime:

1. In your Pages project, go to **Settings** > **Environment variables**.
2. Under **Production**, click **Add variables** and add:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `/api` | Tells the frontend to route database calls to the Cloudflare Worker. |
| `VITE_UPLOAD_SERVICE` | `cloudinary` | Tells the frontend to use Cloudinary for profile photo uploads. |
| `VITE_CLOUDINARY_CLOUD_NAME` | *(Your Cloud Name)* | Your Cloudinary account cloud name. |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | *(Your Preset Name)* | The name of the Unsigned Preset you created (e.g. `VITE_CLOUDINARY_UPLOAD_PRESET`). |
| `VITE_ADMIN_PASSWORD_HASH` | *(SHA-256 Hash)* | Hashed password for logging into the admin page (e.g. `b8ffa75cdfcd...`). |
| `ADMIN_PASSWORD` | *(SHA-256 Hash)* | The exact same SHA-256 hash (used by the backend API to verify saves). |
| `FAMILY_PASSWORD` | *(SHA-256 Hash)* | Optional. SHA-256 hash of the family password if you want the tree locked. |

3. Click **Save**.

> [!TIP]
> **Generating a SHA-256 Hash:** 
> You can convert a plain-text password to a SHA-256 hash using online converters or via command line.
> - Hashing `admin` gives: `8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918`
> - Hashing `vamsha` gives: `fa3659cf7d7a1262d989f66453957242861c80b27b34e4020a597a760c410c51`

---

### Part 6: Configuring `public/config.js`
In the root directory of your project, edit `/public/config.js` to ensure runtime values do not block the KV backend:
```javascript
window.VAMSHA_CONFIG = {
  apiUrl: "",           // Leave blank ("") so it auto-detects Cloudflare Pages URL
  adminContactEmail: "your-email@example.com",
  adminContactPhone: "+91 XXXXX XXXXX",
  adminPasswordHash: "", // Leave blank to fallback to environment variables
  familyPasswordHash: "", // Leave blank to fallback to environment variables
  requireFamilyLockOnPhp: false
};
```
Push the modified `config.js` to GitHub.

---

### Part 7: Final Deployment and Data Initialization
1. Go to the **Deployments** tab of your Pages project, click your latest successful deployment, and click **Redeploy** (or push a new commit to trigger a build).
2. Go to **Workers & Pages** > **KV** > Open your namespace (`vamsha-kv`).
3. Click **Add key**:
   - **Key:** `profiles`
   - **Value:** Paste the contents of your local `data.json` file (if you have existing data). If you want a blank start, paste `[]`.
4. Click **Save**.
5. Visit your deployment URL (e.g., `https://katuru.pages.dev`). Your family tree is live and editable!

---
---

## 🔒 Deployment Method 2: Zero-Cost Static Hosting (GitHub Pages)

Use this method if you do not want to use Cloudflare KV or Cloudinary. The database (`data.json`) will be encrypted client-side using AES-GCM (Web Crypto API) and served purely as static files.

### Step 1: Configure `public/config.js`
Modify `/public/config.js` in your repository:
```javascript
window.VAMSHA_CONFIG = {
  apiUrl: "./data.json", // Tells the app to load the static JSON file
  familyPasswordHash: "fa3659cf7d7a1262d989f66453957242861c80b27b34e4020a597a760c410c51", // SHA-256 hash of password
  adminPasswordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",  // SHA-256 hash of admin
  adminContactEmail: "admin@example.com",
  adminContactPhone: "+91 98765 43210"
};
```

### Step 2: Encrypt your Data (Optional)
If you want the database to be secure, you can encrypt your `data.json` using the built-in encryption feature in Vamsha's local development environment before pushing, or let the family password decrypt the files.

### Step 3: Activate GitHub Pages
1. Push your compiled code (`dist/` directory) to a branch (e.g., `gh-pages` or `main`).
2. Go to your GitHub repository > **Settings** > **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch and choose the folder (usually `/root` or `/docs`).
4. Click **Save**. Your static, encrypted family tree will be live at `https://<username>.github.io/<repo-name>`.

---

## 🛠️ Troubleshooting & Caching Tips

### Browser Caching & Service Workers
Vamsha utilizes Service Workers to enable offline capabilities. When you deploy a new update, the browser may still load the cached older version.
- **Force update:** Press `Ctrl` + `F5` (or `Ctrl` + `Shift` + `R`) on desktops.
- **Inspect/Clear data:** On Chrome, press `F12` > go to **Application** > **Storage** > click **Clear site data**.
- **Private Browsing:** Open the site in an Incognito/Private window to test the latest deploy without cache conflicts.
