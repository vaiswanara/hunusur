const fs = require('fs');
const path = require('path');

// Configuration Paths
const dbPath = path.resolve(__dirname, '../vamsha_db/data.json');
const settingsPath = path.resolve(__dirname, '../vamsha_db/settings.json');
const photosDir = path.resolve(__dirname, '../data_migration/photos_update');

function runMigration() {
  console.log('--- STARTING PID STREAMLINING MIGRATION ---');

  // 1. Read data.json
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: data.json not found at ${dbPath}`);
    return;
  }
  const profiles = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log(`Loaded ${profiles.length} profiles from database.`);

  // 2. Generate new sequential PIDs mapping
  const pidMap = {};
  profiles.forEach((profile, index) => {
    const oldPid = profile.pid;
    const newPid = `PID${String(index + 1).padStart(4, '0')}`;
    pidMap[oldPid] = newPid;
  });

  console.log(`Generated mapping for ${Object.keys(pidMap).length} profiles.`);

  // 3. Update profiles database
  const updatedProfiles = profiles.map((profile) => {
    const oldPid = profile.pid;
    const newPid = pidMap[oldPid];

    const updated = { ...profile };
    updated.pid = newPid;

    // Map parent relationships
    if (profile.fatherId) {
      updated.fatherId = pidMap[profile.fatherId] || profile.fatherId;
    }
    if (profile.motherId) {
      updated.motherId = pidMap[profile.motherId] || profile.motherId;
    }

    // Map spouse relationships
    if (profile.spouseIds && Array.isArray(profile.spouseIds)) {
      updated.spouseIds = profile.spouseIds.map(sid => pidMap[sid] || sid);
    }

    // Map photo URL references
    if (profile.photoUrl) {
      // e.g. https://res.cloudinary.com/.../vamsha/PID0050_1783559987260.jpg
      // Replace "/PIDXXXX_" or "/PIDXXXX." with "/PIDYYYY_" or "/PIDYYYY."
      let updatedUrl = profile.photoUrl;
      Object.entries(pidMap).forEach(([oldId, newId]) => {
        const regex = new RegExp(`/${oldId}([_\\.])`, 'g');
        updatedUrl = updatedUrl.replace(regex, `/${newId}$1`);
      });
      updated.photoUrl = updatedUrl;
    }

    return updated;
  });

  // 4. Update settings.json active branch roots
  let settingsUpdated = false;
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.familyBranches) {
      Object.entries(settings.familyBranches).forEach(([key, config]) => {
        if (config.rootPid && pidMap[config.rootPid]) {
          console.log(`Updating rootPid for branch ${key}: ${config.rootPid} -> ${pidMap[config.rootPid]}`);
          config.rootPid = pidMap[config.rootPid];
          settingsUpdated = true;
        }
      });
    }
  }

  // 5. Rename files in photos_update directory
  let renamedPhotosCount = 0;
  if (fs.existsSync(photosDir)) {
    const files = fs.readdirSync(photosDir);
    console.log(`Found ${files.length} photo files in photos_update folder.`);

    files.forEach((file) => {
      const ext = path.extname(file);
      const name = path.basename(file, ext); // e.g. "PID0050"

      if (pidMap[name]) {
        const oldFilePath = path.join(photosDir, file);
        const newFileName = pidMap[name] + ext;
        const newFilePath = path.join(photosDir, newFileName);

        try {
          fs.renameSync(oldFilePath, newFilePath);
          renamedPhotosCount++;
        } catch (err) {
          console.error(`Failed to rename file ${file} to ${newFileName}:`, err.message);
        }
      }
    });
    console.log(`Successfully renamed ${renamedPhotosCount} photos locally.`);
  } else {
    console.warn(`Photos folder not found at ${photosDir}. Skipping photo renaming.`);
  }

  // 6. Save updated data.json and settings.json
  fs.writeFileSync(dbPath, JSON.stringify(updatedProfiles, null, 2), 'utf8');
  console.log(`Saved updated profiles to ${dbPath}`);

  if (settingsUpdated) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`Saved updated settings to ${settingsPath}`);
  }

  // Write mapping log for reference
  const logPath = path.resolve(__dirname, './pid_mapping_log.json');
  fs.writeFileSync(logPath, JSON.stringify(pidMap, null, 2), 'utf8');
  console.log(`Saved mapping log to ${logPath}`);

  console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
}

runMigration();
