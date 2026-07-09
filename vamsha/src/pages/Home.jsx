import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, ArrowRight, RefreshCw, Download, Lock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Home = ({ profiles, deferredPrompt, setDeferredPrompt, activeBranchId, onLogoutBranch, isAdmin }) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  // Find the primary surname from the home person (if configured)
  const homePid = localStorage.getItem('vamsha_home_pid');
  const homePerson = homePid && profiles ? profiles.find(p => p.pid === homePid) : null;
  const primarySurname = homePerson ? (homePerson.surName || '').trim() : '';

  const handleExploreClick = () => {
    navigate('/menu');
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

  const handleHardRefresh = () => {
    // Clear browser cache & service worker cache if possible
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }
    // Hard refresh page
    window.location.reload();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '2rem 1rem',
      boxSizing: 'border-box'
    }}>
      {/* Premium Centered Card */}
      <div className="card" style={{
        maxWidth: '540px',
        width: '100%',
        padding: '3rem 2.5rem',
        borderRadius: '16px',
        textAlign: 'center',
        boxShadow: '0 15px 40px rgba(99, 19, 29, 0.12)',
        border: '1.5px solid var(--color-sandalwood, #D3BCA2)',
        background: '#ffffff',
        position: 'relative',
        overflow: 'visible'
      }}>
        {/* Subtle decorative top border */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '6px',
          background: 'linear-gradient(90deg, var(--color-maroon) 0%, var(--color-gold) 50%, var(--color-maroon) 100%)',
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px'
        }} />

        {/* Site Header: Logo & Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }}>
          <img
            src={`${import.meta.env.BASE_URL}icons/icon-maskable-512.png`}
            alt="Vamsha Logo"
            style={{
              width: '110px',
              height: '110px',
              objectFit: 'contain',
              marginBottom: '1.25rem',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.06))'
            }}
          />
          <h2 style={{
            color: 'var(--color-maroon, #63131D)',
            fontSize: '2rem',
            fontWeight: 800,
            margin: '0 0 0.25rem',
            letterSpacing: '1px',
            fontFamily: "'Outfit', 'Inter', sans-serif"
          }}>
            {t('home.title')}
          </h2>
          <p style={{
            color: '#8C6A53',
            fontSize: '0.88rem',
            fontWeight: 600,
            margin: 0,
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            {primarySurname ? `${primarySurname.toUpperCase()} ${t('home.subtitle_family_tree')}` : t('home.subtitle_family_tree')}
          </p>
        </div>

        {/* Welcome Message */}
        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.35rem', color: '#333', fontWeight: 700, margin: '0 0 0.75rem' }}>
            {t('home.welcome_title')}
          </h3>
          <p style={{ color: '#666', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
            {t('home.welcome_desc')}
          </p>
        </div>

        {/* Dynamic Interactive Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', width: '100%' }}>
          {(activeBranchId || (window.VAMSHA_CONFIG?.familyBranches && Object.keys(window.VAMSHA_CONFIG.familyBranches).length > 0)) && (
            <div style={{
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              backgroundColor: '#FAF8F5',
              border: '1.5px solid #EFE4DC',
              width: '100%',
              boxSizing: 'border-box',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ fontSize: '0.88rem', color: '#666', marginBottom: '0.4rem', fontWeight: 600 }}>
                🌳 {language === 'te' ? 'కుటుంబ శాఖ:' : (language === 'kn' ? 'ಕುಟುಂಬ ಶಾಖೆ:' : 'Family Branch:')}{' '}
                <span style={{ color: 'var(--color-maroon)', fontWeight: 800 }}>
                  {activeBranchId && window.VAMSHA_CONFIG?.familyBranches?.[activeBranchId]
                    ? (window.VAMSHA_CONFIG.familyBranches[activeBranchId].name || activeBranchId)
                    : 'Master View'}
                </span>
              </div>
              <button
                onClick={onLogoutBranch}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-maroon)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                {language === 'te' ? '🔒 లాక్ చేయి / వేరే కుటుంబానికి మారు' : (language === 'kn' ? '🔒 ಲಾಕ್ ಮಾಡಿ / ಬೇರೆ ಕುಟುಂಬಕ್ಕೆ ಬದಲಾಯಿಸಿ' : '🔒 Lock / Switch Family')}
              </button>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleExploreClick}
            style={{
              width: '100%',
              padding: '0.9rem 2rem',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(99, 19, 29, 0.2)'
            }}
          >
            <GitBranch size={20} />
            {t('home.explore_btn')}
            <ArrowRight size={18} />
          </button>

          {isAdmin && (
            <button
              className="btn"
              onClick={() => navigate('/admin')}
              style={{
                width: '100%',
                padding: '0.9rem 2rem',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                borderRadius: '10px',
                border: '1.5px solid var(--color-maroon, #63131D)',
                color: 'var(--color-maroon, #63131D)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                fontWeight: 700
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(99, 19, 29, 0.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Lock size={20} />
              Admin Panel
            </button>
          )}

          {deferredPrompt && (
            <button
              className="btn"
              onClick={handleInstallClick}
              style={{
                width: '100%',
                padding: '0.9rem 2rem',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                borderRadius: '10px',
                border: '1.5px solid var(--color-maroon, #63131D)',
                color: 'var(--color-maroon, #63131D)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                fontWeight: 700
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(99, 19, 29, 0.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Download size={20} />
              {t('settings.install_btn')}
            </button>
          )}
        </div>
      </div>

      {/* Hard Refresh Button at the bottom of the page */}
      <button
        onClick={handleHardRefresh}
        style={{
          marginTop: '2.5rem',
          background: 'none',
          border: '1px solid var(--color-sandalwood, #EADDCA)',
          color: '#8C6A53',
          padding: '0.55rem 1.25rem',
          borderRadius: '20px',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.25s ease',
          backgroundColor: '#fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = 'var(--color-light)';
          e.currentTarget.style.color = 'var(--color-maroon)';
          e.currentTarget.style.borderColor = 'var(--color-gold)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = '#fff';
          e.currentTarget.style.color = '#8C6A53';
          e.currentTarget.style.borderColor = 'var(--color-sandalwood)';
        }}
      >
        <RefreshCw size={12} />
        {t('home.sync_btn')}
      </button>
    </div>
  );
};


export default Home;
