//! The five-rung ladder, the need score, and the Loop C draw.
//!
//! The ladder is the most pedagogically defensible progress model in the blueprint —
//! Accumulated → Bent → Transferred → Pressure-tested → Deployed is a real competence
//! hierarchy. It's maintained from v1 by whichever engine is active, so the Phrasebook
//! has real data on its first day (see ADR-0006).
//!
//! See docs/architecture/scheduling.md#4--the-ladder--loop-c

use crate::{LadderRung, PhraseState};

/// Days without practice after which a phrase is considered stale.
pub const STALE_DAYS: i64 = 14;

impl LadderRung {
    /// The rung as a 0..4 index.
    #[must_use]
    pub const fn index(self) -> u8 {
        match self {
            Self::Accumulated => 0,
            Self::Bent => 1,
            Self::Transferred => 2,
            Self::PressureTested => 3,
            Self::Deployed => 4,
        }
    }

    /// From an index, saturating at Deployed.
    #[must_use]
    pub const fn from_index(i: u8) -> Self {
        match i {
            0 => Self::Accumulated,
            1 => Self::Bent,
            2 => Self::Transferred,
            3 => Self::PressureTested,
            _ => Self::Deployed,
        }
    }

    /// The next rung up. Deployed stays Deployed — "you only climb or hold."
    #[must_use]
    pub const fn climbed(self) -> Self {
        Self::from_index(self.index() + 1)
    }
}

/// Advance a phrase's rung, never downwards.
///
/// This is the monotonicity guarantee the conformance suite checks.
#[must_use]
#[uniffi::export]
pub fn climb(current: LadderRung, target: LadderRung) -> LadderRung {
    if target.index() > current.index() {
        target
    } else {
        current
    }
}

/// How much a phrase needs attention. Biases the draw and drives the `refresh` flags.
///
/// From the blueprint (`Loro.dc.html:3467`): `need = stale×2 + stumbles`.
#[must_use]
#[uniffi::export]
pub fn need(p: &PhraseState, now_ms: i64) -> u32 {
    let stale = match p.last_practiced_at {
        Some(t) => {
            let days = (now_ms - t) / 86_400_000;
            u32::from(days > STALE_DAYS) * 2
        }
        // Never practised is stale by definition.
        None => 2,
    };
    stale + p.stumbles
}

/// The four finisher cards. Each advances one specific rung.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum FinisherCard {
    /// "the Rally" — make it pliable. Accumulated → Bent.
    Bend,
    /// "the Curveball" — make it travel. Bent → Transferred.
    Transfer,
    /// "the Gauntlet" — make it survive. Transferred → Pressure-tested.
    Pressure,
    /// "the Sportscaster" — make it yours. Pressure-tested → Deployed.
    Deploy,
}

impl FinisherCard {
    /// The rung a phrase must be at for this card to target it.
    #[must_use]
    pub const fn source_rung(self) -> u8 {
        match self {
            Self::Bend => 0,
            Self::Transfer => 1,
            Self::Pressure => 2,
            Self::Deploy => 3,
        }
    }

    /// The rung the target climbs to.
    #[must_use]
    pub const fn advances_to(self) -> LadderRung {
        LadderRung::from_index(self.source_rung() + 1)
    }

    /// All four, in ladder order.
    #[must_use]
    pub const fn all() -> [Self; 4] {
        [Self::Bend, Self::Transfer, Self::Pressure, Self::Deploy]
    }
}

/// The outcome of a draw.
#[derive(Debug, Clone, uniffi::Record)]
pub struct Draw {
    /// The dealt card.
    pub card: FinisherCard,
    /// The phrase it targets.
    pub target_id: String,
}

/// The Draw — a real shuffle, constrained to what phrases are ready for and biased
/// toward weak spots.
///
/// From the blueprint (`Loro.dc.html:3479–3488`). Deterministic given `seed`, which is
/// persisted on the run row so any run can be replayed exactly in a test or a bug report.
///
/// Returns `None` when the deck has nothing eligible — a brand-new deck with no phrase
/// at any unlocked card's source rung.
#[must_use]
#[uniffi::export]
pub fn draw(
    deck: &[PhraseState],
    seed: u64,
    exclude: Option<FinisherCard>,
    now_ms: i64,
) -> Option<Draw> {
    let max_rung = deck.iter().map(|p| p.rung.index()).max().unwrap_or(0);

    let eligible: Vec<FinisherCard> = FinisherCard::all()
        .into_iter()
        .filter(|c| Some(*c) != exclude)
        // A card unlocks once the deck has reached its source rung.
        .filter(|c| c.source_rung() == 0 || max_rung >= c.source_rung())
        .filter(|c| deck.iter().any(|p| p.rung.index() == c.source_rung()))
        .collect();

    let mut rng = Lcg::new(seed);

    let card = eligible.into_iter().max_by_key(|c| {
        let total: u32 = deck
            .iter()
            .filter(|p| p.rung.index() == c.source_rung())
            .map(|p| need(p, now_ms) + 1)
            .sum();
        // Weight by total need, with a small random term so the draw feels like a draw.
        total * 100 + rng.next_range(200)
    })?;

    let target = deck
        .iter()
        .filter(|p| p.rung.index() == card.source_rung())
        .max_by_key(|p| (need(p, now_ms), p.id.clone()))?;

    Some(Draw {
        card,
        target_id: target.id.clone(),
    })
}

/// A small deterministic PRNG. The crate takes no ambient randomness.
struct Lcg(u64);

impl Lcg {
    const fn new(seed: u64) -> Self {
        Self(seed ^ 0x9E37_79B9_7F4A_7C15)
    }
    fn next_u32(&mut self) -> u32 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        #[allow(clippy::cast_possible_truncation)]
        ((self.0 >> 33) as u32)
    }
    fn next_range(&mut self, n: u32) -> u32 {
        if n == 0 {
            0
        } else {
            self.next_u32() % n
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Difficulty;

    fn phrase(id: &str, rung: LadderRung, stumbles: u32, last: Option<i64>) -> PhraseState {
        PhraseState {
            id: id.into(),
            difficulty: Difficulty::Med,
            tags: vec![],
            loved: false,
            learned: false,
            plays: 0,
            reps: 0,
            last_practiced_at: last,
            srs_due: None,
            srs_stability: None,
            srs_difficulty: None,
            reps_today: 0,
            reps_today_day: None,
            lock_in_days: 0,
            rung,
            stumbles,
            cue_level: 0,
        }
    }

    const NOW: i64 = 1_753_660_800_000;
    const RECENT: i64 = NOW - 86_400_000;

    #[test]
    fn a_rung_never_goes_down() {
        assert_eq!(
            climb(LadderRung::Transferred, LadderRung::Bent),
            LadderRung::Transferred
        );
        assert_eq!(
            climb(LadderRung::Bent, LadderRung::Transferred),
            LadderRung::Transferred
        );
    }

    #[test]
    fn deployed_is_the_ceiling() {
        assert_eq!(LadderRung::Deployed.climbed(), LadderRung::Deployed);
    }

    #[test]
    fn need_combines_staleness_and_stumbles() {
        let fresh = phrase("f", LadderRung::Accumulated, 0, Some(RECENT));
        let stale = phrase("s", LadderRung::Accumulated, 0, Some(NOW - 30 * 86_400_000));
        let stumbling = phrase("t", LadderRung::Accumulated, 3, Some(RECENT));
        assert_eq!(need(&fresh, NOW), 0);
        assert_eq!(need(&stale, NOW), 2);
        assert_eq!(need(&stumbling, NOW), 3);
    }

    #[test]
    fn never_practised_counts_as_stale() {
        assert_eq!(need(&phrase("n", LadderRung::Accumulated, 0, None), NOW), 2);
    }

    #[test]
    fn a_card_is_only_eligible_if_the_deck_has_a_phrase_at_its_source_rung() {
        // Everything is at Accumulated, so only Bend can be drawn.
        let deck = vec![
            phrase("a", LadderRung::Accumulated, 0, Some(RECENT)),
            phrase("b", LadderRung::Accumulated, 1, Some(RECENT)),
        ];
        for seed in 0..50 {
            let d = draw(&deck, seed, None, NOW).expect("Bend is always eligible here");
            assert_eq!(d.card, FinisherCard::Bend);
        }
    }

    #[test]
    fn the_draw_targets_the_neediest_candidate() {
        let deck = vec![
            phrase("easy", LadderRung::Accumulated, 0, Some(RECENT)),
            phrase("needy", LadderRung::Accumulated, 4, Some(RECENT)),
        ];
        let d = draw(&deck, 7, None, NOW).expect("eligible");
        assert_eq!(d.target_id, "needy");
    }

    #[test]
    fn the_draw_is_deterministic_from_a_seed() {
        let deck = vec![
            phrase("a", LadderRung::Accumulated, 0, Some(RECENT)),
            phrase("b", LadderRung::Bent, 2, Some(RECENT)),
            phrase("c", LadderRung::Transferred, 1, Some(RECENT)),
        ];
        let first = draw(&deck, 42, None, NOW).unwrap();
        let again = draw(&deck, 42, None, NOW).unwrap();
        assert_eq!(first.card, again.card);
        assert_eq!(first.target_id, again.target_id);
    }

    #[test]
    fn a_redraw_excludes_the_card_just_dealt() {
        let deck = vec![
            phrase("a", LadderRung::Accumulated, 0, Some(RECENT)),
            phrase("b", LadderRung::Bent, 5, Some(RECENT)),
        ];
        let first = draw(&deck, 3, None, NOW).unwrap();
        let second = draw(&deck, 3, Some(first.card), NOW).unwrap();
        assert_ne!(first.card, second.card);
    }

    #[test]
    fn an_empty_deck_draws_nothing_rather_than_panicking() {
        assert!(draw(&[], 1, None, NOW).is_none());
    }
}
