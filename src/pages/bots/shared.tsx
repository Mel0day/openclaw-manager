import React from 'react';

export function StepCard({ num, title, desc, done, active, children }: {
  num: number; title: string | React.ReactNode; desc: string;
  done?: boolean; active?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className={`step ${done ? 'done' : active ? 'active' : ''}`}>
      <div className="step-num">{done ? '✓' : num}</div>
      <div className="step-body">
        <div className="step-title">{title}</div>
        <div className="step-desc">{desc}</div>
        {children}
      </div>
    </div>
  );
}

export function ManualTag() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)',
      color: 'var(--yellow)', padding: '1px 6px', borderRadius: 4,
      marginLeft: 6, verticalAlign: 'middle', letterSpacing: 0.5,
    }}>手动</span>
  );
}

export interface IMConfigProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onConfigured?: () => void;
}
