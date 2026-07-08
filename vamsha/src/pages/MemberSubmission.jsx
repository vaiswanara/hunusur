import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Phone, Mail, Lock, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { submitPendingProfile, getSettingsUrl } from '../lib/api';
import SearchableSelect from '../components/SearchableSelect';

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

const COMMON_GOTRAMS = [
  'Kashyapa', 'Bharadwaja', 'Haritasa', 'Koundinya', 'Srivatsa', 'Vadhula',
  'Viswamitra', 'Gautama', 'Atri', 'Vasishtha', 'Angirasa', 'Jamadagni', 'Moundilya',
  'Shandilya', 'Kapi', 'Gargya', 'Sankriti', 'Lohita', 'Parashara', 'Kanva', 'Agastya'
];

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

const MemberSubmission = ({ profiles = [] }) => {
  const navigate = useNavigate();

  // --- PASSWORD GATE STATE ---
  const [password, setPassword] = useState(() => {
    return sessionStorage.getItem('vamsha_family_pwd') || sessionStorage.getItem('vamsha_admin_pwd') || '';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // --- SUBMISSION MODE STATE ---
  const [submissionMode, setSubmissionMode] = useState('create'); // 'create' | 'update'
  const [selectedPidToUpdate, setSelectedPidToUpdate] = useState('');

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    firstName: '',
    surName: '',
    gender: 'Male',
    birthDate: '',
    birthPlace: '',
    gotra: '',
    nakshatra: '',
    rashi: '',
    phone: '',
    email: '',
    fatherNameText: '',
    motherNameText: '',
    spouseNameText: '',
    submissionNote: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'error' | 'success', text: string }
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef(null);
  const [resolvedUploadService, setResolvedUploadService] = useState('local');

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Load configuration settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsUrl = getSettingsUrl();
        const res = await fetch(settingsUrl + (settingsUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
        if (res.ok) {
          const settings = await res.json();
          if (settings.userUploadService) {
            setResolvedUploadService(settings.userUploadService);
            return;
          } else if (settings.uploadService) {
            setResolvedUploadService(settings.uploadService);
            return;
          }
        }
      } catch (e) {
        console.warn('Could not load settings configuration, falling back to env configuration:', e);
      }
      const envService = import.meta.env.VITE_UPLOAD_SERVICE || 'local';
      setResolvedUploadService(envService);
    };
    loadSettings();
  }, []);

  // Handle password check
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError('Password cannot be empty');
      return;
    }
    sessionStorage.setItem('vamsha_family_pwd', passwordInput.trim());
    setPassword(passwordInput.trim());
    setPasswordError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSelectForUpdate = (pid) => {
    setSelectedPidToUpdate(pid);
    if (!pid) {
      setFormData({
        firstName: '',
        surName: '',
        gender: 'Male',
        birthDate: '',
        birthPlace: '',
        gotra: '',
        nakshatra: '',
        rashi: '',
        phone: '',
        email: '',
        fatherNameText: '',
        motherNameText: '',
        spouseNameText: '',
        submissionNote: '',
      });
      setPreviewUrl('');
      setSelectedFile(null);
      return;
    }
    const p = profiles.find(x => x.pid === pid);
    if (p) {
      setFormData({
        firstName: p.firstName || '',
        surName: p.surName || '',
        gender: p.gender || 'Male',
        birthDate: normalizeDateToYmd(p.dob) || '',
        birthPlace: '',
        gotra: p.gotram || '',
        nakshatra: '',
        rashi: '',
        phone: p.phone || '',
        email: p.email || '',
        fatherNameText: '',
        motherNameText: '',
        spouseNameText: '',
        submissionNote: '',
      });
      if (p.photoUrl) {
        setPreviewUrl(p.photoUrl);
      } else {
        setPreviewUrl('');
      }
      setSelectedFile(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setStatus({ type: 'error', text: 'Photo file size must be less than 2 MB' });
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setStatus({ type: 'error', text: 'Invalid file format. Please upload JPG, JPEG or PNG' });
      return;
    }

    setSelectedFile(file);
    setStatus(null);

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (!formData.firstName.trim()) {
      setStatus({ type: 'error', text: 'First Name is required.' });
      return;
    }

    setLoading(true);

    try {
      let uploadedUrl = '';
      if (selectedFile) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

        if (resolvedUploadService === 'cloudinary' && cloudName && uploadPreset) {
          const uploadData = new FormData();
          uploadData.append('file', selectedFile);
          uploadData.append('upload_preset', uploadPreset);

          const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
          const uploadRes = await fetch(cloudinaryUrl, {
            method: 'POST',
            body: uploadData
          });

          if (!uploadRes.ok) {
            const errBody = await uploadRes.json();
            throw new Error(errBody.error?.message || 'Failed to upload photo to Cloudinary');
          }

          const uploadResponse = await uploadRes.json();
          uploadedUrl = uploadResponse.secure_url;
        }
      }

      const payload = new FormData();
      payload.append('action', 'submit_pending');
      payload.append('firstName', formData.firstName.trim());
      payload.append('surName', formData.surName.trim());
      payload.append('gender', formData.gender);
      payload.append('birthDate', formData.birthDate);
      payload.append('birthPlace', formData.birthPlace.trim());
      payload.append('gotra', formData.gotra.trim());
      payload.append('nakshatra', formData.nakshatra);
      payload.append('rashi', formData.rashi);
      payload.append('phone', formData.phone.trim());
      payload.append('email', formData.email.trim());
      payload.append('fatherNameText', formData.fatherNameText.trim());
      payload.append('motherNameText', formData.motherNameText.trim());
      payload.append('spouseNameText', formData.spouseNameText.trim());
      payload.append('submissionNote', formData.submissionNote.trim());
      payload.append('isUpdateOfPid', submissionMode === 'update' ? selectedPidToUpdate : '');

      if (uploadedUrl) {
        payload.append('photoUrl', uploadedUrl);
      } else if (selectedFile) {
        payload.append('file', selectedFile);
      }

      await submitPendingProfile(payload, password);
      setSubmitted(true);
      setStatus(null);
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Failed to submit profile. Please verify your family password.' });
      if (err.message.includes('password') || err.message.includes('401')) {
        sessionStorage.removeItem('vamsha_family_pwd');
        setPassword('');
        setPasswordError('Invalid family password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- PASSWORD SCREEN ---
  if (!password) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={styles.iconCircle}>
              <Lock size={28} color="var(--color-maroon, #63131D)" />
            </div>
            <h2 style={styles.title}>Family Submission Gate</h2>
            <p style={styles.subtitle}>Enter the family password to access the submission form.</p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Family Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ ...styles.input, paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#888',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && <p style={styles.errorText}>{passwordError}</p>}
            </div>
            <button type="submit" style={styles.submitBtn}>
              Verify Password
            </button>
          </form>

          <button onClick={() => navigate('/')} style={styles.backLink}>
            <ArrowLeft size={16} /> Back to Family Tree
          </button>
        </div>
      </div>
    );
  }

  // --- SUCCESS SCREEN ---
  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <CheckCircle size={64} color="#2e7d32" style={{ marginBottom: '1rem' }} />
            <h2 style={styles.title}>Submission Successful!</h2>
            <p style={styles.subtitle}>
              Thank you for sharing your details. Your profile has been sent to the administrator queue. Once verified, it will be added to the family tree.
            </p>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setSubmissionMode('create');
                  setSelectedPidToUpdate('');
                  setFormData({
                    firstName: '',
                    surName: '',
                    gender: 'Male',
                    birthDate: '',
                    birthPlace: '',
                    gotra: '',
                    nakshatra: '',
                    rashi: '',
                    phone: '',
                    email: '',
                    fatherNameText: '',
                    motherNameText: '',
                    spouseNameText: '',
                    submissionNote: '',
                  });
                  setSelectedFile(null);
                  setPreviewUrl('');
                }}
                style={{
                  ...styles.submitBtn,
                  backgroundColor: 'white',
                  color: 'var(--color-maroon, #63131D)',
                  border: '1px solid var(--color-sandalwood, #EADDCA)',
                  width: 'auto',
                  padding: '0.6rem 1.5rem',
                }}
              >
                Submit Another Profile
              </button>
              <button
                onClick={() => navigate('/')}
                style={{
                  ...styles.submitBtn,
                  width: 'auto',
                  padding: '0.6rem 1.5rem',
                }}
              >
                Return to Tree
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- REGULAR FORM SCREEN ---
  return (
    <div style={{ ...styles.container, padding: '2rem 1rem' }}>
      <style>{`
        .submission-grid {
          display: flex;
          gap: 2rem;
          flex-direction: row;
          flex-wrap: wrap;
          margin-top: 1rem;
        }
        .submission-left-col {
          flex: 1.2;
          min-width: 290px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .submission-right-col {
          flex: 0.8;
          min-width: 290px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          border-left: 1.5px solid var(--color-sandalwood, #EADDCA);
          padding-left: 2rem;
          box-sizing: border-box;
        }
        .submission-card {
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .submission-grid {
            flex-direction: column;
            gap: 1.5rem;
          }
          .submission-left-col {
            min-width: 100%;
          }
          .submission-right-col {
            min-width: 100%;
            border-left: none;
            border-top: 1.5px dashed var(--color-sandalwood, #EADDCA);
            padding-left: 0;
            padding-top: 1.5rem;
          }
          .form-row-mobile {
            flex-direction: column;
            gap: 1rem !important;
          }
          .form-row-mobile > div {
            width: 100% !important;
            flex: none !important;
          }
          .submission-card {
            padding: 1.25rem 1rem !important;
          }
        }
      `}</style>
      <div className="submission-card" style={{ ...styles.card, maxWidth: '850px', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-sandalwood, #EADDCA)', paddingBottom: '1rem' }}>
          <div>
            <h2 style={{ ...styles.title, textAlign: 'left', margin: 0 }}>Add Your Profile</h2>
            <p style={{ ...styles.subtitle, textAlign: 'left', margin: '0.2rem 0 0 0' }}>Submit your details and photo to join the family tree</p>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'none',
              border: 'none',
              color: 'var(--color-maroon, #63131D)',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        {status && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: status.type === 'error' ? '#FDF2F2' : '#F0FDF4',
            border: `1px solid ${status.type === 'error' ? '#FDE8E8' : '#DCFCE7'}`,
            color: status.type === 'error' ? '#9B1C1C' : '#15803D',
            fontSize: '0.88rem',
            marginBottom: '1rem',
            fontWeight: '600'
          }}>
            {status.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-sandalwood, #EADDCA)', paddingBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => {
                setSubmissionMode('create');
                handleProfileSelectForUpdate('');
              }}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: '8px',
                border: submissionMode === 'create' ? '2px solid var(--color-maroon, #63131D)' : '1px solid var(--color-sandalwood, #EADDCA)',
                backgroundColor: submissionMode === 'create' ? '#FFF9F9' : 'white',
                color: 'var(--color-maroon, #63131D)',
                fontWeight: '800',
                cursor: 'pointer',
                fontSize: '0.85rem',
                outline: 'none',
                boxShadow: submissionMode === 'create' ? '0 2px 8px rgba(99, 19, 29, 0.05)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              🆕 Create New Profile
            </button>
            <button
              type="button"
              onClick={() => setSubmissionMode('update')}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: '8px',
                border: submissionMode === 'update' ? '2px solid var(--color-maroon, #63131D)' : '1px solid var(--color-sandalwood, #EADDCA)',
                backgroundColor: submissionMode === 'update' ? '#FFF9F9' : 'white',
                color: 'var(--color-maroon, #63131D)',
                fontWeight: '800',
                cursor: 'pointer',
                fontSize: '0.85rem',
                outline: 'none',
                boxShadow: submissionMode === 'update' ? '0 2px 8px rgba(99, 19, 29, 0.05)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              ✏️ Modify Existing Profile
            </button>
          </div>

          {submissionMode === 'update' && (
            <div style={{ ...styles.formGroup, marginBottom: '1.25rem', backgroundColor: '#FAF9F6', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--color-sandalwood, #EADDCA)', boxSizing: 'border-box' }}>
              <label style={styles.label}>Select Member to Modify</label>
              <SearchableSelect
                value={selectedPidToUpdate}
                onChange={(e) => handleProfileSelectForUpdate(e.target.value)}
                placeholder="-- Choose Member --"
                options={[
                  { value: '', label: '-- Choose Member --' },
                  ...profiles.map(p => ({
                    value: p.pid,
                    label: `${p.firstName} ${p.surName} (${p.pid})`
                  }))
                ]}
              />
              <p style={{ fontSize: '0.72rem', color: '#666', margin: '0.3rem 0 0 0' }}>
                Selecting a profile will pre-fill its current details. You can modify them and resubmit.
              </p>
            </div>
          )}

          <div className="submission-grid">

            {/* --- LEFT HAND SECTION (DETAILS Form) --- */}
            <div className="submission-left-col">

              <h4 style={styles.sectionHeader}>👤 Personal Details</h4>

              <div className="form-row-mobile" style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>First Name <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="e.g. Krishna"
                  />
                </div>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Surname</label>
                  <input
                    type="text"
                    name="surName"
                    value={formData.surName}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="e.g. Dharmavaram"
                  />
                </div>
              </div>

              <div className="form-row-mobile" style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Gender <span style={{ color: 'red' }}>*</span></label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    style={styles.select}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Gotra</label>
                  <input
                    type="text"
                    name="gotra"
                    list="gotram-list"
                    value={formData.gotra}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="Select or type Gotram"
                  />
                  <datalist id="gotram-list">
                    {COMMON_GOTRAMS.map(g => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="form-row-mobile" style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Birth Date</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      name="birthDate"
                      value={formData.birthDate}
                      onChange={handleInputChange}
                      style={{ ...styles.input, paddingLeft: '2.2rem' }}
                    />
                    <Calendar size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  </div>
                </div>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Birth Place</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      name="birthPlace"
                      value={formData.birthPlace}
                      onChange={handleInputChange}
                      style={{ ...styles.input, paddingLeft: '2.2rem' }}
                      placeholder="e.g. Bangalore"
                    />
                    <MapPin size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  </div>
                </div>
              </div>

              <div className="form-row-mobile" style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Birth Star (Nakshatra)</label>
                  <select
                    name="nakshatra"
                    value={formData.nakshatra}
                    onChange={handleInputChange}
                    style={styles.select}
                  >
                    <option value="">-- Choose Nakshatra --</option>
                    {NAKSHATRAS.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Rashi</label>
                  <select
                    name="rashi"
                    value={formData.rashi}
                    onChange={handleInputChange}
                    style={styles.select}
                  >
                    <option value="">-- Choose Rashi --</option>
                    {RASHIS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <h4 style={{ ...styles.sectionHeader, marginTop: '0.5rem' }}>👪 Relationships</h4>
              <p style={{ fontSize: '0.75rem', color: '#777', margin: '-0.3rem 0 0.5rem 0' }}>Write father/mother names so the admin can link them to the tree.</p>

              <div style={styles.formGroup}>
                <label style={styles.label}>Father's Full Name</label>
                <input
                  type="text"
                  name="fatherNameText"
                  value={formData.fatherNameText}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="e.g. Rama Rao"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Mother's Full Name</label>
                <input
                  type="text"
                  name="motherNameText"
                  value={formData.motherNameText}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="e.g. Saroja Bai"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Spouse's Name (if married)</label>
                <input
                  type="text"
                  name="spouseNameText"
                  value={formData.spouseNameText}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="e.g. Lakshmi Bai"
                />
              </div>

            </div>

            {/* --- RIGHT HAND SECTION (PHOTO & CONTACT) --- */}
            <div className="submission-right-col">

              <h4 style={styles.sectionHeader}>📸 Profile Photo</h4>

              {/* Photo preview / upload dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  ...styles.dropzone,
                  height: previewUrl ? '220px' : '150px'
                }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" style={styles.previewImage} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <span style={{ fontSize: '2rem' }}>📷</span>
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--color-maroon, #63131D)' }}>
                      Click to upload photo
                    </p>
                    <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.68rem', color: '#777' }}>
                      JPG, JPEG, PNG (Max 2MB)
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>

              {previewUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#c62828',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    alignSelf: 'center',
                    padding: 0
                  }}
                >
                  Remove Photo
                </button>
              )}

              <h4 style={{ ...styles.sectionHeader, marginTop: '1rem' }}>📞 Contact Details</h4>

              <div style={styles.formGroup}>
                <label style={styles.label}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    style={{ ...styles.input, paddingLeft: '2.2rem' }}
                    placeholder="e.g. +91 98765 43210"
                  />
                  <Phone size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    style={{ ...styles.input, paddingLeft: '2.2rem' }}
                    placeholder="e.g. you@mail.com"
                  />
                  <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Note / Message to Admin (Optional) <span style={{ fontWeight: 'normal', color: '#888', fontSize: '0.8rem' }}>(మాకు ఏమైనా చెప్పాలనుకుంటే ఇక్కడ రాయండి)</span></label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    name="submissionNote"
                    value={formData.submissionNote}
                    onChange={handleInputChange}
                    style={{ 
                      ...styles.input, 
                      height: '80px', 
                      resize: 'vertical', 
                      padding: '0.6rem 0.75rem', 
                      fontFamily: 'inherit',
                      fontSize: '0.9rem',
                      lineHeight: '1.4'
                    }}
                    placeholder="e.g. Corrections, updates, or anything else you'd like to share..."
                  />
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...styles.submitBtn,
                    backgroundColor: loading ? '#ccc' : 'var(--color-maroon, #63131D)',
                  }}
                >
                  {loading ? 'Submitting Details...' : 'Submit Profile Details'}
                </button>
              </div>

            </div>

          </div>
        </form>

      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '80vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(99, 19, 29, 0.08)',
    border: '1px solid var(--color-sandalwood, #EADDCA)',
    maxWidth: '450px',
    width: '90%',
    boxSizing: 'border-box'
  },
  iconCircle: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: '#FAF4EE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem auto',
    border: '1px dashed var(--color-maroon, #63131D)'
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: '800',
    color: 'var(--color-maroon, #63131D)',
    margin: '0 0 0.4rem 0',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#666',
    margin: 0,
    textAlign: 'center',
    lineHeight: '1.4'
  },
  sectionHeader: {
    fontSize: '0.88rem',
    fontWeight: '800',
    color: 'var(--color-maroon, #63131D)',
    margin: '0 0 0.4rem 0',
    borderBottom: '1px dashed var(--color-sandalwood, #EADDCA)',
    paddingBottom: '0.2rem'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    width: '100%',
    boxSizing: 'border-box'
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: 'var(--color-dark, #2C1818)'
  },
  input: {
    width: '100%',
    padding: '0.55rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid var(--color-sandalwood, #EADDCA)',
    fontSize: '0.88rem',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    padding: '0.55rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid var(--color-sandalwood, #EADDCA)',
    fontSize: '0.88rem',
    boxSizing: 'border-box',
    outline: 'none',
    backgroundColor: 'white'
  },
  submitBtn: {
    width: '100%',
    padding: '0.7rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--color-maroon, #63131D)',
    color: 'var(--color-gold, #D4AF37)',
    fontWeight: '800',
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(99, 19, 29, 0.15)',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.3rem',
    margin: '1.25rem auto 0 auto',
  },
  errorText: {
    fontSize: '0.72rem',
    color: '#c62828',
    fontWeight: '600',
    margin: '0.1rem 0 0 0'
  },
  grid: {
    display: 'flex',
    gap: '1.5rem',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: '1rem'
  },
  dropzone: {
    width: '100%',
    border: '2px dashed var(--color-sandalwood, #EADDCA)',
    borderRadius: '12px',
    backgroundColor: '#FAF8F5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    overflow: 'hidden',
    position: 'relative',
    transition: 'border-color 0.2s',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    position: 'absolute',
    top: 0,
    left: 0
  }
};

export default MemberSubmission;
