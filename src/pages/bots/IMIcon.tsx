/**
 * 官方品牌图标
 * - 有 simple-icons 收录的：Discord / QQ / Telegram / WhatsApp / WeChat(WeCom)
 * - 未收录的：Slack（官方 hashmark）/ 飞书（IconPark 官方）/ 钉钉（内嵌路径）
 */
import {
  siDiscord, siQq, siTelegram, siWhatsapp, siWechat,
} from 'simple-icons';

// ── Slack hashmark（官方 2019+ 版本，viewBox 0 0 24 24）──────────────────────
const SLACK_PATH =
  'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165' +
  'a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521' +
  '-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528' +
  ' 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52' +
  'A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271' +
  'a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528' +
  ' 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.123 2.521a2.528 2.528 0' +
  ' 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522' +
  'V8.834zm-1.271 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522' +
  'A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.123a2.528' +
  ' 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522' +
  'v-2.522h2.52zm0-1.271a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52' +
  'h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z';

// ── 钉钉 Logo（简化版，viewBox 0 0 24 24）────────────────────────────────────
const DINGTALK_PATH =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z' +
  'M10 7h4a3 3 0 0 1 0 6h-1v2l-3-2.5V13h-1a3 3 0 0 1 0-6zm1 2v2h3a1 1 0 0 0 0-2h-3z';

// ── 飞书 Logo（ByteDance IconPark 官方，viewBox 0 0 48 48，两翼交叉箭头）────
const FEISHU_PATHS = [
  'M41.0716 5.99409L3.31071 16.5187L12.3856 25.8126L20.7998 25.9594L30.4827 16.5187C30.2266 15.9943 30.0985 15.5552 30.0985 15.2013C30.0985 14.4074 30.4104 13.7786 30.8947 13.333C31.7241 12.57 32.7222 12.4558 33.8889 12.9905L41.0716 5.99409Z',
  'M42.1021 6.72842L31.5775 44.4893L22.2836 35.4144L22.1367 27.0002L31.5115 17.4816C32.0195 17.8454 32.5743 18.0105 33.1759 17.9769C34.0784 17.9264 34.6614 17.3813 34.9349 17.0602C35.2083 16.7392 35.5293 16.2051 35.5025 15.4113C35.4847 14.8821 35.3109 14.3941 34.9812 13.9472L42.1021 6.72842Z',
];

interface IconDef {
  paths: string[];
  viewBox: string;
  hex: string;
}

const ICONS: Record<string, IconDef> = {
  feishu:   { paths: FEISHU_PATHS,          viewBox: '0 0 48 48', hex: '3370FF' },
  dingtalk: { paths: [DINGTALK_PATH],       viewBox: '0 0 24 24', hex: '1E7CE0' },
  qq:       { paths: [siQq.path],           viewBox: '0 0 24 24', hex: siQq.hex },
  wecom:    { paths: [siWechat.path],       viewBox: '0 0 24 24', hex: '07C160' },
  telegram: { paths: [siTelegram.path],     viewBox: '0 0 24 24', hex: siTelegram.hex },
  discord:  { paths: [siDiscord.path],      viewBox: '0 0 24 24', hex: siDiscord.hex },
  slack:    { paths: [SLACK_PATH],          viewBox: '0 0 24 24', hex: '4A154B' },
  whatsapp: { paths: [siWhatsapp.path],     viewBox: '0 0 24 24', hex: siWhatsapp.hex },
};

export default function IMIcon({ id, size = 20 }: { id: string; size?: number }) {
  const icon = ICONS[id];

  if (!icon) {
    return (
      <span style={{
        width: size, height: size, borderRadius: size * 0.22,
        background: '#555', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.5, fontWeight: 700, color: '#fff',
        flexShrink: 0,
      }}>
        {id[0].toUpperCase()}
      </span>
    );
  }

  return (
    <svg
      width={size} height={size}
      viewBox={icon.viewBox}
      fill={`#${icon.hex}`}
      fillRule="evenodd"
      clipRule="evenodd"
      style={{ flexShrink: 0 }}
      aria-label={id}
    >
      {icon.paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
