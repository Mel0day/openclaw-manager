import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StepCard, ManualTag, IMConfigProps } from './shared';

type StepState = 'idle' | 'loading' | 'done' | 'error';

export default function DingtalkConfig({ showToast, onConfigured }: IMConfigProps) {
  const [clientId,     setClientId]     = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [corpId,       setCorpId]       = useState('');
  const [agentId,      setAgentId]      = useState('');
  const [dmPolicy,     setDmPolicy]     = useState<'open' | 'allowlist' | 'pairing'>('open');
  const [groupPolicy,  setGroupPolicy]  = useState<'open' | 'allowlist' | 'pairing'>('open');

  const [pluginState,  setPluginState]  = useState<StepState>('idle');
  const [credsSaved,   setCredsSaved]   = useState(false);
  const [channelState, setChannelState] = useState<StepState>('idle');

  useEffect(() => {
    invoke<{ client_id: string; client_secret: string; corp_id: string; agent_id: string }>(
      'load_dingtalk_config'
    ).then(cfg => {
      if (cfg.client_id) {
        setClientId(cfg.client_id);
        setClientSecret(cfg.client_secret);
        setCorpId(cfg.corp_id);
        setAgentId(cfg.agent_id);
        setCredsSaved(true);
        onConfigured?.();
      }
    }).catch(() => {});
  }, []);

  const installPlugin = async () => {
    setPluginState('loading');
    try {
      await invoke('install_dingtalk_plugin');
      setPluginState('done');
      showToast('钉钉插件安装成功', 'success');
    } catch (e: any) {
      setPluginState('error');
      showToast(`安装失败: ${e}`, 'error');
    }
  };

  const configureChannel = async () => {
    if (!clientId || !clientSecret || !corpId || !agentId) return;
    setChannelState('loading');
    try {
      await invoke('save_dingtalk_config', { clientId, clientSecret, corpId, agentId });
      await invoke('configure_dingtalk_channel', { clientId, clientSecret, corpId, agentId, dmPolicy, groupPolicy });
      setCredsSaved(true);
      setChannelState('done');
      onConfigured?.();
      showToast('钉钉 Channel 配置完成', 'success');
    } catch (e: any) {
      setChannelState('error');
      showToast(`配置失败: ${e}`, 'error');
    }
  };

  const step1Done  = pluginState === 'done';
  const step4Done  = channelState === 'done' || credsSaved;
  const formFilled = clientId && clientSecret && corpId && agentId;

  return (
    <>
      <div className="card" style={{ borderColor: 'rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.05)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.9 }}>
          钉钉 Channel 使用<strong style={{ color: 'var(--accent)' }}>Stream 模式（WebSocket 长链接）</strong>接收消息，
          无需公网 IP 或 Webhook 地址。<br />
          配置需要先安装社区插件，步骤 2–3 需在钉钉开放平台手动完成，标有 <ManualTag /> 标记。
        </div>
      </div>

      <div className="steps">
        <StepCard num={1} title="安装钉钉 Channel 插件"
          desc="钉钉支持通过社区插件接入，需先安装。安装完成后重启 Gateway 才会生效。"
          done={step1Done} active={!step1Done}
        >
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${step1Done ? 'btn-success' : 'btn-primary'}`}
              onClick={installPlugin} disabled={pluginState === 'loading' || step1Done}>
              {pluginState === 'loading' ? <><span className="spin">↻</span> 安装中...</> : step1Done ? '✓ 已安装' : '一键安装插件'}
            </button>
            {pluginState === 'error' && (
              <div className="form-hint" style={{ color: 'var(--red)' }}>
                安装失败，可手动运行：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw plugins install https://github.com/soimy/openclaw-channel-dingtalk.git</code>
              </div>
            )}
          </div>
          {!step1Done && <div className="form-hint" style={{ marginTop: 6, color: 'var(--muted)' }}>
            插件来源：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>soimy/openclaw-channel-dingtalk</code>
          </div>}
        </StepCard>

        <StepCard num={2} active={step1Done}
          title={<>在钉钉开放平台创建应用 <ManualTag /></>}
          desc="进入钉钉开放平台，在企业内部开发下创建应用，添加机器人能力，并将消息接收模式设为 Stream 模式。"
        >
          <a href="https://open-dev.dingtalk.com/" target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', marginTop: 8, marginBottom: 10 }}>
            <button className="btn btn-ghost btn-sm">打开钉钉开放平台 →</button>
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)' }}>
            <div>① 进入「应用开发」→「企业内部开发」→「创建应用」</div>
            <div>② 左侧「应用能力」→「添加应用能力」→ 选择「机器人」</div>
            <div>③ 机器人配置页 → <strong style={{ color: 'var(--yellow)' }}>消息接收模式选「Stream 模式」</strong></div>
            <div>④ 保存机器人配置，完成后去「版本管理与发布」发布一个版本</div>
          </div>
        </StepCard>

        <StepCard num={3} active={step1Done}
          title={<>获取应用凭据 <ManualTag /></>}
          desc="在钉钉开放平台的「凭据与基础信息」页面获取以下四项信息。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>· <strong>Client ID（AppKey）</strong>：凭据与基础信息 → Client ID</div>
            <div>· <strong>Client Secret（AppSecret）</strong>：凭据与基础信息 → Client Secret</div>
            <div>· <strong>CorpId</strong>：凭据与基础信息 → 企业 ID</div>
            <div>· <strong>AgentId</strong>：凭据与基础信息 → AgentId（数字）</div>
          </div>
        </StepCard>

        <StepCard num={4} title="填写凭据并写入 OpenClaw 配置"
          desc="将上一步获取的四项凭据填入下方，点击保存后自动写入 OpenClaw。"
          done={step4Done} active={step1Done && !step4Done}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">Client ID（AppKey）</label>
              <input className="form-input" placeholder="dingxxxxxxxxxxxxxxxx"
                value={clientId} onChange={e => setClientId(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Client Secret（AppSecret）</label>
              <input className="form-input" type="password" placeholder="••••••••••••••••"
                value={clientSecret} onChange={e => setClientSecret(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">CorpId（企业 ID）</label>
                <input className="form-input" placeholder="dingxxxxxxxxxxxxxxxx"
                  value={corpId} onChange={e => setCorpId(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">AgentId</label>
                <input className="form-input" placeholder="123456789"
                  value={agentId} onChange={e => setAgentId(e.target.value)} />
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

        <StepCard num={5} active={step4Done} title="重启 OpenClaw Gateway"
          desc="配置写入后，需要重启 Gateway 使插件生效。前往「服务面板」点击重启。"
        >
          <div className="form-hint" style={{ color: 'var(--accent)', marginTop: 4 }}>
            ⓘ 若 Gateway 此前未运行，直接点「启动」即可；已在运行则需「重启」。
          </div>
        </StepCard>

        <StepCard num={6} active={step4Done}
          title={<>在钉钉中测试机器人 <ManualTag /></>}
          desc="在钉钉客户端搜索框中搜索机器人名称，或者在企业群里 @机器人，发送消息测试。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>· 私聊：搜索机器人名称 → 点击机器人 → 直接发消息</div>
            <div>· 群聊：将机器人添加到群 → @机器人 发消息</div>
            <div>· 若无响应，检查「服务面板」Gateway 状态，或运行 Doctor 诊断</div>
          </div>
        </StepCard>

        {step4Done && (
          <div className="step done">
            <div className="step-num">✓</div>
            <div className="step-body">
              <div className="step-title">配置完成！</div>
              <div className="step-desc">钉钉机器人已就绪。重启 Gateway 后即可在钉钉中与机器人对话。</div>
              <span className="badge badge-green" style={{ marginTop: 6 }}><span className="dot dot-pulse"></span>钉钉 Channel 已激活</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
