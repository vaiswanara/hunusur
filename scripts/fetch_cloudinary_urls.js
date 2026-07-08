const fs = require('fs');
const path = require('path');
const https = require('https');

// Paths
const envFile = path.join(__dirname, '../vamsha/.env');
const dataJsonFile = path.join(__dirname, '../vamsha_db/data.json');

// Load environment variables
const env = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf-8').split('\n').forEach(line => {
    const parts = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (parts) {
      let val = parts[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
      env[parts[1]] = val;
    }
  });
}

// Credentials
const cloudName = env['VITE_CLOUDINARY_CLOUD_NAME'] || 'klr3yhep';
const apiKey = process.argv[2] || env['CLOUDINARY_API_KEY'];
const apiSecret = process.argv[3] || env['CLOUDINARY_API_SECRET'];

if (!apiKey || !apiSecret) {
  console.log('\n❌ Error: Cloudinary API Credentials not found.');
  console.log('Usage option 1: Add CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to your vamsha/.env file.');
  console.log('Usage option 2: Run the script passing them as command line arguments:');
  console.log('   node scripts/fetch_cloudinary_urls.js <API_KEY> <API_SECRET>\n');
  process.exit(1);
}

if (!fs.existsSync(dataJsonFile)) {
  console.log(`\n❌ Error: data.json not found at ${dataJsonFile}\n`);
  process.exit(1);
}

let profiles = [];
try {
  profiles = JSON.parse(fs.readFileSync(dataJsonFile, 'utf-8'));
} catch (e) {
  console.log('\n❌ Error: Failed to parse data.json. Make sure it is valid JSON.\n');
  process.exit(1);
}

console.log(`Connecting to Cloudinary environment: ${cloudName}...`);

// Request configuration for Cloudinary List Resources API
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

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.log(`\n❌ Error: Cloudinary API returned status code ${res.statusCode}`);
      try {
        const errObj = JSON.parse(body);
        console.log(`Message: ${errObj.error?.message || body}\n`);
      } catch (e) {
        console.log(`Response: ${body}\n`);
      }
      process.exit(1);
    }

    try {
      const data = JSON.parse(body);
      const resources = data.resources || [];
      console.log(`Retrieved ${resources.length} image resources from Cloudinary.`);

      const urlMap = {};
      const dateMap = {};
      resources.forEach(res => {
        const publicId = res.public_id || '';
        const secureUrl = res.secure_url || '';
        const createdAt = res.created_at || '';
        
        // Find PID in public ID or URL
        const match = publicId.match(/PID\d+/i) || secureUrl.match(/PID\d+/i);
        if (match) {
          let pid = match[0].toUpperCase();
          const numPart = pid.replace('PID', '');
          if (numPart.length < 4) {
            pid = 'PID' + numPart.padStart(4, '0');
          }
          
          // If not mapped yet, or if this resource is newer, update the mapping
          if (!urlMap[pid] || (createdAt && new Date(createdAt) > new Date(dateMap[pid]))) {
            urlMap[pid] = secureUrl;
            dateMap[pid] = createdAt;
          }
        }
      });

      console.log(`Mapped ${Object.keys(urlMap).length} images to unique PIDs.`);

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
        console.log(`\n✅ Success! Bulk updated ${updatedCount} profiles in local data.json with Cloudinary URLs!\n`);

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
        console.log('\n⚠️ Warning: No matching profile IDs (PIDs) found for the images fetched from Cloudinary.\n');
      }

    } catch (err) {
      console.log('\n❌ Error: Failed to parse Cloudinary API response.\n', err);
    }
  });
});

req.on('error', (err) => {
  console.log('\n❌ Network Error connecting to Cloudinary API:', err.message, '\n');
});

req.end();
