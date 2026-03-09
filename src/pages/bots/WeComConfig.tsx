import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StepCard, ManualTag, IMConfigProps } from './shared';

type StepState = 'idle' | 'loading' | 'done' | 'error';

export default function WeComConfig({ showToast, onConfigured }: IMConfigProps) {
  const [corpId,      setCorpId]      = useState('');
  const [agentId,     setAgentId]     = useState('');
  const [appSecret,   setAppSecret]   = useState('');
  const [token,       setToken]       = useState('');
  const [encodingKey, setEncodingKey] = useState('');
  const [dmPolicy,    setDmPolicy]    = useState<'open' | 'allowlist' | 'pairing'>('open');
  const [groupPolicy, setGroupPolicy] = useState<'open' | 'allowlist' | 'pairing'>('open');

  const [pluginState,  setPluginState]  = useState<StepState>('idle');
  const [credsSaved,   setCredsSaved]   = useState(false);
  const [channelState, setChannelState] = useState<StepState>('idle');
  const [tunnelState,  setTunnelState]  = useState<StepState>('idle');
  const [tunnelUrl,    setTunnelUrl]    = useState('');

  useEffect(() => {
    invoke<{ corp_id: string; agent_id: string; app_secret: string; token: string; encoding_key: string }>(
      'load_wecom_config'
    ).then(cfg => {
      if (cfg.corp_id) {
        setCorpId(cfg.corp_id);
        setAgentId(cfg.agent_id);
        setAppSecret(cfg.app_secret);
        setToken(cfg.token ?? '');
        setEncodingKey(cfg.encoding_key ?? '');
        setCredsSaved(true);
        onConfigured?.();
      }
    }).catch(() => {});
  }, []);

  const installPlugin = async () => {
    setPluginState('loading');
    try {
      await invoke('install_wecom_plugin');
      setPluginState('done');
      showToast('企业微信插件安装成功', 'success');
    } catch (e: any) {
      setPluginState('error');
      showToast(`安装失败: ${e}`, 'error');
    }
  };

  const startTunnel = async () => {
    setTunnelState('loading');
    try {
      const url = await invoke<string>('start_wecom_tunnel');
      setTunnelUrl(url);
      setTunnelState('done');
      showToast('内网穿透已启动', 'success');
    } catch (e: any) {
      setTunnelState('error');
      showToast(`启动失败: ${e}`, 'error');
    }
  };

  const configureChannel = async () => {
    if (!corpId || !agentId || !appSecret) return;
    setChannelState('loading');
    try {
      await invoke('save_wecom_config', { corpId, agentId, appSecret, token, encodingKey });
      await invoke('configure_wecom_channel', { corpId, agentId, appSecret, token, encodingKey, dmPolicy, groupPolicy });
      setCredsSaved(true);
      setChannelState('done');
      onConfigured?.();
      showToast('企业微信 Channel 配置完成', 'success');
    } catch (e: any) {
      setChannelState('error');
      showToast(`配置失败: ${e}`, 'error');
    }
  };

  const step1Done  = pluginState === 'done';
  const step5Done  = channelState === 'done' || credsSaved;
  const formFilled = corpId && agentId && appSecret;

  return (
    <>
      <div className="card" style={{ borderColor: 'rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.05)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.9 }}>
          企业微信使用<strong style={{ color: 'var(--accent)' }}>回调模式（HTTP Webhook）</strong>接收消息，
          需要一个可被企业微信访问的回调地址。<br />
          插件内置<strong style={{ color: 'var(--yellow)' }}>内网穿透</strong>，无公网 IP 也可一键完成接入，
          步骤 2–4 需在企业微信管理后台手动完成，标有 <ManualTag /> 标记。
        </div>
      </div>

      <div className="steps">

        {/* Step 1: 安装插件 */}
        <StepCard num={1} title="安装企业微信 Channel 插件"
          desc="企业微信通过社区插件接入，包含回调服务器与内网穿透能力，安装后重启 Gateway 生效。"
          done={step1Done} active={!step1Done}
        >
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${step1Done ? 'btn-success' : 'btn-primary'}`}
              onClick={installPlugin} disabled={pluginState === 'loading' || step1Done}>
              {pluginState === 'loading' ? <><span className="spin">↻</span> 安装中...</> : step1Done ? '✓ 已安装' : '一键安装插件'}
            </button>
            {pluginState === 'error' && (
              <div className="form-hint" style={{ color: 'var(--red)' }}>
                安装失败，可手动运行：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw plugins install https://github.com/openclaw/openclaw-channel-wecom.git</code>
              </div>
            )}
          </div>
          {!step1Done && <div className="form-hint" style={{ marginTop: 6, color: 'var(--muted)' }}>
            插件来源：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw/openclaw-channel-wecom</code>
          </div>}
        </StepCard>

        {/* Step 2: 创建应用 */}
        <StepCard num={2} active={step1Done}
          title={<>在企业微信管理后台创建应用 <ManualTag /></>}
          desc="登录企业微信管理后台，在「应用管理」中创建自建应用。"
        >
          <a href="https://work.weixin.qq.com/wework_admin/frame#apps" target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', marginTop: 8, marginBottom: 10 }}>
            <button className="btn btn-ghost btn-sm">打开企业微信管理后台 →</button>
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)' }}>
            <div>① 进入「应用管理」→「自建」→「创建应用」</div>
            <div>② 填写应用名称、Logo，可见范围选「公司全员」（或指定部门）</div>
            <div>③ 创建后记录页面上的 <strong>AgentId</strong> 与 <strong>Secret</strong></div>
            <div>④ 在「企业信息」页面记录 <strong>企业 ID（CorpID）</strong></div>
          </div>
        </StepCard>

        {/* Step 3: 启动内网穿透，获取回调地址 */}
        <StepCard num={3} active={step1Done} title="启动内网穿透，获取回调地址"
          desc="企业微信需要一个公网可访问的回调 URL。点击下方按钮一键启动内网穿透，自动生成回调地址。"
        >
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${tunnelState === 'done' ? 'btn-success' : 'btn-primary'}`}
              onClick={startTunnel} disabled={tunnelState === 'loading' || tunnelState === 'done' || !step1Done}>
              {tunnelState === 'loading' ? <><span className="spin">↻</span> 启动中...</>
                : tunnelState === 'done' ? '✓ 隧道运行中'
                : '启动内网穿透'}
            </button>
            {tunnelState === 'error' && (
              <div className="form-hint" style={{ color: 'var(--red)' }}>
                启动失败，请检查网络连接或确认插件已安装。
              </div>
            )}
          </div>
          {tunnelUrl && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted2)' }}>回调地址（填入企业微信后台）：</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--teal)', background: 'rgba(74,158,255,0.08)', padding: '4px 10px', borderRadius: 6, flex: 1, wordBreak: 'break-all' }}>
                  {tunnelUrl}/wecom/callback
                </code>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => { navigator.clipboard.writeText(`${tunnelUrl}/wecom/callback`); showToast('已复制回调地址', 'info'); }}>
                  复制
                </button>
              </div>
            </div>
          )}
        </StepCard>

        {/* Step 4: 配置回调 */}
        <StepCard num={4} active={step1Done}
          title={<>在后台配置消息接收 <ManualTag /></>}
          desc="在企业微信应用详情页，配置「接收消息」，填入上一步生成的回调地址与随机字符串。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>① 进入应用详情 → 「接收消息」→「设置 API 接收」</div>
            <div>② <strong>URL</strong>：填入上一步复制的回调地址</div>
            <div>③ <strong>Token</strong>：自定义字符串，后续填入下方表单</div>
            <div>④ <strong>EncodingAESKey</strong>：点「随机生成」，后续填入下方表单</div>
            <div>⑤ 点「保存」，企业微信会向回调地址发一次验证请求（插件自动响应）</div>
          </div>
          <div className="form-hint" style={{ marginTop: 8, color: 'var(--yellow)' }}>
            ⚠ 保存前请确保内网穿透隧道处于运行状态，否则验证会失败。
          </div>
        </StepCard>

        {/* Step 5: 填写凭据 */}
        <StepCard num={5} title="填写凭据并写入 OpenClaw 配置"
          desc="将企业微信管理后台的凭据与上一步设置的 Token / EncodingAESKey 填入下方。"
          done={step5Done} active={step1Done && !step5Done}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">企业 ID（CorpID）</label>
              <input className="form-input" placeholder="ww1234567890abcdef"
                value={corpId} onChange={e => setCorpId(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">应用 AgentId</label>
                <input className="form-input" placeholder="1000002"
                  value={agentId} onChange={e => setAgentId(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">应用 Secret</label>
                <input className="form-input" type="password" placeholder="••••••••••••••••"
                  value={appSecret} onChange={e => setAppSecret(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Token</label>
                <input className="form-input" placeholder="与后台配置一致"
                  value={token} onChange={e => setToken(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">EncodingAESKey</label>
                <input className="form-input" placeholder="43 位字符"
                  value={encodingKey} onChange={e => setEncodingKey(e.target.value)} />
              </div>
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

        {/* Step 6: 重启 */}
        <StepCard num={6} active={step5Done} title="重启 OpenClaw Gateway"
          desc="配置写入后，需要重启 Gateway 使插件与隧道服务生效。前往「服务面板」点击重启。"
        >
          <div className="form-hint" style={{ color: 'var(--accent)', marginTop: 4 }}>
            ⓘ 重启后隧道会自动重新建立，回调地址不变。
          </div>
        </StepCard>

        {/* Step 7: 测试 */}
        <StepCard num={7} active={step5Done}
          title={<>在企业微信中测试机器人 <ManualTag /></>}
          desc="在企业微信客户端找到刚创建的应用，向机器人发送消息进行测试。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>· 在企业微信客户端 → 工作台 → 找到应用 → 点击发消息</div>
            <div>· 或在群聊中 @机器人 发消息（需开启群机器人权限）</div>
            <div>· 若无响应，检查「服务面板」Gateway 状态，或查看隧道是否仍在运行</div>
          </div>
        </StepCard>

        {step5Done && (
          <div className="step done">
            <div className="step-num">✓</div>
            <div className="step-body">
              <div className="step-title">配置完成！</div>
              <div className="step-desc">企业微信机器人已就绪。重启 Gateway 后即可在企业微信中与机器人对话。</div>
              <span className="badge badge-green" style={{ marginTop: 6 }}><span className="dot dot-pulse"></span>企业微信 Channel 已激活</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
