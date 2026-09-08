//! Real preview data remains intact; an actual review adopts the authored policy.
//!
//! These 42 historical vectors came from py-fsrs v6.3.2, with f32 stored memory,
//! 90% desired retention and no learning steps. They remain compatibility evidence,
//! not expected due dates for the current 50% Loro policy. Pinned ts-fsrs equation
//! parity lives in the scheduler's separate fsrs-6-reference.json suite.

use loro_core::fsrs::{review, CardState, FsrsState, Grade, ALGORITHM, LEGACY_PREVIEW_ALGORITHM};
use serde::Deserialize;

#[derive(Deserialize)]
struct Fixtures {
    package: String,
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    name: String,
    state: serde_json::Value,
    grade: Grade,
    at_ms: i64,
    expected: FsrsState,
}

#[test]
fn fsrs_preview_reference_evidence_survives_loading_and_next_actual_review() {
    let fixtures: Fixtures =
        serde_json::from_str(include_str!("fixtures/fsrs_v6_3_2.json")).unwrap();
    assert_eq!(fixtures.package, "fsrs==6.3.2");
    assert_eq!(fixtures.cases.len(), 42);
    for case in fixtures.cases {
        let prior: FsrsState = serde_json::from_value(case.state.clone()).unwrap();
        assert_eq!(prior.algorithm, LEGACY_PREVIEW_ALGORITHM);
        assert_eq!(
            prior.state,
            if prior.last_review.is_some() {
                CardState::Review
            } else {
                CardState::New
            },
        );
        let serialized = serde_json::to_value(&prior).unwrap();
        for field in ["stability", "difficulty", "due", "last_review", "lapses"] {
            assert_eq!(
                serialized[field], case.state[field],
                "{} {field} on load",
                case.name
            );
        }
        assert_eq!(
            serde_json::from_value::<FsrsState>(serialized).unwrap(),
            prior,
            "{} load is lossless",
            case.name,
        );

        let actual = review(prior.clone(), case.grade, case.at_ms).unwrap();
        assert_eq!(actual.algorithm, ALGORITHM, "{} provenance", case.name);
        assert_eq!(
            actual.last_review,
            Some(case.at_ms),
            "{} last review",
            case.name
        );
        assert_eq!(actual.lapses, case.expected.lapses, "{} lapses", case.name);
        let expected_difficulty = if prior.last_review.is_none() {
            // The authored initialization retains a declaration; py-fsrs initializes D0.
            prior.difficulty
        } else {
            case.expected.difficulty
        };
        for (field, observed, expected) in [
            (
                "stability",
                actual.stability,
                case.expected.stability.min(36_500.0),
            ),
            ("difficulty", actual.difficulty, expected_difficulty),
        ] {
            // The preview rounded once to f32; the pinned ts-fsrs equations round
            // intermediates to eight decimals. Compare real memory across these
            // documented precisions, independently from the changed interval policy.
            assert!(
                (observed - expected).abs() <= expected.abs().max(1.0) * 0.000_01,
                "{} {field}: expected approximately {expected}, got {observed}",
                case.name,
            );
        }
    }
}
