# /// script
# requires-python = ">=3.11"
# dependencies = ["fsrs==6.3.2"]
# ///
"""Regenerate scheduling vectors from the official, pinned implementation.

Run with `uv run packages/core-rs/tests/generate_fsrs_reference.py`.
No scheduling equations are duplicated here. The f32 round trip represents Loro's
existing native/storage boundary and is applied before the next reference review.
"""

import json
import struct
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fsrs import Card, Rating, Scheduler, State

DAY_MS = 86_400_000
BASE_MS = 1_709_164_800_000  # 2024-02-29T00:00:00Z (leap day)
SCHEDULER = Scheduler(
    desired_retention=0.9,
    learning_steps=(),
    relearning_steps=(),
    maximum_interval=36500,
    enable_fuzzing=False,
)


def f32(value: float) -> float:
    return struct.unpack("f", struct.pack("f", value))[0]


def date_at(milliseconds: int) -> datetime:
    return datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(milliseconds=milliseconds)


def state_of(card: Card, lapses: int) -> dict:
    return {
        "stability": f32(card.stability) if card.stability is not None else 0.0,
        "difficulty": f32(card.difficulty) if card.difficulty is not None else 5.0,
        "due": int(card.due.timestamp() * 1000),
        "last_review": (
            int(card.last_review.timestamp() * 1000)
            if card.last_review is not None
            else None
        ),
        "lapses": lapses,
    }


def run_case(name: str, card: Card, rating: Rating, at_ms: int, lapses: int) -> tuple:
    before = state_of(card, lapses)
    expected, _ = SCHEDULER.review_card(
        card, rating, review_datetime=date_at(at_ms)
    )
    if card.last_review is not None and rating == Rating.Again:
        lapses += 1
    after = state_of(expected, lapses)
    expected.stability = after["stability"]
    expected.difficulty = after["difficulty"]
    return (
        {
            "name": name,
            "state": before,
            "grade": rating.name.lower(),
            "at_ms": at_ms,
            "expected": after,
        },
        expected,
        lapses,
    )


cases = []
for rating in Rating:
    case, _, _ = run_case(
        f"first_{rating.name.lower()}",
        Card(card_id=1, due=date_at(BASE_MS)),
        rating,
        BASE_MS,
        0,
    )
    cases.append(case)

# Cover all grades immediately, just below a day, exactly a day, and overdue.
for elapsed_ms in (0, 600_000, DAY_MS - 1, DAY_MS, 3 * DAY_MS, 365 * DAY_MS):
    for rating in Rating:
        card = Card(
            card_id=1,
            state=State.Review,
            stability=5.0,
            difficulty=5.0,
            due=date_at(BASE_MS + DAY_MS),
            last_review=date_at(BASE_MS),
        )
        case, _, _ = run_case(
            f"elapsed_{elapsed_ms}_{rating.name.lower()}",
            card,
            rating,
            BASE_MS + elapsed_ms,
            2,
        )
        cases.append(case)

# A lapse/relearning history spanning leap day and daylight-saving changes. Reviews
# occur at precise instants; elapsed days do not depend on a device's local timezone.
card = Card(card_id=1, due=date_at(BASE_MS))
lapses = 0
at_ms = BASE_MS
for index, (elapsed_ms, rating) in enumerate(
    (
        (0, Rating.Again),
        (600_000, Rating.Hard),
        (600_000, Rating.Good),
        (DAY_MS, Rating.Good),
        (5 * DAY_MS, Rating.Easy),
        (30 * DAY_MS, Rating.Again),
        (600_000, Rating.Again),
        (600_000, Rating.Good),
        (DAY_MS, Rating.Hard),
        (25 * DAY_MS, Rating.Good),
        (180 * DAY_MS, Rating.Easy),
    )
):
    at_ms += elapsed_ms
    case, card, lapses = run_case(f"history_{index}", card, rating, at_ms, lapses)
    cases.append(case)

# Exact .5 ties and maximum interval cap exercise the reference rounding policy.
for stability in (2.5, 3.5, 100_000.0):
    card = Card(
        card_id=1,
        state=State.Review,
        stability=stability,
        difficulty=5.0,
        due=date_at(BASE_MS + DAY_MS),
        last_review=date_at(BASE_MS),
    )
    case, _, _ = run_case(
        f"interval_boundary_{stability}", card, Rating.Hard, BASE_MS, 0
    )
    cases.append(case)

result = {
    "reference": "https://github.com/open-spaced-repetition/py-fsrs/tree/v6.3.2",
    "package": "fsrs==6.3.2",
    "policy": SCHEDULER.to_dict(),
    "storage_precision": "f32",
    "cases": cases,
}
destination = Path(__file__).with_name("fixtures") / "fsrs_v6_3_2.json"
destination.parent.mkdir(exist_ok=True)
destination.write_text(json.dumps(result, indent=2) + "\n")
print(f"Wrote {len(cases)} reference cases to {destination}")
