//! Millisecond unit constants, so no module re-derives them from a bare literal.
//!
//! Deliberately its own module rather than a corner of `calendar`. `sync::hlc` needs
//! `MS_PER_HOUR` for skew detection, and its header warns that conflating logical
//! ordering with the learner's calendar is a bug class — importing an hour from
//! `calendar` would be exactly that conflation. A unit is neither.
//!
//! `pub(crate)`: these are arithmetic, not part of the FFI surface.

/// Milliseconds in an hour.
pub(crate) const MS_PER_HOUR: i64 = 3_600_000;

/// Milliseconds in a day. A *nominal* day — this crate is handed local wall-clock ms
/// and never performs a timezone conversion, so a DST day is still 86 400 000 here.
/// The shift happens at the edge (`apps/mobile/src/lib/clock.ts`).
pub(crate) const MS_PER_DAY: i64 = 86_400_000;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_units_agree_with_each_other() {
        assert_eq!(MS_PER_DAY, 24 * MS_PER_HOUR);
        assert_eq!(MS_PER_HOUR, 60 * 60 * 1_000);
    }
}
