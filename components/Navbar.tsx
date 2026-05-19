'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Position
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle />
          {session?.user && (
            <>
              <Link href="/settings" style={{ textDecoration: 'none' }}>
                <button style={{ background: 'transparent', border: '1.5px solid var(--border)', borderRadius: '9999px', padding: '0.4rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Settings
                </button>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                style={{ background: 'transparent', border: '1.5px solid var(--border)', borderRadius: '9999px', padding: '0.4rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
