import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Sliders, Shield, Camera, Moon, Calendar, Phone, Mail, UserPlus,
  GitFork, GitBranch, Heart, FileText, ChevronDown, ChevronUp, Download,
  Eye, EyeOff, Copy, Check
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const UserSettings = ({ profiles, deferredPrompt, setDeferredPrompt, activeBranchId, onLogoutBranch }) => {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('general');
  const [expandedSection, setExpandedSection] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const installCardRef = useRef(null);

  const [bdayGenLimit, setBdayGenLimit] = useState(() => {
    return parseInt(localStorage.getItem('vamsha_birthday_gen_limit') || '6', 10);
  });

  useEffect(() => {
    if (location.state?.scrollToInstall) {
      setActiveTab('general');
      const timer = setTimeout(() => {
        if (installCardRef.current) {
          installCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const handleBdayGenLimitChange = (e) => {
    const limit = parseInt(e.target.value, 10);
    setBdayGenLimit(limit);
    localStorage.setItem('vamsha_birthday_gen_limit', limit);
  };

  const handleInstallClick = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted PWA installation');
      }
      setDeferredPrompt(null);
    });
  };

  // Data Consistency checker logic
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

  const handleEditFromList = (p) => {
    // Redirect to admin page with edit profile state
    navigate('/admin', { state: { editProfile: p } });
  };

  return (
    <div className="card" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '1rem' }}>
        <Sliders size={28} style={{ color: 'var(--color-maroon)' }} />
        <h3 style={{ color: 'var(--color-maroon)', fontSize: '1.6rem', margin: 0 }}>{t('settings.title')}</h3>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #EFE4DC', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button 
          className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
          style={{
            padding: '0.6rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: '600',
            fontSize: '0.95rem',
            color: activeTab === 'general' ? 'var(--color-maroon)' : '#777',
            borderBottom: activeTab === 'general' ? '3px solid var(--color-maroon)' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease'
          }}
        >
          <Sliders size={18} /> {t('settings.tab_general')}
        </button>
        <button 
          className={`settings-tab-btn ${activeTab === 'check' ? 'active' : ''}`}
          onClick={() => setActiveTab('check')}
          style={{
            padding: '0.6rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: '600',
            fontSize: '0.95rem',
            color: activeTab === 'check' ? 'var(--color-maroon)' : '#777',
            borderBottom: activeTab === 'check' ? '3px solid var(--color-maroon)' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease'
          }}
        >
          <Shield size={18} /> {t('settings.tab_datacheck')}
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'general' && (
          <div>
            {/* Active Family Branch Details Card */}
            {(activeBranchId || (window.VAMSHA_CONFIG?.familyBranches && Object.keys(window.VAMSHA_CONFIG.familyBranches).length > 0)) && (
              <div style={{
                backgroundColor: '#FAF8F5',
                border: '1px solid #EFE4DC',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                marginBottom: '2rem'
              }}>
                <h4 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🌳 {language === 'te' ? 'కుటుంబ శాఖ వివరాలు' : (language === 'kn' ? 'ಕುಟುಂಬ ಶಾಖೆಯ ವಿವರಗಳು' : 'Family Branch Details')}
                </h4>
                <p style={{ margin: '0 0 1.25rem', color: '#666', fontSize: '0.88rem', lineHeight: 1.45 }}>
                  {activeBranchId && window.VAMSHA_CONFIG?.familyBranches?.[activeBranchId] ? (
                    <>
                      {language === 'te' ? 'ప్రస్తుతం మీరు చూస్తున్నది' : (language === 'kn' ? 'ನೀವು ಪ್ರಸ್ತುತ ವೀಕ್ಷಿಸುತ್ತಿರುವುದು' : 'You are currently viewing')}: <strong>{window.VAMSHA_CONFIG.familyBranches[activeBranchId].name || activeBranchId}</strong>.
                    </>
                  ) : (
                    <>
                      {language === 'te' ? 'ప్రస్తుతం మీరు చూస్తున్నది' : (language === 'kn' ? 'ನೀವು ಪ್ರಸ್ತುತ ವೀಕ್ಷಿಸುತ್ತಿರುವುದು' : 'You are currently viewing')}: <strong>{language === 'te' ? 'మాస్టర్ ఫ్యామిలీ వ్యూ (అన్ని శాఖలు)' : (language === 'kn' ? 'ಮಾಸ್ಟರ್ ಫ್ಯಾಮಿಲಿ ವ್ಯೂ (ಎಲ್ಲಾ ಶಾಖೆಗಳು)' : 'Master Family View (All Branches)')}</strong>.
                    </>
                  )}
                </p>
                <div>
                  <button
                    onClick={onLogoutBranch}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.65rem 1.25rem',
                      fontSize: '0.92rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    {language === 'te' ? '🔒 లాక్ చేయి / వేరే కుటుంబానికి మారు' : (language === 'kn' ? '🔒 ಲಾಕ್ ಮಾಡಿ / ಬೇರೆ ಕುಟುಂಬಕ್ಕೆ ಬದಲಾಯಿಸಿ' : '🔒 Lock Tree / Switch Family')}
                  </button>
                </div>
              </div>
            )}

            {/* Language Selection Card */}
            <div style={{
              backgroundColor: '#FAF8F5',
              border: '1px solid #EFE4DC',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              marginBottom: '2rem'
            }}>
              <h4 style={{ margin: '0 0 1.25rem', color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🌐 {t('settings.lang_label')}
              </h4>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', maxWidth: '500px' }}>
                {[
                  { code: 'te', name: t('settings.lang_te') },
                  { code: 'kn', name: t('settings.lang_kn') },
                  { code: 'en', name: t('settings.lang_en') }
                ].map(opt => (
                  <button
                    key={opt.code}
                    onClick={() => setLanguage(opt.code)}
                    style={{
                      padding: '0.75rem 1.25rem',
                      borderRadius: '10px',
                      border: language === opt.code ? '2.5px solid var(--color-maroon)' : '1.5px solid #EFE4DC',
                      backgroundColor: language === opt.code ? '#ffffff' : '#FAF9F6',
                      color: language === opt.code ? 'var(--color-maroon)' : '#666',
                      fontWeight: '700',
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      flex: '1 1 120px',
                      textAlign: 'center',
                      boxShadow: language === opt.code ? '0 4px 10px rgba(99, 19, 29, 0.1)' : 'none'
                    }}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Join Family Tree Card */}
            <div style={{
              backgroundColor: '#FAF8F5',
              border: '1px solid #EFE4DC',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              marginBottom: '2rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📝 Join Family Tree
              </h4>
              <p style={{ margin: '0 0 1.25rem', color: '#666', fontSize: '0.88rem', lineHeight: 1.45 }}>
                Are you a family member? Submit your profile details, birth date, relationships, and photo to be added to the family tree database.
              </p>
              <div>
                <button
                  onClick={() => navigate('/submit-details')}
                  className="btn btn-primary"
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <UserPlus size={18} /> Submit Profile Details
                </button>
              </div>
            </div>

            {/* Birthday Generation Limit Card */}
            <div style={{
              backgroundColor: '#FAF8F5',
              border: '1px solid #EFE4DC',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              marginBottom: '2rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem', color: 'var(--color-maroon, #63131D)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎂 {t('settings.birthday_gen_limit')}
              </h4>
              <p style={{ margin: '0 0 1.25rem', color: '#666', fontSize: '0.88rem', lineHeight: 1.45 }}>
                {t('settings.birthday_gen_desc')}
              </p>
              <div style={{ maxWidth: '300px' }}>
                <select
                  value={bdayGenLimit}
                  onChange={handleBdayGenLimitChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1.5px solid #EFE4DC',
                    backgroundColor: '#ffffff',
                    color: '#333',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(num => (
                    <option key={num} value={num}>
                      {t('settings.birthday_gen_option', { num })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Install PWA Component */}
            <div ref={installCardRef} className="install-card" style={{
              backgroundColor: '#FAF8F5',
              border: '1px solid #EFE4DC',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <img 
                  src={`${import.meta.env.BASE_URL}icons/icon-maskable-512.png`} 
                  alt="Vamsha Logo" 
                  style={{ width: '72px', height: '72px', borderRadius: '18px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                />
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, color: 'var(--color-maroon, #63131D)', fontSize: '1.25rem', fontWeight: 700 }}>
                    {t('settings.install_app')}
                  </h3>
                  <p style={{ margin: '6px 0 0', color: '#666', fontSize: '0.9rem', lineHeight: 1.4, maxWidth: '400px' }}>
                    {t('settings.install_desc')}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button 
                  className="btn btn-primary" 
                  disabled={!deferredPrompt} 
                  onClick={handleInstallClick}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    boxShadow: deferredPrompt ? '0 4px 12px rgba(99, 19, 29, 0.2)' : 'none'
                  }}
                >
                  <Download size={18} /> {t('settings.install_btn')}
                </button>
              </div>
              {!deferredPrompt && (
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#888' }}>
                  ℹ️ {t('settings.install_disabled_info')}
                </div>
              )}
            </div>

            {/* iOS Instructions */}
            <div style={{
              border: '1px solid #EFE4DC',
              borderRadius: '12px',
              padding: '1.5rem',
              backgroundColor: 'white',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ margin: '0 0 10px', color: 'var(--color-maroon)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🍎 {t('settings.ios_title')}
              </h4>
              <p style={{ fontSize: '0.9rem', color: '#555', lineHeight: 1.5, marginBottom: '10px' }}>
                {t('settings.ios_desc')}
              </p>
              <div style={{ fontSize: '0.9rem', color: '#444', lineHeight: 1.6, backgroundColor: '#FAF9F6', padding: '12px 18px', borderRadius: '8px', border: '1px solid #EEE' }}>
                <ol style={{ paddingLeft: '20px', margin: 0 }}>
                  <li style={{ marginBottom: '6px' }}>{t('settings.ios_step1')}</li>
                  <li style={{ marginBottom: '6px' }}>{t('settings.ios_step2')}</li>
                  <li style={{ marginBottom: '6px' }}>{t('settings.ios_step3')}</li>
                  <li>{t('settings.ios_step4')}</li>
                </ol>
              </div>
            </div>

            {/* Safety Information */}
            <div style={{
              border: '1px solid #c8e6c9',
              borderRadius: '12px',
              padding: '1.5rem',
              backgroundColor: '#e8f5e9',
              marginBottom: '2rem'
            }}>
              <h4 style={{ margin: '0 0 10px', color: '#2e7d32', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🛡️ {t('settings.safety_title')}
              </h4>
              <p style={{ fontSize: '0.9rem', color: '#333', lineHeight: 1.5, marginBottom: '15px' }}>
                {t('settings.safety_desc')}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem', color: '#444', lineHeight: 1.8 }}>
                <li style={{ marginBottom: '6px', display: 'flex', gap: '10px' }}><span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✔</span> {t('settings.safety_bullet1')}</li>
                <li style={{ marginBottom: '6px', display: 'flex', gap: '10px' }}><span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✔</span> {t('settings.safety_bullet2')}</li>
                <li style={{ marginBottom: '6px', display: 'flex', gap: '10px' }}><span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✔</span> {t('settings.safety_bullet3')}</li>
                <li style={{ marginBottom: '6px', display: 'flex', gap: '10px' }}><span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✔</span> {t('settings.safety_bullet4')}</li>
              </ul>
              <p style={{ marginTop: '12px', fontWeight: '600', color: '#2e7d32', fontSize: '0.9rem', marginBottom: 0 }}>
                {t('settings.safety_footer')}
              </p>
            </div>

            {/* Secret entrance to Admin Panel */}
            <div style={{ marginTop: '4rem', textAlign: 'center', opacity: 0.6 }}>
              <span 
                onClick={() => navigate('/admin')} 
                style={{ 
                  cursor: 'pointer', 
                  fontSize: '1.25rem', 
                  userSelect: 'none',
                  transition: 'opacity 0.2s',
                  padding: '10px'
                }}
                title="Admin"
              >
                🙏
              </span>
            </div>
          </div>
        )}

        {/* TAB 2: Data Check */}
        {activeTab === 'check' && (
          <div>
            <div style={{ borderBottom: '1px solid #EFE4DC', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: 0, color: '#555', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Inspect empty credentials, photo allocations, contact info, and parental tree connections. Admin login is required to edit.
              </p>
            </div>

            {/* Accordion List */}
            <div>
              {checkSections.map(sect => {
                const Icon = sect.icon;
                const isExpanded = expandedSection === sect.key;
                
                return (
                  <div key={sect.key} className="check-card" style={{ borderLeft: `4px solid ${sect.color}`, marginBottom: '0.75rem' }}>
                    <div 
                      className="check-card-header"
                      onClick={() => setExpandedSection(isExpanded ? null : sect.key)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem 1.25rem',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
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
                            <table className="check-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '100px', backgroundColor: '#F8F6F2', color: '#63131D', textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 700, borderBottom: '1px solid #EFE4DC' }}>PID</th>
                                  <th style={{ backgroundColor: '#F8F6F2', color: '#63131D', textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 700, borderBottom: '1px solid #EFE4DC' }}>Full Name</th>
                                  <th style={{ backgroundColor: '#F8F6F2', color: '#63131D', textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 700, borderBottom: '1px solid #EFE4DC' }}>Gender</th>
                                  <th style={{ backgroundColor: '#F8F6F2', color: '#63131D', textAlign: 'left', padding: '0.6rem 1rem', fontWeight: 700, borderBottom: '1px solid #EFE4DC' }}>Status</th>
                                  <th style={{ width: '100px', textAlign: 'center', backgroundColor: '#F8F6F2', color: '#63131D', padding: '0.6rem 1rem', fontWeight: 700, borderBottom: '1px solid #EFE4DC' }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sect.data.map(p => (
                                  <tr key={p.pid}>
                                    <td style={{ fontWeight: 700, color: '#777', padding: '0.75rem 1rem', borderBottom: '1px solid #EEE' }}>{p.pid}</td>
                                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #EEE' }}>
                                      <strong>{p.firstName} {p.surName}</strong>
                                      {p.dob && <span style={{ color: '#888', fontSize: '0.78rem', marginLeft: '0.5rem' }}>({p.dob})</span>}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #EEE' }}>{p.gender}</td>
                                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #EEE' }}>
                                      <span style={{ 
                                        color: p.isDeceased ? '#C0392B' : '#27AE60',
                                        fontSize: '0.8rem',
                                        fontWeight: 600
                                      }}>
                                        {p.isDeceased ? 'Deceased' : 'Alive'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #EEE' }}>
                                      <button 
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleEditFromList(p)}
                                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
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
      </div>

      {/* Settings Footer / Version Info */}
      <div style={{
        marginTop: '2.5rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid #EFE4DC',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.8rem',
        color: '#999'
      }}>
        <span>Vamsha Family Tree App</span>
        <span>
          Version: <strong>{import.meta.env.VITE_APP_VERSION || '1.3.0'}</strong>
        </span>
      </div>

    </div>
  );
};

export default UserSettings;
