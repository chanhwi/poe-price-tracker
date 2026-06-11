//! Header-driven rate limiting for the PoE trade API.
//!
//! The server advertises limits via `X-Rate-Limit-Rules` + per-rule
//! `X-Rate-Limit-{rule}` (`max:period:restriction` triplets) and current usage
//! via `X-Rate-Limit-{rule}-State`. We mirror those windows client-side and
//! never let a request proceed if it would exceed ANY window — this is what
//! keeps us off the 30-minute lockout (observed PoE2 search: 30/300s -> 1800s).

use std::collections::{HashMap, HashSet, VecDeque};
use std::time::{Duration, Instant};

use reqwest::header::HeaderMap;

/// Parsed rate-limit headers from a single response.
#[derive(Debug, Default, Clone)]
pub struct RateHeaders {
    pub rules: Vec<String>,
    pub limits: HashMap<String, Vec<(u32, u32, u32)>>,
    pub states: HashMap<String, Vec<(u32, u32, u32)>>,
    pub retry_after: Option<Duration>,
}

/// Parse a comma list of colon triplets, e.g. "5:10:60,15:60:300,30:300:1800".
/// Malformed entries are skipped rather than failing the whole parse.
pub fn parse_triplets(s: &str) -> Vec<(u32, u32, u32)> {
    s.split(',')
        .filter_map(|part| {
            let mut it = part.trim().split(':');
            let a = it.next()?.trim().parse().ok()?;
            let b = it.next()?.trim().parse().ok()?;
            let c = it.next()?.trim().parse().ok()?;
            Some((a, b, c))
        })
        .collect()
}

pub fn parse_rate_headers(h: &HeaderMap) -> RateHeaders {
    let get = |name: &str| -> Option<String> {
        h.get(name).and_then(|v| v.to_str().ok()).map(|s| s.to_string())
    };
    let rules: Vec<String> = get("x-rate-limit-rules")
        .map(|s| {
            s.split(',')
                .map(|r| r.trim().to_string())
                .filter(|r| !r.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let mut limits = HashMap::new();
    let mut states = HashMap::new();
    for rule in &rules {
        let lname = format!("x-rate-limit-{}", rule.to_lowercase());
        let sname = format!("x-rate-limit-{}-state", rule.to_lowercase());
        if let Some(v) = get(&lname) {
            limits.insert(rule.clone(), parse_triplets(&v));
        }
        if let Some(v) = get(&sname) {
            states.insert(rule.clone(), parse_triplets(&v));
        }
    }
    let retry_after = get("retry-after")
        .and_then(|s| s.trim().parse::<u64>().ok())
        .map(Duration::from_secs);
    RateHeaders { rules, limits, states, retry_after }
}

/// One sliding window: at most `max` requests per `period`.
#[derive(Debug)]
struct Window {
    max: u32,
    period: Duration,
    hits: VecDeque<Instant>,
}

impl Window {
    fn prune(&mut self, now: Instant, pad: Duration) {
        let span = self.period + pad;
        while let Some(&front) = self.hits.front() {
            if now.saturating_duration_since(front) > span {
                self.hits.pop_front();
            } else {
                break;
            }
        }
    }

    /// How long until a new request fits under this window (0 if it fits now).
    fn until_ready(&mut self, now: Instant, pad: Duration) -> Duration {
        self.prune(now, pad);
        // A window that allows zero requests is never ready. Guard before the
        // `len - max` subtraction / index below, which would otherwise panic
        // (out-of-bounds) on a server-sent `0:N:R` triplet.
        if self.max == 0 {
            return Duration::MAX;
        }
        let len = self.hits.len() as u32;
        if len < self.max {
            return Duration::ZERO;
        }
        // Wait until the (len - max)-th oldest in-window hit ages out, freeing
        // exactly one slot for the new request.
        let idx = (len - self.max) as usize;
        let oldest = self.hits[idx];
        let ready_at = oldest + self.period + pad;
        ready_at.saturating_duration_since(now)
    }
}

/// Self-throttling limiter for one endpoint policy (search / fetch / exchange).
/// One `Window` per advertised `(rule, period)` pair; a request must satisfy all.
#[derive(Debug)]
pub struct PolicyLimiter {
    windows: HashMap<(String, u32), Window>,
    pad: Duration,
    /// Cold-start floor used only while no real window is known yet
    /// (DESIGN.md §6: seed 1콜/5초). Deactivates once any window is learned, and
    /// reactivates only if we never learn one (e.g. headerless 503/Cloudflare).
    seed_interval: Duration,
    last_send: Option<Instant>,
}

impl PolicyLimiter {
    pub fn new() -> Self {
        // Pad each window slightly to absorb clock/latency desync (cf.
        // awakened-poe-trade's DESYNC_FIX). Better to wait a hair too long.
        Self {
            windows: HashMap::new(),
            pad: Duration::from_millis(500),
            seed_interval: Duration::from_secs(5),
            last_send: None,
        }
    }

    /// Refresh window definitions from a response, and top each state-reported
    /// window up to the server's current count. Returns the set of `(rule,
    /// period)` windows reconciled by a server `-State` this round, so the
    /// caller can locally count the just-sent request into the windows the
    /// server did NOT report (see `record_unsynced`).
    pub fn update_from_headers(&mut self, rh: &RateHeaders) -> HashSet<(String, u32)> {
        let mut synced: HashSet<(String, u32)> = HashSet::new();
        for rule in &rh.rules {
            if let Some(triplets) = rh.limits.get(rule) {
                for &(max, period_s, _restr) in triplets {
                    if max == 0 {
                        continue; // degenerate/malformed cap; never build a 0-window
                    }
                    let key = (rule.clone(), period_s);
                    let entry = self.windows.entry(key).or_insert_with(|| Window {
                        max,
                        period: Duration::from_secs(period_s as u64),
                        hits: VecDeque::new(),
                    });
                    entry.max = max;
                    entry.period = Duration::from_secs(period_s as u64);
                }
            }
            if let Some(states) = rh.states.get(rule) {
                let now = Instant::now();
                for &(cur, period_s, _restr) in states {
                    if let Some(w) = self.windows.get_mut(&(rule.clone(), period_s)) {
                        w.prune(now, self.pad);
                        while (w.hits.len() as u32) < cur {
                            w.hits.push_back(now);
                        }
                        synced.insert((rule.clone(), period_s));
                    }
                }
            }
        }
        synced
    }

    /// Max wait across every known window before the next request is allowed.
    pub fn until_ready(&mut self, now: Instant) -> Duration {
        let pad = self.pad;
        let window_wait = self
            .windows
            .values_mut()
            .map(|w| w.until_ready(now, pad))
            .max()
            .unwrap_or(Duration::ZERO);

        // Cold start / responses without rate headers: no window is known yet,
        // so pace to one request per `seed_interval` until the server tells us
        // the real limits. Prevents an unthrottled burst that could trip a lock.
        if self.windows.is_empty() {
            if let Some(last) = self.last_send {
                let since = now.saturating_duration_since(last);
                if since < self.seed_interval {
                    return window_wait.max(self.seed_interval - since);
                }
            }
        }
        window_wait
    }

    /// Mark that a request is being sent now (drives the cold-start seed floor).
    pub fn note_send(&mut self, now: Instant) {
        self.last_send = Some(now);
    }

    /// Count the just-sent request into every window the server `-State` did NOT
    /// reconcile this round, so each request is counted exactly once (state-sync
    /// is authoritative when present; this covers windows lacking a `-State`).
    pub fn record_unsynced(&mut self, now: Instant, synced: &HashSet<(String, u32)>) {
        for (key, w) in self.windows.iter_mut() {
            if !synced.contains(key) {
                w.hits.push_back(now);
            }
        }
    }
}

impl Default for PolicyLimiter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn limiter() -> PolicyLimiter {
        PolicyLimiter {
            windows: HashMap::new(),
            pad: Duration::ZERO,
            seed_interval: Duration::from_secs(5),
            last_send: None,
        }
    }

    #[test]
    fn parses_real_poe2_search_header() {
        let t = parse_triplets("5:10:60,15:60:300,30:300:1800");
        assert_eq!(t, vec![(5, 10, 60), (15, 60, 300), (30, 300, 1800)]);
    }

    #[test]
    fn parse_triplets_skips_malformed() {
        assert_eq!(parse_triplets(""), vec![]);
        assert_eq!(parse_triplets("5:10"), vec![]); // incomplete triplet
        assert_eq!(parse_triplets("5:10:60,garbage"), vec![(5, 10, 60)]);
    }

    fn window(max: u32, period_s: u64) -> Window {
        Window { max, period: Duration::from_secs(period_s), hits: VecDeque::new() }
    }

    #[test]
    fn window_waits_when_full() {
        let base = Instant::now();
        let mut w = window(5, 10);
        for i in 0..5 {
            w.hits.push_back(base + Duration::from_secs(i));
        }
        // 5 hits within the 10s window at base+5 -> wait until oldest ages out.
        assert_eq!(w.until_ready(base + Duration::from_secs(5), Duration::ZERO), Duration::from_secs(5));
    }

    #[test]
    fn window_clears_after_period() {
        let base = Instant::now();
        let mut w = window(5, 10);
        for i in 0..5 {
            w.hits.push_back(base + Duration::from_secs(i));
        }
        // At base+11s the oldest hit is >10s old -> only 4 remain -> ready now.
        assert_eq!(w.until_ready(base + Duration::from_secs(11), Duration::ZERO), Duration::ZERO);
    }

    #[test]
    fn zero_max_window_never_ready_no_panic() {
        // Regression: a server "0:10:60" triplet must not panic via hits[len].
        let mut w = window(0, 10);
        assert_eq!(w.until_ready(Instant::now(), Duration::ZERO), Duration::MAX);
    }

    #[test]
    fn zero_max_triplet_is_ignored_on_ingest() {
        let mut p = limiter();
        let rh = RateHeaders {
            rules: vec!["Ip".into()],
            limits: HashMap::from([("Ip".to_string(), vec![(0, 10, 60)])]),
            states: HashMap::new(),
            retry_after: None,
        };
        let _ = p.update_from_headers(&rh);
        // No window created; with no prior send the cold-start seed adds no wait.
        assert_eq!(p.until_ready(Instant::now()), Duration::ZERO);
    }

    #[test]
    fn policy_binds_on_tightest_window() {
        let mut p = limiter();
        let rh = RateHeaders {
            rules: vec!["Ip".into()],
            limits: HashMap::from([("Ip".to_string(), vec![(5, 10, 60), (30, 300, 1800)])]),
            states: HashMap::new(),
            retry_after: None,
        };
        let synced = p.update_from_headers(&rh);
        let base = Instant::now();
        for _ in 0..5 {
            p.record_unsynced(base, &synced);
        }
        // 5/10s window is saturated; 30/300s is not -> bound by the tight one.
        assert_eq!(p.until_ready(base), Duration::from_secs(10));
    }

    #[test]
    fn state_sync_tops_up_recorded_usage() {
        let mut p = limiter();
        let rh = RateHeaders {
            rules: vec!["Ip".into()],
            limits: HashMap::from([("Ip".to_string(), vec![(5, 10, 60)])]),
            // server says we've already used 5 in the 10s window
            states: HashMap::from([("Ip".to_string(), vec![(5, 10, 0)])]),
            retry_after: None,
        };
        let _ = p.update_from_headers(&rh);
        assert!(p.until_ready(Instant::now()) > Duration::ZERO);
    }

    #[test]
    fn records_into_window_without_state_header() {
        // limit header present but NO -State -> request must still be counted.
        let mut p = limiter();
        let rh = RateHeaders {
            rules: vec!["Ip".into()],
            limits: HashMap::from([("Ip".to_string(), vec![(5, 10, 60)])]),
            states: HashMap::new(),
            retry_after: None,
        };
        let synced = p.update_from_headers(&rh);
        assert!(synced.is_empty());
        let base = Instant::now();
        for _ in 0..4 {
            p.record_unsynced(base, &synced);
        }
        assert_eq!(p.until_ready(base), Duration::ZERO); // 4 < 5
        p.record_unsynced(base, &synced); // 5th
        assert_eq!(p.until_ready(base), Duration::from_secs(10)); // now full
    }

    #[test]
    fn cold_start_seed_paces_before_headers() {
        let mut p = limiter();
        let base = Instant::now();
        p.note_send(base); // first request goes out, windows still empty
        // next request within seed_interval (5s) must wait the remainder
        assert_eq!(p.until_ready(base + Duration::from_secs(2)), Duration::from_secs(3));
        // after seed_interval, no wait
        assert_eq!(p.until_ready(base + Duration::from_secs(6)), Duration::ZERO);
    }
}
