import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Moon } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu',
  'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta',
  'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purvashadha',
  'Uttarashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada',
  'Uttara Bhadrapada', 'Revati'
];

const RASHIS = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'
];

const JyotishaEditor = ({ profiles, setProfiles }) => {
  const [jyotishaMappings, setJyotishaMappings] = useState([]);

  // Extracts English part if profile has old format (e.g. "Anuradha (అనురాధ)" -> "Anuradha")
  const sanitizeName = (str) => {
    if (!str) return '';
    return str.split(' (')[0].trim();
  };

  // Initialize from profiles
  useEffect(() => {
    const existing = profiles
      .filter(p => p.nakshatra || p.rashi)
      .map(p => ({
        pid: p.pid,
        nakshatra: sanitizeName(p.nakshatra),
        rashi: sanitizeName(p.rashi)
      }));
    setJyotishaMappings(existing);
  }, [profiles]);

  const addMapping = () => {
    setJyotishaMappings([...jyotishaMappings, { pid: '', nakshatra: '', rashi: '' }]);
  };

  const updateMapping = (index, field, value) => {
    const updated = [...jyotishaMappings];
    updated[index][field] = value;
    setJyotishaMappings(updated);
  };

  const removeMapping = (index) => {
    setJyotishaMappings(jyotishaMappings.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    const pids = jyotishaMappings.map(m => m.pid).filter(Boolean);
    const hasDuplicates = pids.length !== new Set(pids).size;
    if (hasDuplicates) {
      alert('❌ Error: You have selected the same person multiple times. Please combine them.');
      return;
    }

    const updatedProfiles = profiles.map(p => {
      const mapping = jyotishaMappings.find(m => m.pid === p.pid);
      if (mapping) {
        return {
          ...p,
          nakshatra: mapping.nakshatra,
          rashi: mapping.rashi
        };
      } else {
        const { nakshatra, rashi, ...rest } = p;
        return rest;
      }
    });

    setProfiles(updatedProfiles);
    alert('✅ Jyotisha details updated! Click "Save to Server" to save permanently.');
  };

  const sortedProfiles = [...profiles].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

  return (
    <div className="card" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-maroon)', fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Moon size={24} /> Jyotisha Details
        </h3>
        <button className="btn btn-primary" onClick={addMapping} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> Add Member
        </button>
      </div>

      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        Associate astronomical profiles (Nakshatram and Rashi) with family members.
        You can assign these to multiple members and click <strong>Save Jyotisha Details</strong>.
      </p>

      <style>{`
        .jyotisha-table-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background-color: #F1EBE4;
          border-bottom: 2px solid var(--color-sandalwood, #EADDCA);
          font-weight: 700;
          font-size: 0.8rem;
          color: var(--color-maroon, #63131D);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .jyotisha-row-label {
          display: none;
        }
        .jyotisha-trash-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #c0392b;
          padding: 6px;
          border: none;
          background: none;
          cursor: pointer;
          margin-top: 0;
        }
        @media (max-width: 768px) {
          .jyotisha-table-header {
            display: none;
          }
          .jyotisha-row-label {
            display: block;
            font-size: 0.78rem;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 0.25rem;
          }
          .jyotisha-trash-btn {
            margin-top: 1.25rem;
          }
        }
      `}</style>

      {jyotishaMappings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999', backgroundColor: '#FAFAFA', borderRadius: '8px', border: '1px dashed #DDD' }}>
          <Moon size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No member details mapped yet.</p>
          <button className="btn btn-secondary btn-sm" onClick={addMapping} style={{ marginTop: '1rem' }}>
            + Assign Details
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Scrollable Container with sticky header */}
          <div style={{
            maxHeight: '480px',
            overflowY: 'auto',
            border: '1px solid var(--color-sandalwood, #EADDCA)',
            borderRadius: '8px',
            backgroundColor: '#FAF8F5',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.03)'
          }}>
            {/* Table Header */}
            <div className="jyotisha-table-header">
              <div style={{ flex: '1 1 250px', minWidth: '220px' }}>Family Member</div>
              <div style={{ flex: '1 1 200px', minWidth: '180px' }}>Nakshatram</div>
              <div style={{ flex: '1 1 200px', minWidth: '180px' }}>Rashi</div>
              <div style={{ width: '30px', flexShrink: 0 }} /> {/* Spacer for delete */}
            </div>

            {/* List items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem' }}>
              {jyotishaMappings.map((mapping, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #EAE0D5',
                    flexWrap: 'wrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Member Selection */}
                  <div style={{ flex: '1 1 250px', minWidth: '220px' }}>
                    <label className="jyotisha-row-label">Family Member</label>
                    <SearchableSelect
                      value={mapping.pid}
                      placeholder="-- Select Member --"
                      onChange={e => updateMapping(idx, 'pid', e.target.value)}
                      options={[
                        { value: '', label: '-- Select Member --' },
                        ...sortedProfiles.map(p => ({
                          value: p.pid,
                          label: `${p.firstName} ${p.surName} (${p.pid})`
                        }))
                      ]}
                    />
                  </div>

                  {/* Nakshatra Dropdown */}
                  <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                    <label className="jyotisha-row-label">Nakshatram</label>
                    <select
                      value={mapping.nakshatra}
                      onChange={e => updateMapping(idx, 'nakshatra', e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '6px', height: '40px', backgroundColor: 'white' }}
                    >
                      <option value="">-- Select Nakshatram --</option>
                      {NAKSHATRAS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  {/* Rashi Dropdown */}
                  <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                    <label className="jyotisha-row-label">Rashi</label>
                    <select
                      value={mapping.rashi}
                      onChange={e => updateMapping(idx, 'rashi', e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '6px', height: '40px', backgroundColor: 'white' }}
                    >
                      <option value="">-- Select Rashi --</option>
                      {RASHIS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    className="jyotisha-trash-btn"
                    onClick={() => removeMapping(idx)}
                    title="Remove assignment"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #EEE',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <button className="btn btn-secondary" onClick={addMapping}>
              <Plus size={16} /> Add Member
            </button>
            <button className="btn btn-primary" onClick={handleSave} style={{ padding: '0.75rem 2.5rem' }}>
              Save Jyotisha Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JyotishaEditor;
