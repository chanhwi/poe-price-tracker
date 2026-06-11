mod item;
mod session;
mod trade;

use tauri::Manager;
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
        .manage(TradeClient::new())
        .setup(|app| {
            // Restore a persisted POESESSID into the client, if any.
            let client = app.state::<TradeClient>();
            session::load_persisted(app.handle(), client.inner());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            item::parse_item_text,
            trade::commands::get_leagues,
            trade::commands::price_check,
            trade::commands::set_poesessid,
            session::open_login,
            session::capture_poesessid,
            session::clear_poesessid,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
