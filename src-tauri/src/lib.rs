use std::process::Command;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use ed25519_dalek::{VerifyingKey, Verifier, Signature};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

// 公钥 — 仅用于验证，无法伪造 token
const PUBLIC_KEY_BYTES: [u8; 32] = [
    0xf2, 0xd6, 0xaa, 0x0c, 0xde, 0xa4, 0x86, 0xbf,
    0xe6, 0xa7, 0xa4, 0x8f, 0x1f, 0x8f, 0x32, 0x31,
    0x9f, 0xbf, 0x51, 0xe4, 0x87, 0x10, 0x0f, 0x02,
    0x74, 0x0e, 0xc2, 0x34, 0xd1, 0x94, 0x0e, 0x81,
];

// ── State ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct FeishuConfig {
    pub app_id: String,
    pub app_secret: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ActivationState {
    pub token: String,
    pub expires_at: u64,
}

#[derive(Serialize)]
pub struct ActivationInfo {
    pub active: bool,
    pub expires_at: u64,
    pub remaining_secs: u64,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DingtalkConfig {
    pub client_id: String,
    pub client_secret: String,
    pub corp_id: String,
    pub agent_id: String,
}

#[derive(Serialize)]
pub struct EnvStatus {
    pub node: Option<String>,
    pub npm: Option<String>,
    pub openclaw: Option<String>,
}

#[derive(Serialize)]
pub struct GatewayStatus {
    pub running: bool,
    pub installed: bool,
    pub url: String,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn augmented_path() -> String {
    let home = dirs::home_dir().unwrap_or_default();
    let extra = format!(
        "/usr/local/bin:/usr/bin:/opt/homebrew/bin:{}/.npm-global/bin:{}/.cargo/bin",
        home.display(), home.display()
    );
    match std::env::var("PATH") {
        Ok(p) => format!("{extra}:{p}"),
        Err(_) => extra,
    }
}

fn run_cmd(cmd: &str, args: &[&str]) -> Option<String> {
    Command::new(cmd)
        .args(args)
        .env("PATH", augmented_path())
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn run_openclaw(args: &[&str]) -> Result<String, String> {
    let out = Command::new("openclaw")
        .args(args)
        .env("PATH", augmented_path())
        .output()
        .map_err(|e| format!("找不到 openclaw 命令，请先完成安装步骤: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if out.status.success() {
        Ok(stdout)
    } else {
        // Some openclaw commands write useful info to stderr even on success exit
        if !stderr.trim().is_empty() {
            Err(stderr)
        } else {
            Err(stdout)
        }
    }
}

fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openclaw-manager")
        .join("feishu.json")
}

fn activation_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openclaw-manager")
        .join("activation.json")
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn dingtalk_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openclaw-manager")
        .join("dingtalk.json")
}

// ── Environment ───────────────────────────────────────────────────────────────

#[tauri::command]
fn check_env() -> EnvStatus {
    EnvStatus {
        node:     run_cmd("node",     &["-v"]),
        npm:      run_cmd("npm",      &["-v"]),
        openclaw: run_cmd("openclaw", &["--version"]),
    }
}

// ── Install ───────────────────────────────────────────────────────────────────

#[tauri::command]
async fn install_openclaw() -> Result<String, String> {
    let home = dirs::home_dir().unwrap_or_default();
    let npm_global = home.join(".npm-global");
    let out = Command::new("npm")
        .args(["install", "-g", "openclaw@latest",
               "--prefix", npm_global.to_str().unwrap_or("~/.npm-global"),
               "--registry", "https://registry.npmmirror.com"])
        .env("PATH", augmented_path())
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

// ── OpenClaw Init ─────────────────────────────────────────────────────────────

/// Set gateway.mode = local so openclaw knows to run locally (non-interactive)
#[tauri::command]
async fn init_openclaw_config() -> Result<String, String> {
    run_openclaw(&["config", "set", "gateway.mode", "local"])?;
    Ok("Gateway 模式已设为 local".into())
}

/// Install gateway as a system service (LaunchAgent on macOS, Task on Windows)
#[tauri::command]
async fn install_gateway_service() -> Result<String, String> {
    // --repair ensures any stale config is cleaned up first
    let out = Command::new("openclaw")
        .args(["gateway", "install", "--force"])
        .env("PATH", augmented_path())
        .output()
        .map_err(|e| format!("找不到 openclaw: {e}"))?;
    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    // gateway install may exit non-zero even on partial success; check output
    if out.status.success() || combined.to_lowercase().contains("install") {
        Ok(combined)
    } else {
        Err(combined)
    }
}

/// Set an AI model credential via `openclaw config set env.ENV_VAR value`
/// For local providers (Ollama/vLLM), sets the base URL config instead.
#[tauri::command]
async fn set_model_api_key(provider: String, key: String) -> Result<(), String> {
    // Map provider id -> openclaw config path
    let config_key: String = match provider.as_str() {
        // International
        "openai"      => "env.OPENAI_API_KEY".into(),
        "anthropic"   => "env.ANTHROPIC_API_KEY".into(),
        "openrouter"  => "env.OPENROUTER_API_KEY".into(),
        "mistral"     => "env.MISTRAL_API_KEY".into(),
        "xai"         => "env.XAI_API_KEY".into(),
        "together"    => "env.TOGETHER_API_KEY".into(),
        "venice"      => "env.VENICE_API_KEY".into(),
        "huggingface" => "env.HUGGINGFACE_HUB_TOKEN".into(),
        "litellm"     => "env.LITELLM_API_KEY".into(),
        // China providers
        "volcengine"  => "env.VOLCANO_ENGINE_API_KEY".into(),
        "byteplus"    => "env.BYTEPLUS_API_KEY".into(),
        "google"      => "env.GEMINI_API_KEY".into(),
        "moonshot"    => "env.MOONSHOT_API_KEY".into(),
        "minimax"     => "env.MINIMAX_API_KEY".into(),
        "qianfan"     => "env.QIANFAN_API_KEY".into(),
        "zai"         => "env.ZAI_API_KEY".into(),
        "xiaomi"      => "env.XIAOMI_API_KEY".into(),
        // Local / self-hosted (value = base URL)
        "ollama"      => "models.providers.ollama.baseUrl".into(),
        "vllm"        => "models.providers.vllm.baseUrl".into(),
        other         => return Err(format!("未知 provider: {other}")),
    };
    run_openclaw(&["config", "set", &config_key, &key])?;
    Ok(())
}

// ── Gateway Service ───────────────────────────────────────────────────────────

#[tauri::command]
async fn start_gateway_service() -> Result<String, String> {
    run_openclaw(&["gateway", "start"])
}

#[tauri::command]
async fn stop_gateway_service() -> Result<String, String> {
    run_openclaw(&["gateway", "stop"])
}

#[tauri::command]
fn get_gateway_service_status() -> GatewayStatus {
    use std::net::TcpStream;
    use std::time::Duration;

    // Fast TCP probe — no subprocess needed
    let running = TcpStream::connect_timeout(
        &"127.0.0.1:18789".parse().unwrap(),
        Duration::from_millis(300),
    ).is_ok();

    // Check for LaunchAgent plist (macOS) or service marker file (cross-platform)
    let home = dirs::home_dir().unwrap_or_default();
    let installed = home
        .join("Library/LaunchAgents/ai.openclaw.gateway.plist")
        .exists()
        || home.join(".openclaw/service.json").exists()
        || home.join(".openclaw/openclaw.json").exists();

    GatewayStatus {
        running,
        installed,
        url: "http://127.0.0.1:18789".into(),
    }
}

#[tauri::command]
async fn run_openclaw_doctor() -> Result<String, String> {
    let out = Command::new("openclaw")
        .args(["doctor", "--fix"])
        .env("PATH", augmented_path())
        .output()
        .map_err(|e| format!("找不到 openclaw: {e}"))?;
    // Strip ANSI escape codes for clean display
    let raw = String::from_utf8_lossy(&out.stdout).to_string();
    let clean = strip_ansi(&raw);
    Ok(if clean.trim().is_empty() {
        String::from_utf8_lossy(&out.stderr).to_string()
    } else {
        clean
    })
}

#[tauri::command]
async fn open_openclaw_dashboard() -> Result<(), String> {
    Command::new("openclaw")
        .args(["dashboard"])
        .env("PATH", augmented_path())
        .spawn()
        .map_err(|e| format!("找不到 openclaw: {e}"))?;
    Ok(())
}

fn strip_ansi(s: &str) -> String {
    // Very simple ANSI escape stripper for display purposes
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // skip until 'm' or end
            for ch in chars.by_ref() {
                if ch == 'm' { break; }
            }
        } else {
            out.push(c);
        }
    }
    out
}

// ── Feishu Tools ──────────────────────────────────────────────────────────────

#[tauri::command]
async fn install_feishu_sdk() -> Result<String, String> {
    // openclaw gateway 是 Node.js 进程，需要 npm 包 @larksuiteoapi/node-sdk
    let npm = which_npm();
    let out = Command::new(&npm)
        .args(["install", "-g", "@larksuiteoapi/node-sdk"])
        .env("PATH", augmented_path())
        .output()
        .map_err(|e| format!("找不到 npm: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if out.status.success() {
        Ok(stdout + &stderr)
    } else {
        Err(stderr + &stdout)
    }
}

fn which_npm() -> String {
    // 优先使用 augmented PATH 里的 npm
    let candidates = ["/opt/homebrew/bin/npm", "/usr/local/bin/npm", "npm"];
    for c in candidates {
        if std::path::Path::new(c).exists() || c == "npm" {
            return c.to_string();
        }
    }
    "npm".to_string()
}

#[tauri::command]
async fn check_feishu_sdk() -> bool {
    // 检查 @larksuiteoapi/node-sdk 是否已全局安装
    let npm = which_npm();
    Command::new(&npm)
        .args(["list", "-g", "@larksuiteoapi/node-sdk", "--depth=0"])
        .env("PATH", augmented_path())
        .output()
        .map(|o| o.status.success() && !String::from_utf8_lossy(&o.stdout).contains("(empty)"))
        .unwrap_or(false)
}

#[tauri::command]
fn check_gateway_proxy() -> bool {
    // Returns true if the LaunchAgent plist contains proxy env vars
    let home = dirs::home_dir().unwrap_or_default();
    let plist = home.join("Library/LaunchAgents/ai.openclaw.gateway.plist");
    if !plist.exists() { return false; }
    let content = std::fs::read_to_string(&plist).unwrap_or_default();
    content.contains("http_proxy") || content.contains("https_proxy") || content.contains("all_proxy")
}

#[tauri::command]
async fn fix_gateway_proxy() -> Result<String, String> {
    let home = dirs::home_dir().unwrap_or_default();
    let plist = home.join("Library/LaunchAgents/ai.openclaw.gateway.plist");

    if !plist.exists() {
        return Err("Gateway 服务未安装，请先完成安装向导第 4 步".into());
    }

    // Use Python's plistlib to update NO_PROXY (most reliable on macOS)
    let no_proxy = "localhost,127.0.0.1,open.feishu.cn,*.feishu.cn,msg-frontier.feishu.cn,larksuite.com,*.larksuite.com";
    let script = format!(r#"
import plistlib
path = '{}'
with open(path, 'rb') as f:
    d = plistlib.load(f)
d.setdefault('EnvironmentVariables', {{}})['NO_PROXY'] = '{}'
with open(path, 'wb') as f:
    plistlib.dump(d, f)
print("ok")
"#, plist.display(), no_proxy);

    let out = Command::new("python3")
        .args(["-c", &script])
        .output()
        .map_err(|e| format!("python3 执行失败: {e}"))?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }

    // Reload the LaunchAgent
    let label = "ai.openclaw.gateway";
    Command::new("launchctl")
        .args(["unload", plist.to_str().unwrap_or("")])
        .output().ok();
    let load = Command::new("launchctl")
        .args(["load", plist.to_str().unwrap_or("")])
        .output()
        .map_err(|e| format!("launchctl load 失败: {e}"))?;

    if load.status.success() {
        Ok(format!("已更新 NO_PROXY，Gateway 服务已重载 ({})", label))
    } else {
        Err(String::from_utf8_lossy(&load.stderr).to_string())
    }
}

#[tauri::command]
async fn generate_feishu_test_script(app_id: String, app_secret: String) -> Result<String, String> {
    let home = dirs::home_dir().unwrap_or_default();
    let script_path = home.join("feishu_bot_test.py");
    let content = format!(r#""""
飞书长链接测试脚本 — 由 OpenClaw Manager 生成
用途：在飞书开发者后台配置「长链接」事件订阅时，需要先运行此脚本建立连接。
配置完成后，此脚本可以停止，后续由 OpenClaw Gateway 接管。
"""
import lark_oapi as lark
from lark_oapi.api.im.v1 import *

APP_ID     = "{}"
APP_SECRET = "{}"

def on_message(data: P2ImMessageReceiveV1) -> None:
    msg = data.event.message
    sender = data.event.sender.sender_id.open_id
    content = msg.content
    print(f"[消息] {{sender}}: {{content}}")

dispatcher = (
    lark.EventDispatcherHandler.builder("", "")
    .register_p2_im_message_receive_v1(on_message)
    .build()
)

cli = lark.ws.Client(
    APP_ID, APP_SECRET,
    event_handler=dispatcher,
    log_level=lark.LogLevel.INFO,
)

if __name__ == "__main__":
    print("飞书长链接已启动，等待飞书开发者后台检测连接...")
    print("检测到连接并保存配置后，可按 Ctrl+C 停止此脚本。")
    cli.start()
"#, app_id, app_secret);

    std::fs::write(&script_path, content).map_err(|e| e.to_string())?;
    Ok(script_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn run_feishu_test_script() -> Result<String, String> {
    let home = dirs::home_dir().unwrap_or_default();
    let script_path = home.join("feishu_bot_test.py");
    if !script_path.exists() {
        return Err("请先生成测试脚本".into());
    }
    // Spawn detached so it runs in background
    Command::new("python3")
        .arg(&script_path)
        .spawn()
        .map_err(|e| format!("python3 启动失败: {e}"))?;
    Ok("测试脚本已在后台启动，飞书开发者后台现在可以检测到长链接".into())
}

// ── Feishu ────────────────────────────────────────────────────────────────────

/// Write Feishu channel config directly via openclaw config set (no plugin needed)
#[tauri::command]
async fn configure_feishu_channel(
    app_id: String,
    app_secret: String,
    domain: String,      // "feishu" or "lark"
    dm_policy: String,   // "allow" or "allowlist"
) -> Result<(), String> {
    let prefix = "channels.feishu";
    let policy = if dm_policy == "allowlist" { "allowlist" } else { "allow" };
    run_openclaw(&["config", "set", &format!("{prefix}.enabled"), "true"])?;
    run_openclaw(&["config", "set", &format!("{prefix}.accounts.default.appId"), &app_id])?;
    run_openclaw(&["config", "set", &format!("{prefix}.accounts.default.appSecret"), &app_secret])?;
    run_openclaw(&["config", "set", &format!("{prefix}.accounts.default.dmPolicy"), policy])?;
    run_openclaw(&["config", "set", &format!("{prefix}.accounts.default.streaming"), "true"])?;
    if domain == "lark" {
        run_openclaw(&["config", "set", &format!("{prefix}.domain"), "lark"])?;
    }
    Ok(())
}

#[tauri::command]
async fn set_feishu_dm_policy(policy: String) -> Result<(), String> {
    // policy: "allow" | "allowlist"
    let p = if policy == "allowlist" { "allowlist" } else { "allow" };
    run_openclaw(&["config", "set", "channels.feishu.accounts.default.dmPolicy", p])?;
    Ok(())
}

#[tauri::command]
fn get_feishu_dm_policy() -> String {
    let home = dirs::home_dir().unwrap_or_default();
    let cfg_path = home.join(".openclaw").join("openclaw.json");
    let raw = std::fs::read_to_string(cfg_path).unwrap_or_default();
    let cfg: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
    cfg.pointer("/channels/feishu/accounts/default/dmPolicy")
        .and_then(|v| v.as_str())
        .unwrap_or("allow")
        .to_string()
}

/// Add a Feishu open_id to the allowFrom list in openclaw.json directly
#[tauri::command]
fn add_feishu_allow_user(open_id: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("no home dir")?;
    let cfg_path = home.join(".openclaw").join("openclaw.json");
    let raw = std::fs::read_to_string(&cfg_path).map_err(|e| e.to_string())?;
    let mut cfg: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let allow_from = cfg
        .pointer_mut("/channels/feishu/accounts/default/allowFrom")
        .ok_or("找不到 channels.feishu.accounts.default，请先完成第一步配置")?;

    if !allow_from.is_array() {
        *allow_from = serde_json::json!([]);
    }
    let arr = allow_from.as_array_mut().unwrap();
    if arr.iter().any(|v| v.as_str() == Some(&open_id)) {
        return Ok(format!("{open_id} 已在允许列表中"));
    }
    arr.push(serde_json::json!(open_id));

    let out = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    std::fs::write(&cfg_path, out).map_err(|e| e.to_string())?;
    Ok(format!("已将 {open_id} 加入允许列表，重启 Gateway 后生效"))
}

/// Remove a Feishu open_id from the allowFrom list
#[tauri::command]
fn remove_feishu_allow_user(open_id: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("no home dir")?;
    let cfg_path = home.join(".openclaw").join("openclaw.json");
    let raw = std::fs::read_to_string(&cfg_path).map_err(|e| e.to_string())?;
    let mut cfg: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    if let Some(allow_from) = cfg.pointer_mut("/channels/feishu/accounts/default/allowFrom") {
        if let Some(arr) = allow_from.as_array_mut() {
            arr.retain(|v| v.as_str() != Some(&open_id));
        }
    }
    let out = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    std::fs::write(&cfg_path, out).map_err(|e| e.to_string())?;
    Ok(format!("已从允许列表移除 {open_id}，重启 Gateway 后生效"))
}

/// Get the current allowFrom list
#[tauri::command]
fn get_feishu_allow_list() -> Vec<String> {
    let home = dirs::home_dir().unwrap_or_default();
    let cfg_path = home.join(".openclaw").join("openclaw.json");
    let raw = std::fs::read_to_string(&cfg_path).unwrap_or_default();
    let cfg: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
    cfg.pointer("/channels/feishu/accounts/default/allowFrom")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(str::to_owned)).collect())
        .unwrap_or_default()
}

#[tauri::command]
async fn approve_feishu_pairing(code: String) -> Result<String, String> {
    run_openclaw(&["pairing", "approve", "feishu", &code, "--notify"])
}

#[tauri::command]
async fn list_feishu_pairing() -> Result<String, String> {
    run_openclaw(&["pairing", "list", "feishu"])
}

#[tauri::command]
fn save_feishu_config(app_id: String, app_secret: String) -> Result<(), String> {
    let cfg = FeishuConfig { app_id, app_secret };
    let path = config_path();
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_feishu_config() -> FeishuConfig {
    std::fs::read_to_string(config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

// ── Activation ────────────────────────────────────────────────────────────────

#[tauri::command]
fn check_activation() -> ActivationInfo {
    let path = activation_path();
    let state: ActivationState = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let now = now_secs();
    if state.token.is_empty() || now >= state.expires_at {
        return ActivationInfo { active: false, expires_at: 0, remaining_secs: 0 };
    }
    ActivationInfo {
        active: true,
        expires_at: state.expires_at,
        remaining_secs: state.expires_at - now,
    }
}

#[tauri::command]
fn activate(token: String) -> Result<ActivationInfo, String> {
    let token = token.trim();

    // Format: OCM-<payload_b64>.<sig_b64>
    let inner = token.strip_prefix("OCM-").ok_or("激活码格式无效，应以 OCM- 开头")?;
    let dot = inner.find('.').ok_or("激活码格式无效")?;
    let payload_b64 = &inner[..dot];
    let sig_b64 = &inner[dot+1..];

    // Decode payload
    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64)
        .map_err(|_| "激活码解析失败")?;
    let payload: serde_json::Value = serde_json::from_slice(&payload_bytes)
        .map_err(|_| "激活码内容无效")?;
    let exp = payload["exp"].as_u64().ok_or("激活码缺少过期时间")?;

    // Verify signature
    let sig_bytes: [u8; 64] = URL_SAFE_NO_PAD.decode(sig_b64)
        .map_err(|_| "签名解析失败")?
        .try_into()
        .map_err(|_| "签名长度无效")?;
    let verifying_key = VerifyingKey::from_bytes(&PUBLIC_KEY_BYTES)
        .map_err(|_| "公钥初始化失败")?;
    let signature = Signature::from_bytes(&sig_bytes);
    verifying_key.verify(payload_b64.as_bytes(), &signature)
        .map_err(|_| "激活码签名无效，请确认激活码正确")?;

    // Check expiry
    let now = now_secs();
    if now >= exp {
        return Err(format!("激活码已过期"));
    }

    // Save
    let state = ActivationState { token: token.to_string(), expires_at: exp };
    let path = activation_path();
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&path, serde_json::to_string_pretty(&state).unwrap())
        .map_err(|e| e.to_string())?;

    Ok(ActivationInfo {
        active: true,
        expires_at: exp,
        remaining_secs: exp - now,
    })
}

// ── DingTalk ──────────────────────────────────────────────────────────────────

#[tauri::command]
async fn install_dingtalk_plugin() -> Result<String, String> {
    run_openclaw(&[
        "plugins", "install",
        "https://github.com/soimy/openclaw-channel-dingtalk.git",
    ])
}

#[tauri::command]
async fn configure_dingtalk_channel(
    client_id: String,
    client_secret: String,
    corp_id: String,
    agent_id: String,
    dm_policy: String,
    group_policy: String,
) -> Result<(), String> {
    let p = "channels.dingtalk";
    run_openclaw(&["config", "set", &format!("{p}.enabled"), "true"])?;
    run_openclaw(&["config", "set", &format!("{p}.clientId"), &client_id])?;
    run_openclaw(&["config", "set", &format!("{p}.clientSecret"), &client_secret])?;
    run_openclaw(&["config", "set", &format!("{p}.robotCode"), &client_id])?;
    run_openclaw(&["config", "set", &format!("{p}.corpId"), &corp_id])?;
    run_openclaw(&["config", "set", &format!("{p}.agentId"), &agent_id])?;
    run_openclaw(&["config", "set", &format!("{p}.dmPolicy"), &dm_policy])?;
    run_openclaw(&["config", "set", &format!("{p}.groupPolicy"), &group_policy])?;
    run_openclaw(&["config", "set", &format!("{p}.messageType"), "markdown"])?;
    run_openclaw(&["config", "set", &format!("{p}.debug"), "false"])?;
    Ok(())
}

#[tauri::command]
fn save_dingtalk_config(
    client_id: String,
    client_secret: String,
    corp_id: String,
    agent_id: String,
) -> Result<(), String> {
    let cfg = DingtalkConfig { client_id, client_secret, corp_id, agent_id };
    let path = dingtalk_config_path();
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_dingtalk_config() -> DingtalkConfig {
    std::fs::read_to_string(dingtalk_config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

// ── QQ ────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct QqConfig {
    pub app_id: String,
    pub app_secret: String,
    pub token: String,
}

fn qq_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openclaw-manager")
        .join("qq.json")
}

#[tauri::command]
fn load_qq_config() -> QqConfig {
    std::fs::read_to_string(qq_config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_qq_config(app_id: String, app_secret: String, token: String) -> Result<(), String> {
    let cfg = QqConfig { app_id, app_secret, token };
    let path = qq_config_path();
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn configure_qq_channel(
    app_id: String,
    app_secret: String,
    token: String,
    dm_policy: String,
    group_policy: String,
) -> Result<(), String> {
    let p = "channels.qq";
    run_openclaw(&["config", "set", &format!("{p}.enabled"), "true"])?;
    run_openclaw(&["config", "set", &format!("{p}.appId"), &app_id])?;
    run_openclaw(&["config", "set", &format!("{p}.appSecret"), &app_secret])?;
    if !token.is_empty() {
        run_openclaw(&["config", "set", &format!("{p}.token"), &token])?;
    }
    run_openclaw(&["config", "set", &format!("{p}.dmPolicy"), &dm_policy])?;
    run_openclaw(&["config", "set", &format!("{p}.groupPolicy"), &group_policy])?;
    Ok(())
}

#[tauri::command]
async fn install_qq_plugin() -> Result<String, String> {
    run_openclaw(&[
        "plugins", "install",
        "https://github.com/openclaw/openclaw-channel-qq.git",
    ])
}

// ── WeCom ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct WecomConfig {
    pub corp_id: String,
    pub agent_id: String,
    pub app_secret: String,
    pub token: String,
    pub encoding_key: String,
}

fn wecom_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openclaw-manager")
        .join("wecom.json")
}

#[tauri::command]
fn load_wecom_config() -> WecomConfig {
    std::fs::read_to_string(wecom_config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_wecom_config(
    corp_id: String,
    agent_id: String,
    app_secret: String,
    token: String,
    encoding_key: String,
) -> Result<(), String> {
    let cfg = WecomConfig { corp_id, agent_id, app_secret, token, encoding_key };
    let path = wecom_config_path();
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn configure_wecom_channel(
    corp_id: String,
    agent_id: String,
    app_secret: String,
    token: String,
    encoding_key: String,
    dm_policy: String,
    group_policy: String,
) -> Result<(), String> {
    let p = "channels.wecom";
    run_openclaw(&["config", "set", &format!("{p}.enabled"), "true"])?;
    run_openclaw(&["config", "set", &format!("{p}.corpId"), &corp_id])?;
    run_openclaw(&["config", "set", &format!("{p}.agentId"), &agent_id])?;
    run_openclaw(&["config", "set", &format!("{p}.appSecret"), &app_secret])?;
    if !token.is_empty() {
        run_openclaw(&["config", "set", &format!("{p}.token"), &token])?;
    }
    if !encoding_key.is_empty() {
        run_openclaw(&["config", "set", &format!("{p}.encodingAESKey"), &encoding_key])?;
    }
    run_openclaw(&["config", "set", &format!("{p}.dmPolicy"), &dm_policy])?;
    run_openclaw(&["config", "set", &format!("{p}.groupPolicy"), &group_policy])?;
    Ok(())
}

#[tauri::command]
async fn install_wecom_plugin() -> Result<String, String> {
    run_openclaw(&[
        "plugins", "install",
        "https://github.com/openclaw/openclaw-channel-wecom.git",
    ])
}

#[tauri::command]
async fn start_wecom_tunnel() -> Result<String, String> {
    run_openclaw(&["channels", "wecom", "tunnel", "--start"])
}

// ── Telegram ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct TelegramConfig {
    pub token: String,
}

fn telegram_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openclaw-manager")
        .join("telegram.json")
}

#[tauri::command]
fn load_telegram_config() -> TelegramConfig {
    std::fs::read_to_string(telegram_config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
async fn configure_telegram_channel(token: String) -> Result<(), String> {
    let p = "channels.telegram";
    run_openclaw(&["config", "set", &format!("{p}.enabled"), "true"])?;
    run_openclaw(&["config", "set", &format!("{p}.token"), &token])?;
    let cfg = TelegramConfig { token };
    let path = telegram_config_path();
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Discord ───────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DiscordConfig {
    pub token: String,
}

fn discord_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openclaw-manager")
        .join("discord.json")
}

#[tauri::command]
fn load_discord_config() -> DiscordConfig {
    std::fs::read_to_string(discord_config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
async fn configure_discord_channel(token: String) -> Result<(), String> {
    let p = "channels.discord";
    run_openclaw(&["config", "set", &format!("{p}.enabled"), "true"])?;
    run_openclaw(&["config", "set", &format!("{p}.token"), &token])?;
    let cfg = DiscordConfig { token };
    let path = discord_config_path();
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Slack ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct SlackConfig {
    pub app_token: String,
    pub bot_token: String,
}

fn slack_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openclaw-manager")
        .join("slack.json")
}

#[tauri::command]
fn load_slack_config() -> SlackConfig {
    std::fs::read_to_string(slack_config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
async fn configure_slack_channel(app_token: String, bot_token: String) -> Result<(), String> {
    let p = "channels.slack";
    run_openclaw(&["config", "set", &format!("{p}.enabled"), "true"])?;
    run_openclaw(&["config", "set", &format!("{p}.appToken"), &app_token])?;
    run_openclaw(&["config", "set", &format!("{p}.botToken"), &bot_token])?;
    let cfg = SlackConfig { app_token, bot_token };
    let path = slack_config_path();
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct WhatsappConfig {
    pub linked_phone: String,
}

#[derive(Serialize)]
pub struct WhatsappStatus {
    pub connected: bool,
    pub phone: String,
}

fn whatsapp_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("openclaw-manager")
        .join("whatsapp.json")
}

#[tauri::command]
fn load_whatsapp_config() -> WhatsappConfig {
    std::fs::read_to_string(whatsapp_config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
async fn start_whatsapp_login() -> Result<String, String> {
    run_openclaw(&["channels", "whatsapp", "login", "--qr-base64"])
}

#[tauri::command]
async fn check_whatsapp_status() -> Result<WhatsappStatus, String> {
    let out = run_openclaw(&["channels", "whatsapp", "status", "--json"])?;
    let v: serde_json::Value = serde_json::from_str(&out)
        .unwrap_or(serde_json::json!({"connected": false, "phone": ""}));
    Ok(WhatsappStatus {
        connected: v["connected"].as_bool().unwrap_or(false),
        phone: v["phone"].as_str().unwrap_or("").to_string(),
    })
}

#[tauri::command]
async fn logout_whatsapp() -> Result<(), String> {
    run_openclaw(&["channels", "whatsapp", "logout"])?;
    let path = whatsapp_config_path();
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Quick Fixes ───────────────────────────────────────────────────────────────

/// Ensure ~/.npm-global/bin is in the user's .zshrc PATH
#[tauri::command]
async fn fix_npm_path() -> Result<String, String> {
    let home = dirs::home_dir().unwrap_or_default();
    let zshrc = home.join(".zshrc");
    let line = r#"export PATH="$HOME/.npm-global/bin:$PATH""#;

    let content = std::fs::read_to_string(&zshrc).unwrap_or_default();
    if content.contains(".npm-global/bin") {
        return Ok("PATH 中已包含 ~/.npm-global/bin，无需重复添加".into());
    }
    let append = format!("\n# OpenClaw CLI path\n{line}\n");
    std::fs::OpenOptions::new()
        .append(true)
        .open(&zshrc)
        .and_then(|mut f| { use std::io::Write; f.write_all(append.as_bytes()) })
        .map_err(|e| e.to_string())?;
    Ok("已添加到 ~/.zshrc，请重新打开 Terminal 生效".into())
}

/// Install openclaw shell completion for zsh
#[tauri::command]
async fn install_shell_completion() -> Result<String, String> {
    // Step 1: write state
    run_openclaw(&["completion", "--write-state"])?;
    // Step 2: install to shell profile
    run_openclaw(&["completion", "--install", "--shell", "zsh", "--yes"])
}

// ── Workspace Files ───────────────────────────────────────────────────────────

fn workspace_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_default().join(".openclaw").join("workspace")
}

fn allowed_workspace_file(name: &str) -> bool {
    matches!(name, "USER.md" | "SOUL.md" | "HEARTBEAT.md" | "MEMORY.md" | "AGENTS.md")
}

#[tauri::command]
fn read_workspace_file(filename: String) -> Result<String, String> {
    if !allowed_workspace_file(&filename) {
        return Err(format!("不允许读取: {filename}"));
    }
    let path = workspace_dir().join(&filename);
    std::fs::read_to_string(&path).map_err(|e| format!("读取失败: {e}"))
}

#[tauri::command]
fn write_workspace_file(filename: String, content: String) -> Result<(), String> {
    if !allowed_workspace_file(&filename) {
        return Err(format!("不允许写入: {filename}"));
    }
    let path = workspace_dir().join(&filename);
    std::fs::write(&path, content).map_err(|e| format!("写入失败: {e}"))
}

// ── Security Posture ──────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SecurityPosture {
    // File permission
    pub openclaw_json_exists:  bool,
    pub openclaw_json_perm_ok: bool,   // is chmod 600?
    pub openclaw_json_mode:    String, // e.g. "644"

    // Channels enabled
    pub feishu_enabled:    bool,
    pub feishu_dm_policy:  String,
    pub feishu_allow_list: Vec<String>,
    pub dingtalk_enabled:  bool,
    pub dingtalk_dm_policy: String,

    // AI providers with keys configured
    pub providers_configured: Vec<String>,

    // Skills / MCPs installed
    pub skills_installed: Vec<String>,

    // Security controls
    pub audit_cron_exists:       bool,
    pub sha256_baseline_exists:  bool,
    pub agents_md_exists:        bool,
    pub git_backup_configured:   bool,
}

#[tauri::command]
fn check_security_posture() -> SecurityPosture {
    let home = dirs::home_dir().unwrap_or_default();
    let cfg_path = home.join(".openclaw").join("openclaw.json");

    // ── openclaw.json ──
    let openclaw_json_exists = cfg_path.exists();
    let (openclaw_json_perm_ok, openclaw_json_mode) = if openclaw_json_exists {
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            match std::fs::metadata(&cfg_path) {
                Ok(m) => {
                    let mode = m.mode() & 0o777;
                    (mode == 0o600, format!("{:03o}", mode))
                }
                Err(_) => (false, "?".into()),
            }
        }
        #[cfg(not(unix))]
        { (true, "n/a".into()) }
    } else {
        (false, "-".into())
    };

    // ── parse openclaw.json ──
    let cfg: serde_json::Value = std::fs::read_to_string(&cfg_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let feishu_enabled = cfg.pointer("/channels/feishu/enabled")
        .and_then(|v| v.as_bool()).unwrap_or(false);
    let feishu_dm_policy = cfg.pointer("/channels/feishu/accounts/default/dmPolicy")
        .and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let feishu_allow_list: Vec<String> = cfg
        .pointer("/channels/feishu/accounts/default/allowFrom")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_owned)).collect())
        .unwrap_or_default();

    let dingtalk_enabled = cfg.pointer("/channels/dingtalk/enabled")
        .and_then(|v| v.as_bool()).unwrap_or(false);
    let dingtalk_dm_policy = cfg.pointer("/channels/dingtalk/dmPolicy")
        .and_then(|v| v.as_str()).unwrap_or("unknown").to_string();

    // ── AI providers: check env vars set in openclaw config ──
    let provider_keys = [
        ("OpenAI",       "/env/OPENAI_API_KEY"),
        ("Anthropic",    "/env/ANTHROPIC_API_KEY"),
        ("Google Gemini","/env/GEMINI_API_KEY"),
        ("Moonshot",     "/env/MOONSHOT_API_KEY"),
        ("MiniMax",      "/env/MINIMAX_API_KEY"),
        ("Mistral",      "/env/MISTRAL_API_KEY"),
        ("OpenRouter",   "/env/OPENROUTER_API_KEY"),
        ("火山引擎",      "/env/VOLCANO_ENGINE_API_KEY"),
        ("Ollama",       "/models/providers/ollama/baseUrl"),
    ];
    let providers_configured: Vec<String> = provider_keys.iter()
        .filter(|(_, path)| {
            cfg.pointer(path)
                .and_then(|v| v.as_str())
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false)
        })
        .map(|(name, _)| name.to_string())
        .collect();

    // ── Skills / MCPs ──
    let skills_installed: Vec<String> = cfg
        .pointer("/skills")
        .and_then(|v| v.as_object())
        .map(|obj| obj.keys().cloned().collect())
        .unwrap_or_default();

    // ── Security controls ──
    // Nightly audit cron: look for openclaw-audit in crontab
    let audit_cron_exists = run_cmd("crontab", &["-l"])
        .map(|s| s.contains("openclaw") && s.contains("audit"))
        .unwrap_or(false);

    // SHA256 baseline file
    let sha256_baseline_exists = home.join(".openclaw").join("security-baseline.sha256").exists()
        || home.join(".openclaw").join("baseline.sha256").exists();

    // AGENTS.md
    let agents_md_exists = home.join(".openclaw").join("workspace").join("AGENTS.md").exists()
        || home.join(".openclaw").join("AGENTS.md").exists();

    // Git backup: check if ~/.openclaw is a git repo with a remote
    let git_backup_configured = std::process::Command::new("git")
        .args(["-C", home.join(".openclaw").to_str().unwrap_or(""), "remote", "get-url", "origin"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    SecurityPosture {
        openclaw_json_exists,
        openclaw_json_perm_ok,
        openclaw_json_mode,
        feishu_enabled,
        feishu_dm_policy,
        feishu_allow_list,
        dingtalk_enabled,
        dingtalk_dm_policy,
        providers_configured,
        skills_installed,
        audit_cron_exists,
        sha256_baseline_exists,
        agents_md_exists,
        git_backup_configured,
    }
}

#[tauri::command]
async fn fix_openclaw_json_perm() -> Result<String, String> {
    #[cfg(unix)]
    {
        let home = dirs::home_dir().ok_or("no home")?;
        let path = home.join(".openclaw").join("openclaw.json");
        if !path.exists() {
            return Err("openclaw.json 不存在".into());
        }
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
        Ok("已设置 openclaw.json 权限为 600".into())
    }
    #[cfg(not(unix))]
    { Ok("Windows 不需要此操作".into()) }
}

#[tauri::command]
fn fix_sha256_baseline() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("no home")?;
    let cfg_path = home.join(".openclaw").join("openclaw.json");
    if !cfg_path.exists() {
        return Err("openclaw.json 不存在，请先完成安装向导".into());
    }
    let content = std::fs::read_to_string(&cfg_path).map_err(|e| e.to_string())?;
    // Compute SHA256
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    // Use sha2 is not available; use openssl via command instead
    let out = std::process::Command::new("shasum")
        .args(["-a", "256", cfg_path.to_str().unwrap_or("")])
        .output()
        .map_err(|e| format!("shasum 命令失败: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    let _ = content; // suppress unused warning
    let baseline_path = home.join(".openclaw").join("security-baseline.sha256");
    std::fs::write(&baseline_path, &out.stdout).map_err(|e| e.to_string())?;
    Ok(format!(
        "SHA256 基线已生成：{}",
        String::from_utf8_lossy(&out.stdout).trim()
    ))
}

#[tauri::command]
fn fix_audit_cron() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("no home")?;
    let log_path = home.join(".openclaw").join("audit.log");
    let openclaw_bin = home.join(".npm-global").join("bin").join("openclaw");
    let bin = if openclaw_bin.exists() {
        openclaw_bin.to_string_lossy().to_string()
    } else {
        "openclaw".to_string()
    };
    let cron_line = format!(
        "0 2 * * * {} security audit --deep >> {} 2>&1\n",
        bin,
        log_path.display()
    );

    // Read existing crontab
    let existing = std::process::Command::new("crontab")
        .arg("-l")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();

    if existing.contains("openclaw") && existing.contains("audit") {
        return Ok("夜间审计 Cron 已存在，无需重复添加".into());
    }

    let new_crontab = format!("{}{}", existing.trim_end(), format!("\n{cron_line}"));

    // Write back via crontab stdin
    use std::io::Write;
    let mut child = std::process::Command::new("crontab")
        .arg("-")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("crontab 命令失败: {e}"))?;
    if let Some(stdin) = child.stdin.as_mut() {
        stdin.write_all(new_crontab.as_bytes()).map_err(|e| e.to_string())?;
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok("已添加夜间审计 Cron（每天凌晨 2 点），日志输出到 ~/.openclaw/audit.log".into())
    } else {
        Err("crontab 写入失败".into())
    }
}

#[tauri::command]
fn fix_git_backup() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("no home")?;
    let oc_dir = home.join(".openclaw");
    if !oc_dir.exists() {
        return Err("~/.openclaw 目录不存在".into());
    }

    // Check if already a git repo
    let git_dir = oc_dir.join(".git");
    if !git_dir.exists() {
        let init = std::process::Command::new("git")
            .args(["init"])
            .current_dir(&oc_dir)
            .output()
            .map_err(|e| format!("git init 失败: {e}"))?;
        if !init.status.success() {
            return Err(String::from_utf8_lossy(&init.stderr).to_string());
        }
    }

    // Create/update .gitignore
    let gitignore = oc_dir.join(".gitignore");
    let ignore_content = "*.log\n*.tmp\npaired.json\n";
    std::fs::write(&gitignore, ignore_content).ok();

    // Stage and commit current state
    std::process::Command::new("git")
        .args(["add", "-A"])
        .current_dir(&oc_dir)
        .output().ok();
    std::process::Command::new("git")
        .args(["commit", "-m", "security: initial openclaw backup snapshot",
               "--allow-empty"])
        .current_dir(&oc_dir)
        .env("GIT_AUTHOR_NAME", "openclaw-manager")
        .env("GIT_AUTHOR_EMAIL", "manager@openclaw")
        .env("GIT_COMMITTER_NAME", "openclaw-manager")
        .env("GIT_COMMITTER_EMAIL", "manager@openclaw")
        .output().ok();

    Ok("~/.openclaw 已初始化为 Git 仓库并创建初始提交。\n请手动添加远程仓库：\ngit -C ~/.openclaw remote add origin <你的私有仓库地址>\ngit -C ~/.openclaw push -u origin main".into())
}

// ── Security extra ────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct BaselineVerifyResult {
    pub ok: bool,
    pub current_hash: String,
    pub baseline_hash: String,
    pub message: String,
}

#[tauri::command]
fn verify_sha256_baseline() -> Result<BaselineVerifyResult, String> {
    let home = dirs::home_dir().ok_or("no home")?;
    let cfg_path = home.join(".openclaw").join("openclaw.json");
    let baseline_path = home.join(".openclaw").join("security-baseline.sha256");

    if !cfg_path.exists()      { return Err("openclaw.json 不存在".into()); }
    if !baseline_path.exists() { return Err("基线文件不存在，请先生成基线".into()); }

    let out = std::process::Command::new("shasum")
        .args(["-a", "256", cfg_path.to_str().unwrap_or("")])
        .output()
        .map_err(|e| format!("shasum 失败: {e}"))?;
    let current = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let current_hash = current.split_whitespace().next().unwrap_or("").to_string();

    let baseline_raw = std::fs::read_to_string(&baseline_path).map_err(|e| e.to_string())?;
    let baseline_hash = baseline_raw.trim().split_whitespace().next().unwrap_or("").to_string();

    let ok = !current_hash.is_empty() && current_hash == baseline_hash;
    let message = if ok {
        "文件完整，未检测到篡改".into()
    } else {
        format!("⚠ 哈希不匹配！文件可能已被篡改\n当前: {}\n基线: {}", current_hash, baseline_hash)
    };

    Ok(BaselineVerifyResult { ok, current_hash, baseline_hash, message })
}

#[tauri::command]
fn set_git_remote(url: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("no home")?;
    let oc_dir = home.join(".openclaw");

    // Remove existing remote if any
    std::process::Command::new("git")
        .args(["remote", "remove", "origin"])
        .current_dir(&oc_dir)
        .output().ok();

    // Add new remote
    let add = std::process::Command::new("git")
        .args(["remote", "add", "origin", url.trim()])
        .current_dir(&oc_dir)
        .output()
        .map_err(|e| format!("git remote add 失败: {e}"))?;
    if !add.status.success() {
        return Err(String::from_utf8_lossy(&add.stderr).to_string());
    }

    // Stage and commit if needed
    std::process::Command::new("git")
        .args(["add", "-A"])
        .current_dir(&oc_dir)
        .output().ok();
    std::process::Command::new("git")
        .args(["commit", "-m", "security: openclaw config backup", "--allow-empty"])
        .current_dir(&oc_dir)
        .env("GIT_AUTHOR_NAME", "openclaw-manager")
        .env("GIT_AUTHOR_EMAIL", "manager@openclaw")
        .env("GIT_COMMITTER_NAME", "openclaw-manager")
        .env("GIT_COMMITTER_EMAIL", "manager@openclaw")
        .output().ok();

    // Push
    let push = std::process::Command::new("git")
        .args(["push", "-u", "origin", "HEAD"])
        .current_dir(&oc_dir)
        .output()
        .map_err(|e| format!("git push 失败: {e}"))?;

    if push.status.success() {
        Ok(format!("已推送到远程仓库：{}", url.trim()))
    } else {
        let stderr = String::from_utf8_lossy(&push.stderr).to_string();
        Err(format!("Remote 已配置，但 push 失败（可能需要先配置 Git 凭据）：\n{stderr}"))
    }
}

#[tauri::command]
fn get_audit_log() -> String {
    let home = dirs::home_dir().unwrap_or_default();
    let path = home.join(".openclaw").join("audit.log");
    if !path.exists() {
        return String::new();
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(100);
    lines[start..].join("\n")
}

#[derive(Serialize)]
pub struct VersionInfo {
    pub installed: Option<String>,
    pub latest: Option<String>,
    pub up_to_date: bool,
}

#[tauri::command]
fn get_openclaw_version_info() -> VersionInfo {
    let installed = run_cmd("openclaw", &["--version"])
        .map(|s| s.trim().to_string());

    // Query npm registry for latest version
    let latest = run_cmd("npm", &["view", "openclaw", "version",
        "--registry", "https://registry.npmmirror.com"])
        .map(|s| s.trim().to_string());

    let up_to_date = match (&installed, &latest) {
        (Some(i), Some(l)) => i.trim_start_matches('v') == l.trim_start_matches('v'),
        _ => false,
    };

    VersionInfo { installed, latest, up_to_date }
}

// ── Logs & Network ────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_logs() -> String {
    let home = dirs::home_dir().unwrap_or_default();
    // Find the most recent log in /tmp/openclaw/ first, then fall back to legacy paths
    let tmp_log = std::fs::read_dir("/tmp/openclaw")
        .ok()
        .and_then(|mut d| {
            let mut entries: Vec<_> = d.by_ref()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_name().to_string_lossy().ends_with(".log"))
                .collect();
            entries.sort_by_key(|e| e.file_name());
            entries.last().map(|e| e.path())
        });
    let mut candidates = vec![
        home.join(".openclaw").join("logs").join("gateway.log"),
        home.join(".config").join("openclaw").join("gateway.log"),
        home.join("Library").join("Logs").join("openclaw").join("gateway.log"),
    ];
    if let Some(p) = tmp_log { candidates.insert(0, p); }
    let candidates = candidates;
    for path in candidates.iter() {
        if let Ok(content) = std::fs::read_to_string(path) {
            let lines: Vec<&str> = content.lines().collect();
            let start = lines.len().saturating_sub(80);
            return lines[start..].join("\n");
        }
    }
    String::new()
}

#[tauri::command]
fn get_local_ip() -> String {
    use std::net::UdpSocket;
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| { s.connect("8.8.8.8:80")?; s.local_addr() })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".into())
}

// ── Entry ─────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // activation
            check_activation,
            activate,
            // env
            check_env,
            // install
            install_openclaw,
            // init
            init_openclaw_config,
            install_gateway_service,
            set_model_api_key,
            // gateway
            start_gateway_service,
            stop_gateway_service,
            get_gateway_service_status,
            run_openclaw_doctor,
            open_openclaw_dashboard,
            // feishu tools
            install_feishu_sdk,
            check_feishu_sdk,
            check_gateway_proxy,
            fix_gateway_proxy,
            generate_feishu_test_script,
            run_feishu_test_script,
            // feishu channel
            configure_feishu_channel,
            set_feishu_dm_policy,
            get_feishu_dm_policy,
            approve_feishu_pairing,
            list_feishu_pairing,
            save_feishu_config,
            load_feishu_config,
            add_feishu_allow_user,
            remove_feishu_allow_user,
            get_feishu_allow_list,
            // dingtalk channel
            install_dingtalk_plugin,
            configure_dingtalk_channel,
            save_dingtalk_config,
            load_dingtalk_config,
            // qq channel
            install_qq_plugin,
            configure_qq_channel,
            save_qq_config,
            load_qq_config,
            // wecom channel
            install_wecom_plugin,
            configure_wecom_channel,
            save_wecom_config,
            load_wecom_config,
            start_wecom_tunnel,
            // telegram channel
            load_telegram_config,
            configure_telegram_channel,
            // discord channel
            load_discord_config,
            configure_discord_channel,
            // slack channel
            load_slack_config,
            configure_slack_channel,
            // whatsapp channel
            load_whatsapp_config,
            start_whatsapp_login,
            check_whatsapp_status,
            logout_whatsapp,
            // security
            check_security_posture,
            fix_openclaw_json_perm,
            fix_sha256_baseline,
            verify_sha256_baseline,
            fix_audit_cron,
            fix_git_backup,
            set_git_remote,
            get_audit_log,
            get_openclaw_version_info,
            // quick fixes
            fix_npm_path,
            install_shell_completion,
            // workspace
            read_workspace_file,
            write_workspace_file,
            // misc
            get_logs,
            get_local_ip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
