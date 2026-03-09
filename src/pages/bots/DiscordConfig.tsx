import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StepCard, ManualTag, IMConfigProps } from './shared';

type StepState = 'idle' | 'loading' | 'done' | 'error';

export default function DiscordConfig({ showToast, onConfigured }: IMConfigProps) {
  const [token,        setToken]        = useState('');
  const [credsSaved,   setCredsSaved]   = useState(false);
  const [channelState, setChannelState] = useState<StepState>('idle');

  useEffect(() => {
    invoke<{ token: string }>('load_discord_config').then(cfg => {
      if (cfg.token) { setToken(cfg.token); setCredsSaved(true); onConfigured?.(); }
    }).catch(() => {});
  }, []);

  const configureChannel = async () => {
    if (!token.trim()) return;
    setChannelState('loading');
    try {
      await invoke('configure_discord_channel', { token: token.trim() });
      setCredsSaved(true);
      setChannelState('done');
      onConfigured?.();
      showToast('Discord Channel 配置完成', 'success');
    } catch (e: any) {
      setChannelState('error');
      showToast(`配置失败: ${e}`, 'error');
    }
  };

  const step1Done = channelState === 'done' || credsSaved;

  return (
    <>
      <div className="card" style={{ borderColor: 'rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.05)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.9 }}>
          Discord 是原生内置 Channel，使用<strong style={{ color: 'var(--accent)' }}>Gateway WebSocket</strong>接收消息，
          无需公网 IP，只需一个 Bot Token 即可完成接入。
        </div>
      </div>

      <div className="steps">
        <StepCard num={1} active={!step1Done}
          title={<>在 Discord 开发者门户创建应用并获取 Token <ManualTag /></>}
          desc="前往 Discord Developer Portal，创建应用并生成 Bot Token。"
        >
          <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', marginTop: 8, marginBottom: 10 }}>
            <button className="btn btn-ghost btn-sm">打开 Discord Developer Portal →</button>
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)' }}>
            <div>① 点「New Application」，填写名称，创建应用</div>
            <div>② 左侧菜单点「Bot」→ 点「Add Bot」→ 确认</div>
            <div>③ 在「Token」处点「Reset Token」，复制生成的 Token</div>
            <div>④ 向下滚动，开启 <strong style={{ color: 'var(--teal)' }}>Message Content Intent</strong>（否则无法读取消息内容）</div>
          </div>
        </StepCard>

        <StepCard num={2} active={!step1Done}
          title={<>将 Bot 邀请加入你的服务器 <ManualTag /></>}
          desc="生成 OAuth2 邀请链接，将机器人添加到目标 Discord 服务器。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>① 左侧菜单点「OAuth2」→「URL Generator」</div>
            <div>② Scopes 勾选 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>bot</code></div>
            <div>③ Bot Permissions 勾选：<strong>Send Messages</strong>、<strong>Read Message History</strong>、<strong>View Channels</strong></div>
            <div>④ 复制生成的 URL，在浏览器中打开，选择目标服务器，点「授权」</div>
          </div>
        </StepCard>

        <StepCard num={3} title="填写 Bot Token 并写入配置"
          desc="将第一步获取的 Bot Token 填入下方，一键完成接入。"
          done={step1Done} active={!step1Done}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">Bot Token</label>
              <input className="form-input" placeholder="MTExxx.Gxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={{ fontFamily: 'monospace', fontSize: 12 }}
                value={token} onChange={e => setToken(e.target.value)} />
              <div className="form-hint">Token 仅保存在本地，不会上传至任何服务器。</div>
            </div>
            <div>
              <button className={`btn btn-sm ${channelState === 'done' ? 'btn-success' : 'btn-primary'}`}
                onClick={configureChannel} disabled={channelState === 'loading' || !token.trim()}>
                {channelState === 'loading' ? <><span className="spin">↻</span> 配置中...</>
                  : channelState === 'done' ? '✓ 已配置'
                  : '保存并写入 OpenClaw 配置'}
              </button>
              {channelState === 'error' && <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>配置失败，请确认 Gateway 已启动。</div>}
            </div>
          </div>
        </StepCard>

        <StepCard num={4} active={step1Done}
          title={<>在 Discord 中测试机器人 <ManualTag /></>}
          desc="在已邀请机器人的服务器频道中，@机器人 发送消息进行测试。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>· 在服务器频道中输入 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>@你的Bot名 你好</code></div>
            <div>· OpenClaw 应当回复</div>
            <div>· 若无响应，检查 Message Content Intent 是否已开启，或查看 Gateway 状态</div>
          </div>
        </StepCard>

        {step1Done && (
          <div className="step done">
            <div className="step-num">✓</div>
            <div className="step-body">
              <div className="step-title">配置完成！</div>
              <div className="step-desc">Discord 机器人已就绪，Gateway 运行后即可在服务器中对话。</div>
              <span className="badge badge-green" style={{ marginTop: 6 }}><span className="dot dot-pulse"></span>Discord Channel 已激活</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
