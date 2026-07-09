import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Sliders, Shield, CheckCircle, AlertCircle, AlertTriangle,
  Download, Upload, Camera, Moon, Calendar, Phone, Mail, 
  GitFork, Heart, FileText, ChevronDown, ChevronUp, Play, Trash2,
  X, Eye, EyeOff, Copy, Check, Lock
} from 'lucide-react';
import { saveProfiles, isStaticHosting, getApiUrl, getSettingsUrl, getSaveSettingsUrl, getBulkMapLocalUrl, getBulkMapCloudinaryUrl, fetchSettings } from '../lib/api';
import { encryptData } from '../lib/crypto';
import { getAdminPassword } from './AdminGate';
import SearchableSelect from './SearchableSelect';

// RFC 4180 compliant CSV parser
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push('');
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  return lines;
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default function SettingsEditor({ profiles, setProfiles, handleEditFromList }) {
  const [activeTab, setActiveTab] = useState('general');
  const [expandedSection, setExpandedSection] = useState(null);
  const [toast, setToast] = useState(null);
  const [adminUploadService, setAdminUploadService] = useState(import.meta.env.VITE_UPLOAD_SERVICE || 'cloudinary');
  const [userUploadService, setUserUploadService] = useState(import.meta.env.VITE_UPLOAD_SERVICE || 'cloudinary');
  const [savingSettings, setSavingSettings] = useState(false);
  const fileInputRef = useRef();
  const csvFileInputRef = useRef();

  // Family Branches States
  const [familyBranches, setFamilyBranches] = useState({});
  const [newBranchKey, setNewBranchKey] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchRoot, setNewBranchRoot] = useState('');
  const [newBranchPwd, setNewBranchPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Bulk Scan States
  const [bulkSource, setBulkSource] = useState('local'); // 'local' | 'cloudinary'
  const [bulkUpdateDb, setBulkUpdateDb] = useState(true); // true -> update data.json, false -> csv only
  const [bulkScanLoading, setBulkScanLoading] = useState(false);
  const [bulkScanStatus, setBulkScanStatus] = useState(null); // { type: 'success' | 'error', text: '' }
  const [downloadCsvData, setDownloadCsvData] = useState(null);
  
  // Cloudinary credentials modal states
  const [showCloudinaryModal, setShowCloudinaryModal] = useState(false);
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState('');
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState('');
  const [showCloudinarySecret, setShowCloudinarySecret] = useState(false);
  const [cloudinaryModalError, setCloudinaryModalError] = useState('');

  useEffect(() => {
    const fetchSettingsData = async () => {
      try {
        const settings = await fetchSettings();
        if (settings.adminUploadService) {
          setAdminUploadService(settings.adminUploadService);
        }
        if (settings.userUploadService) {
          setUserUploadService(settings.userUploadService);
        }
        if (settings.familyBranches) {
          setFamilyBranches(settings.familyBranches);
        }
      } catch (err) {
        console.error('Failed to load settings configuration, using .env fallback:', err);
      }
    };
    fetchSettingsData();
  }, []);

  const handleSaveSettings = async (updatedBranches = familyBranches) => {
    setSavingSettings(true);
    try {
      const password = getAdminPassword() || '';
      const payload = { 
        adminUploadService, 
        userUploadService, 
        familyBranches: updatedBranches 
      };

      const saveUrl = getSaveSettingsUrl();
      const res = await fetch(saveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.error || 'Failed to save settings');
      }

      setFamilyBranches(updatedBranches);
      setToast({ type: 'success', message: 'Settings saved successfully!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Error saving settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  const personOptions = useMemo(() => {
    return [...profiles]
      .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))
      .map(p => ({
        value: p.pid,
        label: `${p.firstName} ${p.surName} (${p.pid})`
      }));
  }, [profiles]);

  const handleAddBranch = async (e) => {
    e.preventDefault();
    const key = newBranchKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!key) {
      alert("Please enter a valid branch key (Letters and numbers only).");
      return;
    }
    if (familyBranches[key]) {
      alert(`Branch with key "${key}" already exists.`);
      return;
    }
    if (!newBranchName.trim()) {
      alert("Please enter a branch display name.");
      return;
    }
    if (!newBranchRoot) {
      alert("Please select a starting root profile.");
      return;
    }
    if (!newBranchPwd.trim()) {
      alert("Please enter an access password for this branch.");
      return;
    }

    setSavingSettings(true);
    try {
      const hash = await sha256(newBranchPwd.trim());
      const updated = {
        ...familyBranches,
        [key]: {
          name: newBranchName.trim(),
          passwordHash: hash,
          rootPid: newBranchRoot
        }
      };

      await handleSaveSettings(updated);

      // Reset inputs
      setNewBranchKey('');
      setNewBranchName('');
      setNewBranchRoot('');
      setNewBranchPwd('');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteBranch = async (key) => {
    if (!window.confirm(`Are you sure you want to delete the branch "${key}"?`)) {
      return;
    }
    const updated = { ...familyBranches };
    delete updated[key];
    await handleSaveSettings(updated);
  };

  const handleRunBulkScan = () => {
    setBulkScanStatus(null);
    setDownloadCsvData(null);
    if (bulkSource === 'cloudinary') {
      setCloudinaryApiKey('');
      setCloudinaryApiSecret('');
      setCloudinaryModalError('');
      setShowCloudinarySecret(false);
      setShowCloudinaryModal(true);
    } else {
      executeLocalScan();
    }
  };

  const executeLocalScan = async () => {
    setBulkScanLoading(true);
    try {
      const password = getAdminPassword() || '';
      const payload = {
        action: 'bulk_map_local',
        updateDb: bulkUpdateDb
      };

      const apiUrl = getBulkMapLocalUrl();
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan local photos');
      }

      setBulkScanStatus({
        type: 'success',
        text: `Success! ${data.updatedCount} profiles mapped from local directory.${bulkUpdateDb ? ' Database updated!' : ''}`
      });

      // Generate CSV
      generateCSVData(data.mappings);

      // Trigger updates of parent components if data.json was updated
      if (bulkUpdateDb && data.updatedCount > 0 && typeof setProfiles === 'function') {
        const mappingsMap = {};
        data.mappings.forEach(m => {
          mappingsMap[m.pid.toUpperCase()] = m.photoUrl;
        });
        const updatedList = profiles.map(p => {
          const pid = p.pid.toUpperCase();
          if (mappingsMap[pid]) {
            return { ...p, photoUrl: mappingsMap[pid] };
          }
          return p;
        });
        setProfiles(updatedList);
      }

    } catch (err) {
      setBulkScanStatus({ type: 'error', text: err.message || 'Error running scan.' });
    } finally {
      setBulkScanLoading(false);
    }
  };

  const handleExecuteCloudinaryScan = async () => {
    if (!cloudinaryApiKey.trim() || !cloudinaryApiSecret.trim()) {
      setCloudinaryModalError('API Key and Secret are required.');
      return;
    }
    
    setCloudinaryModalError('');
    setShowCloudinaryModal(false);
    setBulkScanLoading(true);
    
    try {
      const password = getAdminPassword() || '';
      const payload = {
        action: 'bulk_map_cloudinary',
        apiKey: cloudinaryApiKey.trim(),
        apiSecret: cloudinaryApiSecret.trim(),
        updateDb: bulkUpdateDb
      };

      const apiUrl = getBulkMapCloudinaryUrl();
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan Cloudinary photos');
      }

      setBulkScanStatus({
        type: 'success',
        text: `Success! ${data.updatedCount} profiles mapped from Cloudinary.${bulkUpdateDb ? ' Database updated!' : ''}`
      });

      // Generate CSV
      generateCSVData(data.mappings);

      // Trigger updates of parent components if data.json was updated
      if (bulkUpdateDb && data.updatedCount > 0 && typeof setProfiles === 'function') {
        const mappingsMap = {};
        data.mappings.forEach(m => {
          mappingsMap[m.pid.toUpperCase()] = m.photoUrl;
        });
        const updatedList = profiles.map(p => {
          const pid = p.pid.toUpperCase();
          if (mappingsMap[pid]) {
            return { ...p, photoUrl: mappingsMap[pid] };
          }
          return p;
        });
        setProfiles(updatedList);
      }

    } catch (err) {
      setBulkScanStatus({ type: 'error', text: err.message || 'Error running Cloudinary scan.' });
    } finally {
      setBulkScanLoading(false);
    }
  };

  const generateCSVData = (mappings) => {
    if (!mappings || mappings.length === 0) {
      setDownloadCsvData(null);
      return;
    }

    const headers = ['PID', 'Name', 'Photo_URL'];
    const rows = mappings.map(m => [
      m.pid,
      m.name,
      m.photoUrl
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    setDownloadCsvData(csvContent);
  };

  const handleDownloadGeneratedCSV = () => {
    if (!downloadCsvData) return;
    const blob = new Blob([downloadCsvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'vamsha_photo_mappings.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [hashInput, setHashInput] = useState('');
  const [hashOutput, setHashOutput] = useState('');
  const [showHashPwd, setShowHashPwd] = useState(false);
  const [hashCopied, setHashCopied] = useState(false);

  useEffect(() => {
    if (!hashInput) {
      setHashOutput('');
      return;
    }
    let active = true;
    sha256(hashInput).then(hash => {
      if (active) setHashOutput(hash);
    });
    return () => {
      active = false;
    };
  }, [hashInput]);

  const handleCopyHash = () => {
    if (!hashOutput) return;
    navigator.clipboard.writeText(hashOutput);
    setHashCopied(true);
    setTimeout(() => setHashCopied(false), 2000);
  };

  // CSV Validation States
  const [csvFile, setCsvFile] = useState(null);
  const [validationReport, setValidationReport] = useState(null); // { status: 'success'|'error', errors: [], parsedCount: 0, updates: [] }

  // Custom Wipe Modal States
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [wipePassword, setWipePassword] = useState('');
  const [showWipePassword, setShowWipePassword] = useState(false);
  const [wipeVerifying, setWipeVerifying] = useState(false);

  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(profiles, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'data.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setToast({ message: '📊 data.json exported successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: `❌ Export failed: ${err.message}`, type: 'error' });
    }
  };

  const handleExportEncryptedJSON = async () => {
    try {
      const plaintext = JSON.stringify(profiles, null, 2);
      let familyPwd = localStorage.getItem('vamsha_family_encrypt_pwd') || localStorage.getItem('vamsha_decrypt_pwd') || '';
      if (!familyPwd) {
        const familyPwdPrompt = prompt("Enter the Family Password to encrypt the database (users must enter this password to view the tree):", "vamsha@1982");
        if (familyPwdPrompt === null) return; // Cancelled
        familyPwd = familyPwdPrompt.trim() || 'vamsha@1982';
        localStorage.setItem('vamsha_family_encrypt_pwd', familyPwd);
      }
      const encryptedBase64 = await encryptData(plaintext, familyPwd);
      const encryptedPayload = {
        encrypted: true,
        data: encryptedBase64
      };
      const dataStr = JSON.stringify(encryptedPayload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'data.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setToast({ message: '🔒 Encrypted data.json exported successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: `❌ Export failed: ${err.message}`, type: 'error' });
    }
  };

  const handleImportJSONClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportJSONFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!Array.isArray(importedData)) throw new Error('Data must be a JSON array.');
        const isValid = importedData.every(item => item && typeof item === 'object' && 'pid' in item);
        if (!isValid) throw new Error('Every profile must contain a "pid" field.');

        setProfiles(importedData);
        setToast({ message: '📥 data.json imported! Click "Save to Server" to save permanently.', type: 'success' });
      } catch (err) {
        setToast({ message: `❌ Import failed: ${err.message}`, type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleWipeDataClick = () => {
    // Open the custom modal and reset its inputs
    setWipeConfirmText('');
    setWipePassword('');
    setShowWipePassword(false);
    setShowWipeModal(true);
  };

  const handleConfirmWipe = async (e) => {
    e.preventDefault();
    if (wipeConfirmText !== 'WIPE') {
      alert("Verification failed. Please type 'WIPE' exactly.");
      return;
    }
    if (!wipePassword.trim()) {
      alert("Password cannot be empty.");
      return;
    }

    setWipeVerifying(true);
    setToast({ message: '⏳ Authorizing wipe...', type: 'info' });

    try {
      const password = wipePassword.trim();
      const isStatic = isStaticHosting();
      
      // Verify password
      if (isStatic) {
        const expectedHash = window.VAMSHA_CONFIG?.adminPasswordHash || import.meta.env.VITE_ADMIN_PASSWORD_HASH;
        if (expectedHash) {
          const msgBuffer = new TextEncoder().encode(password);
          const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashedInput = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          if (hashedInput !== expectedHash) {
            setToast({ message: '❌ Invalid admin password.', type: 'error' });
            setWipeVerifying(false);
            return;
          }
        }
      } else {
        const IS_DEV = import.meta.env.DEV;
        const url = IS_DEV ? '/api/save' : getApiUrl();
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Password': password,
          },
          body: JSON.stringify({ __ping: true }),
        });
        if (res.status === 401) {
          setToast({ message: '❌ Invalid admin password.', type: 'error' });
          setWipeVerifying(false);
          return;
        }
      }

      // Password verified! Perform the wipe
      const emptyProfiles = [];
      
      if (isStatic) {
        setProfiles(emptyProfiles);
        localStorage.setItem('vamsha_local_profiles', JSON.stringify(emptyProfiles));

        const plaintext = JSON.stringify(emptyProfiles, null, 2);
        const encryptedBase64 = await encryptData(plaintext, 'vamsha@1982');
        const encryptedPayload = {
          encrypted: true,
          data: encryptedBase64
        };
        const dataStr = JSON.stringify(encryptedPayload, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'data.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setToast({ 
          message: '🗑️ Data wiped locally! Downloaded encrypted empty data.json. Deploy it to GitHub.', 
          type: 'success' 
        });
      } else {
        await saveProfiles(emptyProfiles, password);
        setProfiles(emptyProfiles);
        localStorage.setItem('vamsha_local_profiles', JSON.stringify(emptyProfiles));
        setToast({ message: '🗑️ Database successfully wiped on server!', type: 'success' });
      }

      setShowWipeModal(false);
    } catch (err) {
      setToast({ message: `❌ Wipe failed: ${err.message}`, type: 'error' });
    } finally {
      setWipeVerifying(false);
    }
  };

  // ── CSV Batch Export ────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    try {
      let csvContent = '\uFEFF'; // UTF-8 BOM
      csvContent += 'PID,First Name,Last Name,Gender,DOB,Phone,Email,Photo URL,Nakshatra,Rashi,Deceased,Death Date,Father PID,Mother PID\n';

      profiles.forEach(p => {
        const escape = (val) => {
          if (val === undefined || val === null) return '';
          const str = String(val).trim();
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const pid = escape(p.pid);
        const fName = escape(p.firstName);
        const lName = escape(p.surName);
        const gender = escape(p.gender);
        const dob = escape(p.dob);
        const phone = escape(p.phone);
        const email = escape(p.email);
        const photo = escape(p.photoUrl);
        const nakshatra = escape(p.nakshatra);
        const rashi = escape(p.rashi);
        const deceased = p.isDeceased ? 'TRUE' : 'FALSE';
        const dDate = escape(p.deathDate);
        const fPid = escape(p.fatherId);
        const mPid = escape(p.motherId);

        csvContent += `${pid},${fName},${lName},${gender},${dob},${phone},${email},${photo},${nakshatra},${rashi},${deceased},${dDate},${fPid},${mPid}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Vamsha_Editable_Data_Sheet.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setToast({ message: '📥 Editable CSV sheet downloaded!', type: 'success' });
    } catch (err) {
      setToast({ message: `❌ CSV Export failed: ${err.message}`, type: 'error' });
    }
  };

  // ── CSV Batch Import & Validation ───────────────────────────────────────────
  const handleCSVUploadClick = () => {
    csvFileInputRef.current?.click();
  };

  const handleCSVFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setValidationReport(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          throw new Error('CSV is empty or missing headers.');
        }

        // Validate Header (very basic check)
        const headers = rows[0].map(h => h.trim().toLowerCase());
        if (!headers.includes('pid') || !headers.includes('first name')) {
          throw new Error('Invalid CSV Headers. Make sure it contains "PID" and "First Name" columns.');
        }

        const errors = [];
        const updates = [];
        let parsedCount = 0;

        // Parse and validate rows
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 0 || (row.length === 1 && row[0] === '')) continue; // Skip empty rows

          parsedCount++;
          const rowNum = i + 1;
          const pid = row[0]?.trim();
          const firstName = row[1]?.trim();
          const surName = row[2]?.trim();
          const gender = row[3]?.trim();
          const dob = row[4]?.trim();
          const phone = row[5]?.trim();
          const email = row[6]?.trim();
          const photoUrl = row[7]?.trim();
          const nakshatra = row[8]?.trim();
          const rashi = row[9]?.trim();
          const deceasedStr = row[10]?.trim()?.toUpperCase();
          const deathDate = row[11]?.trim();
          const fatherId = row[12]?.trim();
          const motherId = row[13]?.trim();

          // 1. PID Check
          if (!pid) {
            errors.push(`Row ${rowNum}: PID is missing.`);
            continue;
          }
          const existingProfile = profiles.find(p => p.pid === pid);
          if (!existingProfile) {
            errors.push(`Row ${rowNum}: PID "${pid}" not found in database. New profiles must be created in the Admin Editor.`);
            continue;
          }

          // 2. First Name Check
          if (!firstName) {
            errors.push(`Row ${rowNum} (${pid}): First Name is missing.`);
          }

          // 3. Gender Check
          if (gender && gender !== 'Male' && gender !== 'Female') {
            errors.push(`Row ${rowNum} (${pid}): Gender must be "Male" or "Female" (Found: "${gender}").`);
          }

          // 4. Deceased Check
          if (deceasedStr && deceasedStr !== 'TRUE' && deceasedStr !== 'FALSE') {
            errors.push(`Row ${rowNum} (${pid}): Deceased column must be "TRUE" or "FALSE" (Found: "${deceasedStr}").`);
          }

          // 5. Father ID Check
          if (fatherId && !profiles.some(p => p.pid === fatherId)) {
            errors.push(`Row ${rowNum} (${pid}): Father PID "${fatherId}" does not exist in database.`);
          }

          // 6. Mother ID Check
          if (motherId && !profiles.some(p => p.pid === motherId)) {
            errors.push(`Row ${rowNum} (${pid}): Mother PID "${motherId}" does not exist in database.`);
          }

          // If no errors for this row, queue the update
          updates.push({
            pid,
            firstName,
            surName,
            gender: gender || existingProfile.gender,
            dob,
            phone,
            email,
            photoUrl,
            nakshatra,
            rashi,
            isDeceased: deceasedStr === 'TRUE',
            deathDate: deceasedStr === 'TRUE' ? deathDate : '',
            fatherId,
            motherId
          });
        }

        setValidationReport({
          status: errors.length > 0 ? 'error' : 'success',
          errors,
          parsedCount,
          updates
        });

      } catch (err) {
        setToast({ message: `❌ CSV Read failed: ${err.message}`, type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleApplyCSVUpdates = () => {
    if (!validationReport || validationReport.updates.length === 0) return;

    const updatedProfiles = profiles.map(p => {
      const update = validationReport.updates.find(u => u.pid === p.pid);
      if (update) {
        return {
          ...p,
          ...update
        };
      }
      return p;
    });

    setProfiles(updatedProfiles);
    setToast({ message: `✅ Successfully merged ${validationReport.updates.length} profile updates!`, type: 'success' });
    setCsvFile(null);
    setValidationReport(null);
  };

  // ── Data Consistency Rules ────────────────────────────────────────────────
  const consistencyReport = useMemo(() => {
    const missingPhotos = profiles.filter(p => !p.photoUrl || p.photoUrl.trim() === '');
    const missingNakshatraRashi = profiles.filter(p => !p.isDeceased && (!p.nakshatra || p.nakshatra.trim() === '' || !p.rashi || p.rashi.trim() === ''));
    const missingLastName = profiles.filter(p => !p.surName || p.surName.trim() === '');
    const missingDob = profiles.filter(p => !p.dob || p.dob.trim() === '');
    const missingPhone = profiles.filter(p => !p.isDeceased && (!p.phone || p.phone.trim() === ''));
    const missingEmail = profiles.filter(p => !p.isDeceased && (!p.email || p.email.trim() === ''));
    const missingParents = profiles.filter(p => !p.fatherId && !p.motherId);
    const unmarriedList = profiles.filter(p => !p.isDeceased && (!p.spouseIds || p.spouseIds.length === 0));

    return {
      missingPhotos,
      missingNakshatraRashi,
      missingLastName,
      missingDob,
      missingPhone,
      missingEmail,
      missingParents,
      unmarriedList
    };
  }, [profiles]);

  // Section Config Helper
  const checkSections = [
    { key: 'missingPhotos', label: 'Photos Missing', icon: Camera, color: '#E67E22', data: consistencyReport.missingPhotos },
    { key: 'missingNakshatraRashi', label: 'Nakshatra/Rashi Missing', icon: Moon, color: '#9B59B6', data: consistencyReport.missingNakshatraRashi },
    { key: 'missingLastName', label: 'Last Name Missing', icon: FileText, color: '#16A085', data: consistencyReport.missingLastName },
    { key: 'missingDob', label: 'Date of Birth Missing', icon: Calendar, color: '#2980B9', data: consistencyReport.missingDob },
    { key: 'missingPhone', label: 'Contact Number Missing', icon: Phone, color: '#27AE60', data: consistencyReport.missingPhone },
    { key: 'missingEmail', label: 'Email ID Missing', icon: Mail, color: '#D35400', data: consistencyReport.missingEmail },
    { key: 'missingParents', label: 'Parents Connection Missing', icon: GitFork, color: '#7F8C8D', data: consistencyReport.missingParents },
    { key: 'unmarriedList', label: 'Un-Married Members', icon: Heart, color: '#C0392B', data: consistencyReport.unmarriedList }
  ];

  return (
    <div style={{ position: 'relative' }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: toast.type === 'success' ? '#1a7f1a' : '#c0392b', color: 'white',
          padding: '0.9rem 1.5rem', borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          maxWidth: '380px', fontSize: '0.95rem', fontWeight: 500,
        }}>
          {toast.message}
        </div>
      )}

      <style>{`
        .settings-tab-btn {
          padding: 0.6rem 1.25rem;
          border: none;
          background: none;
          font-weight: 600;
          font-size: 0.95rem;
          color: #777;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }
        .settings-tab-btn:hover {
          color: var(--color-maroon, #63131D);
        }
        .settings-tab-btn.active {
          color: var(--color-maroon, #63131D);
          border-bottom-color: var(--color-maroon, #63131D);
        }
        .check-card {
          border: 1px solid #EFE4DC;
          background-color: white;
          border-radius: 10px;
          margin-bottom: 0.75rem;
          overflow: hidden;
          transition: all 0.2s ease;
        }
        .check-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          cursor: pointer;
          user-select: none;
        }
        .check-card-header:hover {
          background-color: #FAF8F5;
        }
        .check-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .check-table th {
          background-color: #F8F6F2;
          color: #63131D;
          text-align: left;
          padding: 0.6rem 1rem;
          font-weight: 700;
          border-bottom: 1px solid #EFE4DC;
        }
        .check-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #EEE;
        }
        .check-table tr:hover {
          background-color: #FAF9F6;
        }
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }
        .backup-card {
          border: 1px solid #EFE4DC;
          border-radius: 10px;
          padding: 1.5rem;
          background-color: white;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }
      `}</style>

      {/* Sub tabs inside Settings page */}
      <div style={{ display: 'flex', borderBottom: '1px solid #EFE4DC', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button 
          className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <Sliders size={18} /> General
        </button>
        <button 
          className={`settings-tab-btn ${activeTab === 'check' ? 'active' : ''}`}
          onClick={() => setActiveTab('check')}
        >
          <Shield size={18} /> Data Check ({profiles.length})
        </button>
        <button 
          className={`settings-tab-btn ${activeTab === 'backup' ? 'active' : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          <Upload size={18} /> Backup / Restore
        </button>
        <button 
          className={`settings-tab-btn ${activeTab === 'passwords' ? 'active' : ''}`}
          onClick={() => setActiveTab('passwords')}
        >
          <Lock size={18} /> Passwords
        </button>
      </div>

      {/* Settings Content Panels */}
      <div>
        {/* TAB 1: General Settings */}
        {activeTab === 'general' && (
          <div>

            {/* Media Upload Configuration Card */}
            <div style={{
              backgroundColor: '#FAF8F5',
              border: '1px solid #EFE4DC',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              marginBottom: '2rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📷 Media Upload Configuration
              </h4>
              <p style={{ margin: '0 0 1.25rem', color: '#666', fontSize: '0.88rem', lineHeight: 1.45 }}>
                Choose where user-submitted photos will be initially uploaded and saved.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '500px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4A3E39' }}>
                    Admin Photo Upload Destination:
                  </label>
                  <select
                    value={adminUploadService}
                    onChange={(e) => setAdminUploadService(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: '1.5px solid #EFE4DC',
                      backgroundColor: '#ffffff',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      height: '42px'
                    }}
                  >
                    <option value="local">cPanel Server (Local - saved in profile_photos/)</option>
                    <option value="cloudinary">Cloudinary (External CDN - high speed delivery)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4A3E39' }}>
                    User Self-Submission Photo Destination:
                  </label>
                  <select
                    value={userUploadService}
                    onChange={(e) => setUserUploadService(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: '1.5px solid #EFE4DC',
                      backgroundColor: '#ffffff',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      height: '42px'
                    }}
                  >
                    <option value="local">cPanel Server (Local - saved in profile_photos/)</option>
                    <option value="cloudinary">Cloudinary (External CDN - high speed delivery)</option>
                  </select>
                </div>

                <div>
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="btn btn-primary"
                    style={{
                      padding: '0.75rem 1.5rem',
                      fontSize: '0.95rem',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 'bold',
                      cursor: savingSettings ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {savingSettings ? '⏳ Saving Settings...' : '💾 Save Settings'}
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Photo URL Updater Card */}
            <div style={{
              backgroundColor: '#FAF8F5',
              border: '1px solid #EFE4DC',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              marginBottom: '2rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📸 Bulk Photo URL Updater (బల్క్ ఫోటో అప్‌డేటర్)
              </h4>
              <p style={{ margin: '0 0 1.25rem', color: '#666', fontSize: '0.88rem', lineHeight: 1.45 }}>
                Automatically scan your media sources to match file names containing PIDs with family tree profiles. You can choose to directly update the database or only generate a mapping CSV.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px' }}>
                {/* Select Scan Type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4A3E39' }}>
                    Select Photo Source (ఫోటో సోర్స్ ఎంచుకోండి):
                  </label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input 
                        type="radio" 
                        name="bulkSource" 
                        value="local" 
                        checked={bulkSource === 'local'} 
                        onChange={() => setBulkSource('local')}
                      />
                      📁 cPanel Local directory (profile_photos/)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input 
                        type="radio" 
                        name="bulkSource" 
                        value="cloudinary" 
                        checked={bulkSource === 'cloudinary'} 
                        onChange={() => setBulkSource('cloudinary')}
                      />
                      ☁️ Cloudinary CDN Scan
                    </label>
                  </div>
                </div>

                {/* Select Execution Mode */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4A3E39' }}>
                    Select Action Mode (యాక్షన్ మోడ్ ఎంచుకోండి):
                  </label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input 
                        type="radio" 
                        name="bulkMode" 
                        value="update" 
                        checked={bulkUpdateDb} 
                        onChange={() => setBulkUpdateDb(true)}
                      />
                      ⚡ Update data.json & generate CSV
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input 
                        type="radio" 
                        name="bulkMode" 
                        value="csv" 
                        checked={!bulkUpdateDb} 
                        onChange={() => setBulkUpdateDb(false)}
                      />
                      📄 CSV Only (No Database Update)
                    </label>
                  </div>
                </div>

                {/* Status message */}
                {bulkScanStatus && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: bulkScanStatus.type === 'success' ? '#E8F5E9' : '#FFEBEE',
                    color: bulkScanStatus.type === 'success' ? '#2E7D32' : '#C62828',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}>
                    {bulkScanStatus.text}
                  </div>
                )}

                {/* Run Buttons */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleRunBulkScan}
                    disabled={bulkScanLoading}
                    className="btn btn-primary"
                    style={{
                      padding: '0.75rem 1.5rem',
                      fontSize: '0.95rem',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 'bold',
                      cursor: bulkScanLoading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {bulkScanLoading ? '⏳ Scanning...' : '🚀 Run Bulk Scan'}
                  </button>

                  {downloadCsvData && (
                    <button
                      onClick={handleDownloadGeneratedCSV}
                      className="btn"
                      style={{
                        padding: '0.75rem 1.5rem',
                        fontSize: '0.95rem',
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 'bold',
                        backgroundColor: '#EFE4DC',
                        color: '#4A3E39',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      📥 Download Photo Mappings CSV
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Data Check / Consistency Checker */}
        {activeTab === 'check' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #EFE4DC', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: 0, color: '#555', fontSize: '0.9rem' }}>
                Inspect empty credentials, photo allocations, contact info, and parental tree connections.
              </p>
              <button className="btn btn-primary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileText size={16} /> Download CSV Report
              </button>
            </div>

            {/* Accordion List */}
            <div>
              {checkSections.map(sect => {
                const Icon = sect.icon;
                const isExpanded = expandedSection === sect.key;
                
                return (
                  <div key={sect.key} className="check-card" style={{ borderLeft: `4px solid ${sect.color}` }}>
                    <div 
                      className="check-card-header"
                      onClick={() => setExpandedSection(isExpanded ? null : sect.key)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Icon size={18} style={{ color: sect.color }} />
                        <span style={{ fontWeight: 600, color: '#333', fontSize: '0.95rem' }}>{sect.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ 
                          backgroundColor: sect.data.length > 0 ? '#FDEDEC' : '#EAF2F8', 
                          color: sect.data.length > 0 ? '#C0392B' : '#2980B9',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '10px',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>
                          {sect.data.length} profiles
                        </span>
                        {isExpanded ? <ChevronUp size={16} color="#888" /> : <ChevronDown size={16} color="#888" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #EFE4DC', padding: '0.5rem', backgroundColor: '#FAF9F6' }}>
                        {sect.data.length === 0 ? (
                          <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
                            🎉 Perfect! No profiles are missing this data.
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto', maxHeight: '350px', overflowY: 'auto', border: '1px solid #EEE', borderRadius: '6px', backgroundColor: 'white' }}>
                            <table className="check-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '100px' }}>PID</th>
                                  <th>Full Name</th>
                                  <th>Gender</th>
                                  <th>Status</th>
                                  <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sect.data.map(p => (
                                  <tr key={p.pid}>
                                    <td style={{ fontWeight: 700, color: '#777' }}>{p.pid}</td>
                                    <td>
                                      <strong>{p.firstName} {p.surName}</strong>
                                      {p.dob && <span style={{ color: '#888', fontSize: '0.78rem', marginLeft: '0.5rem' }}>({p.dob})</span>}
                                    </td>
                                    <td>{p.gender}</td>
                                    <td>
                                      <span style={{ 
                                        color: p.isDeceased ? '#C0392B' : '#27AE60',
                                        fontSize: '0.8rem',
                                        fontWeight: 600
                                      }}>
                                        {p.isDeceased ? 'Deceased' : 'Alive'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <button 
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleEditFromList(p)}
                                      >
                                        Edit
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Backup / Restore */}
        {activeTab === 'backup' && (
          <div>
            <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              Keep copies of the family tree records local. Download the raw database (`data.json`) file, download an editable CSV sheet to bulk edit, or upload/import changes.
            </p>

            <div className="settings-grid">
              {/* Card 1: Export JSON */}
              <div className="backup-card">
                <div style={{ backgroundColor: '#EAF2F8', padding: '0.75rem', borderRadius: '50%', color: '#2980B9' }}>
                  <Download size={24} />
                </div>
                <h4 style={{ margin: '0.2rem 0 0.1rem', color: '#333', fontSize: '0.95rem' }}>Export data.json</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', lineHeight: 1.3 }}>
                  Export all currently saved records into raw JSON layout.
                </p>
                <button className="btn btn-secondary btn-sm" onClick={handleExportJSON} style={{ width: '100%', marginTop: '0.5rem' }}>
                  Export JSON
                </button>
              </div>

              {/* Card 2: Import JSON */}
              <div className="backup-card">
                <div style={{ backgroundColor: '#EAFDF5', padding: '0.75rem', borderRadius: '50%', color: '#27AE60' }}>
                  <Upload size={24} />
                </div>
                <h4 style={{ margin: '0.2rem 0 0.1rem', color: '#333', fontSize: '0.95rem' }}>Import data.json</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', lineHeight: 1.3 }}>
                  Overwrite data with records from raw JSON backup file.
                </p>
                <button className="btn btn-secondary btn-sm" onClick={handleImportJSONClick} style={{ width: '100%', marginTop: '0.5rem' }}>
                  Import JSON
                </button>
                <input type="file" ref={fileInputRef} accept=".json" onChange={handleImportJSONFile} style={{ display: 'none' }} />
              </div>

              {/* Card 4: Export Encrypted JSON */}
              <div className="backup-card" style={{ border: '1.5px solid var(--color-gold, #D3BCA2)', backgroundColor: '#FDFAF7' }}>
                <div style={{ backgroundColor: 'var(--color-sandalwood, #EADDCA)', padding: '0.75rem', borderRadius: '50%', color: 'var(--color-maroon, #63131D)' }}>
                  <Shield size={24} />
                </div>
                <h4 style={{ margin: '0.2rem 0 0.1rem', color: 'var(--color-maroon, #63131D)', fontSize: '0.95rem', fontWeight: 'bold' }}>Export Encrypted JSON</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', lineHeight: 1.3 }}>
                  లాక్ చేయబడిన `data.json` ఫైల్‌ను డౌన్‌లోడ్ చేసి నేరుగా గిట్‌హబ్ పేజీల కోసం ఉపయోగించండి.
                </p>
                <button className="btn btn-primary btn-sm" onClick={handleExportEncryptedJSON} style={{ width: '100%', marginTop: '0.5rem' }}>
                  Export Encrypted
                </button>
              </div>

              {/* Card 3: Export CSV Sheet */}
              <div className="backup-card">
                <div style={{ backgroundColor: '#FAF3E3', padding: '0.75rem', borderRadius: '50%', color: '#D4AC0D' }}>
                  <FileText size={24} />
                </div>
                <h4 style={{ margin: '0.2rem 0 0.1rem', color: '#333', fontSize: '0.95rem' }}>Download CSV Sheet</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', lineHeight: 1.3 }}>
                  Download an Excel-friendly CSV data sheet to perform bulk editing.
                </p>
                <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} style={{ width: '100%', marginTop: '0.5rem' }}>
                  Export CSV
                </button>
              </div>

              {/* Card 4: Import & Validate CSV */}
              <div className="backup-card">
                <div style={{ backgroundColor: '#FBEEE6', padding: '0.75rem', borderRadius: '50%', color: '#E59866' }}>
                  <Upload size={24} />
                </div>
                <h4 style={{ margin: '0.2rem 0 0.1rem', color: '#333', fontSize: '0.95rem' }}>Import CSV Sheet</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', lineHeight: 1.3 }}>
                  Upload a completed CSV sheet to validate and merge changes.
                </p>
                <button className="btn btn-secondary btn-sm" onClick={handleCSVUploadClick} style={{ width: '100%', marginTop: '0.5rem' }}>
                  Import & Validate
                </button>
                <input type="file" ref={csvFileInputRef} accept=".csv" onChange={handleCSVFileChange} style={{ display: 'none' }} />
              </div>

              {/* Card 6: Wipe Data */}
              <div className="backup-card" style={{ border: '1.5px solid #FADBD8', backgroundColor: '#FDEDEC' }}>
                <div style={{ backgroundColor: '#FADBD8', padding: '0.75rem', borderRadius: '50%', color: '#C0392B' }}>
                  <Trash2 size={24} />
                </div>
                <h4 style={{ margin: '0.2rem 0 0.1rem', color: '#C0392B', fontSize: '0.95rem', fontWeight: 'bold' }}>Wipe Database / Reset</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', lineHeight: 1.3 }}>
                  Permanently delete all records from the database and reset.
                </p>
                <button className="btn btn-sm" onClick={handleWipeDataClick} style={{ width: '100%', marginTop: '0.5rem', backgroundColor: '#C0392B', color: 'white', border: 'none' }}>
                  Wipe Data
                </button>
              </div>
            </div>

            {/* CSV Validation Report Overlay */}
            {validationReport && (
              <div style={{ 
                marginTop: '2rem', 
                border: `1.5px solid ${validationReport.status === 'error' ? '#C0392B' : '#27AE60'}`, 
                borderRadius: '10px', 
                backgroundColor: 'white',
                padding: '1.5rem',
                animation: 'fadeUp 0.3s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #EEE', paddingBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: validationReport.status === 'error' ? '#C0392B' : '#27AE60', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {validationReport.status === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    CSV Validation Report
                  </h4>
                  <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>
                    Parsed {validationReport.parsedCount} rows
                  </span>
                </div>

                {validationReport.status === 'error' ? (
                  <div>
                    <p style={{ fontSize: '0.9rem', color: '#c0392b', fontWeight: 600, margin: '0 0 0.5rem' }}>
                      ❌ Critical errors found in data sheet. Please resolve them in Excel and re-upload:
                    </p>
                    <div style={{ 
                      maxHeight: '200px', 
                      overflowY: 'auto', 
                      backgroundColor: '#FDEDEC', 
                      border: '1px solid #FADBD8', 
                      borderRadius: '6px', 
                      padding: '0.75rem',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: '#C0392B',
                      lineHeight: 1.5
                    }}>
                      {validationReport.errors.map((err, i) => (
                        <div key={i} style={{ marginBottom: '4px' }}>• {err}</div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.9rem', color: '#27ae60', fontWeight: 600, margin: '0 0 1rem' }}>
                      ✅ Sheet is 100% Valid! Ready to merge updates.
                    </p>
                    <div style={{ fontSize: '0.88rem', color: '#555', marginBottom: '1.25rem', backgroundColor: '#EAF2F8', padding: '0.85rem', borderRadius: '6px', border: '1px solid #B3D4F5' }}>
                      • Found <strong>{validationReport.updates.length}</strong> updates to apply.
                      <br />
                      • Updates will modify current local state session. You must save to server after applying.
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary" onClick={handleApplyCSVUpdates}>
                        Apply & Merge Updates
                      </button>
                      <button className="btn btn-secondary" onClick={() => setValidationReport(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Warning Section */}
            <div style={{ 
              marginTop: '2rem', 
              backgroundColor: '#FDEDEC', 
              border: '1px solid #FADBD8', 
              borderRadius: '8px', 
              padding: '1rem',
              color: '#C0392B'
            }}>
              <h5 style={{ margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem' }}>
                <AlertCircle size={16} /> Important Warning
              </h5>
              <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.4 }}>
                Importing data overwrites current session state. However, changes are NOT saved permanently on the server until you click <strong>"Save to Server"</strong> in the topbar. Verify changes before saving.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Password Management */}
        {activeTab === 'passwords' && (
          <div>
            <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Manage passwords for different branch-wise family trees. Setting up branch passwords limits users logging in with those passwords to only view the sub-tree reachable from the specified root profile.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Add New Branch Card */}
              <div style={{
                backgroundColor: '#FAF8F5',
                border: '1px solid #EFE4DC',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
              }}>
                <h4 style={{ margin: '0 0 1.25rem', color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔑 Add New Family Branch
                </h4>

                <form onSubmit={handleAddBranch} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4A3E39' }}>Branch Key (uppercase, no spaces):</label>
                      <input 
                        type="text"
                        value={newBranchKey}
                        onChange={(e) => setNewBranchKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                        placeholder="e.g. DHARMAVARAM"
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '10px',
                          border: '1.5px solid #EFE4DC',
                          fontSize: '0.95rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4A3E39' }}>Display Name:</label>
                      <input 
                        type="text"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        placeholder="e.g. Dharmavaram Family"
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '10px',
                          border: '1.5px solid #EFE4DC',
                          fontSize: '0.95rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4A3E39' }}>Root Member:</label>
                      <SearchableSelect
                        options={personOptions}
                        value={newBranchRoot}
                        onChange={(e) => setNewBranchRoot(e.target.value)}
                        placeholder="Search & Select Root Profile..."
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4A3E39' }}>Branch Access Password:</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type={showNewPwd ? 'text' : 'password'}
                          value={newBranchPwd}
                          onChange={(e) => setNewBranchPwd(e.target.value)}
                          placeholder="Enter password"
                          style={{
                            width: '100%',
                            padding: '0.75rem 2.8rem 0.75rem 1rem',
                            borderRadius: '10px',
                            border: '1.5px solid #EFE4DC',
                            fontSize: '0.95rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPwd(!showNewPwd)}
                          style={{
                            position: 'absolute', right: '12px', top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: '#888',
                            padding: 4
                          }}
                        >
                          {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="btn btn-primary"
                      style={{
                        padding: '0.75rem 1.5rem',
                        fontSize: '0.95rem',
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 'bold',
                        cursor: savingSettings ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ➕ Create Branch
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Branches List */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #EFE4DC',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
              }}>
                <h4 style={{ margin: '0 0 1rem', color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700 }}>
                  📋 Existing Branches ({Object.keys(familyBranches).length})
                </h4>

                {Object.keys(familyBranches).length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: '0.95rem' }}>
                    No branch passwords configured. The global family password unlocks the whole tree.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="check-table">
                      <thead>
                        <tr>
                          <th>Branch Key</th>
                          <th>Display Name</th>
                          <th>Root Member</th>
                          <th>Password Hash</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(familyBranches).map(([key, config]) => {
                          const rawRootPid = config.rootPid;
                          const rootPidStr = (rawRootPid && typeof rawRootPid === 'object') ? (rawRootPid.value || rawRootPid.target?.value || '') : (rawRootPid || '');
                          const rootMember = profiles.find(p => p.pid === rootPidStr);
                          const rootName = rootMember ? `${rootMember.firstName} ${rootMember.surName} (${rootPidStr})` : rootPidStr;
                          
                          return (
                            <tr key={key}>
                              <td style={{ fontWeight: 700, color: 'var(--color-maroon, #63131D)' }}>{key}</td>
                              <td style={{ fontWeight: 'bold' }}>{config.name}</td>
                              <td>{rootName}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#777' }}>
                                {config.passwordHash ? `${config.passwordHash.substring(0, 10)}...` : 'None'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleDeleteBranch(key)}
                                  disabled={savingSettings}
                                  style={{
                                    backgroundColor: '#FDEDEC',
                                    color: '#C0392B',
                                    border: '1px solid #FADBD8'
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SHA-256 Hash Generator Card */}
              <div style={{
                backgroundColor: '#FAF8F5',
                border: '1px solid #EFE4DC',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
              }}>
                <h4 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔑 SHA-256 Hash Generator
                </h4>
                <p style={{ margin: '0 0 1.25rem', color: '#666', fontSize: '0.88rem', lineHeight: 1.45 }}>
                  Generate a secure SHA-256 hash for your passwords to use in configuration (`.env`) files.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Input password field */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4A3E39' }}>
                      Enter Password to Hash:
                    </label>
                    <div style={{ position: 'relative', maxWidth: '500px' }}>
                      <input 
                        type={showHashPwd ? 'text' : 'password'}
                        value={hashInput}
                        onChange={(e) => setHashInput(e.target.value)}
                        placeholder="Type password here..."
                        style={{
                          width: '100%',
                          padding: '0.75rem 2.5rem 0.75rem 1rem',
                          borderRadius: '10px',
                          border: '1.5px solid #EFE4DC',
                          backgroundColor: '#ffffff',
                          fontSize: '0.95rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowHashPwd(v => !v)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#888',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px'
                        }}
                      >
                        {showHashPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Output hash field */}
                  {hashOutput && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', animation: 'fadeIn 0.2s ease' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4A3E39' }}>
                        Generated SHA-256 Hash:
                      </label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', maxWidth: '500px' }}>
                        <input 
                          type="text"
                          readOnly
                          value={hashOutput}
                          style={{
                            flex: '1 1 300px',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            border: '1.5px solid #EFE4DC',
                            backgroundColor: '#F9FAF6',
                            color: '#444',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                          onClick={(e) => e.target.select()}
                        />
                        <button
                          onClick={handleCopyHash}
                          className={`btn ${hashCopied ? 'btn-secondary' : 'btn-primary'}`}
                          style={{
                            padding: '0.75rem 1.25rem',
                            fontSize: '0.9rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderRadius: '10px',
                            height: '42px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {hashCopied ? (
                            <>
                              <Check size={16} />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={16} />
                              Copy Hash
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showWipeModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 11000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'white', borderRadius: '16px', padding: '2rem 2.2rem',
              width: '380px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
              animation: 'fadeUp 0.2s ease',
              border: '1.5px solid #FADBD8'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, color: '#C0392B', fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={20} /> Wipe Database
                </h3>
                <button onClick={() => setShowWipeModal(false)} disabled={wipeVerifying}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px' }}>
                  <X size={20} />
                </button>
              </div>
              
              <p style={{ margin: '0 0 1.25rem', color: '#666', fontSize: '0.85rem', lineHeight: 1.4 }}>
                <strong>Warning:</strong> This action will permanently delete all family tree records. This is irreversible.
              </p>

              <form onSubmit={handleConfirmWipe}>
                {/* Confirm input 1: Type 'WIPE' */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#444', marginBottom: '0.4rem' }}>
                    To confirm, type WIPE in all capital letters:
                  </label>
                  <input
                    type="text"
                    value={wipeConfirmText}
                    onChange={(e) => setWipeConfirmText(e.target.value)}
                    placeholder="Type WIPE here"
                    disabled={wipeVerifying}
                    style={{
                      width: '100%', padding: '0.7rem 1rem',
                      borderRadius: '8px', border: '1.5px solid #E0D5CC',
                      fontSize: '0.92rem', boxSizing: 'border-box', outline: 'none',
                      background: '#FDFAF7',
                    }}
                  />
                </div>

                {/* Confirm input 2: Admin password */}
                <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#444', marginBottom: '0.4rem' }}>
                    Enter Admin Password:
                  </label>
                  <input
                    type={showWipePassword ? 'text' : 'password'}
                    value={wipePassword}
                    onChange={(e) => setWipePassword(e.target.value)}
                    placeholder="Admin password"
                    disabled={wipeVerifying}
                    style={{
                      width: '100%', padding: '0.7rem 2.8rem 0.7rem 1rem',
                      borderRadius: '8px', border: '1.5px solid #E0D5CC',
                      fontSize: '0.92rem', boxSizing: 'border-box', outline: 'none',
                      background: '#FDFAF7',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowWipePassword(v => !v)}
                    style={{
                      position: 'absolute', right: '0.75rem', top: '28px',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#888',
                      padding: '4px'
                    }}
                  >
                    {showWipePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="submit"
                    disabled={wipeConfirmText !== 'WIPE' || !wipePassword.trim() || wipeVerifying}
                    className="btn"
                    style={{
                      flex: 1, 
                      justifyContent: 'center', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      backgroundColor: (wipeConfirmText === 'WIPE' && wipePassword.trim() && !wipeVerifying) ? '#C0392B' : '#E59866',
                      color: 'white',
                      border: 'none',
                      cursor: (wipeConfirmText === 'WIPE' && wipePassword.trim() && !wipeVerifying) ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px'
                    }}
                  >
                    {wipeVerifying ? 'Wiping...' : 'Permanently Wipe'}
                  </button>
                  <button type="button" onClick={() => setShowWipeModal(false)} className="btn btn-secondary" disabled={wipeVerifying} style={{ borderRadius: '8px' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cloudinary Credentials Modal */}
        {showCloudinaryModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '2rem',
              width: '100%',
              maxWidth: '450px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700 }}>
                  ☁️ Enter Cloudinary Credentials
                </h4>
                <button 
                  onClick={() => setShowCloudinaryModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} color="#666" />
                </button>
              </div>

              <p style={{ margin: 0, color: '#666', fontSize: '0.85rem', lineHeight: 1.4 }}>
                Enter your Cloudinary API Key and Secret. These are processed securely in-memory and will <strong>NOT</strong> be saved in the browser or database.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4A3E39' }}>Cloudinary API Key:</label>
                <input 
                  type="text"
                  value={cloudinaryApiKey}
                  onChange={(e) => setCloudinaryApiKey(e.target.value)}
                  placeholder="e.g. 896888396441996"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1.5px solid #EFE4DC',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4A3E39' }}>Cloudinary API Secret:</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showCloudinarySecret ? 'text' : 'password'}
                    value={cloudinaryApiSecret}
                    onChange={(e) => setCloudinaryApiSecret(e.target.value)}
                    placeholder="Enter Secret Key"
                    style={{
                      width: '100%',
                      padding: '0.75rem 3rem 0.75rem 1rem',
                      borderRadius: '10px',
                      border: '1.5px solid #EFE4DC',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCloudinarySecret(!showCloudinarySecret)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#999',
                      padding: 4
                    }}
                  >
                    {showCloudinarySecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {cloudinaryModalError && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: '#FFEBEE',
                  color: '#C62828',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}>
                  {cloudinaryModalError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowCloudinaryModal(false)}
                  className="btn"
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: '#f5f5f5',
                    color: '#333',
                    border: '1px solid #ddd',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteCloudinaryScan}
                  className="btn btn-primary"
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Scan & Map
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
