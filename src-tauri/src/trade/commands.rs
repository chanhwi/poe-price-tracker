use serde_json::Value;
use tauri::State;

use super::error::TradeError;
use super::model::{League, PriceCheckResult, StatOption};
use super::TradeClient;

/// Fetch the current PoE2 leagues (cheap data endpoint; good connectivity test).
#[tauri::command]
pub async fn get_leagues(client: State<'_, TradeClient>) -> Result<Vec<League>, TradeError> {
    client.leagues().await
}

/// Fetch the stat/mod filter catalogue for the accordion filter builder.
#[tauri::command]
pub async fn get_stats(client: State<'_, TradeClient>) -> Result<Vec<StatOption>, TradeError> {
    client.stats().await
}

/// Fetch the full filter schema (data/filters) for the filter builder.
#[tauri::command]
pub async fn get_filters(client: State<'_, TradeClient>) -> Result<serde_json::Value, TradeError> {
    client.filters().await
}

/// Run a price check for a pre-built trade2 query object against `league`.
#[tauri::command]
pub async fn price_check(
    client: State<'_, TradeClient>,
    league: String,
    query: Value,
) -> Result<PriceCheckResult, TradeError> {
    client.price_check(&league, query).await
}

/// Set or clear the POESESSID session cookie (pass null/empty to clear).
#[tauri::command]
pub fn set_poesessid(
    client: State<'_, TradeClient>,
    poesessid: Option<String>,
) -> Result<(), TradeError> {
    client.set_poesessid(poesessid);
    Ok(())
}
