//! A small deterministic PRNG — the only randomness this crate has.
//!
//! Crate rule 2 is "no ambient nondeterminism": the seed is always a parameter, so any
//! draw can be replayed exactly from a bug report. That rule is a crate-level property,
//! not a Loop C detail, which is why the generator lives here rather than inside
//! `ladder`, the one module that happens to use it today.
//!
//! **The output sequence is a compatibility surface.** `ladder::draw` is persisted by
//! seed and replayed in tests, so changing a constant here changes which finisher card a
//! learner is dealt for a seed they already have. Treat the numbers below as frozen.
//!
//! `pub(crate)`: never crosses the FFI boundary.

/// Knuth's MMIX 64-bit LCG multiplier. Paired with `INCREMENT` it has a full 2^64 period.
const MULTIPLIER: u64 = 6_364_136_223_846_793_005;

/// Knuth's MMIX 64-bit LCG increment. Odd, which is what guarantees the full period.
const INCREMENT: u64 = 1_442_695_040_888_963_407;

/// ⌊2^64 / φ⌋ — the odd golden-ratio word used for seed scrambling in `SplitMix64`.
///
/// XOR-ed into the raw seed so that the small, adjacent seeds tests and callers actually
/// pass (0, 1, 2, 42) don't start the sequence in a correlated corner of the state space.
const SEED_SCRAMBLE: u64 = 0x9E37_79B9_7F4A_7C15;

/// How far to shift before truncating to 32 bits.
///
/// An LCG's low-order bits have short periods — bit 0 alternates — so the *high* half of
/// the state is the only part worth handing out.
const HIGH_BITS_SHIFT: u32 = 33;

/// A seeded linear congruential generator.
pub(crate) struct Lcg(u64);

impl Lcg {
    /// Start the sequence from a caller-supplied seed.
    pub(crate) const fn new(seed: u64) -> Self {
        Self(seed ^ SEED_SCRAMBLE)
    }

    /// The next 32 bits of the sequence.
    pub(crate) fn next_u32(&mut self) -> u32 {
        self.0 = self.0.wrapping_mul(MULTIPLIER).wrapping_add(INCREMENT);
        #[allow(clippy::cast_possible_truncation)]
        ((self.0 >> HIGH_BITS_SHIFT) as u32)
    }

    /// The next value in `0..n`, or 0 when `n` is 0 rather than dividing by zero.
    ///
    /// Modulo, so large `n` is very slightly biased toward low values. Irrelevant at the
    /// scale this is used (a jitter term under 1 000), and *not* worth changing: the
    /// sequence is a compatibility surface — see the module header.
    pub(crate) fn next_range(&mut self, n: u32) -> u32 {
        if n == 0 {
            0
        } else {
            self.next_u32() % n
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_same_seed_replays_the_same_sequence() {
        let take = |seed| {
            let mut rng = Lcg::new(seed);
            (0..8).map(|_| rng.next_u32()).collect::<Vec<_>>()
        };
        assert_eq!(
            take(42),
            take(42),
            "a bug report must reproduce from a seed"
        );
    }

    #[test]
    fn different_seeds_diverge() {
        let take = |seed| {
            let mut rng = Lcg::new(seed);
            (0..8).map(|_| rng.next_u32()).collect::<Vec<_>>()
        };
        // Adjacent seeds included: this is what SEED_SCRAMBLE is for.
        assert_ne!(take(0), take(1));
        assert_ne!(take(1), take(2));
    }

    #[test]
    fn a_range_is_never_exceeded() {
        let mut rng = Lcg::new(7);
        for _ in 0..1_000 {
            assert!(rng.next_range(200) < 200);
        }
    }

    #[test]
    fn a_zero_range_does_not_divide_by_zero() {
        assert_eq!(Lcg::new(3).next_range(0), 0);
    }

    #[test]
    fn the_sequence_does_not_get_stuck() {
        let mut rng = Lcg::new(0);
        let first = rng.next_u32();
        assert!(
            (0..16).any(|_| rng.next_u32() != first),
            "a degenerate state would make every draw identical"
        );
    }
}
