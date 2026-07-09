import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { decryptData } from '../lib/crypto';
import { isStaticHosting, getApiUrl, getSettingsUrl } from '../lib/api';

const STORAGE_KEY = 'vamsha_decrypt_pwd';

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default function DecryptionGate({ rawData, loadError, onDecrypt, children }) {
  // Check if encryption is active on the raw data
  const isEncrypted = rawData && rawData.encrypted === true;
  
  const isStatic = isStaticHosting();
  const [localSettings, setLocalSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(!isStatic);

  useEffect(() => {
    if (isStatic) return;
    const settingsUrl = getSettingsUrl();
    const savedPwd = localStorage.getItem(STORAGE_KEY) || '';
    
    const headers = {};
    if (savedPwd) {
      headers['X-Family-Password'] = savedPwd;
      headers['X-Admin-Password'] = savedPwd;
    }

    fetch(settingsUrl, { headers })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authorized');
      })
      .then(data => {
        setLocalSettings(data);
        setLoadingSettings(false);
      })
      .catch(err => {
        if (err.message.includes('401') || err.message.toLowerCase().includes('authorized')) {
          setLocalSettings({ requireFamilyLockOnPhp: true });
        }
        setLoadingSettings(false);
      });
  }, [isStatic]);

  const requireLockOnPhp = window.VAMSHA_CONFIG?.requireFamilyLockOnPhp === true || 
                           window.VAMSHA_CONFIG?.requireFamilyLockOnPhp === 'true' ||
                           import.meta.env.VITE_REQUIRE_FAMILY_LOCK_ON_PHP === true ||
                           import.meta.env.VITE_REQUIRE_FAMILY_LOCK_ON_PHP === 'true' ||
                           localSettings?.requireFamilyLockOnPhp === true;

  const familyPasswordHash = (isStatic || requireLockOnPhp) ? (window.VAMSHA_CONFIG?.familyPasswordHash || '') : '';
  const familyBranches = { 
    ...(window.VAMSHA_CONFIG?.familyBranches || {}), 
    ...(localSettings?.familyBranches || {}) 
  };
  const hasBranches = Object.keys(familyBranches).length > 0;
  const hasHashLock = !!familyPasswordHash;
  
  // Detect server-side authentication error
  const isAuthError = loadError && (
    loadError.includes('401') || 
    loadError.toLowerCase().includes('password') || 
    loadError.toLowerCase().includes('unauthorized')
  );

  const isLocked = isEncrypted || hasHashLock || hasBranches || isAuthError;

  const adminEmail = window.VAMSHA_CONFIG?.adminContactEmail || '';
  const adminPhone = window.VAMSHA_CONFIG?.adminContactPhone || '';

  const [decryptedData, setDecryptedData] = useState(null);
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef();

  const onDecryptRef = useRef(onDecrypt);
  useEffect(() => {
    onDecryptRef.current = onDecrypt;
  }, [onDecrypt]);

  // If the data is not locked, decrypt/pass through immediately
  useEffect(() => {
    if (!loadingSettings && !isLocked) {
      onDecryptRef.current(rawData, null, null);
      setDecryptedData(rawData);
    }
  }, [rawData, isLocked, loadingSettings]);

  // Attempt decryption/verification using stored local password if available on mount
  useEffect(() => {
    if (isLocked) {
      const savedPwd = localStorage.getItem(STORAGE_KEY);
      if (savedPwd) {
        setVerifying(true);
        (async () => {
          try {
            if (isStatic || import.meta.env.DEV) {
              const hash = await sha256(savedPwd);
              let matchedBranchId = null;
              let matchedRootPid = null;
              let isValid = false;
              let isAdmin = false;

              if (familyPasswordHash && hash === familyPasswordHash) {
                isValid = true;
              } else if (hasBranches) {
                for (const [branchId, branchConfig] of Object.entries(familyBranches)) {
                  if (branchConfig.passwordHash && hash === branchConfig.passwordHash) {
                    matchedBranchId = branchId;
                    matchedRootPid = branchConfig.rootPid;
                    isValid = true;
                    break;
                  }
                }
              }

              const expectedAdminHash = window.VAMSHA_CONFIG?.adminPasswordHash || 
                                        import.meta.env.VITE_ADMIN_PASSWORD_HASH ||
                                        'b00bf843729cf97e8025fdcecf3aa62a50b21969d35d18b4ed5952c171f85016';
              if (hash === expectedAdminHash) {
                isValid = true;
                isAdmin = true;
              }

              if (!isValid) {
                throw new Error('Invalid saved password');
              }

              let parsed = rawData;
              if (isEncrypted) {
                const decryptedText = await decryptData(rawData.data, savedPwd);
                parsed = JSON.parse(decryptedText);
              }

              if (matchedBranchId) {
                localStorage.setItem('vamsha_active_branch_id', matchedBranchId);
                localStorage.setItem('vamsha_active_branch_root_pid', matchedRootPid);
              } else {
                localStorage.removeItem('vamsha_active_branch_id');
                localStorage.removeItem('vamsha_active_branch_root_pid');
              }

              if (isAdmin) {
                sessionStorage.setItem('vamsha_admin_pwd', savedPwd);
              }

              onDecryptRef.current(parsed, matchedBranchId, matchedRootPid);
              setDecryptedData(parsed);
            } else {
              // Dynamic hosting online check
              const { fetchProfiles } = await import('../lib/api');
              const data = await fetchProfiles(savedPwd);
              
              let branchId = data.activeBranchId;
              let rootPid = data.activeBranchRootPid;
              
              if (branchId === 'ADMIN') {
                sessionStorage.setItem('vamsha_admin_pwd', savedPwd);
                branchId = null;
                rootPid = null;
              } else if (branchId) {
                localStorage.setItem('vamsha_active_branch_id', branchId);
                localStorage.setItem('vamsha_active_branch_root_pid', rootPid);
              } else {
                localStorage.removeItem('vamsha_active_branch_id');
                localStorage.removeItem('vamsha_active_branch_root_pid');
              }

              onDecryptRef.current(data, branchId, rootPid);
              setDecryptedData(data);
            }
          } catch (e) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('vamsha_active_branch_id');
            localStorage.removeItem('vamsha_active_branch_root_pid');
            sessionStorage.removeItem('vamsha_admin_pwd');
          } finally {
            setVerifying(false);
          }
        })();
      }
    }
  }, [rawData, isLocked, hasHashLock, familyPasswordHash, hasBranches, isEncrypted, isStatic]);

  // Auto focus input on mount
  useEffect(() => {
    if (isLocked && !decryptedData && !verifying) {
      inputRef.current?.focus();
    }
  }, [isLocked, decryptedData, verifying]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pwd.trim()) return;

    setVerifying(true);
    setError('');

    try {
      const enteredPwd = pwd.trim();

      if (isStatic || import.meta.env.DEV) {
        const hash = await sha256(enteredPwd);
        let matchedBranchId = null;
        let matchedRootPid = null;
        let isValid = false;
        let isAdmin = false;

        if (familyPasswordHash && hash === familyPasswordHash) {
          isValid = true;
        } else if (hasBranches) {
          for (const [branchId, branchConfig] of Object.entries(familyBranches)) {
            if (branchConfig.passwordHash && hash === branchConfig.passwordHash) {
              matchedBranchId = branchId;
              matchedRootPid = branchConfig.rootPid;
              isValid = true;
              break;
            }
          }
        }

        const expectedAdminHash = window.VAMSHA_CONFIG?.adminPasswordHash || 
                                  import.meta.env.VITE_ADMIN_PASSWORD_HASH ||
                                  'b00bf843729cf97e8025fdcecf3aa62a50b21969d35d18b4ed5952c171f85016';
        if (hash === expectedAdminHash) {
          isValid = true;
          isAdmin = true;
        }

        if (!isValid) {
          throw new Error('Wrong password. Please try again.');
        }

        let parsed = rawData;
        if (isEncrypted) {
          const decryptedText = await decryptData(rawData.data, enteredPwd);
          parsed = JSON.parse(decryptedText);
        }

        localStorage.setItem(STORAGE_KEY, enteredPwd);
        if (matchedBranchId) {
          localStorage.setItem('vamsha_active_branch_id', matchedBranchId);
          localStorage.setItem('vamsha_active_branch_root_pid', matchedRootPid);
        } else {
          localStorage.removeItem('vamsha_active_branch_id');
          localStorage.removeItem('vamsha_active_branch_root_pid');
        }

        if (isAdmin) {
          sessionStorage.setItem('vamsha_admin_pwd', enteredPwd);
        }

        onDecryptRef.current(parsed, matchedBranchId, matchedRootPid);
        setDecryptedData(parsed);
      } else {
        // Dynamic hosting online check
        const { fetchProfiles } = await import('../lib/api');
        const data = await fetchProfiles(enteredPwd);

        localStorage.setItem(STORAGE_KEY, enteredPwd);

        let branchId = data.activeBranchId;
        let rootPid = data.activeBranchRootPid;

        if (branchId === 'ADMIN') {
          sessionStorage.setItem('vamsha_admin_pwd', enteredPwd);
          branchId = null;
          rootPid = null;
        } else if (branchId) {
          localStorage.setItem('vamsha_active_branch_id', branchId);
          localStorage.setItem('vamsha_active_branch_root_pid', rootPid);
        } else {
          localStorage.removeItem('vamsha_active_branch_id');
          localStorage.removeItem('vamsha_active_branch_root_pid');
        }

        onDecryptRef.current(data, branchId, rootPid);
        setDecryptedData(data);
      }
    } catch (err) {
      setError('Wrong password. Please try again.');
      setPwd('');
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  if (loadingSettings) {
    return null;
  }

  // If not locked or already successfully decrypted/verified, render children
  if (!isLocked || decryptedData) {
    return children;
  }


  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: 'var(--color-light, #F4EFE6)',
      fontFamily: "var(--font-main), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '3rem 3.5rem',
        width: '100%',
        maxWidth: '430px',
        boxShadow: '0 20px 60px rgba(99,19,29,0.12)',
        border: '1px solid #F0E8E0',
        textAlign: 'center',
        animation: 'decryptionGateIn 0.3s ease',
      }}>
        <style>{`
          @keyframes decryptionGateIn {
            from { transform: translateY(16px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          @keyframes decryptSpin { to { transform: rotate(360deg); } }
        `}</style>

        {/* Brand Lock Icon */}
        <div style={{
          width: 76, height: 76, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--color-maroon, #63131D), #9C2A35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: '0 8px 24px rgba(99,19,29,0.3)',
        }}>
          <Lock size={32} color="white" />
        </div>

        <h2 style={{ color: 'var(--color-maroon, #63131D)', fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Family Tree
        </h2>
        <p style={{ color: '#666', fontSize: '0.92rem', marginBottom: '2rem', lineHeight: 1.5 }}>
          This family tree is protected. Please enter the family password to view.
          {(adminEmail || adminPhone) && (
            <span style={{ 
              display: 'block', 
              marginTop: '1rem', 
              fontSize: '0.82rem', 
              color: '#777', 
              backgroundColor: '#FAF9F6', 
              padding: '0.6rem 0.8rem', 
              borderRadius: '8px', 
              border: '1px solid #EFE4DC',
              textAlign: 'left'
            }}>
              🔑 For password access, please contact the administrator:
              {adminEmail && <span style={{ display: 'block', marginTop: '4px' }}>📧 <strong>{adminEmail}</strong></span>}
              {adminPhone && <span style={{ display: 'block', marginTop: '2px' }}>📞 <strong>{adminPhone}</strong></span>}
            </span>
          )}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1.2rem' }}>
            <input
              ref={inputRef}
              type={showPwd ? 'text' : 'password'}
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(''); }}
              placeholder="Family password"
              disabled={verifying}
              style={{
                width: '100%',
                padding: '0.9rem 3rem 0.9rem 1.2rem',
                borderRadius: '10px',
                border: error ? '1.5px solid #c0392b' : '1.5px solid #E0D5CC',
                fontSize: '1rem',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s',
                background: '#FDFAF7',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              style={{
                position: 'absolute', right: '0.9rem', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#aaa',
                padding: '4px',
              }}
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p style={{
              color: '#c0392b', fontSize: '0.85rem',
              marginBottom: '1.2rem', textAlign: 'left',
              padding: '0.6rem 0.8rem',
              background: '#FFF0EE', borderRadius: '8px',
              lineHeight: 1.4
            }}>
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!pwd.trim() || verifying}
            style={{
              width: '100%',
              padding: '0.95rem',
              borderRadius: '10px',
              background: pwd.trim() && !verifying
                ? 'linear-gradient(135deg, var(--color-maroon, #63131D), #9C2A35)'
                : '#E0D5CC',
              color: pwd.trim() && !verifying ? 'white' : '#999',
              border: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: pwd.trim() && !verifying ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              transition: 'background 0.2s',
              boxShadow: pwd.trim() && !verifying ? '0 4px 12px rgba(99,19,29,0.2)' : 'none'
            }}
          >
            {verifying ? (
              <>
                <span style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'decryptSpin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
                Unlocking…
              </>
            ) : (
              'Unlock Tree'
            )}
          </button>
        </form>

        <p style={{ color: '#999', fontSize: '0.78rem', marginTop: '1.5rem' }}>
          🔒 The password will be saved securely on this device.
        </p>
      </div>
    </div>
  );
}
