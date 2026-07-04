import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Camera, Download, Upload } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

const PhotoEditor = ({ profiles, setProfiles }) => {
  const [photoMappings, setPhotoMappings] = useState([]);
  const [globalBaseUrl, setGlobalBaseUrl] = useState('');
  const csvInputRef = useRef(null);

  // Helper to split a full photoUrl into baseUrl and fileName
  const splitUrl = (url) => {
    if (!url) return { baseUrl: '', fileName: '' };
    const lastSlashIdx = url.lastIndexOf('/');
    if (lastSlashIdx === -1) {
      return { baseUrl: '', fileName: url };
    }
    return {
      baseUrl: url.substring(0, lastSlashIdx + 1),
      fileName: url.substring(lastSlashIdx + 1)
    };
  };

  // Find the most frequent baseUrl from current mappings to use as default for new ones
  const getDefaultBaseUrl = (currentMappings) => {
    const activeUrls = currentMappings.map(m => m.baseUrl).filter(Boolean);
    if (activeUrls.length > 0) {
      const counts = {};
      let maxUrl = activeUrls[0];
      let maxCount = 0;
      activeUrls.forEach(url => {
        counts[url] = (counts[url] || 0) + 1;
        if (counts[url] > maxCount) {
          maxUrl = url;
          maxCount = counts[url];
        }
      });
      return maxUrl;
    }
    return 'https://raw.githubusercontent.com/vaiswanara/dfwa/main/photos/';
  };

  // Initialize mappings from profiles that have a photoUrl
  useEffect(() => {
    const existing = profiles
      .filter(p => p.photoUrl)
      .map(p => {
        const { baseUrl, fileName } = splitUrl(p.photoUrl);
        return { pid: p.pid, baseUrl, fileName };
      });
    setPhotoMappings(existing);
  }, [profiles]);

  // Sync globalBaseUrl once when photoMappings are loaded first time
  useEffect(() => {
    if (photoMappings.length > 0 && !globalBaseUrl) {
      setGlobalBaseUrl(getDefaultBaseUrl(photoMappings));
    }
  }, [photoMappings]);

  const addMapping = () => {
    const defaultBase = globalBaseUrl || getDefaultBaseUrl(photoMappings);
    setPhotoMappings([...photoMappings, { pid: '', baseUrl: defaultBase, fileName: '' }]);
  };

  const updateMapping = (index, field, value) => {
    const updated = [...photoMappings];
    updated[index][field] = value;

    // Auto-populate fileName when member profile is selected
    if (field === 'pid' && value) {
      updated[index].fileName = `${value}.jpg`;
    }

    setPhotoMappings(updated);
  };

  const removeMapping = (index) => {
    setPhotoMappings(photoMappings.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    // Check for duplicates
    const pids = photoMappings.map(m => m.pid).filter(Boolean);
    const hasDuplicates = pids.length !== new Set(pids).size;
    if (hasDuplicates) {
      alert('❌ Error: You have selected the same person multiple times. Please combine them.');
      return;
    }

    // Create lookup map of pid -> full photoUrl
    const urlMap = {};
    photoMappings.forEach(m => {
      if (m.pid && m.fileName.trim()) {
        const fullUrl = `${m.baseUrl.trim()}${m.fileName.trim()}`;
        urlMap[m.pid] = fullUrl;
      }
    });

    // Update profiles state
    const updatedProfiles = profiles.map(p => {
      if (p.pid in urlMap) {
        return { ...p, photoUrl: urlMap[p.pid] };
      } else {
        const { photoUrl, ...rest } = p;
        return rest;
      }
    });

    setProfiles(updatedProfiles);
    alert('✅ Photo URLs updated! Click "Save to Server" to save permanently.');
  };

  // Export Mappings to CSV (PID, Name, Photo_URL)
  const handleExportCSV = () => {
    const headers = ['PID', 'Name', 'Photo_URL'];
    const rows = photoMappings
      .filter(m => m.pid)
      .map(m => {
        const p = profiles.find(profile => profile.pid === m.pid);
        const fullName = p ? `${p.firstName} ${p.surName}` : 'Unknown';
        const fullUrl = `${m.baseUrl.trim()}${m.fileName.trim()}`;
        return [m.pid, fullName, fullUrl];
      });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'vamsha_photo_mappings.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger file selection for CSV import
  const handleImportCSVClick = () => {
    csvInputRef.current.click();
  };

  // Parse imported CSV file (Supporting 3 columns: PID, Name, Photo_URL)
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/);
      const parsedMappings = [];

      lines.forEach((line) => {
        if (!line.trim()) return;
        
        // Parse CSV fields supporting double quotes
        const columns = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            columns.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        columns.push(current.trim());

        // Strip quotes and replace escaped quotes
        const cleanedCols = columns.map(col => col.replace(/^["']|["']$/g, '').replace(/""/g, '"').trim());
        if (cleanedCols.length < 3) return;

        const [pid, , fullUrl] = cleanedCols; // Index 0: PID, Index 1: Name (ignored), Index 2: Photo_URL

        // Skip header or invalid PID
        if (pid.toUpperCase() === 'PID' || !pid.toUpperCase().startsWith('PID')) {
          return;
        }

        if (pid && fullUrl) {
          const { baseUrl, fileName } = splitUrl(fullUrl);
          parsedMappings.push({ pid, baseUrl, fileName });
        }
      });

      if (parsedMappings.length > 0) {
        setPhotoMappings(parsedMappings);
        alert(`📥 Successfully loaded ${parsedMappings.length} photo mappings from CSV! Click "Save Photos" at the bottom to finalize.`);
      } else {
        alert('❌ Failed to parse any valid photo mappings. Ensure the CSV contains "PID", "Name", and "Photo_URL" columns.');
      }
    };
    
    reader.readAsText(file);
    e.target.value = ''; // reset file input
  };

  const handleSetDefaultBaseUrl = () => {
    alert(`✅ Default Base URL configured to: "${globalBaseUrl}". Any new photos added from now will use this base folder path.`);
  };

  const sortedProfiles = [...profiles].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));

  return (
    <div className="card" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ color: 'var(--color-maroon)', fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={24} /> Manage Profile Photos
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} title="Export photos to CSV (PID, Name, URL)">
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={handleImportCSVClick} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} title="Import photos from CSV (PID, Name, URL)">
            <Upload size={16} /> Import CSV
          </button>
          <input 
            type="file" 
            ref={csvInputRef} 
            accept=".csv" 
            onChange={handleImportCSV} 
            style={{ display: 'none' }} 
          />
          <button className="btn btn-primary" onClick={addMapping} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> Add Photo
          </button>
        </div>
      </div>

      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        Associate external image URLs with family profiles by splitting the Base URL (shared folder) and File Name (individual image file). 
        Selecting a profile will automatically populate its File Name with its <strong>PID.jpg</strong>.
      </p>

      {/* Global Base URL Controller Card */}
      <div style={{
        backgroundColor: '#FAF6F0',
        border: '1px solid var(--color-sandalwood, #D3BCA2)',
        padding: '1.25rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-maroon, #63131D)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            🌐 Global Default Base URL (for new items)
          </label>
          <input 
            type="text" 
            value={globalBaseUrl} 
            onChange={e => setGlobalBaseUrl(e.target.value)}
            placeholder="e.g. https://domain.com/photos/" 
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', height: '40px', boxSizing: 'border-box' }}
          />
        </div>
        <button 
          type="button"
          className="btn btn-secondary" 
          onClick={handleSetDefaultBaseUrl}
          style={{ height: '40px', marginTop: '1.25rem', padding: '0 1.25rem' }}
        >
          Set Default
        </button>
      </div>

      <style>{`
        .editor-table-header {
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
        .editor-row-label {
          display: none;
        }
        .editor-trash-btn {
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
          .editor-table-header {
            display: none;
          }
          .editor-row-label {
            display: block;
            font-size: 0.75rem;
            font-weight: 600;
            color: #666;
            margin-bottom: 0.25rem;
          }
          .editor-trash-btn {
            margin-top: 1.25rem;
          }
        }
      `}</style>

      {photoMappings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999', backgroundColor: '#FAFAFA', borderRadius: '8px', border: '1px dashed #DDD' }}>
          <Camera size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No custom photos mapped yet.</p>
          <button className="btn btn-secondary btn-sm" onClick={addMapping} style={{ marginTop: '1rem' }}>
            + Assign First Photo
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
            <div className="editor-table-header">
              <div style={{ width: '45px', flexShrink: 0 }} /> {/* Spacer for preview */}
              <div style={{ flex: '1 1 200px', minWidth: '180px' }}>Select Member</div>
              <div style={{ flex: '2 1 300px', minWidth: '220px' }}>Base URL (Repository Path)</div>
              <div style={{ flex: '1 1 150px', minWidth: '130px' }}>File Name</div>
              <div style={{ width: '30px', flexShrink: 0 }} /> {/* Spacer for delete */}
            </div>

            {/* List items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem' }}>
              {photoMappings.map((mapping, idx) => {
                const selectedPerson = profiles.find(p => p.pid === mapping.pid);
                const genderClipart = selectedPerson?.gender === 'Female' ? 'female_icon.png' : 'male_icon.png';
                const defaultPreview = `${import.meta.env.BASE_URL}icons/${genderClipart}`;
                const fullPhotoUrl = `${mapping.baseUrl.trim()}${mapping.fileName.trim()}`;
                const previewUrl = mapping.fileName.trim() ? fullPhotoUrl : defaultPreview;

                return (
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
                    {/* Photo Preview */}
                    <div style={{ 
                      width: '45px', 
                      height: '45px', 
                      borderRadius: '50%', 
                      overflow: 'hidden', 
                      border: '2px solid var(--color-line, #D3BCA2)', 
                      backgroundColor: 'white',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        onError={(e) => { e.target.src = defaultPreview; }} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </div>

                    {/* Dropdown Selection */}
                    <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                      <label className="editor-row-label">Select Member</label>
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

                    {/* Base URL Input */}
                    <div style={{ flex: '2 1 300px', minWidth: '220px' }}>
                      <label className="editor-row-label">Base URL (Repository Path)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. https://domain.com/photos/" 
                        value={mapping.baseUrl} 
                        onChange={e => updateMapping(idx, 'baseUrl', e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '6px', height: '40px', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* File Name Input */}
                    <div style={{ flex: '1 1 150px', minWidth: '130px' }}>
                      <label className="editor-row-label">File Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. PID0001.jpg" 
                        value={mapping.fileName} 
                        onChange={e => updateMapping(idx, 'fileName', e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '6px', height: '40px', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Delete button */}
                    <button 
                      type="button" 
                      className="editor-trash-btn" 
                      onClick={() => removeMapping(idx)}
                      title="Remove Photo assignment"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
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
              <Plus size={16} /> Add Another Photo
            </button>
            <button className="btn btn-primary" onClick={handleSave} style={{ padding: '0.75rem 2.5rem' }}>
              Save Photos
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoEditor;
