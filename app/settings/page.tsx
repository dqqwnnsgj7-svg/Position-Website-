'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

const CALENDAR_OPTIONS = [
  { value: 'google', label: 'Google Calendar', icon: '📅' },
  { value: 'apple', label: 'Apple Calendar', icon: '🍎' },
  { value: 'outlook', label: 'Outlook Calendar', icon: '📆' },
  { value: 'other', label: 'Other / Manual', icon: '🗓️' },
];

export default function SettingsPage() {
  const { status } = useSession({ required: true });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [calendarPref, setCalendarPref] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/settings').then((r) => r.json()).then((d) => {
        setName(d.name || '');
        setEmail(d.email || '');
        setCalendarPref(d.calendarPreference || '');
      });
    }
  }, [status]);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg('');
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, calendarPreference: calendarPref }),
    });
    setProfileSaving(false);
    setProfileMsg('Saved!');
    setTimeout(() => setProfileMsg(''), 2500);
  };

  const savePassword = async () => {
    setPasswordError('');
    setPasswordMsg('');
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return; }
    setPasswordSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setPasswordSaving(false);
    if (!res.ok) { setPasswordError(data.error); return; }
    setPasswordMsg('Password updated!');
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setTimeout(() => setPasswordMsg(''), 2500);
  };

  if (status === 'loading') return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div className="fade-in">
          <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Dashboard
          </Link>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '2rem' }}>Account Settings</h1>

          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Profile</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="label">Name</label>
                <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="label">Email address</label>
                <input className="input" type="email" value={email} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.375rem' }}>Email cannot be changed.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button className="btn-primary" onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : 'Save profile'}
                </button>
                {profileMsg && <span style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 500 }}>✓ {profileMsg}</span>}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>Calendar Preference</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              When you accept a candidate for interview, Position will use your preferred calendar to help you schedule.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {CALENDAR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCalendarPref(opt.value)}
                  style={{
                    background: calendarPref === opt.value ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'var(--surface-2)',
                    border: calendarPref === opt.value ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                    borderRadius: '0.875rem',
                    padding: '0.875rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontFamily: 'inherit',
                    transition: 'all 150ms',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>{opt.icon}</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: calendarPref === opt.value ? 'var(--accent)' : 'var(--text-primary)' }}>{opt.label}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button className="btn-primary" onClick={saveProfile} disabled={profileSaving}>Save preference</button>
              {profileMsg && <span style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 500 }}>✓ Saved</span>}
            </div>
          </div>

          <div className="card" style={{ padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Change Password</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="label">Current password</label>
                <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
              </div>
              <div>
                <label className="label">New password</label>
                <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
              </div>
              {passwordError && (
                <div style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', borderRadius: '0.75rem', padding: '0.75rem 1rem', color: 'var(--danger)', fontSize: '0.875rem' }}>
                  {passwordError}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button className="btn-primary" onClick={savePassword} disabled={passwordSaving || !currentPassword || !newPassword}>
                  {passwordSaving ? 'Saving…' : 'Update password'}
                </button>
                {passwordMsg && <span style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 500 }}>✓ {passwordMsg}</span>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
