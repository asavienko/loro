//! Hybrid logical clocks — the ordering mechanism for sync.
//!
//! Monotonic per device even when the wall clock jumps backwards (NTP correction,
//! manual change, timezone travel), and totally ordered across devices because
//! `node_id` breaks ties deterministically. That determinism is what lets two peers
//! reach the same merge outcome without coordinating.
//!
//! **Never shown to a learner.** Learner-facing day logic uses `local_day`
//! (see `crate::calendar`). Conflating the two is a bug class.
//!
//! See docs/architecture/sync-protocol.md#time

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

/// A hybrid logical clock reading: `<physical_ms>:<logical>:<node_id>`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, uniffi::Record)]
pub struct Hlc {
    /// Wall-clock milliseconds, monotonically non-decreasing.
    pub physical: i64,
    /// Tiebreaker within the same millisecond.
    pub logical: u32,
    /// Stable per installation.
    pub node_id: String,
}

impl Hlc {
    /// Parse the wire form `physical:logical:node`.
    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        let mut parts = s.split(':');
        let physical = parts.next()?.parse().ok()?;
        let logical = parts.next()?.parse().ok()?;
        let node_id = parts.next()?.to_string();
        if parts.next().is_some() || node_id.is_empty() {
            return None;
        }
        Some(Self {
            physical,
            logical,
            node_id,
        })
    }

    /// The wire form.
    #[must_use]
    pub fn encode(&self) -> String {
        format!("{}:{:04}:{}", self.physical, self.logical, self.node_id)
    }
}

impl PartialOrd for Hlc {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Hlc {
    fn cmp(&self, other: &Self) -> Ordering {
        self.physical
            .cmp(&other.physical)
            .then_with(|| self.logical.cmp(&other.logical))
            // Deterministic tiebreak, so both peers agree without coordinating.
            .then_with(|| self.node_id.cmp(&other.node_id))
    }
}

/// Advance the local clock for a new local event.
///
/// `wall_ms` is passed in — this crate has no clock.
#[must_use]
#[uniffi::export]
pub fn tick(last: &Hlc, wall_ms: i64, node_id: &str) -> Hlc {
    let physical = last.physical.max(wall_ms);
    let logical = if physical == last.physical {
        last.logical + 1
    } else {
        0
    };
    Hlc {
        physical,
        logical,
        node_id: node_id.to_string(),
    }
}

/// Advance the local clock on receiving a remote reading.
#[must_use]
#[uniffi::export]
pub fn receive(last: &Hlc, remote: &Hlc, wall_ms: i64, node_id: &str) -> Hlc {
    let physical = last.physical.max(remote.physical).max(wall_ms);
    let logical = if physical == last.physical && physical == remote.physical {
        last.logical.max(remote.logical) + 1
    } else if physical == last.physical {
        last.logical + 1
    } else if physical == remote.physical {
        remote.logical + 1
    } else {
        0
    };
    Hlc {
        physical,
        logical,
        node_id: node_id.to_string(),
    }
}

/// Hours of clock skew beyond which the client clamps toward server time.
///
/// A device whose clock is wildly wrong would otherwise win every conflict. We clamp
/// and log, but we never *reject* its writes — that would lose real learner data.
pub const MAX_SKEW_HOURS: i64 = 24;

/// Whether a client reading is implausibly far ahead of server time.
#[must_use]
#[uniffi::export]
pub fn is_skewed(client: &Hlc, server_ms: i64) -> bool {
    client.physical - server_ms > MAX_SKEW_HOURS * 3_600_000
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hlc(p: i64, l: u32, n: &str) -> Hlc {
        Hlc {
            physical: p,
            logical: l,
            node_id: n.into(),
        }
    }

    #[test]
    fn round_trips_through_the_wire_form() {
        let h = hlc(1_721_558_400_123, 7, "d3f9a1");
        assert_eq!(Hlc::parse(&h.encode()), Some(h));
    }

    #[test]
    fn rejects_malformed_readings() {
        assert!(Hlc::parse("nonsense").is_none());
        assert!(Hlc::parse("123:4").is_none());
        assert!(Hlc::parse("123:4:").is_none());
    }

    #[test]
    fn stays_monotonic_when_the_wall_clock_jumps_backwards() {
        let last = hlc(1_000_000, 3, "a");
        // NTP corrected the clock backwards by a minute.
        let next = tick(&last, 940_000, "a");
        assert!(next > last, "an HLC must never go backwards");
        assert_eq!(next.physical, 1_000_000);
        assert_eq!(next.logical, 4);
    }

    #[test]
    fn logical_resets_when_physical_advances() {
        let next = tick(&hlc(1_000, 9, "a"), 2_000, "a");
        assert_eq!((next.physical, next.logical), (2_000, 0));
    }

    #[test]
    fn receiving_a_future_reading_pulls_us_forward() {
        let local = hlc(1_000, 0, "a");
        let remote = hlc(5_000, 2, "b");
        let next = receive(&local, &remote, 1_000, "a");
        assert!(next > remote);
    }

    #[test]
    fn identical_physical_and_logical_is_broken_by_node_id_deterministically() {
        let a = hlc(1_000, 1, "aaa");
        let b = hlc(1_000, 1, "bbb");
        assert!(a < b);
        // Both peers compute the same answer, which is what makes merges converge.
        assert_eq!(a.cmp(&b), Ordering::Less);
        assert_eq!(b.cmp(&a), Ordering::Greater);
    }

    #[test]
    fn detects_absurd_client_skew() {
        let server = 1_721_558_400_000;
        assert!(!is_skewed(&hlc(server + 3_600_000, 0, "a"), server));
        assert!(is_skewed(&hlc(server + 48 * 3_600_000, 0, "a"), server));
    }
}
