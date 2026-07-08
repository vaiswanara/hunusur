import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { useLanguage } from '../context/LanguageContext';

const HomePerson = ({ profiles, setFocusedPid, setSidebarPerson }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  // Load saved home person pid from local storage
  const [homePid, setHomePid] = useState(() => {
    return localStorage.getItem('vamsha_home_pid') || '';
  });

  const selectedPerson = useMemo(() => {
    return profiles.find(p => p.pid === homePid) || null;
  }, [homePid, profiles]);

  const personOptions = useMemo(() => {
    return [...profiles]
      .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))
      .map(p => ({
        value: p.pid,
        label: `${p.firstName} ${p.surName} (${p.pid})`
      }));
  }, [profiles]);

  const handlePersonChange = (e) => {
    const selected = e.target.value;
    setHomePid(selected);
    localStorage.setItem('vamsha_home_pid', selected);
    setFocusedPid(selected);
    
    // Auto focus in sidebar when they open the tree
    const personObj = profiles.find(p => p.pid === selected);
    setSidebarPerson(personObj);
  };

  const handleGoToTree = () => {
    if (homePid) {
      navigate('/tree');
    }
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
      <style>{`
        .home-person-card {
          max-width: 480px;
          width: 100%;
          padding: 2rem 2rem;
          border-radius: 20px;
          text-align: center;
          box-shadow: 0 15px 45px rgba(99, 19, 29, 0.08);
          border: 1px solid var(--color-sandalwood, #EADDCA);
          background: #ffffff;
          position: relative;
          overflow: visible;
          animation: cardFadeIn 0.5s ease-out;
        }
        .welcome-banner {
          margin-top: 1rem;
          padding: 1.25rem;
          border-radius: 12px;
          background: linear-gradient(135deg, #FAF7F0 0%, #F4EFE6 100%);
          border: 1px solid #E6DFD3;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .welcome-title {
          color: var(--color-maroon, #63131D);
          font-size: 1.35rem;
          font-weight: 800;
          margin: 0 0 0.35rem;
          font-family: 'Outfit', sans-serif;
        }
        .welcome-subtitle {
          color: #555;
          font-size: 0.88rem;
          margin: 0;
          line-height: 1.45;
        }
        .tip-box {
          margin-top: 0.85rem;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          background-color: #FAF9F6;
          border-left: 4px solid var(--color-gold, #D4AF37);
          font-size: 0.82rem;
          color: #5d5d5d;
          text-align: left;
          line-height: 1.5;
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .tip-icon {
          color: var(--color-gold, #D4AF37);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .tree-frame {
          margin-top: 1rem;
          position: relative;
          display: inline-block;
          border-radius: 16px;
          border: 4px solid var(--color-gold, #D4AF37);
          overflow: hidden;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(99, 19, 29, 0.12);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tree-frame:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 35px rgba(99, 19, 29, 0.22);
          border-color: var(--color-maroon, #63131D);
        }
        .tree-image-premium {
          max-width: 250px;
          max-height: 200px;
          width: 100%;
          height: auto;
          display: block;
          object-fit: contain;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tree-frame:hover .tree-image-premium {
          transform: scale(1.05);
        }
        .tree-frame-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(99,19,29,0.92) 0%, rgba(99,19,29,0.4) 75%, rgba(99,19,29,0) 100%);
          padding: 1.5rem 0.5rem 0.85rem;
          color: #fff;
          font-weight: 700;
          font-size: 0.88rem;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          opacity: 0.95;
        }
        .tree-frame:hover .tree-frame-overlay {
          opacity: 1;
          background: linear-gradient(to top, rgba(99,19,29,0.96) 0%, rgba(99,19,29,0.65) 100%);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="home-person-card">
        {/* Top gold/maroon border accent */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '6px',
          background: 'linear-gradient(90deg, var(--color-maroon) 0%, var(--color-gold) 50%, var(--color-maroon) 100%)',
          borderTopLeftRadius: '19px',
          borderTopRightRadius: '19px'
        }} />

        {!homePid && (
          <div style={{ marginBottom: '1.75rem' }}>
            <h2 style={{
              color: 'var(--color-maroon, #63131D)',
              fontSize: '1.6rem',
              fontWeight: 800,
              margin: '0 0 0.5rem',
              fontFamily: "'Outfit', sans-serif"
            }}>
              {t('home_person.select_title')}
            </h2>
            <p style={{ color: '#666', fontSize: '0.9rem', margin: 0, lineHeight: 1.45 }}>
              {t('home_person.select_desc')}
            </p>
          </div>
        )}

        {/* Dropdown Selection */}
        <div style={{ textLeft: 'left', margin: homePid ? '0.75rem auto 0 auto' : '0 auto', maxWidth: '380px' }}>
          <SearchableSelect 
            options={personOptions}
            value={homePid}
            onChange={handlePersonChange}
            placeholder={t('home_person.placeholder')}
          />
        </div>

        {/* Welcome Banner & Tree Image */}
        {homePid && selectedPerson && (
          <>
            <div className="welcome-banner" style={{ marginTop: '1rem' }}>
              <h3 className="welcome-title">
                {t('home_person.welcome', { name: selectedPerson.firstName })}
              </h3>
              <p className="welcome-subtitle">
                {t('home_person.configured', { name: `${selectedPerson.firstName} ${selectedPerson.surName}`, id: selectedPerson.pid })}
              </p>
            </div>

            <div 
              className="tree-frame" 
              onClick={handleGoToTree}
              title="Click here to load the Family Tree"
            >
              <img 
                src={`${import.meta.env.BASE_URL}icons/ftree.jpg`} 
                alt="Wamsha Tree Emblem" 
                className="tree-image-premium"
              />
              <div className="tree-frame-overlay">
                <span>{t('home_person.explore_tree')}</span>
              </div>
            </div>

            <div className="tip-box" style={{ marginTop: '1.25rem' }}>
              <HelpCircle className="tip-icon" size={16} />
              <div>
                <strong>{t('home_person.tip_title')}</strong> {t('home_person.tip_desc')}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HomePerson;
