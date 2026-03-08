# OpenClaw Manager

> 一键安装、配置和管理 [OpenClaw](https://openclaw.ai) 的桌面客户端，支持飞书、钉钉等 IM 平台接入。

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.x-orange)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 功能

### 安装向导
- 自动检测 Node.js / npm 环境
- 一键安装 OpenClaw CLI（使用 npmmirror 加速）
- 自动初始化配置并安装 Gateway 系统服务
- 支持配置 18 种 AI 模型提供商的 API Key：
  - 国际：OpenAI、Anthropic、OpenRouter、Mistral、xAI、Together、Venice、HuggingFace
  - 国内：火山引擎、Google（Gemini）、Moonshot、MiniMax、百度千帆、智谱 AI、小米
  - 本地：Ollama、vLLM、LiteLLM

### 飞书配置
- 支持飞书（国内）/ Lark（国际）两种版本
- 长链接（WebSocket）接入，无需公网 IP 或 Webhook
- 一键安装飞书 Python SDK（lark-oapi）
- 自动检测并修复 Gateway 代理冲突（仅在检测到代理时显示）
- 生成并运行长链接测试脚本，用于飞书开发者后台验证
- 免配对白名单管理（allowFrom），避免重启后反复配对

### 钉钉配置
- 一键安装钉钉社区插件
- Stream 模式（WebSocket 长链接）接入，无需公网 IP
- 支持独立配置私聊策略（dmPolicy）和群聊策略（groupPolicy）

### 服务面板
- 实时显示 Gateway 运行状态（TCP 端口探测，无卡顿）
- 一键启动 / 停止 Gateway 服务
- 打开 OpenClaw 控制台（Web UI）
- 一键运行 `openclaw doctor --fix` 诊断并自动修复

### 问题助手
- 一键修复常见问题（PATH 配置、Shell 补全、服务重装）
- 10 项常见问题 FAQ

---

## 下载

前往 [Releases](https://github.com/Mel0day/openclaw-manager/releases) 页面下载对应平台安装包：

| 平台 | 文件 |
|------|------|
| macOS Apple Silicon（M 系列） | `openclaw-manager_x.x.x_aarch64.dmg` |
| macOS Intel | `openclaw-manager_x.x.x_x64.dmg` |
| Windows | `openclaw-manager_x.x.x_x64-setup.exe` |

> **macOS 首次打开提示「无法验证开发者」**：前往「系统设置 → 隐私与安全性」，点击「仍要打开」即可。

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

更新 `src-tauri/tauri.conf.json` 和 `src-tauri/Cargo.toml` 中的版本号，然后推送 tag：

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions 会自动构建 macOS（Apple Silicon + Intel）和 Windows 三个安装包，并创建 Draft Release。

---

## 技术栈

- **前端**：React 19 + TypeScript + Vite
- **后端**：Rust + Tauri 2
- **打包**：GitHub Actions + tauri-action（矩阵构建）

---

## License

MIT
