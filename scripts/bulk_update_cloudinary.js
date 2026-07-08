const fs = require('fs');
const path = require('path');

// Target files
const urlsFile = path.join(__dirname, '../cloudinary_urls.txt');
const dataJsonFile = path.join(__dirname, '../vamsha_db/data.json');

if (!fs.existsSync(urlsFile)) {
  console.log('\n❌ Error: Please create a file named "cloudinary_urls.txt" in the root folder and paste all Cloudinary URLs inside it (one URL per line).\n');
  process.exit(1);
}

if (!fs.existsSync(dataJsonFile)) {
  console.log(`\n❌ Error: data.json not found at: ${dataJsonFile}\n`);
  process.exit(1);
}

const urls = fs.readFileSync(urlsFile, 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.startsWith('http'));

if (urls.length === 0) {
  console.log('\n❌ Error: No valid image URLs starting with http/https found in cloudinary_urls.txt.\n');
  process.exit(1);
}

let profiles = [];
try {
  profiles = JSON.parse(fs.readFileSync(dataJsonFile, 'utf-8'));
} catch (e) {
  console.log('\n❌ Error: Failed to parse data.json. Make sure it is valid JSON.\n');
  process.exit(1);
}

let updatedCount = 0;
const urlMap = {};

// Parse PID from Cloudinary URL (e.g., extracts PID0080 from .../PID0080_hnoxsx.jpg)
urls.forEach(url => {
  const match = url.match(/PID\d+/i);
  if (match) {
    let pid = match[0].toUpperCase();
    const numPart = pid.replace('PID', '');
    if (numPart.length < 4) {
      pid = 'PID' + numPart.padStart(4, '0');
    }
    urlMap[pid] = url;
  }
});

// Update profiles
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
  console.log(`\n✅ Success! Bulk updated ${updatedCount} profiles with Cloudinary URLs in data.json.\n`);
} else {
  console.log('\n⚠️ Warning: No matching profile IDs (PIDs) found for the URLs in cloudinary_urls.txt.\n');
}
