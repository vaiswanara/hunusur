import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import TreeDisplay from './pages/TreeDisplay';
import AdminPage from './pages/AdminPage';
import Birthdays from './pages/Birthdays';
import HomePage from './pages/Home';
import HomePerson from './pages/HomePerson';
import Reports from './pages/Reports';
import UserSettings from './pages/UserSettings';
import Memories from './pages/Memories';
import Timeline from './pages/Timeline';
import MenuPage from './pages/MenuPage';
import Dashboard from './pages/Dashboard';
import AdminGate from './components/AdminGate';
import { fetchProfiles } from './lib/api';
import initialData from './data.json';
import { Home as HomeIcon, Settings, GitBranch, Cake, User, RefreshCw, BarChart2, BookOpen, Calendar, Menu as MenuIcon } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import DecryptionGate from './components/DecryptionGate';
import CloudinaryUpload from './components/CloudinaryUpload';
import MemberSubmission from './pages/MemberSubmission';
import { decryptData } from './lib/crypto';

function Navigation({ profiles, setFocusedPid, setSidebarPerson }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const title = t('home.title');

  const handleTreeClick = (e) => {
    e.preventDefault();
    const savedHomePid = localStorage.getItem('vamsha_home_pid');
    const targetPid = (savedHomePid && profiles.some(p => p.pid === savedHomePid))
      ? savedHomePid
      : (profiles.length > 0 ? profiles[0].pid : null);
    if (targetPid) {
      setFocusedPid(targetPid);
    }
    setSidebarPerson(null);
    if (location.pathname !== '/tree') {
      navigate('/tree');
    }
  };

  // Hide top header on mobile screens for all pages
  const headerClass = 'app-header app-header-hidden-mobile';

  const logoUrl = `${import.meta.env.BASE_URL}icons/icon-192.png`;

  return (
    <header className={headerClass}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
        <img 
          src={logoUrl} 
          alt="Vamsha Logo" 
          style={{ width: '28px', height: '28px', objectFit: 'contain' }} 
        />
        <h1 style={{ margin: 0, lineHeight: 1 }}>{title}</h1>
      </div>
      <nav className="nav-links">
        <Link to="/" className={location.pathname === '/' || location.pathname === import.meta.env.BASE_URL ? 'active' : ''}>{t('nav.home')}</Link>
        <Link to="/home-person" className={location.pathname.includes('/home-person') ? 'active' : ''}>{t('nav.home_person')}</Link>
        <a href="/tree" onClick={handleTreeClick} className={location.pathname === '/tree' && !location.pathname.includes('/admin') && !location.pathname.includes('/birthdays') && !location.pathname.includes('/reports') && !location.pathname.includes('/dashboard') && !location.pathname.includes('/home-person') ? 'active' : ''}>{t('nav.tree')}</a>
        <Link to="/birthdays" className={location.pathname.includes('/birthdays') ? 'active' : ''}>{t('nav.birthdays')}</Link>
        <Link to="/dashboard" className={location.pathname.includes('/dashboard') ? 'active' : ''}>{t('nav.dashboard')}</Link>
        <Link to="/reports" className={location.pathname.includes('/reports') ? 'active' : ''}>{t('nav.reports')}</Link>
        <Link to="/memories" className={location.pathname.includes('/memories') ? 'active' : ''}>{t('nav.memories')}</Link>
        <Link to="/timeline" className={location.pathname.includes('/timeline') ? 'active' : ''}>{t('nav.timeline')}</Link>
        <Link to="/settings" className={location.pathname.includes('/settings') ? 'active' : ''}>{t('nav.settings')}</Link>
      </nav>
    </header>
  );
}

function MobileBottomNav({ profiles, focusedPid, setFocusedPid, sidebarPerson, setSidebarPerson }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const handleMenuClick = () => {
    setSidebarPerson(null);
    if (location.pathname !== '/menu') {
      navigate('/menu');
    }
  };

  const handleRootTreeClick = () => {
    const savedHomePid = localStorage.getItem('vamsha_home_pid');
    const targetPid = (savedHomePid && profiles.some(p => p.pid === savedHomePid)) 
      ? savedHomePid 
      : (profiles.length > 0 ? profiles[0].pid : null);
    
    if (targetPid) {
      setFocusedPid(targetPid);
    }
    setSidebarPerson(null);
    if (location.pathname !== '/tree') {
      navigate('/tree');
    }
  };

  const handleDashboardClick = () => {
    setSidebarPerson(null);
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
    }
  };

  const handleSettingsClick = () => {
    setSidebarPerson(null);
    if (location.pathname !== '/settings') {
      navigate('/settings');
    }
  };

  return (
    <div className="mobile-bottom-nav">
      <button className={`nav-item-btn ${location.pathname.includes('/menu') ? 'active' : ''}`} onClick={handleMenuClick}>
        <MenuIcon size={23} />
        <span>{t('nav.menu')}</span>
      </button>
      <button className={`nav-item-btn ${location.pathname === '/tree' ? 'active' : ''}`} onClick={handleRootTreeClick}>
        <GitBranch size={23} />
        <span>{t('nav.tree')}</span>
      </button>
      <button className={`nav-item-btn ${location.pathname.includes('/dashboard') ? 'active' : ''}`} onClick={handleDashboardClick}>
        <BarChart2 size={23} />
        <span>{t('nav.dashboard')}</span>
      </button>
      <button className={`nav-item-btn ${location.pathname.includes('/settings') ? 'active' : ''}`} onClick={handleSettingsClick}>
        <Settings size={23} />
        <span>{t('nav.settings')}</span>
      </button>
    </div>
  );
}


function SplashScreen() {
  const logoUrl = `${import.meta.env.BASE_URL}icons/icon-maskable-512.png`;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <style>{`
        @keyframes pulseLogo {
          0% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.95; }
        }
        @keyframes rotateRing {
          to { transform: rotate(360deg); }
        }
        @keyframes textSlide {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      {/* Logo Image */}
      <img 
        src={logoUrl} 
        alt="Vamsha Logo" 
        style={{
          width: '196px',
          height: '196px',
          objectFit: 'contain',
          marginBottom: '2rem',
          animation: 'pulseLogo 2.5s infinite ease-in-out'
        }} 
      />

      {/* App Titles */}
      <h1 style={{
        color: '#63131D',
        fontSize: '1.8rem',
        fontWeight: 700,
        margin: '0 0 2rem',
        letterSpacing: '0.5em',
        textIndent: '0.5em',
        textTransform: 'uppercase',
        animation: 'textSlide 1s ease-out'
      }}>
        VAMSHA
      </h1>

      {/* Loading spinner */}
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        border: '3px solid rgba(99, 19, 29, 0.1)',
        borderTopColor: '#63131D',
        animation: 'rotateRing 1s linear infinite'
      }} />
    </div>
  );
}

// Helper to enrich female profiles with maiden names and married surnames, and resolve Gotram inheritance dynamically
function enrichProfiles(rawProfiles) {
  // Memoized lookup for birth gotram to handle multi-generational inheritance safely & efficiently
  const resolvedBirthGotramMap = {};

  // BFS search to find any explicitly defined gotram in the connected patrilineal component (upward to father, downward to children)
  const getBirthGotram = (startPid) => {
    if (!startPid) return '';
    if (resolvedBirthGotramMap[startPid] !== undefined) {
      return resolvedBirthGotramMap[startPid];
    }

    const queue = [startPid];
    const visited = new Set([startPid]);
    let foundGotram = '';

    while (queue.length > 0) {
      const currPid = queue.shift();
      const curr = rawProfiles.find(x => x.pid === currPid);
      if (!curr) continue;

      if (curr.gotram) {
        foundGotram = curr.gotram;
        break;
      }

      // 1. Traverse upward (father)
      if (curr.fatherId && !visited.has(curr.fatherId)) {
        visited.add(curr.fatherId);
        queue.push(curr.fatherId);
      }

      // 2. Traverse downward (children who share father's birth gotram)
      const children = rawProfiles.filter(c => c.fatherId === currPid);
      for (const child of children) {
        if (!visited.has(child.pid)) {
          visited.add(child.pid);
          queue.push(child.pid);
        }
      }
    }

    // Cache the resolved gotram for all members visited in this component
    visited.forEach(pid => {
      resolvedBirthGotramMap[pid] = foundGotram;
    });

    return foundGotram;
  };

  return rawProfiles.map(p => {
    const birthGotram = getBirthGotram(p.pid);

    if (p.gender === 'Female') {
      const husband = rawProfiles.find(h => p.spouseIds && p.spouseIds.includes(h.pid) && h.gender === 'Male');
      const father = p.fatherId ? rawProfiles.find(f => f.pid === p.fatherId) : null;
      
      let updatedSurName = p.surName;
      let updatedMaidenName = p.maidenName || '';
      let updatedGotram = birthGotram;
      let updatedMaidenGotram = '';

      if (husband) {
        // Married: surname becomes husband's surname
        updatedSurName = husband.surName;
        // Gotram becomes husband's birth gotram
        updatedGotram = getBirthGotram(husband.pid);
        // Maiden gotram becomes her own birth gotram (father's gotram)
        updatedMaidenGotram = birthGotram;
        
        // Maiden name is father's surname or her original surname
        if (father) {
          updatedMaidenName = father.surName;
        } else if (!p.maidenName && p.surName && p.surName !== husband.surName) {
          updatedMaidenName = p.surName;
        }
      } else if (father) {
        // Unmarried: surname becomes father's surname
        updatedSurName = father.surName;
      }

      return {
        ...p,
        surName: updatedSurName,
        maidenName: updatedMaidenName || undefined,
        gotram: updatedGotram || undefined,
        maidenGotram: updatedMaidenGotram || undefined
      };
    } else {
      // Male member: gotram inherits from father/son/descendant or is explicitly defined
      return {
        ...p,
        gotram: birthGotram || undefined
      };
    }
  });
}

function App() {
  const [rawResponse, setRawResponse] = useState(initialData);
  const [profiles, setProfiles] = useState([]);
  const [savedProfilesBaseline, setSavedProfilesBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [localDraftConflict, setLocalDraftConflict] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);


  const [loadError, setLoadError] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Check if remote data has updated
  const checkForUpdates = async () => {
    try {
      let latestData = await fetchProfiles();
      if (latestData && latestData.encrypted === true) {
        const savedPwd = localStorage.getItem('vamsha_decrypt_pwd') || '';
        if (savedPwd) {
          try {
            const decryptedText = await decryptData(latestData.data, savedPwd);
            latestData = JSON.parse(decryptedText);
          } catch (decErr) {
            console.warn('Failed to decrypt remote updates check data:', decErr);
          }
        }
      }
      // Compare with the original server data baseline to ignore local drafts
      const compareBaseline = savedProfilesBaseline || profiles;
      if (JSON.stringify(latestData) !== JSON.stringify(compareBaseline)) {
        setUpdateAvailable(true);
      } else {
        setUpdateAvailable(false);
      }
    } catch (e) {
      console.warn('Failed to check for updates:', e);
    }
  };

  // Visibility/tab focus change listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [profiles, savedProfilesBaseline]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      let data = await fetchProfiles();
      if (data && data.encrypted === true) {
        const savedPwd = localStorage.getItem('vamsha_decrypt_pwd') || '';
        if (savedPwd) {
          try {
            const decryptedText = await decryptData(data.data, savedPwd);
            data = JSON.parse(decryptedText);
          } catch (decErr) {
            throw new Error('Failed to decrypt synchronized profiles. Incorrect password stored.');
          }
        } else {
          throw new Error('Database is encrypted but no decryption password is saved.');
        }
      }
      setProfiles(data);
      setSavedProfilesBaseline(data);
      setUpdateAvailable(false);
      setLocalDraftConflict(null);
      localStorage.setItem('vamsha_local_profiles', JSON.stringify(data));
      setLoadError(null);
    } catch (err) {
      console.warn('Could not sync remote profiles:', err.message);
      setLoadError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const enrichedProfiles = useMemo(() => {
    return enrichProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const [focusedPid, setFocusedPid] = useState(() => {
    const savedHomePid = localStorage.getItem('vamsha_home_pid');
    const isArray = Array.isArray(initialData);
    if (isArray && savedHomePid && initialData.some(p => p.pid === savedHomePid)) {
      return savedHomePid;
    }
    return (isArray && initialData.length > 0) ? initialData[0].pid : null;
  });
  const [sidebarPerson, setSidebarPerson] = useState(null);

  // Set tab/document title dynamically
  useEffect(() => {
    document.title = `${import.meta.env.VITE_APP_TITLE || 'Vamsha'} - Family Tree`;
  }, []);

  // Load profiles from server (or fall back to local storage / bundled data)
  // Load raw profiles from server (or fall back to bundled data.json)
  useEffect(() => {
    fetchProfiles()
      .then((data) => {
        setRawResponse(data);
        setLoadError(null);
      })
      .catch((err) => {
        console.warn('Could not fetch remote profiles, using bundled data:', err.message);
        setRawResponse(initialData);
        setLoadError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDecryptedData = useCallback((decryptedData) => {
    // Check if we have local draft in localStorage
    const localDraftStr = localStorage.getItem('vamsha_local_profiles');
    let localDraft = null;
    if (localDraftStr) {
      try {
        localDraft = JSON.parse(localDraftStr);
      } catch (e) {
        console.warn('Failed to parse local profiles draft:', e);
      }
    }

    if (localDraft) {
      if (JSON.stringify(decryptedData) !== JSON.stringify(localDraft)) {
        // Mismatch between server data and local draft
        setLocalDraftConflict({ server: decryptedData, local: localDraft });
        setProfiles(localDraft);
        setSavedProfilesBaseline(decryptedData);
      } else {
        setProfiles(decryptedData);
        setSavedProfilesBaseline(decryptedData);
      }
    } else {
      setProfiles(decryptedData);
      setSavedProfilesBaseline(decryptedData);
    }
  }, []);

  const handleResolveConflict = (useLocal) => {
    if (!localDraftConflict) return;
    if (useLocal) {
      setProfiles(localDraftConflict.local);
      setSavedProfilesBaseline(localDraftConflict.server);
    } else {
      setProfiles(localDraftConflict.server);
      setSavedProfilesBaseline(localDraftConflict.server);
      try {
        localStorage.setItem('vamsha_local_profiles', JSON.stringify(localDraftConflict.server));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
    }
    setLocalDraftConflict(null);
  };

  // Sync focusedPid if profiles load
  useEffect(() => {
    if (profiles.length > 0) {
      if (!focusedPid || !profiles.some(p => p.pid === focusedPid)) {
        const savedHomePid = localStorage.getItem('vamsha_home_pid');
        if (savedHomePid && profiles.some(p => p.pid === savedHomePid)) {
          setFocusedPid(savedHomePid);
        } else {
          setFocusedPid(profiles[0].pid);
        }
      }
    }
  }, [profiles]);

  // Clear local draft conflict banner when profiles match the saved baseline
  useEffect(() => {
    if (localDraftConflict && savedProfilesBaseline && profiles && JSON.stringify(profiles) === JSON.stringify(savedProfilesBaseline)) {
      setLocalDraftConflict(null);
    }
  }, [profiles, savedProfilesBaseline, localDraftConflict]);

  const hasUnsavedChanges = useMemo(() => {
    if (!savedProfilesBaseline) return false;
    return JSON.stringify(profiles) !== JSON.stringify(savedProfilesBaseline);
  }, [profiles, savedProfilesBaseline]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const updateProfiles = (newProfiles) => {
    setProfiles(newProfiles);
    try {
      localStorage.setItem('vamsha_local_profiles', JSON.stringify(newProfiles));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  };

  if (showSplash || loading) {
    return <SplashScreen />;
  }

  return (
    <DecryptionGate rawData={rawResponse} onDecrypt={handleDecryptedData}>
      <Router basename={import.meta.env.BASE_URL}>
      <style>{`
        @keyframes pulseSync {
          0% { transform: scale(1); box-shadow: 0 4px 12px rgba(99, 19, 29, 0.2); }
          50% { transform: scale(1.04); box-shadow: 0 6px 20px rgba(99, 19, 29, 0.45); }
          100% { transform: scale(1); box-shadow: 0 4px 12px rgba(99, 19, 29, 0.2); }
        }
        @keyframes spinSync {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sync-btn-container {
          position: fixed;
          top: 90px;
          right: 20px;
          z-index: 1000;
        }
        .sync-banner-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, var(--color-maroon, #63131D) 0%, #8c202d 100%);
          color: var(--color-gold, #D3BCA2);
          padding: 10px 16px;
          border-radius: 50px;
          border: 1.5px solid var(--color-gold, #D3BCA2);
          cursor: pointer;
          font-size: 0.88rem;
          font-weight: 700;
          animation: pulseSync 2s infinite ease-in-out;
          transition: all 0.2s ease;
        }
        .sync-banner-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.15);
        }
        .sync-banner-btn:active {
          transform: translateY(0);
        }
        .spinning-icon {
          animation: spinSync 1.5s linear infinite;
        }
        @media (max-width: 768px) {
          .sync-btn-container {
            top: auto;
            bottom: 80px;
            right: 20px;
          }
        }
      `}</style>

      {updateAvailable && (
        <div className="sync-btn-container">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="sync-banner-btn"
          >
            <RefreshCw size={16} className={syncing ? 'spinning-icon' : ''} />
            {syncing ? 'Syncing...' : 'Sync Family Tree'}
          </button>
        </div>
      )}

      <Navigation 
        profiles={enrichedProfiles}
        setFocusedPid={setFocusedPid}
        setSidebarPerson={setSidebarPerson}
      />
      {localDraftConflict && (
        <div style={{
          background: 'var(--color-sandalwood)',
          color: 'var(--color-maroon)',
          padding: '0.75rem 1.5rem',
          fontSize: '0.92rem',
          textAlign: 'center',
          borderBottom: '2px solid var(--color-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          zIndex: 999,
          position: 'relative'
        }}>
          <span style={{ fontWeight: 600 }}>
            ⚠️ లోకల్ బ్రౌజర్ మార్పులు: మీ బ్రౌజర్ లో ఉన్న మార్పులు మరియు సర్వర్ లో ఉన్న డేటా వేర్వేరుగా ఉన్నాయి.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => handleResolveConflict(true)} 
              className="btn btn-primary"
              style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}
            >
              లోకల్ డేటా ఉంచు (Keep Local)
            </button>
            <button 
              onClick={() => handleResolveConflict(false)} 
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}
            >
              సర్వర్ డేటా లోడ్ చేయి (Overwrite)
            </button>
          </div>
        </div>
      )}
      {loadError && (
        <div style={{
          background: '#fff3cd', color: '#856404',
          padding: '0.5rem 1.5rem', fontSize: '0.85rem',
          textAlign: 'center', borderBottom: '1px solid #ffc107'
        }}>
          ⚠️ Could not load latest data from server — showing cached version.
        </div>
      )}
      <main className="container">
        <Routes>
          <Route path="/" element={
            <HomePage 
              profiles={enrichedProfiles} 
              deferredPrompt={deferredPrompt}
              setDeferredPrompt={setDeferredPrompt}
            />
          } />
          <Route path="/home-person" element={
            <HomePerson 
              profiles={enrichedProfiles} 
              setFocusedPid={setFocusedPid} 
              setSidebarPerson={setSidebarPerson} 
            />
          } />
          <Route path="/tree" element={
            <TreeDisplay 
              profiles={enrichedProfiles} 
              focusedPid={focusedPid}
              setFocusedPid={setFocusedPid}
              sidebarPerson={sidebarPerson}
              setSidebarPerson={setSidebarPerson}
            />
          } />
          <Route path="/birthdays" element={<Birthdays profiles={enrichedProfiles} />} />
          <Route path="/reports" element={<Reports profiles={enrichedProfiles} setFocusedPid={setFocusedPid} />} />
          <Route path="/memories" element={
            <Memories 
              profiles={profiles} 
              setProfiles={updateProfiles}
              setSavedProfilesBaseline={setSavedProfilesBaseline}
              setFocusedPid={setFocusedPid}
            />
          } />
          <Route path="/timeline" element={<Timeline profiles={enrichedProfiles} setFocusedPid={setFocusedPid} />} />
          <Route path="/menu" element={
            <MenuPage 
              profiles={enrichedProfiles} 
              deferredPrompt={deferredPrompt} 
              setDeferredPrompt={setDeferredPrompt} 
            />
          } />
          <Route path="/dashboard" element={<Dashboard profiles={enrichedProfiles} />} />
          <Route path="/settings" element={
            <UserSettings 
              profiles={enrichedProfiles} 
              deferredPrompt={deferredPrompt} 
              setDeferredPrompt={setDeferredPrompt} 
            />
          } />
          <Route path="/admin" element={
            <AdminGate>
              <AdminPage 
                profiles={profiles} 
                setProfiles={updateProfiles} 
                savedProfilesBaseline={savedProfilesBaseline}
                setSavedProfilesBaseline={setSavedProfilesBaseline}
              />
            </AdminGate>
          } />
          <Route path="/cloudinary-test" element={<CloudinaryUpload />} />
          <Route path="/submit-details" element={<MemberSubmission profiles={profiles} />} />
        </Routes>
      </main>
      <MobileBottomNav 
        profiles={enrichedProfiles}
        focusedPid={focusedPid}
        setFocusedPid={setFocusedPid}
        sidebarPerson={sidebarPerson}
        setSidebarPerson={setSidebarPerson}
      />
      </Router>
    </DecryptionGate>
  );
}

export default App;
