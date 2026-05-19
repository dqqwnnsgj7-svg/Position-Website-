'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

interface Candidate {
  id: string;
  name: string | null;
  status: string;
  score: number | null;
  label: string | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  threshold: number;
  openSlots: number;
  interviewTarget: number | null;
  createdAt: string;
  candidates: Candidate[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/projects')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setProjects(data);
          } else {
            setLoadError(data?.error || 'Failed to load projects. Try restarting the dev server.');
          }
          setLoading(false);
        })
        .catch(() => {
          setLoadError('Could not connect to the server. Please refresh the page.');
          setLoading(false);
        });
    }
  }, [status]);

  const q = search.toLowerCase();
  const filteredProjects = search ? projects.filter((p) => p.title.toLowerCase().includes(q)) : projects;
  const matchingCandidates = search
    ? projects.flatMap((p) =>
        p.candidates
          .filter((c) => c.name && c.name.toLowerCase().includes(q))
          .map((c) => ({ ...c, projectId: p.id, projectTitle: p.title }))
      )
    : [];

  const firstProjectHasDescription = projects[0]?.description;
  const anyCandidate = projects.some((p) => p.candidates.length > 0);
  const showOnboarding = projects.length === 0 || !firstProjectHasDescription || !anyCandidate;

  const onboardingSteps = [
    { done: projects.length > 0, text: 'Create your first project', href: '/projects/new', cta: 'Create project' },
    { done: !!firstProjectHasDescription, text: 'Add a job description', href: projects[0] ? `/projects/${projects[0].id}` : '/projects/new', cta: 'Add description' },
    { done: anyCandidate, text: 'Upload your first resume', href: projects[0] ? `/projects/${projects[0].id}` : '/projects/new', cta: 'Upload resume' },
  ];

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Could not load your projects</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 400, textAlign: 'center' }}>{loadError}</p>
          <button className="btn-primary" onClick={() => { setLoadError(''); setLoading(true); fetch('/api/projects').then(r => r.json()).then(d => { if (Array.isArray(d)) setProjects(d); else setLoadError(d?.error || 'Still failing.'); setLoading(false); }).catch(() => { setLoadError('Still cannot connect.'); setLoading(false); }); }}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (status === 'loading' || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          <span className="spinner" />
          Loading your projects…
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div className="fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
                {session?.user?.name ? `Hi, ${session.user.name.split(' ')[0]}` : 'Hiring Projects'}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                {projects.length === 0 ? 'Create a project to start evaluating candidates.' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <Link href="/projects/new">
              <button className="btn-primary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New Project
              </button>
            </Link>
          </div>

          {showOnboarding && (
            <div className="card fade-in" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'color-mix(in srgb, var(--accent) 4%, var(--surface))' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>👋</span> Getting started with Position
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {onboardingSteps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: step.done ? 'var(--success)' : 'var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'background 300ms',
                    }}>
                      {step.done
                        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <span style={{ width: 6, height: 6, background: 'var(--text-tertiary)', borderRadius: '50%', display: 'block' }} />
                      }
                    </div>
                    <span style={{ fontSize: '0.9375rem', color: step.done ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: step.done ? 'line-through' : 'none', flex: 1 }}>
                      {step.text}
                    </span>
                    {!step.done && (
                      <Link href={step.href}>
                        <button style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '9999px', padding: '0.3rem 0.875rem', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {step.cta}
                        </button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {projects.length > 0 && (
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="input"
                style={{ paddingLeft: '2.5rem', borderRadius: '9999px' }}
                placeholder="Search projects or candidates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {search && filteredProjects.length === 0 && matchingCandidates.length === 0 ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No projects or candidates match &ldquo;{search}&rdquo;.
              <button onClick={() => setSearch('')} style={{ display: 'block', margin: '0.75rem auto 0', background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9375rem' }}>
                Clear search
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No projects yet</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', maxWidth: 380, margin: '0 auto 1.75rem' }}>
                Each project is one open role. Create one, paste in the job description, and start uploading resumes.
              </p>
              <Link href="/projects/new">
                <button className="btn-primary">Create your first project</button>
              </Link>
            </div>
          ) : (
            <>
              {matchingCandidates.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                    Candidates ({matchingCandidates.length})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {matchingCandidates.map((c) => (
                      <Link key={c.id} href={`/projects/${c.projectId}/candidates/${c.id}`} style={{ textDecoration: 'none' }}>
                        <div className="card" style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow)'; }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem', marginBottom: '0.125rem' }}>{c.name}</p>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>{c.projectTitle}</p>
                          </div>
                          {c.status === 'accepted' && <span className="badge-accepted" style={{ fontSize: '0.75rem' }}>Accepted</span>}
                          {c.status === 'rejected' && <span className="badge-rejected" style={{ fontSize: '0.75rem' }}>Rejected</span>}
                          {c.status === 'thinking' && <span className="badge-thinking" style={{ fontSize: '0.75rem' }}>Thinking</span>}
                          {c.status === 'pending' && <span className="badge-pending" style={{ fontSize: '0.75rem' }}>Pending</span>}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {filteredProjects.length > 0 && (
                <>
                  {matchingCandidates.length > 0 && (
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                      Projects ({filteredProjects.length})
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {filteredProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const accepted = project.candidates.filter((c) => c.status === 'accepted').length;
  const rejected = project.candidates.filter((c) => c.status === 'rejected').length;
  const thinking = project.candidates.filter((c) => c.status === 'thinking').length;
  const total = project.candidates.length;
  const date = new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const filledSlots = accepted;
  const slotsLeft = Math.max(0, (project.openSlots || 1) - filledSlots);

  return (
    <div
      className="card"
      onClick={() => router.push(`/projects/${project.id}`)}
      style={{ padding: '1.5rem', cursor: 'pointer', transition: 'box-shadow 200ms, transform 150ms' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', letterSpacing: '-0.01em' }}>
          {project.title}
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{date}</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'var(--surface-2)', borderRadius: '9999px', padding: '0.2rem 0.6rem' }}>
          {total} candidate{total !== 1 ? 's' : ''}
        </span>
        {accepted > 0 && <span className="badge-accepted" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>{accepted} accepted</span>}
        {rejected > 0 && <span className="badge-rejected" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>{rejected} rejected</span>}
        {thinking > 0 && <span className="badge-thinking" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>{thinking} thinking</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
          <span>{project.openSlots || 1} slot{(project.openSlots || 1) !== 1 ? 's' : ''}</span>
          {slotsLeft > 0
            ? <span style={{ color: 'var(--warning)' }}>{slotsLeft} remaining</span>
            : <span style={{ color: 'var(--success)' }}>All filled ✓</span>}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  );
}
