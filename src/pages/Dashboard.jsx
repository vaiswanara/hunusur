import React, { useState, useMemo } from 'react';
import { 
  Users, BarChart2, Calendar, FileText, ChevronDown, ChevronRight
} from 'lucide-react';
import { parseDate } from '../lib/relationshipEngine';
import { useLanguage } from '../context/LanguageContext';

const Dashboard = ({ profiles }) => {
  const { t } = useLanguage();
  
  // Accordion toggle states for dashboard sections
  const [expandedSection, setExpandedSection] = useState(null); // 'gotram', 'surname', 'generation', 'age', 'astro'
  // Individual items expansion inside sections (e.g. which specific Gotram is open)
  const [expandedItems, setExpandedItems] = useState({});

  const handleToggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleToggleItem = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // -------------------------------------------------------------
  // CALCULATIONS: STATS & GROUPS
  // -------------------------------------------------------------
  
  const totalCount = profiles.length;
  const maleCount = profiles.filter(p => p.gender === 'Male').length;
  const femaleCount = profiles.filter(p => p.gender === 'Female').length;
  const deceasedCount = profiles.filter(p => p.isDeceased).length;
  const livingCount = totalCount - deceasedCount;

  const avgAge = useMemo(() => {
    const today = new Date();
    const livingWithDob = profiles.filter(p => !p.isDeceased && p.dob);
    let totalAge = 0;
    let validCount = 0;
    
    livingWithDob.forEach(p => {
      const bday = parseDate(p.dob);
      if (bday && !isNaN(bday.getTime())) {
        let age = today.getFullYear() - bday.getFullYear();
        const m = today.getMonth() - bday.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) {
          age--;
        }
        if (age >= 0 && age <= 130) {
          totalAge += age;
          validCount++;
        }
      }
    });
    return validCount > 0 ? Math.round(totalAge / validCount) : 0;
  }, [profiles]);

  const gotramData = useMemo(() => {
    const groups = {};
    profiles.forEach(p => {
      const g = p.gotram ? p.gotram.trim() : 'Not Specified';
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });
    return Object.entries(groups)
      .map(([name, list]) => ({ name, list, count: list.length }))
      .sort((a, b) => b.count - a.count);
  }, [profiles]);

  const surnameData = useMemo(() => {
    const groups = {};
    profiles.forEach(p => {
      const s = p.surName ? p.surName.trim() : 'Not Specified';
      if (!groups[s]) groups[s] = [];
      groups[s].push(p);
    });
    return Object.entries(groups)
      .map(([name, list]) => ({ name, list, count: list.length }))
      .sort((a, b) => b.count - a.count);
  }, [profiles]);

  const generationData = useMemo(() => {
    if (profiles.length === 0) return [];
    
    // Find absolute levels by following parents up
    const visited = new Set();
    const genMap = {}; // pid -> level (1-indexed)

    // BFS to assign generation levels from root downwards
    const queue = [];
    profiles.forEach(p => {
      if (!p.fatherId && !p.motherId) {
        genMap[p.pid] = 1;
        visited.add(p.pid);
        queue.push(p.pid);
      }
    });

    while (queue.length > 0) {
      const currPid = queue.shift();
      const currLevel = genMap[currPid];

      const children = profiles.filter(c => c.fatherId === currPid || c.motherId === currPid);
      children.forEach(child => {
        if (!visited.has(child.pid)) {
          const existingLevel = genMap[child.pid] || 0;
          genMap[child.pid] = Math.max(existingLevel, currLevel + 1);
          visited.add(child.pid);
          queue.push(child.pid);
        }
      });
    }

    profiles.forEach(p => {
      if (!genMap[p.pid]) {
        genMap[p.pid] = 1;
      }
    });

    const groups = {};
    profiles.forEach(p => {
      const lvl = genMap[p.pid];
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(p);
    });

    return Object.entries(groups)
      .map(([level, list]) => ({ level: parseInt(level), list, count: list.length }))
      .sort((a, b) => a.level - b.level);
  }, [profiles]);

  const ageData = useMemo(() => {
    const today = new Date();
    const brackets = {
      'Children (0-12 yrs)': [],
      'Youth (13-29 yrs)': [],
      'Adults (30-59 yrs)': [],
      'Seniors (60+ yrs)': [],
      'Unknown DOB / Deceased': []
    };

    profiles.forEach(p => {
      if (p.isDeceased) {
        brackets['Unknown DOB / Deceased'].push(p);
        return;
      }
      
      const dobDate = parseDate(p.dob);
      if (!dobDate || isNaN(dobDate.getTime())) {
        brackets['Unknown DOB / Deceased'].push(p);
        return;
      }

      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }

      if (age <= 12) {
        brackets['Children (0-12 yrs)'].push(p);
      } else if (age <= 29) {
        brackets['Youth (13-29 yrs)'].push(p);
      } else if (age <= 59) {
        brackets['Adults (30-59 yrs)'].push(p);
      } else {
        brackets['Seniors (60+ yrs)'].push(p);
      }
    });

    return Object.entries(brackets).map(([name, list]) => ({ name, list, count: list.length }));
  }, [profiles]);

  const astroData = useMemo(() => {
    const rashiGroups = {};
    const nakshatraGroups = {};

    profiles.forEach(p => {
      if (p.rashi) {
        const r = p.rashi.split(' (')[0].trim();
        if (!rashiGroups[r]) rashiGroups[r] = [];
        rashiGroups[r].push(p);
      }
      if (p.nakshatra) {
        const n = p.nakshatra.split(' (')[0].trim();
        if (!nakshatraGroups[n]) nakshatraGroups[n] = [];
        nakshatraGroups[n].push(p);
      }
    });

    const rashis = Object.entries(rashiGroups)
      .map(([name, list]) => ({ name, list, count: list.length }))
      .sort((a, b) => b.count - a.count);

    const nakshatras = Object.entries(nakshatraGroups)
      .map(([name, list]) => ({ name, list, count: list.length }))
      .sort((a, b) => b.count - a.count);

    return { rashis, nakshatras };
  }, [profiles]);

  return (
    <div style={{ paddingBottom: '3rem' }}>
      <style>{`
        .dash-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-bottom: 2.5rem;
        }
        .dash-stat-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.05);
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .dash-stat-icon-wrapper {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: var(--color-light);
          color: var(--color-maroon);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dash-stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-dark);
          line-height: 1.1;
        }
        .dash-stat-label {
          font-size: 0.82rem;
          color: #777;
          font-weight: 600;
          margin-top: 0.2rem;
        }
        .report-accordion {
          margin-bottom: 1rem;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.02);
          border: 1px solid rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .accordion-header {
          padding: 1.25rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
          background-color: #ffffff;
          transition: background-color 0.2s;
        }
        .accordion-header:hover {
          background-color: #FAF9F6;
        }
        .accordion-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-maroon);
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .accordion-content {
          border-top: 1px solid #f9f9f9;
          padding: 1.5rem;
          background-color: #FCFAF7;
        }
        .accordion-grid-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0.75rem;
        }
        .accordion-group-item {
          border: 1px solid #eae5dc;
          border-radius: 6px;
          background: #ffffff;
          overflow: hidden;
        }
        .group-header {
          padding: 0.6rem 1rem;
          background: #fbf9f6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.92rem;
          border-bottom: 1px solid #f4eade;
        }
        .group-member-list {
          padding: 0.5rem 1rem;
          max-height: 200px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-size: 0.85rem;
        }
      `}</style>

      {/* Main Title Section */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--color-maroon)', fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
          {t('reports.tab_stats')}
        </h2>
        <p style={{ color: '#666', fontSize: '0.95rem', margin: 0 }}>
          {t('reports.subtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="dash-stats-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrapper"><Users size={24} /></div>
          <div>
            <div className="dash-stat-value">{totalCount}</div>
            <div className="dash-stat-label">{t('reports.total_members')}</div>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrapper" style={{ color: '#4A90E2' }}><Users size={24} /></div>
          <div>
            <div className="dash-stat-value">{maleCount} <span style={{ fontSize: '0.85rem', color: '#777', fontWeight: 500 }}>({totalCount > 0 ? Math.round((maleCount/totalCount)*100) : 0}%)</span></div>
            <div className="dash-stat-label">{t('reports.males')}</div>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrapper" style={{ color: '#E91E63' }}><Users size={24} /></div>
          <div>
            <div className="dash-stat-value">{femaleCount} <span style={{ fontSize: '0.85rem', color: '#777', fontWeight: 500 }}>({totalCount > 0 ? Math.round((femaleCount/totalCount)*100) : 0}%)</span></div>
            <div className="dash-stat-label">{t('reports.females')}</div>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrapper" style={{ color: '#c0392b' }}><Users size={24} /></div>
          <div>
            <div className="dash-stat-value">{deceasedCount} <span style={{ fontSize: '0.85rem', color: '#777', fontWeight: 500 }}>({totalCount > 0 ? Math.round((deceasedCount/totalCount)*100) : 0}%)</span></div>
            <div className="dash-stat-label">{t('reports.deceased')}</div>
          </div>
        </div>
        
        <div className="dash-stat-card" style={{ gridColumn: 'span 1' }}>
          <div className="dash-stat-icon-wrapper" style={{ color: '#27ae60' }}><Calendar size={24} /></div>
          <div>
            <div className="dash-stat-value">{avgAge} {t('reports.years')}</div>
            <div className="dash-stat-label">{t('reports.avg_age')}</div>
          </div>
        </div>
      </div>

      {/* Visual Overview Section */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
        border: '1px solid rgba(0,0,0,0.05)',
        marginBottom: '2rem'
      }}>
        <div className="dash-visual-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
          
          {/* 1. Gender Ratio Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#FCFAF7', borderRadius: '12px', border: '1px solid #F0E8E0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-maroon)', margin: 0 }}>
              👥 {t('reports.gender_ratio')}
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666', fontWeight: 600 }}>
              <span style={{ color: '#4A90E2' }}>{t('reports.males')}: {maleCount} ({totalCount > 0 ? Math.round((maleCount/totalCount)*100) : 0}%)</span>
              <span style={{ color: '#E91E63' }}>{t('reports.females')}: {femaleCount} ({totalCount > 0 ? Math.round((femaleCount/totalCount)*100) : 0}%)</span>
            </div>
            <div style={{ height: '16px', borderRadius: '8px', background: '#eaeaea', overflow: 'hidden', display: 'flex', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ width: totalCount > 0 ? `${(maleCount/totalCount)*100}%` : '0%', background: '#4A90E2', height: '100%', transition: 'width 0.6s ease' }} title="Males" />
              <div style={{ width: totalCount > 0 ? `${(femaleCount/totalCount)*100}%` : '0%', background: '#E91E63', height: '100%', transition: 'width 0.6s ease' }} title="Females" />
            </div>
          </div>

          {/* 2. Top Gotrams Bar Graph */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#FCFAF7', borderRadius: '12px', border: '1px solid #F0E8E0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-maroon)', margin: 0 }}>
              🔱 {t('reports.top_gotrams')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {gotramData.slice(0, 3).map(g => {
                const pct = totalCount > 0 ? Math.round((g.count / totalCount) * 100) : 0;
                return (
                  <div key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span style={{ color: '#555' }}>{g.name}</span>
                      <span style={{ color: 'var(--color-maroon)' }}>{g.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: '#EAEAEA', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, background: 'var(--color-gold, #D4AF37)', height: '100%', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Top Surnames Bar Graph */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#FCFAF7', borderRadius: '12px', border: '1px solid #F0E8E0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-maroon)', margin: 0 }}>
              🏡 {t('reports.top_surnames')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {surnameData.slice(0, 3).map(s => {
                const pct = totalCount > 0 ? Math.round((s.count / totalCount) * 100) : 0;
                return (
                  <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span style={{ color: '#555' }}>{s.name}</span>
                      <span style={{ color: 'var(--color-maroon)' }}>{s.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: '#EAEAEA', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, background: 'var(--color-maroon, #63131D)', height: '100%', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Age Demographics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: '#FCFAF7', borderRadius: '12px', border: '1px solid #F0E8E0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-maroon)', margin: 0 }}>
              ⏳ {t('reports.age_demographics')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {ageData.map(group => {
                if (group.name === 'Unknown DOB / Deceased') return null;
                const pct = totalCount > 0 ? Math.round((group.count / totalCount) * 100) : 0;
                return (
                  <div key={group.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span style={{ color: '#555' }}>{group.name}</span>
                      <span style={{ color: 'var(--color-maroon)' }}>{group.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: '#EAEAEA', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, background: '#27ae60', height: '100%', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Accordion List */}
      
      {/* Gotram Accordion */}
      <div className="report-accordion">
        <div className="accordion-header" onClick={() => handleToggleSection('gotram')}>
          <div className="accordion-title">
            <FileText size={20} />
            {t('reports.gotram_dist')} ({gotramData.length} Gotrams)
          </div>
          <ChevronDown size={20} style={{ transform: expandedSection === 'gotram' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
        {expandedSection === 'gotram' && (
          <div className="accordion-content">
            <div className="accordion-grid-list">
              {gotramData.map(group => (
                <div className="accordion-group-item" key={group.name}>
                  <div className="group-header" onClick={() => handleToggleItem(`gotram-${group.name}`)}>
                    <span>{group.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                      <ChevronDown size={14} style={{ transform: expandedItems[`gotram-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                    </div>
                  </div>
                  {expandedItems[`gotram-${group.name}`] && (
                    <div className="group-member-list">
                      {group.list.map(p => (
                        <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                          <span>{p.firstName} {p.surName}</span>
                          <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Surname Accordion */}
      <div className="report-accordion">
        <div className="accordion-header" onClick={() => handleToggleSection('surname')}>
          <div className="accordion-title">
            <FileText size={20} />
            {t('reports.surname_dist')} ({surnameData.length} Surnames)
          </div>
          <ChevronDown size={20} style={{ transform: expandedSection === 'surname' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
        {expandedSection === 'surname' && (
          <div className="accordion-content">
            <div className="accordion-grid-list">
              {surnameData.map(group => (
                <div className="accordion-group-item" key={group.name}>
                  <div className="group-header" onClick={() => handleToggleItem(`surname-${group.name}`)}>
                    <span>{group.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                      <ChevronDown size={14} style={{ transform: expandedItems[`surname-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                    </div>
                  </div>
                  {expandedItems[`surname-${group.name}`] && (
                    <div className="group-member-list">
                      {group.list.map(p => (
                        <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                          <span>{p.firstName} {p.surName}</span>
                          <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generation Accordion */}
      <div className="report-accordion">
        <div className="accordion-header" onClick={() => handleToggleSection('generation')}>
          <div className="accordion-title">
            <GitBranch size={20} />
            {t('reports.gen_dist')} ({generationData.length} Generations)
          </div>
          <ChevronDown size={20} style={{ transform: expandedSection === 'generation' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
        {expandedSection === 'generation' && (
          <div className="accordion-content">
            <div className="accordion-grid-list">
              {generationData.map(group => (
                <div className="accordion-group-item" key={group.level}>
                  <div className="group-header" onClick={() => handleToggleItem(`gen-${group.level}`)}>
                    <span>{t('reports.generation')} {group.level}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                      <ChevronDown size={14} style={{ transform: expandedItems[`gen-${group.level}`] ? 'rotate(180deg)' : 'none' }} />
                    </div>
                  </div>
                  {expandedItems[`gen-${group.level}`] && (
                    <div className="group-member-list">
                      {group.list.map(p => (
                        <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                          <span>{p.firstName} {p.surName}</span>
                          <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Age Demographics Accordion */}
      <div className="report-accordion">
        <div className="accordion-header" onClick={() => handleToggleSection('age')}>
          <div className="accordion-title">
            <Calendar size={20} />
            {t('reports.age_demographics')}
          </div>
          <ChevronDown size={20} style={{ transform: expandedSection === 'age' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
        {expandedSection === 'age' && (
          <div className="accordion-content">
            <div className="accordion-grid-list">
              {ageData.map(group => (
                <div className="accordion-group-item" key={group.name}>
                  <div className="group-header" onClick={() => handleToggleItem(`age-${group.name}`)}>
                    <span>{group.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                      <ChevronDown size={14} style={{ transform: expandedItems[`age-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                    </div>
                  </div>
                  {expandedItems[`age-${group.name}`] && (
                    <div className="group-member-list">
                      {group.list.map(p => (
                        <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                          <span>{p.firstName} {p.surName} {p.dob ? `(${p.dob})` : ''}</span>
                          <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Astrological Accordion */}
      <div className="report-accordion">
        <div className="accordion-header" onClick={() => handleToggleSection('astro')}>
          <div className="accordion-title">
            <Calendar size={20} />
            {t('reports.astro_dist')}
          </div>
          <ChevronDown size={20} style={{ transform: expandedSection === 'astro' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
        {expandedSection === 'astro' && (
          <div className="accordion-content">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '2rem' }}>
              
              {/* Rashis */}
              <div>
                <h4 style={{ color: 'var(--color-maroon)', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.3rem' }}>Rashi Details</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {astroData.rashis.map(group => (
                    <div className="accordion-group-item" key={group.name}>
                      <div className="group-header" onClick={() => handleToggleItem(`rashi-${group.name}`)}>
                        <span>{group.name} Rashi</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                          <ChevronDown size={14} style={{ transform: expandedItems[`rashi-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                        </div>
                      </div>
                      {expandedItems[`rashi-${group.name}`] && (
                        <div className="group-member-list">
                          {group.list.map(p => (
                            <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                              <span>{p.firstName} {p.surName}</span>
                              <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Nakshatras */}
              <div>
                <h4 style={{ color: 'var(--color-maroon)', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.3rem' }}>Nakshatra Details</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {astroData.nakshatras.map(group => (
                    <div className="accordion-group-item" key={group.name}>
                      <div className="group-header" onClick={() => handleToggleItem(`nak-${group.name}`)}>
                        <span>{group.name} Nakshatram</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', background: '#eaeaea', padding: '2px 8px', borderRadius: '20px' }}>{group.count}</span>
                          <ChevronDown size={14} style={{ transform: expandedItems[`nak-${group.name}`] ? 'rotate(180deg)' : 'none' }} />
                        </div>
                      </div>
                      {expandedItems[`nak-${group.name}`] && (
                        <div className="group-member-list">
                          {group.list.map(p => (
                            <div key={p.pid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f9f9f9', padding: '2px 0' }}>
                              <span>{p.firstName} {p.surName}</span>
                              <span style={{ color: '#999', fontSize: '0.75rem' }}>{p.pid}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
