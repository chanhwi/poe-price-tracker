//! PoE2 trade API client: unofficial `/api/trade2/*` endpoints with
//! header-driven, self-throttling rate limiting (see DESIGN.md §5, §6).

pub mod commands;
pub mod error;
pub mod model;
pub mod ratelimit;

mod client;

pub use client::TradeClient;
