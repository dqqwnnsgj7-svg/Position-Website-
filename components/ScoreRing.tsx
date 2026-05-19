'use client';

import { useEffect, useRef } from 'react';

interface ScoreRingProps {
  score: number;
  size?: number;
}

export function ScoreRing({ score, size = 120 }: ScoreRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.style.strokeDashoffset = String(circumference);
      const timeout = setTimeout(() => {
        if (circleRef.current) {
          circleRef.current.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.25, 0.1, 0.25, 1)';
          circleRef.current.style.strokeDashoffset = String(targetOffset);
        }
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [score, circumference, targetOffset]);

  const color = score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="8"
        />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: size * 0.10, color: 'var(--text-secondary)', marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}
