import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clock } from '../state/clock';
import { useStore } from '../state/store';

/** The timed phase that is running (the learner's turn or the rating hold), or null. */
function useTimedPhase(): { startedAt: number; ms: number } | null {
  const { state } = useStore();
  const { status, phaseStartedAt, phaseMs } = state.player;
  if (status !== 'playing' || phaseStartedAt === null || phaseMs === null || phaseMs <= 0) return null;
  return { startedAt: phaseStartedAt, ms: phaseMs };
}

/**
 * A bar over the learner's turn or the rating hold: filling (the time so far) or depleting
 * (the time left). It runs over the length the machine fixed when the phase started
 * (`player.phaseMs`), the one the audio driver plays, from the phase's real start, so it is a
 * real timer, not an estimate. One Web Animation per phase, which costs no renders; with
 * reduced motion it steps once a second instead of gliding. Draws nothing in other phases
 * or while paused. Decorative: the pause and the hold are also marked by sound.
 */
export function PhaseFill({ className, deplete = false }: { className: string; deplete?: boolean }) {
  const phase = useTimedPhase();
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement>(null);
  const [now, setNow] = useState(clock.now);
  const startedAt = phase?.startedAt ?? null;
  const ms = phase?.ms ?? null;
  const scale = (fraction: number) => `scaleX(${deplete ? 1 - fraction : fraction})`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || startedAt === null || ms === null || reduce || typeof el.animate !== 'function') return;
    const elapsed = Math.min(ms, Math.max(0, clock.now() - startedAt));
    const animation = el.animate([{ transform: scale(elapsed / ms) }, { transform: scale(1) }], { duration: ms - elapsed, easing: 'linear', fill: 'forwards' });
    return () => animation.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `scale` follows `deplete`
  }, [startedAt, ms, reduce, deplete]);

  useEffect(() => {
    if (startedAt === null || !reduce) return;
    const id = setInterval(() => setNow(clock.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, reduce]);

  if (startedAt === null || ms === null) return null;
  // Reduced motion: the last whole-second reading (one from before this phase counts as its start).
  const stepped = Math.min(1, Math.max(0, (now - startedAt) / ms));
  return <span ref={ref} aria-hidden="true" className={`absolute origin-left ${className}`} style={{ transform: scale(reduce ? stepped : 0) }} />;
}
