//! Set selection and cloze masking — Loop B's daily choices.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::Difficulty;

/// Reps per phrase per day. Overlearning is deliberate: the target does **not**
/// shorten when rep 1 was perfect (`Loro.dc.html:1536`, `3361`).
pub const DEFAULT_REP_TARGET: u32 = 6;

/// Distinct lock-in days before a phrase graduates out of rotation.
pub const LOCK_IN_DAYS_TO_GRADUATE: u32 = 4;

/// The ceiling on automaticity. A *cap*, not a scale: reps past the target still count as
/// reps, they just don't read as more than "done".
const AUTOMATICITY_MAX_PCT: f64 = 100.0;

/// Playback rate when a model is offered — a touch under natural speed, which is what
/// makes a phrase imitable without sounding slowed down.
const MODEL_RATE_MODELLED: f32 = 0.95;

/// Playback rate for Speed mode. Above natural speed: the point of the mode.
const MODEL_RATE_SPEED: f32 = 1.15;

/// Beat period for every mode but Speed. ~83 bpm, a comfortable speaking pulse.
const BEAT_MS_DEFAULT: u32 = 720;

/// Beat period for Speed mode. Just over double time, and the only cue that the mode
/// differs — hence the size of the gap.
const BEAT_MS_SPEED: u32 = 340;

// ── Effort-state thresholds, in percent (`Loro.dc.html:3411`) ────────────────────────
/// At or above the target: peak effort state.
const EFFORT_INSTANT_PCT: u8 = 100;
/// Two thirds of the way: hot effort state.
const EFFORT_QUICK_PCT: u8 = 66;
/// One third of the way: warm effort state. Below this it is cold.
const EFFORT_SMOOTHER_PCT: u8 = 33;

/// Today's automaticity, from the blueprint (`Loro.dc.html:3378`).
#[must_use]
#[uniffi::export]
pub fn automaticity(reps_today: u32, target: u32) -> u8 {
    if target == 0 {
        return 0;
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let pct = ((f64::from(reps_today) / f64::from(target)) * 100.0)
        .round()
        .min(AUTOMATICITY_MAX_PCT) as u8;
    pct
}

/// Set size from the learner's daily-minutes answer.
#[must_use]
#[uniffi::export]
pub fn refrain_set_size(daily_minutes: u32) -> u32 {
    match daily_minutes {
        0..=5 => 3,
        6..=10 => 5,
        _ => 8,
    }
}

/// The manner of one rep. From the blueprint (`Loro.dc.html:3353–3360`).
///
/// Six reps of one phrase are six different cognitive events — imitation, synchrony,
/// compression, generation, translation, free recall — not one event six times.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, uniffi::Enum)]
#[serde(rename_all = "lowercase")]
pub enum RefrainMode {
    /// Hear it, then say it back.
    Echo,
    /// Say it in unison — ride the beat.
    Chorus,
    /// Again, faster — keep the groove.
    Speed,
    /// Fill the gap out loud.
    Cloze,
    /// Say the Spanish for the cue.
    Call,
    /// From memory — no model.
    Cold,
}

/// The mode for a given rep index, clamped at the last.
#[must_use]
#[uniffi::export]
pub fn mode_for_rep(rep_index: u32) -> RefrainMode {
    match rep_index {
        0 => RefrainMode::Echo,
        1 => RefrainMode::Chorus,
        2 => RefrainMode::Speed,
        3 => RefrainMode::Cloze,
        4 => RefrainMode::Call,
        _ => RefrainMode::Cold,
    }
}

/// Model-audio playback rate for a mode, or `None` when no model is offered.
#[must_use]
#[uniffi::export]
pub fn model_rate_for_mode(mode: RefrainMode) -> Option<f32> {
    match mode {
        RefrainMode::Echo | RefrainMode::Chorus => Some(MODEL_RATE_MODELLED),
        RefrainMode::Speed => Some(MODEL_RATE_SPEED),
        // Cloze, Call, and Cold withhold the model — that's the point.
        RefrainMode::Cloze | RefrainMode::Call | RefrainMode::Cold => None,
    }
}

/// Beat tempo in milliseconds. Speed mode's faster beat is the only cue that it differs.
#[must_use]
#[uniffi::export]
pub fn beat_ms_for_mode(mode: RefrainMode) -> u32 {
    match mode {
        RefrainMode::Speed => BEAT_MS_SPEED,
        _ => BEAT_MS_DEFAULT,
    }
}

/// Presentation-neutral effort state, from the blueprint thresholds (`Loro.dc.html:3411`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum EffortState {
    /// No repetitions yet; presentation invites the learner to begin.
    Ready,
    /// Below the first automaticity threshold.
    Cold,
    /// At least one third automatic.
    Warm,
    /// At least two thirds automatic.
    Hot,
    /// Fully automatic at the daily target.
    Peak,
}

/// Map repetitions and automaticity to a semantic state; presentation owns the wording.
#[must_use]
#[uniffi::export]
pub fn effort_state(reps: u32, automaticity_pct: u8) -> EffortState {
    if reps == 0 {
        EffortState::Ready
    } else if automaticity_pct >= EFFORT_INSTANT_PCT {
        EffortState::Peak
    } else if automaticity_pct >= EFFORT_QUICK_PCT {
        EffortState::Hot
    } else if automaticity_pct >= EFFORT_SMOOTHER_PCT {
        EffortState::Warm
    } else {
        EffortState::Cold
    }
}

/// Which whitespace-delimited token to blank for Cloze mode.
///
/// The longest alphabetic content token wins; equal lengths prefer the first token.
/// Punctuation and case do not affect selection. Explicit language-specific function
/// words are excluded; unsupported languages and phrases without content return no
/// mask. This deterministic lexical heuristic is not a part-of-speech classifier.
#[must_use]
#[uniffi::export]
// Keep owned inputs at the public FFI boundary, matching the JSON bridge.
#[allow(clippy::needless_pass_by_value)]
pub fn cloze_mask(text: String, language: String) -> Vec<u32> {
    let locale_prefix = language.split(['-', '_']).next().unwrap_or("");
    let stop_words = match locale_prefix.to_ascii_lowercase().as_str() {
        "es" => SPANISH_FUNCTION_WORDS,
        "bg" => BULGARIAN_FUNCTION_WORDS,
        "ru" => RUSSIAN_FUNCTION_WORDS,
        _ => return Vec::new(),
    };
    let mut longest = 0;
    let mut selected = None;
    for (index, token) in text.split_whitespace().enumerate() {
        let bare: String = token.chars().filter(|c| c.is_alphabetic()).collect();
        let word = bare.to_lowercase();
        let length = word.chars().count();
        if length > longest && !stop_words.split_whitespace().any(|stop| stop == word) {
            longest = length;
            selected = u32::try_from(index).ok();
        }
    }
    selected.into_iter().collect()
}

// Keep the inventory in the canonical core so every platform masks the same token.
// These cover articles, prepositions, conjunctions, pronouns and common auxiliaries.
const SPANISH_FUNCTION_WORDS: &str = "a al ante bajo cabe con contra de del desde durante en entre \
    hacia hasta mediante para por según sin so sobre tras través versus vía el la los las lo un una unos \
    unas y e ni o u pero aunque sino pues porque que como cuando donde mientras si me te se nos os \
    le les yo tú tu usted ustedes él ella ello nosotros nosotras vosotros vosotras ellos ellas mí \
    ti sí mi mis tus su sus nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras \
    este esta estos estas ese esa esos esas aquel aquella aquellos aquellas esto eso aquello \
    soy eres es somos sois son sea seas sean ser sido siendo era eras éramos erais eran fui fuiste \
    fue fuimos fuisteis fueron he has ha hemos habéis han haber habido hay había habías habíamos \
    habíais habían estoy estás está estamos estáis están estar estado estando no más menos muy tan \
    tanto tanta tantos tantas cada todo toda todos todas algún alguno alguna algunos algunas \
    ningún ninguno ninguna nada nadie algo alguien cual cuales cuál cuáles quien quienes quién \
    quiénes qué cómo cuándo dónde cuánto cuánta cuántos cuántas cuyo cuya cuyos cuyas";

const BULGARIAN_FUNCTION_WORDS: &str = "и или но а че ако да не без в във до за зад из към край \
    между на над о от по под пред през при с със след срещу сред у чрез около покрай извън въпреки \
    освен според аз ти той тя то ние вие те ме те го я ни ви ги ми му ѝ й им си се мен мене тебе \
    него нея нас вас тях мой моя мое мои моят моята моето моите твой твоя твое твои твоята твоето \
    твоите наш наша наше наши ваш ваша ваше ваши негов негова негово негови неин нейна нейно нейни \
    техен тяхна тяхно техни този тази това тези онзи онази онова онези кой коя кое кои какъв каква \
    какво какви който която което които никой никоя никое никои някой някоя някое някои всеки всяка \
    всяко всички всичко нищо нещо сам сама само съм си е сме сте са бях беше бяхме бяхте бяха бъда \
    бъдеш бъде бъдем бъдете бъдат бил била било били ще щях щеше щяхме щяхте щяха ли дали защото \
    понеже затова когато докато където както макар обаче защо как кога къде тук там тогава \
    един една едно едни едната едното едните единят единият много малко още вече";

const RUSSIAN_FUNCTION_WORDS: &str = "и а но да или либо что чтобы если когда где как потому поэтому \
    пока хотя ведь без безо в во до для из изо к ко между на над надо о об обо от ото по под подо \
    перед передо при про ради с со сквозь среди у через изза изпод вокруг вдоль вместо внутри вне возле \
    вследствие мимо напротив около после посреди против согласно я ты он она оно мы вы они меня \
    тебя его него её ее неё нее нас вас их мне тебе ему ей нам вам им мной мною тобой тобою ним ней нами вами \
    ними себе себя собой собою кто кого кому кем чём чем что чей чья чьё чье чьи мой моя моё мое \
    мои твой твоя твоё твое твои наш наша наше наши ваш ваша ваше ваши свой своя своё свое свои \
    этот эта это эти тот та то те такого такой такая такое такие который которая которое которые \
    каждый каждая каждое каждые весь вся всё все никто никого ничего ничто никуда некоторый \
    некоторая некоторое некоторые какой какая какое какие сколько столько не ни бы б же ж ли ль \
    уже ещё еще только даже вот вон очень тоже также лишь ну есть был была было были быть буду \
    будешь будет будем будете будут пусть пускай";

/// Selection inputs independent of the larger native phrase-state record.
#[derive(Debug, Clone, Serialize, Deserialize, uniffi::Record)]
#[serde(rename_all = "camelCase")]
pub struct RefrainCandidate {
    /// The learner's phrase row id.
    pub id: String,
    /// Learner-declared difficulty, used when automaticity ties.
    pub difficulty: Difficulty,
    /// A learned phrase has left the active stream.
    pub learned: bool,
    /// A graduated phrase has left Refrain rotation.
    pub graduated: bool,
    /// Distinct local days locked in; one through three take first priority.
    pub lock_in_days: u32,
    /// Historical automaticity percentage.
    pub automaticity: u8,
    /// Total practice repetitions; zero means new material.
    pub reps: u32,
    /// Epoch milliseconds, to fill with the earliest unpractised phrase first.
    pub added_at: i64,
}

/// Choose today's closed set.
///
/// Priority order: phrases mid-graduation → today's trip drop → weakest by
/// automaticity → new material. Persisted once per day and **never recomputed
/// mid-day**, so a learner can always finish the set they were shown.
/// The caller owns the local-day boundary and persistence. This pure selector only
/// chooses eligible ids and never reads a clock. Ties use Unicode scalar ordering
/// rather than locale-sensitive collation, so devices cannot disagree.
#[must_use]
#[uniffi::export]
// Keep owned inputs at the public FFI boundary, matching the JSON bridge.
#[allow(clippy::needless_pass_by_value)]
pub fn select_refrain_set(
    candidates: Vec<RefrainCandidate>,
    size: u32,
    trip_phrase_ids: Vec<String>,
) -> Vec<String> {
    let size = usize::try_from(size).unwrap_or(usize::MAX);
    let eligible: Vec<_> = candidates
        .iter()
        .filter(|p| !p.learned && !p.graduated)
        .collect();
    let trip: HashSet<_> = trip_phrase_ids.iter().collect();
    let mut picked = Vec::new();
    let mut seen = HashSet::new();
    let mut take = |p: &RefrainCandidate| {
        if picked.len() < size && seen.insert(p.id.clone()) {
            picked.push(p.id.clone());
        }
    };

    let mut rotating: Vec<_> = eligible
        .iter()
        .copied()
        .filter(|p| p.lock_in_days > 0 && p.lock_in_days < LOCK_IN_DAYS_TO_GRADUATE)
        .collect();
    rotating.sort_by(|a, b| b.lock_in_days.cmp(&a.lock_in_days).then(a.id.cmp(&b.id)));
    for p in rotating {
        take(p);
    }

    let mut trip_drop: Vec<_> = eligible
        .iter()
        .copied()
        .filter(|p| trip.contains(&p.id))
        .collect();
    trip_drop.sort_by(|a, b| a.id.cmp(&b.id));
    for p in trip_drop {
        take(p);
    }

    let mut practiced: Vec<_> = eligible.iter().copied().filter(|p| p.reps > 0).collect();
    practiced.sort_by(|a, b| {
        a.automaticity
            .cmp(&b.automaticity)
            .then(difficulty_weight(b.difficulty).cmp(&difficulty_weight(a.difficulty)))
            .then(a.id.cmp(&b.id))
    });
    for p in practiced {
        take(p);
    }

    let mut new: Vec<_> = eligible.iter().copied().filter(|p| p.reps == 0).collect();
    new.sort_by(|a, b| a.added_at.cmp(&b.added_at).then(a.id.cmp(&b.id)));
    for p in new {
        take(p);
    }
    picked
}

const fn difficulty_weight(difficulty: Difficulty) -> u8 {
    match difficulty {
        Difficulty::Easy => 0,
        Difficulty::Med => 1,
        Difficulty::Hard => 2,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(id: &str) -> RefrainCandidate {
        RefrainCandidate {
            id: id.to_owned(),
            difficulty: Difficulty::Med,
            learned: false,
            graduated: false,
            lock_in_days: 0,
            automaticity: 0,
            reps: 0,
            added_at: 0,
        }
    }

    #[test]
    fn cloze_masks_content_in_each_supported_language() {
        for (phrase, language, expected) in [
            ("Durante el verano", "es-ES", vec![2]),
            ("¿Dónde está la estación?", "es", vec![3]),
            ("Според нея дом", "bg-BG", vec![2]),
            ("Искам чаша вода.", "bg", vec![0]),
            ("Согласно ей дом", "ru-RU", vec![2]),
            ("Где ближайший ресторан?", "ru", vec![1]),
        ] {
            assert_eq!(
                cloze_mask(phrase.to_owned(), language.to_owned()),
                expected,
                "{phrase}"
            );
        }
    }

    #[test]
    fn cloze_uses_whitespace_tokens_unicode_length_and_earliest_ties() {
        assert_eq!(
            cloze_mask("  ¿Café?\t  Agua.\n té  ".to_owned(), "ES_es".to_owned()),
            vec![0]
        );
        assert_eq!(
            cloze_mask("чай молоко".to_owned(), "ru".to_owned()),
            vec![1]
        );
    }

    #[test]
    fn cloze_does_not_invent_a_content_word() {
        for (phrase, language) in [
            ("", "es"),
            ("¿?! 123 —", "es"),
            ("Él y ella durante", "es"),
            ("със нея въпреки", "bg"),
            ("он из-за неё", "ru"),
            ("some content", "en"),
        ] {
            assert!(cloze_mask(phrase.to_owned(), language.to_owned()).is_empty());
        }
    }

    #[test]
    fn every_declared_function_word_is_excluded() {
        for (words, language) in [
            (SPANISH_FUNCTION_WORDS, "es"),
            (BULGARIAN_FUNCTION_WORDS, "bg"),
            (RUSSIAN_FUNCTION_WORDS, "ru"),
        ] {
            assert!(cloze_mask(words.to_owned(), language.to_owned()).is_empty());
        }
    }

    #[test]
    fn selector_applies_all_four_priorities_without_duplicates() {
        let mut rotating = candidate("rotating");
        rotating.lock_in_days = 2;
        rotating.reps = 12;
        rotating.automaticity = 100;
        let trip = candidate("trip");
        let mut weak = candidate("weak");
        weak.reps = 1;
        weak.automaticity = 17;
        let new = candidate("new");
        assert_eq!(
            select_refrain_set(
                vec![new, weak, trip.clone(), rotating.clone(), rotating],
                4,
                vec![trip.id, "rotating".to_owned(), "absent".to_owned()]
            ),
            ["rotating", "trip", "weak", "new"]
        );
    }

    #[test]
    fn selector_excludes_both_forms_of_inactive_phrase() {
        let mut learned = candidate("learned");
        learned.learned = true;
        learned.lock_in_days = 3;
        let mut graduated = candidate("graduated");
        graduated.graduated = true;
        graduated.reps = 1;
        assert_eq!(
            select_refrain_set(
                vec![learned, graduated, candidate("active")],
                8,
                vec!["learned".to_owned(), "graduated".to_owned()]
            ),
            ["active"]
        );
    }

    #[test]
    fn selector_limits_output_and_handles_empty_inputs() {
        assert!(select_refrain_set(vec![candidate("one")], 0, vec![]).is_empty());
        assert!(select_refrain_set(vec![], 8, vec![]).is_empty());
        assert_eq!(
            select_refrain_set(vec![candidate("one")], u32::MAX, vec![]),
            ["one"]
        );
        assert_eq!(
            select_refrain_set(vec![candidate("two"), candidate("one")], 1, vec![]),
            ["one"]
        );
    }

    #[test]
    fn rotation_prefers_the_nearest_graduation_then_lexical_ids() {
        let candidates = [("z", 3), ("a", 3), ("b", 1), ("c", 2)]
            .map(|(id, days)| {
                let mut phrase = candidate(id);
                phrase.lock_in_days = days;
                phrase
            })
            .to_vec();
        assert_eq!(
            select_refrain_set(candidates, 4, vec![]),
            ["a", "z", "c", "b"]
        );
    }

    #[test]
    fn weakness_precedes_difficulty_and_lexical_ids_break_ties() {
        let candidates = [
            ("strong", 90, Difficulty::Hard),
            ("easy", 50, Difficulty::Easy),
            ("medium", 50, Difficulty::Med),
            ("z-hard", 50, Difficulty::Hard),
            ("a-hard", 50, Difficulty::Hard),
            ("weak", 17, Difficulty::Easy),
        ]
        .map(|(id, automaticity, difficulty)| {
            let mut phrase = candidate(id);
            phrase.reps = 1;
            phrase.automaticity = automaticity;
            phrase.difficulty = difficulty;
            phrase
        })
        .to_vec();
        assert_eq!(
            select_refrain_set(candidates, 6, vec![]),
            ["weak", "a-hard", "z-hard", "medium", "easy", "strong"]
        );
    }

    #[test]
    fn new_material_prefers_oldest_addition_and_locale_independent_ids() {
        let candidates = [("z", 10), ("ä", 10), ("A", 10), ("a", 20)]
            .map(|(id, added_at)| {
                let mut phrase = candidate(id);
                phrase.added_at = added_at;
                phrase
            })
            .to_vec();
        assert_eq!(
            select_refrain_set(candidates, 4, vec![]),
            ["A", "z", "ä", "a"]
        );
    }

    #[test]
    fn selection_does_not_depend_on_candidate_or_trip_order() {
        let candidates = ["z", "a", "b", "c"].map(candidate).to_vec();
        let expected =
            select_refrain_set(candidates.clone(), 3, vec!["z".to_owned(), "b".to_owned()]);
        for shift in 0..candidates.len() {
            let mut reordered = candidates.clone();
            reordered.rotate_left(shift);
            reordered.reverse();
            assert_eq!(
                select_refrain_set(reordered, 3, vec!["b".to_owned(), "z".to_owned()]),
                expected
            );
        }
        assert_eq!(expected, ["b", "z", "a"]);
    }

    #[test]
    fn selection_record_uses_the_same_wire_fields_as_the_app() {
        let wire = serde_json::json!({
            "id": "coffee", "difficulty": "hard", "learned": false,
            "graduated": false, "lockInDays": 1, "automaticity": 50,
            "reps": 3, "addedAt": 1_789_000_000_000_i64,
        });
        let candidate: RefrainCandidate = serde_json::from_value(wire.clone()).unwrap();
        assert_eq!(serde_json::to_value(candidate).unwrap(), wire);
    }

    #[test]
    fn automaticity_reaches_a_hundred_at_the_target() {
        assert_eq!(automaticity(0, 6), 0);
        assert_eq!(automaticity(3, 6), 50);
        assert_eq!(automaticity(6, 6), 100);
    }

    #[test]
    fn automaticity_never_exceeds_a_hundred() {
        assert_eq!(automaticity(12, 6), 100);
    }

    #[test]
    fn a_zero_target_does_not_divide_by_zero() {
        assert_eq!(automaticity(3, 0), 0);
    }

    #[test]
    fn set_size_follows_the_daily_minutes_answer() {
        for (minutes, expect) in [
            (0, 3),
            (5, 3),
            (6, 5),
            (10, 5),
            (11, 8),
            (20, 8),
            (u32::MAX, 8),
        ] {
            assert_eq!(refrain_set_size(minutes), expect, "{minutes} minutes");
        }
    }

    /// The rotation in order, one per rep. `mode_for_rep` is written as a match on the
    /// index, so the table is the specification rather than a restatement of the code.
    const ROTATION: [RefrainMode; 6] = [
        RefrainMode::Echo,
        RefrainMode::Chorus,
        RefrainMode::Speed,
        RefrainMode::Cloze,
        RefrainMode::Call,
        RefrainMode::Cold,
    ];

    #[test]
    fn modes_rotate_then_hold_at_cold() {
        for (rep, expect) in ROTATION.iter().enumerate() {
            let rep = u32::try_from(rep).expect("six reps");
            assert_eq!(mode_for_rep(rep), *expect, "rep {rep}");
        }
        for rep in [6, 7, 99, u32::MAX] {
            assert_eq!(mode_for_rep(rep), RefrainMode::Cold, "rep {rep} holds");
        }
    }

    #[test]
    fn the_default_rep_target_spends_every_mode_exactly_once() {
        // Six reps of one phrase are six different cognitive events, not one six times.
        let used: Vec<RefrainMode> = (0..DEFAULT_REP_TARGET).map(mode_for_rep).collect();
        assert_eq!(
            used, ROTATION,
            "the target and the rotation must stay in step"
        );
    }

    #[test]
    fn the_later_modes_withhold_the_model() {
        for (mode, expect) in [
            (RefrainMode::Echo, Some(MODEL_RATE_MODELLED)),
            (RefrainMode::Chorus, Some(MODEL_RATE_MODELLED)),
            (RefrainMode::Speed, Some(MODEL_RATE_SPEED)),
            // Withholding the model is the point of these three.
            (RefrainMode::Cloze, None),
            (RefrainMode::Call, None),
            (RefrainMode::Cold, None),
        ] {
            assert_eq!(model_rate_for_mode(mode), expect, "{mode:?}");
        }
        // Under, then over, natural speed — checked at compile time.
        const {
            assert!(MODEL_RATE_MODELLED < 1.0);
            assert!(MODEL_RATE_SPEED > 1.0);
        }
    }

    #[test]
    fn speed_mode_has_a_faster_beat() {
        assert!(beat_ms_for_mode(RefrainMode::Speed) < beat_ms_for_mode(RefrainMode::Echo));
        for mode in ROTATION {
            let expect = if mode == RefrainMode::Speed {
                BEAT_MS_SPEED
            } else {
                BEAT_MS_DEFAULT
            };
            assert_eq!(beat_ms_for_mode(mode), expect, "{mode:?}");
        }
    }

    #[test]
    fn the_effort_state_escalates() {
        for (reps, pct, expect) in [
            (0, 0, EffortState::Ready),
            (0, 100, EffortState::Ready), // no reps outranks any percentage
            (1, 0, EffortState::Cold),
            (1, 16, EffortState::Cold),
            (1, EFFORT_SMOOTHER_PCT - 1, EffortState::Cold),
            (3, EFFORT_SMOOTHER_PCT, EffortState::Warm),
            (3, 50, EffortState::Warm),
            (4, EFFORT_QUICK_PCT, EffortState::Hot),
            (4, EFFORT_INSTANT_PCT - 1, EffortState::Hot),
            (6, EFFORT_INSTANT_PCT, EffortState::Peak),
            (9, u8::MAX, EffortState::Peak),
        ] {
            assert_eq!(effort_state(reps, pct), expect, "{reps} reps at {pct}%");
        }
    }
}
