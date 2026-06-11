use serde::{Deserialize, Serialize};

/// Response of `POST /api/trade2/search/{realm}/{league}` — a query id plus the
/// list of result hashes (no prices; those come from the fetch endpoint).
#[derive(Debug, Deserialize)]
pub struct SearchResponse {
    pub id: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub complexity: Option<u32>,
    #[serde(default)]
    pub result: Vec<String>,
    #[serde(default)]
    pub total: u64,
}

/// Response of `GET /api/trade2/fetch/{ids}?query={id}` — up to 10 listings.
#[derive(Debug, Deserialize)]
pub struct FetchResponse {
    #[serde(default)]
    pub result: Vec<Option<FetchResult>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FetchResult {
    pub id: String,
    #[serde(default)]
    pub listing: Option<Listing>,
    /// Full item payload kept opaque for now (parsed in a later section).
    #[serde(default)]
    pub item: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Listing {
    #[serde(default)]
    pub indexed: Option<String>,
    #[serde(default)]
    pub price: Option<Price>,
    #[serde(default)]
    pub account: Option<Account>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Price {
    #[serde(rename = "type", default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub amount: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Account {
    #[serde(default)]
    pub name: Option<String>,
}

/// One entry from `GET /api/trade2/data/leagues`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct League {
    pub id: String,
    #[serde(default)]
    pub realm: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LeaguesResponse {
    pub result: Vec<League>,
}

/// A single priced listing, flattened for the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct PricePoint {
    pub amount: f64,
    pub currency: String,
    pub account: Option<String>,
    /// Item display name (unique name / full type line / base type).
    pub item: Option<String>,
    /// Item's fixed/rolled mod lines (implicit + explicit).
    pub mods: Vec<String>,
}

/// Result of a price check: total matches, the sampled priced listings, and a
/// median over the dominant currency. Cross-currency normalization is a later
/// section (DESIGN.md §9); for now median is within the most common currency.
#[derive(Debug, Serialize)]
pub struct PriceCheckResult {
    pub total: u64,
    pub sampled: usize,
    pub listings: Vec<PricePoint>,
    pub median: Option<PricePoint>,
    /// True if some fetch chunks failed and the sample is incomplete.
    pub partial: bool,
    /// The search's query id and the web trade-site deep link for it.
    pub search_id: String,
    pub trade_url: String,
}

// --- data/stats (mod filter catalogue) ---

#[derive(Debug, Deserialize)]
pub struct StatsResponse {
    #[serde(default)]
    pub result: Vec<StatGroup>,
}

#[derive(Debug, Deserialize)]
pub struct StatGroup {
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub entries: Vec<StatEntry>,
}

#[derive(Debug, Deserialize)]
pub struct StatEntry {
    pub id: String,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(rename = "type", default)]
    pub kind: Option<String>,
}

/// Flattened stat option for the frontend filter builder.
#[derive(Debug, Clone, Serialize)]
pub struct StatOption {
    pub id: String,
    pub text: String,
    pub kind: Option<String>,
    pub group: Option<String>,
}
