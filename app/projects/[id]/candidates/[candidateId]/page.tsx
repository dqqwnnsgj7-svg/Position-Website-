'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { ScoreRing } from '@/components/ScoreRing';

interface Candidate {
  id: string;
  name: string | null;
  email: string | null;
  fileName: string;
  fileMimeType: string | null;
  score: number | null;
  pros: string | null;
  cons: string | null;
  analysis: string | null;
  interviewQuestions: string | null;
  label: string | null;
  status: string;
  cultureNotes: string | null;
  rejectionEmail: string | null;
  acceptanceMessage: string | null;
  projectId: string;
}

interface Project {
  id: string;
  title: string;
  threshold: number;
  calendarPreference?: string;
}

type Step =
  | 'idle'
  | 'accept-compose'
  | 'accept-done'
  | 'reject-compose'
  | 'reject-done'
  | 'delete-confirm';

const CALENDAR_URLS: Record<string, (title: string) => string> = {
  google: (t) => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t)}`,
  apple: (t) => `webcal://calendar.apple.com/new?title=${encodeURIComponent(t)}`,
  outlook: (t) => `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(t)}`,
  other: (t) => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t)}`,
};

export default function CandidatePage({ params }: { params: { id: string; candidateId: string } }) {
  const { status } = useSession({ required: true });
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('idle');
  const [emailInput, setEmailInput] = useState('');
  const [messageText, setMessageText] = useState('');
  const [rejectionText, setRejectionText] = useState('');
  const [cultureNotes, setCultureNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [userCalPref, setUserCalPref] = useState('google');
  const [fetchError, setFetchError] = useState('');

  const fetchData = useCallback(async () => {
    setFetchError('');
    try {
      // Fetch candidate and project independently so a settings failure
      // doesn't block the page from loading.
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/projects/${params.id}/candidates/${params.candidateId}`),
        fetch(`/api/projects/${params.id}`),
      ]);

      if (!cRes.ok) {
        const err = await cRes.json().catch(() => ({}));
        setFetchError(err.error || `Could not load candidate (${cRes.status}).`);
        setLoading(false);
        return;
      }
      const c = await cRes.json();
      setCandidate(c);
      setEmailInput(c.email || '');
      setRejectionText(c.rejectionEmail || '');
      setMessageText(c.acceptanceMessage || '');
      setCultureNotes(c.cultureNotes || '');

      if (pRes.ok) {
        const p = await pRes.json();
        setProject({ id: p.id, title: p.title, threshold: p.threshold });
      }

      // Settings is optional — load in the background, never block the page
      fetch('/api/settings')
        .then((r) => r.ok ? r.json() : null)
        .then((s) => { if (s?.calendarPreference) setUserCalPref(s.calendarPreference); })
        .catch(() => {});
    } catch (err) {
      setFetchError('Could not connect to the server. Please refresh the page.');
      console.error('[fetchData]', err);
    } finally {
      setLoading(false);
    }
  }, [params.id, params.candidateId]);

  useEffect(() => {
    if (status === 'authenticated') fetchData();
  }, [status, fetchData]);

  const updateStatus = async (newStatus: string, emailVal?: string) => {
    setSaving(true);
    await fetch(`/api/projects/${params.id}/candidates/${params.candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, email: emailVal || emailInput || null }),
    });
    await fetchData();
    setSaving(false);
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    await fetch(`/api/projects/${params.id}/candidates/${params.candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cultureNotes }),
    });
    setSavingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const deleteCandidate = async () => {
    await fetch(`/api/projects/${params.id}/candidates/${params.candidateId}`, { method: 'DELETE' });
    window.location.href = `/projects/${params.id}`;
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const buildCalendarUrl = () => {
    const title = `Interview: ${candidate?.name || candidate?.fileName} — ${project?.title}`;
    const fn = CALENDAR_URLS[userCalPref] || CALENDAR_URLS.google;
    return fn(title);
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          <span className="spinner" /> Loading evaluation…
        </div>
      </div>
    );
  }

  if (fetchError || !candidate || !project) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <div style={{ width: 48, height: 48, background: 'color-mix(in srgb, var(--danger) 12%, transparent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Could not load this candidate</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 360, textAlign: 'center' }}>
          {fetchError || 'The candidate or project could not be found.'}
        </p>
        <Link href={`/projects/${params.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500 }}>
          ← Back to project
        </Link>
      </div>
    </div>
  );

  const pros: string[] = candidate.pros ? JSON.parse(candidate.pros) : [];
  const cons: string[] = candidate.cons ? JSON.parse(candidate.cons) : [];
  const questions: string[] = candidate.interviewQuestions ? JSON.parse(candidate.interviewQuestions) : [];
  const isGood = candidate.label === 'good';
  const displayName = candidate.name || candidate.fileName;
  const isImage = candidate.fileMimeType?.startsWith('image/');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ maxWidth: 840, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div className="fade-in">
          <Link href={`/projects/${params.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            {project.title}
          </Link>

          {/* Header card */}
          <div className="card" style={{ padding: '2rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
              {candidate.score !== null && <div style={{ flexShrink: 0 }}><ScoreRing score={candidate.score} size={110} /></div>}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{displayName}</h1>
                  {isGood
                    ? <span className="badge-good" style={{ fontSize: '0.875rem' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Good Candidate</span>
                    : <span className="badge-poor" style={{ fontSize: '0.875rem' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Poor Candidate</span>}
                  {candidate.status === 'accepted' && <span className="badge-accepted">Accepted</span>}
                  {candidate.status === 'rejected' && <span className="badge-rejected">Rejected</span>}
                  {candidate.status === 'thinking' && <span className="badge-thinking">Thinking About</span>}
                  {candidate.status === 'pending' && <span className="badge-pending">Pending Decision</span>}
                </div>
                {candidate.email && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '0.375rem' }}>{candidate.email}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>{candidate.fileName} · Threshold: {project.threshold}</p>
                  <a
                    href={`/api/projects/${params.id}/candidates/${params.candidateId}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={isImage ? 'View image resume' : 'View original file'}
                  >
                    <button style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '9999px', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      View Resume
                    </button>
                  </a>
                  <button
                    onClick={() => setStep('delete-confirm')}
                    style={{ background: 'transparent', border: 'none', borderRadius: '9999px', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pros / Cons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--success)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Strengths
              </h2>
              {pros.length > 0 ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {pros.map((p, i) => (
                    <li key={i} style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', gap: '0.5rem', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--success)', flexShrink: 0 }}>•</span>{p}
                    </li>
                  ))}
                </ul>
              ) : <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>None identified.</p>}
            </div>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Areas of Concern
              </h2>
              {cons.length > 0 ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {cons.map((c, i) => (
                    <li key={i} style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', gap: '0.5rem', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--danger)', flexShrink: 0 }}>•</span>{c}
                    </li>
                  ))}
                </ul>
              ) : <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>None identified.</p>}
            </div>
          </div>

          {/* Analysis */}
          {candidate.analysis && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Analysis</h2>
              <p style={{ color: 'var(--text-primary)', lineHeight: 1.75, fontSize: '0.9375rem', whiteSpace: 'pre-wrap' }}>{candidate.analysis}</p>
            </div>
          )}

          {/* Interview Questions */}
          {questions.length > 0 && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>💬</span>
                  Suggested Interview Questions
                </h2>
                <button onClick={() => copy(questions.map((q, i) => `${i + 1}. ${q}`).join('\n'), 'questions')}
                  style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '9999px', padding: '0.35rem 0.875rem', fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {copied === 'questions' ? '✓ Copied' : 'Copy all'}
                </button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                These questions are tailored to this candidate&apos;s specific background and the requirements of this role.
              </p>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {questions.map((q, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                    <span style={{ width: 24, height: 24, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, marginTop: '0.1rem' }}>
                      {i + 1}
                    </span>
                    <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{q}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Culture Fit Notes */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>📝</span>
              Your Notes
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
              Gut feelings, impressions, or anything the AI can&apos;t measure. Only you can see these.
            </p>
            <textarea className="input" rows={4} value={cultureNotes} onChange={(e) => setCultureNotes(e.target.value)} placeholder="e.g. Great culture fit based on LinkedIn presence. Seems like a self-starter. Want to check their portfolio…" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
              <button className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }} onClick={saveNotes} disabled={savingNotes}>
                {savingNotes ? 'Saving…' : 'Save notes'}
              </button>
              {notesSaved && <span style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 500 }}>✓ Saved</span>}
            </div>
          </div>

          {/* Decision Buttons — always visible */}
          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>Your Decision</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {candidate.status === 'pending'
                ? 'The AI score is a guide — you make every call.'
                : <>Current decision: <strong>{candidate.status === 'thinking' ? 'Thinking About' : candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}</strong>. Change it any time.</>}
            </p>
            <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap' }}>
              <button
                className="btn-success"
                onClick={() => { setStep('accept-compose'); }}
                style={{ opacity: candidate.status === 'accepted' ? 0.5 : 1, outline: candidate.status === 'accepted' ? '2px solid var(--success)' : 'none', outlineOffset: 2 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                {candidate.status === 'accepted' ? '✓ Accepted' : 'Accept'}
              </button>
              <button
                onClick={async () => { setStep('idle'); await updateStatus('thinking'); }}
                style={{ background: '#8B5CF6', color: 'white', border: 'none', borderRadius: '9999px', padding: '0.625rem 1.5rem', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: candidate.status === 'thinking' ? 0.5 : 1, outline: candidate.status === 'thinking' ? '2px solid #8B5CF6' : 'none', outlineOffset: 2 }}
              >
                🤔 {candidate.status === 'thinking' ? '✓ Thinking' : 'Think About'}
              </button>
              <button
                className="btn-danger"
                onClick={() => { setStep('reject-compose'); }}
                style={{ opacity: candidate.status === 'rejected' ? 0.5 : 1, outline: candidate.status === 'rejected' ? '2px solid var(--danger)' : 'none', outlineOffset: 2 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {candidate.status === 'rejected' ? '✓ Rejected' : 'Reject'}
              </button>
            </div>
          </div>

          {/* Accept — email compose */}
          {step === 'accept-compose' && (
            <div className="card fade-in" style={{ padding: '1.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Acceptance Message</h2>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Candidate&apos;s email address</label>
                <input className="input" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="candidate@email.com" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Message — edit as needed</label>
                <textarea className="input" rows={10} value={messageText} onChange={(e) => setMessageText(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={async () => { await copy(messageText, 'accept-msg'); await updateStatus('accepted', emailInput); setStep('accept-done'); }}>
                  {copied === 'accept-msg' ? '✓ Copied!' : 'Copy message & accept'}
                </button>
                <button className="btn-secondary" onClick={async () => { await updateStatus('accepted', emailInput); setStep('accept-done'); }}>
                  Accept without sending
                </button>
                <button style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }} onClick={() => setStep('idle')}>Cancel</button>
              </div>
            </div>
          )}

          {step === 'accept-done' && (
            <div className="card fade-in" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', background: 'color-mix(in srgb, var(--success) 8%, var(--surface))', borderColor: 'color-mix(in srgb, var(--success) 30%, transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, background: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{candidate.name || 'Candidate'} accepted for interview.</p>
                <button onClick={() => setStep('idle')} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem', fontFamily: 'inherit' }}>×</button>
              </div>
            </div>
          )}

          {/* Reject — email compose */}
          {step === 'reject-compose' && (
            <div className="card fade-in" style={{ padding: '1.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Rejection Email</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Here&apos;s a draft. Edit it, then copy to send — or just reject without sending.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Candidate&apos;s email address</label>
                <input className="input" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="candidate@email.com" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Email — edit as needed</label>
                <textarea className="input" rows={12} value={rejectionText} onChange={(e) => setRejectionText(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button className="btn-danger" onClick={async () => { await copy(rejectionText, 'reject-email'); await updateStatus('rejected', emailInput); setStep('reject-done'); }}>
                  {copied === 'reject-email' ? '✓ Copied!' : 'Copy email & reject'}
                </button>
                <button className="btn-secondary" onClick={async () => { await updateStatus('rejected', emailInput); setStep('reject-done'); }}>
                  Reject without sending
                </button>
                <button style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }} onClick={() => setStep('idle')}>Cancel</button>
              </div>
            </div>
          )}

          {step === 'reject-done' && (
            <div className="card fade-in" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', background: 'color-mix(in srgb, var(--danger) 6%, var(--surface))', borderColor: 'color-mix(in srgb, var(--danger) 20%, transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, background: 'var(--danger)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{candidate.name || 'Candidate'} rejected.</p>
                <button onClick={() => setStep('idle')} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem', fontFamily: 'inherit' }}>×</button>
              </div>
            </div>
          )}

          {/* Calendar — only visible when accepted */}
          {candidate.status === 'accepted' && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Schedule Interview
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Open your calendar to add an interview slot. You pick the time — nothing is auto-scheduled.
              </p>
              <a href={buildCalendarUrl()} target="_blank" rel="noopener noreferrer">
                <button className="btn-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Open Calendar
                </button>
              </a>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.625rem' }}>
                <Link href="/settings" style={{ color: 'var(--accent)' }}>Change calendar preference</Link>
                {userCalPref !== 'google' && ` · Using ${userCalPref === 'apple' ? 'Apple Calendar' : userCalPref === 'outlook' ? 'Outlook' : 'Other'}`}
              </p>
            </div>
          )}

          {/* Delete confirmation */}
          {step === 'delete-confirm' && (
            <div className="card fade-in" style={{ padding: '1.5rem', marginBottom: '1.25rem', borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>Remove this candidate?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                This cannot be undone. The candidate will be removed from your pipeline.
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
                Their original resume file will remain accessible at its{' '}
                <a href={`/api/projects/${params.id}/candidates/${params.candidateId}/file`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                  direct file link
                </a>{' '}
                even after removal.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-danger" onClick={deleteCandidate}>Yes, remove candidate</button>
                <button className="btn-secondary" onClick={() => setStep('idle')}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
