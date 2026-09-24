import { getTopic, TopicTone } from '../content';
import type { SetView } from '../state/catalog';
import type { IconName } from './icons';

export const TONE: Record<TopicTone, string> = {
  primary: 'bg-primary-fixed text-on-primary-fixed',
  secondary: 'bg-secondary-container text-on-secondary-fixed',
  tertiary: 'bg-tertiary-fixed text-on-tertiary-fixed',
};

const ICON_SIZE = { sm: 'text-icon-cover-sm', md: 'text-icon-cover-md', lg: 'text-icon-cover-lg' } as const;

interface SetCoverProps {
  set: Pick<SetView, 'topicId' | 'coverIcon'>;
  size: keyof typeof ICON_SIZE;
  /** Sizing and rounding of the square; the cover fills it. */
  className?: string;
}

/**
 * A set's cover, drawn from content: the topic's colour and the set's icon,
 * cropped at the corner. Drawn rather than photographed (round-3 decision): it
 * works offline, costs nothing to load and never shows text or numbers that
 * aren't in the content. The title sits beside it or in the header, never on it.
 */
export function SetCover({ set, size, className = '' }: SetCoverProps) {
  const tone = (set.topicId && getTopic(set.topicId)?.tone) || 'secondary';
  return (
    <span aria-hidden="true" className={`relative block overflow-hidden ${TONE[tone]} ${className}`}>
      <span className={`material-symbols-outlined absolute -right-[12%] -bottom-[14%] opacity-80 ${ICON_SIZE[size]}`}>
        {set.coverIcon as IconName}
      </span>
    </span>
  );
}
