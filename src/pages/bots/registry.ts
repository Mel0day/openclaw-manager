import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { IMConfigProps } from './shared';

export interface IMAdapter {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 加载配置并判断是否已配置 */
  checkConfigured: () => Promise<boolean>;
  /** 动态加载配置组件，避免全量 import */
  component: React.ComponentType<IMConfigProps>;
}

// ─── 按需 import 各 IM 组件 ─────────────────────────────────────────────────
import FeishuConfig   from './FeishuConfig';
import DingtalkConfig from './DingtalkConfig';
import QQConfig       from './QQConfig';
import WeComConfig     from './WeComConfig';
import TelegramConfig  from './TelegramConfig';
import DiscordConfig   from './DiscordConfig';
import SlackConfig     from './SlackConfig';
import WhatsAppConfig  from './WhatsAppConfig';

// ─── 注册表：新增 IM 只需在此追加一项 ──────────────────────────────────────
export const IM_REGISTRY: IMAdapter[] = [
  {
    id:   'feishu',
    name: '飞书',
    icon: '📨',
    desc: 'WebSocket 长链接，支持飞书 / Lark 国际版',
    checkConfigured: async () => {
      try {
        const c = await invoke<{ app_id: string }>('load_feishu_config');
        return !!c.app_id;
      } catch { return false; }
    },
    component: FeishuConfig,
  },
  {
    id:   'dingtalk',
    name: '钉钉',
    icon: '🔔',
    desc: 'Stream 模式，无需公网 IP 或 Webhook',
    checkConfigured: async () => {
      try {
        const c = await invoke<{ client_id: string }>('load_dingtalk_config');
        return !!c.client_id;
      } catch { return false; }
    },
    component: DingtalkConfig,
  },
  {
    id:   'qq',
    name: 'QQ',
    icon: '🐧',
    desc: 'WebSocket 接入，支持 QQ 频道与私聊',
    checkConfigured: async () => {
      try {
        const c = await invoke<{ app_id: string }>('load_qq_config');
        return !!c.app_id;
      } catch { return false; }
    },
    component: QQConfig,
  },

  {
    id:   'wecom',
    name: '企业微信',
    icon: '💼',
    desc: 'Webhook 回调 + 内网穿透，支持企业内部应用',
    checkConfigured: async () => {
      try {
        const c = await invoke<{ corp_id: string }>('load_wecom_config');
        return !!c.corp_id;
      } catch { return false; }
    },
    component: WeComConfig,
  },

  {
    id:   'telegram',
    name: 'Telegram',
    icon: '✈️',
    desc: '长轮询接收，只需 Bot Token，配置最简单',
    checkConfigured: async () => {
      try { const c = await invoke<{ token: string }>('load_telegram_config'); return !!c.token; }
      catch { return false; }
    },
    component: TelegramConfig,
  },
  {
    id:   'discord',
    name: 'Discord',
    icon: '🎮',
    desc: 'Gateway WebSocket，无需公网 IP',
    checkConfigured: async () => {
      try { const c = await invoke<{ token: string }>('load_discord_config'); return !!c.token; }
      catch { return false; }
    },
    component: DiscordConfig,
  },
  {
    id:   'slack',
    name: 'Slack',
    icon: '💬',
    desc: 'Socket Mode，需要 App Token + Bot Token',
    checkConfigured: async () => {
      try { const c = await invoke<{ app_token: string }>('load_slack_config'); return !!c.app_token; }
      catch { return false; }
    },
    component: SlackConfig,
  },
  {
    id:   'whatsapp',
    name: 'WhatsApp',
    icon: '📱',
    desc: 'WhatsApp Web 协议，扫码登录，无需 API Key',
    checkConfigured: async () => {
      try { const c = await invoke<{ linked_phone: string }>('load_whatsapp_config'); return !!c.linked_phone; }
      catch { return false; }
    },
    component: WhatsAppConfig,
  },

  // ── 后续 IM 在这里追加，例如：
  // {
  //   id:   'telegram',
  //   name: 'Telegram',
  //   icon: '✈️',
  //   desc: 'Bot API，Webhook 或长轮询',
  //   checkConfigured: async () => { ... },
  //   component: TelegramConfig,
  // },
];
