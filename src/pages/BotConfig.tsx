import { useEffect, useState } from 'react';
import { ShowToast } from '../App';
import { IM_REGISTRY } from './bots/registry';
import IMIcon from './bots/IMIcon';

export default function BotConfig({ showToast }: { showToast: ShowToast }) {
  const [selectedId, setSelectedId]     = useState(IM_REGISTRY[0].id);
  const [configured, setConfigured]     = useState<Record<string, boolean>>({});

  // 启动时并发检查每个 IM 的配置状态
  useEffect(() => {
    IM_REGISTRY.forEach(im => {
      im.checkConfigured().then(ok => {
        if (ok) setConfigured(prev => ({ ...prev, [im.id]: true }));
      });
    });
  }, []);

  const selected = IM_REGISTRY.find(im => im.id === selectedId)!;
  const ConfigComponent = selected.component;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* IM 选择器 — grid 保证同行等高 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
        gap: 10,
        padding: '0 0 20px 0',
        borderBottom: '1px solid var(--border)',
        marginBottom: 20,
      }}>
        {IM_REGISTRY.map(im => {
          const isSelected   = im.id === selectedId;
          const isConfigured = configured[im.id];
          return (
            <button
              key={im.id}
              onClick={() => setSelectedId(im.id)}
              style={{
                display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 6, padding: '12px 14px', borderRadius: 10,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                border: isSelected ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                background: isSelected ? 'rgba(74,158,255,0.08)' : 'var(--card-bg)',
                width: '100%',
              }}
            >
              {/* 顶部：图标 + 名字 + 已配置徽章 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <IMIcon id={im.id} size={20} />
                <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--accent)' : 'var(--text)', flex: 1 }}>
                  {im.name}
                </span>
                {isConfigured && (
                  <span className="badge badge-green" style={{ padding: '1px 5px', fontSize: 10, whiteSpace: 'nowrap' }}>
                    <span className="dot dot-pulse" style={{ width: 5, height: 5 }}></span>已配置
                  </span>
                )}
              </div>
              {/* 底部：描述（固定两行高度，溢出省略） */}
              <span style={{
                fontSize: 11, color: 'var(--muted2)', lineHeight: 1.5,
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {im.desc}
              </span>
            </button>
          );
        })}

      </div>

      {/* 选中 IM 的配置内容 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ConfigComponent
          showToast={showToast}
          onConfigured={() => setConfigured(prev => ({ ...prev, [selectedId]: true }))}
        />
      </div>

    </div>
  );
}
