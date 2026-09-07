//! Versioned JSON transport shared by browser WASM and native `UniFFI`.
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
enum Request {
    ReviewGrade {
        success: bool,
        hints_used: u32,
        self_grade: Option<crate::fsrs::Grade>,
        confidence: Option<crate::fsrs::Confidence>,
    },
    OrderStream {
        phrases: Vec<crate::PhraseState>,
        now_ms: i64,
    },
    StreamRank {
        phrase: crate::PhraseState,
        now_ms: i64,
    },
    RepeatTarget {
        difficulty: crate::Difficulty,
    },
    Automaticity {
        reps_today: u32,
        target: u32,
    },
    RefrainSetSize {
        daily_minutes: u32,
    },
    ModeForRep {
        rep_index: u32,
    },
    ModelRateForMode {
        mode: crate::select::RefrainMode,
    },
    BeatMsForMode {
        mode: crate::select::RefrainMode,
    },
    EffortState {
        reps: u32,
        automaticity_pct: u8,
    },
    Normalize {
        text: String,
    },
    MatchTokens {
        heard: Vec<String>,
        target: Vec<String>,
        revealed: u32,
        fuzzy: bool,
    },
    ClozeMask {
        tokens: Vec<String>,
        target_locale: String,
        eligible_indices: Vec<u32>,
    },
    SelectRefrainSet {
        candidates: Vec<crate::select::RefrainCandidate>,
        size: u32,
    },
    FsrsInitialize {
        declared: crate::Difficulty,
        tags: Vec<crate::Tag>,
        at_ms: i64,
    },
    FsrsRerate {
        state: crate::fsrs::FsrsState,
        declared: crate::Difficulty,
        tags: Vec<crate::Tag>,
    },
    FsrsReview {
        state: crate::fsrs::FsrsState,
        grade: crate::fsrs::Grade,
        at_ms: i64,
    },
    FsrsReviewConfidence {
        state: crate::fsrs::FsrsState,
        confidence: crate::fsrs::Confidence,
        at_ms: i64,
    },
    Retrievability {
        days: f64,
        stability: f64,
    },
    HlcTick {
        last: crate::sync::hlc::Hlc,
        wall_ms: i64,
        node_id: String,
    },
}

/// Execute a canonical operation and return `{ok: value}` or `{error: message}`.
/// Invalid requests never silently substitute an algorithm or synthesized value.
#[must_use]
#[uniffi::export]
pub fn core_call(request: &str) -> String {
    match serde_json::from_str::<Request>(request)
        .map_err(|e| e.to_string())
        .and_then(dispatch)
    {
        Ok(value) => json!({"ok": value}).to_string(),
        Err(error) => json!({"error": error}).to_string(),
    }
}

const MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;

fn valid_time(value: i64) -> Result<(), String> {
    if (0..=MAX_SAFE_INTEGER).contains(&value) {
        Ok(())
    } else {
        Err("Invalid or unsafe timestamp".into())
    }
}

fn valid_phrase(phrase: &crate::PhraseState) -> Result<(), String> {
    if let Some(value) = phrase.last_practiced_at {
        valid_time(value)?;
    }
    if let Some(value) = phrase.srs_due {
        valid_time(value)?;
    }
    if phrase.cue_level > 3
        || phrase
            .srs_stability
            .is_some_and(|s| !s.is_finite() || s < 0.0)
        || phrase
            .srs_difficulty
            .is_some_and(|d| !d.is_finite() || !(1.0..=10.0).contains(&d))
    {
        return Err("Invalid phrase numeric state".into());
    }
    Ok(())
}

#[allow(clippy::too_many_lines)] // Exhaustive transport routing; each arm delegates one canonical operation.
fn dispatch(request: Request) -> Result<Value, String> {
    match request {
        Request::ReviewGrade {
            success,
            hints_used,
            self_grade,
            confidence,
        } => {
            let grade = self_grade
                .or_else(|| confidence.map(crate::fsrs::grade_for_confidence))
                .unwrap_or({
                    if !success {
                        crate::fsrs::Grade::Again
                    } else if hints_used > 0 {
                        crate::fsrs::Grade::Hard
                    } else {
                        crate::fsrs::Grade::Good
                    }
                });
            Ok(json!(grade.as_u8()))
        }
        Request::OrderStream { phrases, now_ms } => {
            valid_time(now_ms)?;
            for phrase in &phrases {
                valid_phrase(phrase)?;
            }
            Ok(json!(crate::rank::order_stream(&phrases, now_ms)))
        }
        Request::StreamRank { phrase, now_ms } => {
            valid_time(now_ms)?;
            valid_phrase(&phrase)?;
            Ok(json!(crate::rank::stream_rank(&phrase, now_ms)))
        }
        Request::RepeatTarget { difficulty } => Ok(json!(crate::rank::repeat_target(difficulty))),
        Request::Automaticity { reps_today, target } => {
            Ok(json!(crate::select::automaticity(reps_today, target)))
        }
        Request::RefrainSetSize { daily_minutes } => {
            Ok(json!(crate::select::refrain_set_size(daily_minutes)))
        }
        Request::ModeForRep { rep_index } => Ok(json!(crate::select::mode_for_rep(rep_index))),
        Request::ModelRateForMode { mode } => Ok(json!(crate::select::model_rate_for_mode(mode))),
        Request::BeatMsForMode { mode } => Ok(json!(crate::select::beat_ms_for_mode(mode))),
        Request::EffortState {
            reps,
            automaticity_pct,
        } => {
            if automaticity_pct > 100 {
                return Err("Invalid automaticity percentage".into());
            }
            Ok(json!(crate::select::effort_state(reps, automaticity_pct)))
        }
        Request::Normalize { text } => Ok(json!(crate::asr::normalize(&text))),
        Request::MatchTokens {
            heard,
            target,
            revealed,
            fuzzy,
        } => Ok(json!(crate::asr::match_tokens(
            &heard, &target, revealed, fuzzy
        ))),
        Request::ClozeMask {
            tokens,
            target_locale,
            eligible_indices,
        } => Ok(json!(crate::select::cloze_mask(
            &tokens,
            &target_locale,
            &eligible_indices
        ))),
        Request::SelectRefrainSet { candidates, size } => {
            for candidate in &candidates {
                valid_time(candidate.added_at)?;
                if candidate.automaticity > 100 {
                    return Err("Invalid automaticity percentage".into());
                }
            }
            Ok(json!(crate::select::select_refrain_set(&candidates, size)))
        }
        Request::FsrsInitialize {
            declared,
            tags,
            at_ms,
        } => crate::fsrs::initialize(declared, &tags, at_ms)
            .map(|v| json!(v))
            .map_err(|e| e.to_string()),
        Request::FsrsRerate {
            state,
            declared,
            tags,
        } => crate::fsrs::rerate(state, declared, &tags)
            .map(|v| json!(v))
            .map_err(|e| e.to_string()),
        Request::FsrsReview {
            state,
            grade,
            at_ms,
        } => crate::fsrs::review(state, grade, at_ms)
            .map(|v| json!(v))
            .map_err(|e| e.to_string()),
        Request::FsrsReviewConfidence {
            state,
            confidence,
            at_ms,
        } => crate::fsrs::review_confidence(state, confidence, at_ms)
            .map(|v| json!(v))
            .map_err(|e| e.to_string()),
        Request::Retrievability { days, stability } => crate::fsrs::retrievability(days, stability)
            .map(|v| json!(v))
            .map_err(|e| e.to_string()),
        Request::HlcTick {
            last,
            wall_ms,
            node_id,
        } => {
            valid_time(wall_ms)?;
            valid_time(last.physical)?;
            if node_id.is_empty() || node_id.contains(':') || last.logical == u32::MAX {
                return Err("Invalid or exhausted HLC".into());
            }
            Ok(json!(crate::sync::hlc::tick(&last, wall_ms, &node_id)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn review_grade_honors_explicit_self_report() {
        for (success, hints_used, self_grade, expected) in [
            (false, 0, None, 1),
            (true, 1, None, 2),
            (true, 0, None, 3),
            (true, 2, Some("Easy"), 4),
        ] {
            let request = json!({"op":"review_grade","success":success,"hints_used":hints_used,"self_grade":self_grade}).to_string();
            let result: Value = serde_json::from_str(&core_call(&request)).unwrap();
            assert_eq!(result["ok"], expected);
        }
    }
    #[test]
    fn timestamp_and_counter_boundaries_fail_consistently_over_json() {
        for request in [
            json!({"op":"fsrs_initialize", "declared":"Med", "tags":[], "at_ms":MAX_SAFE_INTEGER + 1}),
            json!({"op":"hlc_tick", "last":{"physical":0,"logical":0,"node_id":"n"},"wall_ms":-1,"node_id":"n"}),
            json!({"op":"hlc_tick", "last":{"physical":MAX_SAFE_INTEGER + 1,"logical":0,"node_id":"n"},"wall_ms":0,"node_id":"n"}),
            json!({"op":"automaticity", "reps_today":4_294_967_296_u64, "target":6}),
            json!({"op":"automaticity", "reps_today":1.5, "target":6}),
            json!({"op":"order_stream", "phrases":[], "now_ms":MAX_SAFE_INTEGER + 1}),
            json!({"op":"effort_state", "reps":1, "automaticity_pct":101}),
        ] {
            let result: Value = serde_json::from_str(&core_call(&request.to_string())).unwrap();
            assert!(result.get("error").is_some(), "{request}: {result}");
        }
        let result: Value = serde_json::from_str(&core_call(&json!({"op":"hlc_tick", "last":{"physical":MAX_SAFE_INTEGER,"logical":0,"node_id":"n"},"wall_ms":MAX_SAFE_INTEGER,"node_id":"n"}).to_string())).unwrap();
        assert_eq!(result["ok"]["physical"], MAX_SAFE_INTEGER);
        assert_eq!(result["ok"]["logical"], 1);
    }

    #[test]
    fn invalid_requests_are_errors() {
        for request in [
            "null",
            "{}",
            r#"{"op":"unknown"}"#,
            r#"{"op":"normalize","text":"x","extra":true}"#,
        ] {
            assert!(serde_json::from_str::<Value>(&core_call(request))
                .unwrap()
                .get("error")
                .is_some());
        }
    }
    #[test]
    fn unicode_transport_uses_canonical_normalizer() {
        let response: Value =
            serde_json::from_str(&core_call(r#"{"op":"normalize","text":"София"}"#)).unwrap();
        assert_eq!(response["ok"], crate::asr::normalize("София"));
    }
}
