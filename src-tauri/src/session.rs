//! Embedded login + POESESSID capture + trade-host (region) config.
//!
//! The trade host selects the language realm so item names match the user's game
//! (www.pathofexile.com = English, poe.game.daum.net = Korean, ...). POESESSID is
//! host-bound, so switching hosts clears it.
//!
//! NOTE: POESESSID is persisted plaintext under the per-user app-data dir (a
//! personal tool; per-user-profile scoped). Consider DPAPI/keyring for hardening.

use std::path::PathBuf;

use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::trade::TradeClient;

const LOGIN_LABEL: &str = "poe-login";
const POESESSID: &str = "POESESSID";

/// Open (or focus) an embedded login window for the configured trade host.
#[tauri::command]
pub async fn open_login(app: AppHandle, client: State<'_, TradeClient>) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(LOGIN_LABEL) {
        let _ = w.set_focus();
        return Ok(());
    }
    let login_url = format!("https://{}/login", client.host());
    let url: tauri::Url = login_url.parse().map_err(|e| format!("bad url: {e}"))?;
    WebviewWindowBuilder::new(&app, LOGIN_LABEL, WebviewUrl::External(url))
        .title("Path of Exile 로그인 — 로그인 후 'POESESSID 가져오기'를 누르세요")
        .inner_size(900.0, 760.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Read POESESSID from the login window's cookie store for the current host,
/// inject it into the client, persist it, and return it.
#[tauri::command]
pub async fn capture_poesessid(
    app: AppHandle,
    client: State<'_, TradeClient>,
) -> Result<Option<String>, String> {
    let host = client.host();
    let sid = read_poesessid(&app, &host)?;
    if let Some(ref s) = sid {
        client.set_poesessid(Some(s.clone()));
        let _ = persist(&app, "poesessid", Some(s));
    }
    Ok(sid)
}

#[tauri::command]
pub fn clear_poesessid(app: AppHandle, client: State<'_, TradeClient>) -> Result<(), String> {
    client.set_poesessid(None);
    let _ = persist(&app, "poesessid", None);
    Ok(())
}

/// Switch the trade host/region. Clears the (host-bound) POESESSID.
#[tauri::command]
pub fn set_trade_host(
    app: AppHandle,
    client: State<'_, TradeClient>,
    host: String,
) -> Result<(), String> {
    client.set_host(host.clone());
    let _ = persist(&app, "tradehost", Some(&host));
    client.set_poesessid(None);
    let _ = persist(&app, "poesessid", None);
    Ok(())
}

#[tauri::command]
pub fn get_trade_host(client: State<'_, TradeClient>) -> String {
    client.host()
}

/// Open a URL in the user's default browser (the web trade-site deep link).
#[tauri::command]
pub fn open_in_browser(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

fn read_poesessid(app: &AppHandle, host: &str) -> Result<Option<String>, String> {
    let win = app
        .get_webview_window(LOGIN_LABEL)
        .ok_or_else(|| "login window not open — open it first".to_string())?;
    let url: tauri::Url = format!("https://{host}")
        .parse()
        .map_err(|e| format!("bad url: {e}"))?;
    let cookies = win.cookies_for_url(url).map_err(|e| e.to_string())?;
    Ok(cookies
        .into_iter()
        .find(|c| c.name() == POESESSID)
        .map(|c| c.value().to_string()))
}

fn data_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}

fn persist(app: &AppHandle, name: &str, value: Option<&str>) -> Result<(), String> {
    let path = data_file(app, name)?;
    match value {
        Some(s) => std::fs::write(&path, s).map_err(|e| e.to_string()),
        None => {
            let _ = std::fs::remove_file(&path);
            Ok(())
        }
    }
}

fn load_file(app: &AppHandle, name: &str) -> Option<String> {
    data_file(app, name)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Load a persisted POESESSID into the client at startup.
pub fn load_persisted(app: &AppHandle, client: &TradeClient) {
    if let Some(s) = load_file(app, "poesessid") {
        client.set_poesessid(Some(s));
    }
}

/// Load the persisted trade host into the client at startup.
pub fn load_host(app: &AppHandle, client: &TradeClient) {
    if let Some(h) = load_file(app, "tradehost") {
        client.set_host(h);
    }
}
