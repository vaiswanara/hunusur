import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Lock, TreePine } from 'lucide-react';
import { getApiUrl } from '../lib/api';


/**
 * AdminGate — wraps the Admin panel with a password screen.
 * Password is stored in sessionStorage once verified,
 * so saves within the same browser session are silent.
 *
 * The password is NOT verified client-side — the first "Save to Server"
 * action will validate it against save.php. We pre-check with a lightweight
 * ping so the gate feels instant.
 */
const STORAGE_KEY = 'vamsha_admin_pwd';

export function getAdminPassword() {
  return sessionStorage.getItem(STORAGE_KEY) ?? '';
}

export function clearAdminPassword() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export default function AdminGate({ children }) {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(STORAGE_KEY));
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (!authed) inputRef.current?.focus();
  }, [authed]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pwd.trim()) return;

    setVerifying(true);
    setError('');

    try {
      // Quick verification ping — POST empty array with provided password
      // api.php will return 401 if wrong, 200 if correct
      const IS_DEV = import.meta.env.DEV;
      const url = IS_DEV ? '/api/save' : getApiUrl();

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': pwd.trim(),
        },
        // Send current real data to avoid accidental corruption;
        // we just need the auth response, so send a harmless ping marker
        body: JSON.stringify({ __ping: true }),
      });

      if (res.status === 401) {
        setError('Wrong password. Please try again.');
        setPwd('');
        inputRef.current?.focus();
      } else {
        // Any non-401 (including 400 for invalid JSON __ping) = password OK
        sessionStorage.setItem(STORAGE_KEY, pwd.trim());
        setAuthed(true);
      }
    } catch {
      // Network error — still let them in; save will catch real errors
      sessionStorage.setItem(STORAGE_KEY, pwd.trim());
      setAuthed(true);
    } finally {
      setVerifying(false);
    }
  };

  if (authed) return children;

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '3rem 3.5rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(99,19,29,0.12)',
        border: '1px solid #F0E8E0',
        textAlign: 'center',
        animation: 'gateIn 0.3s ease',
      }}>
        <style>{`
          @keyframes gateIn {
            from { transform: translateY(16px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          @keyframes gateSpin { to { transform: rotate(360deg); } }
        `}</style>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #63131D, #9C2A35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: '0 8px 24px rgba(99,19,29,0.3)',
        }}>
          <Lock size={32} color="white" />
        </div>

        <h2 style={{ color: '#63131D', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem' }}>
          Admin Panel
        </h2>
        <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Enter your admin password to continue
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <input
              ref={inputRef}
              type={showPwd ? 'text' : 'password'}
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(''); }}
              placeholder="Admin password"
              disabled={verifying}
              style={{
                width: '100%',
                padding: '0.85rem 3rem 0.85rem 1.1rem',
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
              marginBottom: '1rem', textAlign: 'left',
              padding: '0.5rem 0.75rem',
              background: '#FFF0EE', borderRadius: '6px',
            }}>
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!pwd.trim() || verifying}
            style={{
              width: '100%',
              padding: '0.9rem',
              borderRadius: '10px',
              background: pwd.trim() && !verifying
                ? 'linear-gradient(135deg, #63131D, #9C2A35)'
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
            }}
          >
            {verifying ? (
              <>
                <span style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'gateSpin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
                Verifying…
              </>
            ) : (
              'Enter Admin Panel'
            )}
          </button>
        </form>

        <p style={{ color: '#CCC', fontSize: '0.78rem', marginTop: '1.5rem' }}>
          🔒 Session expires when you close the tab
        </p>
      </div>
    </div>
  );
}
