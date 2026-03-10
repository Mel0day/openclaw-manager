# OpenClaw Manager

> 一键安装、配置和管理 [OpenClaw](https://openclaw.ai) 的桌面客户端，支持飞书、钉钉、QQ、企业微信、Telegram、Discord、Slack、WhatsApp 等 8 个 IM 平台接入。

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![Version](https://img.shields.io/badge/version-0.1.4-brightgreen)
![Tauri](https://img.shields.io/badge/Tauri-2.x-orange)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 界面预览

| 机器人配置 | 安装向导 | 服务面板 |
|:---:|:---:|:---:|
| ![机器人配置](docs/screenshots/bots.png) | ![安装向导](docs/screenshots/setup.png) | ![服务面板](docs/screenshots/dashboard.png) |

---

## 功能

### 🤖 机器人配置 *(v0.1.3 全新重构)*

统一的 IM 接入中心，当前支持 **8 个平台**，架构完全可扩展：

| 平台 | 接入方式 |
|------|---------|
| 飞书 / Lark | WebSocket 长链接，无需公网 IP |
| 钉钉 | Stream 模式，无需公网 IP |
| QQ | WebSocket，支持 QQ 频道与私聊 |
| 企业微信 | Webhook 回调 + 内网穿透 |
| Telegram | 长轮询，只需 Bot Token，配置最简单 |
| Discord | Gateway WebSocket，无需公网 IP |
| Slack | Socket Mode，App Token + Bot Token |
| WhatsApp | WhatsApp Web 协议，扫码登录，无需 API Key |

- 每个平台均有详细的分步配置引导，配置完成后自动显示绿色「已配置」徽章
- 品牌图标使用 [simple-icons](https://simpleicons.org/) + [ByteDance IconPark](https://iconpark.oceanengine.com/) 官方 SVG 路径
- 开发者扩展：在 `src/pages/bots/registry.ts` 追加一项即可接入新 IM，无需改动其他文件

### 🚀 安装向导
- 自动检测 Node.js / npm 环境
- 一键安装 OpenClaw CLI（使用 npmmirror 加速）
- 自动初始化配置并安装 Gateway 系统服务
- 支持配置 18 种 AI 模型提供商的 API Key：
  - 国际：OpenAI、Anthropic、OpenRouter、Mistral、xAI、Together、Venice、HuggingFace
  - 国内：火山引擎、Google（Gemini）、Moonshot、MiniMax、百度千帆、智谱 AI、小米
  - 本地：Ollama、vLLM、LiteLLM
- 已配置的 AI 提供商重启后持久显示，不再丢失状态

### 📊 服务面板
- 实时显示 Gateway 运行状态（TCP 端口探测，无卡顿）
- 一键启动 / 停止 / 重启 Gateway 服务
- **OpenClaw CLI 版本信息**：显示已安装版本与 npm 最新版本对比，有新版本自动提示并支持一键更新
- 打开 OpenClaw 控制台（Web UI）
- 一键运行 `openclaw doctor --fix` 诊断并自动修复

### 📝 Workspace
- 编辑 Agent 核心配置文件：用户信息（USER.md）、Agent 灵魂（SOUL.md）、心跳任务（HEARTBEAT.md）、长期记忆（MEMORY.md）
- **行为约束（AGENTS.md）**：定义 AI Agent 的操作红线与黄线规则，与安全管理页联动

### 🎮 玩法推荐
覆盖 OpenClaw 最常见的 6 个真实业务场景，每个场景含具体操作步骤与最佳实践：

- **小红书自动运营**：自动发帖、评论回复、私信引流
- **微信群智能问答 Bot**：@Bot 问答、关键词触发、新成员欢迎
- **电商售前客服自动化**：商品问答、物流查询、超时转人工
- **数据监控自动播报**：每日数据日报、异常告警、竞品监控
- **AI 内容创作流水线**：批量生成文案、多平台改写
- **私域用户分层运营**：新客引导、沉睡唤醒、VIP 专属服务

### 🔒 安全管理
参考 [SlowMist OpenClaw Security Practice Guide v2.7](https://github.com/slowmist/openclaw-security-practice-guide) 实现：

**权限边界总览**
- 实时展示当前接入的渠道及消息策略
- 已配置的 AI 提供商一览
- 已安装的 Skills / MCP 插件列表

**安全防护状态检测（5 项，带一键修复）**
- 配置文件权限收窄（chmod 600）
- SHA256 完整性基线：生成基线 + **实时验证**，哈希不匹配立即报红
- 每晚自动安全审计 Cron（凌晨 2 点，覆盖 SlowMist 推荐的 13 项指标），支持内联查看审计日志
- 红线 / 黄线规则文档（AGENTS.md）
- Git 灾难恢复备份：初始化本地仓库 + 填写远程地址一键推送

**红线规则速查 + 一键导入 AGENTS.md**
- 7 类红线操作速查表（破坏性操作、凭据篡改、数据外泄等）
- 一键将完整规则模板写入 `~/.openclaw/workspace/AGENTS.md`

### ❓ 问题助手
- 一键修复常见问题（PATH 配置、Shell 补全、服务重装、Doctor 诊断）
- 10 项常见问题 FAQ

---

## 下载

前往 [Releases](https://github.com/Mel0day/openclaw-manager/releases) 页面下载对应平台安装包：

| 平台 | 文件 |
|------|------|
| macOS Apple Silicon（M 系列） | `openclaw-manager_x.x.x_aarch64.dmg` |
| macOS Intel | `openclaw-manager_x.x.x_x64.dmg` |
| Windows | `openclaw-manager_x.x.x_x64-setup.exe` |

> **macOS 提示「已损坏，无法打开」**：由于 App 暂未签名，macOS 会隔离从网络下载的文件。在终端执行以下命令解除隔离后重新安装即可：
> ```bash
> # 方法一：对 DMG 文件直接解除（推荐）
> xattr -d com.apple.quarantine ~/Downloads/openclaw-manager_*.dmg
> ```
> ```bash
> # 方法二：已拖入 Applications 后执行
> sudo xattr -cr /Applications/openclaw-manager.app
> ```

---

## 本地开发

**依赖环境**

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) stable
- [Tauri CLI](https://tauri.app/start/prerequisites/)

```bash
# 克隆仓库
git clone https://github.com/Mel0day/openclaw-manager.git
cd openclaw-manager

# 安装前端依赖
npm install

# 启动开发模式
npm run tauri dev

# 构建生产包
npm run tauri build
```

---

## 发布新版本

更新 `src-tauri/tauri.conf.json` 中的版本号，然后推送 tag：

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions 会自动构建 macOS（Apple Silicon + Intel）和 Windows 三个安装包，并创建 Draft Release。每个 macOS DMG 内置 `install.command` 脚本，用户无需手动解除 Gatekeeper 限制。

---

## 扩展新 IM 平台

在 `src/pages/bots/registry.ts` 追加一项即可，无需改动其他任何文件：

```typescript
{
  id:   'myim',
  name: '我的IM',
  desc: '一句话介绍接入方式',
  checkConfigured: async () => {
    try {
      const c = await invoke<{ token: string }>('load_myim_config');
      return !!c.token;
    } catch { return false; }
  },
  component: MyIMConfig,
},
```

---

## 技术栈

- **前端**：React 19 + TypeScript + Vite
- **后端**：Rust + Tauri 2
- **图标**：[simple-icons](https://simpleicons.org/) + [ByteDance IconPark](https://iconpark.oceanengine.com/)
- **打包**：GitHub Actions + tauri-action（矩阵构建）
- **安全参考**：[SlowMist OpenClaw Security Practice Guide](https://github.com/slowmist/openclaw-security-practice-guide)

---

## License

MIT
