const fs = require('fs');
const path = require('path');

// Target files and folders
const localPhotosDir = path.join(__dirname, '../vamsha_db/profile_photos');
const dataJsonFile = path.join(__dirname, '../vamsha_db/data.json');

// Base URL for cPanel photos
const baseCpanelUrl = 'https://vaiswanara.com/vamsha_db/profile_photos/';

if (!fs.existsSync(localPhotosDir)) {
  console.log(`\n❌ Error: local profile_photos folder not found at: ${localPhotosDir}\n`);
  process.exit(1);
}

if (!fs.existsSync(dataJsonFile)) {
  console.log(`\n❌ Error: data.json not found at: ${dataJsonFile}\n`);
  process.exit(1);
}

let profiles = [];
try {
  profiles = JSON.parse(fs.readFileSync(dataJsonFile, 'utf-8'));
} catch (e) {
  console.log('\n❌ Error: Failed to parse data.json. Make sure it is valid JSON.\n');
  process.exit(1);
}

const files = fs.readdirSync(localPhotosDir);
console.log(`Scanning local profile_photos folder... Found ${files.length} files.`);

const urlMap = {};
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
      // Map to the production cPanel URL
      urlMap[pid] = baseCpanelUrl + file;
    }
  }
});

console.log(`Mapped ${Object.keys(urlMap).length} local photos to unique PIDs.`);

let updatedCount = 0;
const updatedProfiles = profiles.map(profile => {
  const pid = profile.pid.toUpperCase();
  if (urlMap[pid]) {
    updatedCount++;
    return { ...profile, photoUrl: urlMap[pid] };
  }
  return profile;
});

if (updatedCount > 0) {
  fs.writeFileSync(dataJsonFile, JSON.stringify(updatedProfiles, null, 2), 'utf-8');
  console.log(`\n✅ Success! Bulk updated ${updatedCount} profiles in local data.json with cPanel photo URLs!\n`);
  
  // Generate the CSV file for direct dashboard import
  const csvLines = ['PID,Name,Photo_URL'];
  profiles.forEach(profile => {
    const pid = profile.pid.toUpperCase();
    if (urlMap[pid]) {
      const fullName = `${profile.firstName || ''} ${profile.surName || ''}`.trim();
      const cleanName = fullName.replace(/"/g, '""');
      csvLines.push(`"${pid}","${cleanName}","${urlMap[pid]}"`);
    }
  });
  
  const csvPath = path.join(__dirname, '../vamsha_photo_mappings.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`📄 CSV Mappings file generated: ${csvPath}`);
  console.log(`💡 You can directly import this CSV file on your live admin panel under "Manage Profile Photos"!\n`);
} else {
  console.log('\n⚠️ Warning: No matching profile IDs (PIDs) found for the files inside profile_photos.\n');
}
