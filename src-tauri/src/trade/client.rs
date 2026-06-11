use std::sync::RwLock;
use std::time::{Duration, Instant};

use serde_json::Value;
use tokio::sync::Mutex;

use super::error::TradeError;
use super::model::*;
use super::ratelimit::{parse_rate_headers, PolicyLimiter};

/// Identifiable, contactable User-Agent (the repo URL is the contact channel).
const USER_AGENT: &str = "poe-price-tracker/0.1 (+https://github.com/chanhwi/poe-price-tracker)";

/// How many cheapest listings to sample for a price check.
const SAMPLE_SIZE: usize = 20;

/// Fallback lock duration when a 429 omits a parseable `Retry-After`. Kept
/// conservative (PoE2's worst observed search lock is 1800s) but bounded;
/// `max_auto_wait` surfaces anything long to the caller instead of busy-waiting.
const RETRY_AFTER_FALLBACK: Duration = Duration::from_secs(300);

/// Which rate-limit policy bucket a request belongs to. Search and fetch carry
/// separate server policies, so they get separate limiters.
///
/// NOTE (known limitation): if the server actually meters search+fetch against a
/// single shared IP bucket, the first fetch in a price_check is decided before
/// it has seen the preceding search's IP usage. The per-response `-State`
/// top-up self-corrects this after the first fetch response, and the only window
/// at risk is the 5/10s one (a 60s lock, not the 1800s lock). Revisit (merge the
/// "Ip" rule into a shared limiter) if 429s are observed in practice.
#[derive(Clone, Copy)]
enum Policy {
    Search,
    Fetch,
}

/// Serialized throttle state guarded by a single async mutex (concurrency = 1).
struct GateState {
    search: PolicyLimiter,
    fetch: PolicyLimiter,
    last_request: Option<Instant>,
    /// Set on a 429; no request proceeds until this passes.
    blocked_until: Option<Instant>,
}

impl GateState {
    fn limiter_mut(&mut self, p: Policy) -> &mut PolicyLimiter {
        match p {
            Policy::Search => &mut self.search,
            Policy::Fetch => &mut self.fetch,
        }
    }
}

/// Client for the unofficial PoE2 trade2 API. All requests funnel through a
/// single serial gate that self-throttles from the server's rate-limit headers.
pub struct TradeClient {
    http: reqwest::Client,
    host: String,
    realm: String,
    poesessid: RwLock<Option<String>>,
    gate: Mutex<GateState>,
    /// Global floor between any two requests (politeness / anti-burst), per
    /// DESIGN.md §6 (1.5s).
    min_interval: Duration,
    /// If the required wait exceeds this, surface it to the caller instead of
    /// blocking the command for minutes (e.g. a 30-min lockout).
    max_auto_wait: Duration,
}

impl TradeClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(30))
            .build()
            .expect("failed to build reqwest client");
        Self {
            http,
            host: "www.pathofexile.com".to_string(),
            realm: "poe2".to_string(),
            poesessid: RwLock::new(None),
            gate: Mutex::new(GateState {
                search: PolicyLimiter::new(),
                fetch: PolicyLimiter::new(),
                last_request: None,
                blocked_until: None,
            }),
            min_interval: Duration::from_millis(1500),
            max_auto_wait: Duration::from_secs(15),
        }
    }

    /// Set (or clear) the POESESSID session cookie used for authenticated calls.
    pub fn set_poesessid(&self, sid: Option<String>) {
        let sid = sid.filter(|s| !s.trim().is_empty());
        *self.poesessid.write().unwrap() = sid;
    }

    /// Send one request through the serial gate, applying and updating throttle
    /// state. Holds the gate across the network call so requests are strictly
    /// serialized (concurrency = 1).
    async fn send(
        &self,
        policy: Policy,
        builder: reqwest::RequestBuilder,
    ) -> Result<reqwest::Response, TradeError> {
        let mut gate = self.gate.lock().await;

        let now = Instant::now();
        let mut wait = gate.limiter_mut(policy).until_ready(now);
        if let Some(last) = gate.last_request {
            let since = now.saturating_duration_since(last);
            if since < self.min_interval {
                wait = wait.max(self.min_interval - since);
            }
        }
        if let Some(blocked_until) = gate.blocked_until {
            wait = wait.max(blocked_until.saturating_duration_since(now));
        }
        if wait > self.max_auto_wait {
            return Err(TradeError::RateLimited(wait));
        }
        if !wait.is_zero() {
            tokio::time::sleep(wait).await;
        }

        let send_at = Instant::now();
        gate.limiter_mut(policy).note_send(send_at);
        gate.last_request = Some(send_at);

        // Read & clone POESESSID without holding the lock across the await.
        let sid = self.poesessid.read().unwrap().clone();
        let builder = match sid {
            Some(s) => builder.header(reqwest::header::COOKIE, format!("POESESSID={s}")),
            None => builder,
        };

        let resp = builder.send().await?;

        // Reconcile usage: state-sync the windows the server reported, then count
        // this request into any window it did NOT report (exactly-once counting).
        let rh = parse_rate_headers(resp.headers());
        let synced = gate.limiter_mut(policy).update_from_headers(&rh);
        gate.limiter_mut(policy).record_unsynced(send_at, &synced);

        if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            let ra = rh.retry_after.unwrap_or(RETRY_AFTER_FALLBACK);
            gate.blocked_until = Some(Instant::now() + ra);
            return Err(TradeError::RateLimited(ra));
        }
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            // Collapse whitespace + truncate so the frontend renders plain text,
            // never raw upstream HTML. (Cannot contain the request cookie.)
            let raw: String = resp.text().await.unwrap_or_default().chars().take(300).collect();
            let body = raw.split_whitespace().collect::<Vec<_>>().join(" ");
            return Err(TradeError::Status { status, body });
        }
        Ok(resp)
    }

    /// `GET /api/trade2/data/leagues` — current PoE2 leagues.
    pub async fn leagues(&self) -> Result<Vec<League>, TradeError> {
        let url = format!("https://{}/api/trade2/data/leagues", self.host);
        let resp = self.send(Policy::Search, self.http.get(url.as_str())).await?;
        let parsed: LeaguesResponse = resp.json().await?;
        Ok(parsed.result)
    }

    /// `GET /api/trade2/data/stats` — the flattened mod/stat filter catalogue
    /// (for the accordion filter builder). Large + static; the frontend caches it.
    pub async fn stats(&self) -> Result<Vec<StatOption>, TradeError> {
        let url = format!("https://{}/api/trade2/data/stats", self.host);
        let resp = self.send(Policy::Search, self.http.get(url.as_str())).await?;
        let parsed: StatsResponse = resp.json().await?;
        let mut out = Vec::new();
        for g in parsed.result {
            let group = g.label.clone();
            for e in g.entries {
                out.push(StatOption {
                    id: e.id,
                    text: e.text.unwrap_or_default(),
                    kind: e.kind,
                    group: group.clone(),
                });
            }
        }
        Ok(out)
    }

    /// `POST /api/trade2/search/{realm}/{league}` with a raw trade query object.
    /// The league is pushed as a percent-encoded path segment so names with
    /// spaces (e.g. "Runes of Aldur") or other reserved chars are handled safely.
    pub async fn search(&self, league: &str, query: Value) -> Result<SearchResponse, TradeError> {
        // No trailing slash on the base, else push() yields a `search//poe2`
        // double slash and the API 404s.
        let mut url = reqwest::Url::parse(&format!("https://{}/api/trade2/search", self.host))
            .map_err(|e| TradeError::Api(format!("bad base url: {e}")))?;
        url.path_segments_mut()
            .map_err(|_| TradeError::Api("base url cannot-be-a-base".into()))?
            .push(self.realm.as_str())
            .push(league);
        let resp = self
            .send(Policy::Search, self.http.post(url).json(&query))
            .await?;
        Ok(resp.json::<SearchResponse>().await?)
    }

    /// `GET /api/trade2/fetch/{ids}?query={id}` in batches of 10. Tolerates a
    /// per-chunk transient failure (keeps the listings already gathered) and
    /// only hard-errors if every chunk failed; returns `(listings, partial)`.
    /// A `RateLimited` error is always propagated (it must reach the gate/UI).
    pub async fn fetch(
        &self,
        query_id: &str,
        ids: &[String],
    ) -> Result<(Vec<FetchResult>, bool), TradeError> {
        let mut out = Vec::new();
        let mut partial = false;
        let mut last_err: Option<TradeError> = None;
        let mut attempted = 0usize;

        for chunk in ids.chunks(10) {
            attempted += 1;
            let joined = chunk.join(",");
            // ids are hex hashes and query_id a server token — all URL-safe.
            let url = format!(
                "https://{}/api/trade2/fetch/{}?query={}&realm={}",
                self.host, joined, query_id, self.realm
            );
            match self.send(Policy::Fetch, self.http.get(url.as_str())).await {
                Ok(resp) => match resp.json::<FetchResponse>().await {
                    Ok(parsed) => out.extend(parsed.result.into_iter().flatten()),
                    Err(e) => {
                        partial = true;
                        last_err = Some(e.into());
                    }
                },
                Err(e @ TradeError::RateLimited(_)) => return Err(e),
                Err(e) => {
                    partial = true;
                    last_err = Some(e);
                }
            }
        }

        if out.is_empty() && attempted > 0 {
            return Err(last_err.unwrap_or_else(|| TradeError::Api("fetch returned no listings".into())));
        }
        Ok((out, partial))
    }

    /// Search then fetch the cheapest `SAMPLE_SIZE` listings and summarize price.
    pub async fn price_check(
        &self,
        league: &str,
        query: Value,
    ) -> Result<PriceCheckResult, TradeError> {
        let search = self.search(league, query).await?;
        let total = search.total;
        let sample_n = SAMPLE_SIZE.min(search.result.len());
        let ids: Vec<String> = search.result.into_iter().take(sample_n).collect();

        let (results, partial) = if ids.is_empty() {
            (Vec::new(), false)
        } else {
            self.fetch(&search.id, &ids).await?
        };

        let points: Vec<PricePoint> = results
            .iter()
            .filter_map(|r| {
                let l = r.listing.as_ref()?;
                let p = l.price.as_ref()?;
                let amount = p.amount?;
                // Drop junk that would skew the median / dominant-currency tally.
                if !amount.is_finite() || amount <= 0.0 {
                    return None;
                }
                Some(PricePoint {
                    amount,
                    currency: p.currency.clone()?,
                    account: l.account.as_ref().and_then(|a| a.name.clone()),
                })
            })
            .collect();

        let median = compute_median(&points);
        Ok(PriceCheckResult {
            total,
            sampled: points.len(),
            listings: points,
            median,
            partial,
        })
    }
}

impl Default for TradeClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Median amount within the most common currency among the sampled listings.
/// (Cross-currency normalization is a later section — DESIGN.md §9.)
fn compute_median(points: &[PricePoint]) -> Option<PricePoint> {
    use std::collections::HashMap;
    if points.is_empty() {
        return None;
    }
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for p in points {
        *counts.entry(p.currency.as_str()).or_default() += 1;
    }
    let dominant = counts.into_iter().max_by_key(|&(_, c)| c)?.0.to_string();

    let mut amts: Vec<f64> = points
        .iter()
        .filter(|p| p.currency == dominant)
        .map(|p| p.amount)
        .collect();
    amts.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let n = amts.len();
    let med = if n % 2 == 1 {
        amts[n / 2]
    } else {
        (amts[n / 2 - 1] + amts[n / 2]) / 2.0
    };
    Some(PricePoint {
        amount: med,
        currency: dominant,
        account: None,
    })
}

#[cfg(test)]
mod live_tests {
    //! Live integration tests against the real PoE2 trade API. Marked `#[ignore]`
    //! so plain `cargo test` skips them. Run manually with:
    //!   cargo test -p poe-price-tracker -- --ignored --nocapture
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn live_leagues() {
        let c = TradeClient::new();
        let leagues = c.leagues().await.expect("leagues request failed");
        assert!(!leagues.is_empty(), "expected at least one league");
        assert!(leagues.iter().all(|l| l.realm.as_deref() == Some("poe2")));
        println!(
            "leagues: {:?}",
            leagues.iter().map(|l| &l.id).collect::<Vec<_>>()
        );
    }

    #[tokio::test]
    #[ignore]
    async fn live_price_check() {
        let c = TradeClient::new();
        // Minimal valid query: cheapest online listings, no item filter.
        let query = serde_json::json!({
            "query": { "status": { "option": "online" } },
            "sort": { "price": "asc" }
        });
        let res = c
            .price_check("Standard", query)
            .await
            .expect("price_check failed");
        println!(
            "total={}, sampled={}, partial={}, median={:?}",
            res.total, res.sampled, res.partial, res.median
        );
        assert!(res.total > 0);
    }
}
