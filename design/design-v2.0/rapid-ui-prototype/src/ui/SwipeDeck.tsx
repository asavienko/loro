import { AnimatePresence, motion, MotionValue, PanInfo, useIsPresent, useMotionValue, useTransform } from 'motion/react';
import { ReactNode } from 'react';
import { useClickBlockerDuringDrag } from '../lib/suppressClick';

/** Right is yes (add), left is no (skip). */
export type SwipeDirection = 1 | -1;

/** How cards move: which way the last one left, and whether the top card is one coming back (undo). */
export interface SwipeTravel {
  direction: SwipeDirection;
  returning: boolean;
}

export interface SwipeCard {
  key: string;
  node: ReactNode;
}

/** Far enough, or flung fast enough, to count; less springs back. */
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 600;
const FLING_MIN_DISTANCE = 30;

const variants = {
  // A new card rises from under the old one; a card taken back flies in from the side it left by.
  enter: (t: SwipeTravel) =>
    t.returning ? { x: t.direction * 380, rotate: t.direction * 16, scale: 1, y: 0, opacity: 0, zIndex: 20 } : { x: 0, rotate: 0, scale: 0.95, y: 12, opacity: 1, zIndex: 10 },
  center: { x: 0, rotate: 0, scale: 1, y: 0, opacity: 1, zIndex: 10, transition: { type: 'spring' as const, damping: 28, stiffness: 320 } },
  // A decided card flies off its side; the card an undo covers sinks back under it.
  exit: (t: SwipeTravel) =>
    t.returning
      ? { x: 0, rotate: 0, scale: 0.95, y: 12, opacity: 0, zIndex: 0, transition: { duration: 0.2 } }
      : { x: t.direction * 440, rotate: t.direction * 18, opacity: 0, zIndex: 20, transition: { duration: 0.26, ease: 'easeIn' as const } },
};

const cardClass = 'rounded-3xl bg-surface-container-lowest shadow-float forced-colors:border-2';

/**
 * A stack of cards to decide one at a time, like a dating app's: drag the top card right for yes,
 * left for no. The stamps say which while it is dragged. Buttons and keys elsewhere decide too
 * (`travel` then says which way the card leaves). Domain-free: the caller draws each card's face.
 */
export function SwipeDeck({
  top,
  under,
  travel,
  stamps,
  onSwipe,
  disabled = false,
}: {
  top: SwipeCard | null;
  under: SwipeCard | null;
  travel: SwipeTravel;
  stamps: { yes: string; no: string };
  onSwipe: (direction: SwipeDirection) => void;
  /** While a card is being corrected it stays put. */
  disabled?: boolean;
}) {
  return (
    // One grid cell holds every card, so the stack is as tall as its tallest card (large text too).
    <div className="grid">
      {under && (
        <div aria-hidden="true" inert className={`[grid-area:1/1] ${cardClass} scale-95 translate-y-3 opacity-80 pointer-events-none`}>
          {under.node}
        </div>
      )}
      <AnimatePresence initial={false} custom={travel}>
        {top && (
          <TopCard key={top.key} travel={travel} stamps={stamps} onSwipe={onSwipe} disabled={disabled}>
            {top.node}
          </TopCard>
        )}
      </AnimatePresence>
    </div>
  );
}

function TopCard({
  children,
  travel,
  stamps,
  onSwipe,
  disabled,
}: {
  children: ReactNode;
  travel: SwipeTravel;
  stamps: { yes: string; no: string };
  onSwipe: (direction: SwipeDirection) => void;
  disabled: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-14, 0, 14]);
  const yes = useTransform(x, [24, SWIPE_DISTANCE], [0, 1]);
  const no = useTransform(x, [-SWIPE_DISTANCE, -24], [1, 0]);
  const clicks = useClickBlockerDuringDrag();
  // A card on its way out is only a picture: out of the accessibility tree, and out of reach.
  const present = useIsPresent();

  const onDragEnd = (_: unknown, info: PanInfo) => {
    clicks.release();
    const { x: dx } = info.offset;
    const { x: vx } = info.velocity;
    if (dx > SWIPE_DISTANCE || (vx > SWIPE_VELOCITY && dx > FLING_MIN_DISTANCE)) onSwipe(1);
    else if (dx < -SWIPE_DISTANCE || (vx < -SWIPE_VELOCITY && dx < -FLING_MIN_DISTANCE)) onSwipe(-1);
  };

  return (
    <motion.div
      custom={travel}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      style={{ x, rotate }}
      drag={disabled || !present ? false : 'x'}
      dragSnapToOrigin
      dragElastic={0.85}
      onDragStart={clicks.block}
      onDragEnd={onDragEnd}
      data-swipe-card={present ? '' : undefined}
      aria-hidden={present ? undefined : true}
      inert={!present}
      // While it can be dragged, a press on its words starts the drag rather than selecting them. A
      // card being corrected is a form: its fields select as usual.
      className={`[grid-area:1/1] relative ${cardClass} touch-pan-y ${disabled ? '' : 'select-none cursor-grab active:cursor-grabbing'}`}
    >
      <Stamp value={yes} side="yes">
        {stamps.yes}
      </Stamp>
      <Stamp value={no} side="no">
        {stamps.no}
      </Stamp>
      {children}
    </motion.div>
  );
}

/** What a drag will do, shown on the card as it goes: a stamp that firms up with the distance. */
function Stamp({ value, side, children }: { value: MotionValue<number>; side: 'yes' | 'no'; children: ReactNode }) {
  return (
    <motion.span
      aria-hidden="true"
      style={{ opacity: value }}
      className={`absolute top-5 z-10 px-3 py-1 rounded-xl border-2 text-title font-bold pointer-events-none ${
        side === 'yes'
          ? 'left-5 -rotate-12 border-tertiary-container bg-tertiary-fixed text-on-tertiary-fixed'
          : 'right-5 rotate-12 border-inverse-surface bg-inverse-surface text-inverse-on-surface'
      }`}
    >
      {children}
    </motion.span>
  );
}
