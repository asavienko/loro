//! Cross-language parity: the Rust half.
//!
//! `packages/core/src/domain/calendar.ts` is a TypeScript mirror of `calendar.rs`,
//! which exists only because the app has no UniFFI bridge yet
//! (`plans/09-native-toolchain-and-dev-client.md`). A mirror that nothing checks is a
//! second source of truth, which ADR-0002 exists to prevent — so both halves assert the
//! same fixture, and a divergence fails one build or the other.
//!
//! The fixture lives under `packages/core/src/` because that package compiles with
//! `rootDir: ./src` and cannot import a file above it, while `include_str!` reaches
//! anywhere. Direction chosen by the tighter constraint.
//!
//! Run: `cargo test --test parity` (or `pnpm --filter @loro/core-rs test:parity`).

use loro_core::calendar::{days_between, streak, streak_day_for, streak_survives};
use loro_core::select::{effort_state, EffortState};
use loro_core::{asr, select};
use serde_json::Value;

const FIXTURES: &str = include_str!("../../core/src/domain/calendar.fixtures.json");
const EFFORT_FIXTURES: &str = include_str!("../../core/src/domain/effort.fixtures.json");
const CORE_BOUNDARY_FIXTURES: &str =
    include_str!("../../core/src/domain/core-boundary.fixtures.json");

fn fixtures() -> Value {
    serde_json::from_str(FIXTURES).expect("calendar.fixtures.json is valid JSON")
}

/// The fixture's own `why` string, so a failure names the case rather than an index.
fn why(case: &Value, fallback: &str) -> String {
    case.get("why")
        .and_then(Value::as_str)
        .unwrap_or(fallback)
        .to_string()
}

fn cases(f: &Value, key: &str) -> Vec<Value> {
    let arr = f
        .get(key)
        .and_then(Value::as_array)
        .unwrap_or_else(|| panic!("fixture group `{key}` is missing — did a key get renamed?"));
    assert!(!arr.is_empty(), "fixture group `{key}` is empty");
    arr.clone()
}

fn i64_at(case: &Value, key: &str) -> i64 {
    case.get(key)
        .and_then(Value::as_i64)
        .unwrap_or_else(|| panic!("case is missing integer `{key}`: {case}"))
}

fn str_at(case: &Value, key: &str) -> String {
    case.get(key)
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("case is missing string `{key}`: {case}"))
        .to_string()
}

#[test]
fn multilingual_core_boundary_matches_the_shared_fixture() {
    let fixtures: Value = serde_json::from_str(CORE_BOUNDARY_FIXTURES)
        .expect("core-boundary.fixtures.json is valid JSON");

    for case in cases(&fixtures, "cloze") {
        let expected = case
            .get("expect")
            .and_then(Value::as_array)
            .expect("cloze case has an expected mask")
            .iter()
            .map(|value| {
                u32::try_from(value.as_u64().expect("mask is unsigned")).expect("mask fits")
            })
            .collect::<Vec<_>>();
        assert_eq!(
            select::cloze_mask(str_at(&case, "text"), str_at(&case, "language")),
            expected,
            "{}",
            why(&case, "unnamed cloze case")
        );
    }

    for case in cases(&fixtures, "matchTokens") {
        let tokens = |key: &str| {
            case.get(key)
                .and_then(Value::as_array)
                .expect("match case has token array")
                .iter()
                .map(|value| value.as_str().expect("token is a string").to_owned())
                .collect::<Vec<_>>()
        };
        let expected = case.get("expect").expect("match case has expected result");
        let result = asr::match_tokens(
            &tokens("heard"),
            &tokens("target"),
            u32::try_from(i64_at(&case, "revealed")).expect("revealed fits"),
            false,
        );
        assert_eq!(
            result.revealed,
            u32::try_from(i64_at(expected, "revealed")).expect("revealed fits")
        );
        assert_eq!(
            result.just_index,
            i32::try_from(i64_at(expected, "justIndex")).expect("index fits")
        );
        assert_eq!(
            result.complete,
            expected
                .get("complete")
                .and_then(Value::as_bool)
                .expect("complete is boolean"),
            "{}",
            why(&case, "unnamed matching case")
        );
    }
}

#[test]
fn effort_state_matches_the_fixture() {
    let cases: Vec<Value> =
        serde_json::from_str(EFFORT_FIXTURES).expect("effort.fixtures.json is valid JSON");
    assert!(!cases.is_empty(), "effort fixtures are not empty");

    for case in cases {
        let reps = u32::try_from(i64_at(&case, "reps")).expect("reps fit in u32");
        let pct = u8::try_from(i64_at(&case, "automaticityPct")).expect("pct fits in u8");
        let expect = match str_at(&case, "expect").as_str() {
            "ready" => EffortState::Ready,
            "cold" => EffortState::Cold,
            "warm" => EffortState::Warm,
            "hot" => EffortState::Hot,
            "peak" => EffortState::Peak,
            other => panic!("unknown effort state `{other}`"),
        };
        assert_eq!(effort_state(reps, pct), expect, "{case}");
    }
}

#[test]
fn streak_day_for_matches_the_fixture() {
    let f = fixtures();
    for case in cases(&f, "streakDayFor") {
        let at = i64_at(&case, "atWallMs");
        let midnight = i64_at(&case, "localMidnightWallMs");
        let expect = str_at(&case, "expect");
        assert_eq!(
            streak_day_for(at, midnight),
            expect,
            "streak_day_for({at}, {midnight}) — {}",
            why(&case, "unnamed case")
        );
    }
}

#[test]
fn days_between_matches_the_fixture() {
    let f = fixtures();
    for case in cases(&f, "daysBetween") {
        let a = str_at(&case, "a");
        let b = str_at(&case, "b");
        // `null` in the fixture means "rejected, not guessed".
        let expect: Option<i32> = match case.get("expect") {
            Some(Value::Null) | None => None,
            Some(v) => Some(
                i32::try_from(v.as_i64().expect("expect is an integer or null"))
                    .expect("expect fits in i32"),
            ),
        };
        assert_eq!(days_between(&a, &b), expect, "days_between({a:?}, {b:?})");
    }
}

#[test]
fn streak_survives_matches_the_fixture() {
    let f = fixtures();
    for case in cases(&f, "streakSurvives") {
        let last = str_at(&case, "lastDay");
        let today = str_at(&case, "today");
        let expect = case
            .get("expect")
            .and_then(Value::as_bool)
            .expect("expect is a boolean");
        assert_eq!(
            streak_survives(&last, &today),
            expect,
            "streak_survives({last:?}, {today:?})"
        );
    }
}

#[test]
fn streak_matches_the_fixture() {
    let f = fixtures();
    for case in cases(&f, "streak") {
        let days: Vec<String> = case
            .get("days")
            .and_then(Value::as_array)
            .expect("case has a `days` array")
            .iter()
            .map(|d| d.as_str().expect("a day is a string").to_string())
            .collect();
        let today = str_at(&case, "today");
        let expect = u32::try_from(i64_at(&case, "expect")).expect("a streak is not negative");
        assert_eq!(
            streak(&days, &today),
            expect,
            "streak({days:?}, {today:?}) — {}",
            why(&case, "unnamed case")
        );
    }
}

/// The property the fixture cannot state: a streak is exactly as long as the run of
/// consecutive days ending at (or one day before) today, for any run length.
#[test]
fn streak_counts_runs_of_every_length() {
    for len in 1_u32..=60 {
        // Consecutive noon instants from a fixed day, so month lengths are exercised.
        let days: Vec<String> = (0..len)
            .map(|i| {
                streak_day_for(
                    1_772_064_000_000 + i64::from(i) * 86_400_000 + 43_200_000,
                    0,
                )
            })
            .collect();
        let today = days.last().expect("at least one day").clone();
        assert_eq!(streak(&days, &today), len, "a run of {len} days");
    }
}
