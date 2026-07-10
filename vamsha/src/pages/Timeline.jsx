import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Search, Filter, Eye } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { parseDate } from '../lib/relationshipEngine';

const Timeline = ({ profiles, setFocusedPid }) => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const homePid = localStorage.getItem('vamsha_home_pid') || '';
  const [timelineGenLimit, setTimelineGenLimit] = useState(() => {
    return parseInt(localStorage.getItem('vamsha_timeline_gen_limit') || '6', 10);
  });

  const handleTimelineGenLimitChange = (e) => {
    const limit = parseInt(e.target.value, 10);
    setTimelineGenLimit(limit);
    localStorage.setItem('vamsha_timeline_gen_limit', limit);
  };

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [eventType, setEventType] = useState('all'); // 'all', 'birth', 'death'
  const [selectedDecade, setSelectedDecade] = useState('all'); // 'all' or specific year (e.g. 1980)

  // Calculate age at death helper
  const getAgeAtDeath = (dob, deathDate) => {
    const birth = parseDate(dob);
    const death = parseDate(deathDate);
    if (!birth || !death || isNaN(birth.getTime()) || isNaN(death.getTime())) return null;
    let age = death.getFullYear() - birth.getFullYear();
    const m = death.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && death.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Compile and sort all timeline events
  const allEvents = useMemo(() => {
    // Helper to calculate close family circle within N generations using BFS
    const getPeopleWithinGenerations = (startPid, maxGenerations) => {
      if (!startPid) return null;
      const result = new Set();
      const queue = [{ pid: startPid, depth: 0 }];
      const visited = {}; // pid -> min depth

      while (queue.length > 0) {
        const { pid, depth } = queue.shift();

        if (visited[pid] !== undefined && visited[pid] <= depth) {
          continue;
        }
        visited[pid] = depth;
        result.add(pid);

        const person = profiles.find(p => p.pid === pid);
        if (!person) continue;

        // 1. Spouses (same generation, depth does not change)
        if (person.spouseIds) {
          person.spouseIds.forEach(spId => {
            if (visited[spId] === undefined || visited[spId] > depth) {
              queue.push({ pid: spId, depth });
            }
          });
        }

        // 2. Parents (depth increases by 1)
        if (depth + 1 <= maxGenerations) {
          if (person.fatherId) {
            if (visited[person.fatherId] === undefined || visited[person.fatherId] > depth + 1) {
              queue.push({ pid: person.fatherId, depth: depth + 1 });
            }
          }
          if (person.motherId) {
            if (visited[person.motherId] === undefined || visited[person.motherId] > depth + 1) {
              queue.push({ pid: person.motherId, depth: depth + 1 });
            }
          }
        }

        // 3. Children (depth increases by 1)
        if (depth + 1 <= maxGenerations) {
          const children = profiles.filter(c => c.fatherId === pid || c.motherId === pid);
          children.forEach(c => {
            if (visited[c.pid] === undefined || visited[c.pid] > depth + 1) {
              queue.push({ pid: c.pid, depth: depth + 1 });
            }
          });
        }
      }

      return result;
    };

    const allowedPids = getPeopleWithinGenerations(homePid, timelineGenLimit);
    const events = [];

    profiles.forEach(p => {
      if (allowedPids && !allowedPids.has(p.pid)) return;
      // 1. Birth Event
      if (p.dob) {
        const dB = parseDate(p.dob);
        if (dB && !isNaN(dB.getTime())) {
          events.push({
            id: `${p.pid}_birth`,
            pid: p.pid,
            person: p,
            dateStr: p.dob,
            dateObj: dB,
            year: dB.getFullYear(),
            type: 'birth',
            title: language === 'te' 
              ? `${p.firstName} ${p.surName} జననం` 
              : (language === 'kn' ? `${p.firstName} ${p.surName} ಜನನ` : `Birth of ${p.firstName} ${p.surName}`),
            description: language === 'te' 
              ? `${p.firstName} గారు ఈ రోజున జన్మించారు.` 
              : (language === 'kn' ? `${p.firstName} ಅವರು ಈ ದಿನ ಜನಿಸಿದರು.` : `${p.firstName} was born on this day.`),
          });
        }
      }

      // 2. Death Event
      if (p.isDeceased && p.deathDate) {
        const dD = parseDate(p.deathDate);
        if (dD && !isNaN(dD.getTime())) {
          const age = getAgeAtDeath(p.dob, p.deathDate);
          events.push({
            id: `${p.pid}_death`,
            pid: p.pid,
            person: p,
            dateStr: p.deathDate,
            dateObj: dD,
            year: dD.getFullYear(),
            type: 'death',
            title: language === 'te' 
              ? `${p.firstName} ${p.surName} స్మరణ` 
              : (language === 'kn' ? `${p.firstName} ${p.surName} స్ಮರಣೆ` : `Passing of ${p.firstName} ${p.surName}`),
            description: age 
              ? (language === 'te' ? `${p.firstName} గారు తమ ${age}వ ఏట స్వర్గస్థులయ్యారు.` : (language === 'kn' ? `${p.firstName} ಅವರು ತಮ್ಮ ${age}ನೇ ವಯಸ್ಸಿನಲ್ಲಿ ಸ್ವರ್ಗಸ್ಥರಾದರು.` : `${p.firstName} passed away at the age of ${age}.`))
              : (language === 'te' ? `${p.firstName} గారు స్వర్గస్థులయ్యారు.` : (language === 'kn' ? `${p.firstName} ಅವರು ಸ್ವರ್ಗಸ್ಥರಾದರು.` : `${p.firstName} passed away.`)),
            age: age
          });
        }
      }
    });

    // Sort chronologically (oldest first by default)
    return events.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [profiles, language, homePid, timelineGenLimit]);

  // Extract decades dynamically
  const decades = useMemo(() => {
    const years = allEvents.map(e => e.year);
    if (years.length === 0) return [];
    const minDecade = Math.floor(Math.min(...years) / 10) * 10;
    const maxDecade = Math.floor(Math.max(...years) / 10) * 10;
    const list = [];
    for (let d = minDecade; d <= maxDecade; d += 10) {
      if (years.some(y => y >= d && y < d + 10)) {
        list.push(d);
      }
    }
    return list.sort((a, b) => b - a); // Newest decade first
  }, [allEvents]);

  // Filtered events list
  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      // 1. Search Query
      const fullName = `${e.person.firstName} ${e.person.surName}`.toLowerCase();
      if (searchQuery.trim() !== '' && !fullName.includes(searchQuery.toLowerCase()) && !e.pid.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // 2. Event Type
      if (eventType !== 'all' && e.type !== eventType) {
        return false;
      }

      // 3. Decade
      if (selectedDecade !== 'all') {
        const dec = parseInt(selectedDecade, 10);
        if (e.year < dec || e.year >= dec + 10) {
          return false;
        }
      }

      return true;
    });
  }, [allEvents, searchQuery, eventType, selectedDecade]);

  const handleNavigateToTree = (pid) => {
    if (setFocusedPid) setFocusedPid(pid);
    localStorage.setItem('vamsha_home_pid', pid);
    navigate('/tree');
  };

  return (
    <div style={{ paddingBottom: '5rem' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: '#FFF3F3', border: '1.5px dashed var(--color-maroon)', marginBottom: '1rem' }}>
          <Calendar size={32} style={{ color: 'var(--color-maroon)' }} />
        </div>
        <h2 style={{ color: 'var(--color-maroon)', margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800 }}>
          {t('timeline.title')}
        </h2>
        <p style={{ color: '#666', maxWidth: '600px', margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.5 }}>
          {t('timeline.subtitle')}
        </p>
      </div>

      {/* Interactive Filters Panel */}
      <div style={{
        backgroundColor: '#FCFAF7',
        border: '1.5px solid var(--color-sandalwood)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '2.5rem',
        boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Top Row: Search & Type */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
              <input
                type="text"
                placeholder={t('timeline.filter_search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  borderRadius: '10px',
                  border: '1.5px solid #EFE4DC',
                  outline: 'none',
                  fontSize: '0.92rem',
                  backgroundColor: 'white'
                }}
              />
            </div>

            {/* Generation Limit Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              <label htmlFor="timeline-gen-select" style={{ fontWeight: 700, color: 'var(--color-maroon)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                📖 {t('settings.generation_limit')}:
              </label>
              <select
                id="timeline-gen-select"
                value={timelineGenLimit}
                onChange={handleTimelineGenLimitChange}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  border: '1px solid #EFE4DC',
                  backgroundColor: '#FAF9F6',
                  color: '#333',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(num => (
                  <option key={num} value={num}>
                    {t('settings.birthday_gen_option', { num })}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { code: 'all', name: t('timeline.filter_all') },
                { code: 'birth', name: t('timeline.filter_births') },
                { code: 'death', name: t('timeline.filter_deaths') }
              ].map(opt => (
                <button
                  key={opt.code}
                  onClick={() => setEventType(opt.code)}
                  style={{
                    padding: '0.65rem 1.1rem',
                    borderRadius: '8px',
                    border: eventType === opt.code ? '2px solid var(--color-maroon)' : '1px solid #EFE4DC',
                    backgroundColor: eventType === opt.code ? '#ffffff' : '#FAF9F6',
                    color: eventType === opt.code ? 'var(--color-maroon)' : '#666',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Row: Decade Quick Selector */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={12} /> {t('timeline.decades_all')}
            </div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
              <button
                onClick={() => setSelectedDecade('all')}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '20px',
                  border: selectedDecade === 'all' ? '1.5px solid var(--color-maroon)' : '1px solid #EFE4DC',
                  backgroundColor: selectedDecade === 'all' ? 'var(--color-maroon)' : 'white',
                  color: selectedDecade === 'all' ? 'var(--color-gold)' : '#555',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {t('timeline.filter_all')}
              </button>
              {decades.map(dec => (
                <button
                  key={dec}
                  onClick={() => setSelectedDecade(dec.toString())}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '20px',
                    border: selectedDecade === dec.toString() ? '1.5px solid var(--color-maroon)' : '1px solid #EFE4DC',
                    backgroundColor: selectedDecade === dec.toString() ? 'var(--color-maroon)' : 'white',
                    color: selectedDecade === dec.toString() ? 'var(--color-gold)' : '#555',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {dec}s
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#999', backgroundColor: '#FAF9F6', borderRadius: '16px', border: '1.5px dashed #EFE4DC' }}>
          <p style={{ margin: 0, fontSize: '1rem', fontStyle: 'italic' }}>No events match the selected criteria.</p>
        </div>
      ) : (
        <div className="vertical-timeline-container" style={{ position: 'relative', padding: '2rem 0' }}>
          <style>{`
            .vertical-timeline-container::before {
              content: '';
              position: absolute;
              left: 20px;
              top: 0;
              bottom: 0;
              width: 3px;
              background: linear-gradient(to bottom, #EAD7C3 0%, var(--color-maroon) 50%, #EAD7C3 100%);
            }
            @media (min-width: 768px) {
              .vertical-timeline-container::before {
                left: 50%;
                transform: translateX(-50%);
              }
              .timeline-item-wrapper.timeline-left {
                flex-direction: row !important;
                justify-content: flex-start !important;
                padding-left: 0 !important;
              }
              .timeline-item-wrapper.timeline-right {
                flex-direction: row !important;
                justify-content: flex-end !important;
                padding-left: 0 !important;
              }
              .timeline-card-container {
                width: 45%;
              }
              .timeline-bullet {
                left: 50% !important;
                transform: translateX(-50%) !important;
              }
            }
          `}</style>

          {filteredEvents.map((evt, idx) => {
            const isLeft = evt.type === 'birth';
            const p = evt.person;
            const avatarUrl = p.photoUrl
              ? p.photoUrl
              : `${import.meta.env.BASE_URL}icons/${p.gender === 'Male' ? 'male_icon.png' : 'female_icon.png'}`;

            return (
              <div 
                key={evt.id} 
                className={`timeline-item-wrapper ${isLeft ? 'timeline-left' : 'timeline-right'}`} 
                style={{
                  position: 'relative',
                  marginBottom: '2.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  paddingLeft: '45px'
                }}
              >

                {/* Timeline center bullet */}
                <div 
                  className="timeline-bullet"
                  style={{
                    position: 'absolute',
                    left: '11px',
                    top: '20px',
                    width: '21px',
                    height: '21px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    border: `4px solid ${evt.type === 'birth' ? '#27AE60' : 'var(--color-maroon)'}`,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    zIndex: 3
                  }}
                >
                </div>

                {/* Card Container */}
                <div 
                  className="timeline-card-container"
                  style={{
                    transition: 'transform 0.25s ease'
                  }}
                >
                  <div 
                    className="timeline-card"
                    style={{
                      backgroundColor: 'white',
                      border: '1.5px solid var(--color-sandalwood)',
                      borderRadius: '16px',
                      padding: '1.25rem',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    {/* Event badge (Birth/Remembrance) */}
                    <span style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      fontSize: '0.7rem',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      color: evt.type === 'birth' ? '#27AE60' : 'var(--color-maroon)',
                      backgroundColor: evt.type === 'birth' ? '#E8F8F0' : '#FFF0F0',
                      border: evt.type === 'birth' ? '1px solid #C2F0D5' : '1px solid #FFD0D0',
                      textTransform: 'uppercase'
                    }}>
                      {evt.type === 'birth' ? t('timeline.birth_event') : t('timeline.death_event')}
                    </span>

                    {/* Member Avatar */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img 
                        src={avatarUrl} 
                        alt={p.firstName} 
                        style={{ 
                          width: '60px', 
                          height: '60px', 
                          borderRadius: '50%', 
                          objectFit: 'cover', 
                          border: `2px solid ${p.gender === 'Male' ? '#4A90E2' : '#E91E63'}`,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                        }} 
                      />
                      {p.isDeceased && (
                        <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', fontSize: '0.85rem', background: 'white', borderRadius: '50%', padding: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>🪔</span>
                      )}
                    </div>

                    {/* Event Info */}
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: '1rem', 
                          fontWeight: '800', 
                          color: 'var(--color-maroon)',
                          backgroundColor: '#FFF5EE',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid #F6E6DA'
                        }}>
                          {evt.year}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#999', fontWeight: 600 }}>{evt.dateStr}</span>
                      </div>
                      <h4 style={{ margin: '6px 0 4px', fontSize: '0.98rem', fontWeight: '800', color: '#333', paddingRight: '60px' }}>
                        {evt.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.86rem', color: '#666', lineHeight: 1.4 }}>
                        {evt.description}
                      </p>
                      
                      {/* Nav Button */}
                      <button
                        onClick={() => handleNavigateToTree(p.pid)}
                        style={{
                          marginTop: '8px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-maroon)',
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: 0,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = 0.8}
                        onMouseOut={(e) => e.currentTarget.style.opacity = 1}
                      >
                        <Eye size={12} /> {t('timeline.view_in_tree')}
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default Timeline;
