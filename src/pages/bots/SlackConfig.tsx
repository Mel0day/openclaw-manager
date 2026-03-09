import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StepCard, ManualTag, IMConfigProps } from './shared';

type StepState = 'idle' | 'loading' | 'done' | 'error';

export default function SlackConfig({ showToast, onConfigured }: IMConfigProps) {
  const [appToken,     setAppToken]     = useState('');
  const [botToken,     setBotToken]     = useState('');
  const [credsSaved,   setCredsSaved]   = useState(false);
  const [channelState, setChannelState] = useState<StepState>('idle');

  useEffect(() => {
    invoke<{ app_token: string; bot_token: string }>('load_slack_config').then(cfg => {
      if (cfg.app_token) {
        setAppToken(cfg.app_token);
        setBotToken(cfg.bot_token);
        setCredsSaved(true);
        onConfigured?.();
      }
    }).catch(() => {});
  }, []);

  const configureChannel = async () => {
    if (!appToken.trim() || !botToken.trim()) return;
    setChannelState('loading');
    try {
      await invoke('configure_slack_channel', { appToken: appToken.trim(), botToken: botToken.trim() });
      setCredsSaved(true);
      setChannelState('done');
      onConfigured?.();
      showToast('Slack Channel 配置完成', 'success');
    } catch (e: any) {
      setChannelState('error');
      showToast(`配置失败: ${e}`, 'error');
    }
  };

  const step1Done  = channelState === 'done' || credsSaved;
  const formFilled = appToken.trim() && botToken.trim();

  return (
    <>
      <div className="card" style={{ borderColor: 'rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.05)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.9 }}>
          Slack 是原生内置 Channel，使用<strong style={{ color: 'var(--accent)' }}>Socket Mode（WebSocket）</strong>接收消息，
          无需公网 IP，需要两个 Token：<strong>App Token</strong>（xapp-）和 <strong>Bot Token</strong>（xoxb-）。
        </div>
      </div>

      <div className="steps">
        <StepCard num={1} active={!step1Done}
          title={<>在 Slack 创建应用 <ManualTag /></>}
          desc="前往 Slack API 管理后台，创建 Slack App 并开启 Socket Mode。"
        >
          <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', marginTop: 8, marginBottom: 10 }}>
            <button className="btn btn-ghost btn-sm">打开 Slack API 管理后台 →</button>
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)' }}>
            <div>① 点「Create New App」→「From Scratch」，填写名称，选择目标 Workspace</div>
            <div>② 左侧菜单「Socket Mode」→ 开启 Enable Socket Mode</div>
            <div>③ 为 Socket Mode 生成 App-Level Token，Scope 选 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>connections:write</code>，复制 <strong>xapp-</strong> 开头的 Token</div>
          </div>
        </StepCard>

        <StepCard num={2} active={!step1Done}
          title={<>配置 Bot 权限并安装到 Workspace <ManualTag /></>}
          desc="配置 Bot 所需权限，生成 Bot Token，并安装到 Slack Workspace。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>① 左侧「OAuth & Permissions」→「Bot Token Scopes」，添加以下权限：</div>
            <div style={{ paddingLeft: 12, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {['chat:write', 'channels:history', 'channels:read', 'im:history', 'im:read', 'im:write', 'groups:history'].map(s => (
                <code key={s} style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11, background: 'rgba(74,158,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>{s}</code>
              ))}
            </div>
            <div>② 左侧「Event Subscriptions」→ 开启，Subscribe to Bot Events 添加：<code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>message.channels</code>、<code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>message.im</code></div>
            <div>③ 回到「OAuth & Permissions」→ 点「Install to Workspace」，复制 <strong>xoxb-</strong> 开头的 Bot Token</div>
          </div>
        </StepCard>

        <StepCard num={3} title="填写两个 Token 并写入配置"
          desc="将 App Token（xapp-）和 Bot Token（xoxb-）填入下方，一键完成接入。"
          done={step1Done} active={!step1Done}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">App Token（Socket Mode）</label>
              <input className="form-input" placeholder="xapp-1-xxxxxxxxxx-xxxxxxxxxx-xxxxxxx"
                style={{ fontFamily: 'monospace', fontSize: 12 }}
                value={appToken} onChange={e => setAppToken(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Bot Token</label>
              <input className="form-input" placeholder="xoxb-xxxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxxxxxx"
                style={{ fontFamily: 'monospace', fontSize: 12 }}
                value={botToken} onChange={e => setBotToken(e.target.value)} />
              <div className="form-hint">Token 仅保存在本地，不会上传至任何服务器。</div>
            </div>
            <div>
              <button className={`btn btn-sm ${channelState === 'done' ? 'btn-success' : 'btn-primary'}`}
                onClick={configureChannel} disabled={channelState === 'loading' || !formFilled}>
                {channelState === 'loading' ? <><span className="spin">↻</span> 配置中...</>
                  : channelState === 'done' ? '✓ 已配置'
                  : '保存并写入 OpenClaw 配置'}
              </button>
              {channelState === 'error' && <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>配置失败，请确认 Gateway 已启动，或检查 Token 是否正确。</div>}
            </div>
          </div>
        </StepCard>

        <StepCard num={4} active={step1Done}
          title={<>在 Slack 中测试机器人 <ManualTag /></>}
          desc="在已安装 Bot 的 Workspace 中，向机器人发私信或在频道中 @机器人 进行测试。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>· 在 Slack 左侧「Direct Messages」中找到 Bot，发送消息</div>
            <div>· 或在频道中输入 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>@Bot名称 你好</code></div>
            <div>· 若无响应，检查 Event Subscriptions 是否已开启，或查看 Gateway 状态</div>
          </div>
        </StepCard>

        {step1Done && (
          <div className="step done">
            <div className="step-num">✓</div>
            <div className="step-body">
              <div className="step-title">配置完成！</div>
              <div className="step-desc">Slack 机器人已就绪，Gateway 运行后即可在 Workspace 中对话。</div>
              <span className="badge badge-green" style={{ marginTop: 6 }}><span className="dot dot-pulse"></span>Slack Channel 已激活</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
