// Vamsha Runtime Configuration Guide
//
// Open this file in Notepad or any text editor to change settings.
//
// 1. Leave apiUrl blank ("") to use the default relative path (../vamsha_db/api.php).
// 2. Set apiUrl to a full URL (e.g. "https://vaiswanara.com/vamsha_db/api.php") to use a remote server.
// 3. For read-only static hosting (like GitHub Pages without a PHP server), set apiUrl to "./data.json".
window.VAMSHA_CONFIG = {
  apiUrl: "./data.json", // Set to "" for default relative path, or full URL for remote server, or "./data.json" for static hosting

  // Administrator Contact Details (Shown on password lock screen)
  adminContactEmail: "vaiswanara@gmail.com", // Add admin email here (e.g. "example@mail.com")
  adminContactPhone: "+91 9482094290", // Add admin phone here (e.g. "+91 98765 43210")

  // For Static Hosting (e.g. GitHub Pages): You can set/change the admin password hash here
  // so you don't need to rebuild the project when changing passwords.
  // Leave empty to use the default hash from build-time (.env) configuration.
  adminPasswordHash: "",

  // For Static Hosting (e.g. GitHub Pages): You can set/change the family password hash here
  // to protect the tree. Leave empty to use default/unlocked mode if database is unencrypted.
  familyPasswordHash: "",

  // Set to true if you want to require the family password on PHP server deployment too.
  requireFamilyLockOnPhp: false
};

