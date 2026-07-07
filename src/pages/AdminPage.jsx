import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, Edit3, UserPlus, Save, CheckCircle, AlertCircle, LogOut, Camera, Moon, GitBranch, Sliders, X, Eye, EyeOff, ChevronDown, Download } from 'lucide-react';
import BulkEditor from '../components/BulkEditor';
import SingleEditor from '../components/SingleEditor';
import PhotoEditor from '../components/PhotoEditor';
import JyotishaEditor from '../components/JyotishaEditor';
import GotraEditor from '../components/GotraEditor';
import SettingsEditor from '../components/SettingsEditor';
import { saveProfiles, isStaticHosting } from '../lib/api';
import { getAdminPassword, clearAdminPassword } from '../components/AdminGate';
import { encryptData } from '../lib/crypto';

// ── Toast notification ────────────────────────────────────────────────────────
function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  const bg = type === 'success' ? '#1a7f1a' : '#c0392b';
  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div style={{
      position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      background: bg, color: 'white',
      padding: '0.9rem 1.5rem', borderRadius: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      animation: 'toastSlideIn 0.3s ease',
      maxWidth: '380px', fontSize: '0.95rem', fontWeight: 500,
    }}>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(100px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
      <Icon size={20} style={{ flexShrink: 0 }} />
      {message}
    </div>
  );
}

// ── Password Modal ────────────────────────────────────────────────────────────
function PasswordModal({ onConfirm, onCancel, saving }) {
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pwd.trim()) onConfirm(pwd.trim());
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'white', borderRadius: '14px', padding: '2rem 2.5rem',
        width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'fadeUp 0.25s ease',
      }}>
        <style>{`
          @keyframes fadeUp {
            from { transform: translateY(20px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          @keyframes saveSpin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#63131D', fontSize: '1.2rem' }}>🔒 Admin Password</h3>
          <button onClick={onCancel} disabled={saving}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>
        <p style={{ margin: '0 0 1.25rem', color: '#666', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Enter the admin password to save changes to the server.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
            <input
              ref={inputRef}
              type={showPwd ? 'text' : 'password'}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Admin password"
              disabled={saving}
              style={{
                width: '100%', padding: '0.75rem 3rem 0.75rem 1rem',
                borderRadius: '8px', border: '1.5px solid #ddd',
                fontSize: '1rem', boxSizing: 'border-box', outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              style={{
                position: 'absolute', right: '0.75rem', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', color: '#888',
              }}
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={!pwd.trim() || saving}
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {saving ? (
                <>
                  <span style={{
                    width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white', borderRadius: '50%',
                    animation: 'saveSpin 0.7s linear infinite', display: 'inline-block'
                  }} />
                  Saving…
                </>
              ) : (
                <><Save size={16} /> Save</>
              )}
            </button>
            <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
const AdminPage = ({ profiles, setProfiles, savedProfilesBaseline, setSavedProfilesBaseline }) => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('single');
  const [profileToEdit, setProfileToEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const [dataDropdownOpen, setDataDropdownOpen] = useState(false);
  const dataDropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dataDropdownRef.current && !dataDropdownRef.current.contains(event.target)) {
        setDataDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasUnsavedChanges = savedProfilesBaseline && JSON.stringify(profiles) !== JSON.stringify(savedProfilesBaseline);

  // Handle editProfile redirected from Settings Data Consistency check
  useEffect(() => {
    if (location.state && location.state.editProfile) {
      setProfileToEdit(location.state.editProfile);
      setActiveTab('single');
      // Clear history state to prevent re-triggering on reload
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSaveClick = async () => {
    const password = getAdminPassword();
    if (!password) {
      setToast({ message: '❌ Session expired. Please reload the page.', type: 'error' });
      return;
    }
    setSaving(true);

    if (isStaticHosting()) {
      try {
        // Save locally to browser (unencrypted for draft caching)
        localStorage.setItem('vamsha_local_profiles', JSON.stringify(profiles));
        if (setSavedProfilesBaseline) {
          setSavedProfilesBaseline(profiles);
        }
        setToast({ message: '✅ Changes saved locally in browser!', type: 'success' });
      } catch (err) {
        setToast({ message: `❌ Save failed: ${err.message}`, type: 'error' });
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const result = await saveProfiles(profiles, password);
      if (setSavedProfilesBaseline) {
        setSavedProfilesBaseline(profiles);
      }
      setToast({ message: `✅ Saved ${result.profiles_saved} profiles to server!`, type: 'success' });
    } catch (err) {
      setToast({ message: `❌ Save failed: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadJson = () => {
    const jsonString = JSON.stringify(profiles, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'data.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: '📥 data.json downloaded! Upload/Commit this to your GitHub/Cloudflare repository to update the live site.', type: 'success' });
  };

  const handleLogout = () => {
    clearAdminPassword();
    window.location.reload();
  };

  const handleEditFromList = (profile) => {
    setProfileToEdit(profile);
    setActiveTab('single');
  };

  const moveProfile = (index, direction) => {
    if (direction === 'up' && index > 0) {
      const newProfiles = [...profiles];
      const temp = newProfiles[index];
      newProfiles[index] = newProfiles[index - 1];
      newProfiles[index - 1] = temp;
      setProfiles(newProfiles);
    } else if (direction === 'down' && index < profiles.length - 1) {
      const newProfiles = [...profiles];
      const temp = newProfiles[index];
      newProfiles[index] = newProfiles[index + 1];
      newProfiles[index + 1] = temp;
      setProfiles(newProfiles);
    }
  };

  return (
    <div className="admin-dashboard-vertical">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}



      <div className="admin-topbar">
        <div className="admin-brand-horizontal">
          <h2>Admin Panel</h2>
        </div>
        <nav className="admin-nav-horizontal">
          <style>{`
            .mobile-only-nav {
              display: none;
            }
            .desktop-only-nav {
              display: flex;
            }
            @media (max-width: 768px) {
              .mobile-only-nav {
                display: flex;
              }
              .desktop-only-nav {
                display: none;
              }
            }
          `}</style>

          {/* Desktop Only Dropdown Menu for Data Editors */}
          <div ref={dataDropdownRef} className="desktop-only-nav" style={{ position: 'relative' }}>
            <button
              className={`admin-nav-tab ${['single', 'bulk', 'photos', 'jyotisha', 'gotra'].includes(activeTab) ? 'active' : ''}`}
              onClick={() => setDataDropdownOpen(prev => !prev)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: ['single', 'bulk', 'photos', 'jyotisha', 'gotra'].includes(activeTab) ? '3px solid var(--color-gold)' : '3px solid transparent' }}
            >
              <Edit3 size={18} /> Data <ChevronDown size={14} style={{ transform: dataDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '2px' }} />
            </button>
            
            {dataDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 100,
                backgroundColor: 'white',
                border: '1px solid var(--color-sandalwood, #EADDCA)',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(99,19,29,0.12)',
                minWidth: '220px',
                marginTop: '4px',
                padding: '0.5rem 0',
                display: 'flex',
                flexDirection: 'column',
                animation: 'navFadeIn 0.2s ease'
              }}>
                <style>{`
                  @keyframes navFadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                  .admin-submenu-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1.25rem;
                    border: none;
                    background: none;
                    font-size: 0.92rem;
                    font-weight: 500;
                    color: var(--color-dark, #333);
                    text-align: left;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.15s;
                    box-sizing: border-box;
                  }
                  .admin-submenu-item:hover {
                    background-color: #FAF4EE;
                    color: var(--color-maroon, #63131D);
                  }
                  .admin-submenu-item.active {
                    background-color: #FAF4EE;
                    color: var(--color-maroon, #63131D);
                    font-weight: 700;
                  }
                `}</style>
                <button
                  className={`admin-submenu-item ${activeTab === 'single' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('single'); setDataDropdownOpen(false); }}
                >
                  <UserPlus size={16} /> Single Profile
                </button>
                <button
                  className={`admin-submenu-item ${activeTab === 'bulk' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('bulk'); setDataDropdownOpen(false); }}
                >
                  <Edit3 size={16} /> Bulk Editing
                </button>
                <button
                  className={`admin-submenu-item ${activeTab === 'photos' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('photos'); setDataDropdownOpen(false); }}
                >
                  <Camera size={16} /> Profile Photos
                </button>
                <button
                  className={`admin-submenu-item ${activeTab === 'jyotisha' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('jyotisha'); setDataDropdownOpen(false); }}
                >
                  <Moon size={16} /> Jyotisha
                </button>
                <button
                  className={`admin-submenu-item ${activeTab === 'gotra' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('gotra'); setDataDropdownOpen(false); }}
                >
                  <GitBranch size={16} /> Gotra
                </button>
              </div>
            )}
          </div>

          {/* Mobile Only Individual Tabs */}
          <button
            className={`admin-nav-tab mobile-only-nav ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => setActiveTab('single')}
          >
            <UserPlus size={18} /> Single Profile
          </button>
          <button
            className={`admin-nav-tab mobile-only-nav ${activeTab === 'bulk' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk')}
          >
            <Edit3 size={18} /> Bulk Editing
          </button>
          <button
            className={`admin-nav-tab mobile-only-nav ${activeTab === 'photos' ? 'active' : ''}`}
            onClick={() => setActiveTab('photos')}
          >
            <Camera size={18} /> Profile Photos
          </button>
          <button
            className={`admin-nav-tab mobile-only-nav ${activeTab === 'jyotisha' ? 'active' : ''}`}
            onClick={() => setActiveTab('jyotisha')}
          >
            <Moon size={18} /> Jyotisha
          </button>
          <button
            className={`admin-nav-tab mobile-only-nav ${activeTab === 'gotra' ? 'active' : ''}`}
            onClick={() => setActiveTab('gotra')}
          >
            <GitBranch size={18} /> Gotra
          </button>

          {/* Shared Tabs */}
          <button
            className={`admin-nav-tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <Users size={18} /> Manage Profiles
          </button>
          <button
            className={`admin-nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Sliders size={18} /> Settings
          </button>
        </nav>
        <div className="admin-topbar-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {hasUnsavedChanges && (
            <span style={{ color: '#DC3545', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 'bold', marginRight: '0.4rem', backgroundColor: '#FDF2F2', padding: '0.35rem 0.65rem', borderRadius: '20px', border: '1px solid #FDE8E8' }} title="There are unsaved changes. Click Save to Server to persist.">
              ⚠️ Unsaved changes
            </span>
          )}
          <button className="btn btn-primary" onClick={handleSaveClick} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {saving ? (
              <>
                <span style={{
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'saveSpin 0.7s linear infinite', display: 'inline-block'
                }} />
                <span className="admin-btn-text">Saving…</span>
              </>
            ) : (
              <><Save size={18} /><span className="admin-btn-text">{isStaticHosting() ? 'Save Draft' : 'Save to Server'}</span></>
            )}
          </button>

          {isStaticHosting() && (
            <button className="btn btn-success" onClick={handleDownloadJson}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                backgroundColor: '#2e7d32', 
                color: 'white', 
                border: 'none',
                padding: '0.6rem 1.2rem',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(46,125,50,0.2)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.target.style.backgroundColor = '#1b5e20'}
              onMouseLeave={e => e.target.style.backgroundColor = '#2e7d32'}
            >
              <Download size={18} />
              <span className="admin-btn-text">Download data.json</span>
            </button>
          )}



          <button
            className="btn btn-secondary"
            onClick={handleLogout}
            title="Logout from Admin"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <LogOut size={16} /><span className="admin-btn-text">Logout</span>
          </button>
        </div>
      </div>

      <div className="admin-content-wide">
        {activeTab === 'single' && (
          <SingleEditor
            profiles={profiles}
            setProfiles={setProfiles}
            profileToEdit={profileToEdit}
            setProfileToEdit={setProfileToEdit}
          />
        )}

        {activeTab === 'bulk' && <BulkEditor profiles={profiles} setProfiles={setProfiles} />}

        {activeTab === 'photos' && <PhotoEditor profiles={profiles} setProfiles={setProfiles} />}

        {activeTab === 'jyotisha' && <JyotishaEditor profiles={profiles} setProfiles={setProfiles} />}

        {activeTab === 'gotra' && <GotraEditor profiles={profiles} setProfiles={setProfiles} />}

        {activeTab === 'settings' && (
          <SettingsEditor 
            profiles={profiles} 
            setProfiles={setProfiles} 
            handleEditFromList={handleEditFromList} 
          />
        )}

        {activeTab === 'list' && (() => {
          const sorted = [...profiles].sort((a, b) => `${a.firstName} ${a.surName}`.localeCompare(`${b.firstName} ${b.surName}`));
          const males = sorted.filter(p => p.gender === 'Male');
          const females = sorted.filter(p => p.gender === 'Female');

          const renderCard = (profile) => (
            <div key={profile.pid} className="profile-item-card" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              border: profile.isDeceased ? '1px solid #ddd' : '1px solid #EEE',
              borderRadius: '8px',
              backgroundColor: profile.isDeceased ? '#F5F5F5' : '#FAFAFA',
              opacity: profile.isDeceased ? 0.85 : 1,
              marginBottom: '0.5rem'
            }}>
              <div>
                <strong style={{ fontSize: '0.95rem', color: profile.isDeceased ? '#777' : '#333' }}>
                  {profile.isDeceased ? 'Late ' : ''}{profile.firstName} {profile.surName}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#999', marginLeft: '0.4rem' }}>({profile.pid})</span>
                {profile.isDeceased && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '1rem' }} title="Deceased">🪔</span>
                )}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => handleEditFromList(profile)}>Edit</button>
            </div>
          );

          return (
            <div className="card full-width-card">
              <h2 className="card-title">Manage Profiles ({profiles.length})</h2>
              <div className="profiles-split-grid">
                {/* Male Column */}
                <div>
                  <h3 style={{ color: '#4A90D9', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #B3D4F5', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    👨 Male Profiles ({males.length})
                  </h3>
                  {males.length === 0
                    ? <p style={{ color: '#aaa', fontSize: '0.9rem' }}>No male profiles</p>
                    : males.map(renderCard)
                  }
                </div>
                {/* Female Column */}
                <div>
                  <h3 style={{ color: '#C75C7A', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #F5B3C8', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    👩 Female Profiles ({females.length})
                  </h3>
                  {females.length === 0
                    ? <p style={{ color: '#aaa', fontSize: '0.9rem' }}>No female profiles</p>
                    : females.map(renderCard)
                  }
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default AdminPage;
