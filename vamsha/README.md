# Vamsha (వంశ) — Multilingual Family Tree & Genealogy Portal

Vamsha is a secure, modern, self-hosted web application designed to preserve, visualize, and celebrate family lineages. It offers a rich, interactive frontend built in **React** & **Vite**, accompanied by a lightweight server-side PHP backend and optional zero-cost client-side encrypted static hosting.

With support for multiple regional languages (English, Telugu, and Kannada), astrological details, automatically computed relationships, and PWA capabilities, Vamsha is the ultimate tool for distributing and managing family histories.

---

## 🌟 Key Features

- **🌳 Interactive Lineage Trees:** Smooth, browser-rendered family trees featuring parent-child relationships, spouses, siblings, and customizable focus nodes.
- **🗣️ Fully Multilingual:** Seamless, runtime translation switching between **English**, **Telugu (తెలుగు)**, and **Kannada (ಕನ್ನಡ)**.
- **🔒 Dual Security Modes:**
  - **PHP Server Mode:** Secure admin authentication via hashed password tokens using server-side configurations.
  - **Static Encryption Mode:** Client-side AES-GCM database encryption using the Web Crypto API. Keep family data completely secure on public hosts like GitHub Pages.
- **📖 Family Memory Wall:** A digital scrapbook for family members to share stories, achievements, and childhood memories, protected by a family passcode.
- **📊 Reports & Demographic Analytics:**
  - Gotram, surname, and generation distributions.
  - Age demographics and Nakshatram/Rashi (astrological) charts.
  - Automatic relationship path solver (explains exactly how any two members are related, in the selected language!).
- **📅 Upcoming Birthday Tracker:** Countdown list of birthdays with one-click wishing via WhatsApp/Email.
- **📱 PWA Enabled:** Install the app directly onto iOS, Android, or desktop devices. Once loaded, the app works fully offline using local storage caching.
- **⚙️ Zero-Compiler Runtime Configs:** Notepad-editable `config.js` allows configuring URLs, administrator contacts, and passwords on production bundles without rebuilding from source.

---

## 🛠️ Technology Stack

- **Frontend:** React 19, React Router 7, Vite 8, Lucide React (Icons), HTML5 Canvas (`html2canvas` for exports).
- **Backend:** PHP 7.4+ (Unified Data API with atomic file writes, backup rotation, rate limiting, and CORS enforcement).
- **Security:** SHA-256 password verification, PBKDF2 key derivation, and AES-GCM (256-bit) local encryption.
- **PWA:** Vite PWA Plugin, Service Workers.

---

## 🚀 Quick Start (Local Development)

To run the application locally on your computer:

1. **Install Prerequisites:** Download and install [Node.js](https://nodejs.org/).
2. **Clone the Repository & Install Dependencies:**
   ```bash
   npm install
   ```
3. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.
4. **Compile Production Bundle:**
   ```bash
   npm run build
   ```
   The compiled frontend assets will be generated in the `dist/` directory.

---

## 📖 Deployment & User Manual

Vamsha supports multiple deployment strategies designed to make sharing and hosting simple:

1. **PHP & Apache Servers (Live Server):** Place the frontend directory and backend script on your server.
2. **GitHub Pages (Statically Encrypted):** Host for free on GitHub Pages. Encrypt your database with the built-in AES-GCM encryption system to protect personal data.

For step-by-step setup guides, environment variables, security configurations, and troubleshooting, please read our detailed **[Deployment & Operation Manual (USER_MANUAL.md)](file:///d:/CODE/Vamsha/vamsha_updated/USER_MANUAL.md)**.

---

## 📄 License
This project is shared for personal and family use. Please ensure you respect privacy laws and family consent policies before uploading names, phone numbers, or dates of birth online.
