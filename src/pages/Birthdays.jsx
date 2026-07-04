import React, { useMemo } from 'react';
import { Calendar, Cake } from 'lucide-react';

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const Birthdays = ({ profiles }) => {
  const upcomingBirthdays = useMemo(() => {
    // Current date and year
    const today = new Date();
    const currentYear = today.getFullYear();

    // Sort profiles that have a birthdate and are not deceased
    const birthdayList = [];

    profiles.forEach(person => {
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
      // If it has passed, check if it's within the next year's 15-day range (e.g. if today is Dec 30, Jan 3 is in next year)
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
  }, [profiles]);

  const formatDateDisplay = (dateObj) => {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    const weekday = WEEKDAYS[dateObj.getDay()];
    return `${day}-${month}-${year} ${weekday}`;
  };

  return (
    <div className="card" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem', minHeight: '400px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '1rem' }}>
        <Cake size={28} style={{ color: 'var(--color-maroon)' }} />
        <h3 style={{ color: 'var(--color-maroon)', fontSize: '1.6rem', margin: 0 }}>
          Upcoming Birthdays
        </h3>
      </div>

      <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.5 }}>
        List of family members celebrating their birthdays in the next 15 days.
      </p>

      {upcomingBirthdays.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#999', backgroundColor: '#FAFAFA', borderRadius: '8px', border: '1px dashed #DDD' }}>
          <Calendar size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>No upcoming birthdays in the next 15 days.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
          {upcomingBirthdays.map(({ person, date, age }, idx) => (
            <div
              key={person.pid}
              style={{
                borderLeft: '5px solid var(--color-gold)',
                padding: '1.25rem 1.5rem',
                backgroundColor: '#FAF8F5',
                borderRadius: '0 8px 8px 0',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                {/* Date Display */}
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-maroon)', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  {formatDateDisplay(date)}
                </div>
                {/* Person details */}
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-dark)', textTransform: 'uppercase' }}>
                  {person.firstName} {person.surName} <span style={{ fontWeight: 500, color: '#666', textTransform: 'none' }}>({age})</span>
                </div>
              </div>
              <div style={{ fontSize: '2rem', opacity: 0.2 }}>🎂</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Birthdays;
