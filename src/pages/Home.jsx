import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, ArrowRight, RefreshCw } from 'lucide-react';

const Home = ({ profiles }) => {
  const navigate = useNavigate();

  // Find the primary surname from the home person (if configured)
  const homePid = localStorage.getItem('vamsha_home_pid');
  const homePerson = homePid && profiles ? profiles.find(p => p.pid === homePid) : null;
  const primarySurname = homePerson ? (homePerson.surName || '').trim() : '';

  const handleExploreClick = () => {
    navigate('/home-person');
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
            VAMSHA
          </h2>
          <p style={{
            color: '#8C6A53',
            fontSize: '0.88rem',
            fontWeight: 600,
            margin: 0,
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            {primarySurname ? `${primarySurname.toUpperCase()} FAMILY TREE` : 'TRADITIONAL FAMILY TREE'}
          </p>
        </div>

        {/* Welcome Message */}
        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.35rem', color: '#333', fontWeight: 700, margin: '0 0 0.75rem' }}>
            Welcome to Our Family Tree
          </h3>
          <p style={{ color: '#666', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
            Discover our lineage, relationships, and special astrological details. Select a primary member to explore the interactive tree display.
          </p>
        </div>

        {/* Dynamic Interactive Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
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
            Explore Family Tree
            <ArrowRight size={18} />
          </button>
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
        Force Sync / Hard Refresh
      </button>
    </div>
  );
};

export default Home;
