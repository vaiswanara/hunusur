import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Cake, Mail } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const Birthdays = ({ profiles }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const homePid = localStorage.getItem('vamsha_home_pid') || '';
  const [bdayGenLimit, setBdayGenLimit] = useState(() => {
    return parseInt(localStorage.getItem('vamsha_birthday_gen_limit') || '6', 10);
  });

  const handleBdayGenLimitChange = (e) => {
    const limit = parseInt(e.target.value, 10);
    setBdayGenLimit(limit);
    localStorage.setItem('vamsha_birthday_gen_limit', limit);
  };

  const upcomingBirthdays = useMemo(() => {
    if (!homePid) return [];

    // Helper to calculate close family circle within N generations using BFS
    const getPeopleWithinGenerations = (startPid, maxGenerations) => {
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

    const allowedPids = getPeopleWithinGenerations(homePid, bdayGenLimit);

    // Current date and year
    const today = new Date();
    const currentYear = today.getFullYear();

    // Sort profiles that have a birthdate and are not deceased
    const birthdayList = [];

    profiles.forEach(person => {
      if (!allowedPids.has(person.pid)) return;
      if (!person.dob || person.isDeceased) return;

      const dobParts = person.dob.split('-');
      if (dobParts.length !== 3) return;

      const birthYear = parseInt(dobParts[0], 10);
      const birthMonth = parseInt(dobParts[1], 10) - 1; // 0-indexed
      const birthDay = parseInt(dobParts[2], 10);

      // Birthday in the current year
      const bdayThisYear = new Date(currentYear, birthMonth, birthDay);

      // Calculate age they will turn this year
      const age = currentYear - birthYear;

      // Difference in days between today and the birthday
      // Clear time components for exact day difference
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      let diffTime = bdayThisYear.getTime() - todayDate.getTime();
      let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Handle cases where birthday has already passed this year:
      // If it has passed, check if it's within the next year's 15-day range
      if (diffDays < 0) {
        const bdayNextYear = new Date(currentYear + 1, birthMonth, birthDay);
        diffTime = bdayNextYear.getTime() - todayDate.getTime();
        diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // If it falls within 15 days (next year's early birthdays)
        if (diffDays >= 0 && diffDays <= 15) {
          birthdayList.push({
            person,
            date: bdayNextYear,
            age: age + 1,
            diffDays
          });
        }
      } else if (diffDays <= 15) {
        birthdayList.push({
          person,
          date: bdayThisYear,
          age,
          diffDays
        });
      }
    });

    // Sort by chronological order (nearest first)
    return birthdayList.sort((a, b) => a.diffDays - b.diffDays);
  }, [profiles, homePid, bdayGenLimit]);

  const formatDateDisplay = (dateObj) => {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    const weekday = WEEKDAYS[dateObj.getDay()];
    return `${day}-${month}-${year} ${weekday}`;
  };

  if (!homePid) {
    return (
      <div className="card" style={{ padding: '3rem 2rem', borderRadius: '12px', marginBottom: '2rem', textAlign: 'center', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Cake size={56} style={{ color: 'var(--color-maroon)', opacity: 0.25, marginBottom: '1.5rem' }} />
        <h3 style={{ color: 'var(--color-maroon)', fontSize: '1.5rem', margin: '0 0 0.75rem' }}>
          {t('birthdays.title')}
        </h3>
        <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6, maxWidth: '480px' }}>
          {t('birthdays.no_home_person')}
        </p>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/home-person')}
          style={{ padding: '0.75rem 2rem', fontSize: '0.95rem' }}
        >
          {t('birthdays.set_home_btn')}
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem', minHeight: '400px' }}>
      <style>{`
        .birthday-item-card {
          border-left: 5px solid var(--color-gold);
          padding: 1.25rem 1.5rem;
          background-color: #FAF8F5;
          border-radius: 0 12px 12px 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.25rem;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          border-top: 1px solid #EFE4DC;
          border-right: 1px solid #EFE4DC;
          border-bottom: 1px solid #EFE4DC;
        }
        .birthday-item-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(99, 19, 29, 0.08);
          border-color: var(--color-gold);
          background-color: #ffffff;
        }
        .birthday-avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #EFE4DC;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        }
        .birthday-avatar.gender-Male {
          border-color: #7BAFF8;
        }
        .birthday-avatar.gender-Female {
          border-color: #F5A3B1;
        }
        .countdown-pill {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .countdown-pill.today {
          background-color: #FDEDEC;
          color: #C0392B;
          border: 1px solid #FADBD8;
          animation: pulseText 1.5s infinite ease-in-out;
        }
        .countdown-pill.tomorrow {
          background-color: #FEF9E7;
          color: #D35400;
          border: 1px solid #FCF3CF;
        }
        .countdown-pill.days-left {
          background-color: #EFE4DC;
          color: #5D5D5D;
          border: 1px solid #E5D5C9;
        }
        @keyframes pulseText {
          0% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.03); }
          100% { opacity: 0.85; transform: scale(1); }
        }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Cake size={28} style={{ color: 'var(--color-maroon)' }} />
          <h3 style={{ color: 'var(--color-maroon)', fontSize: '1.6rem', margin: 0 }}>
            {t('birthdays.title')}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
          <label htmlFor="bday-gen-select" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            🎂 {t('settings.birthday_gen_limit')}:
          </label>
          <select
            id="bday-gen-select"
            value={bdayGenLimit}
            onChange={handleBdayGenLimitChange}
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
      </div>

      <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.5 }}>
        {t('birthdays.desc')}
      </p>

      {upcomingBirthdays.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#999', backgroundColor: '#FAFAFA', borderRadius: '8px', border: '1px dashed #DDD' }}>
          <Calendar size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>{t('birthdays.no_birthdays')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
          {upcomingBirthdays.map(({ person, date, age, diffDays }) => {
            const cleanPhone = person.phone ? person.phone.replace(/\D/g, '') : '';
            const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
            const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(t('birthdays.whatsapp_wish_msg', { name: person.firstName }))}`;
            const mailUrl = `mailto:${person.email}?subject=${encodeURIComponent(t('birthdays.email_wish_subj'))}&body=${encodeURIComponent(t('birthdays.whatsapp_wish_msg', { name: person.firstName }))}`;

            const avatarSrc = person.photoUrl
              ? person.photoUrl
              : `${import.meta.env.BASE_URL}icons/${person.gender === 'Male' ? 'male_icon.png' : 'female_icon.png'}`;

            const astroStr = [person.nakshatra, person.rashi].filter(Boolean).join(' | ');

            return (
              <div key={person.pid} className="birthday-item-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: '240px' }}>
                  {/* Circular Avatar with Gender Border */}
                  <img 
                    src={avatarSrc} 
                    alt={person.firstName} 
                    className={`birthday-avatar gender-${person.gender}`} 
                  />

                  <div style={{ flex: 1 }}>
                    {/* Date and Countdown Pill Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-maroon)', letterSpacing: '0.04em' }}>
                        {formatDateDisplay(date)}
                      </span>
                      
                      {diffDays === 0 && (
                        <span className="countdown-pill today">
                          🎉 {t('birthdays.today')}
                        </span>
                      )}
                      {diffDays === 1 && (
                        <span className="countdown-pill tomorrow">
                          ⏳ {t('birthdays.tomorrow')}
                        </span>
                      )}
                      {diffDays > 1 && (
                        <span className="countdown-pill days-left">
                          🗓️ {t('birthdays.days_left', { days: diffDays })}
                        </span>
                      )}
                    </div>

                    {/* Name and Age */}
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-dark)', textTransform: 'uppercase', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span>{person.firstName} {person.surName}</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#888', textTransform: 'none' }}>
                        ({t('birthdays.turning', { age }).replace('turning ', '')})
                      </span>
                    </div>

                    {/* Astrological details */}
                    {astroStr && (
                      <div style={{ fontSize: '0.78rem', color: '#8C6A53', fontWeight: 600, marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ✨ {astroStr}
                      </div>
                    )}

                    {/* Phone details */}
                    {person.phone && (
                      <div style={{ fontSize: '0.82rem', color: '#555', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        📞 {person.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Communication Icons */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {person.phone && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#25D366',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                        transition: 'transform 0.2s ease',
                        textDecoration: 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      title="Send WhatsApp Wish"
                    >
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                        <path d="M12.031 6c-3.302 0-6 2.698-6 6 0 1.258.39 2.422 1.045 3.393L6.035 18l2.678-1.018a5.957 5.957 0 0 0 3.318 1.018c3.302 0 6-2.698 6-6s-2.698-6-6-6zm3.729 8.411c-.13.364-.67.704-1.07.754-.37.05-.85.08-1.39-.1-.66-.22-1.39-.56-2.01-1.07-.63-.51-1.12-1.12-1.46-1.74-.26-.47-.46-.99-.48-1.44-.03-.59.19-1.01.41-1.25.13-.14.28-.21.43-.21.12 0 .23.01.31.06.14.09.31.39.38.54.08.17.15.35.21.52.06.17.06.33-.03.49-.09.17-.21.28-.31.39-.1.1-.21.22-.11.41.21.39.46.74.8 1.03.35.31.75.56 1.18.73.19.08.38.07.49-.05.15-.17.38-.45.54-.67.14-.19.33-.16.51-.09.19.07 1.18.55 1.25.62.08.08.14.15.11.31z" />
                      </svg>
                    </a>
                  )}
                  {person.email && (
                    <a
                      href={mailUrl}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-maroon, #63131D)',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(99, 19, 29, 0.25)',
                        transition: 'transform 0.2s ease',
                        textDecoration: 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      title="Send Email Wish"
                    >
                      <Mail size={20} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Birthdays;
