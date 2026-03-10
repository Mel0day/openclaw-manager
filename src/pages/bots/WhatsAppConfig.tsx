import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StepCard, IMConfigProps } from './shared';

type LoginState = 'idle' | 'loading' | 'qr_ready' | 'connected' | 'error';

export default function WhatsAppConfig({ showToast, onConfigured }: IMConfigProps) {
  const [loginState, setLoginState] = useState<LoginState>('idle');
  const [qrData,     setQrData]     = useState('');   // base64 PNG or data-url
  const [linkedPhone, setLinkedPhone] = useState('');
  const connectedRef = useRef(false);

  useEffect(() => {
    invoke<{ linked_phone: string }>('load_whatsapp_config').then(cfg => {
      if (cfg.linked_phone) {
        setLinkedPhone(cfg.linked_phone);
        connectedRef.current = true;
        setLoginState('connected');
        onConfigured?.();
      }
    }).catch(() => {});
  }, []);

  const startLogin = async () => {
    connectedRef.current = false;
    setLoginState('loading');
    setQrData('');
    try {
      // 后端启动 whatsapp-web.js session，返回 base64 二维码
      const qr = await invoke<string>('start_whatsapp_login');
      setQrData(qr);
      setLoginState('qr_ready');
      // 轮询登录状态
      pollLoginStatus();
    } catch (e: any) {
      setLoginState('error');
      showToast(`启动失败: ${e}`, 'error');
    }
  };

  const pollLoginStatus = () => {
    const interval = setInterval(async () => {
      try {
        const status = await invoke<{ connected: boolean; phone: string }>('check_whatsapp_status');
        if (status.connected) {
          clearInterval(interval);
          connectedRef.current = true;
          setLinkedPhone(status.phone);
          setLoginState('connected');
          onConfigured?.();
          showToast('WhatsApp 已成功登录！', 'success');
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);
    // 3 分钟超时
    setTimeout(() => {
      clearInterval(interval);
      if (!connectedRef.current) {
        setLoginState('idle');
        showToast('扫码超时，请重新尝试', 'error');
      }
    }, 180_000);
  };

  const logout = async () => {
    try {
      await invoke('logout_whatsapp');
      setLoginState('idle');
      setLinkedPhone('');
      setQrData('');
      showToast('已退出 WhatsApp 登录', 'info');
    } catch (e: any) {
      showToast(`退出失败: ${e}`, 'error');
    }
  };

  const isConnected = loginState === 'connected';

  return (
    <>
      <div className="card" style={{ borderColor: 'rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.05)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.9 }}>
          WhatsApp 是原生内置 Channel，使用<strong style={{ color: 'var(--accent)' }}>WhatsApp Web 协议</strong>接入，
          无需申请 API Key，扫码登录你的个人账号即可。<br />
          <span style={{ color: 'var(--yellow)' }}>⚠ 请使用专用账号，不建议使用主要个人号。</span>
        </div>
      </div>

      <div className="steps">
        <StepCard num={1} title="扫码登录 WhatsApp"
          desc="点击下方按钮生成二维码，用手机 WhatsApp 扫描完成登录。"
          done={isConnected} active={!isConnected}
        >
          <div style={{ marginTop: 12 }}>
            {/* 未登录 / 空闲状态 */}
            {(loginState === 'idle' || loginState === 'error') && (
              <button className="btn btn-primary btn-sm" onClick={startLogin}>
                生成登录二维码
              </button>
            )}

            {/* 生成中 */}
            {loginState === 'loading' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted2)' }}>
                <span className="spin">↻</span> 正在生成二维码...
              </div>
            )}

            {/* 二维码就绪 */}
            {loginState === 'qr_ready' && qrData && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 10, display: 'inline-block', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                  <img src={qrData.startsWith('data:') ? qrData : `data:image/png;base64,${qrData}`}
                    alt="WhatsApp QR Code" style={{ width: 200, height: 200, display: 'block' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.7 }}>
                  <div>① 打开手机 WhatsApp → 右上角 ⋮ →「已关联的设备」</div>
                  <div>② 点「关联设备」→ 扫描上方二维码</div>
                  <div>③ 扫码成功后页面自动跳转</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  <span className="spin">↻</span> 等待扫码...（二维码 3 分钟内有效）
                </div>
                <button className="btn btn-ghost btn-sm" onClick={startLogin}>刷新二维码</button>
              </div>
            )}

            {/* 已登录 */}
            {isConnected && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-green"><span className="dot dot-pulse"></span>已登录</span>
                  {linkedPhone && (
                    <code style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--teal)' }}>{linkedPhone}</code>
                  )}
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', width: 'fit-content' }} onClick={logout}>
                  退出登录
                </button>
              </div>
            )}
          </div>
        </StepCard>

        <StepCard num={2} active={isConnected}
          title="测试 WhatsApp 机器人"
          desc="登录完成后，用另一个账号向已登录的 WhatsApp 号发消息即可测试。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
            <div>· 用任意手机向已登录账号发送一条消息</div>
            <div>· OpenClaw 应当自动回复</div>
            <div>· 若无响应，检查「服务面板」Gateway 是否运行</div>
          </div>
        </StepCard>

        {isConnected && (
          <div className="step done">
            <div className="step-num">✓</div>
            <div className="step-body">
              <div className="step-title">配置完成！</div>
              <div className="step-desc">WhatsApp 已登录，Gateway 运行后任何发给该号的消息都会被处理。</div>
              <span className="badge badge-green" style={{ marginTop: 6 }}><span className="dot dot-pulse"></span>WhatsApp Channel 已激活</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
