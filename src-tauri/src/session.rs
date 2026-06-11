//! Embedded pathofexile.com login + POESESSID capture (DESIGN.md §2 / Section 6).
//!
//! Flow: open a webview to the official login page; after the user logs in,
//! read the HTTP-only POESESSID cookie from that webview's cookie store and
//! inject it into the (separate) reqwest client. Persisted to the app's local
//! data dir so it survives restarts.

use std::path::PathBuf;

use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::trade::TradeClient;

const LOGIN_LABEL: &str = "poe-login";
const LOGIN_URL: &str = "https://www.pathofexile.com/login";
const COOKIE_HOST: &str = "https://www.pathofexile.com";
const POESESSID: &str = "POESESSID";

/// Open (or focus) an embedded login window pointing at pathofexile.com.
#[tauri::command]
pub async fn open_login(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(LOGIN_LABEL) {
        let _ = w.set_focus();
        return Ok(());
    }
    let url: tauri::Url = LOGIN_URL.parse().map_err(|e| format!("bad url: {e}"))?;
    WebviewWindowBuilder::new(&app, LOGIN_LABEL, WebviewUrl::External(url))
        .title("Path of Exile 로그인 — 로그인 후 'POESESSID 가져오기'를 누르세요")
        .inner_size(900.0, 760.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Read POESESSID from the login window's cookie store, inject it into the
/// client, persist it, and return it (or None if not logged in yet).
/// Async so the cookie read does not deadlock the main thread on Windows.
#[tauri::command]
pub async fn capture_poesessid(
    app: AppHandle,
    client: State<'_, TradeClient>,
) -> Result<Option<String>, String> {
    let sid = read_poesessid(&app)?;
    if let Some(ref s) = sid {
        client.set_poesessid(Some(s.clone()));
        let _ = persist(&app, Some(s));
    }
    Ok(sid)
}

/// Clear the stored session (logout from the tool's perspective).
#[tauri::command]
pub fn clear_poesessid(app: AppHandle, client: State<'_, TradeClient>) -> Result<(), String> {
    client.set_poesessid(None);
    let _ = persist(&app, None);
    Ok(())
}

fn read_poesessid(app: &AppHandle) -> Result<Option<String>, String> {
    // Prefer the login window; fall back to the main window (shared store).
    let win = app
        .get_webview_window(LOGIN_LABEL)
        .or_else(|| app.get_webview_window("main"))
        .ok_or_else(|| "no webview window available".to_string())?;
    let url: tauri::Url = COOKIE_HOST.parse().map_err(|e| format!("bad url: {e}"))?;
    let cookies = win.cookies_for_url(url).map_err(|e| e.to_string())?;
    Ok(cookies
        .into_iter()
        .find(|c| c.name() == POESESSID)
        .map(|c| c.value().to_string()))
}

fn session_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("poesessid"))
}

fn persist(app: &AppHandle, sid: Option<&str>) -> Result<(), String> {
    let path = session_file(app)?;
    match sid {
        Some(s) => std::fs::write(&path, s).map_err(|e| e.to_string()),
        None => {
            let _ = std::fs::remove_file(&path);
            Ok(())
        }
    }
}

/// Load a previously persisted POESESSID into the client (call once at startup).
pub fn load_persisted(app: &AppHandle, client: &TradeClient) {
    if let Ok(path) = session_file(app) {
        if let Ok(s) = std::fs::read_to_string(&path) {
            let s = s.trim().to_string();
            if !s.is_empty() {
                client.set_poesessid(Some(s));
            }
        }
    }
}
