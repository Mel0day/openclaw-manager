import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ShowToast } from '../App';

// 权限清单 JSON（供用户复制到飞书开放平台批量导入）
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

function StepCard({ num, title, desc, done, active, children }: {
  num: number; title: string; desc: string;
  done?: boolean; active?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className={`step ${done ? 'done' : active ? 'active' : ''}`}>
      <div className="step-num">{done ? '✓' : num}</div>
      <div className="step-body">
        <div className="step-title">{title}</div>
        <div className="step-desc">{desc}</div>
        {children}
      </div>
    </div>
  );
}

function ManualTag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)',
      color: 'var(--yellow)', padding: '1px 6px', borderRadius: 4,
      marginLeft: 6, verticalAlign: 'middle', letterSpacing: 0.5,
    }}>手动</span>
  );
}

export default function Feishu({ showToast }: { showToast: ShowToast }) {
  const [appId,       setAppId]       = useState('');
  const [appSecret,   setAppSecret]   = useState('');
  const [domain,      setDomain]      = useState<'feishu' | 'lark'>('feishu');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingList, setPairingList] = useState('');

  const [credsSaved,    setCredsSaved]    = useState(false);
  const [channelState,  setChannelState]  = useState<StepState>('idle');
  const [pairingState,  setPairingState]  = useState<StepState>('idle');

  // allowlist
  const [allowList,     setAllowList]     = useState<string[]>([]);
  const [newOpenId,     setNewOpenId]     = useState('');
  const [allowState,    setAllowState]    = useState<StepState>('idle');

  // tool states
  const [sdkState,       setSdkState]       = useState<StepState>('idle');
  const [hasProxy,       setHasProxy]       = useState<boolean | null>(null); // null = checking
  const [proxyState,     setProxyState]     = useState<StepState>('idle');
  const [scriptPath,     setScriptPath]     = useState('');
  const [scriptState,    setScriptState]    = useState<StepState>('idle');
  const [scriptRunState, setScriptRunState] = useState<StepState>('idle');

  useEffect(() => {
    invoke<{ app_id: string; app_secret: string }>('load_feishu_config').then(cfg => {
      if (cfg.app_id)     { setAppId(cfg.app_id); setCredsSaved(true); }
      if (cfg.app_secret)   setAppSecret(cfg.app_secret);
    });
    invoke<boolean>('check_gateway_proxy').then(setHasProxy);
    invoke<string[]>('get_feishu_allow_list').then(setAllowList).catch(() => {});
  }, []);

  // ── Step 1: save & configure channel ──────────────────────────────────────
  const configureChannel = async () => {
    if (!appId || !appSecret) return;
    setChannelState('loading');
    try {
      // Save locally for persistence
      await invoke('save_feishu_config', { appId, appSecret });
      // Write to openclaw config
      await invoke('configure_feishu_channel', { appId, appSecret, domain });
      setCredsSaved(true);
      setChannelState('done');
      showToast('飞书 Channel 配置完成', 'success');
    } catch (e: any) {
      setChannelState('error');
      showToast(`配置失败: ${e}`, 'error');
    }
  };

  // ── Tool actions ─────────────────────────────────────────────────────────
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

  // ── Allowlist management ──────────────────────────────────────────────────
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

  // ── Step 5: pairing ───────────────────────────────────────────────────────
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
      {/* Info banner */}
      <div className="card" style={{ borderColor: 'rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.05)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.9 }}>
          OpenClaw 飞书 Channel 使用<strong style={{ color: 'var(--accent)' }}>长链接（WebSocket）</strong>接收消息，
          无需公网 IP 或 Webhook 地址，无需安装额外插件。<br />
          步骤 2–4 需要在飞书开放平台手动完成，标有 <ManualTag>手动</ManualTag> 标记。
        </div>
      </div>

      <div className="steps">

        {/* Step 1: 凭据 + 写入配置 */}
        <StepCard
          num={1} title="填写应用凭据并写入配置"
          desc="在飞书开放平台创建企业自建应用，获取 App ID 与 App Secret 后填入下方。"
          done={step1Done} active={!step1Done}
        >
          <a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 12 }}>
            <button className="btn btn-ghost btn-sm">打开飞书开放平台 →</button>
          </a>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              版本
              <select
                className="form-input"
                style={{ width: 130, padding: '4px 8px' }}
                value={domain}
                onChange={e => setDomain(e.target.value as 'feishu' | 'lark')}
              >
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
          <button
            className={`btn btn-sm ${channelState === 'done' ? 'btn-success' : 'btn-primary'}`}
            onClick={configureChannel}
            disabled={channelState === 'loading' || !appId || !appSecret}
          >
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

        {/* Tool card: SDK + Proxy + Test script */}
        <div className="card" style={{ marginBottom: 0, borderColor: step1Done ? 'rgba(74,158,255,0.25)' : 'var(--border)' }}>
          <div className="card-title">本地工具准备</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* SDK */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>① 安装飞书 Python SDK</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 8 }}>
                安装 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>lark-oapi</code>，
                用于建立临时长链接让飞书开发者后台完成验证，以及本地调试。
              </div>
              <button
                className={`btn btn-sm ${sdkState === 'done' ? 'btn-success' : 'btn-primary'}`}
                onClick={installSdk}
                disabled={sdkState === 'loading' || sdkState === 'done'}
              >
                {sdkState === 'loading' ? <><span className="spin">↻</span> 安装中...</>
                  : sdkState === 'done' ? '✓ 已安装'
                  : 'pip3 install lark-oapi'}
              </button>
              {sdkState === 'error' && (
                <div className="form-hint" style={{ color: 'var(--red)', marginTop: 4 }}>
                  安装失败，请手动运行：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>pip3 install lark-oapi --upgrade</code>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Proxy fix */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>② 修复 Gateway 代理配置</div>
              {hasProxy === null && (
                <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>检测中...</div>
              )}
              {hasProxy === false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-green"><span className="dot"></span>未检测到代理，无需此步骤</span>
                </div>
              )}
              {hasProxy === true && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 8 }}>
                    检测到 Gateway 使用了代理（Clash / V2Ray 等），连接飞书时会因重定向循环失败。
                    此操作将飞书域名加入 LaunchAgent 的{' '}
                    <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>NO_PROXY</code> 并重载服务。
                  </div>
                  <button
                    className={`btn btn-sm ${proxyState === 'done' ? 'btn-success' : proxyState === 'error' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={fixProxy}
                    disabled={proxyState === 'loading' || proxyState === 'done'}
                  >
                    {proxyState === 'loading' ? <><span className="spin">↻</span> 修复中...</>
                      : proxyState === 'done' ? '✓ 已修复'
                      : '修复代理配置'}
                  </button>
                  {proxyState === 'error' && (
                    <div className="form-hint" style={{ color: 'var(--red)', marginTop: 4 }}>修复失败，请确认 Gateway 服务已安装。</div>
                  )}
                </>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Test script */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>③ 生成并运行长链接测试脚本</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 8 }}>
                飞书开发者后台需要检测到活跃连接才能保存「长连接」事件订阅配置。
                先生成脚本，再运行它，然后去飞书开发者后台点保存。配置完成后脚本可停止，Gateway 接管。
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-sm ${scriptState === 'done' ? 'btn-success' : 'btn-ghost'}`}
                  onClick={generateScript}
                  disabled={scriptState === 'loading' || !step1Done}
                >
                  {scriptState === 'loading' ? <><span className="spin">↻</span> 生成中</>
                    : scriptState === 'done' ? '✓ 脚本已生成'
                    : '生成测试脚本'}
                </button>
                <button
                  className={`btn btn-sm ${scriptRunState === 'done' ? 'btn-success' : 'btn-primary'}`}
                  onClick={runScript}
                  disabled={scriptRunState === 'loading' || scriptState !== 'done' || scriptRunState === 'done'}
                >
                  {scriptRunState === 'loading' ? <><span className="spin">↻</span> 启动中</>
                    : scriptRunState === 'done' ? '✓ 脚本运行中'
                    : '▶ 运行脚本'}
                </button>
              </div>
              {scriptPath && (
                <div className="form-hint" style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 11, color: 'var(--muted2)' }}>
                  {scriptPath}
                </div>
              )}
              {scriptRunState === 'done' && (
                <div className="form-hint" style={{ color: 'var(--green)', marginTop: 6 }}>
                  ✓ 长链接已建立，现在去飞书开发者后台保存事件订阅配置。
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Step 2: 权限 */}
        <StepCard
          num={2} active={step1Done}
          title={<>配置应用权限 <ManualTag>手动</ManualTag></> as any}
          desc="在飞书开放平台 → 权限管理 → 批量导入，粘贴下方 JSON 后提交。"
        >
          <div style={{ position: 'relative', marginTop: 8 }}>
            <div className="log-box" style={{ maxHeight: 160, fontSize: 11, color: 'var(--teal)', userSelect: 'all' }}>
              {PERMISSIONS_JSON}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ position: 'absolute', top: 8, right: 8 }}
              onClick={() => { navigator.clipboard.writeText(PERMISSIONS_JSON); showToast('已复制权限 JSON', 'info'); }}
            >
              复制
            </button>
          </div>
        </StepCard>

        {/* Step 3: 启用机器人 */}
        <StepCard
          num={3} active={step1Done}
          title={<>启用机器人能力 <ManualTag>手动</ManualTag></> as any}
          desc="在飞书开放平台 → 应用能力 → 机器人，点击「启用」，填写机器人名称和描述。"
        />

        {/* Step 4: 启动 Gateway */}
        <StepCard
          num={4} active={step1Done}
          title="启动 OpenClaw Gateway"
          desc="飞书长链接需要 Gateway 主动连接飞书服务器。请先前往「服务面板」启动 Gateway，等状态变为「运行中」再继续下一步。"
        >
          <div className="form-hint" style={{ color: 'var(--accent)', marginTop: 4 }}>
            ⓘ 飞书开放平台检测到连接后，才允许保存事件订阅配置。顺序不能颠倒。
          </div>
        </StepCard>

        {/* Step 5: 事件订阅 */}
        <StepCard
          num={5} active={step1Done}
          title={<>配置事件订阅 <ManualTag>手动</ManualTag></> as any}
          desc="Gateway 运行后，回到飞书开放平台 → 事件与回调 → 事件订阅，选择「使用长连接接收事件」，添加以下事件，然后发布版本。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--muted2)', paddingLeft: 6 }}>
              · <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>im.message.receive_v1</code>
              {' — '}接收消息（必须）
            </div>
          </div>
          <div className="form-hint" style={{ marginTop: 8, color: 'var(--yellow)' }}>
            ⚠ 配置完成后，在「版本管理」发布应用版本，否则机器人无法收到消息。
          </div>
        </StepCard>

        {/* Step 6: 配对 */}
        <StepCard
          num={6} title="机器人配对授权"
          desc="应用发布后，在飞书中向机器人发送任意消息，机器人将回复配对码（5 分钟有效）。"
          done={step5Done} active={step1Done && !step5Done}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, marginTop: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={checkPairingList}>
              查看待配对列表
            </button>
          </div>
          {pairingList && (
            <div className="log-box" style={{ maxHeight: 80, fontSize: 11, marginBottom: 10 }}>
              {pairingList}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">配对码</label>
              <input
                className="form-input"
                placeholder="粘贴机器人回复的配对码"
                value={pairingCode}
                onChange={e => setPairingCode(e.target.value)}
                disabled={step5Done}
              />
            </div>
            <button
              className={`btn btn-sm ${step5Done ? 'btn-success' : 'btn-primary'}`}
              onClick={approvePairing}
              disabled={pairingState === 'loading' || !pairingCode.trim() || step5Done}
            >
              {pairingState === 'loading' ? <><span className="spin">↻</span> 配对中</>
                : step5Done ? '✓ 已配对'
                : '确认配对'}
            </button>
          </div>
          {pairingState === 'error' && (
            <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>
              手动运行：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw pairing approve feishu &lt;配对码&gt;</code>
            </div>
          )}
        </StepCard>

        {/* Allowlist management */}
        <div className="card" style={{ borderColor: 'rgba(74,158,255,0.25)' }}>
          <div className="card-title">免配对用户名单（allowFrom）</div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.7 }}>
            将用户的 Feishu <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 11 }}>open_id</code> 加入此名单后，
            该用户无需每次重新配对，Gateway 重启后仍保持授权。
            配对时机器人会提示：<em>Your Feishu user id: ou_xxxx</em>，复制此 ID 填入下方即可。
          </div>
          {allowList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {allowList.map(id => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(74,158,255,0.08)', borderRadius: 6, padding: '5px 10px' }}>
                  <code style={{ fontFamily: 'monospace', fontSize: 12, flex: 1, color: 'var(--teal)' }}>{id}</code>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 8px', color: 'var(--red)', fontSize: 11 }}
                    onClick={() => removeAllowUser(id)}
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
          {allowList.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 10 }}>
              暂无授权用户，添加后 Gateway 重启也不会要求重新配对。
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              placeholder="ou_xxxxxxxxxxxxxxxxxxxxxxxx"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              value={newOpenId}
              onChange={e => setNewOpenId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAllowUser()}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={addAllowUser}
              disabled={allowState === 'loading' || !newOpenId.trim()}
            >
              {allowState === 'loading' ? <><span className="spin">↻</span> 添加中</> : '添加'}
            </button>
          </div>
          {allowState === 'error' && (
            <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>
              添加失败，请确认已完成第一步配置。
            </div>
          )}
        </div>

        {/* Done */}
        {step5Done && (
          <div className="step done">
            <div className="step-num">✓</div>
            <div className="step-body">
              <div className="step-title">配置完成！</div>
              <div className="step-desc">
                飞书机器人已就绪。确认「服务面板」中 Gateway 正在运行，然后在飞书中与机器人对话即可。
              </div>
              <span className="badge badge-green" style={{ marginTop: 6 }}>
                <span className="dot dot-pulse"></span>飞书 Channel 已激活
              </span>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
