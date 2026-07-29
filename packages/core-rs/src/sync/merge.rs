//! `merge_row` — the single most consequential function in the codebase.
//!
//! **The client and the server both call this.** Two implementations of a
//! conflict-resolution rule would diverge on some edge case, and the divergence
//! shows up months later as a learner losing a rating, a note, or a rep count.
//! That is the entire reason this crate exists (ADR-0002).
//!
//! Merge classes are declared per field in `packages/core/src/sync/fieldPolicy.ts`,
//! and a CI test fails if any syncable field lacks one.
//!
//! See docs/architecture/sync-protocol.md#per-field-lww

use super::hlc::Hlc;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// How a field resolves when two devices disagree.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, uniffi::Enum)]
pub enum MergeClass {
    /// Highest HLC wins. Learner-set scalars.
    Lww,
    /// `max(local, remote)`. Monotonic counters — LWW could otherwise *lower* a count.
    Max,
    /// Merged as a group, by the later `srs_last_review`. Mixing FSRS fields across
    /// devices would produce a state no algorithm ever computed.
    LatestReview,
    /// Union by primary key; no field merge.
    AppendOnly,
    /// A delete wins over a concurrent edit at any HLC.
    Tombstone,
}

/// A field's value plus the HLC at which it was written.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FieldValue {
    /// JSON-encoded value, so this crate stays type-agnostic.
    pub v: serde_json::Value,
    /// When it was written.
    pub hlc: Hlc,
}

/// A row as stored locally.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Row {
    /// Entity name, e.g. `user_phrase`.
    pub entity: String,
    /// Row id.
    pub id: String,
    /// Field name → value + HLC.
    pub fields: BTreeMap<String, FieldValue>,
    /// Soft-delete marker.
    pub deleted_at: Option<i64>,
}

/// An incoming change for one row.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RowOp {
    /// Entity name.
    pub entity: String,
    /// Row id.
    pub id: String,
    /// Only the CHANGED fields, each with its own HLC.
    pub fields: BTreeMap<String, FieldValue>,
    /// Soft-delete marker.
    pub deleted_at: Option<i64>,
    /// Merge class per field, resolved from the shared field policy.
    pub classes: BTreeMap<String, MergeClass>,
}

/// The outcome of a merge.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MergeOutcome {
    /// The merged row.
    pub row: Row,
    /// Whether anything actually changed — lets callers skip a write.
    pub changed: bool,
    /// Fields where both sides had a value and one was discarded. Reported as the
    /// `conflict_rate` metric, which is the canary for a wrong merge class.
    pub conflicts: Vec<String>,
}

/// Merge a remote change into a local row.
///
/// Properties the test suite asserts:
///   • **Commutative** for `Lww` and `Max`: `merge(a,b) == merge(b,a)`.
///   • **Idempotent**: re-applying the same op is a no-op.
///   • **A delete always wins**, at any HLC.
///   • **`Max` fields never decrease.**
#[must_use]
pub fn merge_row(local: &Row, remote: &RowOp) -> MergeOutcome {
    let mut row = local.clone();
    let mut changed = false;
    let mut conflicts = Vec::new();

    // A delete wins over a concurrent edit. A learner who removed a phrase on their
    // phone must not have it resurrected by a stale edit from their tablet.
    if remote.deleted_at.is_some() && row.deleted_at.is_none() {
        row.deleted_at = remote.deleted_at;
        changed = true;
    }

    // Group the FSRS fields: whichever side reviewed later wins the whole group.
    let remote_review_wins = fsrs_group_wins(local, remote);

    for (name, incoming) in &remote.fields {
        let class = remote.classes.get(name).copied().unwrap_or(MergeClass::Lww);
        let current = row.fields.get(name);

        let take = match class {
            MergeClass::Lww | MergeClass::Tombstone => current.is_none_or(|c| incoming.hlc > c.hlc),
            MergeClass::Max => current.is_none_or(|c| numeric(&incoming.v) > numeric(&c.v)),
            MergeClass::LatestReview => remote_review_wins,
            // Append-only rows are unioned by primary key upstream; nothing to merge.
            MergeClass::AppendOnly => current.is_none(),
        };

        if take {
            if let Some(c) = current {
                if c.v != incoming.v {
                    conflicts.push(name.clone());
                }
            }
            row.fields.insert(name.clone(), incoming.clone());
            changed = true;
        } else if let Some(c) = current {
            if c.v != incoming.v {
                conflicts.push(name.clone());
            }
        }
    }

    MergeOutcome {
        row,
        changed,
        conflicts,
    }
}

/// Whether the remote side's FSRS group should replace the local one.
fn fsrs_group_wins(local: &Row, remote: &RowOp) -> bool {
    let l = local
        .fields
        .get("srsLastReview")
        .map_or(f64::MIN, |f| numeric(&f.v));
    let r = remote
        .fields
        .get("srsLastReview")
        .map_or(f64::MIN, |f| numeric(&f.v));
    r > l
}

/// Coerce a JSON value to a number for `Max` comparison. Non-numbers sort lowest.
fn numeric(v: &serde_json::Value) -> f64 {
    v.as_f64().unwrap_or(f64::MIN)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn hlc(p: i64, n: &str) -> Hlc {
        Hlc {
            physical: p,
            logical: 0,
            node_id: n.into(),
        }
    }

    fn row(fields: &[(&str, serde_json::Value, i64, &str)]) -> Row {
        Row {
            entity: "user_phrase".into(),
            id: "up_1".into(),
            fields: fields
                .iter()
                .map(|(k, v, p, n)| {
                    (
                        (*k).to_string(),
                        FieldValue {
                            v: v.clone(),
                            hlc: hlc(*p, n),
                        },
                    )
                })
                .collect(),
            deleted_at: None,
        }
    }

    fn op(
        fields: &[(&str, serde_json::Value, i64, &str)],
        classes: &[(&str, MergeClass)],
    ) -> RowOp {
        RowOp {
            entity: "user_phrase".into(),
            id: "up_1".into(),
            fields: fields
                .iter()
                .map(|(k, v, p, n)| {
                    (
                        (*k).to_string(),
                        FieldValue {
                            v: v.clone(),
                            hlc: hlc(*p, n),
                        },
                    )
                })
                .collect(),
            deleted_at: None,
            classes: classes
                .iter()
                .map(|(k, c)| ((*k).to_string(), *c))
                .collect(),
        }
    }

    #[test]
    fn lww_takes_the_later_write() {
        let local = row(&[("difficulty", json!("med"), 1_000, "a")]);
        let remote = op(
            &[("difficulty", json!("hard"), 2_000, "b")],
            &[("difficulty", MergeClass::Lww)],
        );
        let out = merge_row(&local, &remote);
        assert_eq!(out.row.fields["difficulty"].v, json!("hard"));
        assert!(out.changed);
        assert_eq!(out.conflicts, vec!["difficulty".to_string()]);
    }

    #[test]
    fn lww_keeps_the_local_value_when_it_is_newer() {
        let local = row(&[("difficulty", json!("hard"), 3_000, "a")]);
        let remote = op(
            &[("difficulty", json!("easy"), 1_000, "b")],
            &[("difficulty", MergeClass::Lww)],
        );
        assert_eq!(
            merge_row(&local, &remote).row.fields["difficulty"].v,
            json!("hard")
        );
    }

    #[test]
    fn max_never_lowers_a_counter_even_with_a_later_clock() {
        // THE case that motivates the Max class: device A is at reps 20 offline;
        // device B reaches 18 with a later HLC. LWW would lose two reps.
        let local = row(&[("reps", json!(20), 1_000, "a")]);
        let remote = op(
            &[("reps", json!(18), 9_999, "b")],
            &[("reps", MergeClass::Max)],
        );
        let out = merge_row(&local, &remote);
        assert_eq!(out.row.fields["reps"].v, json!(20));
    }

    #[test]
    fn max_accepts_a_higher_value() {
        let local = row(&[("reps", json!(5), 9_999, "a")]);
        let remote = op(
            &[("reps", json!(9), 1_000, "b")],
            &[("reps", MergeClass::Max)],
        );
        assert_eq!(merge_row(&local, &remote).row.fields["reps"].v, json!(9));
    }

    #[test]
    fn a_delete_wins_over_a_concurrent_edit() {
        let local = row(&[("loved", json!(true), 9_999, "a")]);
        let mut remote = op(&[], &[]);
        remote.deleted_at = Some(5_000);
        let out = merge_row(&local, &remote);
        assert_eq!(out.row.deleted_at, Some(5_000));
    }

    #[test]
    fn fsrs_fields_move_as_a_group() {
        let local = row(&[
            ("srsStability", json!(3.0), 1_000, "a"),
            ("srsDue", json!(1_000_000), 1_000, "a"),
            ("srsLastReview", json!(500), 1_000, "a"),
        ]);
        let remote = op(
            &[
                ("srsStability", json!(7.5), 2_000, "b"),
                ("srsDue", json!(9_000_000), 2_000, "b"),
                ("srsLastReview", json!(1_500), 2_000, "b"),
            ],
            &[
                ("srsStability", MergeClass::LatestReview),
                ("srsDue", MergeClass::LatestReview),
                ("srsLastReview", MergeClass::LatestReview),
            ],
        );
        let out = merge_row(&local, &remote);
        // All three came from the remote side together — never a mix.
        assert_eq!(out.row.fields["srsStability"].v, json!(7.5));
        assert_eq!(out.row.fields["srsDue"].v, json!(9_000_000));
        assert_eq!(out.row.fields["srsLastReview"].v, json!(1_500));
    }

    #[test]
    fn merging_is_idempotent() {
        let local = row(&[("difficulty", json!("med"), 1_000, "a")]);
        let remote = op(
            &[("difficulty", json!("hard"), 2_000, "b")],
            &[("difficulty", MergeClass::Lww)],
        );
        let once = merge_row(&local, &remote);
        let twice = merge_row(&once.row, &remote);
        assert_eq!(once.row, twice.row);
        assert!(!twice.changed, "re-applying the same op must be a no-op");
    }

    #[test]
    fn an_unchanged_merge_reports_no_change() {
        let local = row(&[("loved", json!(true), 2_000, "a")]);
        let remote = op(
            &[("loved", json!(true), 1_000, "b")],
            &[("loved", MergeClass::Lww)],
        );
        assert!(!merge_row(&local, &remote).changed);
    }
}
