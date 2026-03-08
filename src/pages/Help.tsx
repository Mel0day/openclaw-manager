import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ShowToast } from '../App';

// ── Quick Fix Card ────────────────────────────────────────────────────────────

type FixState = 'idle' | 'loading' | 'done' | 'error';

function QuickFix({
  title, desc, buttonLabel, onFix, result,
}: {
  title: string; desc: string; buttonLabel: string;
  onFix: () => Promise<string>; result?: string;
}) {
  const [state, setState] = useState<FixState>('idle');
  const [msg, setMsg] = useState('');

  const run = async () => {
    setState('loading');
    try {
      const r = await onFix();
      setMsg(r);
      setState('done');
    } catch (e: any) {
      setMsg(String(e));
      setState('error');
    }
  };

  return (
    <div style={{
      background: 'var(--card2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '14px 16px',
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 10 }}>{desc}</div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${state === 'done' ? 'btn-success' : state === 'error' ? 'btn-danger' : 'btn-primary'}`}
          onClick={run}
          disabled={state === 'loading' || state === 'done'}
        >
          {state === 'loading' ? <><span className="spin">↻</span> 修复中...</>
            : state === 'done' ? '✓ 已修复'
            : state === 'error' ? '✗ 失败，重试'
            : buttonLabel}
        </button>
        {msg && (
          <span style={{ fontSize: 12, color: state === 'error' ? 'var(--red)' : 'var(--muted2)' }}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: '安装 OpenClaw 时提示 npm 404 / Not Found',
    a: '早期版本文档中的包名有误。正确的包名是 openclaw，不是 @openclaw/cli。\n\n正确命令：npm install -g openclaw@latest',
  },
  {
    q: '安装时提示 EACCES permission denied（权限不足）',
    a: '原因是 /usr/local/lib/node_modules 归 root 所有，普通用户无写权限。\n\n解决方案：使用 --prefix 参数安装到用户目录，无需 sudo：\nnpm install -g openclaw@latest --prefix ~/.npm-global\n\nManager 的一键安装已自动使用此方式。',
  },
  {
    q: '安装成功后在 Terminal 输入 openclaw 提示找不到命令',
    a: '安装路径 ~/.npm-global/bin 不在 shell 的 PATH 中。\n\n解决方案：在 ~/.zshrc 中加入以下一行（或使用上方「一键修复」按钮）：\nexport PATH="$HOME/.npm-global/bin:$PATH"\n\n添加后重新打开 Terminal 或执行 source ~/.zshrc 即可。',
  },
  {
    q: 'openclaw dashboard / gateway 等子命令无法 Tab 补全',
    a: 'OpenClaw 的 shell 补全脚本未安装。使用上方「安装命令补全」按钮一键安装，安装后重新打开 Terminal 生效。\n\n手动安装：\nopenclaw completion --write-state\nopenclaw completion --install --shell zsh --yes',
  },
  {
    q: '打开服务面板后应用卡死无响应',
    a: '旧版 Manager 使用 openclaw 子进程检测 Gateway 状态，进程启动慢会阻塞 UI 线程。\n\n当前版本已改为 TCP 端口探测（300ms 超时），不再有阻塞问题。如仍遇到卡顿，请重启 Manager。',
  },
  {
    q: 'openclaw gateway install 提示 unknown option --repair',
    a: '--repair 不是 gateway install 的有效参数。\n\n正确命令：openclaw gateway install --force\n（--force 表示强制覆盖已有配置）\n\nManager 已修正此问题。',
  },
  {
    q: '打开 http://127.0.0.1:18789 显示无法连接',
    a: 'Gateway 服务未运行。请按顺序执行：\n\n1. openclaw config set gateway.mode local\n2. openclaw gateway install --force\n3. openclaw gateway start\n\n或在安装向导中完成第 3、4 步，再到服务面板点击「启动」。',
  },
  {
    q: 'Gateway 启动后飞书机器人没有响应',
    a: '请检查：① 是否完成了飞书配置页面的全部 5 个步骤；② 飞书应用是否配置了「长链接」事件订阅（非 Webhook）；③ 飞书应用是否已发布版本；④ 是否完成了机器人配对授权（第 5 步配对码）。',
  },
  {
    q: '如何更新 OpenClaw 到最新版',
    a: '在安装向导页面点击「一键安装 OpenClaw」，或在 Terminal 运行：\nnpm install -g openclaw@latest --prefix ~/.npm-global',
  },
  {
    q: '如何配置 AI 模型 API Key',
    a: '在安装向导第 5 步填写，或在 Terminal 运行：\nopenclaw config set credentials.openai.apiKey sk-xxxx\n\n支持 OpenAI、Gemini、Mistral、Voyage 等提供商。',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item">
      <div className="faq-q" onClick={() => setOpen(o => !o)}>
        {q}
        <span className={`faq-chevron ${open ? 'open' : ''}`}>▼</span>
      </div>
      {open && (
        <div className="faq-a" style={{ whiteSpace: 'pre-wrap' }}>{a}</div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Help({ showToast }: { showToast: ShowToast }) {
  return (
    <>
      {/* Quick Fixes */}
      <div className="card">
        <div className="card-title">一键修复</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <QuickFix
            title="修复 Terminal 找不到 openclaw 命令"
            desc="将 ~/.npm-global/bin 加入 ~/.zshrc 的 PATH，重新打开 Terminal 后生效。"
            buttonLabel="修复 PATH"
            onFix={() => invoke<string>('fix_npm_path')}
          />
          <QuickFix
            title="安装命令补全（Tab 键自动补全子命令）"
            desc="安装 zsh 补全脚本，之后输入 openclaw + Tab 即可提示所有子命令。重新打开 Terminal 后生效。"
            buttonLabel="安装补全"
            onFix={() => invoke<string>('install_shell_completion')}
          />
          <QuickFix
            title="运行诊断并自动修复（Doctor）"
            desc="检测 Gateway 配置、权限、凭据等常见问题，并尝试自动修复。"
            buttonLabel="运行 Doctor"
            onFix={() => invoke<string>('run_openclaw_doctor')}
          />
          <QuickFix
            title="重新安装 Gateway 系统服务"
            desc="强制覆盖重装 Gateway LaunchAgent（macOS）或系统任务（Windows），解决服务无法启动的问题。"
            buttonLabel="重装服务"
            onFix={() => invoke<string>('install_gateway_service')}
          />
        </div>
      </div>

      {/* FAQ */}
      <div className="card">
        <div className="card-title">常见问题</div>
        {FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
      </div>

      {/* Links */}
      <div className="card">
        <div className="card-title">获取更多帮助</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="https://docs.openclaw.ai" target="_blank" rel="noreferrer">
            <button className="btn btn-ghost btn-sm">OpenClaw 官方文档 →</button>
          </a>
          <a href="https://github.com/openclaw" target="_blank" rel="noreferrer">
            <button className="btn btn-ghost btn-sm">GitHub Issues →</button>
          </a>
          <a href="https://open.feishu.cn/document" target="_blank" rel="noreferrer">
            <button className="btn btn-ghost btn-sm">飞书开放平台文档 →</button>
          </a>
          <a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">
            <button className="btn btn-ghost btn-sm">Node.js 下载 →</button>
          </a>
        </div>
      </div>
    </>
  );
}
