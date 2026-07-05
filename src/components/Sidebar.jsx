import React, { useState, useEffect } from 'react';
import { X, Home } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Sidebar = ({ person, profiles, onClose, onSelectPerson }) => {
  const { t } = useLanguage();
  const [isHome, setIsHome] = useState(() => {
    return person ? localStorage.getItem('vamsha_home_pid') === person.pid : false;
  });

  useEffect(() => {
    if (person) {
      setIsHome(localStorage.getItem('vamsha_home_pid') === person.pid);
    }
  }, [person]);

  if (!person) return null;

  const handleSetHome = () => {
    localStorage.setItem('vamsha_home_pid', person.pid);
    setIsHome(true);
  };

  const iconSrc = person.photoUrl
    ? person.photoUrl
    : (person.gender === 'Male'
      ? `${import.meta.env.BASE_URL}icons/male_icon.png`
      : `${import.meta.env.BASE_URL}icons/female_icon.png`);

  // Find relationships from profiles list
  const father = profiles.find(p => p.pid === person.fatherId);
  const mother = profiles.find(p => p.pid === person.motherId);
  const spouses = (person.spouseIds || [])
    .map(id => profiles.find(p => p.pid === id))
    .filter(Boolean);
  const children = profiles
    .filter(p => p.fatherId === person.pid || p.motherId === person.pid)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return (
    <>
      {/* Backdrop for mobile */}
      <div className="sidebar-backdrop" onClick={onClose}></div>

      <div className="sidebar">
        <button className="close-btn" onClick={onClose}><X size={20} /></button>

        <div className="sidebar-header">
          <div style={{ position: 'relative' }}>
            <div className="sidebar-profile-img-container">
              <img src={iconSrc} alt={person.firstName} className="sidebar-profile-img" />
            </div>
            {person.isDeceased && (
              <div
                title={t('sidebar.deceased')}
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '4px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '1.25rem',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                  border: '2.5px solid var(--color-maroon, #63131D)'
                }}
              >
                🪔
              </div>
            )}
          </div>
          <h2 className="sidebar-name">{person.isDeceased ? t('sidebar.late') + ' ' : ''}{person.firstName} {person.surName}</h2>
          {person.maidenName && <p className="sidebar-maiden">(Nee: {person.maidenName})</p>}

          <div style={{ marginTop: '0.75rem' }}>
            {isHome ? (
              <span className="home-badge active">
                <Home size={14} /> {t('sidebar.home_badge')}
              </span>
            ) : (
              <button className="home-badge-btn" onClick={handleSetHome}>
                <Home size={14} /> {t('sidebar.set_as_home')}
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section-title">{t('sidebar.personal_details')}</div>

          <div className="sidebar-details-grid">
            {person.isDeceased && (
              <div className="info-group" style={{ gridColumn: '1 / -1' }}>
                <span className="info-label" style={{ color: '#c0392b' }}>{t('sidebar.status')}</span>
                <span className="info-value" style={{ color: '#c0392b', fontWeight: 600 }}>{t('sidebar.deceased')}</span>
              </div>
            )}
            <div className="info-group">
              <span className="info-label">{t('sidebar.profile_id')}</span>
              <span className="info-value">{person.pid}</span>
            </div>
            <div className="info-group">
              <span className="info-label">{t('sidebar.dob')}</span>
              <span className="info-value">{person.dob || '-'}</span>
            </div>
            {person.isDeceased && (
              <div className="info-group">
                <span className="info-label">{t('sidebar.dod')}</span>
                <span className="info-value">{person.deathDate || '-'}</span>
              </div>
            )}
            <div className="info-group">
              <span className="info-label">{t('sidebar.phone')}</span>
              <span className="info-value">{person.phone || '-'}</span>
            </div>
            <div className="info-group">
              <span className="info-label">{t('sidebar.email')}</span>
              <span className="info-value">{person.email || '-'}</span>
            </div>
            <div className="info-group">
              <span className="info-label">{t('sidebar.nakshatram')}</span>
              <span className="info-value">{person.nakshatra ? person.nakshatra.split(' (')[0] : '-'}</span>
            </div>
            <div className="info-group">
              <span className="info-label">{t('sidebar.rashi')}</span>
              <span className="info-value">{person.rashi ? person.rashi.split(' (')[0] : '-'}</span>
            </div>
            <div className="info-group" style={{ gridColumn: (person.gender === 'Female' && person.maidenGotram) ? 'auto' : 'span 2' }}>
              <span className="info-label">{t('sidebar.gotram')}</span>
              <span className="info-value">{person.gotram || '-'}</span>
            </div>
            {person.gender === 'Female' && person.maidenGotram && (
              <div className="info-group">
                <span className="info-label">{t('sidebar.maiden_gotram')}</span>
                <span className="info-value">{person.maidenGotram}</span>
              </div>
            )}
          </div>

          <div className="sidebar-section-title" style={{ marginTop: '1rem' }}>{t('sidebar.family')}</div>

          <div className="info-group">
            <span className="info-label">{t('sidebar.father')}</span>
            <span className="info-value">
              {father ? (
                <button className="relation-link-btn" onClick={() => onSelectPerson(father)}>
                  {father.firstName} {father.surName}
                </button>
              ) : <span className="empty-text">{t('sidebar.none')}</span>}
            </span>
          </div>

          <div className="info-group">
            <span className="info-label">{t('sidebar.mother')}</span>
            <span className="info-value">
              {mother ? (
                <button className="relation-link-btn" onClick={() => onSelectPerson(mother)}>
                  {mother.firstName} {mother.surName}
                </button>
              ) : <span className="empty-text">{t('sidebar.none')}</span>}
            </span>
          </div>

          <div className="info-group">
            <span className="info-label">{t('sidebar.spouse')}</span>
            <span className="info-value">
              {spouses.length > 0 ? (
                <div className="relation-links-list">
                  {spouses.map(sp => (
                    <button key={sp.pid} className="relation-link-btn" onClick={() => onSelectPerson(sp)}>
                      {sp.firstName} {sp.surName}
                    </button>
                  ))}
                </div>
              ) : <span className="empty-text">{t('sidebar.none')}</span>}
            </span>
          </div>

          <div className="info-group">
            <span className="info-label">{t('sidebar.children')}</span>
            <span className="info-value">
              {children.length > 0 ? (
                <div className="relation-links-list">
                  {children.map(ch => (
                    <button key={ch.pid} className="relation-link-btn" onClick={() => onSelectPerson(ch)}>
                      {ch.firstName} {ch.surName}
                    </button>
                  ))}
                </div>
              ) : <span className="empty-text">{t('sidebar.none')}</span>}
            </span>
          </div>

          {person.notes && (
            <div className="info-group notes-group" style={{ marginTop: '1rem' }}>
              <span className="info-label">{t('sidebar.notes')}</span>
              <p className="info-value notes-text">{person.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};


export default Sidebar;
