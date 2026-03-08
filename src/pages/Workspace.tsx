import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ShowToast } from '../App';

const FILES = [
  { name: 'USER.md',       label: '用户信息',  icon: '👤', desc: '告诉 Agent 你是谁、你的偏好' },
  { name: 'SOUL.md',       label: 'Agent 灵魂', icon: '✨', desc: 'Agent 的性格、价值观与行为边界' },
  { name: 'HEARTBEAT.md',  label: '心跳任务',  icon: '💓', desc: 'Agent 定期主动检查的事项' },
  { name: 'MEMORY.md',     label: '长期记忆',  icon: '🧠', desc: 'Agent 跨会话保留的重要信息' },
  { name: 'AGENTS.md',     label: '行为约束',  icon: '🔒', desc: '定义 Agent 的红线/黄线操作规则（安全边界）' },
] as const;

type FileName = typeof FILES[number]['name'];

export default function Workspace({ showToast }: { showToast: ShowToast }) {
  const [active, setActive]     = useState<FileName>('USER.md');
  const [content, setContent]   = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = content !== original;

  async function load(name: FileName) {
    setLoading(true);
    try {
      const text = await invoke<string>('read_workspace_file', { filename: name });
      setContent(text);
      setOriginal(text);
    } catch (e: any) {
      showToast(e?.toString() ?? '读取失败', 'error');
      setContent('');
      setOriginal('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(active); }, [active]);

  async function save() {
    setSaving(true);
    try {
      await invoke('write_workspace_file', { filename: active, content });
      setOriginal(content);
      showToast('已保存', 'success');
    } catch (e: any) {
      showToast(e?.toString() ?? '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (dirty && !saving) save();
    }
    // Tab → insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = textareaRef.current!;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = content.slice(0, start) + '  ' + content.slice(end);
      setContent(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
    }
  }

  const meta = FILES.find(f => f.name === active)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>

      {/* File tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILES.map(f => (
          <button
            key={f.name}
            onClick={() => setActive(f.name)}
            className={`btn ${active === f.name ? 'btn-primary' : 'btn-ghost'}`}
            style={{ gap: 6 }}
          >
            <span>{f.icon}</span> {f.label}
            {active === f.name && dirty && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', marginLeft: 2 }} />
            )}
          </button>
        ))}
      </div>

      {/* Description + save */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 13, color: 'var(--muted2)' }}>{meta.desc}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 12, fontFamily: 'monospace' }}>
            ~/.openclaw/workspace/{meta.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dirty && <span style={{ fontSize: 12, color: 'var(--yellow)' }}>未保存</span>}
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? '保存中…' : '保存'}
            <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2 }}>⌘S</span>
          </button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
            <span className="spin" style={{ marginRight: 8 }}>↻</span> 读取中…
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--card)',
              border: `1px solid ${dirty ? 'var(--yellow)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', monospace",
              fontSize: 13,
              lineHeight: 1.65,
              padding: '16px 20px',
              resize: 'none',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
          />
        )}
      </div>
    </div>
  );
}
