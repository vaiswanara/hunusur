import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Info, Home, UserCheck } from 'lucide-react';
import html2canvas from 'html2canvas';
import initialData from '../data.json';
import Sidebar from '../components/Sidebar';
import { useLanguage } from '../context/LanguageContext';


// Utility to calculate exact relationship tag based on language
const getRelationshipTag = (person, type, focusedPerson, isElder, t) => {
  if (type === 'father') return t('tree.relationships.father');
  if (type === 'mother') return t('tree.relationships.mother');
  if (type === 'spouse') return person.gender === 'Female' ? t('tree.relationships.spouse_female') : t('tree.relationships.spouse_male');
  if (type === 'child') return person.gender === 'Male' ? t('tree.relationships.child_male') : t('tree.relationships.child_female');
  if (type === 'sibling') {
    if (person.gender === 'Male') return isElder ? t('tree.relationships.brother_elder') : t('tree.relationships.brother_younger');
    return isElder ? t('tree.relationships.sister_elder') : t('tree.relationships.sister_younger');
  }
  return '';
};

const PersonIcon = ({ person, type, focusedPerson, isElder, onFocus, onInfo, isFocused }) => {
  const { t } = useLanguage();
  if (!person) return null;

  const iconSrc = person.photoUrl
    ? person.photoUrl
    : `${import.meta.env.BASE_URL}icons/${person.gender === 'Male' ? 'male_icon.png' : 'female_icon.png'}`;
  const displayName = `${person.isDeceased ? t('sidebar.late') + ' ' : ''}${person.surName ? person.surName.charAt(0).toUpperCase() + '.' : ''} ${person.firstName}`;
  const tag = getRelationshipTag(person, type, focusedPerson, isElder, t);

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
  const { t } = useLanguage();
  const treeRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingMode, setIsExportingMode] = useState(false);

  const handleExportPNG = async () => {
    if (!treeRef.current) return;
    setIsExporting(true);
    setIsExportingMode(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      const canvas = await html2canvas(treeRef.current, {
        useCORS: true,
        scale: 3, // High resolution scale factor
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const person = profiles.find(p => p.pid === focusedPid);
      const personName = person ? person.firstName : 'focused';
      link.download = `vamsha_tree_${personName}.png`;
      link.href = imgData;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Error exporting image: ' + err.message);
    } finally {
      setIsExporting(false);
      setIsExportingMode(false);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

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
    const sortPeople = (a, b) => {
      const orderA = a.displayOrder || 0;
      const orderB = b.displayOrder || 0;
      if (orderA !== orderB) return orderA - orderB;

      // Secondary fallback: DOB (older first)
      if (a.dob && b.dob) {
        return a.dob.localeCompare(b.dob);
      }
      if (a.dob) return -1;
      if (b.dob) return 1;

      // Stable fallback: PID
      return a.pid.localeCompare(b.pid);
    };

    const children = profiles.filter(p => p.fatherId === focusedPid || p.motherId === focusedPid)
      .sort(sortPeople);

    let elderSiblings = [];
    let youngerSiblings = [];
    if (person.fatherId || person.motherId) {
      const allSiblingsAndSelf = profiles.filter(p => {
        if (person.fatherId && p.fatherId === person.fatherId) return true;
        if (person.motherId && p.motherId === person.motherId) return true;
        return false;
      }).sort(sortPeople);

      const selfIdx = allSiblingsAndSelf.findIndex(p => p.pid === focusedPid);
      if (selfIdx >= 0) {
        elderSiblings = allSiblingsAndSelf.slice(0, selfIdx);
        youngerSiblings = allSiblingsAndSelf.slice(selfIdx + 1);
      }
    }

    return { person, parents, spouses, children, elderSiblings, youngerSiblings };
  }, [focusedPid, profiles]);

  const getSectionLabel = (sectionKey) => {
    if (!treeData || !treeData.person) return '';
    const name = treeData.person.firstName;
    const lang = localStorage.getItem('vamsha_lang') || 'en';
    const labelText = t(`tree.${sectionKey}`);
    
    if (lang === 'te') {
      return `${name} గారి ${labelText}`;
    } else if (lang === 'kn') {
      return `${name} ಅವರ ${labelText}`;
    } else {
      return `${name}'s ${labelText}`;
    }
  };

  if (!treeData) return <div className="tree-container">{t('tree.no_data')}</div>;

  return (
    <div style={{ position: 'relative' }}>
      
      {/* Printable CSS override */}
      <style>{`
        @media print {
          /* Hide non-tree elements completely */
          header, .app-header, .mobile-bottom-nav, .tree-export-bar, .info-badge, .deceased-diya-badge {
            display: none !important;
          }
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .tree-layout-wrapper {
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .tree-card, .spouse-children-card {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .tree-print-title {
            display: block !important;
          }
        }

        /* Image Export Overrides */
        .is-exporting-view {
          background-color: #ffffff !important;
          box-shadow: none !important;
          border: none !important;
        }
        .is-exporting-view .tree-card,
        .is-exporting-view .spouse-children-card {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
        }
        .is-exporting-view .info-badge {
          display: none !important;
        }
        .is-exporting-view .tree-print-title {
          display: block !important;
        }
      `}</style>

      <div className={`tree-layout-wrapper ${isExportingMode ? 'is-exporting-view' : ''}`} ref={treeRef} style={{ padding: '2rem 1.5rem', backgroundColor: '#FAF8F5', borderRadius: '16px', border: '1px solid var(--color-sandalwood)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>

        {/* Dynamic Title for Print/Export */}
        <div 
          className="tree-print-title" 
          style={{
            display: 'none',
            textAlign: 'center',
            marginBottom: '2rem',
            borderBottom: '2.5px solid var(--color-maroon, #63131D)',
            paddingBottom: '1rem'
          }}
        >
          <h1 style={{ color: 'var(--color-maroon, #63131D)', margin: 0, fontSize: '2.4rem', fontFamily: 'serif', fontWeight: 'bold' }}>
            {treeData.person ? `${treeData.person.firstName}'s Family Tree` : 'Family Tree'}
          </h1>
          <p style={{ color: '#666', margin: '6px 0 0', fontSize: '1.05rem', fontStyle: 'italic', fontWeight: 600 }}>
            Vamsha Family Tree Directory
          </p>
        </div>

        {/* Parents Section */}
        {treeData.parents.length > 0 && (
          <div className="tree-card">
            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0 1.25rem 0' }}>
              <span style={{ color: '#C08375', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {getSectionLabel('parents')}
              </span>
            </div>
            <div className="card-content row-flex">
              {treeData.parents.map(p => (
                <PersonIcon
                  key={p.pid}
                  person={p}
                  type={p.gender === 'Male' ? 'father' : 'mother'}
                  focusedPerson={treeData.person}
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
          <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0 1.25rem 0' }}>
            <span style={{ color: '#C08375', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {getSectionLabel('siblings')}
            </span>
          </div>
          <div className="card-content row-flex wrap">
            {/* Elder Siblings */}
            {treeData.elderSiblings.map(s => (
              <PersonIcon key={s.pid} person={s} type="sibling" isElder={true} focusedPerson={treeData.person} onFocus={setFocusedPid} onInfo={setSidebarPerson} />
            ))}

            {/* Focused Person */}
            <PersonIcon person={treeData.person} isFocused={true} focusedPerson={treeData.person} onFocus={setFocusedPid} onInfo={setSidebarPerson} />

            {/* Younger Siblings */}
            {treeData.youngerSiblings.map(s => (
              <PersonIcon key={s.pid} person={s} type="sibling" isElder={false} focusedPerson={treeData.person} onFocus={setFocusedPid} onInfo={setSidebarPerson} />
            ))}
          </div>
        </div>

        {/* Spouse Section (renders focused person and their spouses side-by-side) */}
        {treeData.spouses.length > 0 && (
          <>
            <VerticalConnector />
            <div className="tree-card">
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0 1.25rem 0' }}>
                <span style={{ color: '#C08375', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {getSectionLabel('spouse')}
                </span>
              </div>
              <div className="card-content row-flex" style={{ flexWrap: 'nowrap', gap: '0.25rem', justifyContent: 'center' }}>
                {/* Selected Person Profile again */}
                <PersonIcon person={treeData.person} isFocused={true} focusedPerson={treeData.person} onFocus={setFocusedPid} onInfo={setSidebarPerson} />
                
                {/* Spouse Profile(s) */}
                {treeData.spouses.map(sp => (
                  <PersonIcon key={sp.pid} person={sp} type="spouse" focusedPerson={treeData.person} onFocus={setFocusedPid} onInfo={setSidebarPerson} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Children Section */}
        {treeData.children.length > 0 && (
          <>
            <VerticalConnector />

            <div className="tree-card spouse-children-card">
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0 1.25rem 0' }}>
                <span style={{ color: '#C08375', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {getSectionLabel('children')}
                </span>
              </div>

              <div className="children-section row-flex wrap">
                {treeData.children.map(c => (
                  <PersonIcon key={c.pid} person={c} type="child" focusedPerson={treeData.person} onFocus={setFocusedPid} onInfo={setSidebarPerson} />
                ))}
              </div>
            </div>
          </>
        )}

      </div>

      {/* Export Action Bar at the bottom */}
      <div className="tree-export-bar" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        backgroundColor: '#FCFAF7',
        border: '1.5px solid var(--color-sandalwood)',
        borderRadius: '12px',
        marginTop: '1.5rem',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--color-maroon)', fontWeight: 'bold' }}>
            🌳 {t('tree.export_title')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleExportPNG}
            disabled={isExporting}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: 'var(--color-maroon)',
              color: 'var(--color-gold)',
              border: 'none',
              borderRadius: '8px',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              fontWeight: '700',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              opacity: isExporting ? 0.7 : 1
            }}
          >
            🖼️ {isExporting ? t('tree.exporting') : t('tree.export_png')}
          </button>
          <button 
            onClick={handlePrintPDF}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: 'var(--color-maroon)',
              color: 'var(--color-gold)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            📄 {t('tree.export_pdf')}
          </button>
        </div>
      </div>

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
