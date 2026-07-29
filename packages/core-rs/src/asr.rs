//! ASR token matching.
//!
//! This lives here, not in the platform speech module, so iOS and Android apply
//! identical normalisation and identical matching. Accuracy differences between
//! platform recognisers therefore surface as *recognition* differences, never as
//! *scoring* differences.
//!
//! Ported from the blueprint's `matchTranscript` (`Loro.dc.html:2674–2683`).
//! See docs/architecture/audio-speech.md#matching

/// Normalise for comparison: lowercase, strip diacritics, strip everything that
/// isn't alphanumeric or ñ.
///
/// So `¿Cuánto cuesta?` matches `cuanto cuesta`, and `dónde` matches `donde`.
#[must_use]
#[uniffi::export]
pub fn normalize(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(strip_diacritic)
        .filter(|c| c.is_alphanumeric() || *c == 'ñ')
        .collect()
}

/// Map an accented Latin character to its base form, preserving ñ.
fn strip_diacritic(c: char) -> char {
    match c {
        'á' | 'à' | 'ä' | 'â' | 'ã' | 'å' => 'a',
        'é' | 'è' | 'ë' | 'ê' => 'e',
        'í' | 'ì' | 'ï' | 'î' => 'i',
        'ó' | 'ò' | 'ö' | 'ô' | 'õ' => 'o',
        'ú' | 'ù' | 'ü' | 'û' => 'u',
        'ý' | 'ÿ' => 'y',
        'ç' => 'c',
        // ñ is a distinct letter in Spanish, not an accented n. Keep it.
        'ñ' => 'ñ',
        other => other,
    }
}

/// The result of matching one utterance against the target phrase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Record)]
pub struct MatchResult {
    /// How many leading target tokens are now revealed. Only ever increases.
    pub revealed: u32,
    /// The index just revealed, for the "just said" highlight. `-1` if none.
    pub just_index: i32,
    /// Whether the whole phrase has been produced — the production gate.
    pub complete: bool,
}

/// Match heard tokens against the target, walking forward from `revealed`.
///
/// Properties, all inherited from the blueprint:
///   • **Order matters** — words must be produced in sequence.
///   • **Insertions are tolerated** — ASR noise between target words doesn't break it.
///   • **Progress is monotonic** — partial credit is never lost.
///
/// `fuzzy` enables a bounded edit-distance tolerance. It is OFF by default:
/// turning it on makes the production gate more forgiving, which is a
/// *pedagogical* decision, not an implementation detail.
#[must_use]
#[uniffi::export]
pub fn match_tokens(
    heard: &[String],
    target: &[String],
    revealed: u32,
    fuzzy: bool,
) -> MatchResult {
    let heard_norm: Vec<String> = heard
        .iter()
        .map(|t| normalize(t))
        .filter(|t| !t.is_empty())
        .collect();
    let target_norm: Vec<String> = target.iter().map(|t| normalize(t)).collect();

    let start = revealed as usize;
    let mut cursor = 0usize;
    let mut matched = start;

    for target_token in target_norm.iter().skip(start) {
        match find_from(&heard_norm, target_token, cursor, fuzzy) {
            Some(idx) => {
                cursor = idx + 1;
                matched += 1;
            }
            // Stop at the first miss: order is required.
            None => break,
        }
    }

    let revealed_now = matched.max(start);
    MatchResult {
        revealed: u32::try_from(revealed_now).unwrap_or(u32::MAX),
        just_index: if revealed_now > start {
            i32::try_from(revealed_now).unwrap_or(i32::MAX) - 1
        } else {
            -1
        },
        complete: revealed_now >= target_norm.len() && !target_norm.is_empty(),
    }
}

fn find_from(heard: &[String], needle: &str, from: usize, fuzzy: bool) -> Option<usize> {
    heard.iter().enumerate().skip(from).find_map(|(i, h)| {
        if h == needle || (fuzzy && close_enough(h, needle)) {
            Some(i)
        } else {
            None
        }
    })
}

/// Edit distance ≤ 1 for words of 5+ characters. Deliberately conservative.
fn close_enough(a: &str, b: &str) -> bool {
    if a.len() < 5 || b.len() < 5 {
        return false;
    }
    levenshtein_at_most_one(a, b)
}

fn levenshtein_at_most_one(a: &str, b: &str) -> bool {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    if a.len().abs_diff(b.len()) > 1 {
        return false;
    }
    let mut i = 0;
    let mut j = 0;
    let mut edits = 0;
    while i < a.len() && j < b.len() {
        if a[i] == b[j] {
            i += 1;
            j += 1;
            continue;
        }
        edits += 1;
        if edits > 1 {
            return false;
        }
        match a.len().cmp(&b.len()) {
            std::cmp::Ordering::Greater => i += 1,
            std::cmp::Ordering::Less => j += 1,
            std::cmp::Ordering::Equal => {
                i += 1;
                j += 1;
            }
        }
    }
    edits + (a.len() - i) + (b.len() - j) <= 1
}

/// Split a phrase into comparable tokens.
#[must_use]
#[uniffi::export]
pub fn tokenize(phrase: &str) -> Vec<String> {
    phrase.split_whitespace().map(str::to_string).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(s: &str) -> Vec<String> {
        s.split_whitespace().map(str::to_string).collect()
    }

    #[test]
    fn accents_and_punctuation_are_ignored() {
        assert_eq!(normalize("¿Cuánto cuesta?"), "cuantocuesta");
        assert_eq!(normalize("dónde"), normalize("Donde"));
    }

    #[test]
    fn enye_is_preserved_as_a_distinct_letter() {
        assert_eq!(normalize("baño"), "baño");
        assert_ne!(normalize("baño"), normalize("bano"));
    }

    #[test]
    fn partial_production_reveals_a_prefix() {
        let target = v("¿Dónde está el baño?");
        let r = match_tokens(&v("dónde está"), &target, 0, false);
        assert_eq!(r.revealed, 2);
        assert!(!r.complete);
    }

    #[test]
    fn full_production_completes_the_gate() {
        let target = v("¿Dónde está el baño?");
        let r = match_tokens(&v("dónde está el baño"), &target, 0, false);
        assert_eq!(r.revealed, 4);
        assert!(r.complete);
    }

    #[test]
    fn asr_insertions_are_tolerated() {
        let target = v("¿Dónde está el baño?");
        // The recogniser hallucinated "eh" and "um" between real words.
        let r = match_tokens(&v("dónde eh está um el baño"), &target, 0, false);
        assert!(r.complete);
    }

    #[test]
    fn out_of_order_production_does_not_count() {
        let target = v("¿Dónde está el baño?");
        let r = match_tokens(&v("baño el está dónde"), &target, 0, false);
        // 'dónde' matches first, then nothing follows it in order.
        assert_eq!(r.revealed, 1);
        assert!(!r.complete);
    }

    #[test]
    fn progress_is_monotonic() {
        let target = v("¿Dónde está el baño?");
        // Already at 3; a worse utterance must not reduce it.
        let r = match_tokens(&v("dónde"), &target, 3, false);
        assert_eq!(r.revealed, 3);
        assert_eq!(r.just_index, -1);
    }

    #[test]
    fn fuzzy_is_off_by_default() {
        let target = v("cortado");
        assert_eq!(match_tokens(&v("cortando"), &target, 0, false).revealed, 0);
        assert_eq!(match_tokens(&v("cortando"), &target, 0, true).revealed, 1);
    }

    #[test]
    fn empty_input_is_safe() {
        assert_eq!(match_tokens(&[], &v("hola"), 0, false).revealed, 0);
        assert!(!match_tokens(&v("hola"), &[], 0, false).complete);
    }
}
