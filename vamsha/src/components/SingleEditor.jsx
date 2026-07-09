import React, { useState, useEffect } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { deletePendingSubmission, getHistoryUrl, getDownloadPhotoUrl, getSettingsUrl, getUploadUrl, fetchSettings, getPidPrefix } from '../lib/api';
import { getAdminPassword } from './AdminGate';
const COMMON_GOTRAMS = [
  'Kashyapa', 'Bharadwaja', 'Haritasa', 'Koundinya', 'Srivatsa', 'Vadhula', 
  'Viswamitra', 'Gautama', 'Atri', 'Vasishtha', 'Angirasa', 'Jamadagni', 'Moundilya',
  'Shandilya', 'Kapi', 'Gargya', 'Sankriti', 'Lohita', 'Parashara', 'Kanva', 'Agastya'
];

const NAKSHATRAS = [
  'Aswini', 'Bharani', 'Krittika', 'Rohini', 'Mrigasira', 'Ardra', 'Punarvasu',
  'Pushya', 'Aslesha', 'Makha', 'Pubba', 'Uttara', 'Hasta', 'Chitra', 'Swati',
  'Visakha', 'Anuradha', 'Jyeshta', 'Moola', 'Poorvashadha', 'Uttarashadha',
  'Sravanam', 'Dhanishta', 'Satabhisha', 'Poorvabhadra', 'Uttarabhadra', 'Revati'
];

const RASHIS = [
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)',
  'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)',
  'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)'
];

const ensureAbsoluteUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
    return url;
  }
  return '/' + url;
};

const normalizeDateToYmd = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return dateStr;
};

const formatHistoryDate = (ts) => {
  if (!ts) return 'Unknown Date';
  if (/^\d{10}$/.test(ts) || (typeof ts === 'number' && ts.toString().length === 10)) {
    return new Date(Number(ts) * 1000).toLocaleString();
  }
  if (/^\d{13}$/.test(ts) || (typeof ts === 'number' && ts.toString().length === 13)) {
    return new Date(Number(ts)).toLocaleString();
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
};

const SingleEditor = ({ profiles, setProfiles, profileToEdit, setProfileToEdit, pendingImportData, onClearPendingImport }) => {
  const [formData, setFormData] = useState(getEmptyForm());
  const [isEditing, setIsEditing] = useState(false);
  const [searchPid, setSearchPid] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [mergePid, setMergePid] = useState('');
  const [photoHostService, setPhotoHostService] = useState('cloudinary');
  const [downloadingPhoto, setDownloadingPhoto] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [allHistory, setAllHistory] = useState([]);
  const [showHistorySection, setShowHistorySection] = useState(false);

  const fetchHistory = async () => {
    try {
      const historyUrl = getHistoryUrl();
      const res = await fetch(historyUrl + (historyUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        setAllHistory(data || []);
      }
    } catch (e) {
      console.warn("Could not load edit history logs:", e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (formData.pid) {
      fetchHistory();
    }
  }, [formData.pid]);

  const getPhotoHosting = (url) => {
    if (!url) return 'cloudinary';
    if (url.includes('cloudinary.com')) return 'cloudinary';
    return 'local';
  };

  const handlePhotoHostChange = async (service) => {
    if (service === 'local' && formData.photoUrl && formData.photoUrl.includes('http') && !formData.photoUrl.includes('/vamsha_db/profile_photos/')) {
      setDownloadingPhoto(true);
      setDownloadError('');
      try {
        const password = getAdminPassword() || '';
        const uploadUrl = getDownloadPhotoUrl();
        
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Password': password
          },
          body: JSON.stringify({
            url: formData.photoUrl,
            pid: formData.pid
          })
        });

        const response = await res.json();
        if (!res.ok) {
          throw new Error(response.error || 'Failed to download remote photo');
        }

        setFormData(prev => ({ ...prev, photoUrl: response.secure_url }));
        setPhotoHostService('local');
      } catch (err) {
        setDownloadError(err.message || 'Error downloading photo');
      } finally {
        setDownloadingPhoto(false);
      }
    } else {
      setPhotoHostService(service);
    }
  };

  const [resolvedAdminUploadService, setResolvedAdminUploadService] = useState('cloudinary');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await fetchSettings();
        if (settings.adminUploadService) {
          setResolvedAdminUploadService(settings.adminUploadService);
          return;
        } else if (settings.uploadService) {
          setResolvedAdminUploadService(settings.uploadService);
          return;
        }
      } catch (e) {
        console.warn('Could not load settings configuration, falling back to env configuration:', e);
      }
      const envService = import.meta.env.VITE_UPLOAD_SERVICE || 'cloudinary';
      setResolvedAdminUploadService(envService);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (profileToEdit) {
      loadProfile(profileToEdit.pid);
      setProfileToEdit(null);
    }
  }, [profileToEdit]);

  const handleMergeTargetChange = (targetPid) => {
    setMergePid(targetPid);
    if (!pendingImportData) return;

    if (targetPid) {
      const existingProfile = profiles.find(p => p.pid === targetPid);
      if (existingProfile) {
        const astroInfo = [
          pendingImportData.birthPlace ? `Birth Place: ${pendingImportData.birthPlace}` : null,
          pendingImportData.gotra ? `Gotra: ${pendingImportData.gotra}` : null,
          pendingImportData.nakshatra ? `Nakshatra: ${pendingImportData.nakshatra}` : null,
          pendingImportData.rashi ? `Rashi: ${pendingImportData.rashi}` : null,
          pendingImportData.fatherNameText ? `Declared Father: ${pendingImportData.fatherNameText}` : null,
          pendingImportData.motherNameText ? `Declared Mother: ${pendingImportData.motherNameText}` : null,
          pendingImportData.spouseNameText ? `Declared Spouse: ${pendingImportData.spouseNameText}` : null
        ].filter(Boolean).join('. ');

        setFormData({
          pid: targetPid,
          firstName: pendingImportData.firstName || existingProfile.firstName || '',
          surName: pendingImportData.surName || existingProfile.surName || '',
          gender: pendingImportData.gender || existingProfile.gender || 'Male',
          maidenName: existingProfile.maidenName || '',
          dob: pendingImportData.birthDate || existingProfile.dob || '',
          phone: pendingImportData.phone || existingProfile.phone || '',
          email: pendingImportData.email || existingProfile.email || '',
          notes: `${existingProfile.notes || ''}\n[Merged Submission]: ${astroInfo}`.trim(),
          fatherId: existingProfile.fatherId || '',
          motherId: existingProfile.motherId || '',
          spouseIds: existingProfile.spouseIds || [],
          displayOrder: existingProfile.displayOrder || 1,
          isDeceased: existingProfile.isDeceased || false,
          deathDate: existingProfile.deathDate || '',
          photoUrl: pendingImportData.photoUrl || existingProfile.photoUrl || '',
          gotram: pendingImportData.gotra || existingProfile.gotram || '',
          nakshatra: pendingImportData.nakshatra || existingProfile.nakshatra || '',
          rashi: pendingImportData.rashi || existingProfile.rashi || ''
        });
        setIsEditing(true);
        setSearchPid(targetPid);
        setPhotoHostService(getPhotoHosting(pendingImportData.photoUrl || existingProfile.photoUrl || ''));
      }
    } else {
      const prefix = getPidPrefix();
      const prefixRegex = new RegExp(`^${prefix}(\\d+)`, 'i');
      const prefixNums = profiles
        .map(p => {
          const match = p.pid.match(prefixRegex);
          return match ? parseInt(match[1]) : 0;
        });
      const nextNum = prefixNums.length > 0 ? Math.max(...prefixNums, 0) + 1 : 1;
      const nextPid = `${prefix}${String(nextNum).padStart(4, '0')}`;
      
      const astroInfo = [
        pendingImportData.birthPlace ? `Birth Place: ${pendingImportData.birthPlace}` : null,
        pendingImportData.gotra ? `Gotra: ${pendingImportData.gotra}` : null,
        pendingImportData.nakshatra ? `Nakshatra: ${pendingImportData.nakshatra}` : null,
        pendingImportData.rashi ? `Rashi: ${pendingImportData.rashi}` : null,
        pendingImportData.fatherNameText ? `Declared Father: ${pendingImportData.fatherNameText}` : null,
        pendingImportData.motherNameText ? `Declared Mother: ${pendingImportData.motherNameText}` : null,
        pendingImportData.spouseNameText ? `Declared Spouse: ${pendingImportData.spouseNameText}` : null
      ].filter(Boolean).join('. ');

      setFormData({
        pid: nextPid,
        firstName: pendingImportData.firstName || '',
        surName: pendingImportData.surName || '',
        gender: pendingImportData.gender || 'Male',
        maidenName: '',
        dob: pendingImportData.birthDate || '',
        phone: pendingImportData.phone || '',
        email: pendingImportData.email || '',
        notes: astroInfo,
        fatherId: '',
        motherId: '',
        spouseIds: [],
        displayOrder: 1,
        isDeceased: false,
        deathDate: '',
        photoUrl: pendingImportData.photoUrl || '',
        gotram: pendingImportData.gotra || '',
        nakshatra: pendingImportData.nakshatra || '',
        rashi: pendingImportData.rashi || ''
      });
      setIsEditing(false);
      setSearchPid('');
      setPhotoHostService(getPhotoHosting(pendingImportData.photoUrl || ''));
    }
  };

  useEffect(() => {
    if (pendingImportData) {
      setMergePid('');
      const isUpdate = !!pendingImportData.isUpdateOfPid;
      const targetPid = pendingImportData.isUpdateOfPid;
      const existingProfile = isUpdate ? profiles.find(p => p.pid === targetPid) : null;

      const prefix = getPidPrefix();
      const prefixRegex = new RegExp(`^${prefix}(\\d+)`, 'i');
      const prefixNums = profiles
        .map(p => {
          const match = p.pid.match(prefixRegex);
          return match ? parseInt(match[1]) : 0;
        });
      const nextNum = prefixNums.length > 0 ? Math.max(...prefixNums, 0) + 1 : 1;
      const nextPid = isUpdate ? targetPid : `${prefix}${String(nextNum).padStart(4, '0')}`;
      
      const astroInfo = [
        pendingImportData.birthPlace ? `Birth Place: ${pendingImportData.birthPlace}` : null,
        pendingImportData.gotra ? `Gotra: ${pendingImportData.gotra}` : null,
        pendingImportData.nakshatra ? `Nakshatra: ${pendingImportData.nakshatra}` : null,
        pendingImportData.rashi ? `Rashi: ${pendingImportData.rashi}` : null,
        pendingImportData.fatherNameText ? `Declared Father: ${pendingImportData.fatherNameText}` : null,
        pendingImportData.motherNameText ? `Declared Mother: ${pendingImportData.motherNameText}` : null,
        pendingImportData.spouseNameText ? `Declared Spouse: ${pendingImportData.spouseNameText}` : null
      ].filter(Boolean).join('. ');

      setFormData({
        pid: nextPid,
        firstName: pendingImportData.firstName || '',
        surName: pendingImportData.surName || '',
        gender: pendingImportData.gender || 'Male',
        maidenName: existingProfile ? (existingProfile.maidenName || '') : '',
        dob: pendingImportData.birthDate || '',
        phone: pendingImportData.phone || '',
        email: pendingImportData.email || '',
        notes: existingProfile 
          ? `${existingProfile.notes || ''}\n[Update Submission]: ${astroInfo}`.trim()
          : astroInfo,
        fatherId: existingProfile ? (existingProfile.fatherId || '') : '',
        motherId: existingProfile ? (existingProfile.motherId || '') : '',
        spouseIds: existingProfile ? (existingProfile.spouseIds || []) : [],
        displayOrder: existingProfile ? (existingProfile.displayOrder || 1) : 1,
        isDeceased: existingProfile ? (existingProfile.isDeceased || false) : false,
        deathDate: existingProfile ? (existingProfile.deathDate || '') : '',
        photoUrl: pendingImportData.photoUrl || (existingProfile ? (existingProfile.photoUrl || '') : ''),
        gotram: pendingImportData.gotra || (existingProfile ? (existingProfile.gotram || '') : ''),
        nakshatra: pendingImportData.nakshatra || (existingProfile ? (existingProfile.nakshatra || '') : ''),
        rashi: pendingImportData.rashi || (existingProfile ? (existingProfile.rashi || '') : '')
      });
      setIsEditing(isUpdate);
      setSearchPid(isUpdate ? targetPid : '');
      setPhotoHostService(getPhotoHosting(pendingImportData.photoUrl || (existingProfile ? (existingProfile.photoUrl || '') : '')));
    }
  }, [pendingImportData, profiles]);

  function getEmptyForm() {
    const prefix = getPidPrefix();
    const prefixRegex = new RegExp(`^${prefix}(\\d+)`, 'i');
    const prefixNums = profiles
      .map(p => {
        const match = p.pid.match(prefixRegex);
        return match ? parseInt(match[1]) : 0;
      });
    const nextNum = prefixNums.length > 0 ? Math.max(...prefixNums, 0) + 1 : 1;
    const nextPid = `${prefix}${String(nextNum).padStart(4, '0')}`;

    return {
      pid: nextPid,
      firstName: '', surName: '', gender: 'Male',
      maidenName: '', dob: '', phone: '', email: '', notes: '',
      fatherId: '', motherId: '', spouseIds: [],
      displayOrder: 1,
      isDeceased: false,
      deathDate: '',
      photoUrl: '',
      gotram: '',
      nakshatra: '',
      rashi: ''
    };
  }

  const loadProfile = (pid) => {
    if (!pid) { setFormData(getEmptyForm()); setIsEditing(false); setPhotoHostService(resolvedAdminUploadService); return; }
    const p = profiles.find(x => x.pid === pid);
    if (p) { 
      setFormData({
        ...p,
        dob: normalizeDateToYmd(p.dob),
        deathDate: normalizeDateToYmd(p.deathDate)
      }); 
      setIsEditing(true); 
      setSearchPid(p.pid); 
      setPhotoHostService(getPhotoHosting(p.photoUrl));
    }
  };

  const handleSearchChange = (e) => { 
    setSearchPid(e.target.value); 
    loadProfile(e.target.value); 
    if (onClearPendingImport) {
      onClearPendingImport();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'fatherId' || name === 'motherId') {
        const fatherId = name === 'fatherId' ? value : prev.fatherId;
        const motherId = name === 'motherId' ? value : prev.motherId;
        
        const originalProfile = profiles.find(p => p.pid === prev.pid);
        if (originalProfile && originalProfile.fatherId === fatherId && originalProfile.motherId === motherId) {
          updated.displayOrder = originalProfile.displayOrder || 1;
        } else if (fatherId || motherId) {
          const siblingsCount = profiles.filter(p =>
            p.pid !== prev.pid &&
            ((fatherId && p.fatherId === fatherId) || (motherId && p.motherId === motherId))
          ).length;
          updated.displayOrder = siblingsCount + 1;
        } else {
          updated.displayOrder = 1;
        }
      }
      return updated;
    });
  };


  const getSiblings = () => {
    if (!formData.fatherId && !formData.motherId) return [];
    const others = profiles.filter(p => {
      if (p.pid === formData.pid) return false;
      if (formData.fatherId && p.fatherId === formData.fatherId) return true;
      if (formData.motherId && p.motherId === formData.motherId) return true;
      return false;
    });
    const selfObj = { ...formData, _isSelf: true };
    return [...others, selfObj].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  };

  const moveSibling = (siblingPid, direction) => {
    const sibs = getSiblings();
    const idx = sibs.findIndex(s => s.pid === siblingPid);
    if (idx === -1) return;

    const swap = (idxA, idxB) => {
      const updatedList = [...sibs];
      [updatedList[idxA], updatedList[idxB]] = [updatedList[idxB], updatedList[idxA]];

      const displayOrderMap = {};
      updatedList.forEach((item, index) => {
        displayOrderMap[item.pid] = index + 1;
      });

      setProfiles(profiles.map(p => {
        if (p.pid in displayOrderMap) {
          return { ...p, displayOrder: displayOrderMap[p.pid] };
        }
        return p;
      }));

      if (formData.pid in displayOrderMap) {
        setFormData(prev => ({ ...prev, displayOrder: displayOrderMap[formData.pid] }));
      }
    };

    if (direction === 'up' && idx > 0) swap(idx, idx - 1);
    else if (direction === 'down' && idx < sibs.length - 1) swap(idx, idx + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isImport = !!pendingImportData;
    const tempPendingId = pendingImportData?.pendingId;

    // Filter out empty spouse strings
    const cleanSpouseIds = (formData.spouseIds || []).filter(id => id && id.trim() !== '');
    const cleanFormData = { ...formData, spouseIds: cleanSpouseIds };

    let updatedProfiles = [...profiles];

    if (isEditing) {
      const oldProfile = profiles.find(p => p.pid === cleanFormData.pid);
      const oldSpouseIds = oldProfile ? (oldProfile.spouseIds || []) : [];

      // 1. Remove spouse linking for spouses that were removed
      const removedSpouseIds = oldSpouseIds.filter(id => !cleanSpouseIds.includes(id));
      updatedProfiles = updatedProfiles.map(p => {
        if (removedSpouseIds.includes(p.pid)) {
          return {
            ...p,
            spouseIds: (p.spouseIds || []).filter(id => id !== cleanFormData.pid)
          };
        }
        return p;
      });

      // 2. Update the main edited profile
      updatedProfiles = updatedProfiles.map(p => p.pid === cleanFormData.pid ? cleanFormData : p);

      // 3. Add spouse linking for spouses that were newly added
      updatedProfiles = updatedProfiles.map(p => {
        if (cleanSpouseIds.includes(p.pid)) {
          const currentSpouses = p.spouseIds || [];
          if (!currentSpouses.includes(cleanFormData.pid)) {
            return {
              ...p,
              spouseIds: [...currentSpouses, cleanFormData.pid]
            };
          }
        }
        return p;
      });

      setProfiles(updatedProfiles);
      alert('Profile Updated Successfully!');
    } else {
      // For new profiles:
      // 1. Add new profile
      updatedProfiles = [...updatedProfiles, cleanFormData];

      // 2. Link spouses
      updatedProfiles = updatedProfiles.map(p => {
        if (cleanSpouseIds.includes(p.pid)) {
          const currentSpouses = p.spouseIds || [];
          if (!currentSpouses.includes(cleanFormData.pid)) {
            return {
              ...p,
              spouseIds: [...currentSpouses, cleanFormData.pid]
            };
          }
        }
        return p;
      });

      setProfiles(updatedProfiles);
      alert('Profile Added Successfully!');
    }

    if (isImport && tempPendingId) {
      try {
        const adminPassword = getAdminPassword();
        await deletePendingSubmission(tempPendingId, adminPassword);
        if (onClearPendingImport) {
          onClearPendingImport();
        }
      } catch (err) {
        console.error('Failed to clear pending submission from server:', err);
      }
    }

    setFormData(getEmptyForm()); setIsEditing(false); setSearchPid(''); setPhotoHostService(resolvedAdminUploadService); setMergePid('');
  };

  const handleDelete = () => {
    setProfiles(profiles.filter(p => p.pid !== formData.pid));
    setFormData(getEmptyForm()); setIsEditing(false); setSearchPid(''); setShowDeleteConfirm(false); setPhotoHostService(resolvedAdminUploadService); setMergePid('');
  };

  const siblings = getSiblings();
  const sortedProfiles = [...profiles].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

  return (
    <div className="card" style={{ marginBottom: '2rem', padding: '2rem', borderRadius: '12px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-maroon)', fontSize: '1.5rem', margin: 0 }}>
          {isEditing ? 'Edit Profile' : 'Add New Profile'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FAFAFA', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #EEE' }}>
          <SearchableSelect
            value={searchPid}
            placeholder="-- Add New --"
            onChange={handleSearchChange}
            options={[
              { value: '', label: '-- Add New --' },
              ...sortedProfiles.map(p => ({
                value: p.pid,
                label: `${p.firstName} ${p.surName} (${p.pid})`
              }))
            ]}
            style={{ minWidth: '220px' }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {pendingImportData && !pendingImportData.isUpdateOfPid && (
          <div style={{
            backgroundColor: '#FFF5F0',
            border: '1.5px solid #F3D9C9',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxSizing: 'border-box',
            width: '100%'
          }}>
            <p style={{ margin: '0 0 0.75rem 0', color: 'var(--color-maroon, #63131D)', fontWeight: 'bold', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📝 Reviewing Submission for: <span style={{ textDecoration: 'underline', color: 'var(--color-maroon, #63131D)' }}>{pendingImportData.firstName} {pendingImportData.surName}</span>
            </p>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#666', lineHeight: 1.45 }}>
              By default, this will create a **NEW** family member profile. If this person already exists in the tree, select them below to merge/overwrite their details (this preserves their parents, spouse, and display order relationships).
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '500px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#4A3E39' }}>
                Merge into Existing Profile:
              </label>
              <SearchableSelect
                name="mergePid"
                value={mergePid}
                onChange={(e) => handleMergeTargetChange(e.target.value)}
                placeholder="-- Create New Profile (Default) --"
                options={[
                  { value: '', label: '-- Create New Profile (Default) --' },
                  ...sortedProfiles.map(p => ({
                    value: p.pid,
                    label: `${p.firstName} ${p.surName} (${p.pid})`
                  }))
                ]}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem', marginBottom: '1.5rem' }}>
          
          {/* LEFT COLUMN: Basic & Relationship Details (70% width) */}
          <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <h4 style={{ color: 'var(--color-maroon, #63131D)', margin: '0 0 0.5rem 0', borderBottom: '2px solid var(--color-sandalwood, #EADDCA)', paddingBottom: '0.4rem', fontWeight: '800' }}>
              Basic Information
            </h4>

            {/* Row 1: PID & Deceased checkbox & Death Date */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                <label>Profile ID</label>
                <input type="text" name="pid" value={formData.pid || ''} readOnly style={{ backgroundColor: '#EEE', color: '#666', fontWeight: '600' }} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '150px', display: 'flex', alignItems: 'center', gap: '0.6rem', height: '100%', paddingTop: '1.8rem' }}>
                <input
                  type="checkbox"
                  name="isDeceased"
                  id="single-isDeceased"
                  checked={formData.isDeceased || false}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    isDeceased: e.target.checked,
                    deathDate: e.target.checked ? prev.deathDate : ''
                  }))}
                  style={{ width: 'auto', height: 'auto', transform: 'scale(1.25)', cursor: 'pointer', margin: 0 }}
                />
                <label htmlFor="single-isDeceased" style={{ cursor: 'pointer', margin: 0, fontWeight: 700, userSelect: 'none', color: '#333' }}>
                  Deceased
                </label>
              </div>
              {formData.isDeceased && (
                <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                  <label>Date of Death (Optional)</label>
                  <input
                    type="date"
                    name="deathDate"
                    value={formData.deathDate || ''}
                    onChange={handleInputChange}
                  />
                </div>
              )}
            </div>

            {/* Row 2: First Name and Surname */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label>First Name <span style={{ color: 'red' }}>*</span></label>
                <input type="text" name="firstName" value={formData.firstName || ''} onChange={handleInputChange} required />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label>Sur Name</label>
                <input type="text" name="surName" value={formData.surName || ''} onChange={handleInputChange} />
              </div>
            </div>

            {/* Row 3: Gender, Date of Birth, Maiden Name (if female) */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                <label>Gender <span style={{ color: 'red' }}>*</span></label>
                <select name="gender" value={formData.gender || 'Male'} onChange={handleInputChange} required style={{ height: '38px', padding: '0px 10px', boxSizing: 'border-box', lineHeight: 'normal' }}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              {formData.gender === 'Female' && (
                <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                  <label>Maiden Name</label>
                  <input type="text" name="maidenName" value={formData.maidenName || ''} onChange={handleInputChange} />
                </div>
              )}
              <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                <label>Date of Birth</label>
                <input type="date" name="dob" value={formData.dob || ''} onChange={handleInputChange} />
              </div>
            </div>

            {/* Row 4: Phone and Email */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label>Phone Number</label>
                <input type="tel" name="phone" value={formData.phone || ''} onChange={handleInputChange} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label>Email ID</label>
                <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} />
              </div>
            </div>

            <h4 style={{ color: 'var(--color-maroon, #63131D)', margin: '1rem 0 0.5rem 0', borderBottom: '2px solid var(--color-sandalwood, #EADDCA)', paddingBottom: '0.4rem', fontWeight: '800' }}>
              Relationships
            </h4>

            {/* Row 5: Father, Mother selections and Gotram Input side-by-side */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                <label>Father</label>
                <SearchableSelect
                  name="fatherId"
                  value={formData.fatherId || ''}
                  onChange={handleInputChange}
                  placeholder="-- Select Father --"
                  options={[
                    { value: '', label: '-- Select Father --' },
                    ...sortedProfiles.filter(p => p.gender === 'Male' && p.pid !== formData.pid).map(p => ({
                      value: p.pid,
                      label: `${p.firstName} ${p.surName} (${p.pid})`
                    }))
                  ]}
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                <label>Mother</label>
                <SearchableSelect
                  name="motherId"
                  value={formData.motherId || ''}
                  onChange={handleInputChange}
                  placeholder="-- Select Mother --"
                  options={[
                    { value: '', label: '-- Select Mother --' },
                    ...sortedProfiles.filter(p => p.gender === 'Female' && p.pid !== formData.pid).map(p => ({
                      value: p.pid,
                      label: `${p.firstName} ${p.surName} (${p.pid})`
                    }))
                  ]}
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                <label>Gotram</label>
                <input
                  type="text"
                  name="gotram"
                  list="gotram-list-editor"
                  value={formData.gotram || ''}
                  onChange={handleInputChange}
                  placeholder="Select or type Gotram"
                  style={{ height: '38px', boxSizing: 'border-box', margin: 0 }}
                />
                <datalist id="gotram-list-editor">
                  {COMMON_GOTRAMS.map(g => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Astro Information (Nakshatra & Rashi) Row */}
            <div className="form-row-mobile" style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                <label>Nakshatra</label>
                <select
                  name="nakshatra"
                  value={formData.nakshatra || ''}
                  onChange={handleInputChange}
                  style={{ height: '38px', boxSizing: 'border-box', margin: 0, width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '0 8px' }}
                >
                  <option value="">-- Select Nakshatra --</option>
                  {NAKSHATRAS.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                <label>Rashi</label>
                <select
                  name="rashi"
                  value={formData.rashi || ''}
                  onChange={handleInputChange}
                  style={{ height: '38px', boxSizing: 'border-box', margin: 0, width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '0 8px' }}
                >
                  <option value="">-- Select Rashi --</option>
                  {RASHIS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Spouses List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', backgroundColor: '#FAF9F6', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-sandalwood, #EADDCA)', boxSizing: 'border-box' }}>
              <label style={{ fontWeight: '800', color: 'var(--color-maroon, #63131D)', fontSize: '0.9rem', margin: 0 }}>Spouses</label>
              
              {(formData.spouseIds || []).map((spouseId, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <SearchableSelect
                      name={`spouse-${index}`}
                      value={spouseId}
                      onChange={(e) => {
                        const newSpouses = [...(formData.spouseIds || [])];
                        newSpouses[index] = e.target.value;
                        setFormData(prev => ({ ...prev, spouseIds: newSpouses }));
                      }}
                      placeholder="-- Select Spouse --"
                      options={[
                        { value: '', label: '-- Select Spouse --' },
                        ...sortedProfiles.filter(p => p.gender !== formData.gender && p.pid !== formData.pid).map(p => ({
                          value: p.pid,
                          label: `${p.firstName} ${p.surName} (${p.pid})`
                        }))
                      ]}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newSpouses = (formData.spouseIds || []).filter((_, i) => i !== index);
                      setFormData(prev => ({ ...prev, spouseIds: newSpouses }));
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0 0.5rem', height: '38px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px' }}
                    title="Remove Spouse"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const currentSpouses = formData.spouseIds || [];
                  setFormData(prev => ({ ...prev, spouseIds: [...currentSpouses, ''] }));
                }}
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', fontWeight: 'bold', marginTop: '0.25rem' }}
              >
                ➕ Add Spouse
              </button>
            </div>

            {/* Collapsible History Section */}
            {isEditing && formData.pid && (
              <div style={{
                marginTop: '1.5rem',
                border: '1px solid var(--color-sandalwood, #EADDCA)',
                borderRadius: '12px',
                backgroundColor: '#FAF9F6',
                overflow: 'hidden',
                boxSizing: 'border-box'
              }}>
                <div 
                  onClick={() => setShowHistorySection(!showHistorySection)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#EFE4DC',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <span style={{ fontWeight: '800', color: 'var(--color-maroon, #63131D)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📜 View Edit History
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold' }}>
                    {showHistorySection ? '▲ Collapse' : '▼ Expand'}
                  </span>
                </div>

                {showHistorySection && (
                  <div style={{ padding: '1rem', backgroundColor: 'white' }}>
                    {allHistory.filter(h => h.pid === formData.pid).length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#777', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem 0' }}>
                        No past changes recorded for this profile.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                        {allHistory
                          .filter(h => h.pid === formData.pid)
                          .map((entry, idx) => {
                            const date = formatHistoryDate(entry.timestamp);
                            const isDelete = entry.action === 'delete';
                            return (
                              <div key={idx} style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                borderLeft: `3px solid ${isDelete ? '#C0392B' : '#2980B9'}`,
                                backgroundColor: '#FDFEFE',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                fontSize: '0.82rem'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px dashed #EEE', paddingBottom: '0.2rem' }}>
                                  <span style={{ fontWeight: 'bold', color: isDelete ? '#C0392B' : '#2980B9' }}>
                                    {isDelete ? '❌ Profile Deleted' : '✏️ Profile Modified'}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: '#888' }}>
                                    {date}
                                  </span>
                                </div>
                                <div style={{ color: '#444', lineHeight: '1.4' }}>
                                  {isDelete ? (
                                    <span>Entire profile was deleted. Saved for reference.</span>
                                  ) : (
                                    <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      {Object.entries(entry.oldData || {}).map(([field, oldVal]) => {
                                        let displayVal = oldVal === null || oldVal === undefined || oldVal === '' ? '(empty)' : String(oldVal);
                                        if (Array.isArray(oldVal)) {
                                          displayVal = oldVal.length > 0 ? oldVal.join(', ') : '(empty)';
                                        }
                                        return (
                                          <li key={field}>
                                            <strong>{field}</strong> changed from: <span style={{ color: '#C0392B', textDecoration: 'line-through' }}>{displayVal}</span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Profile Photo Preview & Cropper (30% width) */}
          <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', backgroundColor: '#FAF9F6', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--color-sandalwood, #EADDCA)', height: 'fit-content', boxSizing: 'border-box' }}>
            
            <h4 style={{ color: 'var(--color-maroon, #63131D)', margin: '0 0 0.5rem 0', alignSelf: 'flex-start', borderBottom: '2px solid var(--color-sandalwood, #EADDCA)', paddingBottom: '0.4rem', width: '100%', fontWeight: '800' }}>
              Profile Photo
            </h4>

            {/* Large Photo Preview */}
            <div style={{
              width: '180px',
              height: '180px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '2px solid var(--color-maroon, #63131D)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
              backgroundColor: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0
            }}>
              {formData.photoUrl ? (
                <img 
                  src={ensureAbsoluteUrl(formData.photoUrl)} 
                  alt="Profile Avatar" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span style={{ fontSize: '3.5rem' }}>👤</span>
              )}
            </div>

            {/* Crop Button */}
            <button 
              type="button" 
              onClick={() => setShowCropModal(true)} 
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 'bold', width: '100%', justifyContent: 'center' }}
            >
              ✂️ Crop / Edit Photo
            </button>

            {/* Hosting Selection Control */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--color-sandalwood, #EADDCA)', paddingTop: '0.75rem', marginTop: '0.25rem', boxSizing: 'border-box' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', display: 'block' }}>
                Storage Location:
              </span>
              <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', color: '#333', margin: 0 }}>
                  <input
                    type="radio"
                    name="photoHostService"
                    value="cloudinary"
                    checked={photoHostService === 'cloudinary'}
                    onChange={() => handlePhotoHostChange('cloudinary')}
                    disabled={downloadingPhoto}
                    style={{ margin: 0, cursor: 'pointer' }}
                  />
                  Cloudinary
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', color: '#333', margin: 0 }}>
                  <input
                    type="radio"
                    name="photoHostService"
                    value="local"
                    checked={photoHostService === 'local'}
                    onChange={() => handlePhotoHostChange('local')}
                    disabled={downloadingPhoto}
                    style={{ margin: 0, cursor: 'pointer' }}
                  />
                  cPanel (Local)
                </label>
              </div>
              {downloadingPhoto && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-maroon, #63131D)', fontWeight: 'bold', textAlign: 'center', marginTop: '0.2rem' }}>
                  ⏳ Downloading image to local server...
                </div>
              )}
              {downloadError && (
                <div style={{ fontSize: '0.7rem', color: '#DC3545', fontWeight: 'bold', textAlign: 'center', marginTop: '0.2rem' }}>
                  ⚠️ {downloadError}
                </div>
              )}
            </div>

            {/* Photo URL */}
            <div className="form-group" style={{ width: '100%', marginTop: '0.5rem', marginBottom: 0 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '0.3rem' }}>Photo URL (Optional)</label>
              <input 
                type="text" 
                name="photoUrl" 
                value={formData.photoUrl || ''} 
                onChange={handleInputChange} 
                placeholder="No photo linked" 
                style={{ fontSize: '0.8rem', padding: '0.4rem', boxSizing: 'border-box', width: '100%', margin: 0 }}
              />
            </div>

          </div>

        </div>

        {/* Siblings Section — shown only if father or mother is set */}
        {(formData.fatherId || formData.motherId) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ color: 'var(--color-maroon)', marginBottom: '1rem', display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
              Siblings Order
              <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#888' }}>
                Use ⬆️⬇️ to set elder/younger order (1 = eldest)
              </span>
            </h4>
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', border: '1px solid #EEE', overflow: 'hidden' }}>
              {/* Visual order preview — all siblings including self */}
              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #E8E0D5', backgroundColor: '#FDF8F3' }}>
                <div style={{ fontSize: '0.78rem', color: '#999', marginBottom: '0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Order</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {siblings
                    .map((s, i) => (
                      <span key={s.pid} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.82rem',
                        backgroundColor: s._isSelf ? 'var(--color-maroon)' : (s.gender === 'Male' ? '#D6EAF8' : '#FDEDEC'),
                        color: s._isSelf ? 'white' : '#333',
                        border: s._isSelf ? 'none' : '1px solid #ddd',
                        fontWeight: s._isSelf ? 700 : 400
                      }}>
                        <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>#{i + 1}</span>
                        {s.firstName}
                        {s._isSelf && <span style={{ fontSize: '0.68rem', opacity: 0.85 }}> ★</span>}
                      </span>
                    ))
                  }
                </div>
              </div>

              {/* Sibling list with up/down buttons */}
              {siblings.length === 0 ? (
                <div style={{ padding: '1rem 1.25rem', color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  No other siblings found for the selected parents.
                </div>
              ) : (
                <div style={{ padding: '0.5rem' }}>
                  {siblings.map((s, idx) => (
                    <div key={s.pid} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '2px', backgroundColor: s._isSelf ? '#FFF8F2' : '#fff', border: s._isSelf ? '1.5px solid var(--color-maroon)' : '1px solid #F0F0F0' }}>
                      <span style={{ minWidth: '26px', height: '26px', borderRadius: '50%', backgroundColor: s._isSelf ? 'var(--color-maroon)' : 'var(--color-sandalwood)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: s._isSelf ? 'white' : 'var(--color-maroon)', flexShrink: 0 }}>
                        {s.displayOrder || '?'}
                      </span>
                      <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: s._isSelf ? 700 : 400 }}>
                        {s.firstName} {s.surName}
                        {s._isSelf && <span style={{ color: 'var(--color-maroon)', fontSize: '0.8rem', marginLeft: '0.4rem', fontWeight: 'bold' }}>(You)</span>}
                        <span style={{ fontSize: '0.78rem', color: '#bbb', marginLeft: '0.4rem' }}>({s.pid})</span>
                      </span>
                      <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '10px', backgroundColor: s.gender === 'Male' ? '#D6EAF8' : '#FDEDEC', color: s.gender === 'Male' ? '#2471A3' : '#A93226', flexShrink: 0 }}>
                        {s.gender}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button type="button" className="btn-icon" onClick={() => moveSibling(s.pid, 'up')} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }} title="Move Up (Elder)">⬆️</button>
                        <button type="button" className="btn-icon" onClick={() => moveSibling(s.pid, 'down')} disabled={idx === siblings.length - 1} style={{ opacity: idx === siblings.length - 1 ? 0.3 : 1 }} title="Move Down (Younger)">⬇️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label>Additional Notes</label>
          <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} rows="3" style={{ resize: 'vertical' }}></textarea>
        </div>

        {/* User Submission Note / Message to Admin */}
        {pendingImportData && pendingImportData.submissionNote && (
          <div style={{ 
            marginTop: '1.5rem', 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            backgroundColor: '#FFFDEB', 
            border: '1px solid #FFEAA7', 
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#634A00',
            boxSizing: 'border-box'
          }}>
            <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>✉️ User Message / Note:</strong>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
              {pendingImportData.submissionNote}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#F8F9FA', borderRadius: '8px', display: 'flex', gap: '1rem', justifyContent: 'space-between', border: '1px solid #EEE' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
              {isEditing ? <><Edit2 size={18} /> Update Profile</> : <><Plus size={18} /> Add Profile</>}
            </button>
            {isEditing && (
              <button type="button" className="btn btn-secondary" onClick={() => { setIsEditing(false); setFormData(getEmptyForm()); setSearchPid(''); }}>
                Cancel Edit
              </button>
            )}
          </div>
          {isEditing && (
            showDeleteConfirm ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: '#DC3545', fontWeight: 'bold' }}>Are you sure?</span>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>No</button>
                <button type="button" className="btn" style={{ backgroundColor: '#DC3545', color: 'white' }} onClick={handleDelete}>Yes, Delete</button>
              </div>
            ) : (
              <button type="button" className="btn" style={{ backgroundColor: '#DC3545', color: 'white' }} onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={18} /> Delete Profile
              </button>
            )
          )}
        </div>

      </form>

      <PhotoCropModal
        isOpen={showCropModal}
        onClose={() => setShowCropModal(false)}
        initialPhotoUrl={formData.photoUrl}
        onUploadSuccess={(url) => setFormData(prev => ({ ...prev, photoUrl: url }))}
        uploadService={photoHostService}
      />
    </div>
  );
};

const PhotoCropModal = ({ isOpen, onClose, initialPhotoUrl, onUploadSuccess, uploadService }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ clientX: 0, clientY: 0, offsetX: 0, offsetY: 0 });
  const [imgRatio, setImgRatio] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);

  const fileInputRef = React.useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (initialPhotoUrl) {
        const absoluteUrl = ensureAbsoluteUrl(initialPhotoUrl);
        setPreviewUrl(absoluteUrl);
        loadImageDetails(absoluteUrl);
        setSelectedFile({ name: 'current_photo.jpg', type: 'image/jpeg', size: 0, isVirtual: true });
      } else {
        setPreviewUrl('');
        setSelectedFile(null);
      }
      setStatus(null);
    }
  }, [isOpen, initialPhotoUrl]);

  const loadImageDetails = (url) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = ensureAbsoluteUrl(url);
    img.onload = () => {
      setImgRatio(img.width / img.height);
      setZoom(1);
      setImageOffset({ x: 0, y: 0 });
      setRotation(0);
    };
  };

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatus({ type: 'error', text: 'Photo file size must be less than 2 MB' });
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setStatus({ type: 'error', text: 'Invalid file format. Please upload JPG, JPEG or PNG' });
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    loadImageDetails(objectUrl);
    setStatus(null);
  };

  const handleDragStart = (e) => {
    if (!previewUrl) return;
    setIsDragging(true);
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    setDragStart({
      clientX,
      clientY,
      offsetX: imageOffset.x,
      offsetY: imageOffset.y
    });
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const dx = clientX - dragStart.clientX;
    const dy = clientY - dragStart.clientY;

    let finalDx = dx;
    let finalDy = dy;
    if (rotation === 90) {
      finalDx = dy;
      finalDy = -dx;
    } else if (rotation === 180) {
      finalDx = -dx;
      finalDy = -dy;
    } else if (rotation === 270) {
      finalDx = -dy;
      finalDy = dx;
    }

    setImageOffset({
      x: dragStart.offsetX + finalDx,
      y: dragStart.offsetY + finalDy
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const generateCroppedBlob = () => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = ensureAbsoluteUrl(previewUrl);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const avatarSize = 300;
        canvas.width = avatarSize;
        canvas.height = avatarSize;
        const ctx = canvas.getContext('2d');

        const containerSize = 280;
        const cropSize = 260;

        const imgRatio = img.width / img.height;
        let renderW, renderH;
        if (imgRatio > 1) {
          renderH = containerSize;
          renderW = containerSize * imgRatio;
        } else {
          renderW = containerSize;
          renderH = containerSize / imgRatio;
        }

        const finalW = renderW * zoom;
        const finalH = renderH * zoom;

        const defaultX = (containerSize - finalW) / 2;
        const defaultY = (containerSize - finalH) / 2;
        
        const finalX = defaultX + imageOffset.x;
        const finalY = defaultY + imageOffset.y;

        const scaleFactor = avatarSize / cropSize;
        const dx = (finalX - 140) * scaleFactor;
        const dy = (finalY - 140) * scaleFactor;
        const dw = finalW * scaleFactor;
        const dh = finalH * scaleFactor;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, avatarSize, avatarSize);

        const midpoint = avatarSize / 2;
        ctx.translate(midpoint, midpoint);
        ctx.rotate((rotation * Math.PI) / 180);

        ctx.drawImage(img, dx, dy, dw, dh);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        }, 'image/jpeg', 0.95);
      };
      img.onerror = (err) => reject(err);
    });
  };

  const handleUpload = async () => {
    if (!previewUrl) {
      setStatus({ type: 'error', text: 'Please choose a photo first.' });
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const croppedBlob = await generateCroppedBlob();
      
      let uploadUrl = getUploadUrl();
      
      const payload = new FormData();
      
      if (uploadService === 'cloudinary') {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
        payload.append('file', croppedBlob);
        payload.append('upload_preset', uploadPreset);
      } else {
        payload.append('file', croppedBlob, 'cropped_photo.jpg');
      }

      const headers = {};
      if (uploadService !== 'cloudinary') {
        headers['X-Admin-Password'] = getAdminPassword() || '';
      }

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: payload
      });

      const response = await res.json();
      if (!res.ok) {
        throw new Error(response.error || 'Failed to upload photo');
      }

      onUploadSuccess(response.secure_url);
      onClose();
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Failed to upload photo.' });
    } finally {
      setUploading(false);
    }
  };

  const getImageStyles = () => {
    const containerSize = 280;
    let width, height;
    if (imgRatio > 1) {
      height = containerSize;
      width = containerSize * imgRatio;
    } else {
      width = containerSize;
      height = containerSize / imgRatio;
    }
    const finalW = width * zoom;
    const finalH = height * zoom;
    const defaultX = (containerSize - finalW) / 2;
    const defaultY = (containerSize - finalH) / 2;
    return {
      position: 'absolute',
      width: `${finalW}px`,
      height: `${finalH}px`,
      left: `${defaultX + imageOffset.x}px`,
      top: `${defaultY + imageOffset.y}px`,
      transform: `rotate(${rotation}deg)`,
      transformOrigin: 'center center',
      cursor: 'move',
      userSelect: 'none',
      pointerEvents: 'auto'
    };
  };

  return (
    <div style={modalStyles.backdrop}>
      <div style={modalStyles.modal}>
        
        <div style={modalStyles.header}>
          <h4 style={modalStyles.title}>Crop & Upload Profile Photo</h4>
          <button onClick={onClose} style={modalStyles.closeBtn}><X size={18} /></button>
        </div>

        {status && (
          <div style={{
            ...modalStyles.status,
            backgroundColor: status.type === 'error' ? '#FDF2F2' : '#F0FDF4',
            border: `1px solid ${status.type === 'error' ? '#FDE8E8' : '#DCFCE7'}`,
            color: status.type === 'error' ? '#9B1C1C' : '#15803D',
          }}>
            {status.text}
          </div>
        )}

        <div style={modalStyles.body}>
          
          <div style={modalStyles.cropperCol}>
            {previewUrl ? (
              <div 
                style={modalStyles.cropContainer}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchMove={handleDragMove}
                onTouchEnd={handleDragEnd}
              >
                <img 
                  src={ensureAbsoluteUrl(previewUrl)} 
                  alt="Crop Target" 
                  style={getImageStyles()} 
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                  draggable={false}
                />
                <div style={modalStyles.circularOverlay} />
              </div>
            ) : (
              <div style={modalStyles.emptyContainer} onClick={() => fileInputRef.current?.click()}>
                <span>📷</span>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-maroon, #63131D)' }}>
                  Click to select photo
                </p>
              </div>
            )}

            {previewUrl && (
              <div style={modalStyles.controls}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                  <button 
                    onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
                    style={modalStyles.controlBtn}
                    title="Zoom Out"
                  >
                    ➖
                  </button>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="5" 
                    step="0.05"
                    value={zoom} 
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    style={{ width: '120px' }}
                  />
                  <button 
                    onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}
                    style={modalStyles.controlBtn}
                    title="Zoom In"
                  >
                    ➕
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                    style={modalStyles.actionBtn}
                  >
                    🔄 Rotate 90°
                  </button>
                  <button 
                    onClick={() => { setZoom(1); setImageOffset({ x: 0, y: 0 }); setRotation(0); }}
                    style={modalStyles.actionBtn}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={modalStyles.infoCol}>
            <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
              Upload a profile photo. Drag the image to position it inside the circle, and use zoom/rotate tools to frame the face cleanly.
            </p>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              style={{ display: 'none' }} 
            />

            <button 
              onClick={() => fileInputRef.current?.click()} 
              style={modalStyles.uploadBtn}
            >
              Choose New Photo File
            </button>

            <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
              <button 
                onClick={handleUpload}
                disabled={uploading || !previewUrl}
                style={{
                  ...modalStyles.saveBtn,
                  backgroundColor: (uploading || !previewUrl) ? '#ccc' : 'var(--color-maroon, #63131D)'
                }}
              >
                {uploading ? 'Uploading Photo...' : 'Upload & Apply Photo'}
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

const modalStyles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '600px',
    maxWidth: '95%',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    border: '1px solid var(--color-sandalwood, #EADDCA)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.8rem 1.2rem',
    borderBottom: '1px solid var(--color-sandalwood, #EADDCA)',
    backgroundColor: '#FAF8F5'
  },
  title: {
    margin: 0,
    color: 'var(--color-maroon, #63131D)',
    fontWeight: '800',
    fontSize: '1rem'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#888',
    display: 'flex',
    alignItems: 'center'
  },
  body: {
    padding: '1.2rem',
    display: 'flex',
    gap: '1.2rem',
    flexWrap: 'wrap'
  },
  status: {
    margin: '1rem 1.2rem 0 1.2rem',
    padding: '0.6rem 0.8rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  cropperCol: {
    flex: 1.1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.8rem'
  },
  infoCol: {
    flex: 0.9,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    borderLeft: '1px solid var(--color-sandalwood, #EADDCA)',
    paddingLeft: '1.2rem'
  },
  cropContainer: {
    position: 'relative',
    width: '280px',
    height: '280px',
    overflow: 'hidden',
    backgroundColor: '#FAF8F5',
    border: '1px solid var(--color-sandalwood, #EADDCA)',
    borderRadius: '8px'
  },
  circularOverlay: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    width: '260px',
    height: '260px',
    borderRadius: '50%',
    boxShadow: '0 0 0 9999px rgba(250, 248, 245, 0.75)',
    border: '2px solid var(--color-gold, #D4AF37)',
    pointerEvents: 'none',
    boxSizing: 'border-box'
  },
  emptyContainer: {
    width: '280px',
    height: '280px',
    border: '2px dashed var(--color-sandalwood, #EADDCA)',
    borderRadius: '8px',
    backgroundColor: '#FAF8F5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  controls: {
    width: '100%',
    textAlign: 'center'
  },
  controlBtn: {
    border: '1px solid #ccc',
    background: 'white',
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '0.2rem 0.4rem',
    fontSize: '0.78rem'
  },
  actionBtn: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--color-maroon, #63131D)',
    border: '1px solid var(--color-sandalwood, #EADDCA)',
    backgroundColor: '#FAF8F5',
    borderRadius: '6px',
    padding: '0.35rem 0.6rem',
    cursor: 'pointer',
    outline: 'none'
  },
  uploadBtn: {
    width: '100%',
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid var(--color-maroon, #63131D)',
    color: 'var(--color-maroon, #63131D)',
    backgroundColor: 'white',
    fontWeight: '800',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  saveBtn: {
    width: '100%',
    padding: '0.7rem',
    borderRadius: '8px',
    border: 'none',
    color: 'var(--color-gold, #D4AF37)',
    fontWeight: '800',
    fontSize: '0.88rem',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  }
};

export default SingleEditor;
