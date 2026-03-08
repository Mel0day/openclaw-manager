import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';
import Setup     from './pages/Setup';
import Feishu    from './pages/Feishu';
import Dingtalk  from './pages/Dingtalk';
import Dashboard from './pages/Dashboard';
import Help      from './pages/Help';
import Workspace  from './pages/Workspace';
import Plays      from './pages/Plays';
import Security   from './pages/Security';
import Activate, { formatRemaining } from './pages/Activate';
import type { ActivationInfo } from './pages/Activate';

type Page = 'setup' | 'feishu' | 'dingtalk' | 'dashboard' | 'workspace' | 'plays' | 'security' | 'help';

const NAV = [
  { id: 'setup',     icon: '🚀', label: '安装向导' },
  { id: 'feishu',    icon: '📨', label: '飞书配置' },
  { id: 'dingtalk',  icon: '🔔', label: '钉钉配置' },
  { id: 'dashboard', icon: '📊', label: '服务面板' },
  { id: 'workspace', icon: '📝', label: 'Workspace' },
  { id: 'plays',     icon: '🎮', label: '玩法推荐' },
  { id: 'security',  icon: '🔒', label: '安全管理' },
  { id: 'help',      icon: '💡', label: '问题助手' },
] as const;

const PAGE_META: Record<Page, { title: string; sub: string }> = {
  setup:     { title: '安装向导', sub: '检测环境并一键安装 OpenClaw' },
  feishu:    { title: '飞书配置', sub: '配置飞书机器人接入' },
  dingtalk:  { title: '钉钉配置', sub: '配置钉钉机器人接入' },
  dashboard: { title: '服务面板', sub: '管理 OpenClaw Gateway 进程' },
  workspace: { title: 'Workspace', sub: '编辑 Agent 人格、记忆与心跳任务' },
  plays:     { title: '玩法推荐', sub: 'OpenClaw 主流使用场景与上手指南' },
  security:  { title: '安全管理', sub: '权限边界总览与安全防护状态检测' },
  help:      { title: '问题助手', sub: '常见问题与解决方案' },
};

export type ToastType = 'success' | 'error' | 'info';
export type ShowToast = (msg: string, type?: ToastType) => void;

interface ToastItem { id: number; msg: string; type: ToastType; }

function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
    </div>
  );
}

export default function App() {
  const [page, setPage]           = useState<Page>('setup');
  const [toasts, setToasts]       = useState<ToastItem[]>([]);
  const [activation, setActivation] = useState<ActivationInfo | null>(null);
  const [checking, setChecking]   = useState(true);
  const [remaining, setRemaining] = useState(0);

  // Check activation on mount
  useEffect(() => {
    invoke<ActivationInfo>('check_activation')
      .then(info => {
        setActivation(info);
        setRemaining(info.remaining_secs);
      })
      .catch(() => setActivation({ active: false, expires_at: 0, remaining_secs: 0 }))
      .finally(() => setChecking(false));
  }, []);

  // Count down remaining time every minute
  useEffect(() => {
    if (!activation?.active) return;
    const timer = setInterval(() => {
      setRemaining(r => {
        if (r <= 60) {
          // Expired — re-check and force re-activation
          setActivation(a => a ? { ...a, active: false } : a);
          return 0;
        }
        return r - 60;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, [activation?.active]);

  const showToast: ShowToast = (msg, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--muted)', fontSize: 14 }}>
        <span className="spin" style={{ marginRight: 8 }}>↻</span> 验证授权...
      </div>
    );
  }

  if (!activation?.active) {
    return <Activate onActivated={info => { setActivation(info); setRemaining(info.remaining_secs); }} />;
  }

  const meta = PAGE_META[page];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🦞 OpenClaw</h1>
          <span>Manager</span>
        </div>
        {NAV.map(n => (
          <div key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`}
            onClick={() => setPage(n.id as Page)}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="version-tag">v0.1.1 · Tauri 2</div>
          {remaining > 0 && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>
              授权剩余 {formatRemaining(remaining)}
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <span className="topbar-title">{meta.title}</span>
          <span className="topbar-sub">{meta.sub}</span>
        </div>
        <div className={page === 'workspace' ? 'content-fill' : 'content'}>
          {page === 'setup'     && <Setup     showToast={showToast} />}
          {page === 'feishu'    && <Feishu    showToast={showToast} />}
          {page === 'dingtalk'  && <Dingtalk  showToast={showToast} />}
          {page === 'dashboard' && <Dashboard  showToast={showToast} />}
          {page === 'workspace' && <Workspace  showToast={showToast} />}
          {page === 'plays'     && <Plays />}
          {page === 'security'  && <Security   showToast={showToast} />}
          {page === 'help'      && <Help       showToast={showToast} />}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
