import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StepCard, ManualTag, IMConfigProps } from './shared';

type StepState = 'idle' | 'loading' | 'done' | 'error';

export default function TelegramConfig({ showToast, onConfigured }: IMConfigProps) {
  const [token,        setToken]        = useState('');
  const [credsSaved,   setCredsSaved]   = useState(false);
  const [channelState, setChannelState] = useState<StepState>('idle');

  useEffect(() => {
    invoke<{ token: string }>('load_telegram_config').then(cfg => {
      if (cfg.token) { setToken(cfg.token); setCredsSaved(true); onConfigured?.(); }
    }).catch(() => {});
  }, []);

  const configureChannel = async () => {
    if (!token.trim()) return;
    setChannelState('loading');
    try {
      await invoke('configure_telegram_channel', { token: token.trim() });
      setCredsSaved(true);
      setChannelState('done');
      onConfigured?.();
      showToast('Telegram Channel 配置完成', 'success');
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
          Telegram 是原生内置 Channel，使用<strong style={{ color: 'var(--accent)' }}>长轮询（Long Polling）</strong>接收消息，
          无需公网 IP，只需一个 Bot Token 即可完成接入。
        </div>
      </div>

      <div className="steps">
        <StepCard num={1} active={!step1Done}
          title={<>通过 BotFather 创建机器人，获取 Token <ManualTag /></>}
          desc="在 Telegram 中找到 @BotFather，发送 /newbot 指令，按提示创建机器人。"
        >
          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, marginBottom: 10 }}>
            <button className="btn btn-ghost btn-sm">打开 @BotFather →</button>
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)' }}>
            <div>① 向 @BotFather 发送 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>/newbot</code></div>
            <div>② 依次输入机器人显示名称（任意）和用户名（必须以 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>_bot</code> 结尾）</div>
            <div>③ BotFather 回复中复制 <strong>HTTP API Token</strong>（格式：<code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>123456:ABC-DEF...</code>）</div>
          </div>
        </StepCard>

        <StepCard num={2} title="填写 Bot Token 并写入配置"
          desc="将上一步获取的 Token 填入下方，一键完成接入。"
          done={step1Done} active={!step1Done}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">Bot Token</label>
              <input className="form-input" placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
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

        <StepCard num={3} active={step1Done}
          title={<>在 Telegram 中测试机器人 <ManualTag /></>}
          desc="搜索你的机器人用户名，向其发送 /start 或任意消息进行测试。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>· 在 Telegram 搜索你的 Bot 用户名 → 点「START」</div>
            <div>· 发送任意消息，OpenClaw 应当回复</div>
            <div>· 若无响应，检查「服务面板」Gateway 状态</div>
          </div>
        </StepCard>

        {step1Done && (
          <div className="step done">
            <div className="step-num">✓</div>
            <div className="step-body">
              <div className="step-title">配置完成！</div>
              <div className="step-desc">Telegram 机器人已就绪，Gateway 运行后即可在 Telegram 中对话。</div>
              <span className="badge badge-green" style={{ marginTop: 6 }}><span className="dot dot-pulse"></span>Telegram Channel 已激活</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
