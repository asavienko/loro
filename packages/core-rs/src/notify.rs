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

/// One notification the platform is considering for this local day.
///
/// The platform resolves timezone and daylight-saving-time rules into `delivery_at_ms` before
/// calling this pure planner. Rust deliberately receives that resolved instant rather than trying
/// to maintain a second timezone database. `hour` and `minute` preserve the local wall-clock
/// value so quiet-hours policy remains visible and testable here.
#[derive(Debug, Clone, uniffi::Record)]
pub struct NotificationCandidate {
    /// Stable identifier used by the platform to replace or cancel a scheduled notification.
    pub id: String,
    /// The semantic category that owns the policy and translated copy.
    pub category: Category,
    /// Resolved delivery instant in epoch milliseconds.
    pub delivery_at_ms: i64,
    /// Local wall-clock hour at delivery, 0..23.
    pub hour: u32,
    /// Local wall-clock minute at delivery, 0..59.
    pub minute: u32,
    /// Whether the category's destination is built and can safely receive a deep link.
    pub destination_available: bool,
}

/// One planned notification.
#[derive(Debug, Clone, uniffi::Record)]
pub struct PlannedNotification {
    /// Stable identifier passed to the platform scheduler.
    pub id: String,
    /// Its category.
    pub category: Category,
    /// Resolved delivery instant in epoch milliseconds.
    pub delivery_at_ms: i64,
    /// Local hour to fire at.
    pub hour: u32,
    /// Local minute.
    pub minute: u32,
    /// Semantic copy key. The platform translates this at delivery; no learner copy lives in Rust.
    pub copy_key: String,
    /// Deep link, so it lands on the right surface rather than the home screen.
    pub deep_link: String,
    /// Native adapters must suppress presentation while the app is foregrounded.
    pub suppress_when_foreground: bool,
}

/// A malformed notification candidate is a programming error, never a reason to guess a schedule.
#[derive(Debug, uniffi::Error)]
pub enum NotificationPlanError {
    /// A candidate cannot be safely handed to an operating-system scheduler.
    InvalidCandidate {
        /// Actionable validation failure.
        reason: String,
    },
}

impl std::fmt::Display for NotificationPlanError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidCandidate { reason } => f.write_str(reason),
        }
    }
}
impl std::error::Error for NotificationPlanError {}

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
        Category::DailyReminder => "loro://practice/stream",
        Category::WaveNudge => "loro://practice/stream?wave=midday",
        Category::TripDrop => "loro://trip/drop",
        Category::TripMilestone => "loro://trip",
        Category::Arrival => "loro://trip/survival",
        Category::Return => "loro://trip/souvenir",
        Category::LanguagePack => "loro://settings/speech",
    }
    .to_string()
}

/// The semantic copy key for a notification category.
///
/// This deliberately returns a key rather than learner-facing text. Native adapters resolve the
/// key through the same bundled copy resources as the app at delivery time.
#[must_use]
#[uniffi::export]
pub fn copy_key_for(category: Category) -> String {
    match category {
        Category::DailyReminder => "notifications.dailyReminder",
        Category::WaveNudge => "notifications.waveNudge",
        Category::TripDrop => "notifications.tripDrop",
        Category::TripMilestone => "notifications.tripMilestone",
        Category::Arrival => "notifications.arrival",
        Category::Return => "notifications.return",
        Category::LanguagePack => "notifications.languagePack",
    }
    .to_string()
}

/// Select the safe subset of locally resolved notification candidates.
///
/// The platform owns calculating real delivery instants, handling permission state, replacing or
/// cancelling the returned stable IDs, and suppressing foreground presentation. This function owns
/// only shared policy: category opt-outs, quiet hours, conditionality, route availability and the
/// absolute per-day cap. It has no trip lifecycle semantics, so a caller may simply omit trip
/// candidates until Q-07 is resolved.
///
/// # Errors
/// Returns an error for malformed or duplicate candidate identifiers instead of guessing which OS
/// schedule to replace.
#[uniffi::export]
pub fn plan_notifications(
    ctx: &NotifyContext,
    candidates: Vec<NotificationCandidate>,
) -> Result<Vec<PlannedNotification>, NotificationPlanError> {
    let mut seen = std::collections::HashSet::new();
    for candidate in &candidates {
        if candidate.id.is_empty() {
            return Err(NotificationPlanError::InvalidCandidate {
                reason: "Notification candidate ID must not be empty".to_string(),
            });
        }
        if !seen.insert(&candidate.id) {
            return Err(NotificationPlanError::InvalidCandidate {
                reason: format!("Duplicate notification candidate ID: {}", candidate.id),
            });
        }
        if candidate.delivery_at_ms < 0 {
            return Err(NotificationPlanError::InvalidCandidate {
                reason: "Notification delivery time must be non-negative".to_string(),
            });
        }
        if candidate.hour > 23 || candidate.minute > 59 {
            return Err(NotificationPlanError::InvalidCandidate {
                reason: "Notification local time must be a valid hour and minute".to_string(),
            });
        }
    }

    let mut ordered = candidates;
    ordered.sort_by(|a, b| {
        a.delivery_at_ms
            .cmp(&b.delivery_at_ms)
            .then_with(|| a.id.cmp(&b.id))
    });

    let mut scheduled = Vec::new();
    let mut policy = ctx.clone();
    for candidate in ordered {
        if !candidate.destination_available {
            continue;
        }
        policy.hour = candidate.hour;
        if !may_fire(candidate.category, &policy) {
            continue;
        }
        scheduled.push(PlannedNotification {
            id: candidate.id,
            category: candidate.category,
            delivery_at_ms: candidate.delivery_at_ms,
            hour: candidate.hour,
            minute: candidate.minute,
            copy_key: copy_key_for(candidate.category),
            deep_link: deep_link_for(candidate.category),
            suppress_when_foreground: true,
        });
        policy.already_scheduled += 1;
    }
    Ok(scheduled)
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

    fn candidate(
        id: &str,
        category: Category,
        delivery_at_ms: i64,
        hour: u32,
    ) -> NotificationCandidate {
        NotificationCandidate {
            id: id.to_string(),
            category,
            delivery_at_ms,
            hour,
            minute: 15,
            destination_available: true,
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
    fn daily_reminder_and_wave_nudge_open_stream() {
        assert_eq!(
            deep_link_for(Category::DailyReminder),
            "loro://practice/stream"
        );
        assert_eq!(
            deep_link_for(Category::WaveNudge),
            "loro://practice/stream?wave=midday"
        );
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

    #[test]
    fn planner_orders_safe_candidates_and_preserves_scheduler_contract() {
        let plan = plan_notifications(
            &ctx(),
            vec![
                candidate("wave", Category::WaveNudge, 1_800, 13),
                candidate("daily", Category::DailyReminder, 900, 9),
            ],
        )
        .expect("valid candidates plan");

        assert_eq!(
            plan.iter().map(|item| item.id.as_str()).collect::<Vec<_>>(),
            ["daily", "wave"]
        );
        assert_eq!(plan[0].delivery_at_ms, 900);
        assert_eq!(plan[0].copy_key, "notifications.dailyReminder");
        assert_eq!(plan[0].deep_link, "loro://practice/stream");
        assert!(plan.iter().all(|item| item.suppress_when_foreground));
    }

    #[test]
    fn planner_applies_cap_quiet_hours_and_destination_availability_per_candidate() {
        let mut c = ctx();
        c.already_scheduled = MAX_PER_DAY - 1;
        let mut unavailable = candidate("unavailable", Category::DailyReminder, 100, 9);
        unavailable.destination_available = false;
        let plan = plan_notifications(
            &c,
            vec![
                unavailable,
                candidate("quiet", Category::WaveNudge, 200, QUIET_START_HOUR),
                candidate("one-left", Category::DailyReminder, 300, 9),
                candidate("past-cap", Category::LanguagePack, 400, 10),
            ],
        )
        .expect("valid candidates plan");

        assert_eq!(
            plan.iter().map(|item| item.id.as_str()).collect::<Vec<_>>(),
            ["one-left"]
        );
    }

    #[test]
    fn planner_rejects_ambiguous_or_invalid_platform_requests() {
        let duplicate = plan_notifications(
            &ctx(),
            vec![
                candidate("same", Category::DailyReminder, 100, 9),
                candidate("same", Category::WaveNudge, 200, 10),
            ],
        );
        assert!(matches!(
            duplicate,
            Err(NotificationPlanError::InvalidCandidate { .. })
        ));

        let mut invalid_time = candidate("bad-time", Category::DailyReminder, 100, 24);
        invalid_time.minute = 60;
        let invalid = plan_notifications(&ctx(), vec![invalid_time]);
        assert!(matches!(
            invalid,
            Err(NotificationPlanError::InvalidCandidate { .. })
        ));
    }
}
