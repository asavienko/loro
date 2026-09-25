import { getTopic, SETS, TopicTone, TOPICS } from '../content';
import type { SetView } from '../state/catalog';
import type { IconName } from './icons';

/** A topic's colour with its ink: covers and Explore's topic tiles. */
export const TONE: Record<TopicTone, string> = {
  primary: 'bg-primary-fixed text-on-primary-fixed',
  secondary: 'bg-secondary-container text-on-secondary-fixed',
  tertiary: 'bg-tertiary-fixed text-on-tertiary-fixed',
};

/** The same colour as a gradient start (`bg-linear-to-b {TONE_WASH} to-surface`): a page that takes its cover's colour. */
export const TONE_WASH: Record<TopicTone, string> = {
  primary: 'from-primary-fixed/55',
  secondary: 'from-secondary-container/70',
  tertiary: 'from-tertiary-fixed/55',
};

const MOTIF_TONE: Record<TopicTone, string> = {
  primary: 'bg-primary-fixed-dim',
  secondary: 'bg-secondary-fixed-dim',
  tertiary: 'bg-tertiary-fixed-dim',
};

// Shapes behind the glyph, in container units, so they follow the cover's size and not the text size.
// The glyph moves down with the shape's weight so it sits inside it.
const MOTIFS = [
  { shape: 'rounded-full w-[64cqi] h-[64cqi] left-[18cqi] top-[18cqi]', glyph: '' }, // medallion
  { shape: 'left-[16cqi] right-[16cqi] bottom-0 h-[74cqi] rounded-t-full', glyph: 'mt-[12cqi]' }, // arch
  { shape: 'inset-0 [clip-path:polygon(0_66%,100%_42%,100%_100%,0_100%)]', glyph: 'mt-[4cqi]' }, // horizon
];

// Sets in one topic share a colour, so each takes the next shape in content order and two of them
// never look alike; each topic starts on a different shape, so a grid mixes all three. A set
// without a topic (your own) picks one by its id.
const MOTIF_BY_SET = new Map(
  SETS.map((s) => [s.id, (TOPICS.findIndex((t) => t.id === s.topicId) + SETS.filter((t) => t.topicId === s.topicId).indexOf(s)) % MOTIFS.length]),
);
const motifOf = (id: string | undefined) =>
  id === undefined ? 0 : (MOTIF_BY_SET.get(id) ?? [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % MOTIFS.length);

interface SetCoverProps {
  /** `id` picks the shape; leave it out for a stand-in cover (a mixed queue, your phrases). */
  set: Pick<SetView, 'topicId' | 'coverIcon'> & { id?: string };
  /** `sm` for covers under 96 px: the glyph alone, larger, with no shape behind it. */
  size: 'sm' | 'md' | 'lg';
  /** Sizing and rounding of the square; the cover fills it. */
  className?: string;
}

/**
 * A set's cover, drawn from content: the topic's colour, a shape chosen per set and the set's
 * icon, whole and centred. Drawn rather than photographed (round-3 decision): it works offline,
 * costs nothing to load and never shows text or numbers that aren't in the content. The title
 * sits beside it or in the header, never on it. Everything is sized in container units, so a
 * 44 px mini-player cover and a 570 px desktop player cover are the same composition.
 */
export function SetCover({ set, size, className = '' }: SetCoverProps) {
  const tone = (set.topicId && getTopic(set.topicId)?.tone) || 'secondary';
  const motif = MOTIFS[motifOf(set.id)];
  return (
    <span aria-hidden="true" className={`@container relative block overflow-hidden ${TONE[tone]} ${className}`}>
      {size !== 'sm' && <span className={`absolute ${MOTIF_TONE[tone]} ${motif.shape}`} />}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className={`material-symbols-outlined opacity-90 ${size === 'sm' ? 'text-[length:60cqi]' : `text-[length:46cqi] ${motif.glyph}`}`}>
          {set.coverIcon as IconName}
        </span>
      </span>
    </span>
  );
}
