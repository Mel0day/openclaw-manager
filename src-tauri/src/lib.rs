use std::process::Command;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

// ── State ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct FeishuConfig {
    pub app_id: String,
    pub app_secret: String,
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
    let out = Command::new("pip3")
        .args(["install", "lark-oapi", "--upgrade",
               "-i", "https://mirrors.aliyun.com/pypi/simple/"])
        .output()
        .map_err(|e| format!("找不到 pip3: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if out.status.success() || stdout.contains("Successfully installed") || stdout.contains("already satisfied") {
        Ok(stdout + &stderr)
    } else {
        Err(stderr + &stdout)
    }
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
    domain: String,   // "feishu" or "lark"
) -> Result<(), String> {
    let prefix = "channels.feishu";
    run_openclaw(&["config", "set", &format!("{prefix}.enabled"), "true"])?;
    run_openclaw(&["config", "set", &format!("{prefix}.accounts.default.appId"), &app_id])?;
    run_openclaw(&["config", "set", &format!("{prefix}.accounts.default.appSecret"), &app_secret])?;
    run_openclaw(&["config", "set", &format!("{prefix}.accounts.default.dmPolicy"), "allowlist"])?;
    run_openclaw(&["config", "set", &format!("{prefix}.accounts.default.streaming"), "true"])?;
    if domain == "lark" {
        run_openclaw(&["config", "set", &format!("{prefix}.domain"), "lark"])?;
    }
    Ok(())
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
            check_gateway_proxy,
            fix_gateway_proxy,
            generate_feishu_test_script,
            run_feishu_test_script,
            // feishu channel
            configure_feishu_channel,
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
            // quick fixes
            fix_npm_path,
            install_shell_completion,
            // misc
            get_logs,
            get_local_ip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
