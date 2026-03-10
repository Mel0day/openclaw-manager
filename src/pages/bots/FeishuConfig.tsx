import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StepCard, ManualTag, IMConfigProps } from './shared';

const PERMISSIONS_JSON = JSON.stringify({
  scopes: {
    tenant: [
      "aily:file:read", "aily:file:write",
      "application:application.app_message_stats.overview:readonly",
      "application:application:self_manage",
      "application:bot.menu:write",
      "cardkit:card:read", "cardkit:card:write",
      "contact:user.employee_id:readonly",
      "corehr:file:download",
      "event:ip_list",
      "im:chat.access_event.bot_p2p_chat:read",
      "im:chat.members:bot_access",
      "im:message", "im:message.group_at_msg:readonly",
      "im:message.p2p_msg:readonly", "im:message:readonly",
      "im:message:send_as_bot", "im:resource"
    ],
    user: [
      "aily:file:read", "aily:file:write",
      "im:chat.access_event.bot_p2p_chat:read"
    ]
  }
}, null, 2);

type StepState = 'idle' | 'loading' | 'done' | 'error';

export default function FeishuConfig({ showToast, onConfigured }: IMConfigProps) {
  const [appId,       setAppId]       = useState('');
  const [appSecret,   setAppSecret]   = useState('');
  const [domain,      setDomain]      = useState<'feishu' | 'lark'>('feishu');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingList, setPairingList] = useState('');

  const [credsSaved,    setCredsSaved]    = useState(false);
  const [channelState,  setChannelState]  = useState<StepState>('idle');
  const [pairingState,  setPairingState]  = useState<StepState>('idle');

  const [allowList,     setAllowList]     = useState<string[]>([]);
  const [newOpenId,     setNewOpenId]     = useState('');
  const [allowState,    setAllowState]    = useState<StepState>('idle');

  const [sdkState,       setSdkState]       = useState<StepState>('idle');
  const [sdkInstalled,   setSdkInstalled]   = useState<boolean | null>(null);
  const [hasProxy,       setHasProxy]       = useState<boolean | null>(null);
  const [proxyState,     setProxyState]     = useState<StepState>('idle');
  const [scriptPath,     setScriptPath]     = useState('');
  const [scriptState,    setScriptState]    = useState<StepState>('idle');
  const [scriptRunState, setScriptRunState] = useState<StepState>('idle');
  const [dmPolicy,       setDmPolicy]       = useState<'allow' | 'allowlist'>('allow');
  const [policyState,    setPolicyState]    = useState<StepState>('idle');

  useEffect(() => {
    invoke<{ app_id: string; app_secret: string }>('load_feishu_config').then(cfg => {
      if (cfg.app_id) { setAppId(cfg.app_id); setCredsSaved(true); onConfigured?.(); }
      if (cfg.app_secret) setAppSecret(cfg.app_secret);
    });
    invoke<boolean>('check_gateway_proxy').then(setHasProxy);
    invoke<string[]>('get_feishu_allow_list').then(setAllowList).catch(() => {});
    invoke<boolean>('check_feishu_sdk').then(ok => {
      setSdkInstalled(ok);
      if (ok) setSdkState('done');
    }).catch(() => setSdkInstalled(false));
    invoke<string>('get_feishu_dm_policy').then(p => {
      setDmPolicy(p === 'allowlist' ? 'allowlist' : 'allow');
    }).catch(() => {});
  }, []);

  const configureChannel = async () => {
    if (!appId || !appSecret) return;
    setChannelState('loading');
    try {
      await invoke('save_feishu_config', { appId, appSecret });
      await invoke('configure_feishu_channel', { appId, appSecret, domain, dmPolicy });
      setCredsSaved(true);
      setChannelState('done');
      onConfigured?.();
      showToast('飞书 Channel 配置完成', 'success');
    } catch (e: any) {
      setChannelState('error');
      showToast(`配置失败: ${e}`, 'error');
    }
  };

  const toggleDmPolicy = async (policy: 'allow' | 'allowlist') => {
    setPolicyState('loading');
    try {
      await invoke('set_feishu_dm_policy', { policy });
      setDmPolicy(policy);
      setPolicyState('idle');
      showToast(policy === 'allow' ? '已开放：所有人可发消息' : '已切换为白名单模式', 'success');
    } catch (e: any) {
      setPolicyState('idle');
      showToast(`切换失败: ${e}`, 'error');
    }
  };

  const installSdk = async () => {
    setSdkState('loading');
    try {
      await invoke('install_feishu_sdk');
      setSdkState('done');
      showToast('飞书 Python SDK 安装成功', 'success');
    } catch (e: any) {
      setSdkState('error');
      showToast(`安装失败: ${e}`, 'error');
    }
  };

  const fixProxy = async () => {
    setProxyState('loading');
    try {
      const msg = await invoke<string>('fix_gateway_proxy');
      setProxyState('done');
      showToast(msg, 'success');
    } catch (e: any) {
      setProxyState('error');
      showToast(`修复失败: ${e}`, 'error');
    }
  };

  const generateScript = async () => {
    if (!appId || !appSecret) { showToast('请先填写 App ID 和 App Secret', 'error'); return; }
    setScriptState('loading');
    try {
      const path = await invoke<string>('generate_feishu_test_script', { appId, appSecret });
      setScriptPath(path);
      setScriptState('done');
      showToast(`测试脚本已生成：${path}`, 'success');
    } catch (e: any) {
      setScriptState('error');
      showToast(`生成失败: ${e}`, 'error');
    }
  };

  const runScript = async () => {
    setScriptRunState('loading');
    try {
      const msg = await invoke<string>('run_feishu_test_script');
      setScriptRunState('done');
      showToast(msg, 'success');
    } catch (e: any) {
      setScriptRunState('error');
      showToast(`启动失败: ${e}`, 'error');
    }
  };

  const addAllowUser = async () => {
    const id = newOpenId.trim();
    if (!id) return;
    setAllowState('loading');
    try {
      const msg = await invoke<string>('add_feishu_allow_user', { openId: id });
      setAllowList(l => l.includes(id) ? l : [...l, id]);
      setNewOpenId('');
      setAllowState('idle');
      showToast(msg, 'success');
    } catch (e: any) {
      setAllowState('error');
      showToast(`添加失败: ${e}`, 'error');
    }
  };

  const removeAllowUser = async (id: string) => {
    try {
      const msg = await invoke<string>('remove_feishu_allow_user', { openId: id });
      setAllowList(l => l.filter(x => x !== id));
      showToast(msg, 'info');
    } catch (e: any) {
      showToast(`移除失败: ${e}`, 'error');
    }
  };

  const checkPairingList = async () => {
    try {
      const res = await invoke<string>('list_feishu_pairing');
      setPairingList(res || '（暂无待配对请求）');
    } catch (e: any) {
      setPairingList(`${e}`);
    }
  };

  const approvePairing = async () => {
    if (!pairingCode.trim()) return;
    setPairingState('loading');
    try {
      const result = await invoke<string>('approve_feishu_pairing', { code: pairingCode.trim() });
      setPairingState('done');
      showToast(result || '配对成功！', 'success');
    } catch (e: any) {
      setPairingState('error');
      showToast(`配对失败: ${e}`, 'error');
    }
  };

  const step1Done = channelState === 'done' || credsSaved;
  const step5Done = pairingState === 'done';

  return (
    <>
      <div className="card" style={{ borderColor: 'rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.05)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.9 }}>
          飞书 Channel 使用<strong style={{ color: 'var(--accent)' }}>长链接（WebSocket）</strong>接收消息，
          无需公网 IP 或 Webhook 地址。<br />
          步骤 2–4 需要在飞书开放平台手动完成，标有 <ManualTag /> 标记。
        </div>
      </div>

      <div className="steps">
        <StepCard num={1} title="填写应用凭据并写入配置"
          desc="在飞书开放平台创建企业自建应用，获取 App ID 与 App Secret 后填入下方。"
          done={step1Done} active={!step1Done}
        >
          <a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 12 }}>
            <button className="btn btn-ghost btn-sm">打开飞书开放平台 →</button>
          </a>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              版本
              <select className="form-input" style={{ width: 130, padding: '4px 8px' }}
                value={domain} onChange={e => setDomain(e.target.value as 'feishu' | 'lark')}>
                <option value="feishu">飞书（国内）</option>
                <option value="lark">Lark（国际）</option>
              </select>
            </label>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">App ID</label>
            <input className="form-input" placeholder="cli_xxxxxxxxxxxxxxxx"
              value={appId} onChange={e => setAppId(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">App Secret</label>
            <input className="form-input" type="password" placeholder="••••••••••••••••"
              value={appSecret} onChange={e => setAppSecret(e.target.value)} />
            <div className="form-hint">凭据仅保存在本地配置文件，不会上传至任何服务器。</div>
          </div>
          <button className={`btn btn-sm ${channelState === 'done' ? 'btn-success' : 'btn-primary'}`}
            onClick={configureChannel} disabled={channelState === 'loading' || !appId || !appSecret}>
            {channelState === 'loading' ? <><span className="spin">↻</span> 配置中...</>
              : channelState === 'done' ? '✓ 已配置'
              : '保存并写入 OpenClaw 配置'}
          </button>
          {channelState === 'error' && (
            <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>
              失败。请确认 Gateway 已启动，或手动运行：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw channels add</code>
            </div>
          )}
        </StepCard>

        <div className="card" style={{ marginBottom: 0, borderColor: step1Done ? 'rgba(74,158,255,0.25)' : 'var(--border)' }}>
          <div className="card-title">本地工具准备</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>① 安装飞书 Node.js SDK</span>
                {sdkInstalled === true && <span className="badge badge-green"><span className="dot"></span>已安装</span>}
                {sdkInstalled === false && <span className="badge" style={{ background: 'rgba(255,80,80,0.15)', color: 'var(--red)' }}>未安装</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 8 }}>
                安装 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>@larksuiteoapi/node-sdk</code>，OpenClaw Gateway 飞书插件依赖此包。
              </div>
              <button className={`btn btn-sm ${sdkState === 'done' ? 'btn-success' : 'btn-primary'}`}
                onClick={installSdk} disabled={sdkState === 'loading' || sdkInstalled === true}>
                {sdkState === 'loading' ? <><span className="spin">↻</span> 安装中...</>
                  : sdkInstalled === true ? '✓ 已安装'
                  : 'npm install -g @larksuiteoapi/node-sdk'}
              </button>
            </div>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>② 修复 Gateway 代理配置</div>
              {hasProxy === null && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>检测中...</div>}
              {hasProxy === false && (
                <span className="badge badge-green"><span className="dot"></span>未检测到代理，无需此步骤</span>
              )}
              {hasProxy === true && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 8 }}>
                    检测到代理（Clash / V2Ray 等），连接飞书时会失败。此操作将飞书域名加入 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>NO_PROXY</code>。
                  </div>
                  <button className={`btn btn-sm ${proxyState === 'done' ? 'btn-success' : proxyState === 'error' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={fixProxy} disabled={proxyState === 'loading' || proxyState === 'done'}>
                    {proxyState === 'loading' ? <><span className="spin">↻</span> 修复中</> : proxyState === 'done' ? '✓ 已修复' : '修复代理配置'}
                  </button>
                </>
              )}
            </div>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>③ 生成并运行长链接测试脚本</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 8 }}>
                飞书开发者后台需要检测到活跃连接才能保存「长连接」事件订阅配置。
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className={`btn btn-sm ${scriptState === 'done' ? 'btn-success' : 'btn-ghost'}`}
                  onClick={generateScript} disabled={scriptState === 'loading' || !step1Done}>
                  {scriptState === 'loading' ? <><span className="spin">↻</span> 生成中</> : scriptState === 'done' ? '✓ 脚本已生成' : '生成测试脚本'}
                </button>
                <button className={`btn btn-sm ${scriptRunState === 'done' ? 'btn-success' : 'btn-primary'}`}
                  onClick={runScript} disabled={scriptRunState === 'loading' || scriptState !== 'done' || scriptRunState === 'done'}>
                  {scriptRunState === 'loading' ? <><span className="spin">↻</span> 启动中</> : scriptRunState === 'done' ? '✓ 脚本运行中' : '▶ 运行脚本'}
                </button>
              </div>
              {scriptPath && <div className="form-hint" style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 11, color: 'var(--muted2)' }}>{scriptPath}</div>}
            </div>
          </div>
        </div>

        <StepCard num={2} active={step1Done}
          title={<>配置应用权限 <ManualTag /></>}
          desc="在飞书开放平台 → 权限管理 → 批量导入，粘贴下方 JSON 后提交。"
        >
          <div style={{ position: 'relative', marginTop: 8 }}>
            <div className="log-box" style={{ maxHeight: 160, fontSize: 11, color: 'var(--teal)', userSelect: 'all' }}>{PERMISSIONS_JSON}</div>
            <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 8, right: 8 }}
              onClick={() => { navigator.clipboard.writeText(PERMISSIONS_JSON); showToast('已复制权限 JSON', 'info'); }}>
              复制
            </button>
          </div>
        </StepCard>

        <StepCard num={3} active={step1Done}
          title={<>启用机器人能力 <ManualTag /></>}
          desc="在飞书开放平台 → 应用能力 → 机器人，点击「启用」，填写机器人名称和描述。"
        />

        <StepCard num={4} active={step1Done} title="启动 OpenClaw Gateway"
          desc="飞书长链接需要 Gateway 主动连接飞书服务器。请先前往「服务面板」启动 Gateway。"
        >
          <div className="form-hint" style={{ color: 'var(--accent)', marginTop: 4 }}>
            ⓘ 飞书开放平台检测到连接后，才允许保存事件订阅配置。顺序不能颠倒。
          </div>
        </StepCard>

        <StepCard num={5} active={step1Done}
          title={<>配置事件订阅 <ManualTag /></>}
          desc="Gateway 运行后，回到飞书开放平台 → 事件与回调 → 事件订阅，选择「使用长连接接收事件」，添加以下事件，然后发布版本。"
        >
          <div style={{ fontSize: 12, color: 'var(--muted2)', paddingLeft: 6, marginTop: 8 }}>
            · <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>im.message.receive_v1</code>{' — '}接收消息（必须）
          </div>
          <div className="form-hint" style={{ marginTop: 8, color: 'var(--yellow)' }}>
            ⚠ 配置完成后，在「版本管理」发布应用版本，否则机器人无法收到消息。
          </div>
        </StepCard>

        <StepCard num={6} title="机器人配对授权"
          desc="应用发布后，在飞书中向机器人发送任意消息，机器人将回复配对码（5 分钟有效）。"
          done={step5Done} active={step1Done && !step5Done}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, marginTop: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={checkPairingList}>查看待配对列表</button>
          </div>
          {pairingList && <div className="log-box" style={{ maxHeight: 80, fontSize: 11, marginBottom: 10 }}>{pairingList}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">配对码</label>
              <input className="form-input" placeholder="粘贴机器人回复的配对码"
                value={pairingCode} onChange={e => setPairingCode(e.target.value)} disabled={step5Done} />
            </div>
            <button className={`btn btn-sm ${step5Done ? 'btn-success' : 'btn-primary'}`}
              onClick={approvePairing} disabled={pairingState === 'loading' || !pairingCode.trim() || step5Done}>
              {pairingState === 'loading' ? <><span className="spin">↻</span> 配对中</> : step5Done ? '✓ 已配对' : '确认配对'}
            </button>
          </div>
          {pairingState === 'error' && (
            <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>
              手动运行：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw pairing approve feishu &lt;配对码&gt;</code>
            </div>
          )}
        </StepCard>

        <div className="card" style={{ borderColor: 'rgba(74,158,255,0.25)' }}>
          <div className="card-title">私信权限</div>

          {/* dmPolicy 开关 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 8, lineHeight: 1.7 }}>
              控制哪些用户可以与机器人私信对话。修改后立即生效（无需重启 Gateway）。
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-sm ${dmPolicy === 'allow' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => toggleDmPolicy('allow')}
                disabled={policyState === 'loading' || dmPolicy === 'allow'}
              >
                🌐 允许所有人
              </button>
              <button
                className={`btn btn-sm ${dmPolicy === 'allowlist' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => toggleDmPolicy('allowlist')}
                disabled={policyState === 'loading' || dmPolicy === 'allowlist'}
              >
                🔒 仅白名单用户
              </button>
            </div>
            {dmPolicy === 'allowlist' && (
              <div className="form-hint" style={{ color: 'var(--yellow)', marginTop: 6 }}>
                ⚠ 白名单模式：未在下方名单中的用户发消息将被忽略。
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--muted2)', marginBottom: 8 }}>
            白名单用户（open_id）
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.7 }}>
            将用户的 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>open_id</code> 加入名单后，该用户无需每次重新配对。
          </div>
          {allowList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {allowList.map(id => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(74,158,255,0.08)', borderRadius: 6, padding: '5px 10px' }}>
                  <code style={{ fontFamily: 'monospace', fontSize: 12, flex: 1, color: 'var(--teal)' }}>{id}</code>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', color: 'var(--red)', fontSize: 11 }}
                    onClick={() => removeAllowUser(id)}>移除</button>
                </div>
              ))}
            </div>
          )}
          {allowList.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 10 }}>暂无授权用户。</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" placeholder="ou_xxxxxxxxxxxxxxxxxxxxxxxx"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              value={newOpenId} onChange={e => setNewOpenId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAllowUser()} />
            <button className="btn btn-primary btn-sm" onClick={addAllowUser}
              disabled={allowState === 'loading' || !newOpenId.trim()}>
              {allowState === 'loading' ? <><span className="spin">↻</span> 添加中</> : '添加'}
            </button>
          </div>
        </div>

        {step5Done && (
          <div className="step done">
            <div className="step-num">✓</div>
            <div className="step-body">
              <div className="step-title">配置完成！</div>
              <div className="step-desc">飞书机器人已就绪，确认「服务面板」中 Gateway 正在运行后即可使用。</div>
              <span className="badge badge-green" style={{ marginTop: 6 }}><span className="dot dot-pulse"></span>飞书 Channel 已激活</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
