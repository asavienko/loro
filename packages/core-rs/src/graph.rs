//! Discover association score.
//!
//! Ranks unowned catalog neighbors **inside** the authored same-theme-first bands.
//! See `plans/101-phrase-sound-graph.md`. Not Stream rank and not FSRS.

use crate::{Difficulty, Tag};
use serde::{Deserialize, Serialize};

/// Authored edge relation. `same_theme` is derived and is never a stored value.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Relation {
    /// Continues a scenario arc.
    ScenarioNext,
    /// Question/answer pair.
    Reply,
    /// Shared glossed words.
    Lexical,
    /// Minimal pair / sound family.
    Contrast,
    /// Authored complexity step.
    Prerequisite,
    /// Same move, different register.
    RegisterShift,
}

/// CEFR labels that exist on catalog rows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Cefr {
    /// Breakthrough.
    A1,
    /// Waystage.
    A2,
    /// Threshold.
    B1,
    /// Vantage.
    B2,
}

/// Spoken register on a catalog row.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Register {
    /// Unmarked.
    Neutral,
    /// Informal.
    Casual,
    /// Formal.
    Formal,
}

/// The phrase the learner just added.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssocAnchor {
    /// Catalog id, or empty when the anchor is an own-phrase (no graph node).
    pub id: String,
    /// Declared difficulty of that add.
    pub difficulty: Difficulty,
    /// Declared tags of that add.
    pub tags: Vec<Tag>,
    /// Theme of the added phrase.
    pub theme: String,
    /// Catalog CEFR when the anchor is a catalog row.
    pub cefr: Option<Cefr>,
    /// Catalog register when the anchor is a catalog row.
    pub register: Option<Register>,
}

/// An unowned catalog candidate.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)] // Independent catalog presence flags, not a state machine.
pub struct AssocCandidate {
    /// Catalog phrase id. Empty is invalid.
    pub id: String,
    /// Taxonomic theme.
    pub theme: String,
    /// Catalog CEFR, if authored.
    pub cefr: Option<Cefr>,
    /// Catalog register, if authored.
    pub register: Option<Register>,
    /// Whether a checksummed clip exists.
    pub has_audio: bool,
    /// Whether IPA respelling exists (`respIpa`).
    pub has_resp_ipa: bool,
    /// Whether syllable timing exists.
    pub has_syl: bool,
    /// Whether a teaching hint exists.
    pub has_hint: bool,
    /// Authored catalog order, used only as the final tiebreak.
    pub catalog_index: u32,
    /// How many owned phrases already sit in this candidate's theme.
    pub owned_in_theme: u32,
}

/// An authored catalog edge.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssocEdge {
    /// Source catalog id.
    pub from: String,
    /// Target catalog id.
    pub to: String,
    /// Authored relation.
    pub relation: Relation,
    /// Authored confidence, 1..=100.
    pub weight: u8,
}

/// Learner aggregates that are not candidate-specific.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssocProfile {
    /// Highest CEFR among owned catalog phrases. Missing means the CEFR profile term is off.
    pub highest_owned_cefr: Option<Cefr>,
}

/// Same-theme (A) or rest-of-catalog (B). Profile terms apply only in B.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssocBand {
    /// Unowned same-theme candidates.
    SameTheme,
    /// Unowned rest of the catalog.
    Rest,
}

const CAP: usize = 6;
const RELATION_BOUND: i32 = -12;
const SCENARIO_NEXT: i32 = -8;
const REPLY: i32 = -6;
const CONTRAST: i32 = -4;
const LEXICAL: i32 = -4;
const PREREQUISITE: i32 = -3;
const REGISTER_SHIFT: i32 = -2;
const HARD_MINIMAL_PAIR: i32 = -2;
const HARD_CEFR_STEP: i32 = 2;
const EASY_ARC: i32 = -2;
const EASY_CEFR_STEP: i32 = -1;
const PRON_CONTRAST: i32 = -3;
const PRON_SOUND_FIELD: i32 = -1;
const WORDS_LEXICAL: i32 = -3;
const REMEMBER_HINT: i32 = -2;
const USEFUL_ARC: i32 = -3;
const HAS_AUDIO: i32 = -1;
const REGISTER_DIFFERS: i32 = 1;
const TUNNEL: i32 = 1;
const CEFR_JUMP: i32 = 3;
const TUNNEL_OWNED: u32 = 3;

/// Reject empty identities and illegal authored weights.
///
/// # Errors
/// Empty candidate id, empty edge ends, or a weight outside 1..=100.
pub fn validate_assoc_inputs(candidate_id: &str, edges: &[AssocEdge]) -> Result<(), String> {
    if candidate_id.is_empty() {
        return Err("Association candidate id is empty".into());
    }
    validate_edges(edges)
}

fn validate_edges(edges: &[AssocEdge]) -> Result<(), String> {
    for edge in edges {
        if edge.from.is_empty() || edge.to.is_empty() {
            return Err("Association edge end is empty".into());
        }
        if !(1..=100).contains(&edge.weight) {
            return Err("Association edge weight must be 1..=100".into());
        }
    }
    Ok(())
}

/// Integer association score. Lower comes sooner. Base is 0.
///
/// # Errors
/// Empty candidate id, empty edge ends, or a weight outside 1..=100.
pub fn assoc_score(
    anchor: &AssocAnchor,
    candidate: &AssocCandidate,
    edges: &[AssocEdge],
    profile: &AssocProfile,
    band: AssocBand,
) -> Result<i32, String> {
    validate_assoc_inputs(&candidate.id, edges)?;
    Ok(assoc_score_trusted(anchor, candidate, edges, profile, band))
}

fn assoc_score_trusted(
    anchor: &AssocAnchor,
    candidate: &AssocCandidate,
    edges: &[AssocEdge],
    profile: &AssocProfile,
    band: AssocBand,
) -> i32 {
    let relations = outgoing_relations(anchor, candidate, edges);
    let mut score = 0;

    if !anchor.id.is_empty() {
        let mut relation = 0;
        for (rel, weight) in &relations {
            relation += relation_offset(*rel) - i32::from(*weight) / 25;
        }
        score += relation.max(RELATION_BOUND);
        score += difficulty_terms(anchor, candidate, &relations);
        score += tag_terms(anchor, candidate, &relations);
    }

    if candidate.has_audio {
        score += HAS_AUDIO;
    }
    if registers_differ(anchor.register, candidate.register) {
        score += REGISTER_DIFFERS;
    }
    if band == AssocBand::Rest {
        if candidate.owned_in_theme >= TUNNEL_OWNED {
            score += TUNNEL;
        }
        if cefr_jump(profile.highest_owned_cefr, candidate.cefr) {
            score += CEFR_JUMP;
        }
    }
    score
}

/// Order unowned candidates: same-theme first, then the rest, cap 6.
///
/// # Errors
/// Empty candidate ids, duplicate candidate ids, empty edge ends, or illegal weights.
pub fn order_association(
    anchor: &AssocAnchor,
    candidates: &[AssocCandidate],
    edges: &[AssocEdge],
    profile: &AssocProfile,
) -> Result<Vec<String>, String> {
    validate_edges(edges)?;
    if candidates.is_empty() {
        return Ok(Vec::new());
    }
    if candidates.iter().any(|c| c.id.is_empty()) {
        return Err("Association candidate id is empty".into());
    }
    let mut seen = std::collections::HashSet::new();
    for candidate in candidates {
        if !seen.insert(candidate.id.as_str()) {
            return Err("Association candidate id is duplicated".into());
        }
    }

    let mut same: Vec<&AssocCandidate> = candidates
        .iter()
        .filter(|c| c.theme == anchor.theme)
        .collect();
    let mut rest: Vec<&AssocCandidate> = candidates
        .iter()
        .filter(|c| c.theme != anchor.theme)
        .collect();
    sort_band(&mut same, anchor, edges, profile, AssocBand::SameTheme);
    sort_band(&mut rest, anchor, edges, profile, AssocBand::Rest);
    Ok(same
        .into_iter()
        .chain(rest)
        .take(CAP)
        .map(|c| c.id.clone())
        .collect())
}

fn sort_band(
    band: &mut [&AssocCandidate],
    anchor: &AssocAnchor,
    edges: &[AssocEdge],
    profile: &AssocProfile,
    which: AssocBand,
) {
    let mut scored = Vec::with_capacity(band.len());
    for candidate in band.iter() {
        scored.push((
            assoc_score_trusted(anchor, candidate, edges, profile, which),
            *candidate,
        ));
    }
    scored.sort_by(|a, b| {
        a.0.cmp(&b.0)
            .then_with(|| a.1.catalog_index.cmp(&b.1.catalog_index))
    });
    for (slot, (_, candidate)) in band.iter_mut().zip(scored) {
        *slot = candidate;
    }
}

fn outgoing_relations(
    anchor: &AssocAnchor,
    candidate: &AssocCandidate,
    edges: &[AssocEdge],
) -> Vec<(Relation, u8)> {
    if anchor.id.is_empty() {
        return Vec::new();
    }
    edges
        .iter()
        .filter(|edge| edge.from == anchor.id && edge.to == candidate.id)
        .map(|edge| (edge.relation, edge.weight))
        .collect()
}

fn relation_offset(relation: Relation) -> i32 {
    match relation {
        Relation::ScenarioNext => SCENARIO_NEXT,
        Relation::Reply => REPLY,
        Relation::Contrast => CONTRAST,
        Relation::Lexical => LEXICAL,
        Relation::Prerequisite => PREREQUISITE,
        Relation::RegisterShift => REGISTER_SHIFT,
    }
}

fn has_relation(relations: &[(Relation, u8)], wanted: Relation) -> bool {
    relations.iter().any(|(rel, _)| *rel == wanted)
}

fn difficulty_terms(
    anchor: &AssocAnchor,
    candidate: &AssocCandidate,
    relations: &[(Relation, u8)],
) -> i32 {
    match anchor.difficulty {
        Difficulty::Med => 0,
        Difficulty::Hard => {
            let mut n = 0;
            if has_relation(relations, Relation::Contrast)
                || has_relation(relations, Relation::Lexical)
            {
                n += HARD_MINIMAL_PAIR;
            }
            if one_cefr_above(anchor.cefr, candidate.cefr) {
                n += HARD_CEFR_STEP;
            }
            n
        }
        Difficulty::Easy => {
            let mut n = 0;
            if has_relation(relations, Relation::ScenarioNext) {
                n += EASY_ARC;
            }
            if one_cefr_above(anchor.cefr, candidate.cefr) {
                n += EASY_CEFR_STEP;
            }
            n
        }
    }
}

fn tag_terms(
    anchor: &AssocAnchor,
    candidate: &AssocCandidate,
    relations: &[(Relation, u8)],
) -> i32 {
    let mut n = 0;
    if anchor.tags.contains(&Tag::Pron) {
        if has_relation(relations, Relation::Contrast) {
            n += PRON_CONTRAST;
        }
        if candidate.has_resp_ipa || candidate.has_syl {
            n += PRON_SOUND_FIELD;
        }
    }
    if anchor.tags.contains(&Tag::Words) && has_relation(relations, Relation::Lexical) {
        n += WORDS_LEXICAL;
    }
    if anchor.tags.contains(&Tag::Remember) && candidate.has_hint {
        n += REMEMBER_HINT;
    }
    if anchor.tags.contains(&Tag::Useful) && has_relation(relations, Relation::ScenarioNext) {
        n += USEFUL_ARC;
    }
    n
}

fn registers_differ(anchor: Option<Register>, candidate: Option<Register>) -> bool {
    matches!((anchor, candidate), (Some(a), Some(c)) if a != c)
}

fn cefr_rank(level: Cefr) -> i32 {
    match level {
        Cefr::A1 => 0,
        Cefr::A2 => 1,
        Cefr::B1 => 2,
        Cefr::B2 => 3,
    }
}

fn one_cefr_above(anchor: Option<Cefr>, candidate: Option<Cefr>) -> bool {
    match (anchor, candidate) {
        (Some(a), Some(c)) => cefr_rank(c) == cefr_rank(a) + 1,
        _ => false,
    }
}

fn cefr_jump(highest: Option<Cefr>, candidate: Option<Cefr>) -> bool {
    match (highest, candidate) {
        (Some(h), Some(c)) => cefr_rank(c) > cefr_rank(h) + 1,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn anchor(difficulty: Difficulty, tags: &[Tag]) -> AssocAnchor {
        AssocAnchor {
            id: "din1".into(),
            difficulty,
            tags: tags.to_vec(),
            theme: "Dining".into(),
            cefr: Some(Cefr::A1),
            register: Some(Register::Neutral),
        }
    }

    fn candidate(id: &str, theme: &str, index: u32) -> AssocCandidate {
        AssocCandidate {
            id: id.into(),
            theme: theme.into(),
            cefr: Some(Cefr::A1),
            register: Some(Register::Neutral),
            has_audio: false,
            has_resp_ipa: false,
            has_syl: false,
            has_hint: false,
            catalog_index: index,
            owned_in_theme: 0,
        }
    }

    fn edge(to: &str, relation: Relation, weight: u8) -> AssocEdge {
        AssocEdge {
            from: "din1".into(),
            to: to.into(),
            relation,
            weight,
        }
    }

    fn score_of(
        difficulty: Difficulty,
        tags: &[Tag],
        candidate: &AssocCandidate,
        edges: &[AssocEdge],
        profile: &AssocProfile,
        band: AssocBand,
    ) -> i32 {
        assoc_score(&anchor(difficulty, tags), candidate, edges, profile, band).expect("valid")
    }

    fn assert_relation(relation: Relation, weight: u8, expected: i32, label: &str) {
        let plain = candidate("din2", "Dining", 1);
        assert_eq!(
            score_of(
                Difficulty::Med,
                &[],
                &plain,
                &[edge("din2", relation, weight)],
                &AssocProfile::default(),
                AssocBand::SameTheme
            ),
            expected,
            "{label}"
        );
    }

    #[test]
    fn the_association_offsets_are_exactly_the_contract() {
        let plain = candidate("din2", "Dining", 1);
        assert_eq!(
            score_of(
                Difficulty::Med,
                &[],
                &plain,
                &[],
                &AssocProfile::default(),
                AssocBand::SameTheme
            ),
            0,
            "no signal stays at base 0"
        );
        assert_relation(
            Relation::ScenarioNext,
            100,
            -8 - 4,
            "scenario_next + weight 100",
        );
        assert_relation(Relation::Reply, 25, -6 - 1, "reply + weight 25");
        assert_relation(
            Relation::Contrast,
            1,
            -4,
            "contrast + weight 1 contributes 0 confidence",
        );
        assert_relation(Relation::Lexical, 50, -4 - 2, "lexical + weight 50");
        assert_relation(
            Relation::Prerequisite,
            75,
            -3 - 3,
            "prerequisite + weight 75",
        );
        assert_relation(
            Relation::RegisterShift,
            100,
            -2 - 4,
            "register_shift + weight 100",
        );
        let stacked = [
            edge("din2", Relation::ScenarioNext, 100),
            edge("din2", Relation::Reply, 100),
        ];
        assert_eq!(
            score_of(
                Difficulty::Med,
                &[],
                &plain,
                &stacked,
                &AssocProfile::default(),
                AssocBand::SameTheme
            ),
            -12,
            "relation influence is bounded at -12"
        );
    }

    #[test]
    fn anchor_difficulty_terms_are_exact() {
        let next = [edge("din2", Relation::ScenarioNext, 1)];
        let pair = [edge("din2", Relation::Contrast, 1)];
        let none = AssocProfile::default();
        let a2 = AssocCandidate {
            cefr: Some(Cefr::A2),
            ..candidate("din2", "Dining", 1)
        };
        let a1 = candidate("din2", "Dining", 1);

        assert_eq!(
            score_of(
                Difficulty::Hard,
                &[],
                &a1,
                &pair,
                &none,
                AssocBand::SameTheme
            ),
            -4 - 2,
            "hard consolidates contrast"
        );
        assert_eq!(
            score_of(Difficulty::Hard, &[], &a2, &[], &none, AssocBand::SameTheme),
            2,
            "hard + one CEFR above"
        );
        assert_eq!(
            score_of(
                Difficulty::Easy,
                &[],
                &a1,
                &next,
                &none,
                AssocBand::SameTheme
            ),
            -8 - 2,
            "easy progresses along the arc"
        );
        assert_eq!(
            score_of(Difficulty::Easy, &[], &a2, &[], &none, AssocBand::SameTheme),
            -1,
            "easy + one CEFR above"
        );
        assert_eq!(
            score_of(Difficulty::Med, &[], &a2, &[], &none, AssocBand::SameTheme),
            0,
            "med is zero"
        );
    }

    #[test]
    fn anchor_tag_terms_are_exact() {
        let pair = [edge("din2", Relation::Contrast, 1)];
        let lex = [edge("din2", Relation::Lexical, 1)];
        let next = [edge("din2", Relation::ScenarioNext, 1)];
        let none = AssocProfile::default();
        let sounds = AssocCandidate {
            has_resp_ipa: true,
            has_syl: true,
            ..candidate("din2", "Dining", 1)
        };
        let hinted = AssocCandidate {
            has_hint: true,
            ..candidate("din2", "Dining", 1)
        };
        let plain = candidate("din2", "Dining", 1);

        assert_eq!(
            score_of(
                Difficulty::Med,
                &[Tag::Pron],
                &plain,
                &pair,
                &none,
                AssocBand::SameTheme
            ),
            -4 - 3,
            "pron on contrast"
        );
        assert_eq!(
            score_of(
                Difficulty::Med,
                &[Tag::Pron],
                &sounds,
                &[],
                &none,
                AssocBand::SameTheme
            ),
            -1,
            "pron when the candidate has sound fields"
        );
        assert_eq!(
            score_of(
                Difficulty::Med,
                &[Tag::Words],
                &plain,
                &lex,
                &none,
                AssocBand::SameTheme
            ),
            -4 - 3,
            "words on lexical"
        );
        assert_eq!(
            score_of(
                Difficulty::Med,
                &[Tag::Remember],
                &hinted,
                &[],
                &none,
                AssocBand::SameTheme
            ),
            -2,
            "remember when the candidate has a hint"
        );
        assert_eq!(
            score_of(
                Difficulty::Med,
                &[Tag::Useful],
                &plain,
                &next,
                &none,
                AssocBand::SameTheme
            ),
            -8 - 3,
            "useful on scenario_next"
        );
    }

    #[test]
    fn candidate_and_profile_terms_are_exact() {
        let none = AssocProfile::default();
        let audio = AssocCandidate {
            has_audio: true,
            ..candidate("din2", "Dining", 1)
        };
        let formal = AssocCandidate {
            register: Some(Register::Formal),
            ..candidate("trv1", "Travel", 2)
        };
        let jump = AssocCandidate {
            cefr: Some(Cefr::B1),
            owned_in_theme: 3,
            ..candidate("trv1", "Travel", 2)
        };
        let profile = AssocProfile {
            highest_owned_cefr: Some(Cefr::A1),
        };

        assert_eq!(
            score_of(
                Difficulty::Med,
                &[],
                &audio,
                &[],
                &none,
                AssocBand::SameTheme
            ),
            -1,
            "audio"
        );
        assert_eq!(
            score_of(
                Difficulty::Med,
                &[],
                &formal,
                &[],
                &none,
                AssocBand::SameTheme
            ),
            1,
            "register differs"
        );
        assert_eq!(
            score_of(
                Difficulty::Med,
                &[],
                &jump,
                &[],
                &profile,
                AssocBand::SameTheme
            ),
            0,
            "profile terms do not apply in band A"
        );
        assert_eq!(
            score_of(Difficulty::Med, &[], &jump, &[], &profile, AssocBand::Rest),
            1 + 3,
            "band B tunnel + CEFR jump"
        );
    }

    #[test]
    fn terms_accumulate_and_own_phrase_drops_relations() {
        let pair = [edge("din2", Relation::Contrast, 25)];
        let none = AssocProfile::default();
        let rich = AssocCandidate {
            has_audio: true,
            has_resp_ipa: true,
            cefr: Some(Cefr::A2),
            register: Some(Register::Casual),
            ..candidate("din2", "Dining", 1)
        };
        assert_eq!(
            score_of(
                Difficulty::Hard,
                &[Tag::Pron],
                &rich,
                &pair,
                &none,
                AssocBand::SameTheme
            ),
            -4 - 1 - 2 + 2 - 3 - 1 - 1 + 1,
            "relation + confidence + hard + CEFR + pron + audio + register"
        );

        let mut own = anchor(Difficulty::Hard, &[Tag::Pron, Tag::Useful]);
        own.id.clear();
        let scored = assoc_score(&own, &rich, &pair, &none, AssocBand::SameTheme)
            .expect("own-phrase is valid");
        assert_eq!(scored, -1 + 1, "own-phrase keeps catalog terms only");
    }

    #[test]
    fn empty_ids_fail_closed() {
        let none = AssocProfile::default();
        let mut blank = candidate("din2", "Dining", 1);
        blank.id.clear();
        assert!(assoc_score(
            &anchor(Difficulty::Med, &[]),
            &blank,
            &[],
            &none,
            AssocBand::SameTheme
        )
        .is_err());
        assert!(assoc_score(
            &anchor(Difficulty::Med, &[]),
            &candidate("din2", "Dining", 1),
            &[AssocEdge {
                from: String::new(),
                to: "din2".into(),
                relation: Relation::Reply,
                weight: 10,
            }],
            &none,
            AssocBand::SameTheme
        )
        .is_err());
    }

    #[test]
    fn same_theme_precedes_other_themes_and_ties_keep_catalog_order() {
        let a = candidate("later", "Dining", 3);
        let b = candidate("sooner", "Dining", 1);
        let other = candidate("travel", "Travel", 2);
        let ranked = order_association(
            &anchor(Difficulty::Med, &[]),
            &[other.clone(), a.clone(), b.clone()],
            &[],
            &AssocProfile::default(),
        )
        .expect("valid");
        assert_eq!(
            ranked,
            vec![
                "sooner".to_string(),
                "later".to_string(),
                "travel".to_string()
            ]
        );
    }

    #[test]
    fn a_hard_pron_anchor_and_an_easy_anchor_rank_differently() {
        let contrast = AssocCandidate {
            has_resp_ipa: true,
            ..candidate("pair", "Dining", 0)
        };
        let next = candidate("arc", "Dining", 1);
        let filler = candidate("other", "Dining", 2);
        let edges = [
            edge("pair", Relation::Contrast, 100),
            edge("arc", Relation::ScenarioNext, 100),
        ];
        let hard = order_association(
            &anchor(Difficulty::Hard, &[Tag::Pron]),
            &[filler.clone(), next.clone(), contrast.clone()],
            &edges,
            &AssocProfile::default(),
        )
        .expect("valid");
        let easy = order_association(
            &anchor(Difficulty::Easy, &[]),
            &[filler, next, contrast],
            &edges,
            &AssocProfile::default(),
        )
        .expect("valid");
        assert_eq!(hard[0], "pair");
        assert_eq!(easy[0], "arc");
        assert_ne!(hard, easy);
    }

    #[test]
    fn association_caps_at_six() {
        let rows: Vec<AssocCandidate> = (0..8)
            .map(|i| candidate(&format!("p{i}"), "Dining", i))
            .collect();
        let ranked = order_association(
            &anchor(Difficulty::Med, &[]),
            &rows,
            &[],
            &AssocProfile::default(),
        )
        .expect("valid");
        assert_eq!(ranked.len(), 6);
        assert_eq!(ranked[0], "p0");
        assert_eq!(ranked[5], "p5");
    }
}
