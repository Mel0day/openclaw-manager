import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ShowToast } from '../App';

// ── Provider form ─────────────────────────────────────────────────────────────

interface Provider {
  id: string; label: string; group: string;
  placeholder: string; fieldLabel: string; isUrl?: boolean;
}

const PROVIDERS: Provider[] = [
  // International
  { id: 'openai',      label: 'OpenAI',             group: '国际主流',    placeholder: 'sk-...',           fieldLabel: 'API Key' },
  { id: 'anthropic',   label: 'Anthropic (Claude)', group: '国际主流',    placeholder: 'sk-ant-api03-...', fieldLabel: 'API Key' },
  { id: 'openrouter',  label: 'OpenRouter',         group: '国际主流',    placeholder: 'sk-or-v1-...',     fieldLabel: 'API Key' },
  { id: 'mistral',     label: 'Mistral',            group: '国际主流',    placeholder: 'xxxxxxxxxxxxxxxx', fieldLabel: 'API Key' },
  { id: 'xai',         label: 'xAI (Grok)',         group: '国际主流',    placeholder: 'xai-...',          fieldLabel: 'API Key' },
  { id: 'together',    label: 'Together AI',        group: '国际主流',    placeholder: 'xxxxxxxxxxxxxxxx', fieldLabel: 'API Key' },
  { id: 'venice',      label: 'Venice AI',          group: '国际主流',    placeholder: 'xxxxxxxxxxxxxxxx', fieldLabel: 'API Key' },
  { id: 'huggingface', label: 'Hugging Face',       group: '国际主流',    placeholder: 'hf_...',           fieldLabel: 'API Token' },
  { id: 'litellm',     label: 'LiteLLM',            group: '国际主流',    placeholder: 'sk-...',           fieldLabel: 'API Key' },
  // China providers
  { id: 'volcengine',  label: '火山引擎 (Volcengine)', group: '国内模型', placeholder: 'xxxxxxxxxxxxxxxx', fieldLabel: 'API Key' },
  { id: 'google',      label: 'Google Gemini',      group: '国内模型',    placeholder: 'AIza...',          fieldLabel: 'API Key' },
  { id: 'moonshot',    label: '月之暗面 Moonshot',   group: '国内模型',    placeholder: 'sk-...',           fieldLabel: 'API Key' },
  { id: 'minimax',     label: 'MiniMax',            group: '国内模型',    placeholder: 'xxxxxxxxxxxxxxxx', fieldLabel: 'API Key' },
  { id: 'qianfan',     label: '百度千帆',             group: '国内模型',   placeholder: 'xxxxxxxxxxxxxxxx', fieldLabel: 'API Key' },
  { id: 'zai',         label: 'Z.AI',               group: '国内模型',    placeholder: 'xxxxxxxxxxxxxxxx', fieldLabel: 'API Key' },
  { id: 'xiaomi',      label: '小米 MiMo',           group: '国内模型',   placeholder: 'xxxxxxxxxxxxxxxx', fieldLabel: 'API Key' },
  { id: 'byteplus',    label: '火山引擎 BytePlus',    group: '国内模型',   placeholder: 'xxxxxxxxxxxxxxxx', fieldLabel: 'API Key' },
  // Local / self-hosted
  { id: 'ollama',      label: 'Ollama（本地）',       group: '本地/自托管', placeholder: 'http://127.0.0.1:11434', fieldLabel: '服务地址', isUrl: true },
  { id: 'vllm',        label: 'vLLM（自托管）',       group: '本地/自托管', placeholder: 'http://localhost:8000',  fieldLabel: '服务地址', isUrl: true },
];

const GROUPS = ['国际主流', '国内模型', '本地/自托管'];

function ProviderForm({ disabled, onSaved }: { disabled: boolean; onSaved: () => void }) {
  const [provider, setProvider] = useState('openai');
  const [value, setValue]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState<string[]>([]);

  const current = PROVIDERS.find(p => p.id === provider)!;

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await invoke('set_model_api_key', { provider, key: value.trim() });
      setSaved(s => [...s, current.label]);
      setValue('');
      onSaved();
    } catch (e: any) {
      alert(`保存失败: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      {saved.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {saved.map((l, i) => (
            <span key={i} className="badge badge-green"><span className="dot"></span>{l}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label className="form-label">提供商</label>
          <select
            className="form-input"
            style={{ width: 180 }}
            value={provider}
            onChange={e => { setProvider(e.target.value); setValue(''); }}
            disabled={disabled}
          >
            {GROUPS.map(g => (
              <optgroup key={g} label={g}>
                {PROVIDERS.filter(p => p.group === g).map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="form-label">{current.fieldLabel}</label>
          <input
            className="form-input"
            type={current.isUrl ? 'text' : 'password'}
            placeholder={current.placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={disabled}
          />
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={save}
          disabled={saving || !value.trim() || disabled}
          style={{ marginBottom: 0 }}
        >
          {saving ? <><span className="spin">↻</span> 保存中</> : '保存'}
        </button>
      </div>
    </div>
  );
}

interface EnvStatus { node: string | null; npm: string | null; openclaw: string | null; }
type StepStatus = 'idle' | 'loading' | 'done' | 'error';

export default function Setup({ showToast }: { showToast: ShowToast }) {
  const [env, setEnv] = useState<EnvStatus | null>(null);

  // step states
  const [installState,    setInstallState]    = useState<StepStatus>('idle');
  const [initState,       setInitState]       = useState<StepStatus>('idle');
  const [serviceState,    setServiceState]    = useState<StepStatus>('idle');
  const [apiKeyState,     setApiKeyState]     = useState<StepStatus>('idle');

  const checkEnv = async () => {
    setEnv(null);
    const status = await invoke<EnvStatus>('check_env');
    setEnv(status);
    if (status.openclaw) setInstallState('done');
  };

  // Detect already-completed steps on mount
  const detectExistingSetup = async () => {
    try {
      // Check if gateway mode config exists (step 3)
      const gw = await invoke<{ running: boolean; installed: boolean }>('get_gateway_service_status');
      if (gw.installed) {
        setInitState('done');
        setServiceState('done');
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    checkEnv();
    detectExistingSetup();
  }, []);

  // ── actions ────────────────────────────────────────────────────────────────

  const installOpenclaw = async () => {
    setInstallState('loading');
    try {
      await invoke('install_openclaw');
      showToast('OpenClaw 安装成功！', 'success');
      await checkEnv();
      setInstallState('done');
    } catch (e: any) {
      setInstallState('error');
      showToast(`安装失败: ${e}`, 'error');
    }
  };

  const initConfig = async () => {
    setInitState('loading');
    try {
      await invoke('init_openclaw_config');
      setInitState('done');
      showToast('配置初始化完成', 'success');
    } catch (e: any) {
      setInitState('error');
      showToast(`初始化失败: ${e}`, 'error');
    }
  };

  const installService = async () => {
    setServiceState('loading');
    try {
      await invoke('install_gateway_service');
      setServiceState('done');
      showToast('Gateway 服务安装成功', 'success');
    } catch (e: any) {
      setServiceState('error');
      showToast(`服务安装失败: ${e}`, 'error');
    }
  };

  // ── derived ────────────────────────────────────────────────────────────────

  const nodeOk      = !!(env?.node && env?.npm);
  const clawOk      = !!env?.openclaw || installState === 'done';
  const initOk      = initState === 'done';
  const serviceOk   = serviceState === 'done';
  const apiOk       = apiKeyState === 'done'; // at least one provider saved
  const allDone     = nodeOk && clawOk && initOk && serviceOk;

  const envItems = [
    { key: 'node',     label: 'Node.js', value: env?.node },
    { key: 'npm',      label: 'npm',     value: env?.npm },
    { key: 'openclaw', label: 'OpenClaw', value: env?.openclaw },
  ];

  const btnLabel = (state: StepStatus, labels: [string, string, string, string]) => {
    const [idle, loading, done, err] = labels;
    if (state === 'loading') return <><span className="spin">↻</span> {loading}</>;
    if (state === 'done')    return <>✓ {done}</>;
    if (state === 'error')   return err;
    return idle;
  };

  return (
    <>
      {/* Env check */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div className="card-title" style={{ margin: 0 }}>环境检测</div>
          <button className="btn btn-ghost btn-sm" onClick={checkEnv} disabled={env === null}>
            {env === null ? <span className="spin">↻</span> : '↻'} 刷新
          </button>
        </div>
        <div className="env-grid">
          {envItems.map(({ key, label, value }) => (
            <div key={key} className="env-item">
              <div className="env-label">{label}</div>
              <div className={`env-value ${env === null ? 'wait' : value ? 'ok' : 'err'}`}>
                {env === null ? '检测中...' : value ? `✓ ${value}` : '✗ 未安装'}
              </div>
            </div>
          ))}
        </div>
        {allDone && (
          <div className="mt8">
            <span className="badge badge-green"><span className="dot"></span>所有步骤已完成，可前往服务面板启动 Gateway</span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="card">
        <div className="card-title">安装向导</div>
        <div className="steps">

          {/* Step 1 */}
          <div className={`step ${nodeOk ? 'done' : 'active'}`}>
            <div className="step-num">{nodeOk ? '✓' : '1'}</div>
            <div className="step-body">
              <div className="step-title">安装 Node.js 22+</div>
              <div className="step-desc">OpenClaw 依赖 Node.js 22 或更高版本，请前往官网下载安装。</div>
              {!nodeOk && (
                <a href="https://nodejs.org" target="_blank" rel="noreferrer">
                  <button className="btn btn-ghost btn-sm">打开 nodejs.org →</button>
                </a>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className={`step ${clawOk ? 'done' : nodeOk ? 'active' : ''}`}>
            <div className="step-num">{clawOk ? '✓' : '2'}</div>
            <div className="step-body">
              <div className="step-title">安装 OpenClaw CLI</div>
              <div className="step-desc">
                自动运行 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 12 }}>npm install -g openclaw@latest</code>，
                安装到 <code style={{ fontFamily: 'monospace', color: 'var(--muted2)', fontSize: 12 }}>~/.npm-global</code>。
              </div>
              {!clawOk && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={installOpenclaw}
                  disabled={installState === 'loading' || !nodeOk}
                >
                  {btnLabel(installState, ['一键安装 OpenClaw', '安装中...', '已安装', '重试安装'])}
                </button>
              )}
              {installState === 'error' && (
                <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>
                  安装失败，请检查网络连接后重试。
                </div>
              )}
            </div>
          </div>

          {/* Step 3 */}
          <div className={`step ${initOk ? 'done' : clawOk ? 'active' : ''}`}>
            <div className="step-num">{initOk ? '✓' : '3'}</div>
            <div className="step-body">
              <div className="step-title">初始化配置</div>
              <div className="step-desc">
                设置 Gateway 运行模式为 <code style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: 12 }}>local</code>，创建配置目录。
              </div>
              {!initOk && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={initConfig}
                  disabled={initState === 'loading' || !clawOk}
                >
                  {btnLabel(initState, ['初始化配置', '初始化中...', '已完成', '重试'])}
                </button>
              )}
              {initState === 'error' && (
                <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>
                  失败，可手动运行：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw config set gateway.mode local</code>
                </div>
              )}
            </div>
          </div>

          {/* Step 4 */}
          <div className={`step ${serviceOk ? 'done' : initOk ? 'active' : ''}`}>
            <div className="step-num">{serviceOk ? '✓' : '4'}</div>
            <div className="step-body">
              <div className="step-title">安装 Gateway 系统服务</div>
              <div className="step-desc">
                将 Gateway 注册为系统后台服务（macOS LaunchAgent / Windows Task），开机自动启动。
              </div>
              {!serviceOk && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={installService}
                  disabled={serviceState === 'loading' || !initOk}
                >
                  {btnLabel(serviceState, ['安装服务', '安装中...', '已安装', '重试'])}
                </button>
              )}
              {serviceState === 'error' && (
                <div className="form-hint" style={{ color: 'var(--red)', marginTop: 6 }}>
                  失败，可手动运行：<code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw gateway install --force</code>
                </div>
              )}
            </div>
          </div>

          {/* Step 5 */}
          <div className={`step ${apiOk ? 'done' : serviceOk ? 'active' : ''}`}>
            <div className="step-num">{apiOk ? '✓' : '5'}</div>
            <div className="step-body">
              <div className="step-title">配置 AI 模型</div>
              <div className="step-desc">选择你使用的模型提供商并填入凭据，可多次保存配置多个。</div>
              <ProviderForm disabled={false} onSaved={() => setApiKeyState('done')} />
              <div className="form-hint" style={{ marginTop: 8 }}>
                也可跳过，之后在终端运行 <code style={{ fontFamily: 'monospace', fontSize: 11 }}>openclaw configure --section model</code>。
              </div>
            </div>
          </div>

          {/* Done */}
          {allDone && (
            <div className="step done">
              <div className="step-num">✓</div>
              <div className="step-body">
                <div className="step-title">安装完成</div>
                <div className="step-desc">
                  前往「服务面板」启动 Gateway，再到「飞书配置」完成机器人接入。
                </div>
                <span className="badge badge-green" style={{ marginTop: 6 }}><span className="dot dot-pulse"></span>已就绪</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Windows note */}
      <div className="card">
        <div className="card-title">Windows 用户须知</div>
        <p className="text-muted text-sm" style={{ lineHeight: 1.8 }}>
          OpenClaw 在 Windows 上需要通过 <strong style={{ color: 'var(--text)' }}>WSL2</strong>（Windows Subsystem for Linux）运行。
          请先在 PowerShell（管理员）中执行：
        </p>
        <div className="code-box mt8">wsl --install</div>
        <p className="text-muted text-sm mt8">安装完成并重启后，在 WSL 终端中完成上述步骤。</p>
      </div>
    </>
  );
}
