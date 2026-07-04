import React, { useState, useEffect } from 'react';
import { X, Home } from 'lucide-react';

const Sidebar = ({ person, profiles, onClose, onSelectPerson }) => {
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
                title="Deceased"
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
          <h2 className="sidebar-name">{person.isDeceased ? 'Late ' : ''}{person.firstName} {person.surName}</h2>
          {person.maidenName && <p className="sidebar-maiden">(Nee: {person.maidenName})</p>}

          <div style={{ marginTop: '0.75rem' }}>
            {isHome ? (
              <span className="home-badge active">
                <Home size={14} /> Home Person
              </span>
            ) : (
              <button className="home-badge-btn" onClick={handleSetHome}>
                <Home size={14} /> Set as Home Person
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section-title">Personal Details</div>

          <div className="sidebar-details-grid">
            {person.isDeceased && (
              <div className="info-group" style={{ gridColumn: '1 / -1' }}>
                <span className="info-label" style={{ color: '#c0392b' }}>Status</span>
                <span className="info-value" style={{ color: '#c0392b', fontWeight: 600 }}>Deceased</span>
              </div>
            )}
            <div className="info-group">
              <span className="info-label">Profile ID</span>
              <span className="info-value">{person.pid}</span>
            </div>
            <div className="info-group">
              <span className="info-label">Date of Birth</span>
              <span className="info-value">{person.dob || '-'}</span>
            </div>
            {person.isDeceased && (
              <div className="info-group">
                <span className="info-label">Date of Death</span>
                <span className="info-value">{person.deathDate || '-'}</span>
              </div>
            )}
            <div className="info-group">
              <span className="info-label">Phone</span>
              <span className="info-value">{person.phone || '-'}</span>
            </div>
            <div className="info-group">
              <span className="info-label">Email ID</span>
              <span className="info-value">{person.email || '-'}</span>
            </div>
            <div className="info-group">
              <span className="info-label">Nakshatram</span>
              <span className="info-value">{person.nakshatra ? person.nakshatra.split(' (')[0] : '-'}</span>
            </div>
            <div className="info-group">
              <span className="info-label">Rashi</span>
              <span className="info-value">{person.rashi ? person.rashi.split(' (')[0] : '-'}</span>
            </div>
            <div className="info-group" style={{ gridColumn: (person.gender === 'Female' && person.maidenGotram) ? 'auto' : 'span 2' }}>
              <span className="info-label">Gotramu</span>
              <span className="info-value">{person.gotram || '-'}</span>
            </div>
            {person.gender === 'Female' && person.maidenGotram && (
              <div className="info-group">
                <span className="info-label">Maiden Gotram</span>
                <span className="info-value">{person.maidenGotram}</span>
              </div>
            )}
          </div>

          <div className="sidebar-section-title" style={{ marginTop: '1rem' }}>Family</div>

          <div className="info-group">
            <span className="info-label">Father (తండ్రి)</span>
            <span className="info-value">
              {father ? (
                <button className="relation-link-btn" onClick={() => onSelectPerson(father)}>
                  {father.firstName} {father.surName}
                </button>
              ) : <span className="empty-text">None</span>}
            </span>
          </div>

          <div className="info-group">
            <span className="info-label">Mother (తల్లి)</span>
            <span className="info-value">
              {mother ? (
                <button className="relation-link-btn" onClick={() => onSelectPerson(mother)}>
                  {mother.firstName} {mother.surName}
                </button>
              ) : <span className="empty-text">None</span>}
            </span>
          </div>

          <div className="info-group">
            <span className="info-label">Spouse (భార్య/భర్త)</span>
            <span className="info-value">
              {spouses.length > 0 ? (
                <div className="relation-links-list">
                  {spouses.map(sp => (
                    <button key={sp.pid} className="relation-link-btn" onClick={() => onSelectPerson(sp)}>
                      {sp.firstName} {sp.surName}
                    </button>
                  ))}
                </div>
              ) : <span className="empty-text">None</span>}
            </span>
          </div>

          <div className="info-group">
            <span className="info-label">Children (పిల్లలు)</span>
            <span className="info-value">
              {children.length > 0 ? (
                <div className="relation-links-list">
                  {children.map(ch => (
                    <button key={ch.pid} className="relation-link-btn" onClick={() => onSelectPerson(ch)}>
                      {ch.firstName} {ch.surName}
                    </button>
                  ))}
                </div>
              ) : <span className="empty-text">None</span>}
            </span>
          </div>

          {person.notes && (
            <div className="info-group notes-group" style={{ marginTop: '1rem' }}>
              <span className="info-label">Notes</span>
              <p className="info-value notes-text">{person.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
