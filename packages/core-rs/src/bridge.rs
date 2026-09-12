//! One checked JSON boundary shared by WASM and Expo's synchronous native module.
//! Algorithms remain in their owning Rust modules; this module only decodes inputs.

use crate::{asr, fsrs, graph, rank, select, sync, Difficulty, Tag};
use serde::{de::DeserializeOwned, Deserialize, Serialize};

/// A rejected call never substitutes a schedule or a successful production gate.
#[derive(Debug, uniffi::Error)]
pub enum CoreError {
    /// An unknown method, invalid argument, or invalid scheduling state.
    InvalidInput {
        /// Actionable rejection reason.
        reason: String,
    },
}

impl std::fmt::Display for CoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { reason } => f.write_str(reason),
        }
    }
}
impl std::error::Error for CoreError {}

fn invalid(error: impl std::fmt::Display) -> CoreError {
    CoreError::InvalidInput {
        reason: error.to_string(),
    }
}
fn parse<T: DeserializeOwned>(input: &str) -> Result<T, CoreError> {
    serde_json::from_str(input).map_err(invalid)
}
fn output<T: Serialize>(value: &T) -> Result<String, CoreError> {
    serde_json::to_string(value).map_err(invalid)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RankInput {
    plays: u32,
    difficulty: Difficulty,
    loved: bool,
    due: Option<i64>,
    now: i64,
}
#[derive(Deserialize)]
struct ClozeInput {
    text: String,
    language: String,
}
#[derive(Deserialize)]
struct ReviewInput {
    state: fsrs::FsrsState,
    grade: u8,
    at: i64,
    confidence: Option<fsrs::Confidence>,
}
#[derive(Deserialize)]
struct InitializeInput {
    declared: Difficulty,
    tags: Vec<Tag>,
    at: i64,
}
#[derive(Deserialize)]
struct RerateInput {
    state: fsrs::FsrsState,
    declared: Difficulty,
    tags: Vec<Tag>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GradeInput {
    success: bool,
    hints_used: u32,
    self_grade: Option<fsrs::Grade>,
    confidence: Option<fsrs::Confidence>,
}
#[derive(Deserialize)]
struct OrderStreamInput {
    candidates: Vec<rank::StreamCandidate>,
    now: i64,
}
#[derive(Deserialize)]
struct MatchInput {
    heard: Vec<String>,
    target: Vec<String>,
    revealed: u32,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MatchOutput {
    revealed: u32,
    just_index: i32,
    complete: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SelectInput {
    candidates: Vec<select::RefrainCandidate>,
    size: u32,
    trip_phrase_ids: Vec<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClockInput {
    wall_ms: i64,
    previous: Option<String>,
    node_id: String,
    remote: Option<String>,
    #[serde(default)]
    clamp_remote: bool,
}
#[derive(Deserialize)]
struct MergeInput {
    local: sync::merge::Row,
    remote: sync::merge::RowOp,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClampInput {
    value: String,
    wall_ms: i64,
}

#[derive(Deserialize)]
struct AutomaticityInput {
    reps: u32,
    target: u32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssocOrderInput {
    anchor: graph::AssocAnchor,
    candidates: Vec<graph::AssocCandidate>,
    edges: Vec<graph::AssocEdge>,
    #[serde(default)]
    highest_owned_cefr: Option<graph::Cefr>,
}

/// Invoke a canonical operation with JSON arguments and a JSON result.
///
/// # Errors
/// Unknown operations, malformed arguments and invalid domain state return a typed error.
#[uniffi::export]
#[allow(clippy::needless_pass_by_value)] // Owned strings are the stable UniFFI boundary.
pub fn core_call(method: String, input: String) -> Result<String, CoreError> {
    match method.as_str() {
        "repeat_target" => output(&rank::repeat_target(parse(&input)?)),
        "order_stream" => {
            let p: OrderStreamInput = parse(&input)?;
            output(&rank::order_stream_candidates(&p.candidates, p.now))
        }
        "assoc_order" => assoc_order(&input),
        "stream_rank" => {
            let p: RankInput = parse(&input)?;
            output(&rank::stream_rank_values(
                p.plays,
                p.difficulty,
                p.loved,
                p.due,
                p.now,
            ))
        }
        "cloze_mask" => {
            let p: ClozeInput = parse(&input)?;
            output(&select::cloze_mask(p.text, p.language))
        }
        "select_refrain_set" => {
            let p: SelectInput = parse(&input)?;
            output(&select::select_refrain_set(
                p.candidates,
                p.size,
                p.trip_phrase_ids,
            ))
        }
        "fsrs_review" => {
            let p: ReviewInput = parse(&input)?;
            let grade = match p.grade {
                1 => fsrs::Grade::Again,
                2 => fsrs::Grade::Hard,
                3 => fsrs::Grade::Good,
                4 => fsrs::Grade::Easy,
                _ => return Err(invalid("FSRS grade must be 1..4")),
            };
            let next = match p.confidence {
                Some(confidence) => fsrs::review_confidence(p.state, confidence, p.at),
                None => fsrs::review(p.state, grade, p.at),
            };
            output(&next.map_err(invalid)?)
        }
        "fsrs_initialize" => {
            let p: InitializeInput = parse(&input)?;
            output(&fsrs::initialize(p.declared, &p.tags, p.at).map_err(invalid)?)
        }
        "fsrs_rerate" => {
            let p: RerateInput = parse(&input)?;
            output(&fsrs::rerate(p.state, p.declared, &p.tags).map_err(invalid)?)
        }
        "review_grade" => {
            let p: GradeInput = parse(&input)?;
            output(&fsrs::review_grade(p.success, p.hints_used, p.self_grade, p.confidence).as_u8())
        }
        "mode_for_rep" => output(&select::mode_for_rep(parse(&input)?)),
        "model_rate_for_mode" => output(&select::model_rate_for_mode(parse(&input)?)),
        "beat_ms_for_mode" => output(&select::beat_ms_for_mode(parse(&input)?)),
        "match_tokens" => {
            let p: MatchInput = parse(&input)?;
            let result = asr::match_tokens(&p.heard, &p.target, p.revealed, false);
            output(&MatchOutput {
                revealed: result.revealed,
                just_index: result.just_index,
                complete: result.complete,
            })
        }
        "automaticity" => {
            let p: AutomaticityInput = parse(&input)?;
            output(&select::automaticity(p.reps, p.target))
        }
        "refrain_set_size" => output(&select::refrain_set_size(parse(&input)?)),
        "hlc_tick" | "hlc_receive" => advance_clock(&method, &input),
        "hlc_clamp" => {
            let p: ClampInput = parse(&input)?;
            let value = sync::hlc::Hlc::parse(&p.value).ok_or_else(|| invalid("Invalid HLC"))?;
            output(&sync::hlc::clamp_to_server(&value, p.wall_ms).encode())
        }
        "merge_row" => {
            let p: MergeInput = parse(&input)?;
            if p.local.id != p.remote.id || p.local.entity != p.remote.entity {
                return Err(invalid("Cannot merge different rows"));
            }
            output(&sync::merge::merge_row(&p.local, &p.remote))
        }
        _ => Err(invalid(format!("Unknown core method: {method}"))),
    }
}

fn assoc_order(input: &str) -> Result<String, CoreError> {
    let p: AssocOrderInput = parse(input)?;
    output(
        &graph::order_association(
            &p.anchor,
            &p.candidates,
            &p.edges,
            &graph::AssocProfile {
                highest_owned_cefr: p.highest_owned_cefr,
            },
        )
        .map_err(invalid)?,
    )
}

fn advance_clock(method: &str, input: &str) -> Result<String, CoreError> {
    let p: ClockInput = parse(input)?;
    if p.node_id.is_empty() || p.node_id.contains(':') || p.wall_ms < 0 {
        return Err(invalid("Invalid HLC node or wall time"));
    }
    let previous = match p.previous {
        Some(value) => {
            sync::hlc::Hlc::parse(&value).ok_or_else(|| invalid("Invalid previous HLC"))?
        }
        None => sync::hlc::Hlc {
            physical: p.wall_ms,
            logical: 0,
            node_id: p.node_id.clone(),
        },
    };
    let next = if method == "hlc_receive" {
        let remote = p
            .remote
            .and_then(|value| sync::hlc::Hlc::parse(&value))
            .ok_or_else(|| invalid("Invalid remote HLC"))?;
        let remote = if p.clamp_remote {
            sync::hlc::clamp_to_server(&remote, p.wall_ms)
        } else {
            remote
        };
        sync::hlc::receive(&previous, &remote, p.wall_ms, &p.node_id)
    } else {
        sync::hlc::tick(&previous, p.wall_ms, &p.node_id)
    };
    output(&next.encode())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn boundary_rejects_unknown_and_malformed_calls() {
        assert!(core_call("missing".into(), "{}".into()).is_err());
        assert!(core_call("repeat_target".into(), "garbage".into()).is_err());
    }
    #[test]
    fn empty_targets_cannot_complete_the_production_gate() {
        let result = core_call(
            "match_tokens".into(),
            r#"{"heard":["hola"],"target":[],"revealed":0}"#.into(),
        )
        .unwrap();
        assert!(result.contains("\"complete\":false"));
    }
    #[test]
    fn association_order_fails_closed_on_empty_ids() {
        let err = core_call(
            "assoc_order".into(),
            r#"{"anchor":{"id":"din1","difficulty":"med","tags":[],"theme":"Dining"},"candidates":[{"id":"","theme":"Dining","hasAudio":false,"hasRespIpa":false,"hasSyl":false,"hasHint":false,"catalogIndex":0,"ownedInTheme":0}],"edges":[]}"#.into(),
        );
        assert!(err.is_err());
    }
    #[test]
    fn boundary_uses_canonical_hlc_wire_and_monotonicity() {
        let result = core_call(
            "hlc_tick".into(),
            r#"{"wallMs":900,"previous":"1000:0004:device","nodeId":"device"}"#.into(),
        )
        .unwrap();
        assert_eq!(result, "\"1000:0005:device\"");
    }
}
