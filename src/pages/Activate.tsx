import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ActivationInfo {
  active: boolean;
  expires_at: number;
  remaining_secs: number;
}

interface Props {
  onActivated: (info: ActivationInfo) => void;
}

function formatRemaining(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  return `${m} 分钟`;
}

export default function Activate({ onActivated }: Props) {
  const [token, setToken]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!token.trim()) return;
    setLoading(true);
    setError('');
    try {
      const info = await invoke<ActivationInfo>('activate', { token: token.trim() });
      onActivated(info);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      zIndex: 9999,
    }}>
      <div style={{
        width: 460, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '40px 36px', boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🦞</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)' }}>OpenClaw Manager</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>需要激活码才能继续使用</div>
        </div>

        {/* Input */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">激活码</label>
          <input
            className="form-input"
            style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: 0.5 }}
            placeholder="OCM-xxxxxxxx.xxxxxxxx"
            value={token}
            onChange={e => { setToken(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
          />
          <div className="form-hint">请联系分发方获取激活码，激活码有使用期限。</div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6, padding: '8px 12px', fontSize: 13,
            color: 'var(--red)', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Button */}
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={submit}
          disabled={loading || !token.trim()}
        >
          {loading ? <><span className="spin">↻</span> 验证中...</> : '激活'}
        </button>
      </div>
    </div>
  );
}

export { formatRemaining };
export type { ActivationInfo };
