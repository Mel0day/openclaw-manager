import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StepCard, ManualTag, IMConfigProps } from './shared';

type StepState = 'idle' | 'loading' | 'done' | 'error';

export default function QQConfig({ showToast, onConfigured }: IMConfigProps) {
  const [appId,       setAppId]       = useState('');
  const [appSecret,   setAppSecret]   = useState('');
  const [token,       setToken]       = useState('');
  const [dmPolicy,    setDmPolicy]    = useState<'open' | 'allowlist' | 'pairing'>('open');
  const [groupPolicy, setGroupPolicy] = useState<'open' | 'allowlist' | 'pairing'>('open');

  const [pluginState,  setPluginState]  = useState<StepState>('idle');
  const [credsSaved,   setCredsSaved]   = useState(false);
  const [channelState, setChannelState] = useState<StepState>('idle');

  useEffect(() => {
    invoke<{ app_id: string; app_secret: string; token: string }>('load_qq_config').then(cfg => {
      if (cfg.app_id) {
        setAppId(cfg.app_id);
        setAppSecret(cfg.app_secret);
        setToken(cfg.token ?? '');
        setCredsSaved(true);
        onConfigured?.();
      }
    }).catch(() => {});
  }, []);

  const installPlugin = async () => {
    setPluginState('loading');
    try {
      await invoke('install_qq_plugin');
      setPluginState('done');
      showToast('QQ Channel 插件安装成功', 'success');
    } catch (e: any) {
      setPluginState('error');
      showToast(`安装失败: ${e}`, 'error');
    }
  };

  const configureChannel = async () => {
    if (!appId || !appSecret) return;
    setChannelState('loading');
    try {
      await invoke('save_qq_config', { appId, appSecret, token });
      await invoke('configure_qq_channel', { appId, appSecret, token, dmPolicy, groupPolicy });
      setCredsSaved(true);
      setChannelState('done');
      onConfigured?.();
      showToast('QQ Channel 配置完成', 'success');
    } catch (e: any) {
      setChannelState('error');
      showToast(`配置失败: ${e}`, 'error');
    }
  };

  const step1Done  = pluginState === 'done';
  const step4Done  = channelState === 'done' || credsSaved;
  const formFilled = appId && appSecret;

  return (
    <>
      <div className="card" style={{ borderColor: 'rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.05)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.9 }}>
          QQ Channel 使用<strong style={{ color: 'var(--accent)' }}>WebSocket 长链接</strong>接收消息，
          无需公网 IP 或 Webhook 地址。<br />
          配置需要先安装社区插件，步骤 2–3 需在 QQ 开放平台手动完成，标有 <ManualTag /> 标记。
        </div>
      </div>

      <div className="steps">
        <StepCard num={1} title="安装 QQ Channel 插件"
          desc="QQ 机器人通过社区插件接入，需先安装。安装完成后重启 Gateway 才会生效。"
          done={step1Done} active={!step1Done}
        >
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${step1Done ? 'btn-success' : 'btn-primary'}`}
              onClick={installPlugin} disabled={pluginState === 'loading' || step1Done}>
              {pluginState === 'loading' ? <><span className="spin">↻</span> 安装中...</> : step1Done ? '✓ 已安装' : '一键安装插件'}
            </button>
            {pluginState === 'error' && (
              <div className="form-hint" style={{ color: 'var(--red)' }}>
                安装失败，可手动运行：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw plugins install https://github.com/openclaw/openclaw-channel-qq.git</code>
              </div>
            )}
          </div>
          {!step1Done && <div className="form-hint" style={{ marginTop: 6, color: 'var(--muted)' }}>
            插件来源：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw/openclaw-channel-qq</code>
          </div>}
        </StepCard>

        <StepCard num={2} active={step1Done}
          title={<>在 QQ 开放平台创建机器人 <ManualTag /></>}
          desc="进入 QQ 开放平台，创建机器人应用，开启 WebSocket 接入方式。"
        >
          <a href="https://bot.q.qq.com/" target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', marginTop: 8, marginBottom: 10 }}>
            <button className="btn btn-ghost btn-sm">打开 QQ 开放平台 →</button>
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)' }}>
            <div>① 登录 QQ 开放平台 → 「机器人」→「创建机器人」</div>
            <div>② 填写机器人名称、简介，上传头像，完成创建</div>
            <div>③ 进入「开发设置」→ 接入方式选择<strong style={{ color: 'var(--yellow)' }}>「WebSocket」</strong></div>
            <div>④ 在「频道设置」中将机器人加入目标频道或开启私域模式</div>
          </div>
        </StepCard>

        <StepCard num={3} active={step1Done}
          title={<>获取应用凭据 <ManualTag /></>}
          desc="在 QQ 开放平台的「开发设置」页面获取以下信息。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>· <strong>App ID</strong>：开发设置 → BotAppID</div>
            <div>· <strong>App Secret</strong>：开发设置 → App Secret（点击「重置」可获取）</div>
            <div>· <strong>Token</strong>（可选）：开发设置 → Token，WebSocket 模式非必填</div>
          </div>
        </StepCard>

        <StepCard num={4} title="填写凭据并写入 OpenClaw 配置"
          desc="将上一步获取的凭据填入下方，点击保存后自动写入 OpenClaw。"
          done={step4Done} active={step1Done && !step4Done}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">App ID（BotAppID）</label>
              <input className="form-input" placeholder="102xxxxxxxx"
                value={appId} onChange={e => setAppId(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">App Secret</label>
              <input className="form-input" type="password" placeholder="••••••••••••••••"
                value={appSecret} onChange={e => setAppSecret(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Token（可选）</label>
              <input className="form-input" placeholder="留空也可正常使用"
                value={token} onChange={e => setToken(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                私聊策略
                <select className="form-input" style={{ width: 110, padding: '4px 8px' }}
                  value={dmPolicy} onChange={e => setDmPolicy(e.target.value as any)}>
                  <option value="open">开放（所有人）</option>
                  <option value="allowlist">白名单</option>
                  <option value="pairing">配对制</option>
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                群聊策略
                <select className="form-input" style={{ width: 110, padding: '4px 8px' }}
                  value={groupPolicy} onChange={e => setGroupPolicy(e.target.value as any)}>
                  <option value="open">开放（所有人）</option>
                  <option value="allowlist">白名单</option>
                  <option value="pairing">配对制</option>
                </select>
              </label>
            </div>
            <div>
              <button className={`btn btn-sm ${channelState === 'done' ? 'btn-success' : 'btn-primary'}`}
                onClick={configureChannel} disabled={channelState === 'loading' || !formFilled}>
                {channelState === 'loading' ? <><span className="spin">↻</span> 配置中...</>
                  : channelState === 'done' ? '✓ 已配置' : '保存并写入 OpenClaw 配置'}
              </button>
              {channelState === 'error' && <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>配置失败，请确认 Gateway 已安装并运行。</div>}
              <div className="form-hint" style={{ marginTop: 6 }}>凭据仅保存在本地，不会上传至任何服务器。</div>
            </div>
          </div>
        </StepCard>

        <StepCard num={5} active={step4Done} title="重启 OpenClaw Gateway"
          desc="配置写入后，需要重启 Gateway 使插件生效。前往「服务面板」点击重启。"
        >
          <div className="form-hint" style={{ color: 'var(--accent)', marginTop: 4 }}>
            ⓘ 若 Gateway 此前未运行，直接点「启动」即可；已在运行则需「重启」。
          </div>
        </StepCard>

        <StepCard num={6} active={step4Done}
          title={<>在 QQ 中测试机器人 <ManualTag /></>}
          desc="在 QQ 频道中 @机器人，或通过私聊向机器人发送消息进行测试。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>· 频道：在频道中 @机器人 发送消息</div>
            <div>· 私聊：在机器人主页点「发消息」（需开启私域或主动消息权限）</div>
            <div>· 若无响应，检查「服务面板」Gateway 状态，或运行 Doctor 诊断</div>
          </div>
        </StepCard>

        {step4Done && (
          <div className="step done">
            <div className="step-num">✓</div>
            <div className="step-body">
              <div className="step-title">配置完成！</div>
              <div className="step-desc">QQ 机器人已就绪。重启 Gateway 后即可在 QQ 频道或私聊中与机器人对话。</div>
              <span className="badge badge-green" style={{ marginTop: 6 }}><span className="dot dot-pulse"></span>QQ Channel 已激活</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
