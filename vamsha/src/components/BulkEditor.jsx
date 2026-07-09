import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { getPidPrefix } from '../lib/api';

const BulkEditor = ({ profiles, setProfiles }) => {
  const [primaryMember, setPrimaryMember] = useState({ pid: '', firstName: '', surName: '', gender: 'Male', isDeceased: false, deathDate: '' });
  const [parents, setParents] = useState({
    father: { pid: '', firstName: '', surName: '', isDeceased: false },
    mother: { pid: '', firstName: '', surName: '', isDeceased: false }
  });
  const [spouses, setSpouses] = useState([]);
  const [children, setChildren] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadProfile = (pid) => {
    if (!pid) {
      setPrimaryMember({ pid: '', firstName: '', surName: '', gender: 'Male', isDeceased: false, deathDate: '' });
      setParents({
        father: { pid: '', firstName: '', surName: '', isDeceased: false },
        mother: { pid: '', firstName: '', surName: '', isDeceased: false }
      });
      setSpouses([]); setChildren([]);
      return;
    }
    const p = profiles.find(x => x.pid === pid);
    if (!p) return;
    setPrimaryMember({
      pid: p.pid,
      firstName: p.firstName,
      surName: p.surName,
      gender: p.gender,
      isDeceased: p.isDeceased || false,
      deathDate: p.deathDate || ''
    });
    const f = profiles.find(x => x.pid === p.fatherId) || { pid: '', firstName: '', surName: '', isDeceased: false };
    const m = profiles.find(x => x.pid === p.motherId) || { pid: '', firstName: '', surName: '', isDeceased: false };
    setParents({
      father: { pid: f.pid, firstName: f.firstName, surName: f.surName, isDeceased: f.isDeceased || false },
      mother: { pid: m.pid, firstName: m.firstName, surName: m.surName, isDeceased: m.isDeceased || false }
    });
    const sps = (p.spouseIds || []).map(spId => {
      const sp = profiles.find(x => x.pid === spId);
      return sp ? { pid: sp.pid, firstName: sp.firstName, surName: sp.surName, gender: sp.gender, isDeceased: sp.isDeceased || false } : null;
    }).filter(Boolean);
    setSpouses(sps);
    const kids = profiles.filter(x => x.fatherId === pid || x.motherId === pid)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map(k => {
        const otherParentId = p.gender === 'Male' ? k.motherId : k.fatherId;
        const firstSpouseId = k.spouseIds?.[0];
        const chSpouse = firstSpouseId ? profiles.find(x => x.pid === firstSpouseId) : null;
        const resolvedOtherParent = otherParentId || (sps.length > 0 ? (sps[0].pid || 'TEMP_SP_0') : '');
        return {
          pid: k.pid,
          firstName: k.firstName,
          surName: k.surName,
          gender: k.gender,
          otherParentPid: resolvedOtherParent,
          spousePid: chSpouse ? chSpouse.pid : '',
          spouseFirstName: chSpouse ? chSpouse.firstName : '',
          spouseSurName: chSpouse ? chSpouse.surName : '',
          spouseIsDeceased: chSpouse ? (chSpouse.isDeceased || false) : false,
          isDeceased: k.isDeceased || false
        };
      });
    setChildren(kids);
  };

  const handlePrimaryChange = (e) => {
    const { name, value } = e.target;
    if (name === 'searchPid') {
      loadProfile(value);
    } else {
      setPrimaryMember(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleParentChange = (parentType, field, value) => {
    setParents(prev => ({ ...prev, [parentType]: { ...prev[parentType], [field]: value } }));
  };

  const addSpouse = () => setSpouses([...spouses, { pid: '', firstName: '', surName: '', gender: primaryMember.gender === 'Male' ? 'Female' : 'Male', isDeceased: false }]);
  const updateSpouse = (i, f, v) => { const s = [...spouses]; s[i][f] = v; setSpouses(s); };
  const removeSpouse = (i) => setSpouses(spouses.filter((_, idx) => idx !== i));
  const moveSpouse = (i, dir) => {
    if (dir === 'up' && i > 0) { const s = [...spouses];[s[i], s[i - 1]] = [s[i - 1], s[i]]; setSpouses(s); }
    else if (dir === 'down' && i < spouses.length - 1) { const s = [...spouses];[s[i], s[i + 1]] = [s[i + 1], s[i]]; setSpouses(s); }
  };

  const addChild = () => {
    const defaultSpousePid = spouses.length > 0 ? (spouses[0].pid || 'TEMP_SP_0') : '';

    // Resolve child's default surname:
    // If primary member is Male, use his surname.
    // If primary member is Female, use her husband's surname (the first spouse), or blank if no husband.
    let defaultSurName = '';
    if (primaryMember.gender === 'Male') {
      defaultSurName = primaryMember.surName;
    } else if (spouses.length > 0) {
      defaultSurName = spouses[0].surName || '';
    }

    setChildren([...children, {
      pid: '',
      firstName: '',
      surName: defaultSurName,
      gender: 'Male',
      otherParentPid: defaultSpousePid,
      spousePid: '',
      spouseFirstName: '',
      spouseSurName: '',
      spouseIsDeceased: false,
      isDeceased: false
    }]);
  };
  const updateChild = (i, f, v) => { const c = [...children]; c[i][f] = v; setChildren(c); };
  const removeChild = (i) => setChildren(children.filter((_, idx) => idx !== i));
  const moveChild = (i, dir) => {
    if (dir === 'up' && i > 0) { const c = [...children];[c[i], c[i - 1]] = [c[i - 1], c[i]]; setChildren(c); }
    else if (dir === 'down' && i < children.length - 1) { const c = [...children];[c[i], c[i + 1]] = [c[i + 1], c[i]]; setChildren(c); }
  };

  const handleSave = () => {
    let newProfiles = [...profiles];
    const prefix = getPidPrefix();
    const prefixRegex = new RegExp(`^${prefix}(\\d+)`, 'i');
    const prefixNums = newProfiles
      .map(p => {
        const match = p.pid.match(prefixRegex);
        return match ? parseInt(match[1]) : 0;
      });
    let nextPidNum = prefixNums.length > 0 ? Math.max(...prefixNums, 0) + 1 : 1;
    const generatePid = () => `${prefix}${String(nextPidNum++).padStart(4, '0')}`;

    const upsertPerson = (personData, existingPid) => {
      if (!personData.firstName) return null;
      let pidToUse = existingPid || personData.pid;
      if (!pidToUse) pidToUse = generatePid();
      const idx = newProfiles.findIndex(p => p.pid === pidToUse);
      if (idx >= 0) {
        newProfiles[idx] = { ...newProfiles[idx], ...personData };
      } else {
        newProfiles.push({ ...personData, pid: pidToUse, spouseIds: personData.spouseIds || [], displayOrder: personData.displayOrder || 1 });
      }
      return pidToUse;
    };

    const fatherId = upsertPerson({ ...parents.father, gender: 'Male' }, parents.father.pid);
    const motherId = upsertPerson({ ...parents.mother, gender: 'Female' }, parents.mother.pid);

    if (fatherId && motherId) {
      const fIdx = newProfiles.findIndex(p => p.pid === fatherId);
      const mIdx = newProfiles.findIndex(p => p.pid === motherId);
      if (fIdx >= 0 && !newProfiles[fIdx].spouseIds.includes(motherId)) newProfiles[fIdx].spouseIds.push(motherId);
      if (mIdx >= 0 && !newProfiles[mIdx].spouseIds.includes(fatherId)) newProfiles[mIdx].spouseIds.push(fatherId);
    }

    let primaryDisplayOrder = primaryMember.displayOrder;
    if (!primaryMember.pid) { // New primary member
      if (fatherId || motherId) {
        const siblingsCount = newProfiles.filter(p =>
          (fatherId && p.fatherId === fatherId) || (motherId && p.motherId === motherId)
        ).length;
        primaryDisplayOrder = siblingsCount + 1;
      } else {
        primaryDisplayOrder = 1;
      }
    }

    const primaryId = upsertPerson({
      ...primaryMember,
      fatherId: fatherId || '',
      motherId: motherId || '',
      displayOrder: primaryDisplayOrder || 1
    }, primaryMember.pid);
    if (!primaryId) { alert('Primary Member First Name is required'); return; }

    const currentSpouseIds = [];
    const tempSpouseMap = {};
    spouses.forEach((sp, i) => {
      const spId = upsertPerson({ ...sp, spouseIds: [primaryId] }, sp.pid);
      if (spId) {
        currentSpouseIds.push(spId);
        if (!sp.pid) tempSpouseMap[`TEMP_SP_${i}`] = spId;
        else tempSpouseMap[sp.pid] = spId;
      }
    });
    const primaryIdx = newProfiles.findIndex(p => p.pid === primaryId);
    newProfiles[primaryIdx].spouseIds = currentSpouseIds;

    children.forEach((ch, idx) => {
      const mappedOtherParentPid = tempSpouseMap[ch.otherParentPid] || ch.otherParentPid;
      const chId = upsertPerson({
        firstName: ch.firstName, surName: ch.surName, gender: ch.gender,
        fatherId: primaryMember.gender === 'Male' ? primaryId : mappedOtherParentPid,
        motherId: primaryMember.gender === 'Female' ? primaryId : mappedOtherParentPid,
        displayOrder: idx + 1,
        isDeceased: ch.isDeceased || false
      }, ch.pid);
      if (ch.spouseFirstName && chId) {
        const chSpId = upsertPerson({
          firstName: ch.spouseFirstName,
          surName: ch.spouseSurName,
          gender: ch.gender === 'Male' ? 'Female' : 'Male',
          spouseIds: [chId],
          isDeceased: ch.spouseIsDeceased || false
        }, ch.spousePid || '');
        if (chSpId) {
          const chIdx = newProfiles.findIndex(p => p.pid === chId);
          if (chIdx >= 0) {
            newProfiles[chIdx].spouseIds = [chSpId];
          }
        }
      }
    });

    setProfiles(newProfiles);
    alert('Family data saved successfully!');
    setPrimaryMember({ pid: '', firstName: '', surName: '', gender: 'Male', isDeceased: false, deathDate: '' });
    setParents({
      father: { pid: '', firstName: '', surName: '', isDeceased: false },
      mother: { pid: '', firstName: '', surName: '', isDeceased: false }
    });
    setSpouses([]); setChildren([]);
  };

  const sortedProfiles = [...profiles].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

  return (
    <div className="bulk-editor-container">
      <div className="bulk-header">
        <h2 className="card-title">Bulk Relationship Editor</h2>
      </div>

      {/* TOP: 2-column grid — Primary+Parents on left, Spouses on right */}
      <div className="bulk-grid">
        {/* LEFT COLUMN */}
        <div className="bulk-col">
          {/* Primary Member */}
          <div className="bulk-section">
            <div className="section-header-flex">
              <h3>Primary Member Details</h3>
            </div>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
                <label>Select Existing Member to Edit</label>
                <SearchableSelect
                  name="searchPid"
                  value={primaryMember.pid}
                  placeholder="-- Create New / Select Member --"
                  onChange={handlePrimaryChange}
                  options={[
                    { value: '', label: '-- Create New Member --' },
                    ...sortedProfiles.map(p => ({
                      value: p.pid,
                      label: `${p.firstName} ${p.surName} (${p.pid})`
                    }))
                  ]}
                />
              </div>
              <div className="form-group">
                <label>First Name <span className="req">*</span></label>
                <input type="text" name="firstName" value={primaryMember.firstName} onChange={handlePrimaryChange} />
              </div>
              <div className="form-group">
                <label>Last Name <span className="req">*</span></label>
                <input type="text" name="surName" value={primaryMember.surName} onChange={handlePrimaryChange} />
              </div>
              <div className="form-group">
                <label>Gender <span className="req">*</span></label>
                <select name="gender" value={primaryMember.gender} onChange={handlePrimaryChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', paddingTop: '1.25rem' }}>
                <input
                  type="checkbox"
                  name="isDeceased"
                  id="bulk-isDeceased"
                  checked={primaryMember.isDeceased || false}
                  onChange={(e) => setPrimaryMember(prev => ({
                    ...prev,
                    isDeceased: e.target.checked
                  }))}
                  style={{ width: 'auto', height: 'auto', transform: 'scale(1.25)', cursor: 'pointer', margin: 0 }}
                />
                <label htmlFor="bulk-isDeceased" style={{ cursor: 'pointer', margin: 0, fontWeight: 600, userSelect: 'none' }}>
                  Deceased
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN - Spouses */}
        <div className="bulk-col">
          <div className="bulk-section">
            <div className="section-header-flex">
              <h3>Partners / Spouses</h3>
              <button className="btn-add-small" onClick={addSpouse}><Plus size={14} /> Add Spouse</button>
            </div>

            {spouses.length === 0 && <p className="empty-msg">No spouses added</p>}

            {spouses.map((sp, idx) => (
              <div key={idx} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed #e0e0e0' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <SearchableSelect
                    value={sp.pid || ''}
                    placeholder="-- Create New Spouse --"
                    onChange={e => {
                      const p = profiles.find(x => x.pid === e.target.value);
                      if (p) { const s = [...spouses]; s[idx] = p; setSpouses(s); }
                      else {
                        const s = [...spouses];
                        s[idx] = { pid: '', firstName: '', surName: '', gender: primaryMember.gender === 'Male' ? 'Female' : 'Male', isDeceased: false };
                        setSpouses(s);
                      }
                    }}
                    options={[
                      { value: '', label: '-- Create New Spouse --' },
                      ...sortedProfiles.filter(p => p.pid !== primaryMember.pid).map(p => ({
                        value: p.pid,
                        label: `${p.firstName} ${p.surName} (${p.pid})`
                      }))
                    ]}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="text" placeholder="First Name" value={sp.firstName} onChange={e => updateSpouse(idx, 'firstName', e.target.value)} />
                  <input type="text" placeholder="Last Name" value={sp.surName} onChange={e => updateSpouse(idx, 'surName', e.target.value)} />
                  <select value={sp.gender} onChange={e => updateSpouse(idx, 'gender', e.target.value)}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-icon" onClick={() => moveSpouse(idx, 'up')} disabled={idx === 0}>⬆️</button>
                    <button className="btn-icon" onClick={() => moveSpouse(idx, 'down')} disabled={idx === spouses.length - 1}>⬇️</button>
                    <button className="btn-icon text-red" onClick={() => removeSpouse(idx)}><Trash2 size={16} /></button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id={`spouse-${idx}-isDeceased`}
                    checked={sp.isDeceased || false}
                    onChange={e => updateSpouse(idx, 'isDeceased', e.target.checked)}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <label htmlFor={`spouse-${idx}-isDeceased`} style={{ fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                    Deceased
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Parents */}
          <div className="bulk-section">
            <h3>Parents Details</h3>

            <div className="parent-row">
              <span className="parent-label">Father</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <SearchableSelect
                  value={parents.father.pid || ''}
                  placeholder="-- Create New Father --"
                  onChange={e => {
                    const p = profiles.find(x => x.pid === e.target.value);
                    if (p) setParents({ ...parents, father: p });
                    else setParents({ ...parents, father: { pid: '', firstName: '', surName: '', isDeceased: false } });
                  }}
                  options={[
                    { value: '', label: '-- Create New Father --' },
                    ...sortedProfiles.filter(p => p.gender === 'Male' && p.pid !== primaryMember.pid).map(p => ({
                      value: p.pid,
                      label: `${p.firstName} ${p.surName} (${p.pid})`
                    }))
                  ]}
                />
                {!parents.father.pid && (
                  <div className="form-grid parent-inputs">
                    <input type="text" placeholder="First Name" value={parents.father.firstName} onChange={e => handleParentChange('father', 'firstName', e.target.value)} />
                    <input type="text" placeholder="Last Name" value={parents.father.surName} onChange={e => handleParentChange('father', 'surName', e.target.value)} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                  <input
                    type="checkbox"
                    id="father-isDeceased"
                    checked={parents.father.isDeceased || false}
                    onChange={e => handleParentChange('father', 'isDeceased', e.target.checked)}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <label htmlFor="father-isDeceased" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                    Deceased
                  </label>
                </div>
              </div>
            </div>

            <div className="parent-row">
              <span className="parent-label">Mother</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <SearchableSelect
                  value={parents.mother.pid || ''}
                  placeholder="-- Create New Mother --"
                  onChange={e => {
                    const p = profiles.find(x => x.pid === e.target.value);
                    if (p) setParents({ ...parents, mother: p });
                    else setParents({ ...parents, mother: { pid: '', firstName: '', surName: '', isDeceased: false } });
                  }}
                  options={[
                    { value: '', label: '-- Create New Mother --' },
                    ...sortedProfiles.filter(p => p.gender === 'Female' && p.pid !== primaryMember.pid).map(p => ({
                      value: p.pid,
                      label: `${p.firstName} ${p.surName} (${p.pid})`
                    }))
                  ]}
                />
                {!parents.mother.pid && (
                  <div className="form-grid parent-inputs">
                    <input type="text" placeholder="First Name" value={parents.mother.firstName} onChange={e => handleParentChange('mother', 'firstName', e.target.value)} />
                    <input type="text" placeholder="Last Name" value={parents.mother.surName} onChange={e => handleParentChange('mother', 'surName', e.target.value)} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                  <input
                    type="checkbox"
                    id="mother-isDeceased"
                    checked={parents.mother.isDeceased || false}
                    onChange={e => handleParentChange('mother', 'isDeceased', e.target.checked)}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <label htmlFor="mother-isDeceased" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                    Deceased
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULL WIDTH - Children Section */}
      <div className="bulk-children-section">
        <div className="bulk-section">
          <div className="section-header-flex">
            <h3>Children &amp; Their Spouses</h3>
            <button className="btn-add-small" onClick={addChild}><Plus size={14} /> Add Child</button>
          </div>

          {children.length === 0 ? (
            <div className="empty-state">No children added yet. Click "+ Add Child" to begin.</div>
          ) : (
            <div className="children-cards-grid">
              {children.map((ch, idx) => (
                <div key={idx} className="child-card">
                  <div className="child-card-header">
                    <span className="child-order-badge">#{idx + 1}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-icon" onClick={() => moveChild(idx, 'up')} disabled={idx === 0} title="Move Up">⬆️</button>
                      <button className="btn-icon" onClick={() => moveChild(idx, 'down')} disabled={idx === children.length - 1} title="Move Down">⬇️</button>
                      <button className="btn-icon text-red" onClick={() => removeChild(idx)} title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="child-card-body">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <div className="child-field-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                        <label className="child-field-label">Select Existing Profile</label>
                        <SearchableSelect
                          value={ch.pid || ''}
                          placeholder="-- New Child --"
                          onChange={e => {
                            const p = profiles.find(x => x.pid === e.target.value);
                            if (p) {
                              const firstSpouseId = p.spouseIds?.[0];
                              const chSpouse = firstSpouseId ? profiles.find(x => x.pid === firstSpouseId) : null;
                              const nc = [...children];
                              nc[idx] = {
                                ...nc[idx],
                                ...p,
                                spousePid: chSpouse ? chSpouse.pid : '',
                                spouseFirstName: chSpouse ? chSpouse.firstName : '',
                                spouseSurName: chSpouse ? chSpouse.surName : '',
                                spouseIsDeceased: chSpouse ? (chSpouse.isDeceased || false) : false,
                                isDeceased: p.isDeceased || false
                              };
                              setChildren(nc);
                            } else {
                              let defaultSurName = '';
                              if (primaryMember.gender === 'Male') {
                                defaultSurName = primaryMember.surName;
                              } else if (spouses.length > 0) {
                                defaultSurName = spouses[0].surName || '';
                              }

                              const nc = [...children];
                              nc[idx] = {
                                ...nc[idx],
                                pid: '',
                                firstName: '',
                                surName: defaultSurName,
                                gender: 'Male',
                                isDeceased: false,
                                spousePid: '',
                                spouseFirstName: '',
                                spouseSurName: '',
                                spouseIsDeceased: false
                              };
                              setChildren(nc);
                            }
                          }}
                          options={[
                            { value: '', label: '-- New Child --' },
                            ...sortedProfiles.filter(p => p.pid !== primaryMember.pid).map(p => ({
                              value: p.pid,
                              label: `${p.firstName} ${p.surName} (${p.pid})`
                            }))
                          ]}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1.2rem', height: '40px' }}>
                        <input
                          type="checkbox"
                          id={`child-${idx}-isDeceased`}
                          checked={ch.isDeceased || false}
                          onChange={e => updateChild(idx, 'isDeceased', e.target.checked)}
                          style={{ width: 'auto', margin: 0, transform: 'scale(1.15)', cursor: 'pointer' }}
                        />
                        <label htmlFor={`child-${idx}-isDeceased`} style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                          Deceased
                        </label>
                      </div>
                    </div>

                    <div className="child-fields-row" style={{ marginBottom: '1rem' }}>
                      <div className="child-field-group">
                        <label className="child-field-label">First Name</label>
                        <input type="text" placeholder="First Name" value={ch.firstName} onChange={e => updateChild(idx, 'firstName', e.target.value)} />
                      </div>
                      <div className="child-field-group">
                        <label className="child-field-label">Last Name</label>
                        <input type="text" placeholder="Last Name" value={ch.surName} onChange={e => updateChild(idx, 'surName', e.target.value)} />
                      </div>
                      <div className="child-field-group" style={{ flex: '0 0 110px' }}>
                        <label className="child-field-label">Gender</label>
                        <select value={ch.gender} onChange={e => updateChild(idx, 'gender', e.target.value)}>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <div className="child-field-group" style={{ flex: '0 0 170px' }}>
                        <label className="child-field-label">Other Parent</label>
                        <select value={ch.otherParentPid} onChange={e => updateChild(idx, 'otherParentPid', e.target.value)}>
                          <option value="">- Select -</option>
                          {spouses.map((sp, i) => (
                            <option key={i} value={sp.pid || `TEMP_SP_${i}`}>{sp.firstName}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="child-fields-row">
                      <div className="child-field-group">
                        <label className="child-field-label">Child's Spouse First Name</label>
                        <input type="text" placeholder="Spouse First Name" value={ch.spouseFirstName} onChange={e => updateChild(idx, 'spouseFirstName', e.target.value)} />
                      </div>
                      <div className="child-field-group">
                        <label className="child-field-label">Child's Spouse Last Name</label>
                        <input type="text" placeholder="Spouse Last Name" value={ch.spouseSurName} onChange={e => updateChild(idx, 'spouseSurName', e.target.value)} />
                      </div>
                      <div className="child-field-group" style={{ flex: '0 0 150px', justifyContent: 'center', paddingTop: '1.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <input
                            type="checkbox"
                            id={`child-spouse-${idx}-isDeceased`}
                            checked={ch.spouseIsDeceased || false}
                            onChange={e => updateChild(idx, 'spouseIsDeceased', e.target.checked)}
                            style={{ width: 'auto', margin: 0 }}
                          />
                          <label htmlFor={`child-spouse-${idx}-isDeceased`} style={{ fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                            Deceased
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bulk-actions" style={{ justifyContent: 'space-between' }}>
        <div>
          {primaryMember.pid && (
            showDeleteConfirm ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: '#DC3545', fontWeight: 'bold' }}>Are you sure?</span>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>No</button>
                <button type="button" className="btn" style={{ backgroundColor: '#DC3545', color: 'white' }} onClick={() => {
                  setProfiles(profiles.filter(p => p.pid !== primaryMember.pid));
                  setPrimaryMember({ pid: '', firstName: '', surName: '', gender: 'Male' });
                  setParents({ father: { pid: '', firstName: '', surName: '' }, mother: { pid: '', firstName: '', surName: '' } });
                  setSpouses([]); setChildren([]); setShowDeleteConfirm(false);
                }}>Yes, Delete</button>
              </div>
            ) : (
              <button className="btn" style={{ backgroundColor: '#DC3545', color: 'white' }} onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={18} /> Delete Profile
              </button>
            )
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => {
            setPrimaryMember({ pid: '', firstName: '', surName: '', gender: 'Male' });
            setParents({ father: { pid: '', firstName: '', surName: '' }, mother: { pid: '', firstName: '', surName: '' } });
            setSpouses([]); setChildren([]);
          }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default BulkEditor;
