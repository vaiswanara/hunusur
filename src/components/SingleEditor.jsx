import React, { useState, useEffect } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

const SingleEditor = ({ profiles, setProfiles, profileToEdit, setProfileToEdit }) => {
  const [formData, setFormData] = useState(getEmptyForm());
  const [isEditing, setIsEditing] = useState(false);
  const [searchPid, setSearchPid] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (profileToEdit) {
      loadProfile(profileToEdit.pid);
      setProfileToEdit(null);
    }
  }, [profileToEdit]);

  function getEmptyForm() {
    return {
      pid: `PID${String(profiles.length > 0 ? profiles.length + 1 : 1).padStart(4, '0')}`,
      firstName: '', surName: '', gender: 'Male',
      maidenName: '', dob: '', phone: '', email: '', notes: '',
      fatherId: '', motherId: '', spouseIds: [],
      displayOrder: 1,
      isDeceased: false,
      deathDate: '',
      photoUrl: '',
      gotram: ''
    };
  }

  const loadProfile = (pid) => {
    if (!pid) { setFormData(getEmptyForm()); setIsEditing(false); return; }
    const p = profiles.find(x => x.pid === pid);
    if (p) { setFormData(p); setIsEditing(true); setSearchPid(p.pid); }
  };

  const handleSearchChange = (e) => { setSearchPid(e.target.value); loadProfile(e.target.value); };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'fatherId' || name === 'motherId') {
        const fatherId = name === 'fatherId' ? value : prev.fatherId;
        const motherId = name === 'motherId' ? value : prev.motherId;
        if (fatherId || motherId) {
          const siblingsCount = profiles.filter(p =>
            p.pid !== prev.pid &&
            ((fatherId && p.fatherId === fatherId) || (motherId && p.motherId === motherId))
          ).length;
          updated.displayOrder = siblingsCount + 1;
        } else {
          updated.displayOrder = 1;
        }
      }
      return updated;
    });
  };


  const getSiblings = () => {
    if (!formData.fatherId && !formData.motherId) return [];
    const others = profiles.filter(p => {
      if (p.pid === formData.pid) return false;
      if (formData.fatherId && p.fatherId === formData.fatherId) return true;
      if (formData.motherId && p.motherId === formData.motherId) return true;
      return false;
    });
    const selfObj = { ...formData, _isSelf: true };
    return [...others, selfObj].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  };

  const moveSibling = (siblingPid, direction) => {
    const sibs = getSiblings();
    const idx = sibs.findIndex(s => s.pid === siblingPid);
    if (idx === -1) return;

    const swap = (idxA, idxB) => {
      const updatedList = [...sibs];
      [updatedList[idxA], updatedList[idxB]] = [updatedList[idxB], updatedList[idxA]];

      const displayOrderMap = {};
      updatedList.forEach((item, index) => {
        displayOrderMap[item.pid] = index + 1;
      });

      setProfiles(profiles.map(p => {
        if (p.pid in displayOrderMap) {
          return { ...p, displayOrder: displayOrderMap[p.pid] };
        }
        return p;
      }));

      if (formData.pid in displayOrderMap) {
        setFormData(prev => ({ ...prev, displayOrder: displayOrderMap[formData.pid] }));
      }
    };

    if (direction === 'up' && idx > 0) swap(idx, idx - 1);
    else if (direction === 'down' && idx < sibs.length - 1) swap(idx, idx + 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isEditing) {
      setProfiles(profiles.map(p => p.pid === formData.pid ? formData : p));
      alert('Profile Updated Successfully!');
    } else {
      setProfiles([...profiles, formData]);
      alert('Profile Added Successfully!');
    }
    setFormData(getEmptyForm()); setIsEditing(false); setSearchPid('');
  };

  const handleDelete = () => {
    setProfiles(profiles.filter(p => p.pid !== formData.pid));
    setFormData(getEmptyForm()); setIsEditing(false); setSearchPid(''); setShowDeleteConfirm(false);
  };

  const siblings = getSiblings();
  const sortedProfiles = [...profiles].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

  return (
    <div className="card" style={{ marginBottom: '2rem', padding: '2rem', borderRadius: '12px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-maroon)', fontSize: '1.5rem', margin: 0 }}>
          {isEditing ? 'Edit Profile' : 'Add New Profile'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FAFAFA', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #EEE' }}>
          <SearchableSelect
            value={searchPid}
            placeholder="-- Add New --"
            onChange={handleSearchChange}
            options={[
              { value: '', label: '-- Add New --' },
              ...sortedProfiles.map(p => ({
                value: p.pid,
                label: `${p.firstName} ${p.surName} (${p.pid})`
              }))
            ]}
            style={{ minWidth: '220px' }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {/* Basic Information */}
        <h4 style={{ color: 'var(--color-maroon)', marginBottom: '1rem', marginTop: '1rem' }}>Basic Information</h4>
        <div className="form-grid">
          <div className="form-group">
            <label>Profile ID</label>
            <input type="text" name="pid" value={formData.pid || ''} readOnly style={{ backgroundColor: '#EEE', color: '#666' }} />
          </div>
          <div className="form-group">
            <label>First Name <span style={{ color: 'red' }}>*</span></label>
            <input type="text" name="firstName" value={formData.firstName || ''} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Sur Name</label>
            <input type="text" name="surName" value={formData.surName || ''} onChange={handleInputChange} />
          </div>
          <div className="form-group">
            <label>Gender <span style={{ color: 'red' }}>*</span></label>
            <select name="gender" value={formData.gender || 'Male'} onChange={handleInputChange} required>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          {formData.gender === 'Female' && (
            <div className="form-group">
              <label>Maiden Name</label>
              <input type="text" name="maidenName" value={formData.maidenName || ''} onChange={handleInputChange} />
            </div>
          )}
          <div className="form-group">
            <label>Date of Birth</label>
            <input type="date" name="dob" value={formData.dob || ''} onChange={handleInputChange} />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="tel" name="phone" value={formData.phone || ''} onChange={handleInputChange} />
          </div>
          <div className="form-group">
            <label>Email ID</label>
            <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Photo URL (Optional)</label>
            <input type="text" name="photoUrl" value={formData.photoUrl || ''} onChange={handleInputChange} placeholder="e.g. https://example.com/photo.jpg" />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', height: '100%', paddingTop: '1.25rem' }}>
            <input
              type="checkbox"
              name="isDeceased"
              id="single-isDeceased"
              checked={formData.isDeceased || false}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                isDeceased: e.target.checked,
                deathDate: e.target.checked ? prev.deathDate : ''
              }))}
              style={{ width: 'auto', height: 'auto', transform: 'scale(1.25)', cursor: 'pointer', margin: 0 }}
            />
            <label htmlFor="single-isDeceased" style={{ cursor: 'pointer', margin: 0, fontWeight: 600, userSelect: 'none' }}>
              Deceased
            </label>
          </div>
          {formData.isDeceased && (
            <div className="form-group">
              <label>Date of Death (Optional)</label>
              <input
                type="date"
                name="deathDate"
                value={formData.deathDate || ''}
                onChange={handleInputChange}
              />
            </div>
          )}
        </div>

        {/* Relationships */}
        <h4 style={{ color: 'var(--color-maroon)', marginBottom: '1rem' }}>Relationships</h4>
        <div className="relationship-grid">
          <div className="form-group">
            <label>Father</label>
            <SearchableSelect
              name="fatherId"
              value={formData.fatherId || ''}
              onChange={handleInputChange}
              placeholder="-- Select Father --"
              options={[
                { value: '', label: '-- Select Father --' },
                ...sortedProfiles.filter(p => p.gender === 'Male' && p.pid !== formData.pid).map(p => ({
                  value: p.pid,
                  label: `${p.firstName} ${p.surName} (${p.pid})`
                }))
              ]}
            />
          </div>
          <div className="form-group">
            <label>Mother</label>
            <SearchableSelect
              name="motherId"
              value={formData.motherId || ''}
              onChange={handleInputChange}
              placeholder="-- Select Mother --"
              options={[
                { value: '', label: '-- Select Mother --' },
                ...sortedProfiles.filter(p => p.gender === 'Female' && p.pid !== formData.pid).map(p => ({
                  value: p.pid,
                  label: `${p.firstName} ${p.surName} (${p.pid})`
                }))
              ]}
            />
          </div>
        </div>

        {/* Siblings Section — shown only if father or mother is set */}
        {(formData.fatherId || formData.motherId) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ color: 'var(--color-maroon)', marginBottom: '1rem', display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
              Siblings Order
              <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#888' }}>
                Use ⬆️⬇️ to set elder/younger order (1 = eldest)
              </span>
            </h4>
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', border: '1px solid #EEE', overflow: 'hidden' }}>
              {/* Visual order preview — all siblings including self */}
              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #E8E0D5', backgroundColor: '#FDF8F3' }}>
                <div style={{ fontSize: '0.78rem', color: '#999', marginBottom: '0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Order</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {siblings
                    .map((s, i) => (
                      <span key={s.pid} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.82rem',
                        backgroundColor: s._isSelf ? 'var(--color-maroon)' : (s.gender === 'Male' ? '#D6EAF8' : '#FDEDEC'),
                        color: s._isSelf ? 'white' : '#333',
                        border: s._isSelf ? 'none' : '1px solid #ddd',
                        fontWeight: s._isSelf ? 700 : 400
                      }}>
                        <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>#{i + 1}</span>
                        {s.firstName}
                        {s._isSelf && <span style={{ fontSize: '0.68rem', opacity: 0.85 }}> ★</span>}
                      </span>
                    ))
                  }
                </div>
              </div>

              {/* Sibling list with up/down buttons */}
              {siblings.length === 0 ? (
                <div style={{ padding: '1rem 1.25rem', color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  No other siblings found for the selected parents.
                </div>
              ) : (
                <div style={{ padding: '0.5rem' }}>
                  {siblings.map((s, idx) => (
                    <div key={s.pid} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '2px', backgroundColor: s._isSelf ? '#FFF8F2' : '#fff', border: s._isSelf ? '1.5px solid var(--color-maroon)' : '1px solid #F0F0F0' }}>
                      <span style={{ minWidth: '26px', height: '26px', borderRadius: '50%', backgroundColor: s._isSelf ? 'var(--color-maroon)' : 'var(--color-sandalwood)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: s._isSelf ? 'white' : 'var(--color-maroon)', flexShrink: 0 }}>
                        {s.displayOrder || '?'}
                      </span>
                      <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: s._isSelf ? 700 : 400 }}>
                        {s.firstName} {s.surName}
                        {s._isSelf && <span style={{ color: 'var(--color-maroon)', fontSize: '0.8rem', marginLeft: '0.4rem', fontWeight: 'bold' }}>(You)</span>}
                        <span style={{ fontSize: '0.78rem', color: '#bbb', marginLeft: '0.4rem' }}>({s.pid})</span>
                      </span>
                      <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '10px', backgroundColor: s.gender === 'Male' ? '#D6EAF8' : '#FDEDEC', color: s.gender === 'Male' ? '#2471A3' : '#A93226', flexShrink: 0 }}>
                        {s.gender}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button type="button" className="btn-icon" onClick={() => moveSibling(s.pid, 'up')} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }} title="Move Up (Elder)">⬆️</button>
                        <button type="button" className="btn-icon" onClick={() => moveSibling(s.pid, 'down')} disabled={idx === siblings.length - 1} style={{ opacity: idx === siblings.length - 1 ? 0.3 : 1 }} title="Move Down (Younger)">⬇️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label>Additional Notes</label>
          <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} rows="3" style={{ resize: 'vertical' }}></textarea>
        </div>

        {/* Actions */}
        <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#F8F9FA', borderRadius: '8px', display: 'flex', gap: '1rem', justifyContent: 'space-between', border: '1px solid #EEE' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
              {isEditing ? <><Edit2 size={18} /> Update Profile</> : <><Plus size={18} /> Add Profile</>}
            </button>
            {isEditing && (
              <button type="button" className="btn btn-secondary" onClick={() => { setIsEditing(false); setFormData(getEmptyForm()); setSearchPid(''); }}>
                Cancel Edit
              </button>
            )}
          </div>
          {isEditing && (
            showDeleteConfirm ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: '#DC3545', fontWeight: 'bold' }}>Are you sure?</span>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>No</button>
                <button type="button" className="btn" style={{ backgroundColor: '#DC3545', color: 'white' }} onClick={handleDelete}>Yes, Delete</button>
              </div>
            ) : (
              <button type="button" className="btn" style={{ backgroundColor: '#DC3545', color: 'white' }} onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={18} /> Delete Profile
              </button>
            )
          )}
        </div>

      </form>
    </div>
  );
};

export default SingleEditor;
