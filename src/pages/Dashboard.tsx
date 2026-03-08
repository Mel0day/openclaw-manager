import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ShowToast } from '../App';

interface GatewayStatus { running: boolean; installed: boolean; url: string; }

export default function Dashboard({ showToast }: { showToast: ShowToast }) {
  const [status,   setStatus]   = useState<GatewayStatus>({ running: false, installed: false, url: 'http://127.0.0.1:18789' });
  const [logs,     setLogs]     = useState('');
  const [doctor,   setDoctor]   = useState('');
  const [showDoc,  setShowDoc]  = useState(false);
  const [loading,  setLoading]  = useState<string | null>(null); // tracks which action is in flight
  const [docLoading, setDocLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const refreshStatus = async () => {
    const s = await invoke<GatewayStatus>('get_gateway_service_status');
    setStatus(s);
  };

  const refreshLogs = async () => {
    const l = await invoke<string>('get_logs');
    setLogs(l || '（暂无日志）');
  };

  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (!active) return;
      await refreshStatus();
      if (!active) return;
      await refreshLogs();
    };
    poll();
    const t = setInterval(poll, 6000);
    return () => { active = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // ── actions ────────────────────────────────────────────────────────────────

  const start = async () => {
    setLoading('start');
    try {
      await invoke('start_gateway_service');
      showToast('Gateway 已启动', 'success');
      setTimeout(refreshStatus, 1200);
    } catch (e: any) {
      showToast(`启动失败: ${e}`, 'error');
    } finally { setLoading(null); }
  };

  const stop = async () => {
    setLoading('stop');
    try {
      await invoke('stop_gateway_service');
      showToast('Gateway 已停止', 'info');
      setTimeout(refreshStatus, 1200);
    } catch (e: any) {
      showToast(`停止失败: ${e}`, 'error');
    } finally { setLoading(null); }
  };

  const restart = async () => {
    setLoading('restart');
    try {
      await invoke('stop_gateway_service');
      await new Promise(r => setTimeout(r, 800));
      await invoke('start_gateway_service');
      showToast('Gateway 已重启', 'success');
      setTimeout(refreshStatus, 1200);
    } catch (e: any) {
      showToast(`重启失败: ${e}`, 'error');
    } finally { setLoading(null); }
  };

  const openDashboard = async () => {
    try {
      await invoke('open_openclaw_dashboard');
      showToast('已在浏览器中打开 OpenClaw Dashboard', 'info');
    } catch (e: any) {
      showToast(`${e}`, 'error');
    }
  };

  const runDoctor = async () => {
    setDocLoading(true);
    setShowDoc(true);
    try {
      const result = await invoke<string>('run_openclaw_doctor');
      setDoctor(result);
    } catch (e: any) {
      setDoctor(`错误: ${e}`);
    } finally { setDocLoading(false); }
  };

  // ── render ─────────────────────────────────────────────────────────────────

  const isLoading = loading !== null;

  return (
    <>
      {/* Status panel */}
      <div className="gateway-panel">
        <div className="gateway-info">
          <div className="row" style={{ gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>OpenClaw Gateway</span>
            {status.running ? (
              <span className="badge badge-green"><span className="dot dot-pulse"></span>运行中</span>
            ) : status.installed ? (
              <span className="badge badge-yellow"><span className="dot"></span>已停止</span>
            ) : (
              <span className="badge badge-red"><span className="dot"></span>未安装</span>
            )}
          </div>
          <div className="gateway-url">{status.url}</div>
        </div>
        <div className="gateway-actions">
          {status.running ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={restart} disabled={isLoading}>
                {loading === 'restart' ? <span className="spin">↻</span> : '↺'} 重启
              </button>
              <button className="btn btn-danger btn-sm" onClick={stop} disabled={isLoading}>
                {loading === 'stop' ? <span className="spin">↻</span> : '■'} 停止
              </button>
            </>
          ) : (
            <button className="btn btn-success btn-sm" onClick={start} disabled={isLoading || !status.installed}>
              {loading === 'start' ? <><span className="spin">↻</span> 启动中</> : '▶ 启动'}
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={openDashboard}
            disabled={!status.running}
            title="在浏览器中打开 OpenClaw Web 控制台"
          >
            ↗ 打开控制台
          </button>
        </div>
      </div>

      {!status.installed && (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', marginTop: -8 }}>
          <div style={{ fontSize: 13, color: 'var(--yellow)' }}>
            Gateway 服务尚未安装，请先完成「安装向导」的第 4 步。
          </div>
        </div>
      )}

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">服务状态</div>
          <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: status.running ? 'var(--green)' : 'var(--muted)' }}>
            {status.running ? 'RUNNING' : 'STOPPED'}
          </div>
          <div className="form-hint" style={{ marginTop: 4 }}>系统服务（LaunchAgent）</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">监听地址</div>
          <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: 'var(--teal)' }}>127.0.0.1</div>
          <div className="form-hint" style={{ marginTop: 4 }}>仅本机访问（loopback）</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">端口</div>
          <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>18789</div>
          <div className="form-hint" style={{ marginTop: 4 }}>WebSocket Gateway</div>
        </div>
      </div>

      {/* Log viewer */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>运行日志</div>
          <button className="btn btn-ghost btn-sm" onClick={refreshLogs}>↻ 刷新</button>
        </div>
        <div className="log-box" ref={logRef}>
          {logs || '（暂无日志）'}
        </div>
      </div>

      {/* Doctor */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: showDoc ? 12 : 0 }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>诊断工具</div>
            {!showDoc && <div className="form-hint" style={{ marginTop: 4 }}>检测配置问题并自动修复</div>}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={runDoctor}
            disabled={docLoading}
          >
            {docLoading ? <><span className="spin">↻</span> 诊断中...</> : '🔍 运行 Doctor'}
          </button>
        </div>
        {showDoc && (
          <div className="log-box" style={{ maxHeight: 320, color: 'var(--muted2)' }}>
            {docLoading ? '诊断中，请稍候...' : doctor || '（无输出）'}
          </div>
        )}
      </div>
    </>
  );
}
