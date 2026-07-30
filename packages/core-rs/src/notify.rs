//! The notification plan.
//!
//! This is pure and lives here so the entire notification policy — the daily cap, quiet
//! hours, conditionality, skip-if-practised — is **unit-tested** rather than emergent
//! from scheduling calls scattered across two platforms.
//!
//! That is what makes rule `N-04` ("no guilt, no streak-loss warnings, no
//! re-engagement bait") enforceable rather than aspirational.
//!
//! See docs/architecture/widgets-notifications.md#notifications

/// Hard daily cap across every category. Three a day is already a lot.
pub const MAX_PER_DAY: u32 = 3;
/// Quiet hours start (local hour).
pub const QUIET_START_HOUR: u32 = 22;
/// Quiet hours end (local hour).
pub const QUIET_END_HOUR: u32 = 7;

/// Reveal-mode fallbacks before the language-pack prompt is offered.
///
/// Three, not one: a single fallback is a fluke, and prompting on it would be exactly the
/// re-engagement bait rule `N-04` forbids. Three is a pattern worth a suggestion.
const REVEAL_MODE_THRESHOLD: u32 = 3;

/// Notification categories. Each is individually opt-out.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum Category {
    /// One a day, at a learner-chosen time. On by default.
    DailyReminder,
    /// Loop B wave nudges. **Off by default**, and conditional.
    WaveNudge,
    /// A trip drop unlocked.
    TripDrop,
    /// Crossing a trip readiness milestone.
    TripMilestone,
    /// The morning of arrival.
    Arrival,
    /// Return date reached.
    Return,
    /// On-device speech unavailable and reveal mode has been hit repeatedly.
    LanguagePack,
}

/// What the scheduler needs to know. All of it is available offline.
#[derive(Debug, Clone, uniffi::Record)]
pub struct NotifyContext {
    /// Local hour now, 0..23.
    pub hour: u32,
    /// Has the learner already practised today?
    pub practised_today: bool,
    /// Was the previous wave completed? Gates the next wave nudge.
    pub previous_wave_completed: bool,
    /// Which categories the learner has enabled.
    pub enabled: Vec<Category>,
    /// Already scheduled today.
    pub already_scheduled: u32,
    /// Is a trip active?
    pub trip_active: bool,
    /// Reveal-mode fallbacks recently, for the language-pack prompt.
    pub reveal_mode_count: u32,
}

/// One planned notification.
#[derive(Debug, Clone, uniffi::Record)]
pub struct PlannedNotification {
    /// Its category.
    pub category: Category,
    /// Local hour to fire at.
    pub hour: u32,
    /// Local minute.
    pub minute: u32,
    /// Deep link, so it lands on the right surface rather than the home screen.
    pub deep_link: String,
}

/// Whether an hour falls in quiet hours.
#[must_use]
#[uniffi::export]
pub fn is_quiet_hour(hour: u32) -> bool {
    !(QUIET_END_HOUR..QUIET_START_HOUR).contains(&hour)
}

/// Whether a category may fire, given the context.
#[must_use]
#[uniffi::export]
pub fn may_fire(category: Category, ctx: &NotifyContext) -> bool {
    if ctx.already_scheduled >= MAX_PER_DAY {
        return false;
    }
    if !ctx.enabled.contains(&category) {
        return false;
    }
    if is_quiet_hour(ctx.hour) {
        return false;
    }

    match category {
        // Don't remind someone who has already practised.
        Category::DailyReminder => !ctx.practised_today,
        // Only nudge someone who has shown up today. Never nag someone who has
        // clearly decided not to practise.
        Category::WaveNudge => ctx.previous_wave_completed,
        Category::TripDrop | Category::TripMilestone | Category::Arrival | Category::Return => {
            ctx.trip_active
        }
        Category::LanguagePack => ctx.reveal_mode_count >= REVEAL_MODE_THRESHOLD,
    }
}

/// The deep link for a category. A notification that opens the home screen has wasted
/// the learner's attention.
#[must_use]
#[uniffi::export]
pub fn deep_link_for(category: Category) -> String {
    match category {
        Category::DailyReminder => "loro://practice",
        Category::WaveNudge => "loro://practice/refrain",
        Category::TripDrop => "loro://trip/drop",
        Category::TripMilestone => "loro://trip",
        Category::Arrival => "loro://trip/survival",
        Category::Return => "loro://trip/souvenir",
        Category::LanguagePack => "loro://settings/speech",
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every category. Written once, so a new one can't be added without every policy
    /// test below covering it.
    const ALL: [Category; 7] = [
        Category::DailyReminder,
        Category::WaveNudge,
        Category::TripDrop,
        Category::TripMilestone,
        Category::Arrival,
        Category::Return,
        Category::LanguagePack,
    ];

    /// A context in which every category is *permitted*, so each test can switch off the
    /// one thing it is about and watch the answer change.
    fn ctx() -> NotifyContext {
        NotifyContext {
            hour: 9,
            practised_today: false,
            previous_wave_completed: true,
            enabled: ALL.to_vec(),
            already_scheduled: 0,
            trip_active: true,
            reveal_mode_count: REVEAL_MODE_THRESHOLD,
        }
    }

    #[test]
    fn quiet_hours_span_midnight() {
        for hour in 0..24 {
            let quiet = !(QUIET_END_HOUR..QUIET_START_HOUR).contains(&hour);
            assert_eq!(is_quiet_hour(hour), quiet, "hour {hour}");
        }
        // Pinned, not just self-consistent: 22:00 through 06:59 is quiet.
        assert!(is_quiet_hour(22) && is_quiet_hour(23) && is_quiet_hour(0));
        assert!(is_quiet_hour(6) && !is_quiet_hour(7) && !is_quiet_hour(21));
    }

    #[test]
    fn every_category_is_permitted_in_the_baseline_context() {
        // Otherwise a test that expects `false` could be passing for the wrong reason.
        let c = ctx();
        for cat in ALL {
            assert!(may_fire(cat, &c), "{cat:?} should be allowed at 09:00");
        }
    }

    #[test]
    fn nothing_fires_during_quiet_hours() {
        let mut c = ctx();
        for hour in (QUIET_START_HOUR..24).chain(0..QUIET_END_HOUR) {
            c.hour = hour;
            for cat in ALL {
                assert!(!may_fire(cat, &c), "{cat:?} at {hour}:00");
            }
        }
    }

    #[test]
    fn the_daily_cap_is_absolute() {
        let mut c = ctx();
        c.already_scheduled = MAX_PER_DAY;
        for cat in ALL {
            assert!(!may_fire(cat, &c), "{cat:?} past the cap");
        }
        // One below the cap still fires; the cap is a ceiling, not an off switch.
        c.already_scheduled = MAX_PER_DAY - 1;
        assert!(may_fire(Category::DailyReminder, &c));
    }

    #[test]
    fn we_do_not_remind_someone_who_already_practised() {
        let mut c = ctx();
        c.practised_today = true;
        assert!(!may_fire(Category::DailyReminder, &c));
    }

    #[test]
    fn a_wave_nudge_only_follows_a_completed_wave() {
        let mut c = ctx();
        c.previous_wave_completed = false;
        assert!(
            !may_fire(Category::WaveNudge, &c),
            "never nag someone who has opted out of today"
        );
        c.previous_wave_completed = true;
        assert!(may_fire(Category::WaveNudge, &c));
    }

    #[test]
    fn a_disabled_category_never_fires() {
        let mut c = ctx();
        c.enabled = vec![];
        for cat in ALL {
            assert!(!may_fire(cat, &c), "{cat:?} while opted out");
        }
        // Opting one in doesn't opt the others in — each is individually opt-out.
        c.enabled = vec![Category::DailyReminder];
        assert!(may_fire(Category::DailyReminder, &c));
        assert!(!may_fire(Category::WaveNudge, &c));
    }

    #[test]
    fn trip_notifications_need_an_active_trip() {
        let mut c = ctx();
        c.trip_active = false;
        for cat in [
            Category::TripDrop,
            Category::TripMilestone,
            Category::Arrival,
            Category::Return,
        ] {
            assert!(!may_fire(cat, &c), "{cat:?} without a trip");
        }
        // The non-trip categories are unaffected.
        assert!(may_fire(Category::DailyReminder, &c));
    }

    #[test]
    fn the_language_pack_prompt_waits_for_repeated_fallbacks() {
        let mut c = ctx();
        for count in 0..REVEAL_MODE_THRESHOLD {
            c.reveal_mode_count = count;
            assert!(!may_fire(Category::LanguagePack, &c), "after {count}");
        }
        c.reveal_mode_count = REVEAL_MODE_THRESHOLD;
        assert!(may_fire(Category::LanguagePack, &c));
    }

    #[test]
    fn every_category_lands_on_a_specific_surface() {
        let mut seen: Vec<String> = Vec::new();
        for cat in ALL {
            let link = deep_link_for(cat);
            assert!(link.starts_with("loro://"), "{cat:?} → {link}");
            assert_ne!(
                link, "loro://",
                "a notification must not open the home screen"
            );
            // Two categories sharing a link would waste one of them.
            assert!(!seen.contains(&link), "{cat:?} reuses {link}");
            seen.push(link);
        }
    }
}
