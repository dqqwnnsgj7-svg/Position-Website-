'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/Navbar';
import Link from 'next/link';

export default function NewProjectPage() {
  const { status } = useSession({ required: true });
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [threshold, setThreshold] = useState(70);
  const [openSlots, setOpenSlots] = useState(1);
  const [interviewTarget, setInterviewTarget] = useState('');
  const [customCriteria, setCustomCriteria] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'loading') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description: description || null,
        threshold,
        openSlots,
        interviewTarget: interviewTarget ? parseInt(interviewTarget) : null,
        customCriteria: customCriteria || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return; }
    router.push(`/projects/${data.id}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div className="fade-in">
          <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9375rem', marginBottom: '1.25rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Dashboard
          </Link>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.375rem' }}>
            New Hiring Project
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Set up a project for one open role. You can edit everything later.</p>

          <div className="card" style={{ padding: '2rem' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label className="label">Job Title *</label>
                <input className="input" type="text" placeholder="e.g. Senior Software Engineer" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
              </div>

              <div>
                <label className="label">
                  Job Description
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> — You can add this now or later</span>
                </label>
                <textarea className="input" placeholder="Paste or type the full job description here. The AI uses this to evaluate candidates…" value={description} onChange={(e) => setDescription(e.target.value)} rows={7} />
              </div>

              <div>
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  Custom AI Criteria
                  <span style={{ fontSize: '0.75rem', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', borderRadius: '9999px', padding: '0.1rem 0.5rem', fontWeight: 600 }}>Optional</span>
                </label>
                <textarea className="input" rows={3} placeholder='e.g. "Prioritize candidates with startup experience. Remote work experience is important. We value strong written communication skills."' value={customCriteria} onChange={(e) => setCustomCriteria(e.target.value)} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.375rem' }}>
                  The AI will factor these notes into every candidate evaluation for this project.
                </p>
              </div>

              <hr className="divider" />

              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Slots & Scoring</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Set how many people you&apos;re hiring and your scoring preferences. All changeable at any time.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label">Open Slots</label>
                    <input className="input" type="number" min={1} value={openSlots} onChange={(e) => setOpenSlots(parseInt(e.target.value) || 1)} />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.375rem' }}>
                      How many people are you hiring for this role?
                    </p>
                  </div>
                  <div>
                    <label className="label">Score Threshold (0–100)</label>
                    <input className="input" type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value) || 0)} />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.375rem' }}>
                      Candidates at or above this score are &ldquo;Good.&rdquo; Default: 70.
                    </p>
                  </div>
                  <div>
                    <label className="label">Interview Target</label>
                    <input className="input" type="number" min={1} placeholder="e.g. 10" value={interviewTarget} onChange={(e) => setInterviewTarget(e.target.value)} />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.375rem' }}>
                      How many total interviews do you want to conduct?
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', borderRadius: '0.75rem', padding: '0.75rem 1rem', color: 'var(--danger)', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <Link href="/dashboard"><button type="button" className="btn-secondary">Cancel</button></Link>
                <button className="btn-primary" type="submit" disabled={loading || !title.trim()}>
                  {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating…</> : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
