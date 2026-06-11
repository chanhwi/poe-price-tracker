use serde::{Serialize, Serializer};

/// Errors surfaced from the trade client. Serializes to a plain string so it can
/// cross the Tauri command boundary to the frontend.
#[derive(Debug, thiserror::Error)]
pub enum TradeError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    /// Rate limited locally or by the server; carries how long to wait.
    #[error("rate limited; retry in {0:?}")]
    RateLimited(std::time::Duration),

    #[error("trade API returned status {status}: {body}")]
    Status { status: u16, body: String },

    #[error("trade API error: {0}")]
    Api(String),
}

impl Serialize for TradeError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}
