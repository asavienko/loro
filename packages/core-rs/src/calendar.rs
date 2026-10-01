//! Day boundaries, streaks, and the grace window.
//!
//! Everything here uses the device's **local** calendar date, never UTC, so trip
//! transitions and day rollover work offline. Distinct from HLC, which orders sync
//! operations and is never shown to a learner.

use crate::units::{MS_PER_DAY, MS_PER_HOUR};

/// A local calendar date, `YYYY-MM-DD`.
pub type LocalDay = String;

/// Hours after midnight during which practice still counts for the previous day.
///
/// Practising at 01:30 counts for yesterday. The alternative punishes night owls,
/// and we don't punish.
pub const STREAK_GRACE_HOURS: u32 = 4;

/// The `local_day` a timestamp belongs to for streak purposes, applying the grace window.
///
/// Both arguments are **local wall-clock ms** — epoch ms shifted by the device's UTC
/// offset, so that dividing by a day lands on the learner's calendar date rather than
/// UTC's. The shift happens at the edge (`apps/mobile/src/lib/clock.ts`) because this
/// crate has no clock and no timezone database.
#[must_use]
#[uniffi::export]
pub fn streak_day_for(at_ms: i64, local_midnight_ms: i64) -> LocalDay {
    let grace_ms = i64::from(STREAK_GRACE_HOURS) * MS_PER_HOUR;
    let effective = if at_ms < local_midnight_ms + grace_ms {
        // Within the grace window: count it for the previous day.
        at_ms - grace_ms
    } else {
        at_ms
    };
    format_ymd(effective)
}

/// Days between two local dates, positive if `b` is later. Calendar days, not elapsed hours.
///
/// # Errors
/// Returns `None` if either string is not `YYYY-MM-DD`.
#[must_use]
#[uniffi::export]
pub fn days_between(a: &str, b: &str) -> Option<i32> {
    Some(julian(b)? - julian(a)?)
}

/// Whether a streak survives, given the last practised day and today.
///
/// A gap of 0 (same day) or 1 (yesterday) keeps the streak. Anything larger breaks it.
///
/// **Timezone travel never breaks a streak**: a negative gap (flying west, so the local
/// date moved backwards) is treated as the same day.
#[must_use]
#[uniffi::export]
pub fn streak_survives(last_day: &str, today: &str) -> bool {
    match days_between(last_day, today) {
        Some(gap) => gap <= 1,
        None => false,
    }
}

/// The current streak length, from the set of days the learner practised.
///
/// `practice_days` need not be sorted or deduped. A gap of more than one calendar day
/// ends the run. A streak whose last day is yesterday is still alive and still counted:
/// today is not over, and nothing here shames a missed day (non-negotiable #3).
///
/// Unparseable days are **dropped, not treated as a gap**. They sort after every real
/// date (`'n' > '2'`), so counting them would let one corrupt row zero a streak the
/// learner earned.
#[must_use]
#[uniffi::export]
pub fn streak(practice_days: &[String], today: &str) -> u32 {
    let mut days: Vec<&str> = practice_days
        .iter()
        .map(String::as_str)
        .filter(|d| julian(d).is_some())
        .collect();
    days.sort_unstable();
    days.dedup();

    let Some(last) = days.last().copied() else {
        return 0;
    };
    if !streak_survives(last, today) {
        return 0;
    }

    let mut count: u32 = 1;
    let mut cursor = last;
    for day in days.iter().rev().skip(1) {
        if days_between(day, cursor) != Some(1) {
            break;
        }
        count += 1;
        cursor = *day;
    }
    count
}

/// Parse `YYYY-MM-DD` into a day number, for differencing.
// Fliegel–Van Flandern uses single-letter names by convention; renaming them would
// make the algorithm harder to check against the published form.
#[allow(clippy::many_single_char_names)]
fn julian(s: &str) -> Option<i32> {
    let mut parts = s.split('-');
    let y: i32 = parts.next()?.parse().ok()?;
    let m: i32 = parts.next()?.parse().ok()?;
    let d: i32 = parts.next()?.parse().ok()?;
    if parts.next().is_some() || !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    // Fliegel–Van Flandern, valid for all dates we care about.
    let a = (14 - m) / 12;
    let y2 = y + 4800 - a;
    let m2 = m + 12 * a - 3;
    Some(d + (153 * m2 + 2) / 5 + 365 * y2 + y2 / 4 - y2 / 100 + y2 / 400 - 32_045)
}

/// Format epoch ms as `YYYY-MM-DD`, treating the input as already-local ms.
fn format_ymd(ms: i64) -> String {
    let days = ms.div_euclid(MS_PER_DAY);
    let (y, m, d) = from_days(days);
    format!("{y:04}-{m:02}-{d:02}")
}

/// The Julian day number of 1970-01-01 — the offset between the Unix epoch day count and
/// the Julian day count the Fliegel–Van Flandern arithmetic below works in.
///
/// Not one of the algorithm's own constants; a calendar fact.
const EPOCH_JULIAN_DAY: i64 = 2_440_588;

/// Inverse of `julian`, for the Unix epoch day count.
fn from_days(days_since_epoch: i64) -> (i32, u32, u32) {
    let jd = days_since_epoch + EPOCH_JULIAN_DAY;
    let a = jd + 32_044;
    let b = (4 * a + 3) / 146_097;
    let c = a - 146_097 * b / 4;
    let dd = (4 * c + 3) / 1461;
    let e = c - 1461 * dd / 4;
    let mm = (5 * e + 2) / 153;
    let day = e - (153 * mm + 2) / 5 + 1;
    let month = mm + 3 - 12 * (mm / 10);
    let year = 100 * b + dd - 4800 + mm / 10;
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    (year as i32, month as u32, day as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn days_between_handles_month_and_year_boundaries() {
        for (a, b, expect, why) in [
            ("2026-06-30", "2026-07-01", 1, "across a month"),
            ("2026-12-31", "2027-01-01", 1, "across a year"),
            ("2026-02-28", "2026-03-01", 1, "February, not a leap year"),
            ("2028-02-28", "2028-03-01", 2, "February, leap year"),
            ("2026-07-01", "2026-06-30", -1, "backwards"),
            ("2026-07-01", "2026-07-01", 0, "the same day"),
            ("2026-01-01", "2027-01-01", 365, "a whole non-leap year"),
            ("2028-01-01", "2029-01-01", 366, "a whole leap year"),
        ] {
            assert_eq!(days_between(a, b), Some(expect), "{a} → {b}: {why}");
        }
    }

    #[test]
    fn malformed_dates_are_rejected_not_guessed() {
        for bad in [
            "nonsense",
            "2026-13-01", // month out of range
            "2026-00-01", // month zero
            "2026-07-32", // day out of range
            "2026-07-00", // day zero
            "2026-07-01-02",
            "2026-07",
            "",
        ] {
            assert_eq!(days_between(bad, "2026-07-01"), None, "as `a`: {bad:?}");
            assert_eq!(days_between("2026-07-01", bad), None, "as `b`: {bad:?}");
        }
    }

    #[test]
    fn a_streak_survives_yesterday_but_not_the_day_before() {
        assert!(streak_survives("2026-07-27", "2026-07-28"));
        assert!(streak_survives("2026-07-28", "2026-07-28"));
        assert!(!streak_survives("2026-07-26", "2026-07-28"));
    }

    #[test]
    fn an_unparseable_day_never_keeps_a_streak_alive() {
        assert!(!streak_survives("nonsense", "2026-07-28"));
        assert!(!streak_survives("2026-07-28", "nonsense"));
    }

    #[test]
    fn timezone_travel_westwards_never_breaks_a_streak() {
        // The local date moved backwards after a long westbound flight.
        assert!(streak_survives("2026-07-28", "2026-07-27"));
    }

    #[test]
    fn practice_inside_the_grace_window_counts_for_the_previous_day() {
        let midnight = 1_753_660_800_000; // some local midnight
        let at = |ms| streak_day_for(midnight + ms, midnight);
        let today = at(6 * MS_PER_HOUR);

        // Stronger than "the two differ": exactly one calendar day earlier.
        assert_eq!(
            days_between(&at(90 * 60 * 1_000), &today),
            Some(1),
            "01:30 counts for the previous day; 06:00 for today"
        );

        // The window closes exactly at STREAK_GRACE_HOURS, not a millisecond either side.
        let grace_ms = i64::from(STREAK_GRACE_HOURS) * MS_PER_HOUR;
        assert_eq!(
            days_between(&at(grace_ms - 1), &today),
            Some(1),
            "the last millisecond of the grace window is still yesterday"
        );
        assert_eq!(
            at(grace_ms),
            today,
            "the first millisecond after it is today"
        );
    }

    #[test]
    fn round_trip_through_the_day_number() {
        for date in [
            "1970-01-01",
            "2026-07-28",
            "2027-02-28",
            "2028-02-29",
            "2099-12-31",
        ] {
            let n = julian(date).expect("valid");
            let back = days_between("1970-01-01", date).expect("valid");
            assert_eq!(n - julian("1970-01-01").unwrap(), back);
        }
    }
}
