'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

interface Candidate {
  id: string;
  name: string | null;
  fileName: string;
  email: string | null;
  score: number | null;
  pros: string | null;
  cons: string | null;
  label: string | null;
  status: string;
  createdAt: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  threshold: number;
  interviewTarget: number | null;
  openSlots: number;
  customCriteria: string | null;
  candidates: Candidate[];
}

type SortKey = 'score' | 'status' | 'label' | 'name';
type SortDir = 'asc' | 'desc';
type PipelineTab = 'list' | 'quickview' | 'compare';

function estimateTime(count: number): string {
  // server runs 3 evaluations at a time, ~3 s each
  const secs = Math.ceil(count / 3) * 3;
  if (secs < 60) return `about ${secs} seconds`;
  const lo = Math.floor(secs / 60);
  const hi = Math.ceil((secs * 1.4) / 60);
  return lo === hi ? `about ${lo} minute${lo !== 1 ? 's' : ''}` : `${lo}–${hi} minutes`;
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { status } = useSession({ required: true });
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ name?: string; fileName?: string; error?: string; success?: boolean; duplicate?: boolean }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingSettings, setEditingSettings] = useState(false);
  const [threshold, setThreshold] = useState(70);
  const [openSlots, setOpenSlots] = useState(1);
  const [interviewTarget, setInterviewTarget] = useState('');
  const [description, setDescription] = useState('');
  const [customCriteria, setCustomCriteria] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearingCandidates, setClearingCandidates] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [pipelineTab, setPipelineTab] = useState<PipelineTab>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickviewIdx, setQuickviewIdx] = useState(0);
  const [quickviewUpdating, setQuickviewUpdating] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [deleteSelectedConfirm, setDeleteSelectedConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data);
      setThreshold(data.threshold);
      setInterviewTarget(data.interviewTarget?.toString() || '');
      setDescription(data.description || '');
      setOpenSlots(data.openSlots || 1);
      setCustomCriteria(data.customCriteria || '');
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (status === 'authenticated') fetchProject();
  }, [status, fetchProject]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    console.log(`[handleUpload] starting: ${files.length} file(s)`);
    setUploadLoading(true);
    setUploadResults([]);
    setUploadProgress({ done: 0, total: files.length });

    const CONCURRENCY = 3;
    const pool = new Set<Promise<void>>();

    const processFile = async (file: File) => {
      console.log(`[handleUpload] starting file: ${file.name}`);
      const formData = new FormData();
      formData.append('resumes', file);
      try {
        const res = await fetch(`/api/projects/${params.id}/candidates`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) {
          console.log(`[handleUpload] error for ${file.name}:`, data.error);
          setUploadResults((prev) => [...prev, { fileName: file.name, error: data.error || 'Upload failed' }]);
        } else {
          console.log(`[handleUpload] success for ${file.name}:`, data.results);
          setUploadResults((prev) => [...prev, ...data.results]);
        }
      } catch (err) {
        console.error(`[handleUpload] network error for ${file.name}:`, err);
        setUploadResults((prev) => [...prev, { fileName: file.name, error: 'Network error' }]);
      }
      setUploadProgress((prev) => {
        const next = prev ? { done: prev.done + 1, total: prev.total } : null;
        console.log(`[handleUpload] progress update →`, next);
        return next;
      });
    };

    for (const file of files) {
      const task = processFile(file);
      const entry: Promise<void> = task.finally(() => pool.delete(entry));
      pool.add(entry);
      if (pool.size >= CONCURRENCY) await Promise.race(pool);
    }
    await Promise.all(pool);

    console.log('[handleUpload] all files done, refreshing project');
    await fetchProject();
    setUploadLoading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    await fetch(`/api/projects/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: project?.title,
        description: description || null,
        threshold: parseInt(String(threshold)) || 70,
        interviewTarget: interviewTarget ? parseInt(interviewTarget) : null,
        openSlots: parseInt(String(openSlots)) || 1,
        customCriteria: customCriteria || null,
      }),
    });
    await fetchProject();
    setSavingSettings(false);
    setEditingSettings(false);
  };

  const clearAllCandidates = async () => {
    setClearingCandidates(true);
    await fetch(`/api/projects/${params.id}/candidates`, { method: 'DELETE' });
    await fetchProject();
    setClearingCandidates(false);
    setClearConfirm(false);
    setEditingSettings(false);
    setUploadResults([]);
  };

  const quickDecision = async (candidateId: string, newStatus: string) => {
    setQuickviewUpdating(true);
    await fetch(`/api/projects/${params.id}/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchProject();
    setQuickviewUpdating(false);
    // advance to next card
    setQuickviewIdx((i) => i + 1);
  };

  const sorted = [...(project?.candidates || [])].sort((a, b) => {
    let av: string | number = 0, bv: string | number = 0;
    if (sortKey === 'score') { av = a.score ?? -1; bv = b.score ?? -1; }
    else if (sortKey === 'status') { av = a.status; bv = b.status; }
    else if (sortKey === 'label') { av = a.label ?? ''; bv = b.label ?? ''; }
    else { av = a.name || a.fileName; bv = b.name || b.fileName; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const searchFiltered = sorted.filter((c) => {
    const q = candidateSearch.toLowerCase();
    return !q || (c.name || c.fileName).toLowerCase().includes(q);
  });

  const topN = project?.interviewTarget
    ? sorted.filter((c) => c.label === 'good').slice(0, project.interviewTarget)
    : [];

  const goodCount = project?.candidates.filter((c) => c.label === 'good').length || 0;
  const acceptedCount = project?.candidates.filter((c) => c.status === 'accepted').length || 0;
  const rejectedCount = project?.candidates.filter((c) => c.status === 'rejected').length || 0;
  const thinkingCount = project?.candidates.filter((c) => c.status === 'thinking').length || 0;
  const totalCount = project?.candidates.length || 0;
  const slotsLeft = Math.max(0, (project?.openSlots || 1) - acceptedCount);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'score' ? 'desc' : 'asc'); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    setDeletingSelected(true);
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/projects/${params.id}/candidates/${id}`, { method: 'DELETE' })
      )
    );
    setSelectedIds(new Set());
    setDeleteSelectedConfirm(false);
    setDeletingSelected(false);
    await fetchProject();
  };

  const compareList = project?.candidates.filter((c) => selectedIds.has(c.id)) || [];
  const quickviewPending = sorted.filter((c) => c.status === 'pending');
  const currentQV = quickviewPending[quickviewIdx];

  const buildCalendarUrl = (calPref: string, candidateName: string) => {
    const title = encodeURIComponent(`Interview: ${candidateName} — ${project?.title}`);
    if (calPref === 'apple') return `webcal://calendar.apple.com/new?title=${title}`;
    if (calPref === 'outlook') return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}`;
  };
  void buildCalendarUrl;

  if (status === 'loading' || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          <span className="spinner" /> Loading project…
        </div>
      </div>
    );
  }

  if (!project) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-secondary)' }}>
        Project not found. <Link href="/dashboard" style={{ color: 'var(--accent)', marginLeft: '0.5rem' }}>Back</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Processing overlay ── */}
      {uploadLoading && uploadProgress && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '1.25rem',
            padding: '2.25rem 2.5rem', maxWidth: 480, width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', gap: '1.25rem',
          }}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  Processing {uploadProgress.total} resume{uploadProgress.total !== 1 ? 's' : ''}…
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Estimated time: <strong style={{ color: 'var(--text-primary)' }}>{estimateTime(uploadProgress.total)}</strong>
                </p>
              </div>
            </div>

            {/* progress */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {uploadProgress.done} of {uploadProgress.total} file{uploadProgress.total !== 1 ? 's' : ''} submitted
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent)' }}>
                  {uploadProgress.done === 0 ? 'analyzing…' : `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%`}
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 9999, overflow: 'hidden', position: 'relative' }}>
                {/* filled bar — only meaningful when done > 0 */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0,
                  background: 'var(--accent)', borderRadius: 9999,
                  width: `${(uploadProgress.done / uploadProgress.total) * 100}%`,
                  transition: 'width 500ms ease',
                }} />
                {/* indeterminate bounce when nothing has completed yet */}
                {uploadProgress.done === 0 && <div className="progress-indeterminate" />}
                {/* shimmer sweep always active */}
                <div className="progress-shimmer" style={{ position: 'absolute', inset: 0 }} />
              </div>
            </div>

            {/* warning */}
            <div style={{
              background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)',
              borderRadius: '0.75rem', padding: '0.875rem 1rem',
              display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Do not close or refresh this page
                </p>
                <p style={{ fontSize: '0.8375rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Your results will be lost if you navigate away. The AI is carefully reading every resume — this takes a little time but every single candidate will be evaluated. Please be patient and keep this tab open.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Navbar />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div className="fade-in">
          <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Dashboard
          </Link>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>{project.title}</h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                {totalCount} candidate{totalCount !== 1 ? 's' : ''} · {project.openSlots} open slot{project.openSlots !== 1 ? 's' : ''} · {slotsLeft} remaining
              </p>
            </div>
            <button className="btn-secondary" onClick={() => { setEditingSettings(!editingSettings); setClearConfirm(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>
          </div>

          {/* Progress Bar */}
          {totalCount > 0 && (
            <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                {[
                  { label: 'Uploaded', value: totalCount, color: 'var(--text-tertiary)' },
                  { label: 'Accepted', value: acceptedCount, color: 'var(--success)' },
                  { label: 'Rejected', value: rejectedCount, color: 'var(--danger)' },
                  { label: 'Thinking About', value: thinkingCount, color: '#8B5CF6' },
                  { label: 'Slots Remaining', value: slotsLeft, color: slotsLeft === 0 ? 'var(--success)' : 'var(--warning)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 9999, overflow: 'hidden', display: 'flex' }}>
                {totalCount > 0 && (
                  <>
                    <div style={{ width: `${(acceptedCount / totalCount) * 100}%`, background: 'var(--success)', transition: 'width 600ms' }} />
                    <div style={{ width: `${(thinkingCount / totalCount) * 100}%`, background: '#8B5CF6', transition: 'width 600ms' }} />
                    <div style={{ width: `${(rejectedCount / totalCount) * 100}%`, background: 'var(--danger)', transition: 'width 600ms' }} />
                  </>
                )}
              </div>
            </div>
          )}

          {editingSettings && (
            <div className="card fade-in" style={{ padding: '1.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Project Settings</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label className="label">Job Description</label>
                  <textarea className="input" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Paste the job description here…" />
                </div>
                <div>
                  <label className="label">Custom AI Criteria</label>
                  <textarea className="input" rows={3} value={customCriteria} onChange={(e) => setCustomCriteria(e.target.value)} placeholder='e.g. "Prioritize startup experience. Remote work experience is important."' />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.375rem' }}>
                    The AI factors these notes into every evaluation for this project.
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label">Open Slots</label>
                    <input className="input" type="number" min={1} value={openSlots} onChange={(e) => setOpenSlots(parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    <label className="label">Score Threshold (0–100)</label>
                    <input className="input" type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="label">Interview Target</label>
                    <input className="input" type="number" min={1} placeholder="e.g. 10" value={interviewTarget} onChange={(e) => setInterviewTarget(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => { setEditingSettings(false); setClearConfirm(false); }}>Cancel</button>
                  <button className="btn-primary" onClick={saveSettings} disabled={savingSettings}>
                    {savingSettings ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  {!clearConfirm ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>Clear all candidates</p>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>
                          {totalCount > 0
                            ? `Remove all ${totalCount} candidate${totalCount !== 1 ? 's' : ''} from this project so you can start fresh.`
                            : 'No candidates to clear yet.'}
                        </p>
                      </div>
                      <button
                        onClick={() => setClearConfirm(true)}
                        disabled={totalCount === 0}
                        style={{ background: 'transparent', border: `1px solid ${totalCount === 0 ? 'var(--border)' : 'var(--danger)'}`, borderRadius: '9999px', padding: '0.4rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: totalCount === 0 ? 'var(--text-tertiary)' : 'var(--danger)', cursor: totalCount === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: totalCount === 0 ? 0.5 : 1 }}
                      >
                        Clear all candidates
                      </button>
                    </div>
                  ) : (
                    <div style={{ background: 'color-mix(in srgb, var(--danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                        Delete all {totalCount} candidate{totalCount !== 1 ? 's' : ''}?
                      </p>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        This cannot be undone. All scores, analysis, and decisions will be permanently removed.
                      </p>
                      <div style={{ display: 'flex', gap: '0.625rem' }}>
                        <button
                          onClick={() => setClearConfirm(false)}
                          disabled={clearingCandidates}
                          style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '9999px', padding: '0.4rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={clearAllCandidates}
                          disabled={clearingCandidates}
                          style={{ background: 'var(--danger)', border: 'none', borderRadius: '9999px', padding: '0.4rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: 'white', cursor: clearingCandidates ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: clearingCandidates ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                        >
                          {clearingCandidates && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />}
                          {clearingCandidates ? 'Deleting…' : `Yes, delete all ${totalCount}`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {project.interviewTarget && goodCount > project.interviewTarget && (
            <div style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)', borderRadius: '0.875rem', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>More Good Candidates than interview slots</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {goodCount} candidates scored above your threshold but your target is {project.interviewTarget} interviews. Top {project.interviewTarget} are highlighted.
                </p>
              </div>
            </div>
          )}

          {/* Upload */}
          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Upload Resumes</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Drop one or many files — PDF, Word documents, images, text files, or any other format.
            </p>

            {!project.description && (
              <div style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                <strong>Add a job description first.</strong> Click &ldquo;Settings&rdquo; above to add your job description before uploading.
              </div>
            )}

            <div
              style={{ border: '2px dashed var(--border)', borderRadius: '0.875rem', padding: '2rem', textAlign: 'center', cursor: project.description ? 'pointer' : 'not-allowed', opacity: project.description ? 1 : 0.5, transition: 'border-color 150ms, background 150ms' }}
              onClick={() => project.description && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!project.description || !fileInputRef.current) return;
                const dt = e.dataTransfer;
                if (dt.files.length) {
                  Object.defineProperty(fileInputRef.current, 'files', { value: dt.files, configurable: true });
                  fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }}
            >
              {uploadLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                  {uploadProgress && uploadProgress.total > 1 ? (
                    <>
                      <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '1rem' }}>
                        {uploadProgress.done} of {uploadProgress.total} evaluated
                      </p>
                      <div style={{ width: '100%', maxWidth: 240, height: 6, background: 'var(--surface-2)', borderRadius: 9999, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, background: 'var(--accent)', borderRadius: 9999, width: `${(uploadProgress.done / uploadProgress.total) * 100}%`, transition: 'width 400ms ease' }} />
                        {uploadProgress.done === 0 && <div className="progress-indeterminate" />}
                        <div className="progress-shimmer" style={{ position: 'absolute', inset: 0 }} />
                      </div>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>The AI is reading each file and comparing it to your job description.</p>
                    </>
                  ) : (
                    <>
                      <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Evaluating your candidate…</p>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>The AI is reading the file and comparing it to your job description.</p>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Drop files here, or click to choose</p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Any file type · Multiple files at once</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="*/*" multiple style={{ display: 'none' }} onChange={handleUpload} />

            {uploadResults.length > 0 && (
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {uploadResults.map((r, i) => {
                  const isDupe = r.duplicate;
                  const isErr = !!r.error;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
                      background: isErr
                        ? 'color-mix(in srgb, var(--danger) 8%, transparent)'
                        : isDupe
                          ? 'color-mix(in srgb, var(--warning) 8%, transparent)'
                          : 'color-mix(in srgb, var(--success) 10%, transparent)',
                      fontSize: '0.875rem',
                      color: isErr ? 'var(--danger)' : isDupe ? 'var(--warning)' : 'var(--success)',
                    }}>
                      {isErr
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        : isDupe
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      }
                      {isErr
                        ? `${r.fileName || 'File'}: ${r.error}`
                        : isDupe
                          ? `${r.fileName || 'File'} was already uploaded — skipped`
                          : `${r.name || r.fileName || 'Candidate'} evaluated`}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pipeline */}
          {project.candidates.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-2)', borderRadius: '9999px', padding: '0.25rem' }}>
                  {([['list', 'List View'], ['quickview', 'QuickView'], ['compare', 'Compare']] as [PipelineTab, string][]).map(([t, label]) => (
                    <button key={t} onClick={() => { setPipelineTab(t); if (t === 'quickview') setQuickviewIdx(0); }}
                      style={{ background: pipelineTab === t ? 'var(--surface)' : 'transparent', color: pipelineTab === t ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: '9999px', padding: '0.35rem 0.875rem', fontSize: '0.875rem', fontWeight: pipelineTab === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', boxShadow: pipelineTab === t ? 'var(--shadow)' : 'none', transition: 'all 150ms' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {pipelineTab === 'list' && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input className="input" style={{ paddingLeft: '2.25rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.875rem', borderRadius: '9999px' }} placeholder="Search candidates…" value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} />
                    </div>
                    {(['score', 'name', 'label', 'status'] as SortKey[]).map((key) => (
                      <button key={key} onClick={() => toggleSort(key)}
                        style={{ background: sortKey === key ? 'var(--accent)' : 'var(--surface-2)', color: sortKey === key ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '9999px', padding: '0.35rem 0.875rem', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                        {sortKey === key && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* LIST VIEW */}
              {pipelineTab === 'list' && (
                <>
                  {searchFiltered.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No candidates match &ldquo;{candidateSearch}&rdquo;.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', width: 40 }}>
                              {selectedIds.size > 0 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>{selectedIds.size}</span>
                              )}
                            </th>
                            {['Candidate', 'Score', 'Label', 'Status', ''].map((h) => (
                              <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--surface-2)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {searchFiltered.map((c, idx) => {
                            const isTopN = topN.some((t) => t.id === c.id);
                            const isSelected = selectedIds.has(c.id);
                            return (
                              <tr key={c.id} style={{ borderBottom: idx < searchFiltered.length - 1 ? '1px solid var(--border)' : 'none', background: isSelected ? 'color-mix(in srgb, var(--accent) 4%, transparent)' : isTopN ? 'color-mix(in srgb, var(--success) 3%, transparent)' : 'transparent' }}>
                                <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(c.id)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                                </td>
                                <td style={{ padding: '0.875rem 1.25rem' }}>
                                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                                    {c.name || c.fileName}
                                    {isTopN && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', borderRadius: '9999px', padding: '0.1rem 0.5rem', fontWeight: 600 }}>Top Pick</span>}
                                  </div>
                                  {c.name && <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{c.fileName}</div>}
                                </td>
                                <td style={{ padding: '0.875rem 1.25rem' }}>
                                  {c.score !== null
                                    ? <span style={{ fontWeight: 700, fontSize: '1rem', color: c.score >= project.threshold ? 'var(--success)' : c.score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{c.score}</span>
                                    : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                                </td>
                                <td style={{ padding: '0.875rem 1.25rem' }}>
                                  {c.label === 'good' ? <span className="badge-good">Good</span> : c.label === 'poor' ? <span className="badge-poor">Poor</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                                </td>
                                <td style={{ padding: '0.875rem 1.25rem' }}>
                                  {c.status === 'accepted' ? <span className="badge-accepted">Accepted</span>
                                    : c.status === 'rejected' ? <span className="badge-rejected">Rejected</span>
                                    : c.status === 'thinking' ? <span className="badge-thinking">Thinking About</span>
                                    : <span className="badge-pending">Pending</span>}
                                </td>
                                <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                                  <Link href={`/projects/${project.id}/candidates/${c.id}`}>
                                    <button style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '9999px', padding: '0.375rem 0.875rem', fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                                      View →
                                    </button>
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {selectedIds.size >= 1 && (
                    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'color-mix(in srgb, var(--accent) 4%, var(--surface))', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>
                        {selectedIds.size} candidate{selectedIds.size !== 1 ? 's' : ''} selected
                      </span>

                      {selectedIds.size >= 2 && (
                        <button className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => setPipelineTab('compare')}>
                          Compare side by side →
                        </button>
                      )}

                      {!deleteSelectedConfirm ? (
                        <button
                          onClick={() => setDeleteSelectedConfirm(true)}
                          style={{ background: 'transparent', border: '1px solid var(--danger)', borderRadius: '9999px', padding: '0.4rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Delete {selectedIds.size}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>Delete {selectedIds.size} candidate{selectedIds.size !== 1 ? 's' : ''}?</span>
                          <button
                            onClick={deleteSelected}
                            disabled={deletingSelected}
                            style={{ background: 'var(--danger)', border: 'none', borderRadius: '9999px', padding: '0.4rem 0.875rem', fontSize: '0.875rem', fontWeight: 500, color: 'white', cursor: deletingSelected ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: deletingSelected ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                          >
                            {deletingSelected && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />}
                            {deletingSelected ? 'Deleting…' : 'Yes, delete'}
                          </button>
                          <button
                            onClick={() => setDeleteSelectedConfirm(false)}
                            disabled={deletingSelected}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => { setSelectedIds(new Set()); setDeleteSelectedConfirm(false); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', marginLeft: 'auto' }}
                      >
                        Clear selection
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* QUICKVIEW */}
              {pipelineTab === 'quickview' && (
                <div style={{ padding: '2rem' }}>
                  {quickviewPending.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✓</div>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>All caught up!</p>
                      <p>Every candidate has a decision. Switch to List View to review or change decisions.</p>
                    </div>
                  ) : currentQV ? (
                    <div className="fade-in">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          {quickviewIdx + 1} of {quickviewPending.length} pending candidates
                        </p>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button onClick={() => setQuickviewIdx((i) => Math.max(0, i - 1))} disabled={quickviewIdx === 0} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '9999px', padding: '0.4rem 0.875rem', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '0.875rem' }}>← Prev</button>
                          <button onClick={() => setQuickviewIdx((i) => Math.min(quickviewPending.length - 1, i + 1))} disabled={quickviewIdx >= quickviewPending.length - 1} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '9999px', padding: '0.4rem 0.875rem', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '0.875rem' }}>Next →</button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 280 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{currentQV.name || currentQV.fileName}</h3>
                            {currentQV.score !== null && (
                              <span style={{ fontWeight: 800, fontSize: '1.25rem', color: currentQV.score >= project.threshold ? 'var(--success)' : currentQV.score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                                {currentQV.score}/100
                              </span>
                            )}
                            {currentQV.label === 'good' ? <span className="badge-good">Good</span> : <span className="badge-poor">Poor</span>}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ background: 'color-mix(in srgb, var(--success) 6%, var(--surface-2))', borderRadius: '0.75rem', padding: '1rem' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.5rem' }}>TOP STRENGTHS</p>
                              {(currentQV.pros ? JSON.parse(currentQV.pros) : []).slice(0, 3).map((p: string, i: number) => (
                                <p key={i} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.375rem', display: 'flex', gap: '0.375rem' }}>
                                  <span style={{ color: 'var(--success)', flexShrink: 0 }}>•</span>{p}
                                </p>
                              ))}
                            </div>
                            <div style={{ background: 'color-mix(in srgb, var(--danger) 5%, var(--surface-2))', borderRadius: '0.75rem', padding: '1rem' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '0.5rem' }}>CONCERNS</p>
                              {(currentQV.cons ? JSON.parse(currentQV.cons) : []).slice(0, 2).map((c: string, i: number) => (
                                <p key={i} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.375rem', display: 'flex', gap: '0.375rem' }}>
                                  <span style={{ color: 'var(--danger)', flexShrink: 0 }}>•</span>{c}
                                </p>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button className="btn-success" disabled={quickviewUpdating} onClick={() => quickDecision(currentQV.id, 'accepted')}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Accept
                            </button>
                            <button style={{ background: '#8B5CF6', color: 'white', border: 'none', borderRadius: '9999px', padding: '0.625rem 1.25rem', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: quickviewUpdating ? 0.4 : 1 }} disabled={quickviewUpdating} onClick={() => quickDecision(currentQV.id, 'thinking')}>
                              🤔 Think About
                            </button>
                            <button className="btn-danger" disabled={quickviewUpdating} onClick={() => quickDecision(currentQV.id, 'rejected')}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              Reject
                            </button>
                            <Link href={`/projects/${project.id}/candidates/${currentQV.id}`}>
                              <button className="btn-secondary">Full Profile →</button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      <p>No more pending candidates.</p>
                    </div>
                  )}
                </div>
              )}

              {/* COMPARE VIEW */}
              {pipelineTab === 'compare' && (
                <div style={{ padding: '1.5rem' }}>
                  {compareList.length < 2 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      <p style={{ marginBottom: '0.75rem' }}>Select 2 or more candidates in List View to compare them here.</p>
                      <button className="btn-secondary" onClick={() => setPipelineTab('list')}>← Go to List View</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Comparing {compareList.length} candidates</p>
                        <button onClick={() => { setSelectedIds(new Set()); setPipelineTab('list'); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}>
                          ← Back to list
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {compareList.map((c) => {
                          const pros: string[] = c.pros ? JSON.parse(c.pros) : [];
                          const cons: string[] = c.cons ? JSON.parse(c.cons) : [];
                          const isGood = c.label === 'good';
                          return (
                            <div key={c.id} className="card" style={{ minWidth: 260, flex: '0 0 260px', padding: '1.25rem', cursor: 'pointer', transition: 'box-shadow 150ms' }}
                              onClick={() => window.open(`/projects/${project.id}/candidates/${c.id}`, '_blank')}>
                              <div style={{ marginBottom: '0.875rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.375rem' }}>{c.name || c.fileName}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  {c.score !== null && (
                                    <span style={{ fontWeight: 800, fontSize: '1.5rem', color: isGood ? 'var(--success)' : 'var(--danger)' }}>{c.score}</span>
                                  )}
                                  {isGood ? <span className="badge-good">Good</span> : <span className="badge-poor">Poor</span>}
                                </div>
                              </div>
                              <div style={{ marginBottom: '0.75rem' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.375rem' }}>STRENGTHS</p>
                                {pros.slice(0, 3).map((p, i) => (
                                  <p key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', gap: '0.375rem' }}>
                                    <span style={{ color: 'var(--success)', flexShrink: 0 }}>+</span>{p}
                                  </p>
                                ))}
                              </div>
                              <div style={{ marginBottom: '0.875rem' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '0.375rem' }}>CONCERNS</p>
                                {cons.slice(0, 2).map((c2, i) => (
                                  <p key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', gap: '0.375rem' }}>
                                    <span style={{ color: 'var(--danger)', flexShrink: 0 }}>−</span>{c2}
                                  </p>
                                ))}
                              </div>
                              <div>
                                {c.status === 'accepted' ? <span className="badge-accepted">Accepted</span>
                                  : c.status === 'rejected' ? <span className="badge-rejected">Rejected</span>
                                  : c.status === 'thinking' ? <span className="badge-thinking">Thinking About</span>
                                  : <span className="badge-pending">Pending</span>}
                              </div>
                              <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.75rem' }}>Click to open full profile →</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {project.candidates.length === 0 && !uploadLoading && (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No candidates yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upload resumes above to start evaluating candidates for this role.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
