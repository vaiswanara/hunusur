import React, { useState, useEffect } from 'react';
import { getPendingSubmissions, deletePendingSubmission } from '../lib/api';
import { Trash2, UserCheck, Clock, Phone, Mail, Calendar, MapPin, User } from 'lucide-react';
import { getAdminPassword } from './AdminGate';

const PendingReview = ({ profiles = [], onReviewImport }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const adminPassword = getAdminPassword();

  const fetchList = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPendingSubmissions(adminPassword);
      // Sort submissions by submittedAt desc
      const sorted = [...data].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setSubmissions(sorted);
    } catch (err) {
      setError(err.message || 'Failed to fetch pending submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleReject = async (pendingId, firstName) => {
    if (!window.confirm(`Are you sure you want to reject and delete the submission for "${firstName}"? This will delete any uploaded temporary photo too.`)) {
      return;
    }

    setActionLoading(true);
    try {
      await deletePendingSubmission(pendingId, adminPassword);
      setSubmissions(prev => prev.filter(sub => sub.pendingId !== pendingId));
      alert('Submission successfully deleted.');
    } catch (err) {
      alert(`Error deleting submission: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <span className="save-spinner" style={{
          width: 32, height: 32, border: '3px solid rgba(99,19,29,0.2)',
          borderTopColor: 'var(--color-maroon, #63131D)', borderRadius: '50%',
          animation: 'saveSpin 0.7s linear infinite', display: 'inline-block'
        }} />
        <p style={{ marginTop: '1rem', color: '#666', fontWeight: '600' }}>Loading pending submissions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '1.5rem',
        borderRadius: '12px',
        backgroundColor: '#FDF2F2',
        border: '1px solid #FDE8E8',
        color: '#9B1C1C',
        textAlign: 'center',
        margin: '1.5rem 0'
      }}>
        <p style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>Could not load submissions</p>
        <p style={{ fontSize: '0.88rem', margin: '0 0 1rem 0' }}>{error}</p>
        <button onClick={fetchList} className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
          Try Again
        </button>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '4rem 2rem',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px dashed var(--color-sandalwood, #EADDCA)',
        marginTop: '1rem'
      }}>
        <span style={{ fontSize: '3rem' }}>🎉</span>
        <h3 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--color-maroon, #63131D)', fontWeight: '800' }}>
          All caught up!
        </h3>
        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
          There are no pending submissions in the queue. New submissions from family members will show up here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-sandalwood, #EADDCA)', paddingBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, color: 'var(--color-maroon, #63131D)', fontWeight: '800' }}>
          Review Submissions ({submissions.length})
        </h3>
        <button onClick={fetchList} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '1rem'
      }}>
        {submissions.map(sub => {
          const defaultAvatar = sub.gender === 'Female' ? 'icons/female_icon.png' : 'icons/male_icon.png';
          const displayPhoto = sub.photoUrl || defaultAvatar;
          const formattedDate = sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A';

          return (
            <div key={sub.pendingId} style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid var(--color-sandalwood, #EADDCA)',
              boxShadow: '0 4px 12px rgba(99, 19, 29, 0.04)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}>
              
              {/* Submission Date Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.7rem',
                color: '#888',
                marginBottom: '0.75rem',
                borderBottom: '1px solid #FAF6F0',
                paddingBottom: '0.4rem'
              }}>
                <Clock size={12} />
                <span>Submitted: {formattedDate}</span>
              </div>

              {/* Main Content Info */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                
                {/* Submitted Photo */}
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid var(--color-sandalwood, #EADDCA)',
                  backgroundColor: '#FAF8F5',
                  flexShrink: 0
                }}>
                  <img src={displayPhoto} alt="Submitter Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                {/* Submitter details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: 'var(--color-maroon, #63131D)' }}>
                    {sub.firstName} {sub.surName}
                  </h4>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      color: sub.gender === 'Female' ? '#C2185B' : '#0288D1',
                      backgroundColor: sub.gender === 'Female' ? '#FCE4EC' : '#E1F5FE',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      width: 'fit-content'
                    }}>
                      {sub.gender}
                    </span>
                    {sub.isUpdateOfPid && (
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        color: '#D35400',
                        backgroundColor: '#FDEBD0',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        width: 'fit-content'
                      }}>
                        ✏️ Modify PID: {sub.isUpdateOfPid}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem', fontSize: '0.78rem', color: '#555' }}>
                    {sub.birthDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={12} color="#888" />
                        <span>Birth: {sub.birthDate} {sub.birthPlace ? `(${sub.birthPlace})` : ''}</span>
                      </div>
                    )}
                    {sub.gotra && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <User size={12} color="#888" />
                        <span>Gotra: {sub.gotra}</span>
                      </div>
                    )}
                    {(sub.nakshatra || sub.rashi) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#777', fontSize: '0.75rem' }}>
                        <span>✨ Astro: {sub.nakshatra || 'N/A'} - {sub.rashi || 'N/A'}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Relationship declarations */}
              <div style={{
                backgroundColor: '#FAF8F5',
                borderRadius: '8px',
                padding: '0.6rem 0.75rem',
                marginBottom: '1rem',
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                border: '1px solid #FAF6F0'
              }}>
                <span style={{ fontWeight: '800', color: 'var(--color-dark, #2C1818)', fontSize: '0.72rem', borderBottom: '1px dashed #EADDCA', paddingBottom: '0.15rem', marginBottom: '0.15rem' }}>
                  Declared Family Connections:
                </span>
                <div><strong>Father:</strong> {sub.fatherNameText || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Not specified</span>}</div>
                <div><strong>Mother:</strong> {sub.motherNameText || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Not specified</span>}</div>
                <div><strong>Spouse:</strong> {sub.spouseNameText || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Not specified</span>}</div>
              </div>

              {sub.submissionNote && (
                <div style={{
                  backgroundColor: '#FFFDEB',
                  border: '1px solid #FFEAA7',
                  borderRadius: '8px',
                  padding: '0.6rem 0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.78rem',
                  color: '#634A00',
                  boxSizing: 'border-box'
                }}>
                  <strong style={{ display: 'block', marginBottom: '0.15rem' }}>Message from User:</strong>
                  {sub.submissionNote}
                </div>
              )}

              {/* Contact info footer */}
              {(sub.phone || sub.email) && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#666',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.6rem',
                  marginBottom: '1rem',
                  borderTop: '1px solid #FAF6F0',
                  paddingTop: '0.4rem'
                }}>
                  {sub.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Phone size={12} />
                      <span>{sub.phone}</span>
                    </div>
                  )}
                  {sub.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', wordBreak: 'break-all' }}>
                      <Mail size={12} />
                      <span>{sub.email}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Card Actions */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: 'auto',
                borderTop: '1px solid #FAF6F0',
                paddingTop: '0.75rem'
              }}>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => onReviewImport(sub)}
                  style={{
                    flex: 1.5,
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-maroon, #63131D)',
                    color: 'var(--color-gold, #D4AF37)',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    transition: 'background-color 0.2s'
                  }}
                  className="antigravity-upload-btn-enabled"
                >
                  <UserCheck size={14} /> Review & Import
                </button>
                
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleReject(sub.pendingId, sub.firstName)}
                  style={{
                    flex: 0.8,
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #EF4444',
                    backgroundColor: 'white',
                    color: '#EF4444',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.2s'
                  }}
                  className="antigravity-btn-danger"
                >
                  <Trash2 size={14} /> Reject
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PendingReview;
