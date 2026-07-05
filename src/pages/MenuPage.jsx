import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCw, UserCheck, GitBranch, Cake, BarChart2, BookOpen, Calendar, Settings, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MenuPage = ({ profiles }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  // Find the primary surname from the home person (if configured)
  const homePid = localStorage.getItem('vamsha_home_pid');
  const homePerson = homePid && profiles ? profiles.find(p => p.pid === homePid) : null;
  const primarySurname = homePerson ? (homePerson.surName || '').trim() : '';

  const menuItems = [
    { path: '/home-person', label: t('nav.home_person'), icon: UserCheck, color: '#A04000', bgColor: '#FDF2E9' },
    { path: '/tree', label: t('nav.tree'), icon: GitBranch, color: '#27AE60', bgColor: '#E8F5E9' },
    { path: '/birthdays', label: t('nav.birthdays'), icon: Cake, color: '#E67E22', bgColor: '#FFF3E0' },
    { path: '/dashboard', label: t('nav.dashboard'), icon: BarChart2, color: '#2980B9', bgColor: '#E3F2FD' },
    { path: '/reports', label: t('nav.reports'), icon: FileText, color: '#008080', bgColor: '#E0F2F1' },
    { path: '/memories', label: t('nav.memories'), icon: BookOpen, color: '#8E44AD', bgColor: '#F3E5F5' },
    { path: '/timeline', label: t('nav.timeline'), icon: Calendar, color: '#C0392B', bgColor: '#FFEBEE' },
    { path: '/settings', label: t('nav.settings'), icon: Settings, color: '#607D8B', bgColor: '#ECEFF1' }
  ];

  return (
    <div style={{ 
      position: 'relative',
      backgroundColor: '#ffffff', 
      minHeight: '100vh',
      paddingBottom: '5rem',
      margin: '-1.5rem -1rem 0 -1rem',
      paddingTop: '1.5rem',
      paddingLeft: '1rem',
      paddingRight: '1rem'
    }}>
      {/* Refresh/Reload Button & Label Group */}
      <div style={{
        position: 'absolute',
        top: '1.25rem',
        right: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        zIndex: 10
      }}>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#F9F6F0',
            border: '1.5px solid var(--color-sandalwood, #D3BCA2)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            transition: 'all 0.2s',
            color: 'var(--color-maroon, #63131D)'
          }}
          title="Refresh App"
        >
          <RotateCw 
            size={18} 
            strokeWidth={2.5} 
            className={isRefreshing ? 'refresh-spin-active' : ''} 
          />
        </button>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          color: '#8C6A53',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Refresh
        </span>
      </div>
      <style>{`
        @keyframes spin-refresh {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .refresh-spin-active {
          animation: spin-refresh 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .menu-page-item-btn {
          -webkit-tap-highlight-color: transparent;
        }
        .menu-page-item-btn:hover .menu-icon-wrapper {
          transform: translateY(-4px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.05);
        }
        .menu-page-item-btn:active .menu-icon-wrapper {
          transform: scale(0.95);
        }
      `}</style>

      {/* Directory Branding Logo */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: '1.5rem' }}>
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

      {/* 3-Column Grid representing options */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.25rem 0.5rem',
        maxWidth: '500px',
        margin: '0 auto',
        padding: '0 0.5rem'
      }}>
        {menuItems.map(item => {
          const IconComp = item.icon;
          return (
            <button 
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.75rem 0.25rem',
                borderRadius: '12px',
                transition: 'all 0.2s',
                outline: 'none',
                fontFamily: 'inherit'
              }}
              className="menu-page-item-btn"
            >
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                backgroundColor: item.bgColor,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '0.6rem',
                transition: 'all 0.2s'
              }} className="menu-icon-wrapper">
                <IconComp size={26} strokeWidth={2.2} style={{ color: item.color }} />
              </div>
              <span style={{
                fontSize: '0.82rem',
                fontWeight: '700',
                color: '#333',
                textAlign: 'center',
                lineHeight: 1.25,
                maxWidth: '90px',
                wordBreak: 'keep-all'
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MenuPage;
