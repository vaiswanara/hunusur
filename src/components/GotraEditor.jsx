import React, { useState, useEffect } from 'react';
import { Save, GitBranch, Search, HelpCircle } from 'lucide-react';

const COMMON_GOTRAMS = [
  'Koundinya',
  'Srivatsa',
  'Bharadwaja',
  'Harithasa',
  'Kashyapa',
  'Gautama',
  'Vasishtha',
  'Shandilya',
  'Atreya',
  'Viswamitra',
  'Gargya',
  'Shatamarshana',
  'Mudgala',
  'Lohitasa'
];

const GotraEditor = ({ profiles, setProfiles }) => {
  const [editedGotrams, setEditedGotrams] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Find all male root ancestors (males without a father in the database)
  const getRootAncestors = () => {
    return profiles.filter(p => {
      if (p.gender !== 'Male') return false;
      if (!p.fatherId) return true;
      const fatherExists = profiles.some(f => f.pid === p.fatherId);
      return !fatherExists;
    });
  };

  // Trace the root ancestor of any person's birth line
  const getBirthLineageRoot = (person) => {
    let current = person;
    const visited = new Set();
    while (current && current.fatherId) {
      if (visited.has(current.pid)) break;
      visited.add(current.pid);
      const father = profiles.find(f => f.pid === current.fatherId);
      if (!father) break;
      current = father;
    }
    return current;
  };

  // Count how many people share/inherit this root ancestor's gotram (current or maiden)
  const getLineageCount = (rootPid) => {
    return profiles.filter(p => {
      if (p.gender === 'Female') {
        const husband = profiles.find(h => p.spouseIds && p.spouseIds.includes(h.pid) && h.gender === 'Male');
        if (husband) {
          const husbandRoot = getBirthLineageRoot(husband);
          if (husbandRoot && husbandRoot.pid === rootPid) return true;
        }
      }
      const pRoot = getBirthLineageRoot(p);
      return pRoot && pRoot.pid === rootPid;
    }).length;
  };

  const rootAncestors = getRootAncestors();

  // Initialize editedGotrams state
  useEffect(() => {
    const initial = {};
    rootAncestors.forEach(r => {
      initial[r.pid] = r.gotram || '';
    });
    setEditedGotrams(initial);
  }, [profiles]);

  const handleInputChange = (pid, val) => {
    setEditedGotrams(prev => ({ ...prev, [pid]: val }));
  };

  const handleSave = () => {
    const updatedProfiles = profiles.map(p => {
      if (editedGotrams[p.pid] !== undefined) {
        // Strip whitespace
        const val = editedGotrams[p.pid].trim();
        if (val) {
          return { ...p, gotram: val };
        } else {
          // If cleared, remove gotram field from raw profile
          const { gotram, ...rest } = p;
          return rest;
        }
      }
      return p;
    });

    setProfiles(updatedProfiles);
    alert('✅ Lineage Gotrams updated in session! Click "Save to Server" at the top to write changes permanently.');
  };

  // Filter root ancestors by search term
  const filteredAncestors = rootAncestors.filter(r => {
    const fullName = `${r.firstName} ${r.surName}`.toLowerCase();
    const gotra = (editedGotrams[r.pid] || '').toLowerCase();
    const pid = r.pid.toLowerCase();
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || gotra.includes(term) || pid.includes(term);
  });

  return (
    <div className="card" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem' }}>
      <style>{`
        .gotra-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0;
        }
        .gotra-table th {
          background-color: #F1EBE4;
          color: var(--color-maroon, #63131D);
          text-align: left;
          padding: 0.75rem 1rem;
          font-weight: 700;
          font-size: 0.85rem;
          text-transform: uppercase;
          border-bottom: 2px solid var(--color-sandalwood, #EADDCA);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .gotra-table td {
          padding: 1rem;
          border-bottom: 1px solid #EEE;
          vertical-align: middle;
          font-size: 0.95rem;
        }
        .gotra-table tr:hover {
          background-color: #FAF8F5;
        }
        .gotra-input {
          width: 100%;
          padding: 0.6rem;
          border: 1px solid #ddd;
          borderRadius: 6px;
          height: 40px;
          box-sizing: border-box;
          font-size: 0.95rem;
        }
        .gotra-input:focus {
          border-color: var(--color-maroon, #63131D);
          outline: none;
        }
        .lineage-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.25rem 0.6rem;
          background-color: #EFE4DC;
          color: var(--color-maroon, #63131D);
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }
      `}</style>

      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ color: 'var(--color-maroon)', fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <GitBranch size={24} /> Lineage Gotrams
        </h3>
        <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Save size={16} /> Save Gotrams
        </button>
      </div>

      {/* Info Explanation Card */}
      <div style={{
        backgroundColor: '#F7F9FC',
        border: '1px solid #DDE3EA',
        padding: '1rem 1.25rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start'
      }}>
        <HelpCircle size={20} style={{ color: '#4A90E2', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.88rem', color: '#555', lineHeight: 1.5 }}>
          <strong>How Gotram inheritance works:</strong> In Hindu traditions, children inherit their father's gotram. When a woman marries, her gotram changes to her husband's gotram, and her birth gotram becomes her maiden gotram.
          <br />
          <span style={{ color: 'var(--color-maroon, #63131D)', fontWeight: 600 }}>By setting the gotram of the root ancestors (mula purushulu) below, their entire lineage (all descendants) will automatically inherit the gotram on the fly. No need to edit every person individually!</span>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
        <input
          type="text"
          placeholder="Search by ancestor name, PID, or gotram..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.5rem', border: '1px solid #ddd', borderRadius: '8px', height: '42px', boxSizing: 'border-box' }}
        />
      </div>

      {filteredAncestors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999', backgroundColor: '#FAFAFA', borderRadius: '8px', border: '1px dashed #DDD' }}>
          <GitBranch size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No matching root ancestors found.</p>
        </div>
      ) : (
        <div style={{
          maxHeight: '480px',
          overflowY: 'auto',
          border: '1px solid var(--color-sandalwood, #EADDCA)',
          borderRadius: '8px',
          backgroundColor: '#FAF8F5',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <table className="gotra-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>PID</th>
                <th>Root Ancestor</th>
                <th style={{ width: '160px' }}>Lineage Size</th>
                <th style={{ width: '300px' }}>Gotram</th>
              </tr>
            </thead>
            <tbody>
              {filteredAncestors.map(r => {
                const count = getLineageCount(r.pid);
                return (
                  <tr key={r.pid}>
                    <td style={{ fontWeight: 600, color: '#666' }}>{r.pid}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#333' }}>
                        {r.firstName} {r.surName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#999' }}>
                        {r.gender} • {r.isDeceased ? 'Deceased' : 'Alive'}
                      </div>
                    </td>
                    <td>
                      <span className="lineage-badge">
                        <GitBranch size={12} /> {count} members
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        list="gotram-list"
                        className="gotra-input"
                        placeholder="Select or type Gotram"
                        value={editedGotrams[r.pid] || ''}
                        onChange={e => handleInputChange(r.pid, e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <datalist id="gotram-list">
        {COMMON_GOTRAMS.map(g => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </div>
  );
};

export default GotraEditor;
