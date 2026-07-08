import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Heart, Calendar, User, Search, X, Eye, EyeOff, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { saveProfiles } from '../lib/api';
import SearchableSelect from '../components/SearchableSelect';

const Memories = ({ profiles, setProfiles, setSavedProfilesBaseline, setFocusedPid }) => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // Filter and view states
  const [filterPid, setFilterPid] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'gallery'
  const [showShareModal, setShowShareModal] = useState(false);
  const [expandedMemories, setExpandedMemories] = useState({});

  // Share form states
  const [formPid, setFormPid] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formPasscode, setFormPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  // Edit memory states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);
  const [editPid, setEditPid] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editPasscode, setEditPasscode] = useState('');
  const [showEditPasscode, setShowEditPasscode] = useState(false);

  // Delete memory states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingMemory, setDeletingMemory] = useState(null);
  const [deletePasscode, setDeletePasscode] = useState('');
  const [showDeletePasscode, setShowDeletePasscode] = useState(false);
  
  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }

  // Handle pre-selected member from location state (redirected from Sidebar)
  useEffect(() => {
    if (location.state && location.state.preselectPid) {
      setFilterPid(location.state.preselectPid);
      setFormPid(location.state.preselectPid);
      if (location.state.openForm) {
        setShowShareModal(true);
      }
      // Clear state so reload doesn't trigger again
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Flatten and sort memories
  const allMemories = useMemo(() => {
    const list = [];
    profiles.forEach(p => {
      if (p.memories && Array.isArray(p.memories)) {
        p.memories.forEach(m => {
          list.push({
            ...m,
            targetPerson: p
          });
        });
      }
    });

    // Sort by date descending, then ID descending
    return list.sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
  }, [profiles]);

  // Filtered memories list
  const filteredMemories = useMemo(() => {
    if (!filterPid) return allMemories;
    return allMemories.filter(m => m.targetPerson.pid === filterPid);
  }, [allMemories, filterPid]);

  // Displayed memories based on view mode (list vs gallery)
  const displayedMemories = useMemo(() => {
    if (viewMode === 'gallery') {
      return filteredMemories.filter(m => m.imageUrl && m.imageUrl.trim() !== '');
    }
    return filteredMemories;
  }, [filteredMemories, viewMode]);

  // Person dropdown options
  const personOptions = useMemo(() => {
    return [...profiles]
      .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))
      .map(p => ({
        value: p.pid,
        label: `${p.firstName} ${p.surName} (${p.pid})`
      }));
  }, [profiles]);

  // Toggle read more/less
  const toggleExpand = (id) => {
    setExpandedMemories(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Form submit handler
  const handlePublish = async (e) => {
    e.preventDefault();
    if (!formPid || !formTitle.trim() || !formContent.trim() || !formAuthor.trim() || !formPasscode.trim()) {
      setToast({ message: 'Please fill in all fields.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    const newMemory = {
      id: 'mem_' + Date.now(),
      title: formTitle.trim(),
      content: formContent.trim(),
      author: formAuthor.trim(),
      date: new Date().toISOString().split('T')[0],
      imageUrl: formImageUrl.trim() || undefined
    };

    const updatedProfiles = profiles.map(p => {
      if (p.pid === formPid) {
        const memories = p.memories ? [...p.memories] : [];
        return { ...p, memories: [...memories, newMemory] };
      }
      return p;
    });

    try {
      // Validate password and update database remotely
      await saveProfiles(updatedProfiles, formPasscode);
      setProfiles(updatedProfiles);
      if (setSavedProfilesBaseline) {
        setSavedProfilesBaseline(updatedProfiles);
      }
      
      setToast({ message: t('memories.toast_success'), type: 'success' });
      
      // Reset form and close modal
      setFormTitle('');
      setFormContent('');
      setFormImageUrl('');
      setFormPasscode('');
      setShowShareModal(false);
    } catch (err) {
      setToast({ 
        message: t('memories.toast_error').replace('{error}', err.message), 
        type: 'error' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (memory) => {
    setEditingMemory(memory);
    setEditPid(memory.targetPerson.pid);
    setEditTitle(memory.title);
    setEditContent(memory.content);
    setEditAuthor(memory.author);
    setEditImageUrl(memory.imageUrl || '');
    setEditPasscode('');
    setShowEditPasscode(false);
    setShowEditModal(true);
  };

  const handleOpenDeleteModal = (memory) => {
    setDeletingMemory(memory);
    setDeletePasscode('');
    setShowDeletePasscode(false);
    setShowDeleteModal(true);
  };

  const handleUpdateMemory = async (e) => {
    e.preventDefault();
    if (!editPid || !editTitle.trim() || !editContent.trim() || !editAuthor.trim() || !editPasscode.trim()) {
      setToast({ message: 'Please fill in all fields.', type: 'error' });
      return;
    }

    setIsSubmitting(true);

    const updatedProfiles = profiles.map(p => {
      let memories = p.memories ? [...p.memories] : [];
      
      if (p.pid === editingMemory.targetPerson.pid) {
        memories = memories.filter(m => m.id !== editingMemory.id);
      }

      if (p.pid === editPid) {
        const updatedItem = {
          id: editingMemory.id,
          title: editTitle.trim(),
          content: editContent.trim(),
          author: editAuthor.trim(),
          date: editingMemory.date,
          imageUrl: editImageUrl.trim() || undefined
        };
        memories.push(updatedItem);
      }

      return { ...p, memories };
    });

    try {
      await saveProfiles(updatedProfiles, editPasscode);
      setProfiles(updatedProfiles);
      if (setSavedProfilesBaseline) {
        setSavedProfilesBaseline(updatedProfiles);
      }
      setToast({ message: t('memories.toast_edit_success') || 'Memory updated successfully!', type: 'success' });
      setShowEditModal(false);
    } catch (err) {
      setToast({
        message: t('memories.toast_error').replace('{error}', err.message),
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMemory = async (e) => {
    e.preventDefault();
    if (!deletePasscode.trim()) {
      setToast({ message: 'Please enter passcode.', type: 'error' });
      return;
    }

    setIsSubmitting(true);

    const updatedProfiles = profiles.map(p => {
      if (p.pid === deletingMemory.targetPerson.pid) {
        const memories = (p.memories ? [...p.memories] : [])
          .filter(m => m.id !== deletingMemory.id);
        return { ...p, memories };
      }
      return p;
    });

    try {
      await saveProfiles(updatedProfiles, deletePasscode);
      setProfiles(updatedProfiles);
      if (setSavedProfilesBaseline) {
        setSavedProfilesBaseline(updatedProfiles);
      }
      setToast({ message: t('memories.toast_delete_success') || 'Memory deleted successfully!', type: 'success' });
      setShowDeleteModal(false);
    } catch (err) {
      setToast({
        message: t('memories.toast_error').replace('{error}', err.message),
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ paddingBottom: '4rem', position: 'relative' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '5rem',
          right: '2rem',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: toast.type === 'success' ? '#27ae60' : '#c0392b',
          color: 'white',
          padding: '0.85rem 1.5rem',
          borderRadius: '10px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          fontSize: '0.9rem',
          fontWeight: 600,
          animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h2 style={{ color: 'var(--color-maroon)', fontSize: '2.2rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
          ✨ {t('memories.title')}
        </h2>
        <p style={{ color: '#666', fontSize: '0.98rem', maxWidth: '600px', margin: '0 auto' }}>
          {t('memories.subtitle')}
        </p>
      </div>

      {/* Control Bar (Filter & Add Button) */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.25rem',
        marginBottom: '2rem',
        backgroundColor: 'white',
        padding: '1.25rem',
        borderRadius: '12px',
        border: '1px solid rgba(99, 19, 29, 0.08)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
      }}>
        
        {/* Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px', maxWidth: '460px' }}>
          <label style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-maroon)', whiteSpace: 'nowrap' }}>
            {t('memories.filter_label')}
          </label>
          <div style={{ flex: 1 }}>
            <SearchableSelect 
              options={[
                { value: '', label: `✨ ${t('memories.filter_placeholder')}` },
                ...personOptions
              ]}
              value={filterPid}
              onChange={(e) => setFilterPid(e.target.value)}
              placeholder={t('memories.filter_placeholder')}
            />
          </div>
        </div>

        {/* View Mode Toggle */}
        <div style={{ 
          display: 'flex', 
          gap: '0.25rem', 
          backgroundColor: '#FAF8F5', 
          padding: '0.25rem', 
          borderRadius: '8px', 
          border: '1px solid var(--color-sandalwood, #EADDCA)' 
        }}>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'list' ? 'var(--color-maroon, #63131D)' : 'transparent',
              color: viewMode === 'list' ? 'var(--color-gold, #D4AF37)' : '#666',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            📝 {t('memories.view_list') || 'All Memories'}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('gallery')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'gallery' ? 'var(--color-maroon, #63131D)' : 'transparent',
              color: viewMode === 'gallery' ? 'var(--color-gold, #D4AF37)' : '#666',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🖼️ {t('memories.view_gallery') || 'Photo Gallery'}
          </button>
        </div>

        {/* Share Memory Button */}
        <button 
          onClick={() => {
            // Pre-select if we already filtered, otherwise clear
            setFormPid(filterPid);
            setShowShareModal(true);
          }}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--color-maroon)',
            color: 'var(--color-gold)',
            border: 'none',
            borderRadius: '30px',
            cursor: 'pointer',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 10px rgba(99, 19, 29, 0.2)',
            transition: 'all 0.2s'
          }}
        >
          <Plus size={18} />
          {t('memories.btn_share')}
        </button>
      </div>

      {/* Empty State */}
      {displayedMemories.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#777' }}>
          <BookOpen size={48} style={{ color: 'var(--color-sandalwood)', marginBottom: '1rem', opacity: 0.7 }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>
            {viewMode === 'gallery' 
              ? 'No photos in the gallery yet. Start sharing memories with photos to see them here!'
              : (filterPid ? t('memories.no_memories') : t('memories.no_memories_general'))}
          </p>
        </div>
      )}

      {/* Memories Grid Wall */}
      {displayedMemories.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {displayedMemories.map(m => {
            const isLong = m.content.length > 250;
            const isExpanded = expandedMemories[m.id];
            const displayContent = isLong && !isExpanded 
              ? `${m.content.slice(0, 240)}...`
              : m.content;

            const targetAvatar = m.targetPerson.photoUrl
              ? m.targetPerson.photoUrl
              : `${import.meta.env.BASE_URL}icons/${m.targetPerson.gender === 'Male' ? 'male_icon.png' : 'female_icon.png'}`;

            return (
              <div key={m.id} className="card" style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '14px',
                border: '1.5px solid var(--color-sandalwood, #EADDCA)',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                padding: 0
              }}>
                {/* Card Target Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 1.25rem',
                  backgroundColor: '#FCFAF7',
                  borderBottom: '1px solid #F3EDE4'
                }}>
                  {/* Small Avatar of member */}
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: `2px solid ${m.targetPerson.gender === 'Male' ? '#7BAFF8' : '#F5A3B1'}`,
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }} onClick={() => {
                    // Navigate to tree focused on this person
                    if (setFocusedPid) setFocusedPid(m.targetPerson.pid);
                    localStorage.setItem('vamsha_home_pid', m.targetPerson.pid);
                    navigate('/tree');
                  }}>
                    <img src={targetAvatar} alt={m.targetPerson.firstName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#999', fontWeight: 600 }}>{t('memories.about_person').replace('{name}', '')}</div>
                    <span 
                      onClick={() => {
                        if (setFocusedPid) setFocusedPid(m.targetPerson.pid);
                        localStorage.setItem('vamsha_home_pid', m.targetPerson.pid);
                        navigate('/tree');
                      }}
                      style={{ 
                        fontWeight: 700, 
                        color: 'var(--color-maroon)', 
                        cursor: 'pointer',
                        textDecoration: 'underline dotted',
                        fontSize: '0.92rem'
                      }}
                    >
                      {m.targetPerson.firstName} {m.targetPerson.surName}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--color-dark)', fontSize: '1.1rem', fontWeight: 700 }}>
                    {m.title}
                  </h3>

                  {m.imageUrl && (
                    <div style={{
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid var(--color-sandalwood, #EADDCA)',
                      marginTop: '0.5rem',
                      marginBottom: '0.5rem',
                      maxHeight: '260px',
                      backgroundColor: '#FAF8F5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img 
                        src={m.imageUrl} 
                        alt={m.title} 
                        style={{ 
                          width: '100%', 
                          maxHeight: '260px', 
                          objectFit: 'contain' 
                        }} 
                      />
                    </div>
                  )}
                  
                  <p style={{ 
                    fontSize: '0.88rem', 
                    color: '#444', 
                    whiteSpace: 'pre-wrap', 
                    lineHeight: '1.5',
                    flex: 1,
                    margin: '0.5rem 0'
                  }}>
                    {displayContent}
                  </p>

                  {/* Read More button */}
                  {isLong && (
                    <button 
                      onClick={() => toggleExpand(m.id)}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-maroon)',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        padding: 0,
                        marginTop: '-0.25rem',
                        marginBottom: '0.5rem'
                      }}
                    >
                      {isExpanded ? t('memories.read_less') : t('memories.read_more')}
                    </button>
                  )}

                  {/* Author / Footer */}
                  <div style={{ 
                    borderTop: '1px solid #f2ece4', 
                    paddingTop: '0.75rem', 
                    marginTop: '0.5rem',
                    fontSize: '0.78rem',
                    color: '#777',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>🖋️ {m.author}</span>
                      <span>📅 {m.date}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleOpenEditModal(m)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#8C7A70',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          transition: 'color 0.2s'
                        }}
                        title={t('memories.edit_title')}
                      >
                        ✏️ {t('nav.edit') || 'Edit'}
                      </button>
                      <button
                        onClick={() => handleOpenDeleteModal(m)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#8C7A70',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          transition: 'color 0.2s'
                        }}
                        title={t('memories.delete_title')}
                      >
                        🗑️ {t('nav.delete') || 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share Memory Modal */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1500,
          padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '500px',
            width: '100%',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 15px 40px rgba(0,0,0,0.25)',
            border: '1.5px solid var(--color-sandalwood)',
            maxHeight: '90vh',
            overflowY: 'auto',
            animation: 'modalFadeUp 0.25s ease-out'
          }}>
            <style>{`
              @keyframes modalFadeUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--color-maroon)', fontSize: '1.3rem', fontWeight: 800 }}>
                ✍️ {t('memories.share_title')}
              </h3>
              <button 
                onClick={() => setShowShareModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Select Member */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  {t('memories.form_member')} <span style={{ color: 'red' }}>*</span>
                </label>
                <SearchableSelect 
                  options={personOptions}
                  value={formPid}
                  onChange={(e) => setFormPid(e.target.value)}
                  placeholder="-- Select Member --"
                />
              </div>

              {/* Title */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  {t('memories.form_title')} <span style={{ color: 'red' }}>*</span>
                </label>
                <input 
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('memories.form_title_placeholder')}
                  required
                />
              </div>

              {/* Content */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  {t('memories.form_content')} <span style={{ color: 'red' }}>*</span>
                </label>
                <textarea 
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder={t('memories.form_content_placeholder')}
                  rows={4}
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Author */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  {t('memories.form_author')} <span style={{ color: 'red' }}>*</span>
                </label>
                <input 
                  type="text"
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                  placeholder={t('memories.form_author_placeholder')}
                  required
                />
              </div>

              {/* Photo URL (Optional) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  🖼️ {t('memories.form_photo_url') || 'Photo URL (Optional)'}
                </label>
                <input 
                  type="text"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="Paste Cloudinary image URL (upload first in Cloudinary Tools)"
                />
              </div>

              {/* Passcode (Required for authorization) */}
              <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  🔒 {t('memories.form_passcode')} <span style={{ color: 'red' }}>*</span>
                </label>
                <input 
                  type={showPasscode ? "text" : "password"}
                  value={formPasscode}
                  onChange={(e) => setFormPasscode(e.target.value)}
                  placeholder={t('memories.form_passcode_placeholder')}
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(v => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    bottom: '0.65rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#888'
                  }}
                >
                  {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isSubmitting}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {isSubmitting ? 'Publishing...' : t('memories.btn_submit')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowShareModal(false)}
                  disabled={isSubmitting}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {t('memories.btn_cancel')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Edit Memory Modal */}
      {showEditModal && editingMemory && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1500,
          padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '500px',
            width: '100%',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 15px 40px rgba(0,0,0,0.25)',
            border: '1.5px solid var(--color-sandalwood)',
            maxHeight: '90vh',
            overflowY: 'auto',
            animation: 'modalFadeUp 0.25s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--color-maroon)', fontSize: '1.3rem', fontWeight: 800 }}>
                ✏️ {t('memories.edit_title')}
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateMemory} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Select Member */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  {t('memories.form_member')} <span style={{ color: 'red' }}>*</span>
                </label>
                <SearchableSelect 
                  options={personOptions}
                  value={editPid}
                  onChange={(e) => setEditPid(e.target.value)}
                  placeholder="-- Select Member --"
                />
              </div>

              {/* Title */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  {t('memories.form_title')} <span style={{ color: 'red' }}>*</span>
                </label>
                <input 
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t('memories.form_title_placeholder')}
                  required
                />
              </div>

              {/* Content */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  {t('memories.form_content')} <span style={{ color: 'red' }}>*</span>
                </label>
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder={t('memories.form_content_placeholder')}
                  rows={4}
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Author */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  {t('memories.form_author')} <span style={{ color: 'red' }}>*</span>
                </label>
                <input 
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  placeholder={t('memories.form_author_placeholder')}
                  required
                />
              </div>

              {/* Photo URL (Optional) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  🖼️ {t('memories.form_photo_url') || 'Photo URL (Optional)'}
                </label>
                <input 
                  type="text"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="Paste Cloudinary image URL here"
                />
              </div>

              {/* Passcode */}
              <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  🔒 {t('memories.form_passcode')} <span style={{ color: 'red' }}>*</span>
                </label>
                <input 
                  type={showEditPasscode ? "text" : "password"}
                  value={editPasscode}
                  onChange={(e) => setEditPasscode(e.target.value)}
                  placeholder={t('memories.form_passcode_placeholder')}
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowEditPasscode(v => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    bottom: '0.65rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#888'
                  }}
                >
                  {showEditPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isSubmitting}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {isSubmitting ? 'Saving...' : t('memories.btn_save')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmitting}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {t('memories.btn_cancel')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Delete Memory Modal */}
      {showDeleteModal && deletingMemory && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1500,
          padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '420px',
            width: '100%',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 15px 40px rgba(0,0,0,0.25)',
            border: '1.5px solid var(--color-sandalwood)',
            animation: 'modalFadeUp 0.25s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '2px solid var(--color-sandalwood)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#c0392b', fontSize: '1.25rem', fontWeight: 800 }}>
                🗑️ {t('memories.delete_title')}
              </h3>
              <button 
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#444', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              {t('memories.delete_confirm')}
            </p>

            {/* Modal Form */}
            <form onSubmit={handleDeleteMemory} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Passcode */}
              <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                <label style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'block', fontSize: '0.88rem' }}>
                  🔒 {t('memories.form_passcode_delete') || 'Enter Passcode to Delete'} <span style={{ color: 'red' }}>*</span>
                </label>
                <input 
                  type={showDeletePasscode ? "text" : "password"}
                  value={deletePasscode}
                  onChange={(e) => setDeletePasscode(e.target.value)}
                  placeholder={t('memories.form_passcode_placeholder')}
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePasscode(v => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    bottom: '0.65rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#888'
                  }}
                >
                  {showDeletePasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={isSubmitting}
                  style={{ 
                    flex: 1, 
                    justifyContent: 'center',
                    backgroundColor: '#c0392b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? 'Deleting...' : t('memories.btn_delete')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isSubmitting}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {t('memories.btn_cancel')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default Memories;
