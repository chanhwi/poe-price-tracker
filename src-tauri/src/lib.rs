mod hotkey;
mod item;
mod session;
mod trade;

use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;
use trade::TradeClient;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        hotkey::on_capture_hotkey(app);
                    }
                })
                .build(),
        )
        .manage(TradeClient::new())
        .setup(|app| {
            // Restore a persisted POESESSID, then register the capture hotkey.
            let client = app.state::<TradeClient>();
            session::load_persisted(app.handle(), client.inner());
            hotkey::init(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            item::parse_item_text,
            trade::commands::get_leagues,
            trade::commands::get_stats,
            trade::commands::price_check,
            trade::commands::set_poesessid,
            session::open_login,
            session::capture_poesessid,
            session::clear_poesessid,
            hotkey::set_capture_hotkey,
            hotkey::get_capture_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
