//! The five-rung ladder, the need score, and the Loop C draw.
//!
//! The ladder is the most pedagogically defensible progress model in the blueprint —
//! Accumulated → Bent → Transferred → Pressure-tested → Deployed is a real competence
//! hierarchy. It's maintained from v1 by whichever engine is active, so the Phrasebook
//! has real data on its first day (see ADR-0006).
//!
//! See docs/architecture/scheduling.md#4--the-ladder--loop-c

use crate::rng::Lcg;
use crate::units::MS_PER_DAY;
use crate::{LadderRung, PhraseState};

/// Days without practice after which a phrase is considered stale.
pub const STALE_DAYS: i64 = 14;

/// What staleness contributes to `need`.
///
/// The `×2` of the blueprint's `need = stale×2 + stumbles` (`Loro.dc.html:3467`): being
/// stale is worth two stumbles. Also the value for "never practised", which is stale by
/// definition — one constant, so the two can't drift apart.
const STALE_WEIGHT: u32 = 2;

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
            let days = (now_ms - t) / MS_PER_DAY;
            u32::from(days > STALE_DAYS) * STALE_WEIGHT
        }
        // Never practised is stale by definition.
        None => STALE_WEIGHT,
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

/// How much a card's total need outweighs the jitter when dealing.
///
/// Scaling need by 100 while the jitter spans 0..200 means need decides the card whenever
/// two candidates differ by 2 or more, and the shuffle only breaks near-ties. The draw
/// feels like a draw without ever dealing a card the deck doesn't need.
const NEED_WEIGHT: u32 = 100;

/// Width of the random term in the card weighting. Two `NEED_WEIGHT` units wide, so it
/// can only reorder cards whose need is within 1.
const DRAW_JITTER: u32 = 200;

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
        total * NEED_WEIGHT + rng.next_range(DRAW_JITTER)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support;

    fn phrase(id: &str, rung: LadderRung, stumbles: u32, last: Option<i64>) -> PhraseState {
        PhraseState {
            rung,
            stumbles,
            last_practiced_at: last,
            ..test_support::phrase(id)
        }
    }

    const NOW: i64 = 1_753_660_800_000;
    const RECENT: i64 = NOW - MS_PER_DAY;

    /// Every rung, low to high — so a test over the whole ladder can't miss one.
    const ASCENDING: [LadderRung; 5] = [
        LadderRung::Accumulated,
        LadderRung::Bent,
        LadderRung::Transferred,
        LadderRung::PressureTested,
        LadderRung::Deployed,
    ];

    #[test]
    fn a_rung_never_goes_down() {
        for (i, &lower) in ASCENDING.iter().enumerate() {
            for &higher in &ASCENDING[i + 1..] {
                assert_eq!(climb(lower, higher), higher, "{lower:?} may climb");
                assert_eq!(climb(higher, lower), higher, "{higher:?} may not fall");
            }
            assert_eq!(climb(lower, lower), lower, "{lower:?} holds");
        }
    }

    #[test]
    fn deployed_is_the_ceiling() {
        assert_eq!(LadderRung::Deployed.climbed(), LadderRung::Deployed);
    }

    #[test]
    fn the_rung_index_round_trips_and_saturates() {
        for (i, &rung) in ASCENDING.iter().enumerate() {
            let index = u8::try_from(i).expect("five rungs");
            assert_eq!(rung.index(), index);
            assert_eq!(LadderRung::from_index(index), rung);
        }
        // Past the top, saturating rather than wrapping to Accumulated.
        assert_eq!(LadderRung::from_index(5), LadderRung::Deployed);
        assert_eq!(LadderRung::from_index(u8::MAX), LadderRung::Deployed);
    }

    #[test]
    fn need_combines_staleness_and_stumbles() {
        let fresh = phrase("f", LadderRung::Accumulated, 0, Some(RECENT));
        let stale = phrase("s", LadderRung::Accumulated, 0, Some(NOW - 30 * MS_PER_DAY));
        let stumbling = phrase("t", LadderRung::Accumulated, 3, Some(RECENT));
        assert_eq!(need(&fresh, NOW), 0);
        assert_eq!(need(&stale, NOW), STALE_WEIGHT);
        assert_eq!(need(&stumbling, NOW), 3);
        // Both terms at once, so the formula is `stale×2 + stumbles`, not `max`.
        let both = phrase("b", LadderRung::Accumulated, 3, Some(NOW - 30 * MS_PER_DAY));
        assert_eq!(need(&both, NOW), STALE_WEIGHT + 3);
    }

    #[test]
    fn staleness_turns_over_exactly_at_the_threshold() {
        let at = |days: i64| {
            let p = phrase(
                "p",
                LadderRung::Accumulated,
                0,
                Some(NOW - days * MS_PER_DAY),
            );
            need(&p, NOW)
        };
        assert_eq!(at(STALE_DAYS), 0, "day 14 is not yet stale");
        assert_eq!(at(STALE_DAYS + 1), STALE_WEIGHT, "day 15 is");
    }

    #[test]
    fn never_practised_counts_as_stale() {
        assert_eq!(
            need(&phrase("n", LadderRung::Accumulated, 0, None), NOW),
            STALE_WEIGHT
        );
    }

    #[test]
    fn every_card_advances_exactly_one_rung() {
        for card in FinisherCard::all() {
            let from = LadderRung::from_index(card.source_rung());
            assert_eq!(
                card.advances_to(),
                from.climbed(),
                "{card:?} must advance one rung from {from:?}"
            );
        }
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
