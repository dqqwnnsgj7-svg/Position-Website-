'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setSubmitted(true);
    if (data.resetUrl) setDevResetUrl(data.resetUrl);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Position</span>
        </Link>
        <ThemeToggle />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div className="fade-in" style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.375rem' }}>
              Reset your password
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              {submitted ? 'Check your email for instructions.' : "Enter your email and we'll send you a reset link."}
            </p>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            {!submitted ? (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label className="label">Email address</label>
                  <input className="input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                {error && (
                  <div style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', borderRadius: '0.75rem', padding: '0.75rem 1rem', color: 'var(--danger)', fontSize: '0.875rem' }}>
                    {error}
                  </div>
                )}
                <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                  {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sending…</> : 'Send reset link'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, background: 'color-mix(in srgb, var(--success) 12%, transparent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.5rem' }}>Reset link sent!</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: devResetUrl ? '1.25rem' : 0 }}>
                  If an account exists for {email}, you&apos;ll receive an email with a link to reset your password.
                </p>
                {devResetUrl && (
                  <div style={{ background: 'var(--surface-2)', borderRadius: '0.75rem', padding: '0.875rem', textAlign: 'left', marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontWeight: 600 }}>DEV MODE — Reset link (no email service configured):</p>
                    <a href={devResetUrl} style={{ color: 'var(--accent)', fontSize: '0.8rem', wordBreak: 'break-all' }}>{devResetUrl}</a>
                  </div>
                )}
              </div>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>← Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
