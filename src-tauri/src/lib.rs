mod item;
mod trade;

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
        .invoke_handler(tauri::generate_handler![
            greet,
            item::parse_item_text,
            trade::commands::get_leagues,
            trade::commands::price_check,
            trade::commands::set_poesessid,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
