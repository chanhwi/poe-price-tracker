//! Global hotkey -> simulate Ctrl+C on the hovered in-game item -> read the
//! clipboard -> parse -> emit `item-captured` to the frontend (DESIGN.md §9).
//!
//! NOTE: this does not yet gate on PoE2 being the foreground window; the item
//! parser acts as the filter (non-item clipboard text -> no registration). A
//! foreground-window check (Win32) is a recommended follow-up hardening.

use std::path::PathBuf;
use std::sync::RwLock;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::item::parse_item;

/// Default capture hotkey (placeholder; user can rebind in Settings).
pub const DEFAULT_HOTKEY: &str = "Control+KeyQ";

/// Currently-registered hotkey accelerator string.
pub struct HotkeyState(pub RwLock<String>);

/// Fired from the global-shortcut handler on key press.
pub fn on_capture_hotkey(app: &AppHandle) {
    let app = app.clone();
    // Do the copy + read + parse off the handler thread.
    std::thread::spawn(move || {
        if let Err(e) = simulate_copy() {
            eprintln!("enigo copy failed: {e}");
            return;
        }
        // Give the game a moment to populate the clipboard.
        std::thread::sleep(Duration::from_millis(120));
        let text = match app.clipboard().read_text() {
            Ok(t) => t,
            Err(_) => return,
        };
        if let Some(parsed) = parse_item(&text) {
            let _ = app.emit("item-captured", parsed);
        }
    });
}

fn simulate_copy() -> Result<(), String> {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
    enigo.key(Key::Unicode('c'), Direction::Click).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_shortcut(accel: &str) -> Result<Shortcut, String> {
    accel
        .parse::<Shortcut>()
        .map_err(|e| format!("bad hotkey '{accel}': {e}"))
}

/// Register (or re-register) the capture hotkey, replacing the previous one.
pub fn set_hotkey(app: &AppHandle, accel: &str) -> Result<(), String> {
    let new = parse_shortcut(accel)?;
    let gs = app.global_shortcut();

    if let Some(state) = app.try_state::<HotkeyState>() {
        let prev = state.0.read().unwrap().clone();
        if let Ok(prev_sc) = parse_shortcut(&prev) {
            let _ = gs.unregister(prev_sc);
        }
        gs.register(new).map_err(|e| e.to_string())?;
        *state.0.write().unwrap() = accel.to_string();
    } else {
        gs.register(new).map_err(|e| e.to_string())?;
    }
    persist_hotkey(app, accel);
    Ok(())
}

#[tauri::command]
pub fn set_capture_hotkey(app: AppHandle, accel: String) -> Result<(), String> {
    set_hotkey(&app, &accel)
}

#[tauri::command]
pub fn get_capture_hotkey(state: tauri::State<HotkeyState>) -> String {
    state.0.read().unwrap().clone()
}

fn hotkey_file(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_local_data_dir().ok()?;
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join("hotkey"))
}

fn persist_hotkey(app: &AppHandle, accel: &str) {
    if let Some(p) = hotkey_file(app) {
        let _ = std::fs::write(p, accel);
    }
}

fn load_hotkey(app: &AppHandle) -> String {
    hotkey_file(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_HOTKEY.to_string())
}

/// Manage hotkey state + register the persisted/default hotkey (call at startup).
pub fn init(app: &AppHandle) {
    let accel = load_hotkey(app);
    app.manage(HotkeyState(RwLock::new(accel.clone())));
    if let Err(e) = set_hotkey(app, &accel) {
        eprintln!("failed to register hotkey '{accel}': {e}");
    }
}
