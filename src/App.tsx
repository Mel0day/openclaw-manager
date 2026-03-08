import { useState } from 'react';
import './App.css';
import Setup     from './pages/Setup';
import Feishu    from './pages/Feishu';
import Dingtalk  from './pages/Dingtalk';
import Dashboard from './pages/Dashboard';
import Help      from './pages/Help';

type Page = 'setup' | 'feishu' | 'dingtalk' | 'dashboard' | 'help';

const NAV = [
  { id: 'setup',     icon: '🚀', label: '安装向导' },
  { id: 'feishu',    icon: '📨', label: '飞书配置' },
  { id: 'dingtalk',  icon: '🔔', label: '钉钉配置' },
  { id: 'dashboard', icon: '📊', label: '服务面板' },
  { id: 'help',      icon: '💡', label: '问题助手' },
] as const;

const PAGE_META: Record<Page, { title: string; sub: string }> = {
  setup:     { title: '安装向导', sub: '检测环境并一键安装 OpenClaw' },
  feishu:    { title: '飞书配置', sub: '配置飞书机器人接入' },
  dingtalk:  { title: '钉钉配置', sub: '配置钉钉机器人接入' },
  dashboard: { title: '服务面板', sub: '管理 OpenClaw Gateway 进程' },
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
  const [page, setPage] = useState<Page>('setup');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast: ShowToast = (msg, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  };

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
          <div className="version-tag">v0.1.0 · Tauri 2</div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <span className="topbar-title">{meta.title}</span>
          <span className="topbar-sub">{meta.sub}</span>
        </div>
        <div className="content">
          {page === 'setup'     && <Setup     showToast={showToast} />}
          {page === 'feishu'    && <Feishu    showToast={showToast} />}
          {page === 'dingtalk'  && <Dingtalk  showToast={showToast} />}
          {page === 'dashboard' && <Dashboard showToast={showToast} />}
          {page === 'help'      && <Help showToast={showToast} />}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
