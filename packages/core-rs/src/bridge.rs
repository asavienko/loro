//! One checked JSON boundary shared by WASM and Expo's synchronous native module.
//! Algorithms remain in their owning Rust modules; this module only decodes inputs.

use crate::{asr, fsrs, rank, select, sync, Difficulty};
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

/// Invoke a canonical operation with JSON arguments and a JSON result.
///
/// # Errors
/// Unknown operations, malformed arguments and invalid domain state return a typed error.
#[uniffi::export]
#[allow(clippy::needless_pass_by_value)] // Owned strings are the stable UniFFI boundary.
pub fn core_call(method: String, input: String) -> Result<String, CoreError> {
    match method.as_str() {
        "repeat_target" => output(&rank::repeat_target(parse(&input)?)),
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
            output(&fsrs::review(p.state, grade, p.at).map_err(invalid)?)
        }
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
        "hlc_tick" | "hlc_receive" => {
            let p: ClockInput = parse(&input)?;
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
    fn boundary_uses_canonical_hlc_wire_and_monotonicity() {
        let result = core_call(
            "hlc_tick".into(),
            r#"{"wallMs":900,"previous":"1000:0004:device","nodeId":"device"}"#.into(),
        )
        .unwrap();
        assert_eq!(result, "\"1000:0005:device\"");
    }
}
