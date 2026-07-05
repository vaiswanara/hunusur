import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, GitBranch, Cake, BarChart2, BookOpen, Calendar, Settings } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MenuPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/home-person', label: t('nav.home_person'), icon: UserCheck, color: '#A04000' },
    { path: '/tree', label: t('nav.tree'), icon: GitBranch, color: '#27AE60' },
    { path: '/birthdays', label: t('nav.birthdays'), icon: Cake, color: '#E67E22' },
    { path: '/reports', label: t('nav.reports'), icon: BarChart2, color: '#2980B9' },
    { path: '/memories', label: t('nav.memories'), icon: BookOpen, color: '#8E44AD' },
    { path: '/timeline', label: t('nav.timeline'), icon: Calendar, color: '#C0392B' },
    { path: '/settings', label: t('nav.settings'), icon: Settings, color: '#7F8C8D' }
  ];

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <style>{`
        .menu-page-item-btn {
          -webkit-tap-highlight-color: transparent;
        }
        .menu-page-item-btn:hover .menu-icon-wrapper {
          transform: translateY(-4px);
          box-shadow: 0 8px 16px rgba(99, 19, 29, 0.08);
          border-color: var(--color-sandalwood, #EADDCA);
        }
        .menu-page-item-btn:active .menu-icon-wrapper {
          transform: scale(0.95);
        }
      `}</style>

      {/* Directory Branding Logo */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: '1.5rem' }}>
        <div style={{
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '110px',
          height: '110px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FFF8F0 0%, #F5E6D3 100%)',
          border: '3px solid var(--color-sandalwood, #EADDCA)',
          boxShadow: '0 8px 24px rgba(99, 19, 29, 0.06)',
          position: 'relative'
        }}>
          <div style={{
            width: '92px',
            height: '92px',
            borderRadius: '50%',
            border: '1.5px dashed var(--color-maroon, #63131D)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '2.5rem'
          }}>
            🌳
          </div>
        </div>
        <h2 style={{ color: 'var(--color-maroon, #63131D)', fontSize: '1.75rem', fontWeight: 800, margin: '1rem 0 0.25rem' }}>
          {t('nav.directory')}
        </h2>
        <p style={{ color: '#8C7A70', fontSize: '0.88rem', fontStyle: 'italic', margin: 0 }}>
          Vamsha Family Tree Directory
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
                backgroundColor: 'white',
                border: '1.5px solid #F3EDE4',
                boxShadow: '0 4px 10px rgba(99, 19, 29, 0.03)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'var(--color-maroon, #63131D)',
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
