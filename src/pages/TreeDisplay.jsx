import React, { useState, useMemo, useEffect } from 'react';
import { Info, Home, UserCheck } from 'lucide-react';
import initialData from '../data.json';
import Sidebar from '../components/Sidebar';


// Utility to calculate exact relationship tag in Telugu
const getRelationshipTag = (person, type, focusedPerson, isElder) => {
  if (type === 'father') return 'తండ్రి';
  if (type === 'mother') return 'తల్లి';
  if (type === 'spouse') return person.gender === 'Female' ? 'భార్య' : 'భర్త';
  if (type === 'child') return person.gender === 'Male' ? 'కొడుకు' : 'కూతురు';
  if (type === 'sibling') {
    if (person.gender === 'Male') return isElder ? 'అన్న' : 'తమ్ముడు';
    return isElder ? 'అక్క' : 'చెల్లి';
  }
  return '';
};

const PersonIcon = ({ person, type, focusedPerson, isElder, onFocus, onInfo, isFocused }) => {
  if (!person) return null;

  const iconSrc = person.photoUrl
    ? person.photoUrl
    : `${import.meta.env.BASE_URL}icons/${person.gender === 'Male' ? 'male_icon.png' : 'female_icon.png'}`;
  const displayName = `${person.isDeceased ? 'Late ' : ''}${person.surName ? person.surName.charAt(0).toUpperCase() + '.' : ''} ${person.firstName}`;
  const tag = getRelationshipTag(person, type, focusedPerson, isElder);

  // Dynamic classes
  const genderClass = person.gender === 'Male' ? 'gender-male' : 'gender-female';
  const focusClass = isFocused ? 'is-focused' : '';
  const deceasedClass = person.isDeceased ? 'is-deceased' : '';

  return (
    <div className={`person-wrapper ${focusClass}`}>
      <div className={`person-avatar-container ${genderClass} ${deceasedClass}`} onClick={() => onFocus(person.pid)}>
        <img src={iconSrc} alt={person.firstName} className="person-avatar" />
        <button
          className="info-badge"
          onClick={(e) => { e.stopPropagation(); onInfo(person); }}
          title="More Info"
        >
          <Info size={24} strokeWidth={2} />
        </button>
        {person.isDeceased && (
          <div
            className="deceased-diya-badge"
            title="Deceased"
            style={{
              position: 'absolute',
              bottom: '0px',
              left: '-5px',
              backgroundColor: 'white',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '0.9rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              pointerEvents: 'none'
            }}
          >
            🪔
          </div>
        )}
      </div>
      <div className="person-details">
        <div className="person-name">{displayName}</div>
        {!isFocused && tag && <div className="relation-tag">{tag}</div>}
      </div>
    </div>
  );
};

const VerticalConnector = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '40px', justifyContent: 'center', margin: '0.25rem 0' }}>
    <div style={{ width: '2px', height: '100%', backgroundColor: 'var(--color-line, #D3BCA2)' }}></div>
  </div>
);

const TreeDisplay = ({ profiles: profilesProp, focusedPid, setFocusedPid, sidebarPerson, setSidebarPerson }) => {
  const profiles = profilesProp || initialData;

  // If profiles change externally and focusedPid no longer exists, reset to first
  useEffect(() => {
    if (focusedPid && !profiles.find(p => p.pid === focusedPid)) {
      setFocusedPid(profiles.length > 0 ? profiles[0].pid : null);
    }
  }, [profiles]);

  const treeData = useMemo(() => {
    if (!focusedPid) return null;

    const person = profiles.find(p => p.pid === focusedPid);
    if (!person) return null;

    const father = profiles.find(p => p.pid === person.fatherId);
    const mother = profiles.find(p => p.pid === person.motherId);
    const parents = [father, mother].filter(Boolean);

    const spouses = (person.spouseIds || [])
      .map(id => profiles.find(p => p.pid === id))
      .filter(Boolean);
    const children = profiles.filter(p => p.fatherId === focusedPid || p.motherId === focusedPid)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    let siblings = [];
    let focusedDisplayOrder = person.displayOrder || 0;
    if (person.fatherId || person.motherId) {
      const allSiblings = profiles.filter(p => {
        if (p.pid === focusedPid) return false;
        if (person.fatherId && p.fatherId === person.fatherId) return true;
        if (person.motherId && p.motherId === person.motherId) return true;
        return false;
      });
      // If all siblings share same parent, sort and determine elder/younger by displayOrder
      siblings = allSiblings.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }

    return { person, parents, spouses, children, siblings, focusedDisplayOrder };
  }, [focusedPid, profiles]);

  if (!treeData) return <div className="tree-container">No Data Available</div>;

  return (
    <div className="tree-layout-wrapper">

      {/* Parents Section */}
      {treeData.parents.length > 0 && (
        <div className="tree-card">
          <div className="card-content row-flex">
            {treeData.parents.map(p => (
              <PersonIcon
                key={p.pid}
                person={p}
                type={p.gender === 'Male' ? 'father' : 'mother'}
                onFocus={setFocusedPid}
                onInfo={setSidebarPerson}
              />
            ))}
          </div>
        </div>
      )}

      {/* Siblings & Focused Node Section */}
      {treeData.parents.length > 0 && <VerticalConnector />}

      <div className="tree-card">
        <div className="card-content row-flex wrap">
          {/* Elder Siblings — lower displayOrder than focused person */}
          {treeData.siblings.filter(s => (s.displayOrder || 0) < (treeData.person.displayOrder || 0)).map(s => (
            <PersonIcon key={s.pid} person={s} type="sibling" isElder={true} onFocus={setFocusedPid} onInfo={setSidebarPerson} />
          ))}

          {/* Focused Person */}
          <PersonIcon person={treeData.person} isFocused={true} onFocus={setFocusedPid} onInfo={setSidebarPerson} />

          {/* Younger Siblings — higher displayOrder than focused person */}
          {treeData.siblings.filter(s => (s.displayOrder || 0) > (treeData.person.displayOrder || 0)).map(s => (
            <PersonIcon key={s.pid} person={s} type="sibling" isElder={false} onFocus={setFocusedPid} onInfo={setSidebarPerson} />
          ))}
        </div>
      </div>

      {/* Spouses & Children Section */}
      {(treeData.spouses.length > 0 || treeData.children.length > 0) && (
        <>
          <VerticalConnector />

          <div className="tree-card spouse-children-card">

            {/* Spouses */}
            {treeData.spouses.length > 0 && (
              <div className="spouse-section">
                {treeData.spouses.map(sp => (
                  <PersonIcon key={sp.pid} person={sp} type="spouse" onFocus={setFocusedPid} onInfo={setSidebarPerson} />
                ))}
              </div>
            )}

            {/* Connecting line to children */}
            {treeData.spouses.length > 0 && treeData.children.length > 0 && (
              <div className="vertical-connector-internal">
                <div className="internal-label">Children</div>
              </div>
            )}

            {/* Children */}
            {treeData.children.length > 0 && (
              <div className="children-section row-flex wrap">
                {treeData.children.map(c => (
                  <PersonIcon key={c.pid} person={c} type="child" onFocus={setFocusedPid} onInfo={setSidebarPerson} />
                ))}
              </div>
            )}

          </div>
        </>
      )}



      <Sidebar
        person={sidebarPerson}
        profiles={profiles}
        onClose={() => setSidebarPerson(null)}
        onSelectPerson={(p) => {
          setSidebarPerson(p);
          setFocusedPid(p.pid);
        }}
      />
    </div>
  );
};

export default TreeDisplay;
